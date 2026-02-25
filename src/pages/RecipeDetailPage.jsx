import { useState } from 'react';

// Full-screen recipe detail overlay — covers tab bar intentionally.
// Handles both imported recipes (method[] format) and batch-cooking recipes (method[{step,instruction}] format).
// Props:
//   recipe  — the recipe object
//   onBack  — called when user taps the back arrow
//   onSave  — optional; when provided shows a "Save" button in the header
export function RecipeDetailPage({ recipe, onBack, onSave }) {
  const [cookMode, setCookMode] = useState(false);
  const [cookStep, setCookStep] = useState(0);

  if (!recipe) return null;

  // Normalise step list — handles every format Claude may return:
  //   method: [{step, instruction}, ...]  ← batch cooking format (current)
  //   method: ["step text", ...]          ← plain string format
  //   method: [{step, text|description}, ...] ← Claude variant field names
  //   instructions: ["step text", ...]    ← older batch cooking format
  //   steps: ["step text", ...]           ← another Claude variant
  function extractText(m) {
    if (typeof m === 'string') return m.trim();
    if (!m || typeof m !== 'object') return '';
    // Try every field name Claude has been known to use
    const text = m.instruction || m.text || m.description || m.content || m.step || m.value || '';
    // If the value itself is an object (nested), stringify it as a last resort
    if (typeof text === 'object') return JSON.stringify(text);
    return String(text).trim();
  }

  const rawSteps =
    (Array.isArray(recipe.method) && recipe.method.length > 0 ? recipe.method : null) ||
    (Array.isArray(recipe.instructions) && recipe.instructions.length > 0 ? recipe.instructions : null) ||
    (Array.isArray(recipe.steps) && recipe.steps.length > 0 ? recipe.steps : null) ||
    [];

  const steps = rawSteps.map(extractText).filter(Boolean);

  // Normalise ingredient display — handles {amount, unit, item}, {amount, item}, {quantity, item}
  function formatIngredient(ing) {
    const qty = ing.amount || ing.quantity || '';
    const parts = [qty, ing.unit, ing.item].filter(Boolean);
    return parts.join(' ') || ing.item || ing.name || '';
  }

  const portions = recipe.portions || recipe.servings;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">

      {/* Sticky header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 font-bold text-gray-900 leading-tight line-clamp-2">{recipe.name}</h1>
        {onSave && (
          <button
            onClick={onSave}
            className="flex-shrink-0 text-sm font-semibold text-basket-green-600 hover:text-basket-green-700 px-3 py-1.5 hover:bg-basket-green-50 rounded-lg transition-colors"
          >
            Save
          </button>
        )}
      </div>

      <div className="px-4 pt-5 pb-16 space-y-6">

        {/* Prep / cook time / portions badges */}
        <div className="flex flex-wrap gap-2">
          {recipe.prepTime && (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
              ⏱ Prep {recipe.prepTime}
            </span>
          )}
          {recipe.cookTime && (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
              🍳 Cook {recipe.cookTime}
            </span>
          )}
          {portions && (
            <span className="inline-flex items-center gap-1.5 bg-basket-green-100 text-basket-green-700 px-3 py-1.5 rounded-full text-sm font-medium">
              🍽 {portions} portions
            </span>
          )}
        </div>

        {/* Nutrition highlight */}
        {recipe.nutritionHighlight && (
          <p className="text-xs text-basket-green-700 bg-basket-green-50 border border-basket-green-100 rounded-full px-3 py-1.5 inline-block">
            ✦ {recipe.nutritionHighlight}
          </p>
        )}

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Ingredients</h2>
            <ul className="space-y-2.5">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-basket-green-500 flex-shrink-0 mt-2" />
                  <span>{formatIngredient(ing)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Method */}
        {steps.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Method</h2>
            <ol className="space-y-4">
              {steps.map((instruction, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 bg-basket-green-100 text-basket-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 leading-relaxed">{instruction}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Equipment */}
        {recipe.equipment?.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Equipment</h2>
            <ul className="flex flex-wrap gap-2">
              {recipe.equipment.map((e, i) => (
                <li key={i} className="bg-gray-100 text-gray-700 text-sm rounded-full px-3 py-1">
                  {e}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Storage & reheating */}
        {recipe.storage && (
          <section className="bg-blue-50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-blue-800 mb-1">Storage &amp; Reheating</h2>
            <p className="text-sm text-blue-700 leading-relaxed">{recipe.storage}</p>
          </section>
        )}

        {/* Tips (older batch cooking recipes) */}
        {recipe.tips?.length > 0 && (
          <section className="bg-amber-50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-amber-800 mb-2">Tips</h2>
            <ul className="space-y-1.5">
              {recipe.tips.map((tip, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="flex-shrink-0">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cook Mode button */}
        {steps.length > 0 && (
          <button
            onClick={() => { setCookStep(0); setCookMode(true); }}
            className="w-full py-3 bg-basket-green-600 hover:bg-basket-green-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Start Cook Mode
          </button>
        )}

        {/* Source attribution */}
        {recipe.sourceUrl && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Original source:{' '}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-basket-green-600 hover:underline"
              >
                {recipe.sourceName || recipe.sourceUrl}
              </a>
            </p>
          </div>
        )}

      </div>

      {/* ── Cook Mode overlay ──────────────────────────────────────────────── */}
      {cookMode && (
        <div className="fixed inset-0 z-[60] bg-gray-900 flex flex-col select-none">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-12 pb-4">
            <span className="text-gray-400 text-sm font-medium">
              Step {cookStep + 1} of {steps.length}
            </span>
            <button
              onClick={() => setCookMode(false)}
              className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ✕ Exit
            </button>
          </div>

          {/* Step instruction — large, centered */}
          <div className="flex-1 flex items-center justify-center px-8">
            <p className="text-white text-3xl font-medium leading-snug text-center">
              {steps[cookStep]}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 py-6">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === cookStep ? 'bg-white' : 'bg-gray-600'}`}
              />
            ))}
          </div>

          {/* Prev / Next / Done */}
          <div className="flex gap-4 px-6 pb-12">
            <button
              disabled={cookStep === 0}
              onClick={() => setCookStep(s => s - 1)}
              className="flex-1 py-4 rounded-xl border border-gray-600 text-gray-300 text-lg font-semibold disabled:opacity-30 transition-opacity"
            >
              ← Prev
            </button>
            {cookStep < steps.length - 1 ? (
              <button
                onClick={() => setCookStep(s => s + 1)}
                className="flex-1 py-4 rounded-xl bg-basket-green-600 hover:bg-basket-green-700 text-white text-lg font-semibold transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setCookMode(false)}
                className="flex-1 py-4 rounded-xl bg-basket-green-600 hover:bg-basket-green-700 text-white text-lg font-semibold transition-colors"
              >
                Done ✓
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

export default RecipeDetailPage;
