// Vercel serverless function — web-search-augmented nutrition scoring.
// Identifies 5-6 key foods, searches NHS/BNF/Harvard/FSA for current evidence,
// and returns an enriched nutrition score with cited insights.

const DEFAULT_SYSTEM =
  'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? (match[1] ?? match[0]).trim() : text);
  } catch {
    throw new Error('Could not read the nutrition research response. Please try again.');
  }
}

// Extracts the final text response from a content array that may also contain
// server_tool_use and web_search_tool_result blocks.
function extractLastText(content) {
  if (!Array.isArray(content)) return '';
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i].type === 'text' && content[i].text) return content[i].text;
  }
  return '';
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, systemPrompt, hasChildren } = req.body;
  if (!items?.length) {
    return res.status(400).json({ error: 'items required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is not configured with an API key. Please set ANTHROPIC_API_KEY in the server environment.',
    });
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
        system: systemPrompt || DEFAULT_SYSTEM,
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
}
