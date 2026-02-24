// Claude API service — calls backend proxy endpoints
import { getApiKey, getProfile } from './profile';
import { buildSystemPrompt } from '../utils/systemPrompt';

const API_BASE = '/api/claude';

// Generic fetch wrapper — injects API key header and system prompt on every call
async function apiCall(endpoint, data) {
  const apiKey      = getApiKey();
  const profile     = getProfile();
  const systemPrompt = buildSystemPrompt(profile);

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, systemPrompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error(`API error (${endpoint}):`, error);
    throw error;
  }
}

// Parse a receipt image
export async function parseReceipt(imageBase64, mediaType = 'image/jpeg') {
  return apiCall('/parse-receipt', { image: imageBase64, mediaType });
}

// Analyze nutrition of shopping basket
export async function analyzeNutrition(items) {
  return apiCall('/analyze-nutrition', { items });
}

// Generate batch cooking recipes
export async function generateBatchCooking(items) {
  return apiCall('/batch-cooking', { items });
}

// Get smart swap suggestions
export async function getSmartSwaps(items) {
  return apiCall('/smart-swaps', { items });
}

// Generate shopping list from meal preferences
export async function generateShoppingList(options) {
  return apiCall('/generate-shopping-list', options);
}

// Import a recipe from a URL or pasted text
export async function importRecipe(url, pastedText) {
  return apiCall('/import-recipe', { url, pastedText });
}

// Check API health
export async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch {
    return false;
  }
}
