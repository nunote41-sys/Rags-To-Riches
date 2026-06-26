// js/systems/housing.js – Rent, Late Fees & Eviction Phases
// Manages monthly rent, late fees, eviction warnings and homelessness.

import {
  G,
  fmt,
  clamp,
  hasItem,
  hasSkill,
  saveGame,
} from '../core/state.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[housing] toast:', msg, type);
let _addLog = (msg) => console.warn('[housing] log:', msg);
let _renderAll = () => console.warn('[housing] render called');

export function setHousingUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// HOOKS FOR ECONOMY (to check cash)
// We'll use G directly, but can inject if needed.

// ------------------------------------------------------------------
// MAIN RENT LOGIC – called by time.js on month end

/**
 * Apply monthly rent: increment rent due, add late fee, check eviction.
 * This should be called once per month by the time system.
 */
export function applyRent() {
  // If already evicted, we still increment rent but it doesn't matter
  // because they are already homeless. But we'll keep track.
  G.rentDue++;

  // Calculate late fee: 8% of rent per month overdue
  if (G.rentDue > 0) {
    G.rentLateFee = Math.floor(G.rent * 0.08 * G.rentDue);
  } else {
    G.rentLateFee = 0;
  }

  // Eviction phases:
  // Phase 0: rentDue = 0 -> all good
  // Phase 1: rentDue = 1 -> warning
  // Phase 2: rentDue = 2 -> eviction imminent (warn)
  // Phase 3: rentDue >= 3 -> evicted
  if (G.rentDue === 1) {
    _showToast('📅 Rent is due this month. Pay it by month end.', 'warn');
    _addLog('📅 Rent due: ' + fmt(G.rent) + ' due.');
  } else if (G.rentDue === 2) {
    G.morale = clamp(G.morale - 15, 0, 100);
    G.stress = clamp(G.stress + 20, 0, 100);
    _showToast('🚨 EVICTION IMMINENT! 2 months rent overdue! Pay now or lose your home.', 'error');
    _addLog('🚨 Eviction notice issued.');
  } else if (G.rentDue >= 3 && !G.evicted) {
    // Eviction occurs
    G.evicted = true;
    G.housingStatus = 'Homeless / Street';
    G.morale = clamp(G.morale - 30, 0, 100);
    G.health = clamp(G.health - 15, 0, 100);
    G.stress = clamp(G.stress + 40, 0, 100);
    G.creditScore = clamp(G.creditScore - 50, 200, 850);
    _showToast('🏚️ EVICTED! You are now homeless.', 'error');
    _addLog('🏚️ Evicted! Now homeless.');
  } else if (G.evicted) {
    // Already homeless: just add to debt
    _showToast('💸 You are still homeless. Rent debt grows: ' + fmt(G.rentDue * G.rent), 'error');
    _addLog('💸 Homeless: rent debt now ' + fmt(G.rentDue * G.rent));
  }

  // Update utilities and phone flags based on cash
  G.utilsPaid = G.cash >= 40;
  G.phonePaid = G.cash >= 20;

  // Update badge in UI will be handled by render
  _renderAll();
  saveGame();
}

// ------------------------------------------------------------------
// PAY RENT – called by UI (button in Life tab)

/**
 * Attempt to pay rent. Pays as many full months as possible.
 * @param {number} amount - amount to pay (if 0, pay all due)
 * @returns {boolean} true if any rent was paid
 */
export function payRent(amount = null) {
  if (G.evicted && G.rentDue === 0) {
    // If evicted but rentDue is 0 (shouldn't happen), we can allow re-housing?
    // For now, just show message.
    _showToast('You are already homeless. You need to find a new place.', 'info');
    return false;
  }

  const totalDue = G.rent * G.rentDue + G.rentLateFee;
  let payAmount = amount !== null ? amount : totalDue;

  // If payAmount is 0 or negative, pay all due
  if (payAmount <= 0) {
    payAmount = totalDue;
  }

  // Clamp to actual due
  payAmount = Math.min(payAmount, totalDue);

  if (payAmount <= 0) {
    _showToast('No rent due!', 'success');
    return false;
  }

  // Check if we have enough cash
  if (G.cash < payAmount) {
    // Try to pay partial months
    const monthlyRent = G.rent;
    const monthsCanPay = Math.floor(G.cash / monthlyRent);
    if (monthsCanPay === 0) {
      _showToast('Cannot afford even 1 month of rent (' + fmt(monthlyRent) + '). Need more cash.', 'error');
      return false;
    }
    const partialPay = monthsCanPay * monthlyRent;
    G.cash -= partialPay;
    G.rentDue -= monthsCanPay;
    _showToast('⚠️ Partial payment: paid ' + fmt(partialPay) + ' (' + monthsCanPay + ' month(s)). Still owe ' + G.rentDue + ' month(s).', 'warn');
    _addLog('🏠 Partial rent paid: ' + fmt(partialPay) + ' (' + monthsCanPay + ' months).');
    // Recalculate late fee
    G.rentLateFee = G.rentDue > 0 ? Math.floor(G.rent * 0.08 * G.rentDue) : 0;
    // If rentDue now 0, we are all clear
    if (G.rentDue === 0) {
      G.rentLateFee = 0;
      if (G.evicted) {
        G.evicted = false;
        G.housingStatus = 'Rented Apartment';
        _showToast('🏠 You found a new place! Back indoors.', 'success');
        _addLog('🏠 Re-housed after eviction.');
      }
      G.creditScore = clamp(G.creditScore + 5, 200, 850);
    }
    _renderAll();
    saveGame();
    return true;
  }

  // Full payment
  G.cash -= payAmount;
  G.rentDue = 0;
  G.rentLateFee = 0;
  if (G.evicted) {
    G.evicted = false;
    G.housingStatus = 'Rented Apartment';
    _showToast('🏠 You found a new place! Back indoors.', 'success');
    _addLog('🏠 Re-housed after eviction.');
  }
  G.creditScore = clamp(G.creditScore + 5, 200, 850);
  _showToast('✅ Rent paid! ' + fmt(payAmount) + ' including any late fees.', 'success');
  _addLog('🏠 Rent paid: ' + fmt(payAmount));
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// GETTERS FOR UI

/**
 * Get total rent due including late fees.
 */
export function getTotalRentDue() {
  return G.rent * G.rentDue + G.rentLateFee;
}

/**
 * Get rent status as a string for UI.
 */
export function getRentStatus() {
  if (G.evicted) return '🏚️ Evicted';
  if (G.rentDue === 0) return '✅ Paid';
  if (G.rentDue === 1) return '⚠️ 1 month overdue';
  if (G.rentDue === 2) return '🚨 2 months overdue – EVICTION IMMINENT';
  return '🔥 ' + G.rentDue + ' months overdue – EVICTED';
}

/**
 * Get housing description.
 */
export function getHousingDescription() {
  return G.evicted ? 'Homeless' : G.housingStatus || 'Rented Apartment';
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility (temporary)
window.payRent = payRent;