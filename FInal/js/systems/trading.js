// js/systems/trading.js – Positions, Orders, P&L Calculation
// Manages open positions, trade history, order execution, and P&L.

import {
  G,
  fmt,
  fmtP,
  clamp,
  hasSkill,
  saveGame,
} from '../core/state.js';

// Import market data and asset config
import { getPrice, getBid, getAsk, getAssetInfo, setOnPriceUpdate } from './market.js';
import { ASSETS } from './market.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[trading] toast:', msg, type);
let _addLog = (msg) => console.warn('[trading] log:', msg);
let _renderAll = () => console.warn('[trading] render called');

export function setTradingUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// ORDER PREVIEW (called by UI)

/**
 * Calculate margin, pip value, lot value for a given symbol and lots.
 * Used for order preview.
 */
export function calculateOrderDetails(symbol, lots) {
  const asset = getAssetInfo(symbol);
  if (!asset) return null;
  const price = getPrice(symbol);
  if (!price) return null;

  const entry = { bid: price.bid, ask: price.ask };
  const lotValue = lots * asset.contractSize * (price.ask || price.bid);
  const margin = Math.max(asset.minMargin, lots * asset.minMargin * 10);
  const pipVal = lots * asset.pipValue;
  return {
    entry,
    lotValue,
    margin,
    pipVal,
  };
}

// ------------------------------------------------------------------
// OPEN POSITION

/**
 * Open a new trading position.
 * @param {string} symbol - e.g., 'frxXAUUSD'
 * @param {number} lots - lot size (0.01 to 10)
 * @param {string} type - 'buy' or 'sell'
 * @returns {object} { success, message, position? }
 */
export function openPosition(symbol, lots, type) {
  if (lots < 0.01 || lots > 10) {
    _showToast('Lots must be between 0.01 and 10.', 'warn');
    return { success: false, message: 'Invalid lot size' };
  }

  const asset = getAssetInfo(symbol);
  if (!asset) {
    _showToast('Asset not found.', 'error');
    return { success: false, message: 'Unknown asset' };
  }

  const price = getPrice(symbol);
  if (!price) {
    _showToast('Price data not available.', 'error');
    return { success: false, message: 'No price' };
  }

  const margin = Math.max(asset.minMargin, lots * asset.minMargin * 10);
  if (G.cash < margin) {
    _showToast('Insufficient margin. Need ' + fmt(margin) + '.', 'error');
    return { success: false, message: 'Insufficient margin' };
  }

  // High stress penalty warning
  if (G.stress > 70 && !hasSkill('risk_management')) {
    _showToast('⚠️ High stress may cause poor trading decisions!', 'warn');
  }

  const entryPrice = type === 'buy' ? price.ask : price.bid;
  const position = {
    sym: symbol,
    name: asset.name,
    lots: lots,
    entry: entryPrice,
    type: type,
    margin: margin,
    openDay: 'D' + G.day + '/M' + G.month,
    id: Date.now() + Math.random(),
  };

  G.cash -= margin;
  G.portfolio.push(position);
  G.xp += 5; // Small XP for trading
  checkLevelUp();

  _showToast('✅ ' + type.toUpperCase() + ' ' + symbol + ' · ' + lots + ' lots @ ' + fmtP(entryPrice, symbol === 'frxXAUUSD' ? 2 : 5), 'success');
  _addLog('📈 Opened ' + type.toUpperCase() + ' ' + symbol + ' · ' + lots + ' lots · margin ' + fmt(margin));
  _renderAll();
  saveGame();
  return { success: true, position };
}

// ------------------------------------------------------------------
// CLOSE POSITION

/**
 * Close a position by index in the portfolio array.
 * @param {number} index - portfolio index
 * @returns {object} { success, pnl, message }
 */
export function closePosition(index) {
  if (index < 0 || index >= G.portfolio.length) {
    _showToast('Position not found.', 'error');
    return { success: false, message: 'Invalid index' };
  }

  const pos = G.portfolio[index];
  const price = getPrice(pos.sym);
  if (!price) {
    _showToast('Price data not available to close.', 'error');
    return { success: false, message: 'No price' };
  }

  const currentPrice = pos.type === 'buy' ? price.bid : price.ask;
  const pnl = calcPnl(pos, currentPrice);
  const returned = pos.margin + pnl;

  G.cash += Math.max(0, returned); // In case of negative, we don't want cash to go below zero
  // Actually, if P&L is negative, the margin is partially lost, so we add (margin + pnl) which may be less than margin.
  // This is correct: cash += margin + pnl.

  // Record trade history
  const closedTrade = {
    ...pos,
    closedAt: currentPrice,
    pnl: pnl,
    closedDay: 'D' + G.day + '/M' + G.month,
  };
  G.tradeHistory.unshift(closedTrade);
  if (G.tradeHistory.length > 100) G.tradeHistory.pop();

  // Remove from portfolio
  G.portfolio.splice(index, 1);

  if (pnl > 0) {
    G.xp += 8; // extra XP for profitable trade
    checkLevelUp();
    _showToast('✅ Profit: +' + fmt(pnl) + ' on ' + pos.sym + '. Returned: ' + fmt(returned), 'success');
    _addLog('✅ Closed ' + pos.sym + ' ' + pos.type.toUpperCase() + ': +' + fmt(pnl));
  } else {
    _showToast('❌ Loss: ' + fmt(pnl) + ' on ' + pos.sym + '. Returned: ' + fmt(returned), 'error');
    _addLog('❌ Closed ' + pos.sym + ' ' + pos.type.toUpperCase() + ': ' + fmt(pnl));
  }

  _renderAll();
  saveGame();
  return { success: true, pnl, returned };
}

// ------------------------------------------------------------------
// P&L CALCULATION

/**
 * Calculate P&L for a position at a given current price.
 * @param {object} position - position object
 * @param {number} currentPrice - current bid or ask price
 * @returns {number} profit/loss in dollars
 */
export function calcPnl(position, currentPrice) {
  const asset = getAssetInfo(position.sym);
  if (!asset) return 0;

  const diff = position.type === 'buy' ? currentPrice - position.entry : position.entry - currentPrice;

  // For XAUUSD: 1 pip = $0.01 per oz, contract=100oz, so diff in $ * lots * 100
  if (position.sym === 'frxXAUUSD') {
    return diff * position.lots * asset.contractSize;
  } else if (position.sym === 'frxUSDJPY') {
    // diff in JPY, convert pip
    return (diff / 0.01) * asset.pipValue * position.lots;
  } else {
    // EUR pairs: 1 pip = 0.0001, pip value = $10 per std lot
    return (diff / 0.0001) * asset.pipValue * position.lots;
  }
}

// ------------------------------------------------------------------
// GETTERS FOR UI

export function getOpenPositions() {
  return G.portfolio;
}

export function getOpenPnlTotal() {
  let total = 0;
  G.portfolio.forEach(p => {
    const price = getPrice(p.sym);
    if (price) {
      const current = p.type === 'buy' ? price.bid : price.ask;
      total += calcPnl(p, current);
    }
  });
  return total;
}

/**
 * Get total value of open positions (cash value of unrealised P&L + margin? Typically just P&L for net worth).
 * For net worth, we want the unrealised P&L (can be negative) plus any margin? Actually margin is already deducted from cash.
 * So the net worth from positions is just the unrealised P&L.
 */
export function getPositionsValue() {
  return getOpenPnlTotal();
}

export function getTradeHistory() {
  return G.tradeHistory;
}

export function getTotalTradePnl() {
  let total = 0;
  G.tradeHistory.forEach(t => total += t.pnl || 0);
  return total;
}

// ------------------------------------------------------------------
// LEVEL UP CHECK (reused from jobs, but needed for XP)

function checkLevelUp() {
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.floor(G.xpNext * 1.5);
    _showToast('⭐ Level Up! Now Level ' + G.level + '!', 'success');
    _addLog('⭐ Level up! Level ' + G.level);
    if (G.level === 3) {
      G.cash += 200;
      _showToast('🎁 Level 3 bonus: +$200!', 'success');
    }
    if (G.level === 5) {
      G.bank += 500;
      _showToast('🎁 Level 5 bonus: +$500 to bank!', 'success');
    }
    if (G.level === 10) {
      G.creditScore = clamp(G.creditScore + 20, 200, 850);
      _showToast('🎁 Level 10 bonus: +20 credit score!', 'success');
    }
  }
}

// ------------------------------------------------------------------
// EXPOSE GETTER FOR ECONOMY (net worth)
// We'll set a global function that economy.js can call.

import { setOpenPositionsGetter } from './economy.js';

// This will be called from the main initialisation to wire up economy
export function initTrading() {
  setOpenPositionsGetter(getPositionsValue);
  // Register price update callback to refresh P&L
  setOnPriceUpdate(() => {
    // P&L updates are handled by UI re-render, but we can trigger a small update
    // We'll let the UI re-render on its own cycle.
  });
}

// ------------------------------------------------------------------
// QUICK TRADE (called from UI market table buttons)

export function quickTrade(symbol, type) {
  // Use 0.1 lots as default
  const result = openPosition(symbol, 0.1, type);
  if (result.success) {
    // Optionally switch to trading tab? The UI will handle.
  }
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility
window.openPosition = openPosition;
window.closePosition = closePosition;
window.quickTrade = quickTrade;