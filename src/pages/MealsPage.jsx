import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useClaudeAI } from '../hooks/useClaudeAI';
import { RecipeDetailPage } from './RecipeDetailPage';
import {
  getShoppingHistory,
  getMealPreferences,
  updateMealPreferences,
  getFavouriteRecipes,
  removeFavouriteRecipe,
  updateFavouriteRecipe,
  getLastWeekMeals,
} from '../services/storage';
import { formatRelativeDate } from '../utils/formatters';

export function MealsPage() {
  const { loading, generateBatchCooking } = useClaudeAI();
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [generatedRecipes, setGeneratedRecipes] = useState(null);

  // Meal lists
  const [adultMeals, setAdultMeals] = useState([]);
  const [kidMeals, setKidMeals] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [activeShoppingMeals, setActiveShoppingMeals] = useState([]);

  // Management UI state
  const [confirmingDelete, setConfirmingDelete] = useState(null); // { section, id }
  const [fadingOut, setFadingOut] = useState(new Set());
  const [editingMeal, setEditingMeal] = useState(null);           // { section, id, value } — for string meals
  const [editingFavourite, setEditingFavourite] = useState(null); // recipe object copy — for favourites
  const [showManage, setShowManage] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(null);           // { action, label, count }
  const [shoppingListWarning, setShoppingListWarning] = useState(null); // { section, id, name }

  useEffect(() => { loadData(); }, []);

  function loadData() {
    const prefs = getMealPreferences();
    setAdultMeals(prefs.adults || []);
    setKidMeals(prefs.kids || []);
    setFavourites(getFavouriteRecipes());
    setActiveShoppingMeals(getLastWeekMeals() || []);
  }

  const history = getShoppingHistory();
  const lastShop = history[0];

  // ─── Delete ───────────────────────────────────────────────────────────────

  function handleDeleteClick(section, id, name) {
    const inList = activeShoppingMeals.some(
      m => (typeof m === 'string' ? m : m.name) === name
    );
    if (inList) {
      setShoppingListWarning({ section, id, name });
    } else {
      setConfirmingDelete({ section, id });
    }
  }

  function executeDeletion(section, id) {
    setConfirmingDelete(null);
    setShoppingListWarning(null);

    const key = `${section}:${id}`;
    setFadingOut(prev => new Set([...prev, key]));

    setTimeout(() => {
      if (section === 'adults') {
        const updated = adultMeals.filter(m => m !== id);
        setAdultMeals(updated);
        updateMealPreferences('adults', updated);
      } else if (section === 'kids') {
        const updated = kidMeals.filter(m => m !== id);
        setKidMeals(updated);
        updateMealPreferences('kids', updated);
      } else if (section === 'favourites') {
        removeFavouriteRecipe(id);
        setFavourites(prev => prev.filter(r => r.id !== id));
      }
      setFadingOut(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 300);
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function saveStringMealEdit() {
    if (!editingMeal?.value.trim()) return;
    const { section, id, value } = editingMeal;
    const newValue = value.trim();
    if (section === 'adults') {
      const updated = adultMeals.map(m => m === id ? newValue : m);
      setAdultMeals(updated);
      updateMealPreferences('adults', updated);
    } else if (section === 'kids') {
      const updated = kidMeals.map(m => m === id ? newValue : m);
      setKidMeals(updated);
      updateMealPreferences('kids', updated);
    }
    setEditingMeal(null);
  }

  function saveFavouriteEdit() {
    if (!editingFavourite?.name?.trim()) return;
    const { id, name, description, servings, prepTime, cookTime } = editingFavourite;
    const updates = { name: name.trim(), description, servings, prepTime, cookTime };
    updateFavouriteRecipe(id, updates);
    setFavourites(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setEditingFavourite(null);
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────

  function handleBulkAction(action) {
    const counts = {
      adults: adultMeals.length,
      kids: kidMeals.length,
      all: adultMeals.length + kidMeals.length + favourites.length,
    };
    const labels = {
      adults: "Adults' Meals",
      kids: "Children's Meals",
      all: 'All Favourites',
    };
    setBulkConfirm({ action, label: labels[action], count: counts[action] });
  }

  function executeBulkAction() {
    const { action } = bulkConfirm;
    if (action === 'adults' || action === 'all') {
      setAdultMeals([]);
      updateMealPreferences('adults', []);
    }
    if (action === 'kids' || action === 'all') {
      setKidMeals([]);
      updateMealPreferences('kids', []);
    }
    if (action === 'all') {
      favourites.forEach(r => removeFavouriteRecipe(r.id));
      setFavourites([]);
    }
    setBulkConfirm(null);
    setShowManage(false);
  }

  // ─── Batch cooking ────────────────────────────────────────────────────────

  const handleGenerateNew = async () => {
    if (!lastShop?.items) return;
    try {
      const result = await generateBatchCooking(lastShop.items.map(i => ({
        name: i.translatedName || i.name || i.code,
        code: i.code,
      })));
      setGeneratedRecipes(result.recipes);
    } catch (err) {
      console.error('Failed to generate recipes:', err);
    }
  };

  const recipes = generatedRecipes || [];

  // ─── Render helpers ───────────────────────────────────────────────────────

  const isFading = (section, id) => fadingOut.has(`${section}:${id}`);

  const editIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
  const deleteIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  function renderStringMealCard(section, meal) {
    const isConfirming = confirmingDelete?.section === section && confirmingDelete?.id === meal;
    const isEditing = editingMeal?.section === section && editingMeal?.id === meal;
    const fading = isFading(section, meal);

    return (
      <div
        key={meal}
        className={`transition-all duration-300 overflow-hidden ${fading ? 'opacity-0 max-h-0' : 'opacity-100 max-h-48'}`}
      >
        <Card padding="sm">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
                value={editingMeal.value}
                onChange={e => setEditingMeal(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveStringMealEdit();
                  if (e.key === 'Escape') setEditingMeal(null);
                }}
              />
              <Button size="sm" onClick={saveStringMealEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingMeal(null)}>Cancel</Button>
            </div>
          ) : isConfirming ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Remove <span className="font-medium">{meal}</span> from favourites?
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => executeDeletion(section, meal)}>
                  Yes, Remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{meal}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditingMeal({ section, id: meal, value: meal })}
                  className="p-1.5 text-gray-400 hover:text-basket-green-600 hover:bg-basket-green-50 rounded-lg transition-colors"
                  aria-label="Edit meal"
                >
                  {editIcon}
                </button>
                <button
                  onClick={() => handleDeleteClick(section, meal, meal)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete meal"
                >
                  {deleteIcon}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  function renderFavouriteCard(recipe) {
    const isConfirming = confirmingDelete?.section === 'favourites' && confirmingDelete?.id === recipe.id;
    const fading = isFading('favourites', recipe.id);

    return (
      <div
        key={recipe.id}
        className={`transition-all duration-300 overflow-hidden ${fading ? 'opacity-0 max-h-0' : 'opacity-100 max-h-48'}`}
      >
        <Card padding="sm">
          {isConfirming ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Remove <span className="font-medium">{recipe.name}</span> from favourites?
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => executeDeletion('favourites', recipe.id)}>
                  Yes, Remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{recipe.name}</p>
                {recipe.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {recipe.servings && <span>{recipe.servings} portions</span>}
                  {recipe.prepTime && <span>Prep {recipe.prepTime}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setSelectedRecipe(recipe)}
                  className="p-1.5 text-gray-400 hover:text-basket-green-600 hover:bg-basket-green-50 rounded-lg transition-colors"
                  aria-label="View recipe"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => setEditingFavourite({ ...recipe })}
                  className="p-1.5 text-gray-400 hover:text-basket-green-600 hover:bg-basket-green-50 rounded-lg transition-colors"
                  aria-label="Edit recipe"
                >
                  {editIcon}
                </button>
                <button
                  onClick={() => handleDeleteClick('favourites', recipe.id, recipe.name)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete recipe"
                >
                  {deleteIcon}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const totalMeals = adultMeals.length + kidMeals.length + favourites.length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Meals</h2>
        {totalMeals > 0 && (
          <button
            onClick={() => setShowManage(v => !v)}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showManage ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {/* Manage panel */}
      {showManage && (
        <Card padding="sm" className="bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bulk Actions</p>
          <div className="flex flex-wrap gap-2">
            {adultMeals.length > 0 && (
              <button
                onClick={() => handleBulkAction('adults')}
                className="text-sm text-red-600 border border-red-200 bg-white px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear Adults' Meals ({adultMeals.length})
              </button>
            )}
            {kidMeals.length > 0 && (
              <button
                onClick={() => handleBulkAction('kids')}
                className="text-sm text-red-600 border border-red-200 bg-white px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear Children's Meals ({kidMeals.length})
              </button>
            )}
            {totalMeals > 0 && (
              <button
                onClick={() => handleBulkAction('all')}
                className="text-sm font-medium text-red-700 border border-red-300 bg-white px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear All Favourites ({totalMeals})
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Empty state — shown when all three sections are empty */}
      {totalMeals === 0 && (
        <Card className="text-center py-10">
          <div className="space-y-3">
            <span className="text-4xl">🍽️</span>
            <p className="font-medium text-gray-800">No favourite meals saved yet.</p>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Add your first meal manually, import from a recipe URL, or save one from your next batch cooking plan.
            </p>
            <div className="pt-1">
              <Button size="sm">Add a Meal</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Family Favourites */}
      {favourites.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Family Favourites</h3>
          {favourites.map(recipe => renderFavouriteCard(recipe))}
        </section>
      )}

      {/* Adults' Meals */}
      {adultMeals.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adults' Meals</h3>
          {adultMeals.map(meal => renderStringMealCard('adults', meal))}
        </section>
      )}

      {/* Children's Meals */}
      {kidMeals.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Children's Meals</h3>
          {kidMeals.map(meal => renderStringMealCard('kids', meal))}
        </section>
      )}

      {/* Batch Cooking */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch Cooking</h3>

        {!lastShop ? (
          <Card className="text-center py-8">
            <div className="space-y-3">
              <span className="text-5xl">🍳</span>
              <h3 className="font-semibold text-gray-900">No Shopping History</h3>
              <p className="text-sm text-gray-500">
                Scan a receipt first to get batch cooking suggestions based on your ingredients
              </p>
            </div>
          </Card>
        ) : recipes.length === 0 ? (
          <Card className="text-center py-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Generate Batch Cooking Plan</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Get 2 kid-friendly recipes using ingredients from your last shop
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Last shop: {formatRelativeDate(lastShop.date)} ({lastShop.items?.length || 0} items)
                </p>
              </div>
              <Button onClick={handleGenerateNew} loading={loading} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Recipes'}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Each recipe makes 8 portions — enough for 4 people over 2 days
            </p>
            {recipes.map((recipe, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedRecipe(recipe)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-basket-green-100 rounded-lg flex items-center justify-center text-2xl">
                    {index === 0 ? '🍝' : '🍛'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                      <Badge variant="primary" size="sm">{recipe.servings} portions</Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>⏱ Prep: {recipe.prepTime}</span>
                      <span>🍳 Cook: {recipe.cookTime}</span>
                      {recipe.kidFriendlyRating && (
                        <span>👶 Kid rating: {recipe.kidFriendlyRating}/5</span>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            ))}
            <Button
              variant="outline"
              onClick={handleGenerateNew}
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Generate Different Recipes
            </Button>
          </div>
        )}
      </section>

      {/* ── Recipe detail screen ─────────────────────────────────────────── */}
      {selectedRecipe && (
        <RecipeDetailPage
          recipe={selectedRecipe}
          onBack={() => setSelectedRecipe(null)}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Bulk clear confirmation */}
      <Modal isOpen={!!bulkConfirm} onClose={() => setBulkConfirm(null)} title="Clear Meals">
        {bulkConfirm && (
          <div className="space-y-4">
            <p className="text-gray-700">
              This will remove all <strong>{bulkConfirm.count}</strong> saved {bulkConfirm.label.toLowerCase()}. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setBulkConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={executeBulkAction}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Shopping list protection warning */}
      <Modal
        isOpen={!!shoppingListWarning}
        onClose={() => setShoppingListWarning(null)}
        title="Meal in Current Shopping List"
      >
        {shoppingListWarning && (
          <div className="space-y-4">
            <p className="text-gray-700">
              <strong>{shoppingListWarning.name}</strong> is in your current shopping list. Removing it won't update the list automatically.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShoppingListWarning(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => executeDeletion(shoppingListWarning.section, shoppingListWarning.id)}
              >
                Remove Anyway
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit favourite recipe */}
      <Modal isOpen={!!editingFavourite} onClose={() => setEditingFavourite(null)} title="Edit Recipe">
        {editingFavourite && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
                value={editingFavourite.name}
                onChange={e => setEditingFavourite(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500 resize-none"
                value={editingFavourite.description || ''}
                onChange={e => setEditingFavourite(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
                  value={editingFavourite.servings || ''}
                  onChange={e => setEditingFavourite(prev => ({ ...prev, servings: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
                  value={editingFavourite.prepTime || ''}
                  onChange={e => setEditingFavourite(prev => ({ ...prev, prepTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cook Time</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
                  value={editingFavourite.cookTime || ''}
                  onChange={e => setEditingFavourite(prev => ({ ...prev, cookTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditingFavourite(null)}>Cancel</Button>
              <Button onClick={saveFavouriteEdit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

export default MealsPage;
