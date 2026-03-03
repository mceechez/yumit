// ─── Supermarket Parsing Profiles ────────────────────────────────────────────
// Used by the /api/parse-text endpoint to inject supermarket-specific rules
// into the Claude parsing prompt. Each profile describes what to strip and
// any special parsing behaviour.

export const SUPERMARKET_PROFILES = {
  ocado: {
    id: 'ocado',
    name: 'Ocado',
    stripRules: [
      'delivery charges',
      'bag charges',
      'promotional code lines',
      'order summary header lines',
    ],
    notes: 'Ocado receipts use full unabbreviated product names. Substitutions are labelled. Price-per-unit is often included — use the line item price, not the per-unit price.',
    substitutionLabel: 'substitution',
  },
  tesco: {
    id: 'tesco',
    name: 'Tesco Online',
    stripRules: [
      'Clubcard Price lines',
      "'You saved' lines",
      'promotional banner text',
      'delivery slot information lines',
      'Tesco Rewards lines',
    ],
    notes: 'Tesco uses some abbreviations (e.g. "Tesco Whl Mlk 6Pt"). Always use the final paid price — if a Clubcard Price is shown, use that lower price as the item price. Weight-based items show price-per-kg; use the line total.',
    substitutionLabel: null,
  },
  sainsburys: {
    id: 'sainsburys',
    name: "Sainsbury's Online",
    stripRules: [
      'Nectar points lines',
      'delivery information lines',
      'promotional header lines',
    ],
    notes: "Sainsbury's layout is clean with full product names. When a substitution is present (labelled 'substituted for'), extract the replacement item that was actually delivered, not the original. Strip Nectar point award lines.",
    substitutionLabel: 'substituted for',
  },
  asda: {
    id: 'asda',
    name: 'ASDA Online',
    stripRules: [
      'Rollback pricing lines (e.g. "Rollback was £X.XX")',
      'George clothing lines',
      'promotional header and banner lines',
      'ASDA Rewards lines',
    ],
    notes: 'ASDA uses abbreviations more than other supermarkets (e.g. "ASDA Chckn Bst Flts"). Apply abbreviation expansion. Use the final paid price, not the original Rollback price. Weight-based produce items may need quantity normalisation.',
    substitutionLabel: null,
  },
  waitrose: {
    id: 'waitrose',
    name: 'Waitrose Online',
    stripRules: [
      'myWaitrose points lines',
      'Essential Waitrose tier label lines when they appear as a separate prefix line',
      'delivery information lines',
    ],
    notes: "Waitrose uses full product names with no abbreviations. Products often include producer provenance in the name (e.g. 'Duchy Organic'). myWaitrose loyalty reward lines must be stripped.",
    substitutionLabel: 'substitution',
  },
  generic: {
    id: 'generic',
    name: 'Online Supermarket',
    stripRules: [
      'loyalty points lines',
      'delivery charges',
      'promotional banner text',
      'subtotal and total lines',
    ],
    notes: 'Generic mode — extract grocery food and drink items only.',
    substitutionLabel: null,
  },
};

/**
 * Auto-detect supermarket from raw receipt/order text.
 * Returns a supermarket id ('ocado', 'tesco', 'sainsburys', 'asda', 'waitrose', 'generic').
 * Never blocks — falls back to 'generic' if nothing is detected.
 */
export function detectSupermarket(text) {
  if (!text || typeof text !== 'string') return 'generic';
  const lower = text.toLowerCase();

  // Order matters — more specific strings first to avoid false positives
  if (lower.includes('ocado')) return 'ocado';
  if (lower.includes('sainsbury')) return 'sainsburys';
  if (lower.includes('waitrose')) return 'waitrose';
  if (lower.includes('asda')) return 'asda';
  if (lower.includes('tesco')) return 'tesco';

  return 'generic';
}

/**
 * Build the supermarket-specific section of the parsing prompt.
 */
export function buildSupermarketPromptSection(supermarketId) {
  const profile = SUPERMARKET_PROFILES[supermarketId] || SUPERMARKET_PROFILES.generic;
  return `SUPERMARKET: ${profile.name}
STRIP these lines entirely: ${profile.stripRules.join('; ')}
PARSING NOTES: ${profile.notes}${profile.substitutionLabel ? `\nSUBSTITUTION LABEL: When you see "${profile.substitutionLabel}", extract the replacement item delivered, not the original.` : ''}`;
}
