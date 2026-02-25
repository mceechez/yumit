import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

const DEFAULT_SYSTEM = 'You are a family nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';

// Resolves the API key: user-supplied header takes priority over env var
function getClient(req) {
  const headerKey = req.headers.authorization?.replace('Bearer ', '').trim() || null;
  const key = headerKey || process.env.CLAUDE_API_KEY;
  if (!key) {
    throw new Error('No API key configured. Please add your Anthropic API key in Settings.');
  }
  return new Anthropic({ apiKey: key });
}

// Extracts the system prompt sent by the frontend (falls back to default)
function getSystem(body) {
  return body.systemPrompt || DEFAULT_SYSTEM;
}

// ─── Parse receipt image using Claude Vision ──────────────────────────────────
router.post('/parse-receipt', async (req, res) => {
  try {
    const { image, mediaType, systemPrompt } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: getSystem(req.body),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `Analyze this receipt image and extract all items with their prices.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "code": "NUMERIC_OR_TEXT_CODE",
      "name": "Human readable name if determinable, otherwise same as code",
      "quantity": 1,
      "price": 0.00
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

Other requirements:
- Include ALL items, even if you're unsure what they are
- Prices should be numbers (not strings)
- Return ONLY the JSON object, no other text`,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    responseText.match(/\{[\s\S]*\}/);
      parsedData = JSON.parse(match ? (match[1] ?? match[0]).trim() : responseText);
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Receipt parsing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Analyze nutrition ────────────────────────────────────────────────────────
router.post('/analyze-nutrition', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: getSystem(req.body),
      messages: [
        {
          role: 'user',
          content: `Analyze the nutritional quality of this shopping basket for the family described in your system prompt.

Shopping items:
${items.map(item => `- ${item.name || item.code} (£${item.price})`).join('\n')}

Provide a JSON response:
{
  "score": 75,
  "grade": "B",
  "positives": ["Good protein variety with chicken and fish"],
  "flags": ["High proportion of processed items"],
  "gaps": ["Leafy greens", "Whole grains"],
  "summary": "Brief 1-2 sentence summary tailored to this family"
}

Scoring: 80-100 (A) excellent, 60-79 (B) good, 40-59 (C) needs improvement, below 40 (D) poor.
Tailor the flags and gaps specifically to the family's composition if provided.
Return ONLY the JSON object.`,
        },
      ],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsedData = JSON.parse(match ? match[1].trim() : responseText);
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Nutrition analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Generate batch cooking plan ──────────────────────────────────────────────
router.post('/batch-cooking', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: getSystem(req.body),
      messages: [
        {
          role: 'user',
          content: `Create 2 batch cooking recipes using these ingredients.
Scale each recipe to the family size and batch duration from the system prompt.
Each recipe should be practical for the ages present in the family.

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

Make recipes that work for the family ages — familiar UK meals, kid-friendly where children are present.
Return ONLY the JSON object.`,
        },
      ],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsedData = JSON.parse(match ? match[1].trim() : responseText);
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Batch cooking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Smart swaps ──────────────────────────────────────────────────────────────
router.post('/smart-swaps', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: getSystem(req.body),
      messages: [
        {
          role: 'user',
          content: `Suggest smart swaps for this shopping basket. Focus on healthier alternatives and savings relevant to the family in the system prompt.

Current items:
${items.map(item => `- ${item.name || item.code} (£${item.price})`).join('\n')}

Return a JSON response:
{
  "swaps": [
    {
      "currentItem": "Current item name",
      "suggestedItem": "Suggested alternative",
      "reason": "Why this swap is better for this family",
      "benefit": "health",
      "estimatedSaving": 0.50
    }
  ],
  "totalPotentialSaving": 2.50,
  "healthImprovementTips": ["General tip relevant to this family"]
}

Focus on practical swaps available in the family's primary supermarket (from system prompt).
Return ONLY the JSON object.`,
        },
      ],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsedData = JSON.parse(match ? match[1].trim() : responseText);
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Smart swaps error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Generate shopping list ───────────────────────────────────────────────────
router.post('/generate-shopping-list', async (req, res) => {
  try {
    const { adultMeals, kidMeals, lastWeekMeals, budget } = req.body;

    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: getSystem(req.body),
      messages: [
        {
          role: 'user',
          content: `Generate a weekly shopping list for the family described in the system prompt.
Budget: £${budget?.min || 90}–£${budget?.max || 120}

Family's favourite meals:
Adults: ${adultMeals?.join(', ') || 'Not specified'}
Kids: ${kidMeals?.join(', ') || 'Not specified'}

Meals to avoid (had last week):
${lastWeekMeals?.join(', ') || 'None specified'}

Rules:
1. Select 4 batch cook meals from favourites (avoiding last week's)
2. Scale each batch meal to family size and batch duration from system prompt
3. Identify nutritional gaps for this specific family and add gap-filler items
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
        },
      ],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsedData = JSON.parse(match[1].trim());
      } else {
        const objMatch = responseText.match(/\{[\s\S]*\}/);
        if (objMatch) parsedData = JSON.parse(objMatch[0]);
        else throw new Error('Could not parse shopping list');
      }
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Shopping list generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Import recipe from URL or pasted text ────────────────────────────────────
router.post('/import-recipe', async (req, res) => {
  const { url, pastedText } = req.body;

  if (!url && !pastedText) {
    return res.status(400).json({ error: 'URL or pasted text required' });
  }

  let recipeText = pastedText || '';
  let scrapedOk  = false;

  if (url && !pastedText) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 10000);

      const fetchResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      clearTimeout(timeoutId);

      if (!fetchResponse.ok) {
        return res.json({ scrapable: false, error: `Page returned HTTP ${fetchResponse.status}` });
      }

      const html = await fetchResponse.text();
      recipeText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .trim()
        .substring(0, 8000);
      scrapedOk = true;
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Request timed out after 10 seconds' : err.message;
      return res.json({ scrapable: false, error: msg });
    }
  }

  try {
    const client = getClient(req);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: getSystem(req.body),
      messages: [{
        role: 'user',
        content: `You are extracting a recipe. This is critical — you MUST include exact quantities and units for every ingredient (e.g. "300", "g", "penne pasta" or "2", "tbsp", "vegetable oil"). You MUST include every numbered instruction step in full. Do not return an ingredient without a quantity. Do not return an empty method list. If you cannot find quantities or steps in the content provided, explicitly say the data is missing rather than returning empty fields.

Extract the complete recipe from the following text:

${recipeText}

Return ONLY a JSON object with this exact structure:
{
  "name": "Recipe name",
  "servings": 4,
  "prepTime": "15 mins",
  "cookTime": "30 mins",
  "ingredients": [
    { "amount": "300", "unit": "g", "item": "penne pasta" },
    { "amount": "2", "unit": "tbsp", "item": "vegetable oil" },
    { "amount": "1", "unit": "", "item": "onion, finely chopped" }
  ],
  "method": [
    { "step": 1, "instruction": "Bring a large pan of salted water to the boil and cook the pasta according to packet instructions." },
    { "step": 2, "instruction": "Meanwhile, heat the oil in a frying pan over medium heat." }
  ],
  "sourceName": "Website or publication name (e.g. BBC Good Food, Jamie Oliver)"
}

CRITICAL rules for ingredients:
- "amount": the EXACT numeric quantity from the recipe as a string — NEVER leave this empty if a quantity appears
- "unit": the measurement unit (g, ml, tbsp, tsp, cloves, pieces, etc.) — use "" only if there is truly no unit
- "item": ingredient name only, no quantity or unit included
- You MUST include ALL ingredients with their quantities — an ingredient without an amount is an error

CRITICAL rules for method:
- You MUST copy ALL numbered steps from the recipe in full
- Do not summarise, merge, or skip any steps
- The method array MUST NOT be empty if the recipe contains instructions
- Each instruction must be a complete sentence

Return ONLY the JSON object.`,
      }],
    });

    const responseText = message.content[0].text;
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    responseText.match(/\{[\s\S]*\}/);
      parsedData = JSON.parse(match ? (match[1] ?? match[0]).trim() : responseText);
    }

    res.json({ ...parsedData, scrapable: scrapedOk });
  } catch (error) {
    console.error('Recipe import error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
