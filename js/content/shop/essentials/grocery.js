// js/content/shop/essentials/grocery.js – Grocery & Essentials Items
// Basic consumables: food, drink, and daily necessities.

export const groceryItems = [
  // ----- FOOD ITEMS -----
  {
    id: 'cheap_meal',
    name: 'Cheap Meal',
    desc: 'Restores 30 hunger. Consecutive use causes malnutrition debuff.',
    icon: '🍜',
    price: 5,
    category: 'Essentials',
    effectType: 'hunger',
    value: 30,
    permanent: false,
    weightKg: 0.3,
    isPerishable: true,
    shelfLifeDays: 3, // Spoils quickly as a prepared cheap meal
  },
  {
    id: 'restaurant_meal',
    name: 'Restaurant Meal',
    desc: 'Restores 60 hunger and +10 morale. Psychological boost.',
    icon: '🥩',
    price: 18,
    category: 'Essentials',
    effectType: 'hunger_morale',
    value: 60,
    moraleBoost: 10,
    permanent: false,
    weightKg: 0.5, // Heavier portion with sides
    isPerishable: true,
    shelfLifeDays: 1, // Must be eaten fresh or leftovers spoil by tomorrow
  },

  // ----- DRINK ITEMS -----
  {
    id: 'coffee',
    name: 'Coffee',
    desc: '+15 energy now. Energy crash -5 next day.',
    icon: '☕',
    price: 2,
    category: 'Essentials',
    effectType: 'energy',
    value: 15,
    caffeineDays: 5,
    permanent: false,
    weightKg: 0.25, // Standard cup size (~250ml)
    isPerishable: true,
    shelfLifeDays: 1, // Goes cold/stale within a day
  },
  {
    id: 'energy_drink',
    name: 'Energy Drink',
    desc: '+25 energy now. Energy crash -8 next day.',
    icon: '⚡',
    price: 3,
    category: 'Essentials',
    effectType: 'energy',
    value: 25,
    caffeineDays: 8,
    permanent: false,
    weightKg: 0.35, // Typical 355ml can
    isPerishable: false, // Sealed canned good
    shelfLifeDays: 365,
  },

  // ----- BASIC ITEMS -----
  {
    id: 'water_bottle',
    name: 'Water Bottle',
    desc: '+10 energy, +5 hunger. Stay hydrated.',
    icon: '💧',
    price: 1,
    category: 'Essentials',
    effectType: 'energy',
    value: 10,
    permanent: false,
    weightKg: 0.5, // Standard 500ml water bottle
    isPerishable: false,
    shelfLifeDays: 730, // Long shelf life for sealed water
  },
  {
    id: 'snack',
    name: 'Snack Bar',
    desc: '+15 hunger, cheap and quick.',
    icon: '🍫',
    price: 2,
    category: 'Essentials',
    effectType: 'hunger',
    value: 15,
    permanent: false,
    weightKg: 0.05, // Lightweight protein/candy bar
    isPerishable: false,
    shelfLifeDays: 180, // Highly processed, lasts months
  },
  {
    id: 'bread',
    name: 'Loaf of Bread',
    desc: '+40 hunger. A staple.',
    icon: '🍞',
    price: 4,
    category: 'Essentials',
    effectType: 'hunger',
    value: 40,
    permanent: false,
    weightKg: 0.5, // Standard sandwich loaf
    isPerishable: true,
    shelfLifeDays: 7, // Goes moldy in a week
  },

  // ----- HEALTH & WELLNESS (also in essentials) -----
  {
    id: 'medicine',
    name: 'Medicine',
    desc: '+20 health. Essential for recovery.',
    icon: '💊',
    price: 8,
    category: 'Essentials',
    effectType: 'health',
    value: 20,
    permanent: false,
    weightKg: 0.05, // Light pill bottle
    isPerishable: false,
    shelfLifeDays: 730, // Expires far out
  },
  {
    id: 'first_aid',
    name: 'First Aid Kit',
    desc: '+30 health. Stronger than basic medicine.',
    icon: '🩹',
    price: 15,
    category: 'Essentials',
    effectType: 'health',
    value: 30,
    permanent: false,
    weightKg: 0.4, // Bulkier box with bandages/antiseptics
    isPerishable: false,
    shelfLifeDays: 1095, // Lasts years
  },
  {
  id: 'suit',
  name: 'Tailored Suit',
  desc: 'Required for office jobs. High social status.',
  icon: '👔',
  price: 450,
  category: 'Apparel',
  effectType: 'inventory',
  inventoryId: 'suit',
  weightKg: 1.0,
  isPerishable: false,
  shelfLifeDays: 0,
  permanent: true,
},
{
  id: 'cologne',
  name: 'Premium Cologne',
  desc: 'Overrides low hygiene penalties for 12 hours.',
  icon: '✨',
  price: 65,
  category: 'Apparel',
  effectType: 'cologne',
  buffDuration: 12,
  weightKg: 0.2,
  isPerishable: false,
  shelfLifeDays: 0,
  permanent: false,
},
{
  id: 'tools',
  name: 'Basic Toolset',
  desc: 'Allows you to repair your own appliances or laptop.',
  icon: '🔧',
  price: 45,
  category: 'Gear',
  effectType: 'inventory',
  inventoryId: 'tools',
  weightKg: 2.0,
  isPerishable: false,
  shelfLifeDays: 0,
  permanent: true,
},

  // ----- SERVICES (one-time) & HARDWARE -----
  {
    id: 'gym_session',
    name: 'Gym Session',
    desc: '+15 health, +10 morale, -10 stress. Stay fit.',
    icon: '🏋️',
    price: 15,
    category: 'Essentials',
    effectType: 'gym',
    permanent: false,
    weightKg: 0.0, // Service, doesn't sit in inventory
    isPerishable: false,
    shelfLifeDays: 0,
  },
  {
    id: 'therapy',
    name: 'Therapy Session',
    desc: '-30 stress, +20 morale. Emergency mental reset.',
    icon: '🧠',
    price: 40,
    category: 'Essentials',
    effectType: 'therapy',
    permanent: false,
    weightKg: 0.0, // Service
    isPerishable: false,
    shelfLifeDays: 0,
  },
  {
    id: 'phone',
    name: 'Smartphone',
    desc: 'A basic smartphone. Required for delivery jobs.',
    icon: '📱',
    price: 100,
    category: 'Essentials',
    effectType: 'inventory',
    inventoryId: 'phone',
    permanent: true,
    weightKg: 0.2, // Physical hardware weight
    isPerishable: false,
    shelfLifeDays: 0, // Electronics do not spoil
  },
  {
    id: 'shower',
    name: 'Shower',
    desc: '15 min shower. +40 hygiene, minor fatigue refresh.',
    icon: '🚿',
    price: 0,
    category: 'Services',
    effectType: 'shower',
    permanent: false,
    weightKg: 0.0, // Service
    isPerishable: false,
    shelfLifeDays: 0,
  },
];