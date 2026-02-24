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
