import { useState } from 'react';
import { Card, CardTitle, CardDescription } from '../components/ui/Card';
import { AnimatedPage } from '../components/AnimatedPage';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useClaudeAI } from '../hooks/useClaudeAI';
import { findRecipeAlternatives } from '../services/claude';
import {
  getMealPreferences, addMeal, removeMeal,
  getProductDictionary, addProductTranslation, removeProductTranslation,
  getSettings, updateSettings, resetToDefaults,
  getFavouriteRecipes, saveFavouriteRecipe, removeFavouriteRecipe,
} from '../services/storage';
import {
  getProfile, saveProfile, clearProfile,
  getUsage, LIFE_STAGES, SUPERMARKETS, ADULT_NOTES_OPTIONS,
  ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES,
} from '../services/profile';

// ─── Inline member form (reused from Onboarding) ─────────────────────────────
function MemberForm({ initial, onSave, onCancel }) {
  const [name, setName]           = useState(initial?.name || '');
  const [lifeStage, setLifeStage] = useState(initial?.lifeStage || 'adult');
  const [notes, setNotes]         = useState(initial?.notes || []);
  const isAdult = lifeStage === 'adult' || lifeStage === 'senior';
  const toggleNote = (v) => setNotes(p => p.includes(v) ? p.filter(n => n !== v) : [...p, v]);

  return (
    <div className="bg-gray-200 rounded-xl p-4 space-y-4 border border-gray-300">
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Name <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. Mum, Theo…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Life stage</label>
        <div className="grid grid-cols-5 gap-1">
          {Object.entries(LIFE_STAGES).map(([key, stage]) => (
            <button key={key} onClick={() => { setLifeStage(key); setNotes([]); }}
              className={`flex flex-col items-center p-1.5 rounded-xl border-2 transition-colors text-center ${
                lifeStage === key ? 'border-basket-green-500 bg-basket-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <span className="text-lg">{stage.emoji}</span>
              <span className="text-xs font-medium text-gray-700 leading-tight">{stage.label}</span>
            </button>
          ))}
        </div>
      </div>
      {isAdult && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Anything to note? <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setNotes([])}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${notes.length === 0 ? 'bg-basket-green-600 text-white border-basket-green-600' : 'border-gray-300 text-gray-600'}`}>
              None
            </button>
            {ADULT_NOTES_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => toggleNote(opt.value)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${notes.includes(opt.value) ? 'bg-basket-green-600 text-white border-basket-green-600' : 'border-gray-300 text-gray-600'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button size="sm" onClick={() => onSave({ name: name.trim(), lifeStage, notes: isAdult ? notes : [] })} className="flex-1">
          {initial ? 'Update' : 'Add'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main settings page ───────────────────────────────────────────────────────
export function SettingsPage({ onProfileChange, onApiKeyChange }) {
  const [profile, setProfileState]   = useState(getProfile());
  const [preferences, setPreferences] = useState(getMealPreferences());
  const [dictionary, setDictionary]   = useState(getProductDictionary());
  const [settings, setSettings]       = useState(getSettings());
  const [savedRecipes, setSavedRecipes] = useState(getFavouriteRecipes());
  const usage                         = getUsage();

  // Profile editing modal
  const [showProfileModal, setShowProfileModal]   = useState(false);
  const [editProfile, setEditProfile]             = useState(null);

  // Members
  const [showMemberForm, setShowMemberForm]       = useState(false);

  // Meal modals
  const [showAddMealModal, setShowAddMealModal]   = useState(false);
  const [mealType, setMealType]                   = useState('adults');
  const [newMeal, setNewMeal]                     = useState('');

  // Code modals
  const [showAddCodeModal, setShowAddCodeModal]   = useState(false);
  const [newCode, setNewCode]                     = useState('');
  const [newName, setNewName]                     = useState('');

  const [showResetConfirm, setShowResetConfirm]         = useState(false);
  const [showResetProfileConfirm, setShowResetProfileConfirm] = useState(false);

  // Recipe import
  const [recipeUrl, setRecipeUrl]                 = useState('');
  const [importResult, setImportResult]           = useState(null);
  const [importError, setImportError]             = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [pastedText, setPastedText]               = useState('');
  const [recipeMealType, setRecipeMealType]       = useState('adults');
  const [alternatives, setAlternatives]           = useState([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const { importRecipe, loading: importLoading }  = useClaudeAI();

  // ── Profile helpers ──────────────────────────────────────────────────────
  const openProfileModal = () => {
    setEditProfile({ ...profile });
    setShowProfileModal(true);
  };

  const handleSaveProfile = () => {
    saveProfile(editProfile);
    setProfileState(getProfile());
    setShowProfileModal(false);
    onProfileChange?.();
  };

  const handleAddMemberToEdit = (member) => {
    setEditProfile(p => ({ ...p, members: [...(p.members || []), member] }));
    setShowMemberForm(false);
  };

  const handleRemoveMemberFromEdit = (i) => {
    setEditProfile(p => ({ ...p, members: p.members.filter((_, idx) => idx !== i) }));
  };

  // ── Meal helpers ─────────────────────────────────────────────────────────
  const handleAddMeal = () => {
    if (newMeal.trim()) {
      addMeal(mealType, newMeal.trim());
      setPreferences(getMealPreferences());
      setNewMeal('');
      setShowAddMealModal(false);
    }
  };

  const handleRemoveMeal = (type, meal) => {
    removeMeal(type, meal);
    setPreferences(getMealPreferences());
  };

  // ── Dictionary helpers ───────────────────────────────────────────────────
  const handleAddCode = () => {
    if (newCode.trim() && newName.trim()) {
      addProductTranslation(newCode.trim(), newName.trim());
      setDictionary(getProductDictionary());
      setNewCode(''); setNewName('');
      setShowAddCodeModal(false);
    }
  };

  const handleRemoveCode = (code) => {
    removeProductTranslation(code);
    setDictionary(getProductDictionary());
  };

  // ── Budget ───────────────────────────────────────────────────────────────
  const handleBudgetChange = (key, value) => {
    updateSettings({ [key]: parseInt(value) || 0 });
    setSettings(getSettings());
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleResetProfile = () => {
    clearProfile();
    setShowResetProfileConfirm(false);
    onProfileChange?.();
  };

  const handleReset = () => {
    resetToDefaults();
    clearProfile();
    setPreferences(getMealPreferences());
    setDictionary(getProductDictionary());
    setSettings(getSettings());
    setSavedRecipes(getFavouriteRecipes());
    setShowResetConfirm(false);
    onProfileChange?.();
  };

  // ── Recipe import ────────────────────────────────────────────────────────

  function resetImportState() {
    setImportResult(null); setImportError(''); setShowManualFallback(false);
    setPastedText(''); setAlternatives([]); setAlternativesLoading(false);
  }

  async function searchAlternatives(recipeName) {
    setAlternativesLoading(true);
    setAlternatives([]);
    try {
      const data = await findRecipeAlternatives(recipeName);
      setAlternatives(data.alternatives || []);
    } catch { /* silent — alternatives are best-effort */ }
    finally { setAlternativesLoading(false); }
  }

  const handleImportFromUrl = async () => {
    if (!recipeUrl.trim()) return;
    resetImportState();
    try {
      const result = await importRecipe(recipeUrl.trim(), undefined);
      if (!result.scrapable && !result.name) {
        setImportError(result.error || 'Could not fetch that page.');
        setShowManualFallback(true);
      } else {
        setImportResult(result);
        if (result.isIncomplete) searchAlternatives(result.name);
      }
    } catch (err) { setImportError(err.message); }
  };

  const handleTryAlternative = async (altUrl) => {
    setImportError('');
    try {
      const result = await importRecipe(altUrl, undefined);
      if (result.name) {
        setImportResult(result);
        setAlternatives([]);
        // If still incomplete, search again from the new name
        if (result.isIncomplete) searchAlternatives(result.name);
      } else {
        setImportError('Couldn\'t get the full recipe from that source either.');
        setShowManualFallback(true);
      }
    } catch (err) { setImportError(err.message); }
  };

  const handleExtractFromText = async () => {
    if (!pastedText.trim()) return;
    setImportError(''); setImportResult(null); setAlternatives([]);
    try {
      const result = await importRecipe(undefined, pastedText.trim());
      setImportResult(result);
    } catch (err) { setImportError(err.message); }
  };

  const handleSaveRecipe = () => {
    if (!importResult) return;
    saveFavouriteRecipe({
      name: importResult.name,
      servings: importResult.servings,
      prepTime: importResult.prepTime,
      cookTime: importResult.cookTime,
      ingredients: importResult.ingredients,
      method: importResult.method,
      sourceName: importResult.sourceName,
      sourceUrl: importResult.sourceUrl,
      importedDate: importResult.importedDate,
      mealType: recipeMealType,
    });
    addMeal(recipeMealType, importResult.name);
    setPreferences(getMealPreferences());
    setSavedRecipes(getFavouriteRecipes());
    setRecipeUrl('');
    resetImportState();
  };

  const handleDiscardRecipe = () => { setRecipeUrl(''); resetImportState(); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AnimatedPage className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      {/* ── Household Profile ── */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <CardTitle>Household Profile</CardTitle>
            <CardDescription>{profile?.householdName || 'Your household'} · {profile?.supermarket || ''}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={openProfileModal}>Edit</Button>
        </div>
        {profile?.members?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.members.map((m, i) => {
              const stage = LIFE_STAGES[m.lifeStage];
              const allergenCount = m.allergens?.length || 0;
              const dietaryCount = (m.dietaryPreferences?.length || 0) + (m.intolerances?.length || 0);
              return (
                <div key={i} className="flex items-center gap-1.5 bg-gray-200 rounded-full px-3 py-1 text-sm">
                  <span>{stage?.emoji}</span>
                  <span className="text-gray-700">{m.name || stage?.label}</span>
                  {m.notes?.length > 0 && <span className="text-gray-400">· {m.notes.join(', ')}</span>}
                  {allergenCount > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {allergenCount} allergen{allergenCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {dietaryCount > 0 && (
                    <span className="bg-basket-green-100 text-basket-green-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {dietaryCount} dietary
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>Budget: £{profile?.budget?.min ?? settings.budgetMin}–£{profile?.budget?.max ?? settings.budgetMax}</span>
          <span>Batch cook: {profile?.batchCooksPerWeek ?? 2}× /week · {profile?.daysPerBatch ?? 2} days</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetProfileConfirm(true)}
          className="mt-3 text-amber-600 border-amber-300 hover:bg-amber-50"
        >
          Reset Profile
        </Button>
      </Card>

      {/* ── API Key card hidden for testing phase — key is managed server-side ── */}

      {/* ── Usage ── */}
      <Card>
        <CardTitle>Usage</CardTitle>
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Total scans</span>
            <span className="font-medium">{usage.totalScans}</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated API cost</span>
            <span className="font-medium">£{(usage.totalScans * 0.03).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Key status</span>
            <span className="font-medium">Managed by server</span>
          </div>
          {usage.firstScanDate && (
            <div className="flex justify-between">
              <span>First scan</span>
              <span className="font-medium">{usage.firstScanDate}</span>
            </div>
          )}
        </div>
      </Card>

      {/* ── Budget ── */}
      <Card>
        <CardTitle>Weekly Budget</CardTitle>
        <CardDescription>Set your target spending range</CardDescription>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-500">Min</label>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">£</span>
              <Input type="number" value={settings.budgetMin}
                onChange={(e) => handleBudgetChange('budgetMin', e.target.value)} className="text-lg font-medium" />
            </div>
          </div>
          <span className="text-gray-400 mt-6">to</span>
          <div className="flex-1">
            <label className="text-sm text-gray-500">Max</label>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">£</span>
              <Input type="number" value={settings.budgetMax}
                onChange={(e) => handleBudgetChange('budgetMax', e.target.value)} className="text-lg font-medium" />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Adult Meals ── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardTitle>Adult Favourites</CardTitle>
            <CardDescription>Meals the adults enjoy</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setMealType('adults'); setShowAddMealModal(true); }}>+ Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {preferences.adults.map((meal, i) => (
            <Badge key={i} variant="primary" className="cursor-pointer hover:opacity-80"
              onClick={() => handleRemoveMeal('adults', meal)}>{meal} ×</Badge>
          ))}
        </div>
      </Card>

      {/* ── Kids Meals ── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardTitle>Kids&apos; Favourites</CardTitle>
            <CardDescription>Meals the children enjoy</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setMealType('kids'); setShowAddMealModal(true); }}>+ Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {preferences.kids.map((meal, i) => (
            <Badge key={i} variant="secondary" className="cursor-pointer hover:opacity-80"
              onClick={() => handleRemoveMeal('kids', meal)}>{meal} ×</Badge>
          ))}
        </div>
      </Card>

      {/* ── Import Recipe from URL ── */}
      <Card>
        <CardTitle>Import Recipe from URL</CardTitle>
        <CardDescription>Paste a recipe link — Claude extracts ingredients and maps them to store products</CardDescription>

        {!importResult && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input type="url" placeholder="https://www.bbcgoodfood.com/recipes/…"
                value={recipeUrl} onChange={(e) => setRecipeUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                disabled={importLoading}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500" />
              <Button onClick={handleImportFromUrl} loading={importLoading}
                disabled={!recipeUrl.trim() || importLoading} size="sm">Import</Button>
            </div>
            {importError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-medium">Could not fetch that page</p>
                <p className="text-amber-700 mt-0.5">{importError}</p>
              </div>
            )}
            {showManualFallback && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Paste the recipe text below instead:</p>
                <textarea rows={6} value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste the recipe ingredients and instructions here…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500 resize-none" />
                <Button onClick={handleExtractFromText} loading={importLoading}
                  disabled={!pastedText.trim() || importLoading} size="sm">Extract Recipe</Button>
              </div>
            )}
          </div>
        )}

        {importResult && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{importResult.name}</h3>
                <div className="flex gap-3 mt-1 text-sm text-gray-500">
                  {importResult.servings && <span>Serves {importResult.servings}</span>}
                  {importResult.prepTime && <span>Prep: {importResult.prepTime}</span>}
                  {importResult.cookTime && <span>Cook: {importResult.cookTime}</span>}
                </div>
              </div>
              {recipeUrl && (
                <a href={recipeUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-basket-green-600 hover:underline shrink-0 ml-2">View original</a>
              )}
            </div>

            {/* ── Incomplete scrape warning + alternatives ── */}
            {importResult.isIncomplete && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    We couldn't get the full recipe from that page
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Some ingredients are missing quantities or the method is incomplete.
                  </p>
                </div>

                {alternativesLoading ? (
                  <p className="text-xs text-amber-700 animate-pulse">Searching for alternatives…</p>
                ) : alternatives.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">We found these alternatives:</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => handleTryAlternative(alt.url)}
                        disabled={importLoading}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-100 hover:border-basket-green-400 hover:bg-basket-green-50 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="text-sm">
                          <span className="font-semibold text-gray-900">{alt.siteName}</span>
                          <span className="text-gray-500 ml-2">{importResult.name}</span>
                        </div>
                        <span className="text-basket-green-600 text-xs font-semibold shrink-0 ml-2">
                          {importLoading ? '…' : 'Try this →'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">No alternative sources found automatically.</p>
                )}

                {!showManualFallback && (
                  <button
                    onClick={() => setShowManualFallback(true)}
                    className="text-xs text-amber-700 underline underline-offset-2"
                  >
                    Or paste the recipe text manually
                  </button>
                )}
                {showManualFallback && (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste the recipe ingredients and instructions here…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500 resize-none"
                    />
                    <Button
                      onClick={handleExtractFromText}
                      loading={importLoading}
                      disabled={!pastedText.trim() || importLoading}
                      size="sm"
                    >
                      Extract Recipe
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Ingredients
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  {importResult.ingredients?.length || 0} items · scaled to {importResult.servings} portions
                </span>
              </p>
              <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                {(importResult.ingredients || []).map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="text-gray-500 shrink-0 w-20 text-xs tabular-nums">
                      {[ing.amount || ing.quantity, ing.unit].filter(Boolean).join(' ')}
                    </span>
                    <span className="text-gray-900 truncate">{ing.item || ing.name}</span>
                  </div>
                ))}
              </div>
            </div>
            {importResult.method?.length > 0 && (
              <p className="text-xs text-gray-500">
                {importResult.method.length} method steps extracted
              </p>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Add to favourites as:</p>
              <div className="flex gap-2">
                {['adults', 'kids'].map(type => (
                  <button key={type} onClick={() => setRecipeMealType(type)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      recipeMealType === type
                        ? type === 'adults' ? 'bg-basket-green-600 text-white border-basket-green-600' : 'bg-basket-orange-500 text-white border-basket-orange-500'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}>
                    {type === 'adults' ? 'Adult Favourites' : "Kids' Favourites"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleDiscardRecipe} className="flex-1">Discard</Button>
              <Button size="sm" onClick={handleSaveRecipe} className="flex-1">Save to Favourites</Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Saved Recipes ── */}
      {savedRecipes.length > 0 && (
        <Card>
          <CardTitle>Saved Recipes</CardTitle>
          <CardDescription>Recipes imported from the web</CardDescription>
          <div className="mt-3 space-y-2">
            {savedRecipes.map((recipe) => (
              <div key={recipe.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{recipe.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={recipe.mealType === 'kids' ? 'secondary' : 'primary'} size="sm">
                      {recipe.mealType === 'kids' ? 'Kids' : 'Adults'}
                    </Badge>
                    <span className="text-xs text-gray-400">{recipe.ingredients?.length || 0} ingredients</span>
                    {recipe.sourceUrl && (
                      <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-basket-green-600 hover:underline">
                        {recipe.sourceName || 'Source'}
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => { removeFavouriteRecipe(recipe.id); setSavedRecipes(getFavouriteRecipes()); }}
                  className="text-red-400 hover:text-red-600 text-sm ml-3 shrink-0">Remove</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Product Dictionary ── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardTitle>Product Dictionary</CardTitle>
            <CardDescription>Translate receipt codes — numeric codes have priority</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAddCodeModal(true)}>+ Add</Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {dictionary.numeric && Object.entries(dictionary.numeric).map(([code, name]) => (
            <div key={`num-${code}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant="info" size="sm">ID</Badge>
                <span className="font-mono text-sm text-gray-500">{code}</span>
                <span className="mx-1 text-gray-300">→</span>
                <span className="text-gray-900">{name}</span>
              </div>
              <button onClick={() => handleRemoveCode(code)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
            </div>
          ))}
          {dictionary.text && Object.entries(dictionary.text).map(([code, name]) => (
            <div key={`txt-${code}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">TXT</Badge>
                <span className="font-mono text-sm text-gray-500">{code}</span>
                <span className="mx-1 text-gray-300">→</span>
                <span className="text-gray-900">{name}</span>
              </div>
              <button onClick={() => handleRemoveCode(code)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Reset ── */}
      <Card className="bg-red-50 border-red-200">
        <CardTitle className="text-red-800">Reset Data</CardTitle>
        <CardDescription className="text-red-600">Clear all history, profile and restore defaults</CardDescription>
        <Button variant="danger" size="sm" onClick={() => setShowResetConfirm(true)} className="mt-3">Reset All Data</Button>
      </Card>

      {/* ── App Info ── */}
      <Card className="text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">Yumit</p>
        <p>Shop smarter. Eat better.</p>
        {profile && (
          <>
            <p className="mt-2">🛒 {profile.householdName}</p>
            <p>{profile.supermarket}</p>
            <p>💰 Budget: £{profile.budget?.min}–£{profile.budget?.max}/week</p>
          </>
        )}
      </Card>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Edit Profile Modal */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Edit Household Profile" size="lg">
        {editProfile && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-sm font-medium text-gray-700">Household name</label>
                <input type="text" value={editProfile.householdName || ''}
                  onChange={(e) => setEditProfile(p => ({ ...p, householdName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Supermarket</label>
                <select value={editProfile.supermarket || 'Aldi'}
                  onChange={(e) => setEditProfile(p => ({ ...p, supermarket: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500">
                  {SUPERMARKETS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Batch cooks/week</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setEditProfile(p => ({ ...p, batchCooksPerWeek: n }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${editProfile.batchCooksPerWeek === n ? 'bg-basket-green-600 text-white border-basket-green-600' : 'border-gray-200 text-gray-600'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Budget min (£)</label>
                <input type="number" value={editProfile.budget?.min || 90}
                  onChange={(e) => setEditProfile(p => ({ ...p, budget: { ...p.budget, min: parseInt(e.target.value) || 0 } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Budget max (£)</label>
                <input type="number" value={editProfile.budget?.max || 120}
                  onChange={(e) => setEditProfile(p => ({ ...p, budget: { ...p.budget, max: parseInt(e.target.value) || 0 } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500" />
              </div>
            </div>

            {/* Members */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Household members</label>
              {(editProfile.members || []).map((m, i) => {
                const stage = LIFE_STAGES[m.lifeStage];
                const allergenCount = m.allergens?.length || 0;
                return (
                  <div key={i} className="flex items-center justify-between bg-gray-200 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{stage?.emoji}</span>
                      <span className="text-sm font-medium text-gray-900">{m.name || stage?.label}</span>
                      <span className="text-xs text-gray-400">{stage?.ageRange}{m.notes?.length ? ` · ${m.notes.join(', ')}` : ''}</span>
                      {allergenCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                          {allergenCount} allergen{allergenCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleRemoveMemberFromEdit(i)} className="text-gray-300 hover:text-red-400 text-lg">×</button>
                  </div>
                );
              })}
              {showMemberForm ? (
                <MemberForm
                  onSave={handleAddMemberToEdit}
                  onCancel={() => setShowMemberForm(false)}
                />
              ) : (
                <button onClick={() => setShowMemberForm(true)}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-basket-green-400 hover:text-basket-green-600 transition-colors">
                  + Add household member
                </button>
              )}
            </div>

            {/* Dietary Requirements per member */}
            {(editProfile.members || []).length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Dietary requirements</label>
                {(editProfile.members || []).map((m, i) => {
                  const stage = LIFE_STAGES[m.lifeStage];
                  const toggleDiet = (field, value) => {
                    const current = m[field] || [];
                    const updated = current.includes(value)
                      ? current.filter(v => v !== value)
                      : [...current, value];
                    setEditProfile(p => ({
                      ...p,
                      members: p.members.map((mem, idx) => idx === i ? { ...mem, [field]: updated } : mem),
                    }));
                  };
                  return (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-3">
                      <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                        <span>{stage?.emoji}</span>
                        {m.name || stage?.label}
                      </p>
                      <div>
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">Allergens</p>
                        <div className="flex flex-wrap gap-1">
                          {ALLERGENS.map(a => {
                            const active = (m.allergens || []).includes(a.value);
                            return (
                              <button key={a.value} onClick={() => toggleDiet('allergens', a.value)}
                                title={a.description}
                                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${active ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600 hover:border-red-300'}`}>
                                {a.icon} {a.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-basket-green-700 uppercase tracking-wide mb-1.5">Dietary preferences</p>
                        <div className="flex flex-wrap gap-1">
                          {DIETARY_PREFERENCES.map(d => {
                            const active = (m.dietaryPreferences || []).includes(d.value);
                            return (
                              <button key={d.value} onClick={() => toggleDiet('dietaryPreferences', d.value)}
                                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${active ? 'bg-basket-green-600 text-white border-basket-green-600' : 'border-gray-300 text-gray-600 hover:border-basket-green-300'}`}>
                                {d.icon} {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Intolerances</p>
                        <div className="flex flex-wrap gap-1">
                          {INTOLERANCES.map(t => {
                            const active = (m.intolerances || []).includes(t.value);
                            return (
                              <button key={t.value} onClick={() => toggleDiet('intolerances', t.value)}
                                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${active ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 text-gray-600 hover:border-amber-300'}`}>
                                {t.icon} {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                  <span className="font-bold">Important: </span>
                  Yumit&apos;s allergen information is a helpful guide only. Always check product labels directly. Formulations change without notice. Never rely solely on this app for allergen management if you have a severe allergy.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowProfileModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveProfile} className="flex-1">Save Profile</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* API Key modal hidden for testing phase */}

      {/* Add Meal Modal */}
      <Modal isOpen={showAddMealModal} onClose={() => setShowAddMealModal(false)}
        title={`Add ${mealType === 'adults' ? 'Adult' : 'Kids'} Favourite`}>
        <div className="space-y-4">
          <Input label="Meal Name" placeholder="e.g., Spaghetti Bolognese" value={newMeal}
            onChange={(e) => setNewMeal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddMealModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddMeal} className="flex-1">Add Meal</Button>
          </div>
        </div>
      </Modal>

      {/* Add Code Modal */}
      <Modal isOpen={showAddCodeModal} onClose={() => setShowAddCodeModal(false)} title="Add Product Translation">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium">Tip: Aldi uses numeric product codes</p>
            <p className="text-blue-600 mt-1">Look for 5-6 digit numbers on your receipt (e.g., 852012, 701482)</p>
          </div>
          <Input label="Receipt Code" placeholder="e.g., 852012 or CKN THIGH FLIS" value={newCode}
            onChange={(e) => setNewCode(e.target.value)} />
          <Input label="Product Name" placeholder="e.g., Chicken Thigh Fillets" value={newName}
            onChange={(e) => setNewName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAddCodeModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddCode} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>

      {/* Reset Profile Modal */}
      <Modal isOpen={showResetProfileConfirm} onClose={() => setShowResetProfileConfirm(false)} title="Reset Household Profile?">
        <div className="space-y-4">
          <p className="text-gray-600">
            This will clear your household profile and return you to the setup screen.
            Your shopping history, saved recipes, and meal preferences will be kept.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowResetProfileConfirm(false)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleResetProfile} className="flex-1">Reset Profile</Button>
          </div>
        </div>
      </Modal>

      {/* Reset Confirm Modal */}
      <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset All Data?">
        <div className="space-y-4">
          <p className="text-gray-600">
            This will clear all shopping history, meal preferences, saved recipes, your household profile,
            and API key. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleReset} className="flex-1">Reset Everything</Button>
          </div>
        </div>
      </Modal>
    </AnimatedPage>
  );
}

export default SettingsPage;
