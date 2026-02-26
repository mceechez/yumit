import { LIFE_STAGES, ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES } from '../services/profile';

function getNutritionalPriorities(members) {
  const priorities = [];
  const has = (stage) => members.some(m => m.lifeStage === stage);
  const hasNote = (note) => members.some(m => m.notes?.includes(note));

  if (has('toddler'))             priorities.push('Salt: monitor carefully — toddler in household');
  if (has('toddler'))             priorities.push('Iron: important for toddler development');
  if (has('child-5-10') || has('young-teen'))
                                  priorities.push('Calcium and vitamin D: important for growing children');
  if (has('young-teen'))          priorities.push('Protein: adequate levels needed for teen growth');
  if (has('young-teen'))          priorities.push('Iron: important for teenagers');
  if (has('senior'))              priorities.push('Vitamin D and fibre: important for senior household members');
  if (hasNote('pregnant'))        priorities.push('Folate, iron and oily fish important — avoid soft cheeses, raw eggs, liver, high-mercury fish');
  if (hasNote('breastfeeding'))   priorities.push('Good calorie and hydration levels: breastfeeding household member');
  if (hasNote('vegan'))           priorities.push('B12, complete protein and iron: vegan household member present');
  else if (hasNote('vegetarian')) priorities.push('B12 and complete protein sources: vegetarian household member present');
  if (has('child-5-10') || has('young-teen'))
                                  priorities.push("Varied vegetables: support children's food confidence and development");

  return priorities;
}

/**
 * Builds the Claude system prompt from the stored family profile.
 * Falls back to a generic UK advisor prompt if no profile exists.
 */
export function buildSystemPrompt(profile) {
  if (!profile) {
    return 'You are a household nutrition and grocery advisor. Location: UK — recommend UK supermarket products and brands only. All currency in GBP (£).';
  }

  const {
    householdName,
    members = [],
    budget,
    supermarket,
    batchCooksPerWeek,
    daysPerBatch,
  } = profile;

  const memberLines = members.map(m => {
    const stage = LIFE_STAGES[m.lifeStage];
    const notesStr = m.notes?.length ? `, ${m.notes.join(', ')}` : '';
    const name = m.name?.trim() || 'Household member';

    const allergenLabels = (m.allergens || []).map(a => ALLERGENS.find(x => x.value === a)?.label || a);
    const dietaryLabels = (m.dietaryPreferences || []).map(d => DIETARY_PREFERENCES.find(x => x.value === d)?.label || d);
    const intoleranceLabels = (m.intolerances || []).map(t => INTOLERANCES.find(x => x.value === t)?.label || t);

    const allergenStr = allergenLabels.length ? ` | ALLERGENS: ${allergenLabels.join(', ')}` : '';
    const dietaryStr = dietaryLabels.length ? ` | DIETARY: ${dietaryLabels.join(', ')}` : '';
    const intoleranceStr = intoleranceLabels.length ? ` | INTOLERANT: ${intoleranceLabels.join(', ')}` : '';

    return `- ${name}: ${stage?.label || 'Adult'} (${stage?.ageRange || ''})${notesStr}${allergenStr}${dietaryStr}${intoleranceStr}`;
  }).join('\n') || '- No household members added yet';

  // Build household-level dietary restriction summary
  const allAllergens = [...new Set(members.flatMap(m => m.allergens || []))];
  const allDietary = [...new Set([
    ...members.flatMap(m => m.dietaryPreferences || []),
    ...members.flatMap(m => (m.notes || []).filter(n => n === 'vegetarian' || n === 'vegan')),
  ])];
  const allIntolerances = [...new Set(members.flatMap(m => m.intolerances || []))];

  const dietaryBlock = (allAllergens.length || allDietary.length || allIntolerances.length) ? `
HOUSEHOLD DIETARY REQUIREMENTS — CRITICAL:
${allAllergens.length ? `- ALLERGENS to avoid: ${allAllergens.map(a => ALLERGENS.find(x => x.value === a)?.label || a).join(', ')}` : ''}
${allDietary.length ? `- Dietary preferences: ${allDietary.map(d => DIETARY_PREFERENCES.find(x => x.value === d)?.label || d).join(', ')}` : ''}
${allIntolerances.length ? `- Intolerances: ${allIntolerances.map(t => INTOLERANCES.find(x => x.value === t)?.label || t).join(', ')}` : ''}
- When suggesting recipes, ONLY include options safe for ALL household members
- Flag any scanned product that contains or may contain a listed allergen
- For allergen-flagged products, always suggest a free-from alternative from ${supermarket || 'their supermarket'}` : '';

  const priorities = getNutritionalPriorities(members);
  const priorityBlock = priorities.length
    ? `\nNUTRITIONAL PRIORITIES BASED ON HOUSEHOLD COMPOSITION:\n${priorities.map(p => `- ${p}`).join('\n')}`
    : '';

  return `You are a household nutrition and grocery advisor.

HOUSEHOLD PROFILE:
- Household: ${householdName || 'Household'}
- Primary supermarket: ${supermarket || 'Aldi'}
- Weekly grocery budget: £${budget?.min ?? 90}–£${budget?.max ?? 120}
- Batch cook ${batchCooksPerWeek ?? 2} time(s) per week, each batch covers ${daysPerBatch ?? 2} days

HOUSEHOLD MEMBERS:
${memberLines}
${dietaryBlock}
${priorityBlock}

IMPORTANT RULES:
- Location: UK — recommend UK supermarket products and brands only
- All currency in GBP (£), never USD
- Tone: warm and friendly, like a knowledgeable friend — not clinical or medical
- Use household members' names where it feels natural
- Keep advice actionable and specific to this household's needs`;
}
