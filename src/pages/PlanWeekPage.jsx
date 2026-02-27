import { useState, useEffect } from 'react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AnimatedPage } from '../components/AnimatedPage';
import {
  rateMeals,
  getMealSuggestions,
  generateMealShoppingList,
} from '../services/claude';
import {
  getFavouriteRecipes,
  getMealRatings,
  saveMealRatings,
  saveShoppingList,
} from '../services/storage';
import { getProfile } from '../services/profile';
import { formatPrice } from '../utils/formatters';

// ─── Star badge with tap-to-show tooltip ─────────────────────────────────────

function StarBadge({ stars, oneLine, showTooltip, onToggle }) {
  const colour =
    stars === 3 ? 'text-green-600' :
    stars === 2 ? 'text-amber-500' : 'text-gray-400';
  return (
    <div className="relative inline-block">
      <button
        onClick={onToggle}
        className={`text-sm leading-none ${colour}`}
        aria-label={`${stars} star nutritional rating`}
      >
        {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
      </button>
      {showTooltip && oneLine && (
        <div className="absolute bottom-full left-0 mb-1 bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 z-20 max-w-56 whitespace-normal shadow-lg">
          {oneLine}
        </div>
      )}
    </div>
  );
}

// ─── Five-bar strength indicator ──────────────────────────────────────────────

function StrengthBars({ bars, colour }) {
  const fillClass =
    colour === 'green' ? 'bg-green-500' :
    colour === 'amber' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all ${i <= bars ? fillClass : 'bg-gray-200'}`}
          style={{ height: `${Math.round((i / 5) * 100)}%`, minHeight: '4px' }}
        />
      ))}
    </div>
  );
}

// ─── Derive live nutrition panel state from selected meals + ratings ──────────

function deriveNutritionState(selectedMeals, ratings) {
  if (!selectedMeals.length) {
    return {
      bars: 0, colour: 'grey',
      headline: "Select meals to see your week's nutrition",
      protein: 'Light', vegetables: 'Missing', wholeFoods: 'Mostly processed',
    };
  }

  const stars = selectedMeals.map(m => ratings[m.name]?.stars ?? 2);
  const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
  const combined = selectedMeals.map(m => (ratings[m.name]?.one_line || '').toLowerCase()).join(' ');

  const proteinHits = ['protein', 'chicken', 'beef', 'lamb', 'fish', 'salmon', 'eggs', 'meat', 'tofu', 'legume', 'beans', 'lentil', 'prawn']
    .filter(w => combined.includes(w)).length;
  const protein = proteinHits >= 3 ? 'Strong' : proteinHits >= 1 ? 'Moderate' : 'Light';

  const vegHits = ['vegetable', ' veg', 'broccoli', 'spinach', 'kale', 'tomato', 'carrot', 'salad', 'greens', 'peppers', 'courgette']
    .filter(w => combined.includes(w)).length;
  const vegetables = vegHits >= 3 ? 'Good variety' : vegHits >= 1 ? 'Limited' : 'Missing';

  const wholeHits = ['whole food', 'wholegrain', 'whole grain', 'unprocessed', 'fresh ingredients']
    .filter(w => combined.includes(w)).length;
  const processedHits = ['processed', 'refined', 'packaged snack']
    .filter(w => combined.includes(w)).length;
  const wholeFoods = wholeHits >= 2 ? 'Mostly whole' : processedHits >= 2 ? 'Mostly processed' : 'Mixed';

  let bars, colour, headline;
  if (avg >= 2.8)      { bars = 5; colour = 'green'; headline = 'Strong week — well balanced selection'; }
  else if (avg >= 2.3) { bars = 4; colour = 'green'; headline = 'Good nutritional spread across the week'; }
  else if (avg >= 1.8) { bars = 3; colour = 'amber'; headline = 'Decent week — adding one strong meal would balance this nicely'; }
  else                 { bars = avg >= 1.3 ? 2 : 1; colour = 'red'; headline = 'This week is light on nutrition — consider swapping one meal'; }

  return { bars, colour, headline, protein, vegetables, wholeFoods };
}

function getNutritionGap(nutritionState) {
  const gaps = [];
  if (nutritionState.protein === 'Light') gaps.push('protein');
  if (nutritionState.vegetables !== 'Good variety') gaps.push('vegetables');
  if (nutritionState.wholeFoods === 'Mostly processed') gaps.push('whole foods');
  return gaps.join(', ');
}

// ─── Checkmark circle ─────────────────────────────────────────────────────────

function CheckCircle({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
      checked ? 'bg-basket-green-500 border-basket-green-500' : 'border-gray-300 bg-white'
    }`}>
      {checked && (
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors">
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanWeekPage() {
  const profile = getProfile();
  const favourites = getFavouriteRecipes();

  // ── Step navigation ──────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [ratings, setRatings] = useState({});           // { mealName: { stars, one_line } }
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [tooltipMeal, setTooltipMeal] = useState(null);

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const defaultPortions = Math.max(1, profile?.members?.length || 2);
  const [portions, setPortions] = useState(defaultPortions);
  const [budget, setBudget] = useState(String(profile?.budget?.max || 60));

  // ── Step 3 state ─────────────────────────────────────────────────────────
  const [shoppingList, setShoppingList] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  // ── Load ratings on mount (with cache) ───────────────────────────────────
  useEffect(() => {
    if (!favourites.length) return;

    const cached = getMealRatings();
    if (cached?.ratings?.length) {
      const lastRated = new Date(cached.savedAt);
      const hasNew = favourites.some(f => new Date(f.savedAt) > lastRated);
      if (!hasNew) {
        const map = {};
        for (const r of cached.ratings) map[r.meal_name] = r;
        setRatings(map);
        return;
      }
    }

    setRatingsLoading(true);
    rateMeals(favourites)
      .then(result => {
        if (result?.ratings) {
          const map = {};
          for (const r of result.ratings) map[r.meal_name] = r;
          setRatings(map);
          saveMealRatings(result.ratings);
        }
      })
      .catch(console.error)
      .finally(() => setRatingsLoading(false));
  }, []);

  // ── Load initial AI suggestions ───────────────────────────────────────────
  useEffect(() => { loadSuggestions(''); }, []);

  async function loadSuggestions(gap) {
    setSuggestionsLoading(true);
    try {
      const result = await getMealSuggestions(gap);
      if (result?.suggestions) {
        setAiSuggestions(result.suggestions);
        // Merge AI ratings into the main ratings map so the nutrition panel works
        setRatings(prev => {
          const next = { ...prev };
          for (const s of result.suggestions) {
            next[s.name] = { meal_name: s.name, stars: s.stars, one_line: s.one_line };
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Suggestions failed:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  // ── Meal selection helpers ────────────────────────────────────────────────
  function toggleMeal(meal) {
    setSelectedMeals(prev =>
      prev.some(m => m.name === meal.name)
        ? prev.filter(m => m.name !== meal.name)
        : [...prev, meal]
    );
  }

  function isMealSelected(name) {
    return selectedMeals.some(m => m.name === name);
  }

  // ── Live nutrition panel (derived, no API call) ───────────────────────────
  const nutritionState = deriveNutritionState(selectedMeals, ratings);

  // ── Generate shopping list ────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateMealShoppingList({
        meals: selectedMeals,
        portions,
        budget: parseFloat(budget) || 60,
      });
      setShoppingList(result);
      setStep(3);
    } catch (err) {
      console.error('Shopping list generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  function handleCopy() {
    if (!shoppingList) return;
    const lines = ['Shopping List', '=============', ''];
    for (const group of shoppingList.groups || []) {
      lines.push(group.category.toUpperCase());
      for (const item of group.items || []) {
        lines.push(`  • ${item.name} — ${item.quantity} (£${item.estimated_price?.toFixed(2) ?? '?'})${item.allergen_flag ? ' ⚠️' : ''}`);
      }
      lines.push('');
    }
    lines.push(`Estimated total: £${shoppingList.total_estimated_cost?.toFixed(2) ?? '0.00'}`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyConfirmed(true);
      setTimeout(() => setCopyConfirmed(false), 2000);
    });
  }

  // ── Save list ─────────────────────────────────────────────────────────────
  function handleSave() {
    saveShoppingList({
      meals: selectedMeals.map(m => m.name),
      portions,
      budget: parseFloat(budget),
      groups: shoppingList.groups,
      total_estimated_cost: shoppingList.total_estimated_cost,
    });
    setSaveConfirmed(true);
    setTimeout(() => setSaveConfirmed(false), 2000);
  }

  // ── Budget status display ─────────────────────────────────────────────────
  function budgetStatusInfo() {
    const total = shoppingList?.total_estimated_cost || 0;
    const bud = parseFloat(budget) || 60;
    const diff = Math.abs(bud - total).toFixed(2);
    if (shoppingList?.budget_status === 'over') {
      return {
        cls: 'bg-red-50 text-red-700 border border-red-200',
        text: `Estimated ${formatPrice(total)} — £${diff} over budget. Consider removing one meal.`,
      };
    }
    if (shoppingList?.budget_status === 'tight') {
      return {
        cls: 'bg-amber-50 text-amber-700 border border-amber-200',
        text: `Estimated ${formatPrice(total)} — close to your £${bud} budget`,
      };
    }
    return {
      cls: 'bg-green-50 text-green-700 border border-green-200',
      text: `Estimated ${formatPrice(total)} — £${diff} within your budget`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3 — Shopping List
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 3 && shoppingList) {
    const { cls, text } = budgetStatusInfo();
    return (
      <AnimatedPage className="pb-32 space-y-4">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setStep(2)} />
          <h2 className="text-xl font-bold text-gray-900">Shopping List</h2>
        </div>

        {/* Budget status banner */}
        <div className={`rounded-xl px-4 py-3 ${cls}`}>
          <p className="text-sm font-semibold">{text}</p>
        </div>

        {/* Grouped items */}
        {(shoppingList.groups || []).map(group => (
          <Card key={group.category}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.category}
            </h3>
            <div className="divide-y divide-gray-100">
              {(group.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.allergen_flag && (
                      <span
                        title={item.allergen_name ? `Contains: ${item.allergen_name}` : 'May contain allergen'}
                        className="text-base leading-none flex-shrink-0 cursor-help"
                      >
                        ⚠️
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">
                    £{item.estimated_price?.toFixed(2) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {/* Fixed bottom actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom z-30">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copyConfirmed ? 'Copied ✓' : 'Copy List'}
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saveConfirmed}>
              {saveConfirmed ? 'Saved ✓' : 'Save List'}
            </Button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2 — Batch Parameters
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 2) {
    return (
      <AnimatedPage className="space-y-5">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setStep(1)} />
          <h2 className="text-xl font-bold text-gray-900">Batch Settings</h2>
        </div>

        {/* Portions stepper */}
        <Card>
          <CardTitle>How many portions per meal?</CardTitle>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Each meal will be scaled to this many portions</p>
          <div className="flex items-center gap-5">
            <button
              onClick={() => setPortions(p => Math.max(1, p - 1))}
              disabled={portions <= 1}
              className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-2xl font-semibold transition-colors"
            >
              −
            </button>
            <span className="text-3xl font-bold text-gray-900 w-10 text-center tabular-nums">{portions}</span>
            <button
              onClick={() => setPortions(p => Math.min(12, p + 1))}
              disabled={portions >= 12}
              className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-2xl font-semibold transition-colors"
            >
              +
            </button>
          </div>
        </Card>

        {/* Budget input */}
        <Card>
          <CardTitle>Weekly shop budget</CardTitle>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">For this shop only — won't update your saved budget</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">£</span>
            <input
              type="number"
              min="1"
              max="999"
              inputMode="numeric"
              className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-basket-green-500"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </div>
        </Card>

        {/* Meal summary */}
        <Card padding="sm" className="bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedMeals.map(m => (
              <Badge key={m.name} variant="primary" size="sm">{m.name}</Badge>
            ))}
          </div>
        </Card>

        <Button
          onClick={handleGenerate}
          loading={generating}
          disabled={generating}
          className="w-full"
        >
          Generate Shopping List
        </Button>
      </AnimatedPage>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1 — Meal Selection
  // ═══════════════════════════════════════════════════════════════════════════

  const pillColour = (val, good, mid) =>
    val === good ? 'bg-green-100 text-green-700' :
    val === mid  ? 'bg-amber-100 text-amber-700' :
                   'bg-gray-100 text-gray-500';

  return (
    <AnimatedPage className="pb-36 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Plan My Week</h2>

      {/* ── Live nutrition panel ───────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3">
          <StrengthBars bars={nutritionState.bars} colour={nutritionState.colour} />
          <p className="text-sm font-medium text-gray-800 leading-snug">{nutritionState.headline}</p>
        </div>
        {selectedMeals.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pillColour(nutritionState.protein, 'Strong', 'Moderate')}`}>
              🥩 Protein: {nutritionState.protein}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pillColour(nutritionState.vegetables, 'Good variety', 'Limited')}`}>
              🥦 Veg: {nutritionState.vegetables}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pillColour(nutritionState.wholeFoods, 'Mostly whole', 'Mixed')}`}>
              🌾 Whole foods: {nutritionState.wholeFoods}
            </span>
          </div>
        )}
      </Card>

      {/* ── Your Favourites ────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between h-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Favourites</h3>
          {ratingsLoading && <span className="text-xs text-gray-400">Rating meals…</span>}
        </div>

        {favourites.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-sm text-gray-500">
              No favourite meals saved yet.<br />Save a batch cook recipe from the Scan tab first.
            </p>
          </Card>
        ) : (
          favourites.map(recipe => {
            const rating = ratings[recipe.name];
            const selected = isMealSelected(recipe.name);
            return (
              <div
                key={recipe.id}
                onClick={() => toggleMeal({ name: recipe.name, source: 'favourite', recipe })}
                className={`rounded-2xl border-2 p-3 cursor-pointer transition-all select-none ${
                  selected
                    ? 'border-basket-green-500 bg-basket-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{recipe.name}</p>
                    {recipe.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{recipe.description}</p>
                    )}
                    {rating && (
                      <div className="mt-1">
                        <StarBadge
                          stars={rating.stars}
                          oneLine={rating.one_line}
                          showTooltip={tooltipMeal === recipe.name}
                          onToggle={e => {
                            e.stopPropagation();
                            setTooltipMeal(prev => prev === recipe.name ? null : recipe.name);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <CheckCircle checked={selected} />
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── AI Suggestions ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between h-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Suggestions</h3>
          <button
            onClick={() => loadSuggestions(getNutritionGap(nutritionState))}
            disabled={suggestionsLoading}
            className="text-xs text-basket-green-600 hover:text-basket-green-700 disabled:text-gray-400 font-medium transition-colors"
          >
            {suggestionsLoading ? 'Loading…' : 'Refresh suggestions'}
          </button>
        </div>

        {suggestionsLoading && !aiSuggestions.length ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          aiSuggestions.map(suggestion => {
            const selected = isMealSelected(suggestion.name);
            const starColour =
              suggestion.stars === 3 ? 'text-green-600' :
              suggestion.stars === 2 ? 'text-amber-500' : 'text-gray-400';
            return (
              <div
                key={suggestion.name}
                onClick={() => toggleMeal({ name: suggestion.name, source: 'ai' })}
                className={`rounded-2xl border-2 p-3 cursor-pointer transition-all select-none ${
                  selected
                    ? 'border-basket-green-500 bg-basket-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{suggestion.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{suggestion.cuisine}</span>
                      {suggestion.stars && (
                        <span className={`text-xs font-medium ${starColour}`}>
                          {'★'.repeat(suggestion.stars)}{'☆'.repeat(3 - suggestion.stars)}
                        </span>
                      )}
                    </div>
                  </div>
                  <CheckCircle checked={selected} />
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Persistent bottom bar ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom z-30">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full"
            disabled={selectedMeals.length === 0}
            onClick={() => setStep(2)}
          >
            {selectedMeals.length === 0
              ? 'Select at least one meal'
              : `${selectedMeals.length} meal${selectedMeals.length !== 1 ? 's' : ''} selected — Next`}
          </Button>
        </div>
      </div>
    </AnimatedPage>
  );
}

export default PlanWeekPage;
