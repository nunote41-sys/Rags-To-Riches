// js/systems/market.js – Live Price Feed & Market Data
// Supports Deriv (forex/commodities) WebSocket feed with simulated fallback.
// Also allows adding/removing custom tradable assets.

import {
  G,
  fmt,
  fmtP,
  clamp,
  saveGame,
} from '../core/state.js';

// UI callbacks (injected from engine.js)
let _showToast = (msg, type) => console.warn('[market] toast:', msg, type);
let _addLog = (msg) => console.warn('[market] log:', msg);
let _renderAll = () => console.warn('[market] render called');
let _updateTicker = () => console.warn('[market] updateTicker called');
let _renderMarketTable = () => console.warn('[market] renderMarketTable called');

export function setMarketUI(toastFn, logFn, renderFn, tickerFn, tableFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
  _updateTicker = tickerFn;
  _renderMarketTable = tableFn;
}

// ------------------------------------------------------------------
// ASSET CONFIGURATION
export const ASSETS = {
  'frxXAUUSD': { name: 'Gold (XAU/USD)', lotSize: 100, pipValue: 1.0, contractSize: 100, minMargin: 100, type: 'deriv' },
  'frxEURUSD': { name: 'EUR/USD', lotSize: 100000, pipValue: 10, contractSize: 100000, minMargin: 50, type: 'deriv' },
  'frxGBPUSD': { name: 'GBP/USD', lotSize: 100000, pipValue: 10, contractSize: 100000, minMargin: 50, type: 'deriv' },
  'frxUSDJPY': { name: 'USD/JPY', lotSize: 100000, pipValue: 0.9, contractSize: 100000, minMargin: 50, type: 'deriv' },
  'frxUSDCAD': { name: 'USD/CAD', lotSize: 100000, pipValue: 7.7, contractSize: 100000, minMargin: 50, type: 'deriv' },
};

// Default prices (used initially and when simulation is active)
export let livePrices = {};
const defaultPrices = {
  'frxXAUUSD': { bid: 2340, ask: 2340.5 },
  'frxEURUSD': { bid: 1.0880, ask: 1.0882 },
  'frxGBPUSD': { bid: 1.2700, ask: 1.2703 },
  'frxUSDJPY': { bid: 156.80, ask: 156.83 },
  'frxUSDCAD': { bid: 1.3620, ask: 1.3623 },
};
Object.keys(ASSETS).forEach(sym => {
  livePrices[sym] = { ...defaultPrices[sym] };
});

// WebSocket and state
let ws = null;
let isConnected = false;
let isSimulating = false;
let simulationInterval = null;
let reconnectTimer = null;

// Callback for trading P&L updates
let _onPriceUpdate = null;

// ------------------------------------------------------------------
// WEBSOCKET CONNECTION (Deriv)

export function connectDeriv() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return; // already connected or connecting
  }

  try {
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    ws.onopen = () => {
      isConnected = true;
      isSimulating = false;

      // Subscribe to all Deriv assets (including custom ones)
      Object.keys(ASSETS).forEach(sym => {
        if (ASSETS[sym].type === 'deriv') {
          ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
        }
      });

      _showToast('📡 Live market data connected (Deriv).', 'success');
      _addLog('📡 Deriv WebSocket connected.');

      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }

      const feedStatus = document.getElementById('feed-status');
      if (feedStatus) feedStatus.textContent = 'Live ✓';
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.tick && data.tick.symbol && data.tick.quote) {
          const sym = data.tick.symbol;
          const q = parseFloat(data.tick.quote);
          const spread = sym === 'frxXAUUSD' ? 0.5 : (sym === 'frxUSDJPY' ? 0.02 : 0.0002);
          livePrices[sym] = {
            bid: parseFloat((q - spread / 2).toFixed(5)),
            ask: parseFloat((q + spread / 2).toFixed(5)),
            raw: q,
          };

          // Throttle UI updates using requestAnimationFrame
          if (!window._priceUpdatePending) {
            window._priceUpdatePending = true;
            requestAnimationFrame(() => {
              window._priceUpdatePending = false;
              _updateTicker();
              _renderMarketTable();
              if (typeof _onPriceUpdate === 'function') _onPriceUpdate();
            });
          }
        }
      } catch (err) { /* ignore malformed messages */ }
    };

    ws.onerror = () => {
      if (!isSimulating) {
        _showToast('⚠️ Market data connection lost. Switching to simulation.', 'warn');
        _addLog('⚠️ Deriv WebSocket error, switching to simulated prices.');
        fallbackToSimulation();
      }
    };

    ws.onclose = () => {
      if (!isSimulating) {
        _showToast('⚠️ Market data disconnected. Using simulated prices.', 'warn');
        _addLog('⚠️ Deriv WebSocket closed, using simulation.');
        fallbackToSimulation();

        // Attempt to reconnect after 10 seconds
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!isSimulating) connectDeriv();
        }, 10000);
      }
    };
  } catch (err) {
    fallbackToSimulation();
  }
}

// ------------------------------------------------------------------
// DISCONNECT (clean shutdown)

export function disconnectDeriv() {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isConnected = false;
  isSimulating = false;
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.textContent = 'Disconnected';
  _addLog('📡 Deriv WebSocket disconnected.');
}

// ------------------------------------------------------------------
// SIMULATION FALLBACK

function fallbackToSimulation() {
  if (isSimulating) return;
  isSimulating = true;
  isConnected = false;
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.textContent = 'Demo Mode';
  if (simulationInterval) clearInterval(simulationInterval);
  simulatePrices();
}

function simulatePrices() {
  // Reset to default prices for base assets only
  Object.keys(defaultPrices).forEach(sym => {
    livePrices[sym] = { ...defaultPrices[sym] };
  });

  simulationInterval = setInterval(() => {
    // Update base assets
    const bases = {
      'frxXAUUSD': livePrices['frxXAUUSD']?.bid || 2340,
      'frxEURUSD': livePrices['frxEURUSD']?.bid || 1.0881,
      'frxGBPUSD': livePrices['frxGBPUSD']?.bid || 1.2701,
      'frxUSDJPY': livePrices['frxUSDJPY']?.bid || 156.81,
      'frxUSDCAD': livePrices['frxUSDCAD']?.bid || 1.3621,
    };

    Object.keys(bases).forEach(sym => {
      let b = bases[sym];
      const vol = sym === 'frxXAUUSD' ? 0.3 : (sym === 'frxUSDJPY' ? 0.01 : 0.0001);
      b += (Math.random() - 0.5) * vol * 2;

      // Keep within reasonable bounds
      if (sym === 'frxXAUUSD') b = clamp(b, 2000, 2800);
      else if (sym === 'frxEURUSD') b = clamp(b, 1.05, 1.15);
      else if (sym === 'frxGBPUSD') b = clamp(b, 1.20, 1.35);
      else if (sym === 'frxUSDJPY') b = clamp(b, 140, 170);
      else if (sym === 'frxUSDCAD') b = clamp(b, 1.30, 1.42);

      const spread = sym === 'frxXAUUSD' ? 0.5 : (sym === 'frxUSDJPY' ? 0.02 : 0.0002);
      livePrices[sym] = {
        bid: parseFloat((b - spread / 2).toFixed(5)),
        ask: parseFloat((b + spread / 2).toFixed(5)),
        raw: b,
      };
    });

    // Also simulate custom assets – simple random walk around 1.0
    Object.keys(ASSETS).forEach(sym => {
      if (!bases[sym] && ASSETS[sym] && livePrices[sym]) {
        const p = livePrices[sym];
        let mid = (p.bid + p.ask) / 2 || 1.0;
        mid += (Math.random() - 0.5) * 0.0002;
        const spread = 0.0002;
        livePrices[sym] = {
          bid: parseFloat((mid - spread / 2).toFixed(5)),
          ask: parseFloat((mid + spread / 2).toFixed(5)),
        };
      }
    });

    _updateTicker();
    _renderMarketTable();
    if (typeof _onPriceUpdate === 'function') _onPriceUpdate();
  }, 1500);
}

// ------------------------------------------------------------------
// PRICE GETTERS

export function getPrice(symbol) {
  return livePrices[symbol] || null;
}

export function getBid(symbol) {
  return livePrices[symbol]?.bid || 0;
}

export function getAsk(symbol) {
  return livePrices[symbol]?.ask || 0;
}

export function getAllPrices() {
  return livePrices;
}

export function getAssetInfo(symbol) {
  return ASSETS[symbol] || null;
}

// ------------------------------------------------------------------
// P&L UPDATE CALLBACK (used by trading system)

export function setOnPriceUpdate(callback) {
  _onPriceUpdate = callback;
}

// ------------------------------------------------------------------
// UI HELPERS (called from engine.js callbacks & ui.js)

export function buildTicker() {
  const items = Object.keys(ASSETS).map(sym => {
    const p = livePrices[sym] || { bid: 0, ask: 0 };
    const mid = (p.bid + p.ask) / 2;
    const dec = sym === 'frxXAUUSD' ? 2 : 5;
    return `<div class="ticker-item">
      <span class="ticker-name">${sym.replace('frx', '')}</span>
      <span class="ticker-price">${fmtP(mid, dec)}</span>
    </div>`;
  }).join('');
  return items + items; // duplicate for seamless loop
}

export function renderMarketTable(targetElement, selectedSymbol) {
  if (!targetElement) return;
  let html = '';
  Object.keys(ASSETS).forEach(sym => {
    const p = livePrices[sym] || { bid: 0, ask: 0 };
    const asset = ASSETS[sym];
    const spread = ((p.ask || 0) - (p.bid || 0));
    const isSel = sym === selectedSymbol;
    const dec = sym === 'frxXAUUSD' ? 2 : 5;
    html += `
      <div class="mkt-row" data-symbol="${sym}" style="${isSel ? 'background:rgba(245,200,66,.04);' : ''}">
        <div>
          <div style="font-weight:700;font-size:12px">${sym.replace('frx', '')}</div>
          <div style="font-size:10px;color:var(--muted)">${asset.name}</div>
        </div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--green)">${fmtP(p.bid, dec)}</div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--red)">${fmtP(p.ask, dec)}</div>
        <div style="font-size:11px;color:var(--muted)">${spread.toFixed(dec)}</div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" data-view="${sym}" style="font-size:10px;padding:2px 6px;">👁️ View</button>
        </div>
      </div>
    `;
  });
  targetElement.innerHTML = html;
}

// ------------------------------------------------------------------
// CUSTOM ASSET MANAGEMENT

/**
 * Add a custom tradable asset (e.g., 'frxEURGBP').
 * It will appear in the market table and can be traded.
 */
export function addCustomAsset(symbol) {
  if (ASSETS[symbol]) return; // already exists
  // Sensible defaults for forex pairs
  ASSETS[symbol] = {
    name: symbol.replace('frx', ''),
    lotSize: 100000,
    pipValue: 10,       // standard for non-JPY pairs
    contractSize: 100000,
    minMargin: 50,
    type: 'deriv',
  };
  // Initialize price
  livePrices[symbol] = { bid: 0, ask: 0 };
  // Subscribe to live feed
  subscribeToWatchlistSymbol(symbol);
  // Re-render market table
  _renderMarketTable();
}

/**
 * Remove a custom asset from the market.
 * @param {string} symbol - e.g., 'frxEURGBP'
 */
export function removeCustomAsset(symbol) {
  if (!ASSETS[symbol]) return;
  // Don't allow removing the original five
  const original = ['frxXAUUSD', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxUSDCAD'];
  if (original.includes(symbol)) return; // safety
  delete ASSETS[symbol];
  delete livePrices[symbol];
  // Also remove from G.customAssets if present
  if (G.customAssets) {
    G.customAssets = G.customAssets.filter(s => s !== symbol);
  }
  _renderMarketTable();
}

/**
 * Subscribe to a new symbol on the Deriv WebSocket.
 * Used for both watchlist and custom tradable assets.
 */
export function subscribeToWatchlistSymbol(sym) {
  if (!sym.startsWith('frx')) sym = 'frx' + sym;
  if (livePrices[sym]) return; // already subscribed
  livePrices[sym] = { bid: 0, ask: 0 };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
  }
}

// ------------------------------------------------------------------
// INITIALISATION

export function initMarket() {
  // Start with simulation then attempt WebSocket
  connectDeriv();
  // Initial UI render
  _updateTicker();
  _renderMarketTable();
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for UI event binding
window.connectDeriv = connectDeriv;
window.disconnectDeriv = disconnectDeriv;