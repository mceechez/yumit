const PROFILE_KEY = 'yumit_profile';
const API_KEY_KEY = 'yumit_api_key';
const USAGE_KEY   = 'yumit_usage';

// ─── Life stage definitions ───────────────────────────────────────────────────
export const LIFE_STAGES = {
  toddler:      { label: 'Toddler',    emoji: '👶', ageRange: 'Under 5',     portionMultiplier: 0.4  },
  'child-5-10': { label: 'Child',      emoji: '🧒', ageRange: '5 to 10',     portionMultiplier: 0.7  },
  'young-teen': { label: 'Young Teen', emoji: '🧑', ageRange: '11 to 16',    portionMultiplier: 1.0  },
  adult:        { label: 'Adult',      emoji: '👤', ageRange: '17 to 64',    portionMultiplier: 1.0  },
  senior:       { label: 'Senior',     emoji: '🧓', ageRange: '65 and over', portionMultiplier: 0.85 },
};

export const SUPERMARKETS = [
  'Aldi', 'Lidl', 'Tesco', "Sainsbury's", 'Waitrose',
  'M&S', 'Asda', 'Morrisons', 'Ocado', 'Other',
];

export const ADULT_NOTES_OPTIONS = [
  { value: 'vegetarian',    label: 'Vegetarian'    },
  { value: 'vegan',         label: 'Vegan'         },
  { value: 'pregnant',      label: 'Pregnant'      },
  { value: 'breastfeeding', label: 'Breastfeeding' },
];

// ─── The 14 NHS declared allergens ───────────────────────────────────────────
export const ALLERGENS = [
  { value: 'gluten',     label: 'Gluten',     icon: '🌾', description: 'Wheat, barley, rye, oats' },
  { value: 'dairy',      label: 'Dairy',      icon: '🥛', description: 'Milk and dairy products' },
  { value: 'eggs',       label: 'Eggs',       icon: '🥚', description: 'Eggs and egg products' },
  { value: 'peanuts',    label: 'Peanuts',    icon: '🥜', description: 'Peanuts and peanut products' },
  { value: 'tree-nuts',  label: 'Tree Nuts',  icon: '🌰', description: 'Almonds, cashews, walnuts, etc.' },
  { value: 'soya',       label: 'Soya',       icon: '🫘', description: 'Soya and soya products' },
  { value: 'fish',       label: 'Fish',       icon: '🐟', description: 'Fish and fish products' },
  { value: 'shellfish',  label: 'Shellfish',  icon: '🦐', description: 'Crustaceans and shellfish' },
  { value: 'sesame',     label: 'Sesame',     icon: '🌱', description: 'Seeds and sesame oil' },
  { value: 'celery',     label: 'Celery',     icon: '🥬', description: 'Celery and celeriac' },
  { value: 'mustard',    label: 'Mustard',    icon: '🌻', description: 'Mustard and mustard products' },
  { value: 'lupin',      label: 'Lupin',      icon: '🌿', description: 'Lupin seeds and flour' },
  { value: 'molluscs',   label: 'Molluscs',   icon: '🐚', description: 'Squid, mussels, oysters, etc.' },
  { value: 'sulphites',  label: 'Sulphites',  icon: '🍷', description: 'Sulphur dioxide ≥10ppm' },
];

// ─── Dietary preferences ──────────────────────────────────────────────────────
export const DIETARY_PREFERENCES = [
  { value: 'vegetarian',       label: 'Vegetarian',       icon: '🥗' },
  { value: 'vegan',            label: 'Vegan',            icon: '🌱' },
  { value: 'halal',            label: 'Halal',            icon: '☪️'  },
  { value: 'kosher',           label: 'Kosher',           icon: '✡️'  },
  { value: 'low-fodmap',       label: 'Low FODMAP',       icon: '🫁' },
  { value: 'diabetic-friendly',label: 'Diabetic Friendly',icon: '🩺' },
  { value: 'low-sodium',       label: 'Low Sodium',       icon: '🧂' },
  { value: 'low-cholesterol',  label: 'Low Cholesterol',  icon: '❤️' },
];

// ─── Intolerances (separate from allergies) ───────────────────────────────────
export const INTOLERANCES = [
  { value: 'lactose',   label: 'Lactose Intolerant',   icon: '🥛' },
  { value: 'fructose',  label: 'Fructose Intolerant',  icon: '🍎' },
  { value: 'histamine', label: 'Histamine Intolerant', icon: '🤧' },
];

/**
 * Returns a flat list of all allergen/preference/intolerance values
 * across the entire household, deduplicated. Used for AI prompting.
 */
export function getHouseholdDietaryFlags(members) {
  const allergens = new Set();
  const dietary = new Set();
  const intolerances = new Set();
  (members || []).forEach(m => {
    (m.allergens || []).forEach(a => allergens.add(a));
    (m.dietaryPreferences || []).forEach(d => dietary.add(d));
    // Also include notes-based preferences for backward compatibility
    (m.notes || []).forEach(n => {
      if (n === 'vegetarian' || n === 'vegan') dietary.add(n);
    });
    (m.intolerances || []).forEach(i => intolerances.add(i));
  });
  return {
    allergens: [...allergens],
    dietary: [...dietary],
    intolerances: [...intolerances],
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export function getProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

// ─── API Key ──────────────────────────────────────────────────────────────────
export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || null;
}

export function saveApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(API_KEY_KEY, key.trim());
  } else {
    localStorage.removeItem(API_KEY_KEY);
  }
}

export function removeApiKey() {
  localStorage.removeItem(API_KEY_KEY);
}

// ─── Usage counter ───────────────────────────────────────────────────────────
const defaultUsage = () => ({
  totalScans: 0,
  firstScanDate: null,
  nudgeShown: false,
  lastNudgeScan: 0,
});

export function getUsage() {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    return stored ? { ...defaultUsage(), ...JSON.parse(stored) } : defaultUsage();
  } catch {
    return defaultUsage();
  }
}

function saveUsage(usage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch { /* silent */ }
}

export function incrementScanCount() {
  const usage = getUsage();
  usage.totalScans += 1;
  if (!usage.firstScanDate) {
    usage.firstScanDate = new Date().toISOString().split('T')[0];
  }
  saveUsage(usage);
  return usage;
}

export function markNudgeShown() {
  const usage = getUsage();
  usage.nudgeShown = true;
  usage.lastNudgeScan = usage.totalScans;
  saveUsage(usage);
}

/**
 * Returns 'modal' on scan 10 (first nudge), 'banner' every 10 after that,
 * or false when the user has their own key or conditions aren't met.
 */
export function shouldShowNudge(apiKey) {
  if (apiKey) return false;
  const { totalScans, nudgeShown, lastNudgeScan } = getUsage();
  if (totalScans === 10 && !nudgeShown) return 'modal';
  if (totalScans > 10 && totalScans % 10 === 0 && totalScans !== lastNudgeScan) return 'banner';
  return false;
}

// ─── Portion helpers ─────────────────────────────────────────────────────────
/**
 * Calculates the total portion count for a family over `days` days,
 * using per-life-stage portion multipliers.
 */
export function calculateTotalPortions(members, days = 1) {
  const raw = (members || []).reduce((sum, m) => {
    const stage = LIFE_STAGES[m.lifeStage];
    return sum + (stage ? stage.portionMultiplier : 1.0);
  }, 0);
  return Math.ceil(raw * days);
}
