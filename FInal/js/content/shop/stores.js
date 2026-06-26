// js/content/shop/stores.js – Store Definitions & Catalogs

export const stores = {
  supermarket: {
    id: 'supermarket',
    name: '🛒 Supermarket',
    type: 'physical',
    desc: 'A large hypermarket. Sells food, drinks, and household items in bulk.',
    openHour: 7,
    closeHour: 22,
    taxRate: 0.08,
    travelMinutes: 30,     // kept for future, not used now
    checkoutMinutes: 30,
    items: [
      'bananas', 'chicken_breast', 'ground_beef',
      'sourdough_loaf', 'bread', 'cheap_meal', 'restaurant_meal',
      'coffee', 'energy_drink', 'water_bottle',
      'medicine', 'first_aid'
    ],
  },
  ecommerce: {
    id: 'ecommerce',
    name: '🌐 Online Marketplace',
    type: 'ecommerce',
    desc: 'Order anything from your phone/laptop. Items ship to your apartment.',
    taxRate: 0.10,
    // E‑commerce ships later (we'll handle delivery in Phase 2)
    items: [
      'cheap_meal', 'restaurant_meal', 'coffee', 'energy_drink',
      'water_bottle', 'snack', 'bread', 'medicine', 'first_aid',
      'phone', 'laptop'
    ],
  },
  // We'll add more stores (Pharmacy, Tech Store, etc.) later.
};

// Helper to get a store definition
export function getStore(id) {
  return stores[id] || null;
}

// Helper to check if a physical store is currently open
export function isStoreOpen(storeId, currentHour) {
  const store = stores[storeId];
  if (!store || store.type !== 'physical') return true; // e‑commerce always open
  return currentHour >= store.openHour && currentHour < store.closeHour;
}