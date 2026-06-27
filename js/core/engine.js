// js/core/engine.js – Main Orchestrator
import { G, saveGame, loadGame, resetGame, fmt, clamp } from './state.js';
import {
  renderAll, showToast, addLog, initUI, setEngineFunctions,
  updateOrderPreview, renderPositionsList
} from './ui.js';
import { setTimeUI, setTimeHooks } from '../systems/time.js';
import { setVitalsUI, applyVitalsDecay } from '../systems/vitals.js';
import { setEconomyUI, applyBankInterest, getNetWorth, setOpenPositionsGetter } from '../systems/economy.js';
import { setHousingUI, applyRent, payRent } from '../systems/housing.js';
import { setJobsUI, applyJob, workShift, checkCorporateFiring, resetWeeklyShifts } from '../systems/jobs.js';
import { setLoansUI, takeLoan, repayLoan, applyLoanInterest, checkLoanDefault } from '../systems/loans.js';
import { setTradingUI, initTrading, getPositionsValue, calcPnl } from '../systems/trading.js';
import {
  setMarketUI, initMarket, connectDeriv, disconnectDeriv, getPrice,
  buildTicker, renderMarketTable
} from '../systems/market.js';
import { setCrimesUI, doCrime, doHustle, decayCrimeCooldowns } from '../systems/crimes.js';
import { setShopUI } from '../systems/shop.js';
import { setCoursesUI, completeCourse } from '../systems/courses.js';
import { setCookingUI, cookItem } from '../systems/cooking.js';

let isGameRunning = false;
let autoSaveInterval = null;

export function initGame() {
  console.log('🏁 Initialising Rags to Riches Core Engine...');

  // 1. Pass actual UI functions to every subsystem
  setTimeUI(showToast, addLog, renderAll);
  setVitalsUI(showToast, addLog, renderAll);
  setEconomyUI(showToast, addLog, renderAll);
  setHousingUI(showToast, addLog, renderAll);
  setJobsUI(showToast, addLog, renderAll);
  setLoansUI(showToast, addLog, renderAll);
  setTradingUI(showToast, addLog, renderAll);

  setMarketUI(
    showToast,
    addLog,
    renderAll,
    // TICKER
    () => {
      const tickerEl = document.getElementById('tickerInner');
      if (tickerEl) tickerEl.innerHTML = buildTicker();
    },
    // MARKET TABLE
    () => {
      const sym = document.getElementById('order-asset')?.value || 'frxXAUUSD';
      const tableEl = document.getElementById('market-table');
      if (tableEl) renderMarketTable(tableEl, sym);
      if (typeof updateOrderPreview === 'function') updateOrderPreview();
      if (typeof renderPositionsList === 'function') renderPositionsList();
    }
  );

  setCrimesUI(showToast, addLog, renderAll);
  setShopUI(showToast, addLog, renderAll);
  setCoursesUI(showToast, addLog, renderAll);
  setCookingUI(showToast, addLog, renderAll);

  // 2. Wire up time-based hooks
  setTimeHooks({
    vitalsDecay: applyVitalsDecay,
    applySalary: () => {
      if (G.job) {
        const gross = G.job.wage;
        const tax = Math.floor(gross * G.job.taxRate);
        const net = gross - tax;
        G.cash += net;
        showToast('💰 Payday! Net: ' + fmt(net), 'success');
        addLog('💰 Salary paid: ' + fmt(net));
      }
    },
    applyBankInterest: applyBankInterest,
    applyLoanInterest: applyLoanInterest,
    applyRent: applyRent,
    checkCorporateFiring: checkCorporateFiring,
    resetWeeklyShifts: resetWeeklyShifts,
    checkLoanDefault: checkLoanDefault,
    applySubscriptions: () => {},
    applyLaptopDurability: () => {
  // Laptop decay
  if (G.inventory.laptop) {
    G.laptopDurability = (G.laptopDurability || 100) - 8;
    if (G.laptopDurability <= 0) {
      G.inventory.laptop = false;
      G.laptopDurability = 0;
      showToast('💻 Laptop broke! Buy a new one.', 'error');
      addLog('💻 Laptop broke down.');
    }
  }
  // Phone decay
  if (G.inventory.phone) {
    G.phoneDurability = (G.phoneDurability || 100) - 5;
    if (G.phoneDurability <= 0) {
      G.inventory.phone = false;
      G.phoneDurability = 0;
      showToast('📱 Phone broke! Buy a new one.', 'error');
      addLog('📱 Phone broke.');
    }
  }
},
  });

  // 3. Connect trading to net worth
  setOpenPositionsGetter(getPositionsValue);

  // 4. Load saved game or show intro
  const loaded = loadGameAndResume();
  if (!loaded) {
    document.getElementById('screen-intro').classList.add('active');
    document.getElementById('screen-game').classList.remove('active');
  } else {
    document.getElementById('screen-intro').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
  }

  initUI({
    startGame,
    advanceDay: () => {},
    loadGameAndResume,
    resetAndQuit,
  });

  initMarket();
  initTrading();
  renderAll();
  console.log('🎮 Rags to Riches – Ready.');
}

export function startGame(difficulty) {
  console.log('🚀 Starting new game. Difficulty:', difficulty);
  resetGame(difficulty);
  G.diff = difficulty;

  // No job is assigned – player must apply manually
  G.job = null;
  G.jobWorkedToday = false;
  G.jobShiftsThisWeek = 0;
  G.jobRequiredShifts = 0;

  if (difficulty === 'easy') {
    G.cash = 2500; G.bank = 8000; G.rent = 650; G.rentDue = 0; G.creditScore = 720;
    G.health = 100; G.fatigue = 100; G.morale = 90; G.hunger = 80; G.stress = 10;
    G.strength = 0; G.hygiene = 80; G.hour = 6; G.minute = 0;
    G.inventory.phone = true; G.inventory.laptop = true; G.inventory.wifi = true;
    G.phoneDurability = 100;
    // no applyJob('office')
  } else if (difficulty === 'hustle') {
    G.cash = 10; G.bank = 80; G.rent = 400; G.rentDue = 2; G.creditScore = 310;
    G.health = 75; G.fatigue = 60; G.morale = 30; G.hunger = 30; G.stress = 50;
    G.strength = 0; G.hygiene = 50; G.hour = 6; G.minute = 0;
    G.inventory.phone = false; 
    G.phoneDurability = 0;
    G.inventory.laptop = false;
    // no applyJob('vendor')
  } else { // normal
    G.cash = 350; G.bank = 1200; G.rent = 480; G.rentDue = 1; G.creditScore = 510;
    G.health = 90; G.fatigue = 80; G.morale = 65; G.hunger = 55; G.stress = 25;
    G.strength = 0; G.hygiene = 70; G.hour = 6; G.minute = 0;
    G.inventory.phone = true; G.inventory.laptop = false;
    G.phoneDurability = 100;
    // no applyJob('delivery')
  }

  // Clear dynamic arrays
  G.log = []; G.criminalRecord = []; G.bankTxLog = [];
  G.portfolio = []; G.tradeHistory = []; G.customAssets = [];
  G.coursesCompleted = []; G.skills = [];

  isGameRunning = true;
  document.getElementById('screen-intro').classList.remove('active');
  document.getElementById('screen-game').classList.add('active');

  initMarket();
  initTrading();
  addLog('🎮 Game started! Difficulty: ' + difficulty.toUpperCase());
  if (G.rentDue > 0) showToast('⚠️ You owe ' + G.rentDue + ' month(s) of rent!', 'warn');
  renderAll();
  saveGame();

  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    if (isGameRunning) saveGame();
  }, 30000);
}

export function advanceDay() {
  console.warn('advanceDay called but is deprecated. Use time.js functions.');
}

export function loadGameAndResume() {
  const loaded = loadGame();
  if (loaded) {
    isGameRunning = true;
    document.getElementById('screen-intro').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    initMarket();
    initTrading();
    renderAll();
    showToast('💾 Game loaded from save.', 'success');
    addLog('💾 Game loaded from save.');
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
      if (isGameRunning) saveGame();
    }, 30000);
    return true;
  }
  return false;
}

export function resetAndQuit() {
  if (confirm('Are you sure you want to delete your current game progress and restart?')) {
    isGameRunning = false;
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    disconnectDeriv();
    localStorage.removeItem('rtr_save_v2');
    location.reload();
  }
}