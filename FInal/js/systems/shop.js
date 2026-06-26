// js/systems/shop.js – Shop System Manager (corrected)

import {
  G, fmt, clamp, hasItem, hasSkill, saveGame
} from '../core/state.js';

// Import item definitions (only once)
import { groceryItems } from '../content/shop/essentials/grocery.js';

// Import vitals functions (to apply item effects)
import {
  eatCheapMeal, eatRestaurantMeal, drinkCoffee, drinkEnergyDrink,
  takeMedicine, goGym, therapy
} from './vitals.js';

import { takeShower } from './time.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[shop] toast:', msg, type);
let _addLog = (msg) => console.warn('[shop] log:', msg);
let _renderAll = () => console.warn('[shop] render called');

export function setShopUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// ITEM REGISTRY
const shopRegistry = {};                 // id → item
const categoryRegistry = {};            // category → [id, …]

export function registerItem(itemDef) {
  shopRegistry[itemDef.id] = itemDef;
  // Add to category list
  if (!categoryRegistry[itemDef.category]) {
    categoryRegistry[itemDef.category] = [];
  }
  if (!categoryRegistry[itemDef.category].includes(itemDef.id)) {
    categoryRegistry[itemDef.category].push(itemDef.id);
  }
}

import { getStore, isStoreOpen } from '../content/shop/stores.js';

export function getItemsByStore(storeId) {
  const store = getStore(storeId);
  if (!store) return [];
  // Return registered items whose IDs are in the store's items list
  return store.items.map(id => shopRegistry[id]).filter(Boolean);
}

// Register all grocery items
groceryItems.forEach(item => registerItem(item));

// ------------------------------------------------------------------
// GETTERS
export function getShopItem(id) {
  return shopRegistry[id] || null;
}

export function getAllShopItems() {
  return Object.values(shopRegistry);
}

export function getItemsByCategory(catId) {
  const ids = categoryRegistry[catId] || [];
  return ids.map(id => shopRegistry[id]).filter(Boolean);
}

// ------------------------------------------------------------------
// BUY ITEM
export function buyItem(id) {
  const item = shopRegistry[id];
  if (!item) {
    _showToast('Item not found.', 'error');
    return false;
  }

  // Already owned (permanent items)
  if (item.permanent && hasItem(item.inventoryId || item.id)) {
    _showToast('You already own this item.', 'warn');
    return false;
  }

  // Required item check
  if (item.requiredItem && !hasItem(item.requiredItem)) {
    _showToast('Need ' + item.requiredItem + ' to buy this.', 'warn');
    return false;
  }

  // Cash check
  if (G.cash < item.price) {
    _showToast('Not enough cash! Need ' + fmt(item.price) + '.', 'error');
    return false;
  }

  // Deduct cash
  G.cash -= item.price;

  // Apply effect
  const result = applyItemEffect(item);
  if (!result.success) {
    // Refund on failure
    G.cash += item.price;
    return false;
  }

  _showToast('✅ Bought: ' + item.name + ' for ' + fmt(item.price), 'success');
  _addLog('🛒 Bought: ' + item.name + ' (' + fmt(item.price) + ')');
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// APPLY ITEM EFFECTS
function applyItemEffect(item) {
  const result = { success: true, message: '' };

  switch (item.effectType) {
    case 'hunger':
      G.hunger = clamp(G.hunger + item.value, 0, 100);
      G.consecutiveCheapMeals = (G.consecutiveCheapMeals || 0) + 1;
      result.message = '+ ' + item.value + ' hunger (cheap meal)';
      break;

    case 'hunger_morale':
      G.hunger = clamp(G.hunger + item.value, 0, 100);
      G.morale = clamp(G.morale + (item.moraleBoost || 10), 0, 100);
      G.consecutiveCheapMeals = 0;
      result.message = '+ ' + item.value + ' hunger, +' + (item.moraleBoost || 10) + ' morale';
      break;

    case 'energy':
      G.fatigue = clamp(G.fatigue + item.value, 0, 100);
      if (item.caffeineDays) G.caffeineCrashDays = item.caffeineDays;
      result.message = '+ ' + item.value + ' energy' + (item.caffeineDays ? ' (crash in ' + item.caffeineDays + ' days)' : '');
      break;

    case 'health':
      G.health = clamp(G.health + item.value, 0, 100);
      result.message = '+ ' + item.value + ' health';
      break;

    case 'gym':
      G.health = clamp(G.health + 15, 0, 100);
      G.morale = clamp(G.morale + 10, 0, 100);
      G.stress = clamp(G.stress - 10, 0, 100);
      G.fatigue = clamp(G.fatigue - 20, 0, 100);
      result.message = '+15 health, +10 morale, -10 stress (fatigue cost)';
      break;

    case 'therapy':
      G.stress = clamp(G.stress - 30, 0, 100);
      G.morale = clamp(G.morale + 20, 0, 100);
      result.message = '-30 stress, +20 morale';
      break;

    case 'shower':
      takeShower();
      result.message = 'Showered. +40 hygiene.';
      break;

    // Permanent items (laptop, phone, etc.)
    case 'inventory':
      G.inventory[item.inventoryId || item.id] = true;
      if (item.inventoryId === 'laptop') G.laptopDurability = 100;
      result.message = item.name + ' added to inventory';
      break;

    case 'subscription':
      G.inventory[item.inventoryId || item.id] = true;
      result.message = 'Subscription activated: ' + item.name;
      break;

    case 'repair':
      if (hasItem('laptop')) {
        G.laptopDurability = Math.min(100, (G.laptopDurability || 0) + item.value);
        result.message = 'Laptop repaired to ' + G.laptopDurability + '%';
      } else {
        result.success = false;
        result.message = 'You don’t own a laptop to repair.';
      }
      break;

    default:
      console.warn('Unknown effect type:', item.effectType);
      result.success = false;
      result.message = 'Unknown item effect.';
  }

  return result;
}

// ------------------------------------------------------------------
// RENDER SHOP HTML (called by UI)
export function renderShopItems(category = null, storeId = null) {
  let items;
  if (storeId) {
    items = getItemsByStore(storeId);
  } else if (category) {
    items = getItemsByCategory(category);
  } else {
    items = getAllShopItems();
  }

  if (!items || items.length === 0) {
    return '<div style="color:var(--muted);padding:16px;font-size:12px">No vendor items stocked in this category right now.</div>';
  }
  
  return items.map(item => {
    const owned = item.permanent && hasItem(item.inventoryId || item.id);
    const isSubscription = item.effectType === 'subscription';
    const monthlyText = isSubscription ? ' <span style="font-size:9px;color:var(--muted)">/mo</span>' : '';

    return `
      <div class="shop-card">
        <div style="font-size:32px;margin-bottom:8px">${item.icon}</div>
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">
          ${item.name}${monthlyText}
          ${owned ? ' <span style="color:var(--green);font-size:10px">✅ Owned</span>' : ''}
          ${item.requiredItem && !hasItem(item.requiredItem) ? ' <span style="color:var(--red);font-size:10px">🔒 Need ' + item.requiredItem + '</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px;flex:1">${item.desc}</div>
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--gold);margin-bottom:8px">${fmt(item.price)}</div>
        <button 
          class="btn btn-gold btn-full btn-sm" 
          data-shop-item="${item.id}"
          ${owned ? 'disabled' : ''}
          ${item.requiredItem && !hasItem(item.requiredItem) ? 'disabled' : ''}
        >
          ${owned ? '✅ Owned' : 'Buy'}
        </button>
      </div>
    `;
  }).join('');
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY
window.buyItem = buyItem;
window.getItemsByStore = getItemsByStore;
window.isStoreOpen = isStoreOpen;
window.getStore = getStore;