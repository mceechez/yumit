import { defaultProductDictionary } from '../data/productDictionary';
import { defaultAdultMeals, defaultKidMeals } from '../data/defaultMeals';

const STORAGE_KEY = 'familyBasket';

// Default state
const defaultState = {
  productDictionary: {
    numeric: { ...defaultProductDictionary.numeric },
    text: { ...defaultProductDictionary.text },
  },
  mealPreferences: {
    adults: [...defaultAdultMeals],
    kids: [...defaultKidMeals],
  },
  shoppingHistory: [],
  favouriteRecipes: [],
  lastWeekMeals: [],
  settings: {
    budgetMin: 90,
    budgetMax: 120,
    dietaryRestrictions: [],
  },
};

// Get the full state from localStorage
export function getState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultState;
    }
    const parsed = JSON.parse(stored);

    // Handle migration from old flat dictionary to new structured format
    let productDictionary = parsed.productDictionary;
    if (productDictionary && !productDictionary.numeric && !productDictionary.text) {
      // Old format - migrate to new structure
      productDictionary = {
        numeric: { ...defaultProductDictionary.numeric },
        text: { ...defaultProductDictionary.text, ...productDictionary },
      };
    }

    // Merge with defaults to ensure all keys exist
    return {
      ...defaultState,
      ...parsed,
      productDictionary: {
        numeric: {
          ...defaultProductDictionary.numeric,
          ...(productDictionary?.numeric || {}),
        },
        text: {
          ...defaultProductDictionary.text,
          ...(productDictionary?.text || {}),
        },
      },
      mealPreferences: {
        ...defaultState.mealPreferences,
        ...parsed.mealPreferences,
      },
      settings: {
        ...defaultState.settings,
        ...parsed.settings,
      },
    };
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultState;
  }
}

// Save the full state to localStorage
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
}

// Update a specific part of the state
export function updateState(key, value) {
  const state = getState();
  state[key] = value;
  return saveState(state);
}

// Product Dictionary helpers
export function getProductDictionary() {
  return getState().productDictionary;
}

// Check if code is numeric (5-6 digits)
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

// Meal Preferences helpers
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

// Shopping History helpers
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
  state.shoppingHistory.unshift(newTrip); // Add to beginning
  return saveState(state) ? newTrip : null;
}

export function getShoppingTripById(id) {
  return getShoppingHistory().find(trip => trip.id === id);
}

// Last Week's Meals helpers
export function getLastWeekMeals() {
  return getState().lastWeekMeals;
}

export function updateLastWeekMeals(meals) {
  return updateState('lastWeekMeals', meals);
}

// Settings helpers
export function getSettings() {
  return getState().settings;
}

export function updateSettings(newSettings) {
  const state = getState();
  state.settings = { ...state.settings, ...newSettings };
  return saveState(state);
}

// Calculate statistics
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
    recentScores: history.slice(0, 10).map(h => ({
      date: h.date,
      score: h.nutritionScore || 0,
    })),
    recentSpends: history.slice(0, 10).map(h => ({
      date: h.date,
      total: h.total || 0,
    })),
  };
}

// Favourite Recipes helpers
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

// Reset to defaults
export function resetToDefaults() {
  return saveState(defaultState);
}
