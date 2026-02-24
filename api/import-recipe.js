// Vercel serverless function — scrapes a recipe URL server-side (avoids CORS),
// then calls the Anthropic API to extract structured recipe data.
const DEFAULT_SYSTEM =
  'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';

const ALDI_PRODUCTS = [
  'Oranges', 'Chopped Tomatoes', 'Chicken Thigh Fillets', 'Frozen Coldwater Prawns',
  'Frozen Chips', 'Semi-Skimmed Milk', 'Free Range Eggs', 'White Sliced Bread',
  'Mild Cheddar', 'Basmati Rice', 'Penne Pasta', 'Extra Virgin Olive Oil',
  'Diced Beef', 'Pork Mince', 'Beef Mince', 'Salmon Fillets', 'Broccoli',
  'Carrots', 'White Potatoes', 'Brown Onions', 'Garlic', 'Bananas', 'Apples',
  'Cucumber', 'Vine Tomatoes', 'Mixed Peppers', 'Greek Yogurt', 'Salted Butter',
  'Mature Cheddar', 'Fish Fingers', 'Frozen Garden Peas', 'Frozen Sweetcorn',
  'Baked Beans', 'Mackerel Fillets', 'Cauliflower', 'Aubergine', 'Strawberries',
  'Pork Shoulder Steaks', 'Cod Fillets',
].join(', ');

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? (match[1] ?? match[0]).trim() : text);
  } catch {
    throw new Error('Could not read the recipe response. Please try again.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, pastedText, systemPrompt } = req.body;
  if (!url && !pastedText) {
    return res.status(400).json({ error: 'URL or pasted text required' });
  }

  const apiKey =
    req.headers['authorization']?.replace('Bearer ', '').trim() ||
    process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return res.status(401).json({ error: 'No API key configured.' });
  }

  let recipeText = pastedText || '';
  let scrapedOk = false;

  if (url && !pastedText) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
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
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt || DEFAULT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Extract the recipe from the following text.

${recipeText}

Known products available in store:
${ALDI_PRODUCTS}

Return ONLY a JSON object:
{
  "name": "Recipe name",
  "servings": 4,
  "prepTime": "15 mins",
  "cookTime": "30 mins",
  "ingredients": [
    { "item": "ingredient name", "quantity": "500g", "aldiProduct": "closest store product or null" }
  ]
}

For "aldiProduct": match to the closest item from the store products list if it's a clear match. Set null for spices, condiments, or items not in the list.
Return ONLY the JSON object.`,
        }],
      }),
    });

    let claudeData;
    try {
      claudeData = await upstream.json();
    } catch {
      return res.status(502).json({ error: 'Received an unexpected response from Claude. Please try again.' });
    }

    const responseText = claudeData?.content?.[0]?.text;
    if (!responseText) {
      const apiError = claudeData?.error?.message ||
        (typeof claudeData?.error === 'string' ? claudeData.error : null) ||
        'Claude returned an empty response.';
      return res.status(502).json({ error: apiError });
    }

    try {
      const parsedData = parseJson(responseText);
      return res.json({ ...parsedData, scrapable: scrapedOk });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
