// Full-screen recipe detail overlay — covers tab bar intentionally.
// Handles both imported recipes (method[] format) and batch-cooking recipes (instructions[] format).
export function RecipeDetailPage({ recipe, onBack }) {
  if (!recipe) return null;

  // Normalise step list — Claude may return:
  //   method: [{step, instruction}, ...]   ← expected import format
  //   method: ["step text", ...]           ← Claude occasionally returns strings
  //   instructions: ["step text", ...]     ← batch cooking format
  const steps = [];
  if (recipe.method?.length) {
    for (const m of recipe.method) {
      if (typeof m === 'string') steps.push(m);
      else if (m?.instruction) steps.push(m.instruction);
    }
  } else if (recipe.instructions?.length) {
    steps.push(...recipe.instructions);
  }

  // Normalise ingredient display — Claude may use "amount"+"unit"+"item" (new)
  // or "quantity"+"item" (old field names) or "amount"+"item" (no unit).
  function formatIngredient(ing) {
    const qty = ing.amount || ing.quantity || '';
    const parts = [qty, ing.unit, ing.item].filter(Boolean);
    return parts.join(' ') || ing.item || ing.name || '';
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">

      {/* Sticky header with back button */}
      <div className="sticky top-0 bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Back to Meals"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 leading-tight line-clamp-2">{recipe.name}</h1>
      </div>

      <div className="px-4 pt-5 pb-16 space-y-6">

        {/* Prep / cook time / servings badges */}
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
          {recipe.servings && (
            <span className="inline-flex items-center gap-1.5 bg-basket-green-100 text-basket-green-700 px-3 py-1.5 rounded-full text-sm font-medium">
              🍽 {recipe.servings} portions
            </span>
          )}
        </div>

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

        {/* Method / Instructions */}
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

        {/* Tips (batch cooking recipes only) */}
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
    </div>
  );
}

export default RecipeDetailPage;
