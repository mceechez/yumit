// Pre-seeded Aldi receipt code translations
// Primary keys are numeric product codes (5-6 digits)
// Secondary fallback uses text abbreviations

export const numericCodeDictionary = {
  '852012': 'Oranges',
  '830846': 'Chopped Tomatoes',
  '701482': 'Chicken Thigh Fillets',
  '853803': 'Frozen Coldwater Prawns',
  '832811': 'Homestyle Frozen Chips',
  '48645': 'Chocolate Pastries',
  '60464': 'Cod Fillets',
  '721630': 'Pork Shoulder Steaks',
  '735335': 'BBQ Ribs',
  '48727': 'Mackerel Fillets',
  '51029': 'Cauliflower',
  '819957': 'Broccoli',
  '830295': 'Aubergine',
  '717110': 'Onions Brown',
  '57475': 'Strawberries',
  '836859': 'Bananas',
  '834701': 'Baked Beans',
};

// Fallback text abbreviation mappings (legacy support)
export const textCodeDictionary = {
  'EASY PEELERS': 'Oranges',
  'PREM CHUNK TOM': 'Chopped Tomatoes',
  'CKN THIGH FLIS': 'Chicken Thigh Fillets',
  'FRZ CLDWATER PRAWN': 'Frozen Coldwater Prawns',
  'HOMESTYLE CHIPS': 'Frozen Chips',
  'BRIT SEMI MILK': 'Semi-Skimmed Milk',
  'FREE RNG EGGS': 'Free Range Eggs',
  'WHT SLICED BREAD': 'White Sliced Bread',
  'CHED MILD BLOCK': 'Mild Cheddar Block',
  'BASMATI RICE': 'Basmati Rice',
  'PENNE PASTA': 'Penne Pasta',
  'OLIVE OIL EV': 'Extra Virgin Olive Oil',
  'DICED BEEF': 'Diced Beef',
  'PORK MINCE': 'Pork Mince',
  'BEEF MINCE 500G': 'Beef Mince 500g',
  'SALMON FILLETS': 'Salmon Fillets',
  'BROCCOLI': 'Broccoli',
  'CARROTS 1KG': 'Carrots 1kg',
  'POTATOES WHITE': 'White Potatoes',
  'ONIONS BROWN': 'Brown Onions',
  'GARLIC BULBS': 'Garlic Bulbs',
  'BANANAS LOOSE': 'Bananas',
  'APPLES GALA': 'Gala Apples',
  'CUCUMBER': 'Cucumber',
  'TOMATOES VINE': 'Vine Tomatoes',
  'PEPPER MIXED': 'Mixed Peppers',
  'YOG NAT GREEK': 'Greek Yogurt',
  'BUTTER SALTED': 'Salted Butter',
  'CHEDDAR MATURE': 'Mature Cheddar',
  'FISH FINGERS': 'Fish Fingers',
  'GARDEN PEAS FRZ': 'Frozen Garden Peas',
  'SWEETCORN FRZ': 'Frozen Sweetcorn',
};

// Check if a code is numeric (5-6 digits)
export function isNumericCode(code) {
  return /^\d{5,6}$/.test(code?.toString().trim());
}

// Translate a receipt code to a human-readable name
// Priority: 1) Custom numeric codes, 2) Default numeric codes,
//           3) Custom text codes, 4) Default text codes, 5) Original code
export function translateCode(code, customDictionary = {}) {
  if (!code) return code;

  const cleanCode = code.toString().trim();
  const upperCode = cleanCode.toUpperCase();

  // 1. Try custom numeric codes first
  if (customDictionary.numeric && customDictionary.numeric[cleanCode]) {
    return customDictionary.numeric[cleanCode];
  }

  // 2. Try default numeric codes
  if (numericCodeDictionary[cleanCode]) {
    return numericCodeDictionary[cleanCode];
  }

  // 3. Try custom text codes
  if (customDictionary.text && customDictionary.text[upperCode]) {
    return customDictionary.text[upperCode];
  }

  // 4. Try default text codes
  if (textCodeDictionary[upperCode]) {
    return textCodeDictionary[upperCode];
  }

  // 5. Return original code if no match
  return code;
}

// Get the type of code (numeric or text)
export function getCodeType(code) {
  return isNumericCode(code) ? 'numeric' : 'text';
}
