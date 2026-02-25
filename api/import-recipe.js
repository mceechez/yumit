// Vercel serverless function — scrapes a recipe URL server-side (avoids CORS),
// then calls the Anthropic API to extract structured recipe data.
const DEFAULT_SYSTEM =
  'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';

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

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server is not configured with an API key. Please set ANTHROPIC_API_KEY in the server environment.' });
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
        max_tokens: 3000,
        system: systemPrompt || DEFAULT_SYSTEM,
        messages: [{
          role: 'user',
          content: `You are extracting a recipe. This is critical — you MUST include exact quantities and units for every ingredient (e.g. "300", "g", "penne pasta" or "2", "tbsp", "vegetable oil"). You MUST include every numbered instruction step in full. Do not return an ingredient without a quantity. Do not return an empty method list. If you cannot find quantities or steps in the content provided, explicitly say the data is missing rather than returning empty fields.

The method/instructions field is the most important part. Extract every single numbered step exactly as written. Return them as an array of strings. If you see steps numbered 1, 2, 3 on the page, return all of them. Never return an empty method array.

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
    "Bring a large pan of salted water to the boil and cook the pasta according to packet instructions.",
    "Meanwhile, heat the oil in a frying pan over medium heat.",
    "Add the onion and cook for 5 minutes until softened."
  ],
  "sourceName": "Website or publication name (e.g. BBC Good Food, Jamie Oliver)"
}

CRITICAL rules for ingredients:
- "amount": the EXACT numeric quantity from the recipe as a string — NEVER leave this empty if a quantity appears
- "unit": the measurement unit (g, ml, tbsp, tsp, cloves, pieces, etc.) — use "" only if there is truly no unit
- "item": ingredient name only, no quantity or unit included
- You MUST include ALL ingredients with their quantities — an ingredient without an amount is an error

CRITICAL rules for method:
- "method" MUST be an array of plain strings — one string per step, no objects, no step numbers
- Copy every step from the recipe in full — do not summarise, merge, or skip any steps
- The method array MUST NOT be empty if the recipe has any instructions at all
- Include every single numbered or bulleted step you can find in the text

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
      console.log('[import-recipe] name:', parsedData.name);
      console.log('[import-recipe] ingredients count:', parsedData.ingredients?.length ?? 0);
      console.log('[import-recipe] method raw:', JSON.stringify(parsedData.method ?? parsedData.instructions ?? null));
      return res.json({ ...parsedData, scrapable: scrapedOk });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
