// js/systems/time.js – Time System
// Handles day, week, month, year progression with all consequences.
// This is the heartbeat of the game – everything that happens over time.

import {
  G,
  fmt,
  clamp,
  rand,
  hasItem,
  hasSkill,
  saveGame,
} from '../core/state.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[time] toast:', msg, type);
let _addLog = (msg) => console.warn('[time] log:', msg);
let _renderAll = () => console.warn('[time] render called');

export function setTimeUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// EXTERNAL SYSTEM HOOKS – these will be set by other modules
// This avoids circular dependencies while allowing systems to interact.

// Vitals system (will be imported from vitals.js)
let _vitalsDecay = null;

// Economy system (will be imported from economy.js)
let _applySalary = null;
let _applyBankInterest = null;
let _applyLoanInterest = null;

// Housing system (will be imported from housing.js)
let _applyRent = null;

// Jobs system (will be imported from jobs.js)
let _checkCorporateFiring = null;
let _resetWeeklyShifts = null;

// Loans system (will be imported from loans.js)
let _checkLoanDefault = null;

// Subscription system (will be imported from subscriptions.js)
let _applySubscriptions = null;

// Laptop system (will be imported from laptop.js)
let _applyLaptopDurability = null;

export function setTimeHooks(hooks) {
  if (hooks.vitalsDecay) _vitalsDecay = hooks.vitalsDecay;
  if (hooks.applySalary) _applySalary = hooks.applySalary;
  if (hooks.applyBankInterest) _applyBankInterest = hooks.applyBankInterest;
  if (hooks.applyLoanInterest) _applyLoanInterest = hooks.applyLoanInterest;
  if (hooks.applyRent) _applyRent = hooks.applyRent;
  if (hooks.checkCorporateFiring) _checkCorporateFiring = hooks.checkCorporateFiring;
  if (hooks.resetWeeklyShifts) _resetWeeklyShifts = hooks.resetWeeklyShifts;
  if (hooks.checkLoanDefault) _checkLoanDefault = hooks.checkLoanDefault;
  if (hooks.applySubscriptions) _applySubscriptions = hooks.applySubscriptions;
  if (hooks.applyLaptopDurability) _applyLaptopDurability = hooks.applyLaptopDurability;
}

// ------------------------------------------------------------------
// TIME HELPERS

export function getCurrentPeriod() {
  const h = G.hour;
  if (h >= 5 && h < 6) return '🌅 Dawn';
  if (h >= 6 && h < 7) return '☀️ Sunrise';
  if (h >= 7 && h < 12) return '🏙️ Morning';
  if (h >= 12 && h < 13) return '🕛 Noon';
  if (h >= 13 && h < 17) return '🌆 Afternoon';
  if (h >= 17 && h < 18) return '🌇 Sunset';
  if (h >= 18 && h < 19) return '🌆 Dusk';
  if (h >= 19 && h < 21) return '🌌 Evening';
  if (h >= 21 || h < 0) return '🌙 Night';
  if (h >= 0 && h < 5) return '🌌 Midnight';
  return '🌙 Night';
}

export function isNight() {
  return G.hour >= 21 || G.hour < 5;
}

export function isDaytime() {
  return !isNight();
}

export function advanceMinutes(minutes) {
  let totalMin = G.hour * 60 + G.minute + minutes;
  while (totalMin >= 1440) {
    totalMin -= 1440;
    G.day++;
    G._traveledToStore = false;   // reset store travel flag on new day
    
    // Check for week rollover (every 7 days)
    if (G.day % 7 === 0) {
      if (_checkCorporateFiring) _checkCorporateFiring();
      if (_resetWeeklyShifts) _resetWeeklyShifts();
      if (G.rentDue === 0 && G.loan === 0) {
        G.creditScore = clamp(G.creditScore + 2, 200, 850);
      }
      _addLog('📆 Week ' + Math.ceil(G.day / 7) + ' completed.');
    }

    if (G.day > 30) {
      G.day = 1;
      G.month++;
      if (_applySalary) _applySalary();
      if (_applyBankInterest) _applyBankInterest();
      if (_applyLoanInterest) _applyLoanInterest();
      if (_applyRent) _applyRent();
      if (_applySubscriptions) _applySubscriptions();
      if (_applyLaptopDurability) _applyLaptopDurability();
      if (_checkLoanDefault) _checkLoanDefault();
      
      if (G.rentDue === 0 && G.loan === 0) {
        G.creditScore = clamp(G.creditScore + 3, 200, 850);
      }
      
      if (G.month > 12) {
        G.month = 1;
        G.year++;
        G.morale = clamp(G.morale + 5, 0, 100);
        _showToast('🎂 Happy birthday! +5 morale.', 'success');
        if (G.rentDue === 0 && G.loan === 0 && G.arrests === 0) {
          G.creditScore = clamp(G.creditScore + 10, 200, 850);
          _showToast('📈 Excellent year! Credit score +10.', 'success');
        }
        if (G.rent > 0) {
          G.rent = Math.floor(G.rent * 1.03);
        }
      }
      _addLog('📆 Month ' + G.month + ' started.');
    }
  }
  G.hour = Math.floor(totalMin / 60);
  G.minute = totalMin % 60;
}

export function fastForward(hours) {
  const mins = hours * 60;
  const steps = Math.max(1, Math.ceil(mins / 10)); // process every 10 minutes
  const perStep = mins / steps;
  for (let i = 0; i < steps; i++) {
    advanceMinutes(perStep);
    if (_vitalsDecay) _vitalsDecay(perStep / 60); // fraction of an hour
  }
  _renderAll();
}

export function getTimeDisplay() {
  return `${String(G.hour).padStart(2, '0')}:${String(G.minute).padStart(2, '0')} ${getCurrentPeriod()}`;
}

// ------------------------------------------------------------------
// REST ACTIONS

export function startNap() {
  if (!isDaytime()) {
    _showToast('Cannot nap at night.', 'warn');
    return;
  }
  let hours = 1;
  if (G.fatigue < 30) hours = 3;
  else if (G.fatigue < 50) hours = 2.5;
  else if (G.fatigue < 70) hours = 2;
  _showToast(`Taking a nap for ${hours} hours...`, 'info');
  fastForward(hours);
  G.fatigue = clamp(G.fatigue + 25, 0, 100);
  G.hunger = clamp(G.hunger - 5, 0, 100);
  _addLog('Nap completed.');
  _renderAll();
}

export function startNightSleep() {
  if (!isNight()) {
    _showToast('You can only sleep at night.', 'warn');
    return;
  }
  let hours = 6;
  if (G.fatigue < 20) hours = 10;
  else if (G.fatigue < 40) hours = 8;
  else if (G.fatigue < 60) hours = 7;
  _showToast(`Going to sleep for ${hours} hours...`, 'info');
  fastForward(hours);
  G.fatigue = 100;
  G.hunger = clamp(G.hunger - 15, 0, 100);
  G.hygiene = clamp(G.hygiene - 5, 0, 100);
  _addLog('Woke up refreshed.');
  _renderAll();
}

export function takeShower() {
  fastForward(0.25); // 15 minutes
  G.hygiene = clamp(G.hygiene + 40, 0, 100);
  G.fatigue = clamp(G.fatigue + 3, 0, 100);
  _showToast('🚿 Showered. +40 hygiene.', 'success');
  _addLog('Took a shower.');
  _renderAll();
}

export function skipToMorning() {
  // advance until 6 AM next day
  let minutesUntilMorning = (24 - G.hour + 6) * 60 - G.minute;
  if (minutesUntilMorning <= 0) minutesUntilMorning += 24 * 60;
  fastForward(minutesUntilMorning / 60);
  _showToast('☀️ Skipped to morning.', 'info');
  _addLog('Skipped to morning.');
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility
window.advanceMinutes = advanceMinutes;
window.fastForward = fastForward;
window.startNap = startNap;
window.startNightSleep = startNightSleep;
window.takeShower = takeShower;
window.skipToMorning = skipToMorning;