import { G, fmt, clamp, saveGame } from '../core/state.js';
import { fastForward } from './time.js';

export const cookingRecipes = {
  chicken_breast: {
    name: 'Grilled Chicken Breast', icon: '🍗',
    hunger: 50, morale: 5, fatigue: 3, timeHours: 0.5,
  },
  ground_beef: {
    name: 'Beef Patty', icon: '🥩',
    hunger: 45, stress: 5, morale: 0, fatigue: 2, timeHours: 0.5,
  },
  ribeye_steak: {
    name: 'Pan-Seared Ribeye Steak', icon: '🥩',
    hunger: 70, morale: 15, fatigue: 5, timeHours: 0.75,
  },
};

let _showToast, _addLog, _renderAll;
export function setCookingUI(toastFn, logFn, renderFn) {
  _showToast = toastFn; _addLog = logFn; _renderAll = renderFn;
}

// Get raw meats currently on the stove (ready to cook)
export function getStoveMeats() {
  return G.stoveMeats || [];
}

// Get raw meats in the fridge (if owned)
export function getFridgeItems() {
  return G.fridgeItems || [];
}

// Move a meat from fridge to stove
export function moveToStove(meatId) {
  if (!G.hasStove) {
    _showToast('You need a stove first!', 'error');
    return false;
  }

  // Try to take from fridge first, then pantry
  let moved = false;
  if (G.hasFridge && G.fridgeItems && G.fridgeItems.includes(meatId)) {
    G.fridgeItems = G.fridgeItems.filter(id => id !== meatId);
    moved = true;
  } else if (G.rawMeats && G.rawMeats.includes(meatId)) {
    G.rawMeats = G.rawMeats.filter(id => id !== meatId);
    moved = true;
  }

  if (!moved) {
    _showToast('You don\'t have that raw meat.', 'error');
    return false;
  }

  if (!G.stoveMeats) G.stoveMeats = [];
  G.stoveMeats.push(meatId);
  _showToast(`Moved ${meatId.replace(/_/g, ' ')} to the stove.`, 'info');
  _renderAll();
  saveGame();
  return true;
}

// Cook a meat currently on the stove
export function cookItem(rawId) {
  if (!G.hasStove) {
    _showToast('You need a stove to cook!', 'error');
    return false;
  }
  const recipe = cookingRecipes[rawId];
  if (!recipe) {
    _showToast('Cannot cook this item.', 'error');
    return false;
  }
  const idx = G.stoveMeats.indexOf(rawId);
  if (idx === -1) {
    _showToast('Place the meat on the stove first.', 'error');
    return false;
  }

  // Remove from stove
  G.stoveMeats.splice(idx, 1);
  // Remove from inventory tracking (since it's consumed)
  G.inventory[rawId] = false;
  // Reduce weight
  G.inventoryWeight = Math.max(0, G.inventoryWeight - 0.5);

  fastForward(recipe.timeHours);

  G.hunger = clamp(G.hunger + recipe.hunger, 0, 100);
  G.morale = clamp(G.morale + (recipe.morale || 0), 0, 100);
  G.stress = clamp(G.stress + (recipe.stress || 0), 0, 100);
  G.fatigue = clamp(G.fatigue + (recipe.fatigue || 0), 0, 100);

  _showToast(`🍳 Cooked ${recipe.name}!`, 'success');
  _addLog(`🍳 Cooked ${recipe.name}.`);
  _renderAll();
  saveGame();
  return true;
}