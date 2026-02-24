// Aldi UK store aisle categories for organizing shopping lists
export const aisleCategories = [
  {
    name: 'Fresh Produce',
    icon: '🥬',
    keywords: ['banana', 'apple', 'orange', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'lettuce', 'cucumber', 'pepper', 'garlic', 'mushroom', 'lemon', 'lime', 'avocado', 'spinach', 'cabbage', 'courgette', 'aubergine', 'celery', 'leek', 'parsnip', 'swede', 'beetroot', 'easy peelers', 'peeler', 'fruit', 'veg', 'salad', 'herb'],
  },
  {
    name: 'Meat & Fish',
    icon: '🥩',
    keywords: ['chicken', 'beef', 'pork', 'lamb', 'mince', 'steak', 'sausage', 'bacon', 'ham', 'turkey', 'salmon', 'cod', 'haddock', 'prawn', 'fish', 'fillet', 'thigh', 'breast', 'leg', 'diced', 'roast'],
  },
  {
    name: 'Dairy & Eggs',
    icon: '🥛',
    keywords: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'brie', 'margarine', 'spread', 'dairy'],
  },
  {
    name: 'Bakery',
    icon: '🍞',
    keywords: ['bread', 'roll', 'baguette', 'croissant', 'muffin', 'cake', 'pastry', 'wrap', 'pitta', 'naan', 'bagel', 'crumpet', 'pancake', 'scone', 'loaf'],
  },
  {
    name: 'Frozen',
    icon: '🧊',
    keywords: ['frozen', 'frz', 'ice', 'chips', 'pizza', 'fish fingers', 'peas', 'sweetcorn', 'ice cream'],
  },
  {
    name: 'Cupboard Staples',
    icon: '🥫',
    keywords: ['pasta', 'rice', 'noodle', 'tin', 'can', 'sauce', 'oil', 'vinegar', 'stock', 'soup', 'bean', 'lentil', 'chickpea', 'tomato', 'flour', 'sugar', 'salt', 'pepper', 'spice', 'herb', 'cereal', 'porridge', 'oat', 'honey', 'jam', 'peanut butter', 'ketchup', 'mayo', 'mustard', 'soy'],
  },
  {
    name: 'Snacks & Treats',
    icon: '🍪',
    keywords: ['crisp', 'chip', 'chocolate', 'biscuit', 'cookie', 'sweet', 'candy', 'popcorn', 'nut', 'snack', 'bar', 'treat', 'cake'],
  },
  {
    name: 'Drinks',
    icon: '🥤',
    keywords: ['juice', 'squash', 'water', 'fizzy', 'cola', 'lemonade', 'tea', 'coffee', 'drink'],
  },
];

// Categorize an item based on its name
export function categorizeItem(itemName) {
  const lowerName = itemName.toLowerCase();

  for (const category of aisleCategories) {
    for (const keyword of category.keywords) {
      if (lowerName.includes(keyword)) {
        return category.name;
      }
    }
  }

  return 'Cupboard Staples'; // Default category
}

// Get category details by name
export function getCategoryByName(name) {
  return aisleCategories.find(cat => cat.name === name) || aisleCategories[5];
}
