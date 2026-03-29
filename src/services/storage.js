// ─── localStorage keys ────────────────────────────────────────────────────────
const KEY_MEALS       = 'yumit_meals';       // mealPreferences + favouriteRecipes + lastWeekMeals
const KEY_DICTIONARY  = 'yumit_dictionary';  // user's custom product-code translations
const KEY_HISTORY     = 'yumit_history';     // shopping trips
const KEY_SETTINGS    = 'yumit_settings';    // budget, dietary restrictions
const KEY_INITIALISED = 'yumit_initialised'; // first-run flag

// The old monolithic key — kept only for migration
const LEGACY_KEY = 'familyBasket';

// ─── Blank defaults (no pre-seeded data) ──────────────────────────────────────
const DEFAULT_MEALS = {
  mealPreferences: { adults: [], kids: [] },
  favouriteRecipes: [],
  lastWeekMeals: [],
};

const DEFAULT_DICTIONARY = { numeric: {}, text: {} };

const DEFAULT_SETTINGS = {
  budgetMin: 90,
  budgetMax: 120,
  dietaryRestrictions: [],
};

// ─── Safe read/write helpers ──────────────────────────────────────────────────
function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ─── First-run detection ──────────────────────────────────────────────────────

export function isInitialised() {
  return !!localStorage.getItem(KEY_INITIALISED);
}

export function setInitialised() {
  localStorage.setItem(KEY_INITIALISED, 'true');
}

/**
 * Call once at app startup (before rendering).
 *
 * 1. If yumit_initialised already exists → nothing to do.
 * 2. If any existing-user data is found → mark as initialised (migration).
 * 3. If a legacy familyBasket key exists → migrate its data to the new
 *    individual yumit_* keys, then delete the old key.
 *
 * New users (no data, no legacy key) are left untouched so they see the
 * clean onboarding flow with empty meal and dictionary defaults.
 */
export function runStartupMigration() {
  if (isInitialised()) return;

  // Detect any existing user data (new keys or legacy key)
  const hasExistingData =
    localStorage.getItem('yumit_profile')   ||
    localStorage.getItem(KEY_MEALS)         ||
    localStorage.getItem(KEY_DICTIONARY)    ||
    localStorage.getItem(KEY_HISTORY)       ||
    localStorage.getItem(LEGACY_KEY);

  if (hasExistingData) {
    setInitialised();
  }

  // Migrate data from the old familyBasket key to the new yumit_* keys
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);

      if (!localStorage.getItem(KEY_MEALS)) {
        writeKey(KEY_MEALS, {
          mealPreferences: parsed.mealPreferences || DEFAULT_MEALS.mealPreferences,
          favouriteRecipes: parsed.favouriteRecipes || [],
          lastWeekMeals: parsed.lastWeekMeals || [],
        });
      }

      if (!localStorage.getItem(KEY_DICTIONARY)) {
        // Preserve the user's full dictionary (may include previously-seeded defaults —
        // that's fine, existing users keep whatever they had)
        writeKey(KEY_DICTIONARY, parsed.productDictionary || DEFAULT_DICTIONARY);
      }

      if (!localStorage.getItem(KEY_HISTORY)) {
        writeKey(KEY_HISTORY, parsed.shoppingHistory || []);
      }

      if (!localStorage.getItem(KEY_SETTINGS)) {
        writeKey(KEY_SETTINGS, parsed.settings || {});
      }

      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {
      console.error('Yumit: failed to migrate legacy storage', e);
    }
  }
}

// ─── Core state read / write ──────────────────────────────────────────────────

export function getState() {
  const meals      = readKey(KEY_MEALS,      DEFAULT_MEALS);
  const dictionary = readKey(KEY_DICTIONARY, DEFAULT_DICTIONARY);
  const history    = readKey(KEY_HISTORY,    []);
  const settings   = readKey(KEY_SETTINGS,   DEFAULT_SETTINGS);

  return {
    productDictionary: {
      numeric: dictionary.numeric || {},
      text:    dictionary.text    || {},
    },
    mealPreferences: {
      ...DEFAULT_MEALS.mealPreferences,
      ...meals.mealPreferences,
    },
    favouriteRecipes: meals.favouriteRecipes || [],
    lastWeekMeals:    meals.lastWeekMeals    || [],
    shoppingHistory:  Array.isArray(history) ? history : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
    },
  };
}

export function saveState(state) {
  writeKey(KEY_MEALS, {
    mealPreferences: state.mealPreferences  || DEFAULT_MEALS.mealPreferences,
    favouriteRecipes: state.favouriteRecipes || [],
    lastWeekMeals:    state.lastWeekMeals    || [],
  });
  writeKey(KEY_DICTIONARY, state.productDictionary || DEFAULT_DICTIONARY);
  writeKey(KEY_HISTORY,    state.shoppingHistory   || []);
  writeKey(KEY_SETTINGS,   state.settings          || DEFAULT_SETTINGS);
  return true;
}

export function updateState(key, value) {
  const state = getState();
  state[key] = value;
  return saveState(state);
}

// ─── Product Dictionary ───────────────────────────────────────────────────────

export function getProductDictionary() {
  return getState().productDictionary;
}

function isNumericCode(code) {
  return /^\d{5,6}$/.test(code?.toString().trim());
}

export function addProductTranslation(code, name) {
  const state = getState();
  const cleanCode = code.toString().trim();
  if (isNumericCode(cleanCode)) {
    state.productDictionary.numeric[cleanCode] = name;
  } else {
    state.productDictionary.text[cleanCode.toUpperCase()] = name;
  }
  return saveState(state);
}

export function removeProductTranslation(code) {
  const state = getState();
  const cleanCode = code.toString().trim();
  if (isNumericCode(cleanCode)) {
    delete state.productDictionary.numeric[cleanCode];
  } else {
    delete state.productDictionary.text[cleanCode.toUpperCase()];
  }
  return saveState(state);
}

// ─── Meal Preferences ─────────────────────────────────────────────────────────

export function getMealPreferences() {
  return getState().mealPreferences;
}

export function updateMealPreferences(type, meals) {
  const state = getState();
  state.mealPreferences[type] = meals;
  return saveState(state);
}

export function addMeal(type, meal) {
  const state = getState();
  if (!state.mealPreferences[type].includes(meal)) {
    state.mealPreferences[type].push(meal);
    return saveState(state);
  }
  return false;
}

export function removeMeal(type, meal) {
  const state = getState();
  state.mealPreferences[type] = state.mealPreferences[type].filter(m => m !== meal);
  return saveState(state);
}

// ─── Shopping History ─────────────────────────────────────────────────────────

export function getShoppingHistory() {
  return getState().shoppingHistory;
}

export function addShoppingTrip(trip) {
  const state = getState();
  const newTrip = {
    id: crypto.randomUUID(),
    date: new Date().toISOString().split('T')[0],
    ...trip,
  };
  state.shoppingHistory.unshift(newTrip);
  return saveState(state) ? newTrip : null;
}

export function getShoppingTripById(id) {
  return getShoppingHistory().find(trip => trip.id === id);
}

// ─── Last Week's Meals ────────────────────────────────────────────────────────

export function getLastWeekMeals() {
  return getState().lastWeekMeals;
}

export function updateLastWeekMeals(meals) {
  return updateState('lastWeekMeals', meals);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings() {
  return getState().settings;
}

export function updateSettings(newSettings) {
  const state = getState();
  state.settings = { ...state.settings, ...newSettings };
  return saveState(state);
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function getStatistics() {
  const history = getShoppingHistory();

  if (history.length === 0) {
    return {
      averageSpend: 0,
      averageNutritionScore: 0,
      totalShops: 0,
      recentScores: [],
      recentSpends: [],
    };
  }

  const totals = history.map(h => h.total || 0);
  const scores = history.map(h => h.nutritionScore || 0);

  return {
    averageSpend: totals.reduce((a, b) => a + b, 0) / totals.length,
    averageNutritionScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    totalShops: history.length,
    recentScores: history.slice(0, 10).map(h => ({ date: h.date, score: h.nutritionScore || 0 })),
    recentSpends: history.slice(0, 10).map(h => ({ date: h.date, total: h.total || 0 })),
  };
}

// ─── Favourite Recipes ────────────────────────────────────────────────────────

export function getFavouriteRecipes() {
  return getState().favouriteRecipes || [];
}

export function saveFavouriteRecipe(recipe) {
  const state = getState();
  if (!state.favouriteRecipes) state.favouriteRecipes = [];
  const newRecipe = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...recipe,
  };
  state.favouriteRecipes.unshift(newRecipe);
  return saveState(state) ? newRecipe : null;
}

export function removeFavouriteRecipe(id) {
  const state = getState();
  state.favouriteRecipes = (state.favouriteRecipes || []).filter(r => r.id !== id);
  return saveState(state);
}

export function updateFavouriteRecipe(id, updates) {
  const state = getState();
  state.favouriteRecipes = (state.favouriteRecipes || []).map(r =>
    r.id === id ? { ...r, ...updates } : r
  );
  return saveState(state);
}

// ─── Meal Ratings Cache ────────────────────────────────────────────────────────
// Stored independently so it never gets wiped by data reset.

export function getMealRatings() {
  try {
    const raw = localStorage.getItem('yumit_meal_ratings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMealRatings(ratings) {
  try {
    localStorage.setItem('yumit_meal_ratings', JSON.stringify({
      ratings,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* quota exceeded — silently skip */ }
}

// ─── Saved Shopping Lists ──────────────────────────────────────────────────────

export function getSavedShoppingLists() {
  try {
    const raw = localStorage.getItem('yumit_shopping_lists');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShoppingList(list) {
  try {
    const lists = getSavedShoppingLists();
    const newList = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      ...list,
    };
    lists.unshift(newList);
    localStorage.setItem('yumit_shopping_lists', JSON.stringify(lists.slice(0, 20)));
    return newList;
  } catch {
    return null;
  }
}

// ─── Extraction Noise Log ─────────────────────────────────────────────────────

export function logExtractionNoise(rawText) {
  try {
    const raw = localStorage.getItem('yumit_extraction_noise');
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ text: rawText, date: new Date().toISOString() });
    localStorage.setItem('yumit_extraction_noise', JSON.stringify(log.slice(0, 200)));
  } catch { /* quota exceeded — silently skip */ }
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetToDefaults() {
  localStorage.removeItem(KEY_MEALS);
  localStorage.removeItem(KEY_DICTIONARY);
  localStorage.removeItem(KEY_HISTORY);
  localStorage.removeItem(KEY_SETTINGS);
  // KEY_INITIALISED intentionally kept: the user has been through onboarding,
  // resetting data doesn't make them a new user.
  return true;
}
