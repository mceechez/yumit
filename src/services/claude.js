// Claude API service — all requests go through /api/claude (Vercel serverless proxy).
// The Anthropic API key is never exposed to the browser.
// TESTING: per-user API key is disabled. The server uses process.env.ANTHROPIC_API_KEY for all calls.
// To restore per-user keys: re-add `getApiKey` to the import below and pass an Authorization
// header in claudeCall and importRecipe when a key is present.
import { getProfile, calculateTotalPortions } from './profile';
import { buildSystemPrompt } from '../utils/systemPrompt';

// Scales a numeric amount string by factor. Leaves non-numeric values (e.g. "a handful") unchanged.
function scaleAmount(amountStr, factor) {
  if (!amountStr || factor === 1) return amountStr;
  const num = parseFloat(amountStr);
  if (isNaN(num)) return amountStr;
  const scaled = num * factor;
  if (scaled === Math.floor(scaled)) return String(Math.floor(scaled));
  return String(Math.round(scaled * 10) / 10);
}

const MODEL = 'claude-sonnet-4-20250514';

// Extracts JSON from Claude's response text with several fallback strategies.
function parseJson(text) {
  // 1. Direct parse
  try { return JSON.parse(text); } catch {}

  // 2. Extract from markdown code block, with and without trailing-comma fix
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
    try { return JSON.parse(codeBlock[1].trim().replace(/,\s*([}\]])/g, '$1')); } catch {}
  }

  // 3. Find outermost { } block, with and without trailing-comma fix
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
    try { return JSON.parse(objMatch[0].replace(/,\s*([}\]])/g, '$1')); } catch {}
  }

  throw new Error('Could not read the response from Claude. Please try again.');
}

// Call /api/claude, parse the JSON response, and retry the full API call once if parsing fails.
async function claudeCallParsed(payload) {
  const text = await claudeCall(payload);
  try {
    return parseJson(text);
  } catch {
    // First parse failed — retry the API call before giving up
    const retryText = await claudeCall(payload);
    return parseJson(retryText);
  }
}

// POST a full Anthropic messages payload to /api/claude and return Claude's text response.
async function claudeCall(payload) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }

  if (!res.ok) {
    const msg = data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error('Claude returned an empty response. Please try again.');
  }
  return text;
}

// ─── Parse a receipt image ────────────────────────────────────────────────────
export async function parseReceipt(imageBase64, mediaType = 'image/jpeg') {
  const profile = getProfile();
  const system = buildSystemPrompt(profile);

  const imageContent = {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: imageBase64 },
  };

  const extractionPrompt = `Analyze this receipt image and extract all items with their prices.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "code": "NUMERIC_OR_TEXT_CODE",
      "name": "Human readable name if determinable, otherwise same as code",
      "quantity": 1,
      "price": 0.00,
      "nonFood": false
    }
  ],
  "total": 0.00,
  "date": "YYYY-MM-DD or null if not visible",
  "store": "Store name/location if visible"
}

IMPORTANT — Code extraction priority:
1. FIRST look for 5-6 digit NUMERIC product codes (e.g., "852012", "830846", "701482")
   - These appear as standalone numbers near the product description
   - Numeric codes are the PRIMARY identifier — always include when visible
2. If no numeric code is visible, use the TEXT abbreviation (e.g., "CKN THIGH FLIS")
3. Include BOTH if both are visible (use numeric as the code, text as the name)

Non-food detection:
- Set nonFood: true for cleaning products, toiletries, pet food, candles, batteries, clothing, and similar non-edible items
- Set nonFood: false for all food and drink items

Other requirements:
- Include ALL items, even if you're unsure what they are
- Prices should be numbers (not strings)
- Return ONLY the JSON object, no other text`;

  const result = await claudeCallParsed({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: [imageContent, { type: 'text', text: extractionPrompt }] }],
  });

  // Long receipt: if 40+ items were found, make a second pass to catch any that were missed.
  if (result.items?.length >= 40) {
    const knownCodes = result.items.map(i => i.code).join(', ');
    try {
      const supplement = await claudeCallParsed({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `These items have already been extracted from this receipt:
${knownCodes}

Look for any remaining items NOT in this list — items that may appear lower down or were missed on the first pass.

Return a JSON object:
{
  "items": [...any missed items only, using the same structure as before...],
  "total": null
}

If no items were missed, return: {"items": [], "total": null}
Return ONLY the JSON object.`,
            },
          ],
        }],
      });
      if (supplement.items?.length > 0) {
        result.items = [...result.items, ...supplement.items];
      }
    } catch {
      // Second pass failed — proceed with what we have
    }
  }

  return result;
}

// ─── Analyze nutrition of shopping basket ─────────────────────────────────────
export async function analyzeNutrition(items) {
  const profile = getProfile();
  const foodItems = items.filter(i => !i.nonFood);
  return claudeCallParsed({
    model: MODEL,
    max_tokens: 1500,
    system: buildSystemPrompt(profile),
    messages: [{
      role: 'user',
      content: `Analyze the nutritional quality of this shopping basket for the household described in your system prompt.

Shopping items:
${foodItems.map(item => `- ${item.name || item.code} (£${item.price})`).join('\n')}

Provide a JSON response:
{
  "score": 75,
  "grade": "B",
  "positives": ["Good protein variety with chicken and fish"],
  "flags": ["High proportion of processed items"],
  "gaps": ["Leafy greens", "Whole grains"],
  "summary": "Brief 1-2 sentence summary tailored to this household"
}

Scoring: 80-100 (A) excellent, 60-79 (B) good, 40-59 (C) needs improvement, below 40 (D) poor.
Tailor the flags and gaps specifically to the household's composition if provided.
Return ONLY the JSON object.`,
    }],
  });
}

// ─── Generate batch cooking recipes ──────────────────────────────────────────
export async function generateBatchCooking(items) {
  const profile = getProfile();
  return claudeCallParsed({
    model: MODEL,
    max_tokens: 2500,
    system: buildSystemPrompt(profile),
    messages: [{
      role: 'user',
      content: `Create 2 batch cooking recipes using these ingredients.
Scale each recipe to the household size and batch duration from the system prompt.
Each recipe should be practical for the ages present in the household.

Available ingredients:
${items.map(item => `- ${item.name || item.code}`).join('\n')}

Return a JSON response:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "servings": 8,
      "prepTime": "20 mins",
      "cookTime": "45 mins",
      "ingredients": [
        { "item": "Ingredient name", "amount": "500g", "fromShop": true }
      ],
      "instructions": ["Step 1", "Step 2"],
      "tips": ["Storage tip", "Reheating tip"],
      "kidFriendlyRating": 5
    }
  ]
}

Make recipes that work for the household ages — familiar UK meals, kid-friendly where children are present.
Return ONLY the JSON object.`,
    }],
  });
}

// ─── Smart swap suggestions ───────────────────────────────────────────────────
export async function getSmartSwaps(items) {
  const profile = getProfile();
  return claudeCallParsed({
    model: MODEL,
    max_tokens: 1500,
    system: buildSystemPrompt(profile),
    messages: [{
      role: 'user',
      content: `Suggest smart swaps for this shopping basket. Focus on healthier alternatives and savings relevant to the household in the system prompt.

Current items:
${items.map(item => `- ${item.name || item.code} (£${item.price})`).join('\n')}

Return a JSON response:
{
  "swaps": [
    {
      "currentItem": "Current item name",
      "suggestedItem": "Suggested alternative",
      "reason": "Why this swap is better for this household",
      "benefit": "health",
      "estimatedSaving": 0.50
    }
  ],
  "totalPotentialSaving": 2.50,
  "healthImprovementTips": ["General tip relevant to this household"]
}

Focus on practical swaps available in the household's primary supermarket (from system prompt).
Return ONLY the JSON object.`,
    }],
  });
}

// ─── Generate weekly shopping list ───────────────────────────────────────────
export async function generateShoppingList(options) {
  const { adultMeals, kidMeals, lastWeekMeals, budget } = options;
  const profile = getProfile();
  return claudeCallParsed({
    model: MODEL,
    max_tokens: 2500,
    system: buildSystemPrompt(profile),
    messages: [{
      role: 'user',
      content: `Generate a weekly shopping list for the household described in the system prompt.
Budget: £${budget?.min || 90}–£${budget?.max || 120}

Household's favourite meals:
Adults: ${adultMeals?.join(', ') || 'Not specified'}
Kids: ${kidMeals?.join(', ') || 'Not specified'}

Meals to avoid (had last week):
${lastWeekMeals?.join(', ') || 'None specified'}

Rules:
1. Select 4 batch cook meals from favourites (avoiding last week's)
2. Scale each batch meal to household size and batch duration from system prompt
3. Identify nutritional gaps for this specific household and add gap-filler items
4. Stay within budget
5. Organise items by aisle

Return JSON:
{
  "selectedMeals": [
    { "name": "Meal name", "days": ["Monday", "Tuesday"] }
  ],
  "shoppingList": {
    "Fresh Produce": [{ "item": "Bananas", "quantity": "1 bunch", "estimatedPrice": 0.89 }],
    "Meat & Fish": [],
    "Dairy & Eggs": [],
    "Bakery": [],
    "Frozen": [],
    "Cupboard Staples": [],
    "Snacks & Treats": []
  },
  "gapFillers": [
    { "item": "Spinach", "reason": "Added iron — good for the kids this week" }
  ],
  "estimatedTotal": 95.50,
  "mealPlan": {
    "Monday": "Spaghetti Bolognese",
    "Tuesday": "Spaghetti Bolognese (leftover)",
    "Wednesday": "Chicken Curry",
    "Thursday": "Chicken Curry (leftover)",
    "Friday": "Fish Fingers & Chips",
    "Saturday": "Pizza Night",
    "Sunday": "Roast Dinner"
  }
}

Return ONLY the JSON object.`,
    }],
  });
}

// ─── Import a recipe from a URL or pasted text ────────────────────────────────
// Calls /api/import-recipe (separate endpoint) because URL scraping must be server-side.
// Returns the full recipe with ingredients scaled to household portions.
export async function importRecipe(url, pastedText) {
  const profile = getProfile();
  const res = await fetch('/api/import-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, pastedText, systemPrompt: buildSystemPrompt(profile) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Import failed');
  }

  const data = await res.json();

  // Scale ingredients to match household portion count
  const originalServings = Number(data.servings) || 1;
  const targetPortions = calculateTotalPortions(profile?.members || []);
  const scalingFactor = targetPortions > 0 ? targetPortions / originalServings : 1;

  const scaledIngredients = (data.ingredients || []).map(ing => ({
    ...ing,
    amount: scaleAmount(ing.amount, scalingFactor),
  }));

  return {
    ...data,
    ingredients: scaledIngredients,
    servings: targetPortions > 0 ? targetPortions : originalServings,
    sourceUrl: url || null,
    importedDate: new Date().toISOString().split('T')[0],
  };
}

// ─── Health check ─────────────────────────────────────────────────────────────
export async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch {
    return false;
  }
}
