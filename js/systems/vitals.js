// js/systems/vitals.js – Vitals System
// Manages health, fatigue, morale, hunger, stress decay and recovery.
// All modifications to vitals should go through this system.

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
let _showToast = (msg, type) => console.warn('[vitals] toast:', msg, type);
let _addLog = (msg) => console.warn('[vitals] log:', msg);
let _renderAll = () => console.warn('[vitals] render called');

export function setVitalsUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// STRENGTH & WORK FATIGUE FUNCTIONS

export function getStrengthFactor() {
  return 1 - G.strength * 0.05;
}

export function applyWorkFatigue(hours, isPhysical = false) {
  let baseFatigue = hours * 10;
  if (isPhysical) baseFatigue *= (1 + (1 - getStrengthFactor()));
  G.fatigue = clamp(G.fatigue - baseFatigue, 0, 100);
}

// ------------------------------------------------------------------
// MAIN DECAY FUNCTION – called by time.js each hour/tick

/**
 * Apply vitals decay based on a time fraction.
 * @param {number} fraction - fraction of an hour passed (defaults to 1)
 */
export function applyVitalsDecay(fraction = 1) {
  // No Stats Consumed
  if (G.debugNoStatsConsume) return;
  // 1. Hunger decays
  G.hunger = clamp(G.hunger - 12 * fraction, 0, 100);
  console.log('DECAY CALLED, flag:', G.debugNoStatsConsume);
  
  // Apply active buffs
if (G.activeBuffs && G.activeBuffs.length > 0) {
  G.activeBuffs = G.activeBuffs.filter(buff => {
    if (buff.duration > 0) {
      if (buff.type === 'slow_hunger') {
        // Apply the slower hunger (overriding the normal decay)
        // This is a bit tricky because we already decayed hunger above.
        // Simpler: we'll adjust hunger decay in the main decay block, but
        // for now, we can just reduce the hunger decay by the multiplier.
        // Instead, we'll refund some hunger based on the fraction.
        G.hunger = clamp(G.hunger + (5 * fraction * (1 - buff.multiplier)), 0, 100);
      }
      buff.duration -= fraction; // reduce by fraction of an hour
      return buff.duration > 0;
    }
    return false;
  });
}
  
  // Carrying fatigue
  if (G.inventoryWeight > G.maxInventoryWeight) {
  G.fatigue = clamp(G.fatigue - 2 * fraction, 0, 100);
}

  // 2. Fatigue decays (base 3/h, plus extra if exhausted)
  let fatigueDecay = 3 * fraction;
  if (G.fatigue < 20) {
    fatigueDecay += 2 * fraction;
  }

  // 2a. Caffeine crash
  if (G.caffeineCrashDays && G.caffeineCrashDays > 0) {
    fatigueDecay += G.caffeineCrashDays * 4 * fraction;
    G.caffeineCrashDays = 0; // crash applies once, then resets
  }

  // 2b. Eviction penalty
  if (G.evicted) {
    fatigueDecay += 10 * fraction;
  }

  // 2c. Utilities unpaid
  if (!G.utilsPaid) {
    fatigueDecay += 5 * fraction;
  }

  G.fatigue = clamp(G.fatigue - fatigueDecay, 0, 100);

  // 3. Morale decays (base)
  let moraleDecay = 3 * fraction;

  // 3a. Eviction penalty
  if (G.evicted) {
    moraleDecay += 8 * fraction;
  }

  // 3b. High stress penalty
  if (G.stress > 70) {
    moraleDecay += 5 * fraction;
  }

  G.morale = clamp(G.morale - moraleDecay, 0, 100);

  // 4. Hygiene decay
  G.hygiene = clamp(G.hygiene - 0.5 * fraction, 0, 100);

  // 5. Hunger consequences
  if (G.hunger < 15) {
    G.health = clamp(G.health - 10 * fraction, 0, 100);
    if (G.hunger === 0) {
      _addLog('☠️ Starving.');
    }
  }

  // 6. Malnutrition from cheap meals
  if (G.consecutiveCheapMeals >= 5) {
    G.fatigue = clamp(G.fatigue - 10 * fraction, 0, 100);
    G.health = clamp(G.health - 5 * fraction, 0, 100);
    _showToast('🥫 Malnutrition from cheap meals. Fatigue & health dropping.', 'warn');
    // Reset the counter after warning (so we don't spam)
    G.consecutiveCheapMeals = 0;
  }

  // 7. Evicted health drain
  if (G.evicted) {
    G.health = clamp(G.health - 3 * fraction, 0, 100);
  }

  // 8. Exhaustion collapse
  if (G.fatigue <= 0) {
    _showToast('💤 Exhausted! Collapsed.', 'error');
    G.health = clamp(G.health - 20, 0, 100);
    G.fatigue = 20;
  }

  // 9. Health collapse
  if (G.health <= 0) {
    _showToast('💀 Collapsed! Emergency hospital visit. Cost $300.', 'error');
    G.cash = Math.max(0, G.cash - 300);
    G.health = 40;
    G.creditScore = clamp(G.creditScore - 10, 200, 850);
    _addLog('💀 Hospitalized. Lost $300.');
  }
}

// ------------------------------------------------------------------
// VITAL MODIFICATION FUNCTIONS (called by shop or quick actions)

/**
 * Eat a cheap meal.
 * @param {number} cost - usually $5
 */
export function eatCheapMeal(cost = 5) {
  if (G.cash < cost) {
    _showToast('Not enough cash for a meal!', 'error');
    return false;
  }
  G.cash -= cost;
  G.hunger = clamp(G.hunger + 30, 0, 100);
  G.fatigue = clamp(G.fatigue + 5, 0, 100);
  G.consecutiveCheapMeals++;
  _showToast('🍔 Ate a cheap meal. +30 hunger, +5 fatigue. -$' + cost, 'success');
  _addLog('🍔 Cheap meal: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Eat a restaurant meal.
 * @param {number} cost - usually $18
 */
export function eatRestaurantMeal(cost = 18) {
  if (G.cash < cost) {
    _showToast('Not enough cash for a restaurant meal!', 'error');
    return false;
  }
  G.cash -= cost;
  G.hunger = clamp(G.hunger + 60, 0, 100);
  G.morale = clamp(G.morale + 10, 0, 100);
  G.fatigue = clamp(G.fatigue + 10, 0, 100);
  G.consecutiveCheapMeals = 0; // resets the cheap meal counter
  _showToast('🥩 Restaurant meal! +60 hunger, +10 morale, +10 fatigue. -$' + cost, 'success');
  _addLog('🥩 Restaurant meal: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Drink coffee.
 * @param {number} cost - usually $2
 */
export function drinkCoffee(cost = 2) {
  if (G.cash < cost) {
    _showToast('Not enough cash for coffee!', 'error');
    return false;
  }
  G.cash -= cost;
  G.fatigue = clamp(G.fatigue + 15, 0, 100);
  G.caffeineCrashDays = 5; // fatigue crash in 5 days
  _showToast('☕ Coffee! +15 fatigue. Fatigue crash in 5 days.', 'info');
  _addLog('☕ Coffee: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Drink energy drink.
 * @param {number} cost - usually $3
 */
export function drinkEnergyDrink(cost = 3) {
  if (G.cash < cost) {
    _showToast('Not enough cash for energy drink!', 'error');
    return false;
  }
  G.cash -= cost;
  G.fatigue = clamp(G.fatigue + 25, 0, 100);
  G.caffeineCrashDays = 8;
  _showToast('⚡ Energy drink! +25 fatigue. Fatigue crash in 8 days.', 'info');
  _addLog('⚡ Energy drink: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Take medicine.
 * @param {number} cost - usually $8
 */
export function takeMedicine(cost = 8) {
  if (G.cash < cost) {
    _showToast('Not enough cash for medicine!', 'error');
    return false;
  }
  G.cash -= cost;
  G.health = clamp(G.health + 20, 0, 100);
  _showToast('💊 Medicine! +20 health. -$' + cost, 'success');
  _addLog('💊 Medicine: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Go to the gym.
 * @param {number} cost - usually $15
 */
export function goGym(cost = 15) {
  if (G.cash < cost) {
    _showToast('Not enough cash for gym!', 'error');
    return false;
  }
  G.cash -= cost;
  G.health = clamp(G.health + 15, 0, 100);
  G.morale = clamp(G.morale + 10, 0, 100);
  G.stress = clamp(G.stress - 10, 0, 100);
  _showToast('🏋️ Gym session! +15 health, +10 morale, -10 stress. -$' + cost, 'success');
  _addLog('🏋️ Gym: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

/**
 * Therapy session.
 * @param {number} cost - usually $40
 */
export function therapy(cost = 40) {
  if (G.cash < cost) {
    _showToast('Not enough cash for therapy!', 'error');
    return false;
  }
  G.cash -= cost;
  G.stress = clamp(G.stress - 30, 0, 100);
  G.morale = clamp(G.morale + 20, 0, 100);
  _showToast('🧠 Therapy! -30 stress, +20 morale. -$' + cost, 'success');
  _addLog('🧠 Therapy: -$' + cost);
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// STRESS MODIFIERS – called from jobs and crimes

/**
 * Increase stress from high-stress activities.
 * @param {number} amount - how much stress to add
 */
export function addStress(amount) {
  G.stress = clamp(G.stress + amount, 0, 100);
  if (G.stress >= 90) {
    _showToast('😰 Extreme stress! You need therapy or a break.', 'warn');
  }
  _renderAll();
  saveGame();
}

/**
 * Decrease stress (used by therapy/gym).
 * @param {number} amount - how much stress to remove
 */
export function reduceStress(amount) {
  G.stress = clamp(G.stress - amount, 0, 100);
  _renderAll();
  saveGame();
}

// ------------------------------------------------------------------
// GETTERS for UI

export function getVitals() {
  return {
    health: G.health,
    fatigue: G.fatigue,
    morale: G.morale,
    hunger: G.hunger,
    stress: G.stress,
    hygiene: G.hygiene,
  };
}

export function isStarving() {
  return G.hunger < 15;
}

export function isExhausted() {
  return G.fatigue < 20;
}

export function isStressed() {
  return G.stress > 70;
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility
window.eatCheapMeal = eatCheapMeal;
window.eatRestaurantMeal = eatRestaurantMeal;
window.drinkCoffee = drinkCoffee;
window.drinkEnergyDrink = drinkEnergyDrink;
window.takeMedicine = takeMedicine;
window.goGym = goGym;
window.therapy = therapy;