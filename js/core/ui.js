// js/core/ui.js – Complete with Time, Fatigue, and Action UI updates

import {
  G,
  fmt,
  fmtP,
  clamp,
  hasItem,
  hasSkill,
  saveGame,
} from './state.js';

import {
  getNetWorth,
  deposit,
  withdraw,
  transfer,
} from '../systems/economy.js';

import {
  payRent,
  getTotalRentDue,
  getRentStatus,
  getHousingDescription,
} from '../systems/housing.js';

import { cookItem, getStoveMeats, getFridgeItems, moveToStove, cookingRecipes } from '../systems/cooking.js';

import {
  getAllJobs,
  applyJob,
  workShift,
  getJob,
} from '../systems/jobs.js';

import {
  getAllCrimes,
  getAllHustles,
  doCrime,
  doHustle,
} from '../systems/crimes.js';

import { 
  purchaseItem,  
  renderShopItems, 
  getAllShopItems 
} from '../systems/shop.js';

import {
  completeCourse,
  renderCourses,
  getCompletedCourses,
  getSkills,
} from '../systems/courses.js';

import {
  openPosition,
  closePosition,
  quickTrade,
  getOpenPositions,
  getOpenPnlTotal,
  getTradeHistory,
  getTotalTradePnl,
  calcPnl,
  calculateOrderDetails,
} from '../systems/trading.js';

import {
  getPrice,
  getAllPrices,
  ASSETS,
  buildTicker,
  renderMarketTable,
  connectDeriv,
  livePrices,
  subscribeToWatchlistSymbol,
  addCustomAsset,
  removeCustomAsset,
} from '../systems/market.js';

import {
  getTimeDisplay,
  startNap,
  startNightSleep,
  takeShower,
  skipToMorning,
} from '../systems/time.js';

import {
  eatCheapMeal,
  eatRestaurantMeal,
  drinkCoffee,
  drinkEnergyDrink,
  takeMedicine,
  goGym,
  therapy,
  getStrengthFactor,
} from '../systems/vitals.js';

import { stores, isStoreOpen } from '../content/shop/stores.js';

// ------------------------------------------------------------------
// ENGINE FUNCTIONS (injected from engine.js)
let engine = {
  advanceDay: () => console.warn('advanceDay not set'),
  startGame: (diff) => console.warn('startGame not set'),
  resetAndQuit: () => console.warn('resetAndQuit not set'),
  loadGameAndResume: () => console.warn('loadGameAndResume not set'),
};

export function setEngineFunctions(engineFns) {
  engine = engineFns;
}

// ------------------------------------------------------------------
// DOM REFERENCES – cached for performance
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  // Screens
  introScreen: $('screen-intro'),
  gameScreen: $('screen-game'),

  // Sidebar
  playerName: $('s-playername'),
  playerRank: $('s-rank'),
  timeDisplay: $('time-display'),
  dayDisplay: $('s-day'),
  vitals: {
    health:    { bar: $('vbar-health'),  val: $('vval-health') },
    fatigue:   { bar: $('vbar-fatigue'), val: $('vval-fatigue') },
    morale:    { bar: $('vbar-morale'),  val: $('vval-morale') },
    hunger:    { bar: $('vbar-hunger'),  val: $('vval-hunger') },
    stress:    { bar: $('vbar-stress'),  val: $('vval-stress') },
    hygiene:   { bar: $('vbar-hygiene'), val: $('vval-hygiene') },
  },
  billsBadge: $('bills-badge'),

  // Topbar money
  hudCash: $('hud-cash'),
  hudBank: $('hud-bank'),
  hudNw: $('hud-nw'),
  lifeHudCash: $('life-hud-cash'),
  tradeHudCash: $('trade-hud-cash'),
  bankHud: $('bank-hud'),
  jobsHudCash: $('jobs-hud-cash'),
  crimesHudCash: $('crimes-hud-cash'),
  shopHudCash: $('shop-hud-cash'),

  // Home
  homeAlerts: $('home-alerts'),
  statNw: $('stat-nw'),
  statHousing: $('stat-housing'),
  statRentStatus: $('stat-rent-status'),
  statLevel: $('stat-level'),
  statXpText: $('stat-xp-text'),
  xpBar: $('xp-bar'),
  statCredit: $('stat-credit'),
  statCreditLabel: $('stat-credit-label'),
  recentLog: $('recent-log'),
  homeJobInfo: $('home-job-info'),
  homePortSnap: $('home-port-snap'),
  homeInventory: $('home-inventory'),

  // Life
  housingInfo: $('housing-info'),
  monthlySummary: $('monthly-summary'),
  billsList: $('bills-list'),

  // Bank
  bankBalStat: $('bank-bal-stat'),
  bankInterest: $('bank-interest'),
  bankCredit: $('bank-credit'),
  bankCreditLbl: $('bank-credit-lbl'),
  bankTxLog: $('bank-tx-log'),
  loanSection: $('loan-section'),

  // Jobs
  shiftPanel: $('shift-panel'),
  jobsList: $('jobs-list'),

  // Crimes
  streetCrimesList: $('street-crimes-list'),
  hustleList: $('hustle-list'),
  crimeRecord: $('crime-record'),
  crimeLevelTag: $('crime-level-tag'),

  // Courses
  coursesXpHud: $('courses-xp-hud'),
  statTotalXp: $('stat-total-xp'),
  statDemoCash: $('stat-demo-cash'),
  coursesTrading: $('courses-trading'),
  coursesLife: $('courses-life'),

  // Shop
  shopGrid: $('shop-grid'),

  // Trading
  tradePnl: $('trade-pnl'),
  posPnlTotal: $('pos-pnl-total'),
  positionsList: $('positions-list'),
  tradeHistory: $('trade-history'),
  histTotalPnl: $('hist-total-pnl'),
  marketTable: $('market-table'),
  lastUpdate: $('last-update'),
  feedStatus: $('feed-status'),
  orderError: $('order-error'),
  orderAsset: $('order-asset'),
  orderLots: $('order-lots'),
  opEntry: $('op-entry'),
  opVal: $('op-val'),
  opMargin: $('op-margin'),
  opPip: $('op-pip'),
  tradingViewWidget: $('tradingview-widget'),

  // Log
  fullLog: $('full-log'),

  // Modals
  modalOverlay: $('modal-overlay'),
  modalTitle: $('modal-title'),
  modalSub: $('modal-sub'),
  modalBody: $('modal-body'),
  modalConfirm: $('modal-confirm'),
  modalCancel: $('modal-cancel'),

  // Toast container
  toastContainer: $('toast-container'),
};

// ------------------------------------------------------------------
// TOAST SYSTEM
export function showToast(message, type = 'info', duration = 4500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, duration);
}

// ------------------------------------------------------------------
// MODAL SYSTEM
let modalResolve = null;
export function openModal(title, subtitle, bodyHTML = '', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    el.modalTitle.textContent = title;
    el.modalSub.textContent = subtitle;
    el.modalBody.innerHTML = bodyHTML;
    el.modalConfirm.textContent = confirmText;
    el.modalOverlay.classList.add('open');
    modalResolve = resolve;
  });
}
export function closeModal() {
  el.modalOverlay.classList.remove('open');
  if (modalResolve) {
    modalResolve(false);
    modalResolve = null;
  }
}
el.modalConfirm.addEventListener('click', () => {
  el.modalOverlay.classList.remove('open');
  if (modalResolve) { modalResolve(true); modalResolve = null; }
});
el.modalCancel.addEventListener('click', closeModal);
el.modalOverlay.addEventListener('click', (e) => {
  if (e.target === el.modalOverlay) closeModal();
});

// ------------------------------------------------------------------
// TAB NAVIGATION
let currentTab = 'home';
export function showTab(tabName) {
  currentTab = tabName;
  G.currentTab = tabName;
  saveGame();      // optional – already auto‑saved, but ensures immediate persistence
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `tab-${tabName}`));
  switch (tabName) {
    case 'trading': renderTradingTab(); break;
    case 'life': renderLifeTab(); break;
    case 'bank': renderBankTab(); break;
    case 'jobs': renderJobsTab(); break;
    case 'crimes': renderCrimesTab(); break;
    case 'courses': renderCoursesTab(); break;
    case 'shop': renderShopTab(); break;
    case 'log': renderLogTab(); break;
  }
}

// ------------------------------------------------------------------
// RENDER FUNCTIONS – Main entry point for engine.js
export function renderAll() {
  renderHuds();
  renderVitals();
  renderTime();
  renderHomeStats();
  renderLifeTab();
  renderBankTab();
  renderJobsTab();
  renderCrimesTab();
  renderCoursesTab();
  renderShopTab();
  renderLogTab();
  renderTradingTab();
  checkAlerts();
  saveGame();
}

// ------------------------------------------------------------------
// HUDS & TOPBARS
function renderHuds() {
  const nw = getNetWorth();
  setText(el.hudCash, fmt(G.cash));
  setText(el.hudBank, fmt(G.bank));
  setText(el.hudNw, fmt(nw));
  setText(el.lifeHudCash, fmt(G.cash));
  setText(el.tradeHudCash, fmt(G.cash));
  setText(el.bankHud, fmt(G.bank));
  setText(el.jobsHudCash, fmt(G.cash));
  setText(el.crimesHudCash, fmt(G.cash));
  setText(el.shopHudCash, fmt(G.cash));
  setText(el.dayDisplay, G.day);
  updateRankDisplay(nw);
  updateXpDisplay();
  updateCreditDisplay();
}

function updateRankDisplay(nw) {
  let rank = 'Broke & Hustling';
  if (nw > 100000) rank = '💰 High Roller';
  else if (nw > 50000) rank = '📈 Investor';
  else if (nw > 20000) rank = '💼 Professional';
  else if (nw > 10000) rank = '🏦 Getting There';
  else if (nw > 5000) rank = '📊 Working Class';
  else if (nw > 1000) rank = '🔨 Grinding';
  else if (nw > 0) rank = '💸 Broke & Hustling';
  else rank = '☠️ Negative Net Worth';
  setText(el.playerRank, rank);
}

function updateXpDisplay() {
  const pct = G.xpNext > 0 ? (G.xp / G.xpNext) * 100 : 0;
  if (el.xpBar) el.xpBar.style.width = clamp(pct, 0, 100) + '%';
  setText(el.statLevel, 'Lv ' + G.level);
  setText(el.statXpText, G.xp + '/' + G.xpNext + ' XP');
  setText(el.coursesXpHud, G.xp);
  setText(el.statTotalXp, G.xp);
  setText(el.statDemoCash, fmt(G.demoCash || 0));
}

function updateCreditDisplay() {
  const score = G.creditScore;
  let label = 'Very Bad', color = 'var(--red)';
  if (score >= 750) { label = 'Excellent'; color = 'var(--green)'; }
  else if (score >= 700) { label = 'Good'; color = 'var(--green)'; }
  else if (score >= 650) { label = 'Fair'; color = 'var(--gold)'; }
  else if (score >= 550) { label = 'Poor'; color = 'var(--orange)'; }
  if (el.statCredit) { el.statCredit.textContent = score; el.statCredit.style.color = color; }
  setText(el.statCreditLabel, label);
  if (el.bankCredit) { el.bankCredit.textContent = score; el.bankCredit.style.color = color; }
  setText(el.bankCreditLbl, label);
}

// ------------------------------------------------------------------
// TIME & PERIOD DISPLAY
function renderTime() {
  setText(el.timeDisplay, getTimeDisplay());
}

// ------------------------------------------------------------------
// VITALS BARS
function renderVitals() {
  const vitalsConfig = [
    { key: 'health',  color: '#ef4444' },
    { key: 'fatigue', color: '#f5c842' },
    { key: 'morale',  color: '#3b82f6' },
    { key: 'hunger',  color: '#f97316' },
    { key: 'stress',  color: '#a855f7' },
    { key: 'hygiene', color: '#22c55e' },
  ];
  vitalsConfig.forEach(({ key, color }) => {
    const val = G[key];
    const bar = el.vitals[key]?.bar;
    const lbl = el.vitals[key]?.val;
    if (bar) {
      bar.style.width = val + '%';
      bar.style.background = val < 25 ? '#ef4444' : color;
    }
    if (lbl) lbl.textContent = Math.round(val);
  });
}

// ------------------------------------------------------------------
// COOKING
function renderCookingPanel() {
  const panel = document.getElementById('cooking-panel');
  if (!panel) return;

  // If no stove, show notice and then list fridge/pantry items
  if (!G.hasStove) {
    panel.innerHTML = '<div style="color:var(--red);font-size:12px;text-align:center;padding:12px;">🔥 You need a Stove to cook! Buy one from the Appliance Store.</div>';
  } else {
    // Stove section (items ready to cook)
    const stoveMeats = getStoveMeats();
    let stoveHTML = '';
    if (stoveMeats.length) {
      stoveHTML = `<div style="font-weight:700;font-size:13px;margin-bottom:8px;">🔥 On Stove</div><div class="shop-grid">` +
        stoveMeats.map(id => {
          const recipe = cookingRecipes[id] || { name: id.replace(/_/g, ' '), icon: '🍖', timeHours: 0.5, hunger: 0, morale: 0, stress: 0, fatigue: 0 };
          const timeMins = Math.round(recipe.timeHours * 60);
          const statLines = [];
          if (recipe.hunger) statLines.push(`+${recipe.hunger} hunger`);
          if (recipe.morale) statLines.push(`+${recipe.morale} morale`);
          if (recipe.stress) statLines.push(`+${recipe.stress} stress`);
          if (recipe.fatigue) statLines.push(`+${recipe.fatigue} fatigue`);
          return `
            <div class="shop-card" style="text-align:center; padding:12px;">
              <div style="font-size:28px;">${recipe.icon}</div>
              <div style="font-weight:700;font-size:12px;">${recipe.name}</div>
              <div style="font-size:10px;color:var(--muted);">🕒 ${timeMins} min · ${statLines.join(' · ') || 'No effects'}</div>
              <button class="btn btn-gold btn-sm" onclick="cookItem('${id}')" style="margin-top:6px;">🍳 Cook</button>
            </div>
          `;
        }).join('') + `</div>`;
    } else {
      stoveHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px;">No items on the stove.</div>';
    }
    panel.innerHTML = stoveHTML;
  }

  // Fridge section (if fridge owned)
  if (G.hasFridge) {
    const fridgeItems = getFridgeItems();
    if (fridgeItems.length) {
      let fridgeHTML = `<div style="font-weight:700;font-size:13px;margin:12px 0 8px;">🧊 Refrigerator</div><div class="shop-grid">` +
        fridgeItems.map(id => {
          const recipe = cookingRecipes[id] || { name: id.replace(/_/g, ' '), icon: '🍖', timeHours: 0.5 };
          return `
            <div class="shop-card" style="text-align:center; padding:10px;">
              <div style="font-size:24px;">${recipe.icon}</div>
              <div style="font-weight:700;font-size:11px;">${recipe.name}</div>
              <button class="btn btn-ghost btn-sm" onclick="moveToStove('${id}')" style="margin-top:6px;" ${!G.hasStove ? 'disabled' : ''}>➡️ To Stove</button>
            </div>
          `;
        }).join('') + `</div>`;
      panel.innerHTML += fridgeHTML;
    }
  }

  // Pantry (rawMeats) – always show if there are items, regardless of fridge
  const pantry = G.rawMeats || [];
  if (pantry.length) {
    let pantryHTML = `<div style="font-weight:700;font-size:13px;margin:12px 0 8px;">📦 Pantry ${G.hasFridge ? '(no room in fridge)' : ''}</div><div class="shop-grid">` +
      pantry.map(id => {
        const recipe = cookingRecipes[id] || { name: id.replace(/_/g, ' '), icon: '🍖' };
        return `
          <div class="shop-card" style="text-align:center; padding:10px; ${G.hasFridge ? 'opacity:0.7;' : ''}">
            <div style="font-size:20px;">${recipe.icon}</div>
            <div style="font-weight:700;font-size:11px;">${recipe.name}</div>
            ${!G.hasFridge ? '<div style="font-size:9px;color:var(--red);">Spoils soon!</div>' : ''}
            <button class="btn btn-ghost btn-sm" onclick="moveToStove('${id}')" style="margin-top:6px;" ${!G.hasStove ? 'disabled' : ''}>➡️ To Stove</button>
          </div>
        `;
      }).join('') + `</div>`;
    panel.innerHTML += pantryHTML;
  }

  // If nothing at all
  if (!panel.innerHTML || panel.innerHTML === '') {
    panel.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">No raw ingredients. Buy some from the Butcher.</div>';
  }
}

// ------------------------------------------------------------------
// HOME TAB STATS
function renderHomeStats() {
  const nw = getNetWorth();
  setText(el.statNw, fmt(nw));
  setText(el.statHousing, G.evicted ? '🏚️ EVICTED' : '🏠 ' + (G.housingStatus || 'Rented Apartment'));
  setText(el.statRentStatus, G.rentDue > 0 ? '⚠️ ' + G.rentDue + ' month(s) owed' : '✅ All paid');

  // Job info
  if (el.homeJobInfo) {
    if (G.job) {
      const netPay = G.job.wage * (1 - G.job.taxRate);
      el.homeJobInfo.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:24px">${G.job.icon || '💼'}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${G.job.name}</div>
            <div style="font-size:11px;color:var(--muted)">Gross: ${fmt(G.job.wage)}/mo → Net: <strong style="color:var(--green)">${fmt(netPay)}</strong></div>
            <div style="font-size:11px;color:var(--muted)">Per shift: ~${fmt(G.job.shiftPay)}</div>
          </div>
        </div>
      `;
    } else {
      el.homeJobInfo.textContent = 'No job. Visit Jobs tab.';
    }
  }

  // Portfolio snap
  if (el.homePortSnap) {
    const pnl = getOpenPnlTotal();
    const count = getOpenPositions().length;
    el.homePortSnap.innerHTML = count ? `<span style="color:var(--muted)">${count} open</span> · P&L: <strong style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(pnl)}</strong>` : 'No open trades.';
  }

  // Inventory
  if (el.homeInventory) {
    const items = [];
    if (hasItem('laptop')) items.push('💻 Laptop');
    if (hasItem('phone')) items.push('📱 Smartphone');
    if (hasItem('suit')) items.push('👔 Suit');
    if (hasItem('tools')) items.push('🔧 Tools');
    if (hasItem('transitPass')) items.push('🚌 Transit Pass');
    if (hasItem('wifi')) items.push('📶 WiFi');
    el.homeInventory.textContent = items.length ? items.join(' · ') : 'Empty';
  }
  renderCookingPanel();
}

// ------------------------------------------------------------------
// LIFE TAB
function renderLifeTab() {
  if (el.housingInfo) {
    const due = getTotalRentDue();
    el.housingInfo.innerHTML = `
      <div class="bill-row">
        <div>
          <div class="bill-name">${G.evicted ? '🏚️ Homeless' : '🏠 ' + (G.housingStatus || 'Rented Apartment')}</div>
          <div class="bill-meta">${G.evicted ? 'You were evicted.' : 'Monthly rent obligation'}</div>
        </div>
        <div class="bill-amount ${G.rentDue > 0 ? 'due' : 'ok'}">${fmt(G.rent)}/mo</div>
      </div>
      <div style="margin-top:8px;font-size:12px">
        <span style="color:var(--muted)">Months owed: </span>
        <strong style="color:${G.rentDue > 0 ? 'var(--red)' : 'var(--green)'}">${G.rentDue}</strong>
        ${G.rentDue > 0 ? ` · <span style="color:var(--red)">Total due: <strong>${fmt(due)}</strong></span>` : ''}
      </div>
      ${G.rentDue === 2 ? '<div class="alert alert-danger" style="margin-top:8px">🚨 EVICTION IMMINENT — pay now or lose your home next month!</div>' : ''}
      ${G.evicted ? '<div class="alert alert-danger" style="margin-top:8px">🏚️ You are homeless. Pay rent to find a new place.</div>' : ''}
    `;
  }

  if (el.monthlySummary) {
    const income = G.job ? Math.floor(G.job.wage * (1 - G.job.taxRate)) : 0;
    const expenses = G.rent + 80 + 40 + 20;
    const loanRepayment = G.loan > 0 ? Math.floor(G.loan * 0.1) : 0;
    const net = income - expenses - loanRepayment;
    let html = `
      <div class="bill-row"><span class="bill-name">Net Salary</span><span class="bill-amount ok">+${fmt(income)}</span></div>
      <div class="bill-row"><span class="bill-name">Rent</span><span class="bill-amount due">-${fmt(G.rent)}</span></div>
      <div class="bill-row"><span class="bill-name">Food Est.</span><span class="bill-amount due">-$80</span></div>
      <div class="bill-row"><span class="bill-name">Utilities</span><span class="bill-amount ${G.utilsPaid ? 'due' : 'red'}">-$40</span></div>
      <div class="bill-row"><span class="bill-name">Phone</span><span class="bill-amount due">-$20</span></div>
    `;
    if (G.loan > 0) {
      html += `<div class="bill-row"><span class="bill-name">Loan Interest</span><span class="bill-amount due">-${fmt(loanRepayment)}</span></div>`;
    }
    html += `
      <div class="bill-row" style="border-top:1px solid var(--border2);margin-top:4px">
        <span class="bill-name" style="font-weight:800">Monthly Net</span>
        <span class="bill-amount ${net >= 0 ? 'ok' : 'due'}" style="font-size:15px">${fmt(net)}</span>
      </div>
    `;
    el.monthlySummary.innerHTML = html;
  }

  if (el.billsList) {
    const bills = [
      { name: 'Rent', amt: G.rent, due: G.rentDue > 0, meta: G.rentDue + ' month(s) overdue' },
      { name: 'Food & Groceries', amt: 80, due: false, meta: 'Estimated' },
      { name: 'Utilities', amt: 40, due: !G.utilsPaid, meta: G.utilsPaid ? 'Paid' : '⚠️ UNPAID' },
      { name: 'Phone Plan', amt: 20, due: !G.phonePaid, meta: G.phonePaid ? 'Paid' : '⚠️ UNPAID' },
    ];
    if (G.loan > 0) {
      bills.push({ name: 'Loan (' + G.loanSource + ')', amt: Math.floor(G.loan * G.loanInterestRate), due: true, meta: 'Monthly interest' });
    }
    el.billsList.innerHTML = bills.map(b => `
      <div class="bill-row">
        <div><div class="bill-name">${b.name}</div><div class="bill-meta">${b.meta}</div></div>
        <div class="bill-amount ${b.due ? 'due' : 'ok'}">${fmt(b.amt)}</div>
      </div>
    `).join('');
  }
}

// ------------------------------------------------------------------
// BANK TAB, LOANS, JOBS, CRIMES, COURSES, SHOP
function renderBankTab() {
  setText(el.bankBalStat, fmt(G.bank));
  setText(el.bankInterest, fmt(G.interestEarned || 0));
  renderBankTxLog();
  renderLoanSection();
}

function renderBankTxLog() {
  if (!el.bankTxLog) return;
  const logs = G.bankTxLog || [];
  if (!logs.length) { el.bankTxLog.textContent = 'No transactions.'; return; }
  el.bankTxLog.innerHTML = logs.map(t => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span>${t.type}</span>
      <span style="color:var(--${t.col});font-family:var(--mono)">${t.col === 'green' ? '+' : '-'}${fmt(t.amt)}</span>
      <span style="color:var(--muted);font-size:10px">${t.day}</span>
    </div>
  `).join('');
}

function renderLoanSection() {
  if (!el.loanSection) return;
  if (G.loan > 0) {
    el.loanSection.innerHTML = `
      <div class="alert alert-danger">
        Active loan from <strong>${G.loanSource}</strong>: <strong>${fmt(G.loan)}</strong> at ${(G.loanInterestRate * 100)}%/mo interest.
        ${G.loanSource === 'Loan Shark' ? '⚠️ Miss payment and they will steal your inventory.' : ''}
        ${G.loanSource === 'Syndicate' ? '☠️ Miss payment and you will be forced into crime missions.' : ''}
      </div>
      <input type="number" class="inp" id="repay-amt" placeholder="Repay amount" style="margin-bottom:8px">
      <button class="btn btn-red btn-full" id="repayLoanBtn">Repay Loan</button>
    `;
    document.getElementById('repayLoanBtn')?.addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('repay-amt').value) || 0;
      if (amt <= 0) { showToast('Enter amount.', 'warn'); return; }
      if (G.cash < amt) { showToast('Not enough cash.', 'error'); return; }
      const pay = Math.min(amt, G.loan);
      G.cash -= pay;
      G.loan -= pay;
      if (G.loan < 0.01) {
        G.loan = 0;
        G.loanSource = 'none';
        G.loanInterestRate = 0.03;
        G.creditScore = clamp(G.creditScore + 15, 200, 850);
        showToast('✅ Loan fully paid! Credit improved.', 'success');
      } else {
        showToast('Repaid ' + fmt(pay) + '. Remaining: ' + fmt(G.loan), 'info');
      }
      addLog('💳 Repaid ' + fmt(pay) + ' loan.');
      renderAll();
    });
    return;
  }
  const canBank = G.creditScore >= 600 && (!G.job || G.job.wage >= 200);
  const maxBank = G.creditScore >= 700 ? 500 : G.creditScore >= 650 ? 200 : 0;
  el.loanSection.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Choose a loan source.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="stat-box">
        <div class="stat-box-icon">🏦</div>
        <div class="stat-box-label">Microfinance Bank</div>
        <div style="font-size:11px;color:var(--muted);margin:6px 0">Max: ${fmt(maxBank)} · 3%/mo</div>
        ${canBank && maxBank > 0 ? `<button class="btn btn-blue btn-full btn-sm" data-loan="${maxBank}" data-source="Bank" data-rate="0.03">Borrow ${fmt(maxBank)}</button>` : '<div style="font-size:11px;color:var(--red)">Not eligible</div>'}
      </div>
      <div class="stat-box">
        <div class="stat-box-icon">🦈</div>
        <div class="stat-box-label">Loan Shark</div>
        <div style="font-size:11px;color:var(--muted);margin:6px 0">Up to $1,000 · 15%/mo</div>
        <button class="btn btn-orange btn-full btn-sm" data-loan="1000" data-source="Loan Shark" data-rate="0.15">Borrow $1k</button>
      </div>
      <div class="stat-box">
        <div class="stat-box-icon">☠️</div>
        <div class="stat-box-label">Syndicate Mafia</div>
        <div style="font-size:11px;color:var(--muted);margin:6px 0">Up to $3,000 · 25%/mo</div>
        <button class="btn btn-red btn-full btn-sm" data-loan="3000" data-source="Syndicate" data-rate="0.25">Borrow $3k</button>
      </div>
    </div>
  `;
  el.loanSection.querySelectorAll('button[data-loan]').forEach(b => {
    b.addEventListener('click', () => {
      const amt = parseFloat(b.dataset.loan);
      const src = b.dataset.source;
      const rate = parseFloat(b.dataset.rate);
      G.loan = amt;
      G.loanSource = src;
      G.loanInterestRate = rate;
      G.cash += amt;
      G.creditScore = clamp(G.creditScore - 20, 200, 850);
      showToast('💵 Borrowed ' + fmt(amt) + ' from ' + src, 'info');
      addLog('💳 Borrowed ' + fmt(amt) + ' from ' + src);
      renderAll();
    });
  });
}

function renderJobsTab() {
  if (!el.jobsList) return;

  if (G.job) {
    el.shiftPanel.style.display = 'block';
    const netPay = G.job.wage * (1 - G.job.taxRate);
    el.shiftPanel.innerHTML = `
      <div class="alert alert-success" style="margin-bottom:12px">
        Active Job: <strong>${G.job.name}</strong> ${G.job.icon || ''}
      </div>
      <div style="font-size:12px;margin-bottom:10px">
        Gross: ${fmt(G.job.wage)}/mo → Net: <strong style="color:var(--green)">${fmt(netPay)}</strong><br>
        Shift pay: ~${fmt(G.job.shiftPay)} · Duration: ${G.job.duration || 4}h
      </div>
      <button class="btn btn-green btn-full" id="workShiftBtn">👷 Work Shift</button>
      <button class="btn btn-red btn-full" id="quitJobBtn" style="margin-top:8px">Resign Job</button>
    `;
    document.getElementById('workShiftBtn')?.addEventListener('click', () => { workShift(); renderAll(); });
    document.getElementById('quitJobBtn')?.addEventListener('click', () => {
      addLog('💼 Resigned from ' + G.job.name);
      G.job = null;
      showToast('You resigned.', 'info');
      renderAll();
    });
} else {
    el.shiftPanel.style.display = 'block';
    el.shiftPanel.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">No active job. Apply for one below.</div>`;
}

  const jobs = getAllJobs();
  el.jobsList.innerHTML = jobs.map(j => {
    const meetSkills = j.reqSkills.every(s => hasSkill(s));
    const meetItems = j.reqItems.every(i => hasItem(i));
    const meetLevel = G.level >= j.reqLevel;
    const canApply = meetSkills && meetItems && meetLevel;
    return `
      <div class="activity-item">
        <div class="activity-icon">${j.icon || '💼'}</div>
        <div class="activity-main">
          <div class="activity-name">${j.name} ${G.job && G.job.id === j.id ? '✅' : ''}</div>
          <div class="activity-desc">Wage: ${fmt(j.wage)}/mo · Tax: ${(j.taxRate * 100)}%</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">
            Reqs: Lv ${j.reqLevel} ${j.reqSkills.length ? '· Skills: ' + j.reqSkills.join(', ') : ''} ${j.reqItems.length ? '· Items: ' + j.reqItems.join(', ') : ''}
          </div>
        </div>
        <div class="activity-info">
          ${canApply ? `<button class="btn btn-ghost btn-sm" data-job="${j.id}" ${G.job && G.job.id === j.id ? 'disabled' : ''}>Apply</button>` : '<span style="color:var(--red);font-size:11px">Locked</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function renderCrimesTab() {
  if (!el.streetCrimesList || !el.hustleList) return;
  if (el.crimeRecord) el.crimeRecord.textContent = G.criminalRecord.length ? G.criminalRecord.join(' | ') : 'Clean';
  if (el.crimeLevelTag) el.crimeLevelTag.textContent = 'Lv ' + (G.crimeLevel || 0);

  const crimes = getAllCrimes();
  el.streetCrimesList.innerHTML = crimes.map(c => {
    const cd = (G.crimeCooldowns && G.crimeCooldowns[c.id]) ? G.crimeCooldowns[c.id] : 0;
    const locked = (c.needItem && !hasItem(c.needItem)) || cd > 0 || G.jailDays > 0;
    return `
      <div class="activity-item">
        <div class="activity-icon">${c.icon || '🦹'}</div>
        <div class="activity-main">
          <div class="activity-name">${c.name}</div>
          <div class="activity-desc">${c.desc}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">
            Reward: ${fmt(c.reward[0])}–${fmt(c.reward[1])} · Energy: -${c.energyCost} · Fail: ${Math.round(c.failChance * 100)}%
          </div>
        </div>
        <div class="activity-info">
          ${cd > 0 ? `<div class="activity-timer">⏱ ${cd}d</div>` :
            `<button class="btn btn-ghost btn-sm" data-crime="${c.id}" ${locked ? 'disabled' : ''}>
              ${c.needItem && !hasItem(c.needItem) ? '🔒 Need ' + c.needItem : 'Execute'}
            </button>`}
        </div>
      </div>
    `;
  }).join('');

  const hustles = getAllHustles();
  el.hustleList.innerHTML = hustles.map(h => `
    <div class="activity-item">
      <div class="activity-icon">${h.icon || '💡'}</div>
      <div class="activity-main">
        <div class="activity-name">${h.name}</div>
        <div class="activity-desc">${h.desc}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">
          Reward: ${fmt(h.reward[0])}–${fmt(h.reward[1])} · Energy: -${h.energyCost}
        </div>
      </div>
      <div class="activity-info">
        <button class="btn btn-ghost btn-sm" data-hustle="${h.id}" ${(G.jailDays > 0) ? 'disabled' : ''}>
          Hustle
        </button>
      </div>
    </div>
  `).join('');
}

function renderCoursesTab() {
  if (el.coursesTrading) el.coursesTrading.innerHTML = renderCourses('trading');
  if (el.coursesLife) el.coursesLife.innerHTML = renderCourses('life');
}

function renderShopTab() {
  if (!el.shopGrid) return;

  if (G.shopView === 'directory') {
    renderShopDirectory();
  } else if (G.shopView === 'store') {
    renderStoreCatalog();
  }
}

function renderShopDirectory() {
  // Show a grid of store/district cards
  const storeList = Object.values(stores);
  if (!storeList.length) {
    el.shopGrid.innerHTML = '<div style="color:var(--muted)">No stores available.</div>';
    return;
  }

  el.shopGrid.innerHTML = storeList.map(store => {
    const isPhysical = store.type === 'physical';
    const isOpen = isPhysical ? isStoreOpen(store.id, G.hour) : true;
    const status = isPhysical ? (isOpen ? '🟢 Open' : '🔴 Closed') : '';
    return `
      <div class="stat-box" style="cursor:pointer;" onclick="openStore('${store.id}')">
        <div class="stat-box-icon">${isPhysical ? '🏬' : '🌐'}</div>
        <div class="stat-box-label">${store.name}</div>
        <div style="font-size:11px;color:var(--muted);margin:4px 0">${store.desc}</div>
        <div style="font-size:10px;color:${isOpen ? 'var(--green)' : 'var(--red)'}">${status}</div>
      </div>
    `;
  }).join('');
}

function renderStoreCatalog() {
  const store = stores[G.currentStoreId];
  if (!store) {
    el.shopGrid.innerHTML = '<div style="color:var(--red)">Store not found.</div>';
    return;
  }
  
 // Check open hours for physical stores
  if (store.type === 'physical' && !isStoreOpen(store.id, G.hour)) {
    el.shopGrid.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px">
      🔴 ${store.name} is closed.<br>
      Open hours: ${store.openHour}:00 – ${store.closeHour}:00<br>
      Current time: ${getTimeDisplay()}
    </div>
    <button class="btn btn-ghost btn-sm" id="backToDirectoryBtn">← Back to Directory</button>`;
    document.getElementById('backToDirectoryBtn')?.addEventListener('click', () => {
      G.shopView = 'directory';
      G.currentStoreId = null;
      renderShopTab();
    });
    return;
  }
  
  // Department store has extra walking time
if (store.floorTravelMinutes) {
  fastForward(store.floorTravelMinutes / 60);
}
  
  // Show store catalog (only show checkout note if minutes > 0)
  const checkoutNote = store.checkoutMinutes ? ` · Checkout wait: ${store.checkoutMinutes} min` : '';
  el.shopGrid.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:12px;width:100%">🛒 ${store.name} – ${Math.round(store.taxRate*100)}% sales tax${checkoutNote}</div>`;
  // ----------------------------------

  el.shopGrid.innerHTML += renderShopItems(null, store.id);
  
  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost btn-sm';
  backBtn.textContent = '← Back to Directory';
  backBtn.addEventListener('click', () => {
    G.shopView = 'directory';
    G.currentStoreId = null;
    renderShopTab();
  });
  
  el.shopGrid.insertAdjacentElement('afterbegin', backBtn);
}

async function showShippingModal(item) {
  return new Promise((resolve) => {
    openModal(
      `📦 Shipping for ${item.name}`,
      `Choose delivery method:`,
      `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-full" id="ship-standard">Standard (3‑5 days) – $4.99</button>
          <button class="btn btn-ghost btn-full" id="ship-express">Express (tomorrow 10 AM) – $14.99</button>
          <button class="btn btn-ghost btn-full" id="ship-instant">Instant (45 min) – $3.50 + $2 tip</button>
        </div>
      `
    );
    const standardBtn = document.getElementById('ship-standard');
    const expressBtn = document.getElementById('ship-express');
    const instantBtn = document.getElementById('ship-instant');

    const originalClose = closeModal; // keep reference
    // Override closeModal to resolve null on cancel/close
    window.closeModal = () => {
      resolve(null);
      originalClose();
    };

    standardBtn?.addEventListener('click', () => {
      resolve({ method: 'standard', fee: 4.99 });
      originalClose();
    });
    expressBtn?.addEventListener('click', () => {
      resolve({ method: 'express', fee: 14.99 });
      originalClose();
    });
    instantBtn?.addEventListener('click', () => {
      resolve({ method: 'instant', fee: 5.50 }); // 3.50+2.00 tip
      originalClose();
    });
  });
}
// ------------------------------------------------------------------
// TRADING TAB
let lastChartSymbol = null;
function loadTradingViewWidget(sym) {
if (typeof TradingView === 'undefined') return;   // <-- add this line
  const container = el.tradingViewWidget;
  if (!container) return;

  // Map internal symbol to TradingView symbol
  const tvSymbol = {
    'frxXAUUSD': 'OANDA:XAUUSD',
    'frxEURUSD': 'OANDA:EURUSD',
    'frxGBPUSD': 'OANDA:GBPUSD',
    'frxUSDJPY': 'OANDA:USDJPY',
    'frxUSDCAD': 'OANDA:USDCAD',
  }[sym] || 'OANDA:XAUUSD';

  // If same symbol already shown, skip
  if (lastChartSymbol === tvSymbol) return;
  lastChartSymbol = tvSymbol;

  // Clear and create fresh widget
  container.innerHTML = '';
  new TradingView.widget({
    container_id: 'tradingview-widget',
    autosize: true,
    symbol: tvSymbol,
    interval: '5',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    calendar: false,
    hide_volume: false,
    support_host: 'https://www.tradingview.com'
  });
}

function renderTradingTab() {
  const currentSymbol = el.orderAsset ? el.orderAsset.value : 'frxXAUUSD';
  
  // Load the chart immediately for the current symbol
  loadTradingViewWidget(currentSymbol);
  
  renderMarketTable();
  renderPositionsList();
  
  if (el.tradeHistory) {
    const hist = getTradeHistory();
    el.tradeHistory.innerHTML = hist.length ? hist.map(h => `
      <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>${h.sym} (${h.type.toUpperCase()})</span>
        <span>Lots: ${h.lots}</span>
        <span style="color:var(--${h.pnl >= 0 ? 'green' : 'red'})">${h.pnl >= 0 ? '+' : ''}${fmt(h.pnl)}</span>
      </div>
    `).join('') : 'No trade history.';
    setText(el.histTotalPnl, fmt(getTotalTradePnl()));
  }
}

// ------------------------------------------------------------------
// LOG TAB
function renderLogTab() {
  if (!el.fullLog) return;
  const logs = G.log || [];
  if (!logs.length) { el.fullLog.textContent = 'No events.'; return; }
  el.fullLog.innerHTML = logs.map(l => `<div style="padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted2);font-size:10px">[${l.d}]</span> ${l.msg}</div>`).join('');
}

// ------------------------------------------------------------------
// ALERTS & RECENT LOG
function checkAlerts() {
  if (!el.homeAlerts) return;
  const alerts = [];
  if (G.evicted) alerts.push({ t: 'danger', m: '🏚️ You are EVICTED and homeless! Get rent money urgently!' });
  else if (G.rentDue >= 2) alerts.push({ t: 'danger', m: '🚨 EVICTION IMMINENT! ' + G.rentDue + ' months overdue.' });
  else if (G.rentDue > 0) alerts.push({ t: 'warn', m: '🏠 ' + G.rentDue + ' month(s) rent overdue.' });
  if (G.jailDays > 0) alerts.push({ t: 'warn', m: '⛓️ In jail for ' + G.jailDays + ' more day(s).' });
  if (G.hunger < 20) alerts.push({ t: 'danger', m: '🍔 Starving! Eat immediately.' });
  if (G.health < 25) alerts.push({ t: 'danger', m: '❤️ Critical health! Buy medicine.' });
  if (G.stress > 80) alerts.push({ t: 'warn', m: '😰 Extreme stress. Buy therapy.' });
  if (G.loan > 0) alerts.push({ t: 'warn', m: '💳 Active loan: ' + fmt(G.loan) + ' from ' + G.loanSource });
  if (!G.utilsPaid) alerts.push({ t: 'warn', m: '💡 Utilities unpaid.' });
  if (!G.phonePaid) alerts.push({ t: 'warn', m: '📱 Phone plan unpaid.' });
  if (hasItem('laptop') && G.laptopDurability < 25) {
    alerts.push({ t: 'warn', m: '💻 Laptop nearly broken (' + G.laptopDurability + '% durability).' });
  }
  if (G.fatigue < 20) alerts.push({ t: 'warn', m: '💤 Very tired! Rest soon.' });
  el.homeAlerts.innerHTML = alerts.map(a => `<div class="alert alert-${a.t}">${a.m}</div>`).join('');
  if (el.billsBadge) el.billsBadge.style.display = (G.rentDue > 0 || !G.utilsPaid || !G.phonePaid) ? 'inline-block' : 'none';
  if (el.recentLog) {
    const recent = (G.log || []).slice(0, 6);
    el.recentLog.innerHTML = recent.length ? recent.map(l => `<div style="border-bottom:1px solid var(--border);padding:4px 0"><span style="color:var(--muted2);font-size:10px">[${l.d}]</span> ${l.msg}</div>`).join('') : 'No events yet.';
  }
}

// ------------------------------------------------------------------
// LOG HELPER
export function addLog(msg) {
  const entry = { d: 'D' + G.day + '/M' + G.month, msg: msg };
  if (!G.log) G.log = [];
  G.log.unshift(entry);
  if (G.log.length > 150) G.log.pop();
  renderLogTab();
  checkAlerts();
}

function setText(el, val) { if (el) el.textContent = val; }

// ------------------------------------------------------------------
// ORDER / TRADE FUNCTIONS
export function setOrderType(type) {
  window._orderType = type;
  const buyBtn = document.getElementById('ob-buy');
  const sellBtn = document.getElementById('ob-sell');
  if (buyBtn) buyBtn.classList.toggle('active', type === 'buy');
  if (sellBtn) sellBtn.classList.toggle('active', type === 'sell');
}

export function onAssetChange() {
  if (!el.orderAsset) return;
  const sym = el.orderAsset.value;
  loadTradingViewWidget(sym);
  updateOrderPreview();
}

export function updateOrderPreview() {
  const sym = el.orderAsset ? el.orderAsset.value : 'frxXAUUSD';
  const lots = parseFloat(el.orderLots ? el.orderLots.value : 0.1) || 0.1;
  const details = calculateOrderDetails(sym, lots);   // only 2 arguments
  if (!details) return;
  const dec = sym === 'frxXAUUSD' ? 2 : 5;
  setText(el.opEntry, fmtP(details.entry.bid || details.entry.ask, dec));
  setText(el.opVal, fmt(details.lotValue));
  setText(el.opMargin, fmt(details.margin));
  setText(el.opPip, fmt(details.pipVal) + '/pip');
}

export function renderPositionsList() {
  if (!el.positionsList) return;
  const positions = getOpenPositions();
  setText(el.posPnlTotal, fmt(getOpenPnlTotal()));
  
  if (!positions.length) {
    el.positionsList.innerHTML = 'No open positions.';
    return;
  }

  el.positionsList.innerHTML = positions.map((p, i) => {
    const priceObj = getPrice(p.sym);
    // Use bid for sell, ask for buy
    const currentPrice = p.type === 'buy' ? priceObj?.ask : priceObj?.bid;
    const pnl = currentPrice !== undefined ? calcPnl(p, currentPrice) : 0;
    const dec = p.sym === 'frxXAUUSD' ? 2 : 5;
    
    return `
      <div class="pos-card">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <strong>${p.sym} ${p.type.toUpperCase()} ${p.lots}L</strong>
          <span style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${pnl >= 0 ? '+' : ''}${fmt(pnl)}</span>
        </div>
        <div style="color:var(--muted)">
          Entry: ${fmtP(p.entry, dec)} · Now: ${currentPrice !== undefined ? fmtP(currentPrice, dec) : '–'} · Margin: ${fmt(p.margin)}
        </div>
        <button class="btn btn-ghost btn-sm btn-full" data-close="${i}" style="margin-top:6px">Close</button>
      </div>
    `;
  }).join('');
}

// ------------------------------------------------------------------
// EVENT BINDING
export function bindUIEvents() {
  // Difficulty selection
  document.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
  
  // No Stats Consumed
  document.getElementById('debugToggleStatsBtn')?.addEventListener('click', () => {
  G.debugNoStatsConsume = !G.debugNoStatsConsume;
  const btn = document.getElementById('debugToggleStatsBtn');
  if (btn) {
    btn.textContent = G.debugNoStatsConsume ? '🛑 Stats: OFF' : '🛑 Stats: ON';
    btn.style.color = G.debugNoStatsConsume ? 'var(--green)' : 'var(--orange)';
  }
  showToast('Stat consumption ' + (G.debugNoStatsConsume ? 'DISABLED' : 'ENABLED'), 'info');
  saveGame();
});

  // Start button
  document.getElementById('startBtn')?.addEventListener('click', () => {
    const selected = document.querySelector('.diff-card.selected');
    const diff = selected ? selected.dataset.diff : 'normal';
    engine.startGame(diff);
    el.introScreen.classList.remove('active');
    el.gameScreen.classList.add('active');
  });

  // Navigation
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => showTab(item.dataset.tab));
  });

  // Quick action nav buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    if (btn.classList.contains('nav-item')) return;
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Quick eat
  document.getElementById('quickEatBtn')?.addEventListener('click', () => {
    if (G.cash < 5) { showToast('No cash for food!', 'error'); return; }
    eatCheapMeal(5);
    renderAll();
  });

  // Quick nap (replaces old quickRest)
  document.getElementById('quickNapBtn')?.addEventListener('click', () => {
    startNap();
    renderAll();
  });

  // New sidebar buttons
  document.getElementById('napBtn')?.addEventListener('click', () => { startNap(); renderAll(); });
  document.getElementById('sleepBtn')?.addEventListener('click', () => { startNightSleep(); renderAll(); });
  document.getElementById('showerBtn')?.addEventListener('click', () => { takeShower(); renderAll(); });
  document.getElementById('skipMorningBtn')?.addEventListener('click', () => { skipToMorning(); renderAll(); });

  // Reset
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    openModal('Start New Game?', 'All progress will be permanently deleted.', '', 'Reset').then(confirmed => {
      if (confirmed) engine.resetAndQuit();
    });
  });

  // Pay rent (life tab)
  const payRentBtn = document.getElementById('payRentBtn');
  if (payRentBtn) payRentBtn.addEventListener('click', () => { payRent(); renderAll(); });

  // Transfer
  const transferBtn = document.getElementById('transferBtn');
  if (transferBtn) transferBtn.addEventListener('click', doTransfer);

  // Deposit/Withdraw
  document.getElementById('depositBtn')?.addEventListener('click', doDeposit);
  document.getElementById('withdrawBtn')?.addEventListener('click', doWithdraw);

  // Order type
  document.getElementById('ob-buy')?.addEventListener('click', () => setOrderType('buy'));
  document.getElementById('ob-sell')?.addEventListener('click', () => setOrderType('sell'));
  el.orderAsset?.addEventListener('change', onAssetChange);
  el.orderLots?.addEventListener('input', updateOrderPreview);

  // Place order
  document.getElementById('placeOrderBtn')?.addEventListener('click', placeOrder);

  // Trade history toggle
  document.getElementById('toggleHistoryBtn')?.addEventListener('click', () => {
    const container = document.getElementById('trade-history-container');
    const btn = document.getElementById('toggleHistoryBtn');
    if (container.style.display === 'none') {
      container.style.display = 'block';
      btn.textContent = '▲ Hide';
    } else {
      container.style.display = 'none';
      btn.textContent = '▼ Show';
    }
  });

  // Add custom asset
  document.getElementById('addCustomAssetBtn')?.addEventListener('click', () => {
    const symbolInp = document.getElementById('custom-asset-symbol');
    const nameInp = document.getElementById('custom-asset-name');
    const basePriceInp = document.getElementById('custom-asset-price');
    const sym = symbolInp?.value.trim().toUpperCase();
    const name = nameInp?.value.trim();
    const basePrice = parseFloat(basePriceInp?.value);
    if (!sym || !name || isNaN(basePrice)) { showToast('Fill all fields properly.', 'warn'); return; }
    const success = addCustomAsset(sym, name, basePrice);
    if (success) {
      showToast(`Asset ${sym} added.`, 'success');
      symbolInp.value = ''; nameInp.value = ''; basePriceInp.value = '';
      renderTradingTab();
    } else {
      showToast('Symbol exists or maximum custom assets reached.', 'error');
    }
  });

 // ---- delegated event handling for dynamic content ----
document.addEventListener('click', (event) => {
  const target = event.target;

  // Shop buy
const shopBtn = target.closest('[data-shop-item]');
if (shopBtn) {
  purchaseItem(shopBtn.dataset.shopItem);
  return;
}

  // Course complete
  const courseBtn = target.closest('[data-course]');
  if (courseBtn) {
    completeCourse(courseBtn.dataset.course);
    renderAll();
    return;
  }

  // Job apply (from available jobs list)
  const jobBtn = target.closest('[data-job]');
  if (jobBtn) {
    applyJob(jobBtn.dataset.job);
    renderAll();
    return;
  }

  // Execute crime
  const crimeBtn = target.closest('[data-crime]');
  if (crimeBtn) {
    doCrime(crimeBtn.dataset.crime);
    renderAll();
    return;
  }

  // Execute hustle
  const hustleBtn = target.closest('[data-hustle]');
  if (hustleBtn) {
    doHustle(hustleBtn.dataset.hustle);
    renderAll();
    return;
  }

  // View asset (market table)
  const viewBtn = target.closest('[data-view]');
  if (viewBtn) {
    if (el.orderAsset) el.orderAsset.value = viewBtn.dataset.view;
    onAssetChange();
    return;
  }

  // Close position
  const closeBtn = target.closest('[data-close]');
  if (closeBtn) {
    const idx = parseInt(closeBtn.dataset.close);
    closePosition(idx);
    renderAll();
    return;
  }

  // Remove custom asset
  const removeCustomBtn = target.closest('[data-remove-custom]');
  if (removeCustomBtn) {
    removeCustomAsset(removeCustomBtn.dataset.removeCustom);
    G.customAssets = G.customAssets.filter(s => s !== removeCustomBtn.dataset.removeCustom);
    renderCustomAssetsList();
    renderAll();
    saveGame();
    return;
  }

  // Work shift button (inside shift panel) – already handled by its own listener, but keep fallback
  const workShiftBtn = target.closest('#workShiftBtn');
  if (workShiftBtn) {
    workShift();
    renderAll();
    return;
  }
});

} 

// ------------------------------------------------------------------
// TRANSFER / DEPOSIT / WITHDRAW
function doTransfer() {
  const from = document.getElementById('tx-from').value;
  const to = document.getElementById('tx-to').value;
  const amt = parseFloat(document.getElementById('tx-amt').value) || 0;
  if (amt <= 0) { showToast('Enter amount.', 'warn'); return; }
  const res = transfer(from, to, amt);
  if (res.success) { showToast(res.message, 'success'); renderAll(); }
  else { showToast(res.message, 'error'); }
}

function doDeposit() {
  const amt = parseFloat(document.getElementById('bank-amt').value) || 0;
  if (amt <= 0) { showToast('Enter amount.', 'warn'); return; }
  const res = deposit(amt);
  if (res.success) { showToast(res.message, 'success'); renderAll(); }
  else { showToast(res.message, 'error'); }
}

function doWithdraw() {
  const amt = parseFloat(document.getElementById('bank-amt').value) || 0;
  if (amt <= 0) { showToast('Enter amount.', 'warn'); return; }
  const res = withdraw(amt);
  if (res.success) { showToast(res.message, 'success'); renderAll(); }
  else { showToast(res.message, 'error'); }
}

function placeOrder() {
  if (!el.orderAsset || !el.orderLots) return;
  const sym = el.orderAsset.value;
  const lots = parseFloat(el.orderLots.value) || 0;
  const type = window._orderType || 'buy';
  if (el.orderError) el.orderError.style.display = 'none';
  if (lots < 0.01 || lots > 10) {
    if (el.orderError) { el.orderError.textContent = 'Lots must be between 0.01 and 10.'; el.orderError.style.display = 'block'; }
    return;
  }
  const result = openPosition(sym, lots, type);
  if (!result.success && el.orderError) {
    el.orderError.textContent = result.message || 'Order failed.';
    el.orderError.style.display = 'block';
  }
  if (result.success) renderAll();
}

// ------------------------------------------------------------------
// INITIALISATION

export function initUI(engineFns) {
  setEngineFunctions(engineFns);
  bindUIEvents();
  connectDeriv();
  renderAll();
  // Restore the last active tab from the saved state
  showTab(G.currentTab || 'home');
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility
window.renderAll = renderAll;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.showTab = showTab;
window.showShippingModal = showShippingModal;
window.addLog = addLog;
window.initUI = initUI;
window.setOrderType = setOrderType;
window.onAssetChange = onAssetChange;
window.updateOrderPreview = updateOrderPreview;
window.renderPositionsList = renderPositionsList;
window.payRent = payRent;
window.doTransfer = doTransfer;
window.doDeposit = doDeposit;
window.doWithdraw = doWithdraw;
window.placeOrder = placeOrder;
window.quickTrade = quickTrade;
window.purchaseItem = purchaseItem;
window.completeCourse = completeCourse;
window.applyJob = applyJob;
window.workShift = workShift;
window.doCrime = doCrime;
window.doHustle = doHustle;
window.startNap = startNap;
window.startNightSleep = startNightSleep;
window.takeShower = takeShower;
window.skipToMorning = skipToMorning;
window.openStore = (storeId) => {
  G.shopView = 'store';
  G.currentStoreId = storeId;
  renderShopTab();
};
window.cookItem = cookItem;
window.moveToStove = moveToStove;