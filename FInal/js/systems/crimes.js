// js/systems/crimes.js – Crime & Hustle System (compatible with old definitions)

import {
  G, fmt, clamp, rand, hasItem, hasSkill, saveGame
} from '../core/state.js';

import { fastForward } from './time.js';

// Import crime definitions
import { pickpocketCrime } from '../content/crimes/pickpocket.js';
import { scamCrime } from '../content/crimes/scam.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[crimes] toast:', msg, type);
let _addLog = (msg) => console.warn('[crimes] log:', msg);
let _renderAll = () => console.warn('[crimes] render called');

export function setCrimesUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// CRIME & HUSTLE REGISTRY

const crimeRegistry = {};
const hustleRegistry = {};

export function registerCrime(def) {
  if (def.type === 'hustle') {
    hustleRegistry[def.id] = def;
  } else {
    crimeRegistry[def.id] = def;
  }
}

registerCrime(pickpocketCrime);
registerCrime(scamCrime);

// Register a default hustle (Beg)
registerCrime({
  id: 'beg',
  type: 'hustle',
  name: 'Beg',
  desc: 'Ask strangers for spare change. Duration varies (1‑6 h).',
  icon: '🥺',
  reward: [1, 10],        // base range, will be multiplied by hours
  energyCost: 5,
  duration: 1,            // minimum 1 hour
  // Custom execution
  execute(hustle) {
    const hours = Math.floor(Math.random() * 6) + 1;   // 1‑6 hours
    const cash = Math.floor(rand(hustle.reward[0], hustle.reward[1]) * hours * 0.5);
    return {
      success: true,
      reward: cash,
      xpGain: 2,
      duration: hours,           // override the default duration
      message: `Begged for ${hours}h, earned ${fmt(cash)}`,
    };
  }
});

export function getAllCrimes() { return Object.values(crimeRegistry); }
export function getAllHustles() { return Object.values(hustleRegistry); }

// ------------------------------------------------------------------
// DO A CRIME

export function doCrime(crimeId) {
  const crime = crimeRegistry[crimeId];
  if (!crime) {
    _showToast('Crime not found.', 'error');
    return { success: false, message: 'Unknown crime' };
  }

  if (G.jailDays > 0) {
    _showToast('You are in jail!', 'error');
    return { success: false, message: 'In jail' };
  }

  if (G.fatigue < crime.energyCost) {
    _showToast('Not enough energy! Need ' + crime.energyCost + ' fatigue.', 'warn');
    return { success: false, message: 'Low fatigue' };
  }

  // Check required item
  if (crime.needItem && !hasItem(crime.needItem)) {
    _showToast('Need ' + crime.needItem + ' to do this.', 'warn');
    return { success: false, message: 'Missing item' };
  }

  // Check cooldown
  if (G.crimeCooldowns[crimeId] && G.crimeCooldowns[crimeId] > 0) {
    _showToast('On cooldown for ' + G.crimeCooldowns[crimeId] + ' more days.', 'warn');
    return { success: false, message: 'Cooldown' };
  }

  // Fast‑forward time
  let hours = crime.duration || 1;
// If execute returns a custom duration, use it

  // Deduct fatigue
  if (!G.debugNoStatsConsume) {
  G.fatigue = clamp(G.fatigue - crime.energyCost, 0, 100);
}

  // Execute crime logic
  let result;
  if (typeof crime.execute === 'function') {
    result = crime.execute(crime);
  } else {
    result = executeCrimeDefault(crime);
  }

  // Apply cooldown after execution
  if (crime.cooldown && crime.cooldown > 0) {
    G.crimeCooldowns[crimeId] = crime.cooldown;
  }

  // Process success / failure consequences
  if (result.success) {
    G.cash += result.reward || 0;
    G.xp += result.xpGain || 0;
    G.crimeLevel = clamp((G.crimeLevel || 0) + 1, 0, 100);
    _showToast('✅ ' + crime.name + ' succeeded! +' + fmt(result.reward), 'success');
    _addLog('🦹 ' + crime.name + ': +' + fmt(result.reward));
  } else {
    // Failure: fine, possible jail
    if (result.caught) {
      G.jailDays = result.jailDays || 0;
      G.cash = Math.max(0, G.cash - (result.fine || 0));
      G.arrests = (G.arrests || 0) + 1;
      G.crimeLevel = clamp((G.crimeLevel || 0) + 5, 0, 100);
      G.criminalRecord = G.criminalRecord || [];
      G.criminalRecord.unshift('D' + G.day + ': Arrested for ' + crime.name + '. Jail ' + G.jailDays + 'd, fine ' + fmt(result.fine || 0));
      _showToast('❌ Caught! Jail ' + G.jailDays + ' days, fine ' + fmt(result.fine || 0), 'error');
      _addLog('❌ Caught: ' + crime.name + '. Jail ' + G.jailDays + 'd, fine ' + fmt(result.fine || 0));
    } else {
      G.cash = Math.max(0, G.cash - (result.fine || 0));
      G.creditScore = clamp(G.creditScore - 5, 200, 850);
      _showToast('❌ Failed ' + crime.name + '. Fined ' + fmt(result.fine || 0), 'error');
      _addLog('❌ Failed: ' + crime.name + '. Fine ' + fmt(result.fine || 0));
    }
  }

  checkLevelUp();
  _renderAll();
  saveGame();
  return result;
}

/**
 * Default crime execution (uses old‑style properties: failChance, jailRisk, reward[2], etc.)
 */
function executeCrimeDefault(crime) {
  const failChance = crime.failChance || 0.2;
  const isFail = Math.random() < failChance;

  if (isFail) {
    const caught = Math.random() < (crime.jailRisk || 0.3);
    const fine = Math.floor(rand(crime.fine?.[0] || 20, crime.fine?.[1] || 60));
    let jailDays = 0;
    if (caught) {
      jailDays = Math.floor(rand(crime.jailTime?.[0] || 1, crime.jailTime?.[1] || 3));
    }
    if (crime.healthRisk && Math.random() < crime.healthRisk) {
      const dmg = Math.floor(rand(15, 30));
      G.health = clamp(G.health - dmg, 0, 100);
      _showToast('💢 You got hurt! -' + dmg + ' HP.', 'error');
      _addLog('💢 Hurt during crime: -' + dmg + ' HP');
    }
    return {
      success: false,
      caught: caught,
      fine: fine,
      jailDays: jailDays,
      xpGain: 2,
      message: caught ? 'Caught' : 'Failed',
    };
  } else {
    const reward = Math.floor(rand(crime.reward[0], crime.reward[1]));
    return {
      success: true,
      reward: reward,
      xpGain: crime.xpGain || 5,
      message: 'Success',
    };
  }
}

// ------------------------------------------------------------------
// DO A HUSTLE

export function doHustle(hustleId) {
  const hustle = hustleRegistry[hustleId];
  if (!hustle) {
    _showToast('Hustle not found.', 'error');
    return { success: false, message: 'Unknown hustle' };
  }

  if (G.jailDays > 0) {
    _showToast('You are in jail!', 'error');
    return { success: false, message: 'In jail' };
  }

  if (G.fatigue < hustle.energyCost) {
    _showToast('Not enough energy! Need ' + hustle.energyCost + ' fatigue.', 'warn');
    return { success: false, message: 'Low fatigue' };
  }

  // 1. Run the execute function if it exists (returns reward, duration, etc.)
  let result;
  if (typeof hustle.execute === 'function') {
    result = hustle.execute(hustle);
  } else {
    // Default simple reward
    const cash = Math.floor(rand(hustle.reward[0], hustle.reward[1]));
    result = { success: true, reward: cash, xpGain: hustle.xpGain || 2 };
  }

  // 2. Determine duration (use custom duration from execute if provided)
  const hours = result.duration || hustle.duration || 1;

  // 3. Fast‑forward time
  fastForward(hours);

  // 4. Deduct fatigue
  if (!G.debugNoStatsConsume) {
  G.fatigue = clamp(G.fatigue - hustle.energyCost, 0, 100);
}

  // 5. Apply rewards
  if (result.success) {
    G.cash += result.reward || 0;
    G.xp += result.xpGain || 0;
    _showToast('✅ ' + hustle.name + ': +' + fmt(result.reward), 'success');
    _addLog('💡 Hustle ' + hustle.name + ': +' + fmt(result.reward));

    // Special Beg effect – reduce morale
    if (hustleId === 'beg') {
      if (!G.debugNoStatsConsume) {
  G.morale = clamp(G.morale - 10, 0, 100);
}
      _showToast('😔 Begged for ' + fmt(result.reward) + '. Dignity lost.', 'info');
    }
  } else {
    if (!G.debugNoStatsConsume) {
  G.morale = clamp(G.morale - 4, 0, 100);
}
    _showToast('❌ ' + hustle.name + ' failed.', 'error');
  }

  checkLevelUp();
  _renderAll();
  saveGame();
  return result;
}

// ------------------------------------------------------------------
// COOLDOWN DECAY (called daily)

export function decayCrimeCooldowns() {
  Object.keys(G.crimeCooldowns).forEach(id => {
    if (G.crimeCooldowns[id] > 0) G.crimeCooldowns[id]--;
  });
}

// ------------------------------------------------------------------
// CRIMINAL RECORD HELPERS

export function getCriminalRecord() { return G.criminalRecord || []; }
export function getCrimeLevel() { return G.crimeLevel || 0; }
export function getArrests() { return G.arrests || 0; }

// ------------------------------------------------------------------
// LEVEL UP CHECK

function checkLevelUp() {
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.floor(G.xpNext * 1.5);
    _showToast('⭐ Level Up! Now Level ' + G.level + '!', 'success');
    _addLog('⭐ Level up! Level ' + G.level);
  }
}