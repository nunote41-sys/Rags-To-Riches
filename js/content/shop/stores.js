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
    checkoutMinutes: 0,
    // E‑commerce ships later (we'll handle delivery in Phase 2)
    items: [
      'cheap_meal', 'restaurant_meal', 'coffee', 'energy_drink',
      'water_bottle', 'snack', 'bread', 'medicine', 'first_aid',
      'phone', 'laptop'
    ],
  },
 butcher: {
    id: 'butcher',
    name: '🥩 Butcher Shop',
    type: 'physical',
    desc: 'Fresh meats. Requires cooking. High protein, short shelf life.',
    openHour: 8,
    closeHour: 18,
    taxRate: 0.05,
    travelMinutes: 20,
    checkoutMinutes: 10,
    items: ['chicken_breast', 'ground_beef', 'ribeye_steak'],
  },
  bakery: {
    id: 'bakery',
    name: '🥖 Bakery',
    type: 'physical',
    desc: 'Fresh bread and pastries. Smells amazing.',
    openHour: 6,
    closeHour: 15,
    taxRate: 0.06,
    travelMinutes: 15,
    checkoutMinutes: 5,
    items: ['sourdough_loaf', 'croissant'],
  },
  pharmacy: {
    id: 'pharmacy',
    name: '💊 Pharmacy',
    type: 'physical',
    desc: 'Medicine, first aid, and prescriptions.',
    openHour: 8,
    closeHour: 21,
    taxRate: 0.07,
    travelMinutes: 25,
    checkoutMinutes: 10,
    items: ['painkillers', 'antibiotics', 'sleep_aid', 'medicine', 'first_aid'],
  },
  tech_store: {
    id: 'tech_store',
    name: '📱 Tech & Electronics',
    type: 'physical',
    desc: 'Smartphones, laptops, and gadgets.',
    openHour: 10,
    closeHour: 20,
    taxRate: 0.12,
    travelMinutes: 30,
    checkoutMinutes: 15,
    items: ['phone_budget', 'phone_flagship', 'laptop_budget', 'laptop_workstation'],
  },
  greengrocer: {
    id: 'greengrocer',
    name: '🥬 Greengrocer',
    type: 'physical',
    desc: 'Fresh fruits and vegetables.',
    openHour: 7,
    closeHour: 19,
    taxRate: 0.04,
    travelMinutes: 15,
    checkoutMinutes: 5,
    items: ['bananas', 'avocados', 'spinach'],
  },
  pawn_shop: {
    id: 'pawn_shop',
    name: '♻️ Pawn Shop',
    type: 'physical',
    desc: 'Used electronics & tools at 50% off. 5% chance an item is stolen – cops may check.',
    openHour: 10,
    closeHour: 23,
    taxRate: 0.05,
    travelMinutes: 20,
    checkoutMinutes: 5,
    discount: 0.5,             // 50% off
    stolenChance: 0.05,        // 5% chance item is hot
    items: ['phone_budget', 'laptop_budget', 'tools'],   // we'll define 'tools' later
},

bodega: {
    id: 'bodega',
    name: '🏪 24/7 Corner Store',
    type: 'physical',
    desc: 'Open all night. Sells essentials at a 20% markup.',
    openHour: 0,               // always open
    closeHour: 24,
    taxRate: 0.08,
    travelMinutes: 5,
    checkoutMinutes: 3,
    markup: 1.2,               // 20% extra on base price
    items: ['cheap_meal', 'coffee', 'energy_drink', 'water_bottle', 'snack', 'cigarettes'], // add cigarettes if desired
},

department_store: {
    id: 'department_store',
    name: '🏬 Department Store',
    type: 'physical',
    desc: 'Huge multi‑floor store. Walking between sections takes extra time.',
    openHour: 9,
    closeHour: 21,
    taxRate: 0.10,
    travelMinutes: 20,
    checkoutMinutes: 15,
    floorTravelMinutes: 10,    // extra time when browsing different categories
    items: ['phone_flagship', 'laptop_workstation', 'suit', 'cologne', 'fridge', 'stove'], // add more later
},

appliance_store: {
    id: 'appliance_store',
    name: '🧊 Appliance Store',
    type: 'physical',
    desc: 'Refrigerators, stoves, and other home appliances.',
    openHour: 9,
    closeHour: 18,
    taxRate: 0.10,
    travelMinutes: 25,
    checkoutMinutes: 20,
    items: ['fridge', 'stove'],
},
};
// Helper to get a store definition
export function getStore(id) {
  return stores[id] || null;
}

// Helper to check if a physical store is currently open
export function isStoreOpen(storeId, currentHour) {
  const store = stores[storeId];
  if (!store || store.type !== 'physical') return true;
  if (store.openHour === 0 && store.closeHour === 24) return true; // 24/7
  return currentHour >= store.openHour && currentHour < store.closeHour;
}