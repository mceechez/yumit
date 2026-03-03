// ─── Receipt Normalisation Layer ─────────────────────────────────────────────
// Deterministic name cleaning that runs after AI extraction and before dictionary
// matching. Not an AI call — purely code-based find-and-replace + formatting.
// Extend ABBREVIATION_EXPANSIONS as new abbreviations appear in user scans.

export const ABBREVIATION_EXPANSIONS = {
  // Meat & poultry
  'CHCKN': 'Chicken',
  'CKN': 'Chicken',
  'THGH': 'Thigh',
  'THGHS': 'Thighs',
  'BRST': 'Breast',
  'BSTS': 'Breasts',
  'FLTS': 'Fillets',
  'FLLTS': 'Fillets',
  'SMKD': 'Smoked',

  // Dairy
  'CHSE': 'Cheese',
  'YGRT': 'Yoghurt',
  'YGHRT': 'Yoghurt',
  'MLK': 'Milk',
  'MLKCHOC': 'Milk Chocolate',

  // Fruit & veg
  'STRWBRRY': 'Strawberry',
  'BLBRRY': 'Blueberry',
  'CHRY': 'Cherry',
  'SPNCH': 'Spinach',
  'PRWN': 'Prawn',
  'PRWNS': 'Prawns',
  'TOM': 'Tomato',
  'TOMTO': 'Tomato',

  // Preparation / product descriptors
  'BRKFST': 'Breakfast',
  'RSTD': 'Roasted',
  'WHL': 'Whole',
  'WHLE': 'Whole',
  'FRZ': 'Frozen',
  'FRZN': 'Frozen',
  'ORG': 'Organic',
  'ORGC': 'Organic',
  'PREM': 'Premium',
  'SLCD': 'Sliced',
  'CHPS': 'Chips',
  'CHOC': 'Chocolate',
  'CLDFTR': 'Coldwater',
  'HMSTYL': 'Homestyle',
  'CRKRS': 'Crackers',
  'SPNGE': 'Sponge',

  // Qualifiers
  'F/RANGE': 'Free Range',
  'VEG': 'Vegetable',
};

// Store brand prefixes to strip when they appear as a standalone leading word
const STORE_BRAND_PREFIXES = [
  'tesco', 'asda', 'sainsbury\'s', 'sainsburys', 'waitrose', 'ocado', 'm&s',
];

/**
 * Normalise a raw extracted item name from a receipt.
 * Returns { name: string, low_confidence: boolean }.
 * This is a deterministic function — no AI, no network calls.
 */
export function normaliseItemName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return { name: rawName || '', low_confidence: true };
  }

  let name = rawName.trim();

  // 1. Whole-word, case-insensitive abbreviation expansion
  for (const [abbrev, expansion] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    // Escape special regex chars in the abbreviation key
    const escaped = abbrev.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    name = name.replace(regex, expansion);
  }

  // 2. Title-case every word
  name = name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // 3. Remove trailing duplicate weight/volume (e.g. "400g 400g" → "400g")
  name = name.replace(/(\d+\s*(?:g|ml|kg|l|oz|lb))\s+\1/gi, '$1');

  // 4. Strip leading standalone store brand prefix
  const words = name.split(/\s+/);
  if (words.length > 1 && STORE_BRAND_PREFIXES.includes(words[0].toLowerCase())) {
    name = words.slice(1).join(' ');
  }

  // 5. Flag very short names as low confidence
  const low_confidence = name.replace(/\s/g, '').length < 3;

  return { name, low_confidence };
}
