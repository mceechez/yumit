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
    ? '\nFor the research step, also look up any specific NHS or BNF guidance on benefits or risks for children and young people.\n'
    : '';

  return `You are Yumit's nutrition intelligence engine. Your role is to find and explain the nutritional value already present in this household's weekly shop.

PHILOSOPHY:
- You identify what is working and what combinations are creating extra value
- You never mention what is absent, missing, or suboptimal unless generating the one_addition field
- You never reference ultra-processed items, poor choices, or nutritional failures
- You speak like a knowledgeable friend who understands food science — warm, specific, never clinical
- You cite the actual items from the basket, never speak in generalities
- Every insight connects the science to something a person actually experiences: energy, sleep, immunity, digestion, focus, joint health

LANGUAGE RULES — ABSOLUTE:
NEVER use these words: deficiency, lacking, missing, insufficient, poor, warning, risk, suboptimal, should, must, need to, at risk
ALWAYS use: specific item names from the basket, plain English for any scientific term, human outcomes (energy / sleep / immunity / digestion), active present tense ("your spinach and lemon are working together")
SENTENCE STRUCTURE for every insight: [what is in the basket] + [what it does] + [why it matters to a human]
LENGTH: each insight is 1–2 sentences maximum. No paragraphs. No lists within insights.
TONE: read each output aloud — if it sounds like a doctor or a report, rewrite it; if it sounds like a knowledgeable friend explaining something interesting over dinner, it is correct.

HOUSEHOLD CONTEXT: See system prompt for members, life stages, and dietary needs.

RECEIPT ITEMS:
${itemList}
${kidsInstruction}
═══ STEP 1 — SCORE PILLARS (receipt evidence only) ═══
Score each pillar using ONLY the items listed above. Do not infer items not present.
Be consistent — the same receipt must always produce the same pillar scores.

PILLAR 1 — PROTEIN COVERAGE (max 20 points)
Distinct protein sources: meat, fish, eggs, legumes (beans/lentils/chickpeas), dairy, tofu.
- 2 or more distinct protein sources: 20
- 1 protein source only: 12
- No clear protein source identifiable: 4

PILLAR 2 — FRUIT & VEGETABLE VARIETY (max 20 points)
Count distinct fruit or vegetable items only.
- 4 or more distinct items: 20
- 2–3 distinct items: 13
- 1 item: 7
- None: 0

PILLAR 3 — FIBRE & WHOLEGRAINS (max 20 points)
- Wholegrain bread, oats, brown rice, lentils, beans or equivalent present: 20
- Mixed — some whole foods alongside processed items: 12
- Predominantly white carbs, refined products, or ready meals: 5

PILLAR 4 — ULTRA-PROCESSED LOAD (max 20 points)
This pillar scores inversely — fewer ultra-processed items = higher score.
Ultra-processed: crisps, fizzy drinks, processed meats, ready meals, sugary cereals, packaged snacks.
- Few or no ultra-processed items: 20
- Some ultra-processed but balanced by whole foods: 13
- Ultra-processed items represent a significant portion: 6
- Ultra-processed items dominate: 0

PILLAR 5 — NUTRITIONAL GAP COVERAGE (max 20 points)
Key UK priority nutrients: iron, calcium, vitamin D, folate, omega-3.
- 3 or more of these covered by identifiable items: 20
- 1–2 covered: 12
- None identifiable from the receipt: 4

═══ STEP 2 — DETECT SYNERGIES ═══
Scan the basket for these specific pairings. For each detected synergy: generate one insight sentence following the language rules above, referencing the specific items from this basket.

1. IRON + VITAMIN C (score +3): iron sources (red meat, spinach, lentils, kidney beans, fortified cereals) + vitamin C sources (citrus, peppers, tomatoes, broccoli, strawberries)
2. VITAMIN D + CALCIUM (score +3): vitamin D sources (oily fish, eggs, fortified milk) + calcium sources (dairy, fortified plant milk, leafy greens, tinned fish with bones)
3. FAT-SOLUBLE VITAMINS + HEALTHY FATS (score +2): fat-soluble vitamin sources (dark leafy greens, carrots, sweet potato, squash) + healthy fat sources (olive oil, avocado, nuts, seeds)
4. PROBIOTICS + PREBIOTIC FIBRE (score +2): probiotic sources (live yoghurt, kefir, sauerkraut, kimchi) + prebiotic fibre sources (oats, garlic, onions, leeks, asparagus, bananas)
5. OMEGA-3 + ANTIOXIDANT VEGETABLES (score +2): omega-3 sources (oily fish, walnuts, flaxseed) + antioxidant-rich vegetables (broccoli, spinach, peppers, tomatoes)
6. ZINC + PROTEIN DIVERSITY (score +1): zinc sources in context of 2 or more distinct protein sources
7. LYCOPENE ACTIVATION (score +1): tinned tomatoes, tomato paste, or cooked tomato products present — this is a solo synergy, no pairing required; note that the cooked/tinned form makes lycopene more bioavailable
8. MAGNESIUM + VITAMIN B6 (score +1): magnesium sources (oats, nuts, dark chocolate, seeds, legumes) + B6 sources (eggs, poultry, bananas, potatoes)
9. TURMERIC + BLACK PEPPER (score +2): turmeric sources (ground turmeric, curry powder, turmeric paste, golden milk) present alongside black pepper sources (ground black pepper, whole peppercorns, mixed pepper). If both present: score +2 and generate turmeric-pepper absorption insight. Note: piperine in black pepper inhibits liver enzymes that break down curcumin — 2,000% increase in curcumin bioavailability. Reference: Shoba et al. Planta Medica 1998, confirmed in multiple human trials.
10. VITAMIN E + SELENIUM (score +2): vitamin E sources (sunflower seeds, almonds, hazelnuts, pine nuts, olive oil, avocado, peanut butter) present alongside selenium sources (brazil nuts, tuna, sardines, eggs, turkey, chicken, wholegrains). If both present: score +2 and generate vitamin E-selenium antioxidant insight. Note: selenium is the most commonly deficient mineral in UK diets. This pairing completes a two-step antioxidant process. Reference: Current Opinion in Chemical Biology 2023, PMC10524500.
11. GREEN TEA + CITRUS (score +1): green tea sources (green tea bags, matcha, green tea extract) present alongside citrus sources (lemons, limes, oranges, grapefruit, citrus juice). If both present: score +1 and generate green tea-citrus catechin insight. Note: less than 20% of green tea catechins survive digestion without vitamin C. Lemon juice preserves 80%. Score is +1 not +2 because human in vivo evidence is still developing — use conservative language. Do not apply if only black or herbal tea is present. Reference: Ferruzzi et al. Molecular Nutrition and Food Research 2007.

Only add an entry to synergies_detected if the pair is genuinely present. Return an empty array if no synergies are found — never fabricate pairings.

═══ STEP 3 — RESEARCH ═══
Use web search to look up guidance on the 3–4 most nutritionally significant foods in this basket.
Search in priority order: nhs.uk/live-well/eat-well, nutrition.org.uk, hsph.harvard.edu/nutritionsource, food.gov.uk, pubmed.ncbi.nlm.nih.gov.
Ignore wellness blogs, supplement companies, social media, and sites that sell food products.${kidsInstruction}
═══ STEP 4 — RETURN JSON ═══
Return ONLY this JSON object — no preamble, no markdown, no explanation outside it:
{
  "pillars": {
    "protein":        { "score": 0, "reason": "one sentence, language rules apply" },
    "veg_variety":    { "score": 0, "reason": "one sentence, language rules apply" },
    "fibre":          { "score": 0, "reason": "one sentence, language rules apply" },
    "processed_load": { "score": 0, "reason": "one sentence, language rules apply" },
    "gap_nutrients":  { "score": 0, "reason": "one sentence, language rules apply" }
  },
  "synergies_detected": [
    {
      "pair": "synergy pair name",
      "items_from_basket": ["item 1", "item 2"],
      "insight": "one to two sentences following all language rules",
      "score_contribution": 0
    }
  ],
  "synergy_score": 0,
  "total_score": 0,
  "headline_insight": "single most impressive or surprising thing about this shop — one sentence, language rules apply",
  "lowest_pillar": "pillar_key_name",
  "one_addition": "single specific affordable item under £2 that would add the most nutritional value this week — phrased as a suggestion not an instruction",
  "lowest_pillar_suggestion": "same value as one_addition",
  "summary": "1–2 sentence household-specific summary of this week's shop",
  "insights": [
    {
      "heading": "Insight heading",
      "body": "Evidence-based finding with source cited inline (nhs.uk), language rules apply",
      "source": "NHS — nhs.uk/live-well/eat-well"
    }
  ],
  "kidsInsights": ${hasChildren ? `[
    {
      "food": "Food name",
      "benefit": "Child-specific benefit with source cited, language rules apply",
      "source": "NHS"
    }
  ]` : '[]'}
}

Rules:
- total_score = sum of all 5 pillar scores + synergy_score
- synergy_score = sum of score_contribution values in synergies_detected (0 if array is empty)
- lowest_pillar = key name of the lowest-scoring pillar
- one_addition and lowest_pillar_suggestion must be identical: a real UK product at the household's supermarket, under £2
- headline_insight: the single most specific and interesting observation about this shop — not a score summary
- insights: include exactly 3–4 items; cite source inline in the body field; language rules apply
- kidsInsights: ${hasChildren ? 'include 2–3 items with child-relevant benefits from NHS/BNF; language rules apply' : 'return []'}
- Tailor summary and insights to the household described in the system prompt
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
      console.log('[nutrition-research] total_score:', parsed.total_score, 'synergy_score:', parsed.synergy_score ?? 0, 'lowest_pillar:', parsed.lowest_pillar);
      console.log('[nutrition-research] synergies:', parsed.synergies_detected?.length ?? 0, 'insights:', parsed.insights?.length ?? 0, 'kidsInsights:', parsed.kidsInsights?.length ?? 0);
      return res.json(parsed);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── /api/parse-text — universal text receipt parser (PDF + paste) ────────────
// Accepts raw text extracted from a PDF or pasted from a browser.
// Injects supermarket-specific rules and returns a clean item array.

const SUPERMARKET_PROFILES_SERVER = {
  ocado:      { name: 'Ocado',             stripRules: ['delivery charges', 'bag charges', 'promotional code lines'],                                          notes: 'Full unabbreviated product names. Use line item price. Substitutions are labelled.',                                                                   substitutionLabel: 'substitution' },
  tesco:      { name: 'Tesco Online',      stripRules: ['Clubcard Price lines', "'You saved' lines", 'promotional banner text', 'delivery slot info'],          notes: 'Some abbreviations used. Use the final paid/Clubcard price. Weight-based items: use the line total.',                                                    substitutionLabel: null },
  sainsburys: { name: "Sainsbury's Online",stripRules: ['Nectar points lines', 'delivery information lines'],                                                  notes: "Clean layout. When 'substituted for' appears, extract the replacement item delivered, not the original.",                                               substitutionLabel: 'substituted for' },
  asda:       { name: 'ASDA Online',       stripRules: ['Rollback pricing lines (e.g. "Rollback was £X")', 'George clothing lines', 'promotional header lines'],notes: 'More abbreviations than others (e.g. "ASDA Chckn Bst Flts"). Use final paid price, not Rollback price.',                                             substitutionLabel: null },
  waitrose:   { name: 'Waitrose Online',   stripRules: ['myWaitrose points lines', 'Essential Waitrose tier label prefix lines', 'delivery info'],              notes: 'Full product names, no abbreviations. Strip myWaitrose loyalty lines.',                                                                                  substitutionLabel: 'substitution' },
  generic:    { name: 'Online Supermarket',stripRules: ['loyalty points lines', 'delivery charges', 'promotional banner text'],                                 notes: 'Generic mode — extract grocery food and drink items only.',                                                                                              substitutionLabel: null },
};

function buildParseTextPrompt(text, supermarketId) {
  const profile = SUPERMARKET_PROFILES_SERVER[supermarketId] || SUPERMARKET_PROFILES_SERVER.generic;
  const supermarketSection = `SUPERMARKET: ${profile.name}
STRIP these lines entirely: ${profile.stripRules.join('; ')}
PARSING NOTES: ${profile.notes}${profile.substitutionLabel ? `\nSUBSTITUTION LABEL: When you see "${profile.substitutionLabel}", extract the replacement item actually delivered, not the original.` : ''}`;

  return `You are extracting grocery items from an online supermarket order confirmation.

${supermarketSection}

From the text below, extract every purchased grocery item.
For each item return:
- name: full readable product name (cleaned, no promotional text, no loyalty point references)
- quantity: number of units (default 1 if not shown)
- price: price paid in GBP as a number (use the final paid price, not original if discounted)
- substituted: true if this item replaced an originally ordered item, false otherwise

Return as JSON array only. No preamble, no explanation, no markdown.
[{"name":"...","quantity":1,"price":0.00,"substituted":false}]

Universal rules applying to ALL supermarkets:
- EXTRACT: grocery food and drink items only
- IGNORE: delivery charges, bag charges, tips, loyalty points lines, promotional banner text, subtotal lines, VAT lines, total lines, payment method lines, order number lines, delivery address lines, date and time lines
- IGNORE: non-grocery items (magazines, flowers, clothing, household goods clearly not food)
- CLEAN names: remove store own-brand tier labels when they appear as prefixes on their own (strip standalone 'Essential' or 'Finest' prefix lines, but keep them when part of product name)
- SUBSTITUTIONS: when an item shows as substituted, extract the replacement item that was actually delivered
- CONFIDENCE: if you cannot confidently identify at least 3 grocery items, return: {"error":"insufficient_items","message":"Not enough grocery items found. Please check the pasted content includes your full order."}
- If no grocery items exist at all, return: {"error":"no_grocery_items","message":"This doesn't look like a grocery receipt — we couldn't find any food items. Make sure you're pasting from your order confirmation page, not your account overview."}

ORDER TEXT:
${text.slice(0, 12000)}`; // cap at ~12k chars to stay within token budget
}

app.post('/api/parse-text', async (req, res) => {
  const { text, supermarket = 'generic', systemPrompt } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

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
        max_tokens: 2000,
        system: systemPrompt || 'You are a grocery receipt parser for UK supermarkets. Location: UK. Currency: GBP (£).',
        messages: [{ role: 'user', content: buildParseTextPrompt(text, supermarket) }],
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

    const responseText = claudeData?.content?.[0]?.text;
    if (!responseText) {
      return res.status(502).json({ error: 'Claude returned an empty response. Please try again.' });
    }

    try {
      const parsed = parseJson(responseText);
      // Claude returned an error object
      if (parsed.error) return res.json(parsed);
      // Claude returned an array directly
      const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
      console.log('[parse-text] supermarket:', supermarket, 'items:', items.length);
      return res.json({ items });
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
