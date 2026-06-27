// js/systems/shop.js – Shop System Manager (corrected)

import {
  G, fmt, clamp, hasItem, hasSkill, saveGame
} from '../core/state.js';

// Import purchase logic with time
import { fastForward, processShipments } from './time.js';
import { getStore, isStoreOpen } from '../content/shop/stores.js';
import { groceryItems } from '../content/shop/essentials/grocery.js';
import { butcherItems } from '../content/shop/essentials/butcher.js';
import { bakeryItems } from '../content/shop/essentials/bakery.js';
import { pharmacyItems } from '../content/shop/essentials/pharmacy.js';
import { techItems } from '../content/shop/essentials/tech.js';
import { greengrocerItems } from '../content/shop/essentials/greengrocer.js';
import { apparelItems } from '../content/shop/essentials/apparel.js';
import { applianceItems } from '../content/shop/essentials/appliances.js';

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

export function getItemsByStore(storeId) {
  const store = getStore(storeId);
  if (!store) return [];
  // Return registered items whose IDs are in the store's items list
  return store.items.map(id => shopRegistry[id]).filter(Boolean);
}

// Register all grocery items
groceryItems.forEach(item => registerItem(item));
butcherItems.forEach(item => registerItem(item));
bakeryItems.forEach(item => registerItem(item));
pharmacyItems.forEach(item => registerItem(item));
techItems.forEach(item => registerItem(item));
greengrocerItems.forEach(item => registerItem(item));
apparelItems.forEach(item => registerItem(item));
applianceItems.forEach(item => registerItem(item));

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
/**
 * Purchase an item from the current store.
 * @param {string} itemId - the item to buy
 */
export async function purchaseItem(itemId) {
  const item = shopRegistry[itemId];
  if (!item) {
    _showToast('Item not found.', 'error');
    return false;
  }

  const store = getStore(G.currentStoreId);
  if (!store) {
    _showToast('Store not found.', 'error');
    return false;
  }

  // Physical stores: check opening hours
  if (store.type === 'physical' && !isStoreOpen(store.id, G.hour)) {
    _showToast('🔴 The store is closed.', 'error');
    return false;
  }

  // Permanent item already owned?
  if (item.permanent && hasItem(item.inventoryId || item.id)) {
    _showToast('You already own this item.', 'warn');
    return false;
  }

  // Calculate final price with tax
  let basePrice = item.price;

// Apply pawn shop discount
if (store.discount) {
  basePrice = Math.ceil(basePrice * (1 - store.discount));
}

// Apply bodega markup
if (store.markup) {
  basePrice = Math.ceil(basePrice * store.markup);
}

const taxRate = store.taxRate || 0;
const totalPrice = Math.ceil(basePrice * (1 + taxRate));

// Check for stolen item (pawn shop only)
if (store.stolenChance && Math.random() < store.stolenChance) {
  if (!G.stolenItems) G.stolenItems = [];
  G.stolenItems.push(item.inventoryId || item.id);
  _showToast('⚠️ This item might be stolen! Carrying it is risky near police.', 'warn');
  _addLog(`🕵️ Bought potentially stolen ${item.name} from pawn shop.`);
}

  if (G.cash < totalPrice) {
    _showToast(`Not enough cash! Need ${fmt(totalPrice)} (incl. ${Math.round(taxRate*100)}% tax).`, 'error');
    return false;
  }

  // Physical store – apply checkout time and deliver immediately
  if (store.type === 'physical') {
    G.cash -= totalPrice;
    fastForward(store.checkoutMinutes / 60);  // wait in line
    applyItemEffect(item);
    _showToast(`✅ Bought ${item.name} for ${fmt(totalPrice)}.`, 'success');
    _addLog(`🛒 Bought ${item.name} at ${store.name} for ${fmt(totalPrice)}.`);
    _renderAll();
    saveGame();
    return true;
  }

  // E‑commerce – choose shipping
  if (store.type === 'ecommerce') {
    const shipping = await showShippingModal(item);
    if (!shipping) return false; // cancelled

    G.cash -= totalPrice;

    if (shipping.method === 'instant') {
      // Instant delivery – fast forward and receive immediately
      G.cash -= shipping.fee;  // delivery fee + tip
      fastForward(45 / 60);   // 45 minutes
      applyItemEffect(item);
      _showToast(`🛵 Instant delivery: ${item.name} arrived!`, 'success');
      _addLog(`🛵 Instant delivery: ${item.name} (fee ${fmt(shipping.fee)}).`);
    } else {
      // Calculate arrival time
      let arrivalDay = G.day;
      let arrivalHour = G.hour;
      if (shipping.method === 'standard') {
        arrivalDay += Math.floor(Math.random() * 3) + 3; // 3-5 days
      } else if (shipping.method === 'express') {
        arrivalDay += 1;
        arrivalHour = 10; // next day 10 AM
      }
      // Store shipment
      G.pendingShipments.push({
        name: item.name,
        inventoryId: item.inventoryId || item.id,
        arrivalDay,
        arrivalHour,
      });
      _showToast(`📦 Ordered ${item.name}. Arrives day ${arrivalDay}${arrivalHour ? ' around ' + arrivalHour + ':00' : ''}.`, 'info');
      _addLog(`📦 Ordered ${item.name} (${shipping.method} shipping).`);
    }
    _renderAll();
    saveGame();
    return true;
  }

  return false;
}

// Helper: show shipping options modal (returns promise)
// We'll implement this in ui.js and expose it globally
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
      
case 'raw_meat':
  G.inventory[item.id] = true;   // still mark as owned for tracking
  if (G.hasFridge) {
    // Store in fridge
    if (!G.fridgeItems) G.fridgeItems = [];
    G.fridgeItems.push(item.id);
    result.message = 'Stored in refrigerator.';
  } else {
    // Store in pantry (rawMeats)
    if (!G.rawMeats) G.rawMeats = [];
    G.rawMeats.push(item.id);
    result.message = 'Stored in pantry (no fridge).';
  }
  // Remove from perishable tracking if in fridge? We'll handle spoilage later.
  break;
  
case 'cure_malnutrition':
  G.hunger = clamp(G.hunger + (item.hungerValue || 15), 0, 100);
  if (G.consecutiveCheapMeals > 0) G.consecutiveCheapMeals = 0; // reset malnutrition counter
  result.message = 'Malnutrition cured. +' + (item.hungerValue || 15) + ' hunger.';
  break;

case 'metabolic_boost':
  G.hunger = clamp(G.hunger + (item.hungerValue || 20), 0, 100);
  // Add a buff: slower hunger decay for buffDuration hours
  if (!G.activeBuffs) G.activeBuffs = [];
  G.activeBuffs.push({
    type: 'slow_hunger',
    duration: item.buffDuration, // hours
    multiplier: 0.85, // 15% slower
  });
  result.message = 'Metabolic boost active! Hunger decays 15% slower for ' + item.buffDuration + 'h.';
  break;

case 'antibiotics':
  G.health = clamp(G.health + (item.healthValue || 40), 0, 100);
  // Remove any infection debuff (if we had one)
  result.message = 'Infection cured. +' + (item.healthValue || 40) + ' health.';
  break;

case 'sleep_aid':
  // Force sleep (will be handled by a separate function, but here we can trigger it)
  // We'll show a toast and then in the UI we can offer a sleep action.
  // For simplicity, we'll just restore fatigue and fast‑forward 9 hours.
  _showToast('💤 Taking prescription sleep aid...', 'info');
  fastForward(9);
  G.fatigue = 100;
  G.hunger = clamp(G.hunger - 20, 0, 100);
  result.message = 'Slept for 9 hours. Fully rested.';
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
   if (item.inventoryId === 'fridge') {
  G.hasFridge = true;
  // Move any existing rawMeats into the fridge
  if (G.rawMeats && G.rawMeats.length > 0) {
    if (!G.fridgeItems) G.fridgeItems = [];
    G.fridgeItems = G.fridgeItems.concat(G.rawMeats);
    G.rawMeats = [];
  }
}
if (item.inventoryId === 'stove') G.hasStove = true;
  if (item.inventoryId === 'laptop') {
    G.laptopDurability = item.durability || 100;
  } else if (item.inventoryId === 'phone') {
    G.phoneDurability = item.durability || 100;
  }
  
  // Add weight
if (item.weightKg) {
  G.inventoryWeight = parseFloat((G.inventoryWeight + item.weightKg).toFixed(2));
}

// Perishable tracking
if (item.isPerishable && item.shelfLifeDays > 0) {
  G.perishableItems.push({
    name: item.name,
    inventoryId: item.inventoryId || item.id,
    expireDay: G.day + item.shelfLifeDays,
  });
}
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
window.purchaseItem = purchaseItem;
window.getItemsByStore = getItemsByStore;
window.isStoreOpen = isStoreOpen;
window.getStore = getStore;