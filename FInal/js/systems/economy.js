// js/systems/economy.js – Cash, Bank & Interest Math
// Handles all money movements: deposits, withdrawals, transfers, interest.
// Also calculates net worth.

import {
  G,
  fmt,
  clamp,
  hasItem,
  hasSkill,
  saveGame,
} from '../core/state.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[economy] toast:', msg, type);
let _addLog = (msg) => console.warn('[economy] log:', msg);
let _renderAll = () => console.warn('[economy] render called');

export function setEconomyUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// BANK INTEREST – called by time.js on month end

/**
 * Apply monthly interest to bank balance (1.5%).
 * This should be called once per month by the time system.
 */
export function applyBankInterest() {
  if (G.bank > 0) {
    const interest = parseFloat((G.bank * 0.015).toFixed(2));
    G.bank += interest;
    G.interestEarned = (G.interestEarned || 0) + interest;
    _addLog('🏦 Bank interest: +' + fmt(interest));
    if (interest > 0.01) {
      _showToast('🏦 Interest: +' + fmt(interest), 'info');
    }
    return interest;
  }
  return 0;
}

// ------------------------------------------------------------------
// DEPOSIT / WITHDRAW

/**
 * Deposit cash into the bank.
 * @param {number} amount - amount to deposit
 * @returns {boolean} success
 */
export function deposit(amount) {
  if (amount <= 0) {
    _showToast('Enter a positive amount.', 'warn');
    return false;
  }
  if (G.cash < amount) {
    _showToast('Not enough cash.', 'error');
    return false;
  }
  // AML check: large cash deposit (>$1500) without a high-paying job
  if (amount > 1500 && (!G.job || G.job.wage < 500)) {
    const fine = 150;
    G.cash = Math.max(0, G.cash - fine);
    _showToast('🏦 AML flag! Bank froze deposit. Fine: $' + fine + '.', 'error');
    _addLog('🏦 AML flag: Deposit frozen. Fine ' + fmt(fine));
    _addBankTx('AML Fine', fine, 'red');
    _renderAll();
    saveGame();
    return false;
  }
  G.cash -= amount;
  G.bank += amount;
  G.totalDeposited = (G.totalDeposited || 0) + amount;
  _addBankTx('Deposit', amount, 'green');
  _showToast('✅ Deposited ' + fmt(amount), 'success');
  _addLog('🏦 Deposited ' + fmt(amount));
  _renderAll();
  saveGame();
  return true;
}

/**
 * Withdraw cash from the bank.
 * @param {number} amount - amount to withdraw
 * @returns {boolean} success
 */
export function withdraw(amount) {
  if (amount <= 0) {
    _showToast('Enter a positive amount.', 'warn');
    return false;
  }
  if (G.bank < amount) {
    _showToast('Not enough bank balance.', 'error');
    return false;
  }
  G.bank -= amount;
  G.cash += amount;
  _addBankTx('Withdrawal', amount, 'red');
  _showToast('✅ Withdrew ' + fmt(amount), 'success');
  _addLog('🏦 Withdrew ' + fmt(amount));
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// TRANSFER between cash and bank (with 1% fee)

/**
 * Transfer money between cash and bank.
 * @param {number} amount - amount to transfer
 * @param {string} from - 'cash' or 'bank'
 * @param {string} to - 'cash' or 'bank'
 * @returns {boolean} success
 */
export function transfer(amount, from, to) {
  if (from === to) {
    _showToast('Source and destination are the same.', 'warn');
    return false;
  }
  if (amount <= 0) {
    _showToast('Enter a positive amount.', 'warn');
    return false;
  }

  // Check source balance
  if (from === 'cash' && G.cash < amount) {
    _showToast('Not enough cash.', 'error');
    return false;
  }
  if (from === 'bank' && G.bank < amount) {
    _showToast('Not enough bank balance.', 'error');
    return false;
  }

  // 1% fee (minimum $1)
  const fee = Math.max(1, parseFloat((amount * 0.01).toFixed(2)));

  // AML check for cash → bank large deposit
  if (from === 'cash' && to === 'bank' && amount > 1500 && (!G.job || G.job.wage < 500)) {
    const fine = 150;
    G.cash = Math.max(0, G.cash - fine);
    _showToast('🏦 AML flag! Bank froze transfer. Fine: $' + fine + '.', 'error');
    _addLog('🏦 AML flag: Transfer frozen. Fine ' + fmt(fine));
    _addBankTx('AML Fine', fine, 'red');
    _renderAll();
    saveGame();
    return false;
  }

  // Execute transfer
  const totalDeduct = amount + fee;
  if (from === 'cash') {
    G.cash -= totalDeduct;
    G.bank += amount;
  } else {
    G.bank -= totalDeduct;
    G.cash += amount;
  }

  _showToast('✅ Transferred ' + fmt(amount) + '. Fee: ' + fmt(fee), 'success');
  _addLog('🔄 Transfer ' + from + '→' + to + ': ' + fmt(amount) + ' (fee ' + fmt(fee) + ')');
  _addBankTx('Transfer (' + from + '→' + to + ')', amount, 'blue');
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// NET WORTH CALCULATION

/**
 * Calculate total net worth: cash + bank + open position value - loans.
 * @returns {number} net worth
 */
export function getNetWorth() {
  // Open position value requires the trading system.
  // We'll use a callback or placeholder.
  let posValue = 0;
  if (typeof _getOpenPositionsValue === 'function') {
    posValue = _getOpenPositionsValue();
  } else {
    // Fallback: just sum margins? Or assume 0 if not loaded.
    // We'll just return cash + bank - loan for now.
  }
  return G.cash + G.bank + posValue - G.loan;
}

// Placeholder for open positions – will be set by trading system
let _getOpenPositionsValue = () => 0;

export function setOpenPositionsGetter(fn) {
  _getOpenPositionsValue = fn;
}

/**
 * Simple version without trading positions (for UI that doesn't need it).
 */
export function getSimpleNetWorth() {
  return G.cash + G.bank - G.loan;
}

// ------------------------------------------------------------------
// INTERNAL HELPER – add bank transaction log

function _addBankTx(type, amount, color = 'green') {
  if (!G.bankTxLog) G.bankTxLog = [];
  G.bankTxLog.unshift({
    type: type,
    amt: amount,
    day: 'D' + G.day + '/M' + G.month,
    col: color,
  });
  if (G.bankTxLog.length > 60) G.bankTxLog.pop();
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility (temporary)
window.deposit = deposit;
window.withdraw = withdraw;
window.transfer = transfer;