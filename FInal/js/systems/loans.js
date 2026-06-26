// js/systems/loans.js – Three-Tier Loan System
// Bank, Loan Shark, Syndicate – each with different terms and default consequences.

import {
  G,
  fmt,
  clamp,
  hasItem,
  hasSkill,
  saveGame,
} from '../core/state.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[loans] toast:', msg, type);
let _addLog = (msg) => console.warn('[loans] log:', msg);
let _renderAll = () => console.warn('[loans] render called');

export function setLoansUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// LOAN STATE (extending G)

// G.loan – current balance (number)
// G.loanSource – 'Bank', 'Loan Shark', 'Syndicate', or 'none'
// G.loanInterestRate – monthly rate (e.g., 0.03 for 3%)
// G.loanMonthsUnpaid – number of months since last repayment
// G.loanDefaulted – boolean to prevent re-triggering

// ------------------------------------------------------------------
// TAKE A LOAN

/**
 * Take out a loan from a source.
 * @param {number} amount - loan amount
 * @param {string} source - 'Bank', 'Loan Shark', or 'Syndicate'
 * @param {number} rate - monthly interest rate (e.g., 0.03)
 * @returns {boolean} success
 */
export function takeLoan(amount, source, rate) {
  if (G.loan > 0) {
    _showToast('You already have an active loan. Pay it off first.', 'warn');
    return false;
  }
  if (amount <= 0) {
    _showToast('Enter a positive amount.', 'warn');
    return false;
  }

  // Source-specific checks
  if (source === 'Bank') {
    // Bank requires credit score >= 600 and some income
    if (G.creditScore < 600) {
      _showToast('❌ Bank loan requires credit score 600+. Your score: ' + G.creditScore, 'error');
      return false;
    }
    if (!G.job || G.job.wage < 200) {
      _showToast('❌ Bank loan requires a steady income (job wage >= $200/mo).', 'error');
      return false;
    }
    // Max amount based on credit score
    const maxBank = G.creditScore >= 700 ? 500 : 200;
    if (amount > maxBank) {
      _showToast('❌ Bank max loan for your credit is ' + fmt(maxBank), 'error');
      return false;
    }
    // Bank is "safe" but checks credit
  } else if (source === 'Loan Shark') {
    // No credit check, but amount limited to $1000
    if (amount > 1000) {
      _showToast('❌ Loan Shark max is $1000.', 'error');
      return false;
    }
    // Loan Shark may demand collateral later
  } else if (source === 'Syndicate') {
    // Syndicate gives up to $3000 but with high risk
    if (amount > 3000) {
      _showToast('❌ Syndicate max is $3000.', 'error');
      return false;
    }
    // No checks, but they will collect one way or another
  } else {
    _showToast('Unknown loan source.', 'error');
    return false;
  }

  // Grant loan
  G.loan = amount;
  G.loanSource = source;
  G.loanInterestRate = rate;
  G.loanMonthsUnpaid = 0;
  G.loanDefaulted = false;
  G.cash += amount;

  _showToast('💳 Borrowed ' + fmt(amount) + ' from ' + source + ' at ' + (rate * 100) + '%/mo interest.', 'warn');
  _addLog('💳 Loan taken: ' + fmt(amount) + ' from ' + source + ' (' + (rate * 100) + '%)');
  if (source === 'Bank') {
    G.creditScore = clamp(G.creditScore - 10, 200, 850);
  }
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// REPAY LOAN

/**
 * Repay a portion or all of the loan.
 * @param {number} amount – amount to repay (if 0, repay full balance)
 * @returns {boolean} success
 */
export function repayLoan(amount = 0) {
  if (G.loan <= 0) {
    _showToast('You have no loan.', 'info');
    return false;
  }

  let repayAmount = amount;
  if (repayAmount <= 0 || repayAmount > G.loan) {
    repayAmount = G.loan;
  }

  if (G.cash < repayAmount) {
    _showToast('Not enough cash. You need ' + fmt(repayAmount) + '.', 'error');
    return false;
  }

  // Deduct cash and reduce loan
  G.cash -= repayAmount;
  G.loan = parseFloat((G.loan - repayAmount).toFixed(2));

  // Reset unpaid months if any
  G.loanMonthsUnpaid = 0;
  G.loanDefaulted = false;

  if (G.loan < 0.01) {
    G.loan = 0;
    G.loanSource = 'none';
    G.loanInterestRate = 0.03;
    G.creditScore = clamp(G.creditScore + 15, 200, 850);
    _showToast('✅ Loan fully paid! Credit improved.', 'success');
    _addLog('💳 Loan fully repaid.');
  } else {
    _showToast('✅ Repaid ' + fmt(repayAmount) + '. Remaining: ' + fmt(G.loan), 'success');
    _addLog('💳 Repaid ' + fmt(repayAmount) + ' on loan. Remaining: ' + fmt(G.loan));
  }
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// MONTHLY INTEREST – called by time.js

/**
 * Apply monthly interest to the loan.
 * Also increments the unpaid months counter.
 * @returns {number} interest added
 */
export function applyLoanInterest() {
  if (G.loan <= 0) return 0;

  const interest = parseFloat((G.loan * G.loanInterestRate).toFixed(2));
  G.loan = parseFloat((G.loan + interest).toFixed(2));
  G.loanMonthsUnpaid = (G.loanMonthsUnpaid || 0) + 1;

  _showToast('💸 Loan interest: +' + fmt(interest) + '. Total: ' + fmt(G.loan), 'warn');
  _addLog('💸 Loan interest: +' + fmt(interest) + ' (' + G.loanSource + ')');
  G.creditScore = clamp(G.creditScore - 5, 200, 850);
  _renderAll();
  saveGame();
  return interest;
}

// ------------------------------------------------------------------
// CHECK LOAN DEFAULT – called by time.js each month

/**
 * Check if loan default conditions are met and apply consequences.
 * Called monthly after interest and rent.
 */
export function checkLoanDefault() {
  if (G.loan <= 0 || G.loanDefaulted) return;

  // Determine if player is in default:
  // - If they have not made any repayment in 3 months (loanMonthsUnpaid >= 3)
  // - Or if loan balance is more than 5x their cash (can't pay even interest)
  const cannotPay = G.cash < G.loan * 0.1; // less than 10% of loan
  const overdue = G.loanMonthsUnpaid >= 3;

  if (!overdue && !cannotPay) return;

  // Triggers default
  G.loanDefaulted = true;

  // Source-specific consequences
  if (G.loanSource === 'Bank') {
    // Bank: credit score hit, legal fees, maybe seizure of bank balance
    const penalty = Math.min(G.loan * 0.15, G.bank * 0.5);
    G.bank = Math.max(0, G.bank - penalty);
    G.creditScore = clamp(G.creditScore - 50, 200, 850);
    _showToast('🏦 Bank default! Legal fees: ' + fmt(penalty) + ' taken from bank. Credit destroyed.', 'error');
    _addLog('🏦 Bank default: penalty ' + fmt(penalty) + ', credit -50.');
    // Bank may also garnish wages later, but we'll keep it simple.
  } else if (G.loanSource === 'Loan Shark') {
    // Loan Shark: seize items (phone, laptop, suit, tools) and physical harm
    const stolen = [];
    if (hasItem('phone')) { G.inventory.phone = false; stolen.push('phone'); }
    if (hasItem('laptop')) { G.inventory.laptop = false; stolen.push('laptop'); }
    if (hasItem('suit')) { G.inventory.suit = false; stolen.push('suit'); }
    if (hasItem('tools')) { G.inventory.tools = false; stolen.push('tools'); }
    // Health damage
    const dmg = Math.floor(rand(15, 30));
    G.health = clamp(G.health - dmg, 0, 100);
    G.creditScore = clamp(G.creditScore - 30, 200, 850);
    _showToast('🦈 Loan Shark seized: ' + (stolen.length ? stolen.join(', ') : 'nothing') + ' and beat you up (-' + dmg + ' HP).', 'error');
    _addLog('🦈 Loan Shark default: stolen ' + (stolen.length ? stolen.join(', ') : 'none') + ', -' + dmg + ' HP.');
    // Reduce loan slightly as "settlement"
    G.loan = parseFloat((G.loan * 0.8).toFixed(2));
  } else if (G.loanSource === 'Syndicate') {
    // Syndicate: forced crime missions – we'll add a crime job requirement
    // For now: they take a cut of cash and force you to do a crime.
    const cut = Math.min(G.cash * 0.5, G.loan * 0.3);
    G.cash = Math.max(0, G.cash - cut);
    // They also force a crime – we can set a flag that the player must commit a crime
    // Or we can just reduce morale and health.
    G.morale = clamp(G.morale - 20, 0, 100);
    G.health = clamp(G.health - 10, 0, 100);
    G.creditScore = clamp(G.creditScore - 40, 200, 850);
    _showToast('☠️ Syndicate enforcers took ' + fmt(cut) + ' cash and gave you a mission. You must commit a crime this month.', 'error');
    _addLog('☠️ Syndicate default: cut ' + fmt(cut) + ', forced crime mission.');
    // We'll set a flag that the player has a pending crime mission
    G._pendingSyndicateMission = true;
  }

  // After default, loan may be reduced or written off, but source may keep the debt.
  // For simplicity, we'll keep the loan but reduce it slightly.
  // We also set a flag to prevent repeated defaults.
  G.loanDefaulted = true;
  _renderAll();
  saveGame();
}

// ------------------------------------------------------------------
// SYNDICATE MISSION – called from crimes system

/**
 * Check if there is a pending syndicate mission.
 * Called when player attempts to do a crime.
 */
export function checkSyndicateMission() {
  if (G._pendingSyndicateMission) {
    G._pendingSyndicateMission = false;
    // Reward: reduce loan by some amount
    const reduction = Math.min(G.loan * 0.2, 500);
    G.loan = parseFloat((G.loan - reduction).toFixed(2));
    if (G.loan < 0.01) {
      G.loan = 0;
      G.loanSource = 'none';
      G.loanInterestRate = 0.03;
      _showToast('☠️ Syndicate mission completed! Loan fully paid.', 'success');
      _addLog('☠️ Syndicate mission: loan reduced to 0.');
    } else {
      _showToast('☠️ Syndicate mission completed! Loan reduced by ' + fmt(reduction) + '. Remaining: ' + fmt(G.loan), 'success');
      _addLog('☠️ Syndicate mission: loan reduced by ' + fmt(reduction));
    }
    _renderAll();
    saveGame();
    return true;
  }
  return false;
}

// ------------------------------------------------------------------
// HELPERS

export function getLoanInfo() {
  return {
    balance: G.loan,
    source: G.loanSource,
    interestRate: G.loanInterestRate,
    monthsUnpaid: G.loanMonthsUnpaid || 0,
    defaulted: G.loanDefaulted || false,
  };
}

export function hasLoan() {
  return G.loan > 0;
}

// ------------------------------------------------------------------
// HOOKS FOR TIME SYSTEM – export functions

// The time system will call applyLoanInterest and checkLoanDefault
// on month end.

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility (temporary)
window.takeLoan = takeLoan;
window.repayLoan = repayLoan;