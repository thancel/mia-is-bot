/**
 * economyItems.js - Shared shop items for economy system
 */
const FISHING_DATA = require('../data/fishing.json');

const SHOP_ITEMS = [
  // ATMs (Page 2)
  { id: 'atm_basic', name: '💳 Basic ATM Card', price: 20000, description: 'Increases bank deposit limit to $100,000.', stackable: false },
  { id: 'atm_gold', name: '💳 Gold ATM Card', price: 75000, description: 'Increases bank deposit limit to $500,000.', stackable: false },
  { id: 'atm_platinum', name: '💳 Platinum ATM Card', price: 250000, description: 'Increases bank deposit limit to $10,000,000.', stackable: false },
  { id: 'atm_black', name: '💳 Black ATM Card', price: 1000000, description: 'Increases bank deposit limit to $100,000,000.', stackable: false },
  
  // Consumables (Page 1)
  { id: 'lucky_potion', name: '🧪 Lucky Potion', price: 25000, description: 'Increases gambling luck for 15 minutes.', stackable: true },
  { id: 'coffee', name: '☕ Hot Coffee', price: 15000, description: 'Reduces fishing delay to 7.5s for 30 minutes.', stackable: true },
  
  // Luxury (Page 1)
  { id: 'diamond_ring', name: '💍 Diamond Ring', price: 5000, description: 'A symbol of wealth and status.', stackable: true },
  { id: 'rolex', name: '⌚ Luxury Watch', price: 8000, description: 'A high-end timepiece for elite earners.', stackable: true },
  { id: 'sports_car', name: '🏎️ Sports Car', price: 50000, description: 'Fast, loud, and very expensive.', stackable: true },
  { id: 'mansion', name: '🏰 Private Mansion', price: 500000, description: 'The ultimate achievement for a billionaire.', stackable: true },
  
  // Fishing Equipment (Page 3)
  { 
    id: 'rod_standard', 
    name: `🎣 ${FISHING_DATA.equipment.rod.name}`, 
    price: FISHING_DATA.equipment.rod.price, 
    description: FISHING_DATA.equipment.rod.description, 
    stackable: false, 
    category: 'Fishing' 
  },
  { 
    id: 'bait_legends', 
    name: `🍱 ${FISHING_DATA.equipment.baits[1].name}`, 
    price: FISHING_DATA.equipment.baits[1].price, 
    description: FISHING_DATA.equipment.baits[1].description, 
    stackable: true, 
    category: 'Fishing' 
  }
];

module.exports = { SHOP_ITEMS };
