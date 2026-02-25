import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SCRAPE_FRIENDLY_SITES } from './config/scrapeFriendlySites.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Resolves the API key from the server environment.
function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('Server is not configured with an API key. Please set ANTHROPIC_API_KEY in the server environment.');
  return key;
}

// ─── /api/claude — Anthropic proxy (mirrors api/claude.js Vercel function) ────
app.post('/api/claude', async (req, res) => {
  try {
    const apiKey = getApiKey();
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(err.message.includes('No API key') ? 401 : 500).json({ error: err.message });
  }
});

// ─── /api/import-recipe — URL scraper + Anthropic proxy ───────────────────────

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? (match[1] ?? match[0]).trim() : text);
  } catch {
    throw new Error('Could not read the recipe response. Please try again.');
  }
}

app.post('/api/import-recipe', async (req, res) => {
  const { url, pastedText, systemPrompt } = req.body;
  if (!url && !pastedText) return res.status(400).json({ error: 'URL or pasted text required' });

  let apiKey;
  try { apiKey = getApiKey(); } catch (err) {
    return res.status(401).json({ error: err.message });
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
    const DEFAULT_SYSTEM = 'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';
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
      // Log extraction results so we can verify method steps are captured
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
});

// ─── /api/find-alternatives — search scrape-friendly sites for an alternative recipe URL ──
// Returns up to 3 candidate recipe URLs from known sites, searched in parallel.
// Each site search has a 5-second timeout; failures are silently skipped.

const RECIPE_URL_SKIP = /\/(search|categor|tag|author|page\/|topic|collection|video|podcast|about|contact|privacy|terms)/i;

function extractRecipeUrl(html, domain) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const escaped = domain.replace(/\./g, '\\.');
  const pattern = new RegExp(`href="(https?://(?:www\\.)?${escaped}/[^"#?]{4,})"`, 'gi');

  let match;
  while ((match = pattern.exec(clean)) !== null) {
    const url = match[1];
    try {
      const { pathname } = new URL(url);
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length < 1) continue;
      if (RECIPE_URL_SKIP.test(pathname)) continue;
      return url.split('#')[0];
    } catch { continue; }
  }
  return null;
}

async function findFirstRecipeUrl(site, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(site.searchUrl(query), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    return extractRecipeUrl(html, site.domain);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

app.post('/api/find-alternatives', async (req, res) => {
  const { recipeName } = req.body;
  if (!recipeName?.trim()) return res.status(400).json({ error: 'recipeName required' });

  const settled = await Promise.allSettled(
    SCRAPE_FRIENDLY_SITES.map(site => findFirstRecipeUrl(site, recipeName))
  );

  const alternatives = settled
    .map((r, i) =>
      r.status === 'fulfilled' && r.value
        ? { siteName: SCRAPE_FRIENDLY_SITES[i].name, url: r.value }
        : null
    )
    .filter(Boolean)
    .slice(0, 3);

  res.json({ alternatives });
});

// ─── /api/nutrition-research — web-search-augmented nutrition scoring ─────────
// Identifies 5-6 key foods from the basket, searches NHS/BNF/Harvard/FSA for
// current evidence-based guidance, then returns an enriched nutrition score.

// Extracts the final text response from a content array that may also contain
// server_tool_use and web_search_tool_result blocks.
function extractLastText(content) {
  if (!Array.isArray(content)) return '';
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i].type === 'text' && content[i].text) return content[i].text;
  }
  return '';
}

const NUTRITION_RESEARCH_SYSTEM =
  'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';

function buildNutritionResearchPrompt(items, hasChildren) {
  const itemList = items.map(i => `- ${i.name} (£${i.price})`).join('\n');
  const kidsInstruction = hasChildren
    ? '\nFor each key food, also look up any specific NHS or BNF guidance on benefits or risks for children and young people.\n'
    : '';

  return `You are an evidence-based nutrition analyst. You have web search available — use it to look up current guidance from NHS, British Nutrition Foundation, Harvard T.H. Chan School of Public Health, Food Standards Agency, and PubMed.

Shopping basket items:
${itemList}
${kidsInstruction}
Step 1 — IDENTIFY the 5-6 most nutritionally significant foods (both positive and negative). Ignore non-food items.

Step 2 — RESEARCH each key food using web search. Search sources in this priority order:
  1. nhs.uk/live-well/eat-well
  2. nutrition.org.uk (British Nutrition Foundation)
  3. hsph.harvard.edu/nutritionsource
  4. food.gov.uk (Food Standards Agency)
  5. pubmed.ncbi.nlm.nih.gov (for specific claims)
Only use these sources. Ignore wellness blogs, supplement company websites, social media influencers, and any site that sells food products.

Step 3 — Return ONLY a JSON object with this exact structure:
{
  "score": 72,
  "grade": "B",
  "positives": [
    "Salmon is an excellent source of omega-3 fatty acids — NHS recommends eating at least 2 portions of fish per week, including 1 oily fish (nhs.uk)"
  ],
  "flags": [
    "Baked beans are high in salt — NHS recommends adults have no more than 6g per day; a single can provides around 2.4g (nhs.uk)"
  ],
  "gaps": ["Leafy greens", "Whole grains"],
  "summary": "1-2 sentence household-specific summary of this week's shop",
  "insights": [
    {
      "heading": "Oily fish and heart health",
      "body": "NHS guidance recommends eating at least 1 portion of oily fish per week. Oily fish such as salmon and mackerel are rich in long-chain omega-3 fatty acids, which evidence shows can reduce the risk of heart disease and support brain health.",
      "source": "NHS — nhs.uk/live-well/eat-well"
    }
  ],
  "kidsInsights": ${hasChildren ? `[
    {
      "food": "Salmon",
      "benefit": "Rich in DHA, an omega-3 fatty acid essential for brain development and eye health in children. NHS recommends 1-2 portions of fish per week for school-age children.",
      "source": "NHS"
    }
  ]` : '[]'}
}

Scoring: 80-100 = A (excellent), 60-79 = B (good), 40-59 = C (needs improvement), below 40 = D (poor).

Rules:
- positives and flags MUST cite the source inline — do not give generic statements
- insights: include exactly 3-4 items based on the most interesting research findings
- kidsInsights: ${hasChildren ? 'include 2-3 items with specific child-relevant benefits from NHS/BNF' : 'return an empty array []'}
- Tailor the score, summary and flags to the household described in the system prompt
- Return ONLY the JSON object — no other text`;
}

app.post('/api/nutrition-research', async (req, res) => {
  const { items, systemPrompt, hasChildren } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'items required' });

  let apiKey;
  try { apiKey = getApiKey(); } catch (err) {
    return res.status(500).json({ error: err.message });
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
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6,
          allowed_domains: [
            'nhs.uk',
            'nutrition.org.uk',
            'hsph.harvard.edu',
            'pubmed.ncbi.nlm.nih.gov',
            'food.gov.uk',
          ],
        }],
        system: systemPrompt || NUTRITION_RESEARCH_SYSTEM,
        messages: [{ role: 'user', content: buildNutritionResearchPrompt(items, !!hasChildren) }],
      }),
    });

    let claudeData;
    try {
      claudeData = await upstream.json();
    } catch {
      return res.status(502).json({ error: 'Received an unexpected response. Please try again.' });
    }

    if (!upstream.ok) {
      const apiError = claudeData?.error?.message ||
        (typeof claudeData?.error === 'string' ? claudeData.error : null) ||
        `Claude API error (${upstream.status})`;
      return res.status(upstream.status).json({ error: apiError });
    }

    const responseText = extractLastText(claudeData?.content);
    if (!responseText) {
      return res.status(502).json({ error: 'Claude returned an empty response. Please try again.' });
    }

    try {
      const parsed = parseJson(responseText);
      console.log('[nutrition-research] score:', parsed.score, 'grade:', parsed.grade);
      console.log('[nutrition-research] insights:', parsed.insights?.length ?? 0, 'kidsInsights:', parsed.kidsInsights?.length ?? 0);
      return res.json(parsed);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Yumit API server running on port ${PORT}`);
});
