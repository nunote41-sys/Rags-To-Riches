// js/core/state.js – Game State & Persistence

/**
 * Core game state object.
 * All mutable game data lives here.
 */
export const G = {
  // Meta
  currentTab: 'home',
  diff: 'normal',
  day: 1,
  month: 1,
  year: 1,
  hour: 6,        // 0–23 (game starts at 06:00)
  minute: 0,      // 0–59
  
  // Shop navigation
  shopView: 'directory',        // 'directory' or 'store'
  currentStoreId: null,         // id of the store being browsed

  // Finances
  cash: 0,
  bank: 0,
  loan: 0,
  loanSource: 'none',
  loanInterestRate: 0.03,
  totalDeposited: 0,
  interestEarned: 0,

  // Vitals
  health: 100,
  fatigue: 100,   // replaces the old 'energy' (0 = exhausted, 100 = fully rested)
  morale: 80,
  hunger: 60,
  stress: 20,
  strength: 0,    // 0–10, reduces physical fatigue gain
  hygiene: 80,    // 0–100

  // Progression
  xp: 0,
  level: 1,
  xpNext: 100,
  skills: [],
  coursesCompleted: [],

  // Job
  job: null,
  jobWorkedToday: false,
  jobShiftsThisWeek: 0,
  jobRequiredShifts: 0,

  // Rent & Housing
  rent: 480,
  rentDue: 1,
  housingStatus: 'Rented Apartment',
  evicted: false,
  rentLateFee: 0,

  // Credit
  creditScore: 510,

  // Criminal record
  crimeLevel: 0,
  arrests: 0,
  jailDays: 0,
  criminalRecord: [],

  // Trading
  portfolio: [],
  tradeHistory: [],
  customAssets: [], // <-- UPDATED: list of custom tradable instrument symbols (e.g. 'frxEURGBP')
  demoCash: 0,

  // Inventory
  inventory: {
    laptop: false,
    phone: false,
    suit: false,
    tools: false,
    transitPass: false,
    wifi: false,
  },

  // Other flags
  utilsPaid: true,
  phonePaid: true,
  consecutiveCheapMeals: 0,
  caffeineCrashDays: 0,
  laptopDurability: 100,
  paydayNext: 30,

  // Logs
  log: [],
  bankTxLog: [],
  
  // No Stats Consume
  debugNoStatsConsume: false,

  // Cooldowns
  crimeCooldowns: {},

  // Delayed events
  _pendingSyndicateMission: false,
  _pendingScamTrace: null,
};

/**
 * Reset the game to a fresh state.
 * @param {string} difficulty - 'easy', 'normal', or 'hustle'
 */
export function resetGame(difficulty) {
  // Clear all dynamic data
  G.currentTab = 'home';
  G.day = 1;
  G.month = 1;
  G.year = 1;
  G.diff = difficulty || 'normal';
  G.hour = 6;
  G.minute = 0;
  
  // Shop
  G.shopView = 'directory';
  G.currentStoreId = null;
  
  // No Stats Consume
  G.debugNoStatsConsume = false;
  
  // Reset finances
  G.cash = 0;
  G.bank = 0;
  G.loan = 0;
  G.loanSource = 'none';
  G.loanInterestRate = 0.03;
  G.totalDeposited = 0;
  G.interestEarned = 0;

  // Safety check for finances
  if (typeof G.cash !== 'number' || isNaN(G.cash)) G.cash = 0;
  if (typeof G.bank !== 'number' || isNaN(G.bank)) G.bank = 0;
  
  // Reset vitals
  G.health = 100;
  G.fatigue = 100;
  G.morale = 80;
  G.hunger = 60;
  G.stress = 20;
  G.strength = 0;
  G.hygiene = 80;
  
  // Reset progression
  G.xp = 0;
  G.level = 1;
  G.xpNext = 100;
  G.skills = [];
  G.coursesCompleted = [];
  
  // Reset job
  G.job = null;
  G.jobWorkedToday = false;
  G.jobShiftsThisWeek = 0;
  G.jobRequiredShifts = 0;
  
  // Reset housing
  G.rent = 480;
  G.rentDue = 0;
  G.housingStatus = 'Rented Apartment';
  G.evicted = false;
  G.rentLateFee = 0;
  
  // Reset credit
  G.creditScore = 510;
  
  // Reset criminal
  G.crimeLevel = 0;
  G.arrests = 0;
  G.jailDays = 0;
  G.criminalRecord = [];
  
  // Reset trading
  G.portfolio = [];
  G.tradeHistory = [];
  G.customAssets = []; // <-- UPDATED: clear custom assets on reset
  G.demoCash = 0;
  
  // Reset inventory
  G.inventory = {
    laptop: false,
    phone: false,
    suit: false,
    tools: false,
    transitPass: false,
    wifi: false,
  };
  
  // Reset flags
  G.utilsPaid = true;
  G.phonePaid = true;
  G.consecutiveCheapMeals = 0;
  G.caffeineCrashDays = 0;
  G.laptopDurability = 100;
  G.paydayNext = 30;
  
  // Reset logs
  G.log = [];
  G.bankTxLog = [];
  
  // Reset cooldowns
  G.crimeCooldowns = {};
  
  // Reset delayed events
  G._pendingSyndicateMission = false;
  G._pendingScamTrace = null;
  
  console.log('🔄 Game reset to fresh state. Difficulty:', difficulty);
}

/**
 * Save the entire game state to localStorage.
 */
export function saveGame() {
  try {
    const saveData = JSON.stringify(G);
    localStorage.setItem('rtr_save_v2', saveData);
  } catch (e) {
    console.warn('Failed to save game:', e);
  }
}

/**
 * Load game state from localStorage and merge into G.
 * @returns {boolean} true if a saved game was loaded.
 */
export function loadGame() {
  try {
    const raw = localStorage.getItem('rtr_save_v2');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(G, saved);
    
    // Safety checks for finances
    if (typeof G.cash !== 'number' || isNaN(G.cash)) G.cash = 0;
    if (typeof G.bank !== 'number' || isNaN(G.bank)) G.bank = 0;

    // Safety checks to ensure the new fields exist
    if (typeof G.hour !== 'number') G.hour = 6;
    if (typeof G.minute !== 'number') G.minute = 0;
    if (typeof G.fatigue !== 'number') G.fatigue = 100;
    if (typeof G.strength !== 'number') G.strength = 0;
    if (typeof G.hygiene !== 'number') G.hygiene = 80;
    if (typeof G.shopView !== 'string') G.shopView = 'directory';
    if (G.currentStoreId === undefined) G.currentStoreId = null;
    if (typeof G.debugNoStatsConsume !== 'boolean') G.debugNoStatsConsume = false;
    
    // Currents tabs to stay
    if (typeof G.currentTab !== 'string') G.currentTab = 'home';

    // Ensure arrays are arrays
    if (!Array.isArray(G.skills)) G.skills = [];
    if (!Array.isArray(G.coursesCompleted)) G.coursesCompleted = [];
    if (!Array.isArray(G.criminalRecord)) G.criminalRecord = [];
    if (!Array.isArray(G.portfolio)) G.portfolio = [];
    if (!Array.isArray(G.tradeHistory)) G.tradeHistory = [];
    if (!Array.isArray(G.customAssets)) G.customAssets = []; // <-- UPDATED: check customAssets array
    if (!Array.isArray(G.log)) G.log = [];
    if (!Array.isArray(G.bankTxLog)) G.bankTxLog = [];
    // Cooldowns is an object, not array
    if (typeof G.crimeCooldowns !== 'object' || Array.isArray(G.crimeCooldowns)) G.crimeCooldowns = {};
    // Ensure inventory exists
    if (!G.inventory) G.inventory = {};
    const defaultInv = { laptop: false, phone: false, suit: false, tools: false, transitPass: false, wifi: false };
    for (const key of Object.keys(defaultInv)) {
      if (!(key in G.inventory)) G.inventory[key] = defaultInv[key];
    }
    return true;
  } catch (e) {
    console.warn('Failed to load game:', e);
    return false;
  }
}

// ------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------

export function fmt(n) {
  if (n === undefined || n === null) return '$0';
  const abs = Math.abs(n);
  let s;
  if (abs >= 1000000) {
    s = '$' + (abs / 1000000).toFixed(2) + 'M';
  } else if (abs >= 1000) {
    s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    s = '$' + abs.toFixed(2);
  }
  return (n < 0 ? '-' : '') + s;
}

export function fmtP(n, dec = 4) {
  if (n === undefined) return '—';
  return n.toFixed(dec);
}

export function clamp(v, mn, mx) {
  return Math.min(mx, Math.max(mn, v));
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function hasSkill(id) {
  return G.skills.includes(id);
}

export function hasItem(id) {
  return G.inventory[id] === true;
}