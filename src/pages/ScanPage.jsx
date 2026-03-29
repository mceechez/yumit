import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, GradeBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { SkeletonScanResult } from '../components/ui/Skeleton';
import { AnimatedPage } from '../components/AnimatedPage';
import { useClaudeAI } from '../hooks/useClaudeAI';
import {
  researchNutrition,
  generateBatchCooking as batchCookingService,
  getSmartSwaps as swapsService,
  parseTextReceipt,
} from '../services/claude';
import { translateCode } from '../data/productDictionary';
import { normaliseItemName } from '../data/receiptNormaliser';
import { detectSupermarket, SUPERMARKET_PROFILES } from '../data/supermarketProfiles';
import { formatPrice } from '../utils/formatters';
import { getGrade } from '../services/nutrition';
import { getProductDictionary, addProductTranslation, addShoppingTrip, saveFavouriteRecipe, addMeal, logExtractionNoise } from '../services/storage';
import { getProfile, ALLERGENS } from '../services/profile';
import RecipeDetailPage from './RecipeDetailPage';

// ─── Allergen keyword map ─────────────────────────────────────────────────────
// Maps allergen values to keywords that may appear in product names
const ALLERGEN_KEYWORDS = {
  gluten:    ['bread', 'flour', 'pasta', 'wheat', 'barley', 'rye', 'oat', 'biscuit', 'cake', 'pastry', 'cereal', 'sausage', 'roll', 'wrap', 'naan', 'pitta', 'cracker', 'crouton', 'couscous'],
  dairy:     ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'fromage', 'whey', 'lactose', 'cheddar', 'mozzarella', 'brie', 'camembert', 'custard'],
  eggs:      ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'omelette'],
  peanuts:   ['peanut', 'groundnut', 'satay'],
  'tree-nuts':['almond', 'cashew', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'brazil nut', 'macadamia', 'nut butter'],
  soya:      ['soya', 'soy', 'tofu', 'edamame', 'miso', 'tempeh'],
  fish:      ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'mackerel', 'sardine', 'anchovy', 'trout', 'bass', 'tilapia'],
  shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'crayfish', 'langoustine', 'scallop'],
  sesame:    ['sesame', 'tahini', 'hummus', 'houmous'],
  celery:    ['celery', 'celeriac', 'celery salt'],
  mustard:   ['mustard'],
  lupin:     ['lupin'],
  molluscs:  ['squid', 'mussel', 'oyster', 'clam', 'cockle', 'octopus', 'whelk', 'snail'],
  sulphites: ['wine', 'cider', 'vinegar', 'dried fruit', 'raisin', 'apricot', 'prune'],
};

/**
 * Checks item name against household allergens.
 * Returns array of { allergenValue, allergenLabel, severity } where severity is 'contains' or 'mayContain'.
 */
function checkItemAllergens(itemName, householdAllergens) {
  if (!itemName || !householdAllergens?.length) return [];
  const name = itemName.toLowerCase();
  const flags = [];
  for (const allergenValue of householdAllergens) {
    const keywords = ALLERGEN_KEYWORDS[allergenValue] || [];
    const match = keywords.find(kw => name.includes(kw));
    if (match) {
      const allergenDef = ALLERGENS.find(a => a.value === allergenValue);
      flags.push({
        allergenValue,
        allergenLabel: allergenDef?.label || allergenValue,
        allergenIcon: allergenDef?.icon || '⚠️',
        severity: 'contains',
      });
    }
  }
  return flags;
}

const ALLERGEN_DISCLAIMER = 'Yumit\'s allergen information is a helpful guide only. Always check product labels directly. Formulations change without notice. Never rely solely on this app for allergen management if you have a severe allergy.';

// ─── Allergen flag badge ──────────────────────────────────────────────────────
function AllergenFlag({ flags, personNames }) {
  if (!flags?.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {flags.map((f, i) => (
        <div key={i} className="flex items-start gap-1 text-xs">
          <span className="bg-red-600 text-white rounded px-1 py-0.5 font-bold shrink-0">⚠️ ALLERGEN</span>
          <span className="text-red-700 font-medium">
            {f.allergenIcon} {f.allergenLabel}
            {personNames?.length ? ` — flagged for ${personNames.join(', ')}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── "What the science says" collapsible ─────────────────────────────────────
function ScienceInsights({ insights }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-semibold text-blue-700">What the science says</span>
        <span className="text-blue-500 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="bg-blue-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-blue-700">{insight.heading}</p>
              <p className="text-sm text-blue-700 leading-relaxed">{insight.body}</p>
              {insight.source && (
                <p className="text-xs text-blue-500">{insight.source}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── "Good for the kids" section ─────────────────────────────────────────────
function KidsInsights({ insights }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-orange-800">Good for the kids</p>
      {insights.map((insight, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">👶</span>
          <div>
            <p className="text-sm font-medium text-gray-900">{insight.food}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{insight.benefit}</p>
            {insight.source && (
              <p className="text-xs text-gray-400 mt-0.5">{insight.source}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Specific error messages — never generic ──────────────────────────────────
const EXTRACTION_ERRORS = {
  image_quality:     'This photo is a bit dark or blurry. Lay the receipt flat, make sure all items are in frame, and try again in better light.',
  insufficient_items:'We found a few items but not enough to be confident this is a full receipt. Try pasting your order confirmation text instead — copy everything from the page.',
  pdf_protected:     'This PDF has a password or security setting that prevents reading. Try downloading it again from your supermarket account, or copy and paste the order text directly.',
  pdf_image_only:    'This PDF contains a scanned image rather than readable text. Try taking a photo of your receipt with the camera option instead.',
  no_grocery_items:  "This doesn't look like a grocery receipt — we couldn't find any food items. Make sure you're pasting from your order confirmation page, not your account overview.",
};

function calculateConfidence(items) {
  const lowConfCount = items.filter(i => i.low_confidence).length;
  if (items.length >= 10 && lowConfCount === 0) return 'high';
  if (items.length >= 5 || (items.length > 0 && lowConfCount <= 3)) return 'medium';
  if (items.length >= 1) return 'low';
  return 'error';
}

export function ScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { loading, error, parseReceipt } = useClaudeAI();
  const profile = getProfile();
  // Build a flat list of all allergens across all household members
  const householdAllergens = [...new Set((profile?.members || []).flatMap(m => m.allergens || []))];
  // Map allergen value → names of people who have it
  const allergenPersonMap = {};
  (profile?.members || []).forEach(m => {
    (m.allergens || []).forEach(a => {
      if (!allergenPersonMap[a]) allergenPersonMap[a] = [];
      if (m.name) allergenPersonMap[a].push(m.name);
    });
  });

  const [step, setStep] = useState('upload'); // upload, parsed, analyzed
  const [imagePreviews, setImagePreviews] = useState([]); // Support multiple images
  const [parsedReceipt, setParsedReceipt] = useState(null);
  const [nutritionAnalysis, setNutritionAnalysis] = useState(null);
  const [batchCooking, setBatchCooking] = useState(null);
  const [smartSwaps, setSmartSwaps] = useState(null);
  const [processingStep, setProcessingStep] = useState('');
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const [allergenWarningDismissed, setAllergenWarningDismissed] = useState(false);

  // Batch recipe detail overlay
  const [selectedBatchRecipe, setSelectedBatchRecipe] = useState(null);
  const [savedBatchRecipes, setSavedBatchRecipes] = useState(new Set());

  // Modal for adding new product translations
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  // Store files for later processing
  const [selectedFiles, setSelectedFiles] = useState([]);

  // ─── Universal ingestion state ──────────────────────────────────────────────
  const [inputMethod, setInputMethod] = useState('camera'); // 'camera' | 'pdf' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [extractionError, setExtractionError] = useState(null); // { code, message }
  const [extractionConfidence, setExtractionConfidence] = useState(null);
  const [detectedSupermarket, setDetectedSupermarket] = useState('generic');
  const [pdfLoading, setPdfLoading] = useState(false);

  // ─── Review step state ──────────────────────────────────────────────────────
  const [reviewItems, setReviewItems] = useState([]);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [addItemName, setAddItemName] = useState('');
  const [addItemPrice, setAddItemPrice] = useState('');
  const [showAddReviewItem, setShowAddReviewItem] = useState(false);
  const [pendingDictEntries, setPendingDictEntries] = useState([]);
  const [showDictBanner, setShowDictBanner] = useState(false);
  const [confirmingRemoveIndex, setConfirmingRemoveIndex] = useState(null);

  const pdfInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Store files and create previews
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const previews = await Promise.all(
      files.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(file);
      }))
    );
    setImagePreviews(prev => [...prev, ...previews]);

    // Reset file input so same files can be selected again
    e.target.value = '';
  };

  // ─── Normalise raw text items and route to review step ────────────────────
  const processExtractedItems = (rawItems) => {
    return rawItems.map(item => {
      const { name: normName, low_confidence } = normaliseItemName(item.name || '');
      return {
        ...item,
        translatedName: normName || item.name,
        originalName: item.name,
        name: normName || item.name,
        low_confidence: item.low_confidence || low_confidence,
        nonFood: item.nonFood || false,
      };
    });
  };

  const routeToReview = (items, confidence, supermarketId) => {
    setReviewItems(items);
    setExtractionConfidence(confidence);
    setDetectedSupermarket(supermarketId || 'generic');
    setExtractionError(null);
    setEditingItemIndex(null);
    setShowAddReviewItem(false);
    setAllergenWarningDismissed(false);
    setShowScanSuccess(true);
    setTimeout(() => {
      setShowScanSuccess(false);
      setStep('reviewing');
    }, 1000);
  };

  // ─── PDF upload handler ────────────────────────────────────────────────────
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setExtractionError(null);
    setPdfLoading(true);
    setProcessingStep('Reading your order...');
    try {
      // Dynamic import to avoid bundling the worker
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const arrayBuffer = await file.arrayBuffer();
      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch (err) {
        const code = err.message?.toLowerCase().includes('password') ? 'pdf_protected' : 'pdf_protected';
        throw Object.assign(new Error(EXTRACTION_ERRORS[code]), { code });
      }

      const maxPages = Math.min(pdf.numPages, 20);
      const pageTexts = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(content.items.map(it => it.str).join(' '));
      }
      const fullText = pageTexts.join('\n---\n');

      if (!fullText.trim()) {
        throw Object.assign(new Error(EXTRACTION_ERRORS.pdf_image_only), { code: 'pdf_image_only' });
      }

      const supermarketId = detectSupermarket(fullText);
      setProcessingStep('Identifying items...');
      const rawItems = await parseTextReceipt(fullText, supermarketId);
      const normItems = processExtractedItems(rawItems);
      const total = normItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
      setParsedReceipt({ items: normItems, total, store: SUPERMARKET_PROFILES[supermarketId]?.name || '' });

      const confidence = calculateConfidence(normItems);
      routeToReview(normItems, confidence, supermarketId);
    } catch (err) {
      const code = err.code || 'insufficient_items';
      setExtractionError({ code, message: EXTRACTION_ERRORS[code] || err.message });
    } finally {
      setPdfLoading(false);
      setProcessingStep('');
    }
  };

  // ─── Paste text handler ────────────────────────────────────────────────────
  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    setExtractionError(null);
    setProcessingStep('Finding your items...');
    try {
      const supermarketId = detectSupermarket(pasteText);
      const rawItems = await parseTextReceipt(pasteText, supermarketId);
      const normItems = processExtractedItems(rawItems);
      const total = normItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
      setParsedReceipt({ items: normItems, total, store: SUPERMARKET_PROFILES[supermarketId]?.name || '' });

      const confidence = calculateConfidence(normItems);
      routeToReview(normItems, confidence, supermarketId);
    } catch (err) {
      const code = err.code || 'no_grocery_items';
      setExtractionError({ code, message: EXTRACTION_ERRORS[code] || err.message });
    } finally {
      setProcessingStep('');
    }
  };

  // ─── Review step item editing ──────────────────────────────────────────────
  const startEditReviewItem = (index) => {
    setEditingItemIndex(index);
    setEditingItemName(reviewItems[index].translatedName || reviewItems[index].name);
  };
  const confirmEditReviewItem = () => {
    if (editingItemIndex === null) return;
    const item = reviewItems[editingItemIndex];
    const newName = editingItemName.trim() || item.translatedName;
    if (newName !== (item.translatedName || item.name)) {
      addProductTranslation(item.originalName || item.originalCode || item.name, newName);
    }
    const updated = reviewItems.map((it, i) =>
      i !== editingItemIndex ? it : { ...it, translatedName: newName, name: newName, low_confidence: false }
    );
    setReviewItems(updated);
    setEditingItemIndex(null);
  };
  const removeReviewItem = (index) => {
    if (confirmingRemoveIndex !== index) {
      setConfirmingRemoveIndex(index);
      return;
    }
    const item = reviewItems[index];
    logExtractionNoise(item.originalName || item.name);
    if (item.originalCode && item.originalCode !== item.name) {
      addProductTranslation(item.originalCode, item.name);
    }
    setReviewItems(prev => prev.filter((_, i) => i !== index));
    setConfirmingRemoveIndex(null);
  };
  const handleAddReviewItem = () => {
    const name = addItemName.trim();
    const price = parseFloat(addItemPrice) || 0;
    if (!name) return;
    const newItem = { name, translatedName: name, price, quantity: 1, nonFood: false, low_confidence: false, manuallyAdded: true };
    setReviewItems(prev => [...prev, newItem]);
    addProductTranslation(name, name);
    setAddItemName('');
    setAddItemPrice('');
    setShowAddReviewItem(false);
  };

  const updateItemQuantity = (index, delta) => {
    setReviewItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) };
    }));
  };

  const handleProcessImages = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const totalImages = selectedFiles.length;
      const allItems = [];
      let total = 0;
      let date = null;
      let store = null;

      for (let i = 0; i < selectedFiles.length; i++) {
        setProcessingStep(
          totalImages > 1
            ? `Reading receipt ${i + 1} of ${totalImages}...`
            : 'Reading receipt...'
        );
        const base64 = await fileToBase64(selectedFiles[i]);
        const mediaType = selectedFiles[i].type || 'image/jpeg';

        const result = await parseReceipt(base64, mediaType);

        if (result.items) allItems.push(...result.items);
        if (result.total && result.total > total) total = result.total;
        if (result.date && !date) date = result.date;
        if (result.store && !store) store = result.store;
      }

      setProcessingStep('Translating codes...');
      const dictionary = getProductDictionary();
      const translatedItems = allItems.map(item => ({
        ...item,
        translatedName: translateCode(item.code, dictionary),
        originalCode: item.code,
      }));

      setParsedReceipt({ items: translatedItems, total, date, store });
      setProcessingStep('');
      setAllergenWarningDismissed(false);
      // Route all camera receipts through the review step
      const confidence = calculateConfidence(translatedItems);
      setReviewItems(translatedItems);
      setExtractionConfidence(confidence);
      setDetectedSupermarket(store ? 'generic' : 'generic');
      setShowScanSuccess(true);
      setTimeout(() => {
        setShowScanSuccess(false);
        setStep('reviewing');
      }, 1400);
    } catch (err) {
      console.error('Failed to parse receipt:', err);
      setProcessingStep('');
    }
  };

  const handleRemoveImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!parsedReceipt) return;

    // Auto-save abbreviation expansions to dictionary
    if (pendingDictEntries.length > 0) {
      pendingDictEntries.forEach(({ raw, cleaned }) => {
        if (raw && cleaned && raw !== cleaned) {
          addProductTranslation(raw, cleaned);
        }
      });
      setPendingDictEntries([]);
    }

    // Sync parsedReceipt with any review edits
    const syncedItems = reviewItems.length > 0 ? reviewItems : (parsedReceipt.items || []);
    const updatedReceipt = { ...parsedReceipt, items: syncedItems };
    setParsedReceipt(updatedReceipt);

    const allItems = syncedItems.map(i => ({
      name: i.translatedName || i.name,
      code: i.code,
      price: i.price,
      nonFood: i.nonFood,
    }));

    try {
      // Run all three in parallel — nutrition research, recipes, and swaps start together.
      // Research takes longest (web search), so parallelism keeps total wait time down.
      setProcessingStep('Researching your shop — this takes a moment…');
      const [nutrition, cooking, swaps] = await Promise.all([
        researchNutrition(allItems),
        batchCookingService(allItems.map(({ name, code }) => ({ name, code }))),
        swapsService(allItems),
      ]);
      setNutritionAnalysis(nutrition);
      setBatchCooking(cooking);
      setSmartSwaps(swaps);

      setStep('analyzed');
      setProcessingStep('');
      if (pendingDictEntries.length > 0) setShowDictBanner(true);
    } catch (err) {
      console.error('Analysis failed:', err);
      setProcessingStep('');
    }
  };

  const handleSaveBatchRecipe = (recipe) => {
    saveFavouriteRecipe({
      name: recipe.name,
      servings: recipe.portions || recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      ingredients: recipe.ingredients,
      method: recipe.method,
      equipment: recipe.equipment,
      storage: recipe.storage,
      nutritionHighlight: recipe.nutritionHighlight,
      mealType: 'adults',
    });
    addMeal('adults', recipe.name);
    setSavedBatchRecipes(prev => new Set(prev).add(recipe.name));
  };

  const handleSaveTrip = () => {
    const score = nutritionAnalysis
      ? (nutritionAnalysis.total_score ?? nutritionAnalysis.score ?? 0)
      : 0;
    const trip = addShoppingTrip({
      items: parsedReceipt.items,
      total: parsedReceipt.total,
      nutritionScore: score,
      nutritionGrade: getGrade(score),
      pillars: nutritionAnalysis?.pillars || null,
      batchMeals: batchCooking?.recipes?.map(r => r.name) || [],
      store: parsedReceipt.store || 'Aldi Chingford',
    });

    if (trip) {
      navigate('/history');
    }
  };

  const handleAddTranslation = () => {
    if (newCode && newName) {
      addProductTranslation(newCode, newName);
      setShowAddModal(false);
      setNewCode('');
      setNewName('');

      // Re-translate items
      if (parsedReceipt) {
        const dictionary = getProductDictionary();
        const translatedItems = parsedReceipt.items.map(item => ({
          ...item,
          translatedName: translateCode(item.originalCode || item.code, dictionary),
        }));
        setParsedReceipt({ ...parsedReceipt, items: translatedItems });
      }
    }
  };

  const resetScan = () => {
    setStep('upload');
    setImagePreviews([]);
    setSelectedFiles([]);
    setParsedReceipt(null);
    setNutritionAnalysis(null);
    setBatchCooking(null);
    setSmartSwaps(null);
    setPasteText('');
    setExtractionError(null);
    setExtractionConfidence(null);
    setReviewItems([]);
    setEditingItemIndex(null);
    setPendingDictEntries([]);
    setShowDictBanner(false);
    setShowAddReviewItem(false);
  };

  return (
    <AnimatedPage className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Scan Receipt</h2>

      {/* Scan success overlay */}
      {showScanSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-success-bg">
          <div className="bg-gray-100 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <svg viewBox="0 0 52 52" className="w-20 h-20" fill="none">
              <circle cx="26" cy="26" r="18" stroke="#4CAF50" strokeWidth="3" className="animate-check-circle" />
              <path d="M14 26l9 9 15-16" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-check-mark" />
            </svg>
            <p className="text-lg font-semibold text-gray-900">Receipt scanned!</p>
          </div>
        </div>
      )}

      {/* Step indicator — visible whenever a background step is running */}
      {processingStep && (
        <div className="flex items-center gap-3 bg-basket-green-50 border border-basket-green-100 rounded-xl px-4 py-3">
          <div className="w-4 h-4 border-2 border-basket-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-basket-green-700">{processingStep}</span>
        </div>
      )}

      {/* Skeleton while scanning/parsing */}
      {loading && processingStep && step === 'upload' && (
        <SkeletonScanResult />
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Input method tabs */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
            {[
              { id: 'camera', label: '📷 Camera', title: 'Camera' },
              { id: 'pdf',    label: '📄 PDF',    title: 'PDF' },
              { id: 'paste',  label: '📋 Paste',  title: 'Paste' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setInputMethod(tab.id); setExtractionError(null); }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inputMethod === tab.id ? 'bg-white text-basket-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Extraction error */}
          {extractionError && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-1">Couldn't read that</p>
              <p className="text-sm text-red-600">{extractionError.message}</p>
            </div>
          )}

          {/* Camera tab */}
          {inputMethod === 'camera' && (
            <Card className="text-center py-6">
              <div className="space-y-4">
                <div className="w-14 h-14 bg-basket-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-basket-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Photo your receipt</h3>
                  <p className="text-sm text-gray-500 mt-1">Lay receipt flat and ensure all items are in frame</p>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img src={preview} alt={`Receipt ${index + 1}`} className="w-20 h-20 object-cover rounded-lg border-2 border-basket-green-200" />
                        <button onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} className="hidden" />
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant={imagePreviews.length > 0 ? 'outline' : 'primary'} onClick={() => fileInputRef.current?.click()} loading={loading} disabled={loading}>
                    {loading ? processingStep : imagePreviews.length > 0 ? '+ Add More' : 'Choose Photos'}
                  </Button>
                  {imagePreviews.length > 0 && !loading && (
                    <Button onClick={handleProcessImages} disabled={loading}>
                      Scan {imagePreviews.length} Photo{imagePreviews.length > 1 ? 's' : ''}
                    </Button>
                  )}
                </div>

                {imagePreviews.length === 0 && (
                  <div className="text-left bg-gray-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-600">Tips for best results</p>
                    <ul className="space-y-1 text-xs text-gray-500">
                      <li>Lay receipt flat on a dark surface</li>
                      <li>Ensure all text is in frame</li>
                      <li>Good lighting, no shadows across the text</li>
                      <li>Long receipt? Use + Add More for multiple photos</li>
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* PDF tab */}
          {inputMethod === 'pdf' && (
            <Card className="text-center py-6">
              <div className="space-y-4">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Upload order confirmation PDF</h3>
                  <p className="text-sm text-gray-500 mt-1">Download from Ocado, Tesco, Sainsbury's, ASDA or Waitrose</p>
                </div>
                <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                <Button onClick={() => pdfInputRef.current?.click()} loading={pdfLoading} disabled={pdfLoading} variant="primary">
                  {pdfLoading ? 'Reading your order...' : 'Choose PDF'}
                </Button>
                <p className="text-xs text-gray-400">If your PDF is password-protected, try the Paste option instead.</p>
              </div>
            </Card>
          )}

          {/* Paste tab */}
          {inputMethod === 'paste' && (
            <Card className="py-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Paste your order confirmation</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Copy everything from your browser or email — Yumit will find what it needs</p>
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste your order confirmation here — copy everything and Yumit will find what it needs."
                  className="w-full h-40 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-basket-green-400"
                />
                <Button
                  onClick={handlePasteSubmit}
                  loading={!!processingStep}
                  disabled={!pasteText.trim() || !!processingStep}
                  className="w-full"
                >
                  {processingStep || 'Find my items'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Review Step — shown after extraction for all input methods */}
      {step === 'reviewing' && (() => {
        const flagCount = reviewItems.filter(i => i.low_confidence).length;
        const itemCount = reviewItems.length;
        const confidenceLevel =
          itemCount >= 10 && flagCount === 0 ? 'high' :
          itemCount >= 5 && flagCount <= 3   ? 'medium' : 'low';
        return (
          <div className="space-y-4">
            {/* Confidence banner */}
            {confidenceLevel === 'high' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800">Everything looks good</p>
                <p className="text-sm text-green-700 mt-0.5">Scroll through and hit Score My Shop when you're ready.</p>
              </div>
            )}
            {confidenceLevel === 'medium' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800">We flagged a few items worth checking</p>
                <p className="text-sm text-amber-700 mt-0.5">They're marked in amber below.</p>
              </div>
            )}
            {confidenceLevel === 'low' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800">We could only read part of this receipt</p>
                <p className="text-sm text-red-700 mt-0.5">Add any missing items before scoring.</p>
              </div>
            )}

            {/* Detected supermarket chip */}
            {detectedSupermarket && detectedSupermarket !== 'generic' && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1 border border-gray-200">
                  {SUPERMARKET_PROFILES[detectedSupermarket]?.name || detectedSupermarket}
                </span>
              </div>
            )}

            {/* Items list — editable */}
            <Card>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <CardTitle>Here's what we found</CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''} found</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)}>
                  + Add Code
                </Button>
              </div>

              {/* Allergen warning */}
              {householdAllergens.length > 0 && !allergenWarningDismissed && (
                <div className="mb-3 bg-red-50 border border-red-100 rounded-xl p-3 animate-allergen-pulse">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide">⚠️ Allergen check active</p>
                      <p className="text-xs text-red-600">
                        Checking against: {householdAllergens.map(a => ALLERGENS.find(x => x.value === a)?.label || a).join(', ')}
                      </p>
                    </div>
                    <button onClick={() => setAllergenWarningDismissed(true)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5" aria-label="Dismiss allergen warning">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1 max-h-96 overflow-y-auto mt-3">
                {reviewItems.map((item, index) => {
                  const itemName = item.translatedName || item.name;
                  const allergenFlags = checkItemAllergens(itemName, householdAllergens);
                  const personNames = allergenFlags.length
                    ? [...new Set(allergenFlags.flatMap(f => allergenPersonMap[f.allergenValue] || []))]
                    : [];
                  const hasAllergen = allergenFlags.length > 0;
                  const isEditing = editingItemIndex === index;
                  const isConfirmingRemove = confirmingRemoveIndex === index;

                  // Row left-border indicator
                  let rowBorder = '';
                  if (item.low_confidence) rowBorder = 'border-l-4 border-amber-400';
                  else if (item.substitution) rowBorder = 'border-l-4 border-teal-500';
                  else if (item.manuallyAdded) rowBorder = 'border-l-4 border-basket-green-400';

                  return (
                    <div key={index} className={`py-2 border-b border-gray-100 last:border-0 pl-2 ${rowBorder} ${hasAllergen ? 'bg-red-50 rounded-xl' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-1">
                              <div className="flex gap-2">
                                <input
                                  autoFocus
                                  value={editingItemName}
                                  onChange={e => setEditingItemName(e.target.value)}
                                  onBlur={confirmEditReviewItem}
                                  onKeyDown={e => { if (e.key === 'Enter') confirmEditReviewItem(); if (e.key === 'Escape') setEditingItemIndex(null); }}
                                  className="flex-1 text-sm border border-basket-green-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-basket-green-300"
                                />
                                <button onClick={confirmEditReviewItem} className="text-xs text-basket-green-600 font-medium px-2">Done</button>
                              </div>
                              {(item.originalName || item.originalCode) && (
                                <p className="text-xs text-gray-400">Originally read as: {item.originalName || item.originalCode}</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap relative">
                                {hasAllergen && <span className="text-base">⚠️</span>}
                                <button
                                  onClick={() => startEditReviewItem(index)}
                                  className={`font-medium text-left hover:text-basket-green-700 transition-colors ${hasAllergen ? 'text-red-900' : 'text-gray-900'}`}
                                >
                                  {itemName}
                                </button>
                                {item.nonFood && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">non-food</span>}
                                {item.low_confidence && <span className="text-xs text-amber-500 font-bold">●</span>}
                              </div>
                              {item.substitution && (
                                <p className="text-xs text-teal-600 mt-0.5">Substituted item — this is what was delivered</p>
                              )}
                              {item.originalCode && item.translatedName !== item.originalCode && (
                                <p className="text-xs text-gray-400">{item.originalCode}</p>
                              )}
                            </div>
                          )}
                          <AllergenFlag flags={allergenFlags} personNames={personNames} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatPrice(item.price)}</p>
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              <button
                                onClick={() => updateItemQuantity(index, -1)}
                                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 rounded text-xs leading-none"
                                aria-label="Decrease quantity"
                              >−</button>
                              <span className="text-xs text-gray-500 w-4 text-center">{item.quantity || 1}</span>
                              <button
                                onClick={() => updateItemQuantity(index, +1)}
                                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 rounded text-xs leading-none"
                                aria-label="Increase quantity"
                              >+</button>
                            </div>
                          </div>
                          {isConfirmingRemove ? (
                            <div className="flex flex-col items-end gap-1">
                              <p className="text-xs text-gray-500">Remove?</p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => removeReviewItem(index)}
                                  className="text-xs text-red-600 font-semibold hover:text-red-800 px-1"
                                >Yes</button>
                                <button
                                  onClick={() => setConfirmingRemoveIndex(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => removeReviewItem(index)}
                              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                              aria-label="Remove item"
                            >×</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add item form */}
              {showAddReviewItem ? (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Add a missing item</p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={addItemName}
                      onChange={e => setAddItemName(e.target.value)}
                      placeholder="Item name"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-basket-green-300"
                      onKeyDown={e => { if (e.key === 'Enter') handleAddReviewItem(); }}
                    />
                    <input
                      value={addItemPrice}
                      onChange={e => setAddItemPrice(e.target.value)}
                      placeholder="£0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-basket-green-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddReviewItem} disabled={!addItemName.trim()}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddReviewItem(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddReviewItem(true)} className="mt-3 pt-3 border-t border-gray-100 w-full text-sm text-basket-green-600 hover:text-basket-green-700 text-left font-medium">
                  + Add missing item
                </button>
              )}

              {/* Total */}
              <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-basket-green-500">
                  {formatPrice(reviewItems.reduce((s, i) => s + (Number(i.price) || 0), 0))}
                </span>
              </div>

              {/* Allergen disclaimer */}
              {householdAllergens.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">Important: </span>{ALLERGEN_DISCLAIMER}
                  </p>
                </div>
              )}
            </Card>

            {/* Actions */}
            <p className="text-xs text-center text-gray-400">
              Scoring {reviewItems.filter(i => !i.nonFood).length} item{reviewItems.filter(i => !i.nonFood).length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetScan} className="flex-1">
                Start over
              </Button>
              <Button
                onClick={handleAnalyze}
                loading={loading}
                disabled={loading || !!processingStep || reviewItems.filter(i => !i.nonFood).length < 3}
                className="flex-1"
              >
                {loading ? (processingStep || 'Analysing…') : 'Score My Shop'}
              </Button>
            </div>
            {reviewItems.filter(i => !i.nonFood).length < 3 && (
              <p className="text-xs text-gray-400 text-center -mt-2">Add at least 3 food items to score this shop</p>
            )}
          </div>
        );
      })()}

      {/* Analyzed Step */}
      {step === 'analyzed' && (
        <div className="space-y-4">
          {/* Nutrition Score */}
          {nutritionAnalysis && (() => {
            const pillarTotal = Object.values(nutritionAnalysis.pillars || {})
              .reduce((sum, p) => sum + (p.score || 0), 0);
            const synergyScore = nutritionAnalysis.synergy_score || 0;
            const totalScore = nutritionAnalysis.total_score ?? pillarTotal;
            const grade = getGrade(pillarTotal);
            const PILLAR_LABELS = {
              protein: 'Protein',
              veg_variety: 'Fruit & Veg Variety',
              fibre: 'Fibre & Wholegrains',
              processed_load: 'Processed Food Load',
              gap_nutrients: 'Nutrient Gap Coverage',
            };
            const pillarColor = (s) => s >= 16 ? '#4CAF50' : s >= 10 ? '#FF9F0A' : '#FF453A';
            const barScore = Math.min(pillarTotal, 100);
            const totalBarColor = pillarTotal >= 80 ? '#4CAF50' : pillarTotal >= 60 ? '#3b82f6' : pillarTotal >= 40 ? '#FF9F0A' : '#FF453A';
            return (
              <>
                {/* Headline Insight — most interesting observation, above score card */}
                {nutritionAnalysis.headline_insight && (
                  <div className="px-1">
                    <p className="text-base font-medium text-gray-900 leading-snug">
                      {nutritionAnalysis.headline_insight}
                    </p>
                  </div>
                )}

                <Card>
                  <CardTitle>Nutrition Score</CardTitle>
                  <div className="mt-3 flex items-center gap-4">
                    <GradeBadge grade={grade} size="xl" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${barScore}%`, backgroundColor: totalBarColor }}
                          />
                        </div>
                        {synergyScore > 0 ? (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 text-xs text-gray-400 leading-none mb-0.5">
                              <span>{pillarTotal}</span>
                              <span>+</span>
                              <span className="text-teal-500 font-semibold">{synergyScore}</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 leading-none">{totalScore}</span>
                          </div>
                        ) : (
                          <span className="text-lg font-bold">{totalScore}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{nutritionAnalysis.summary}</p>
                    </div>
                  </div>

                  {/* Pillar breakdown — only shown for new scans with pillar data */}
                  {nutritionAnalysis.pillars && (
                    <div className="mt-4 space-y-3">
                      {Object.entries(nutritionAnalysis.pillars).map(([key, pillar]) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{PILLAR_LABELS[key] || key}</span>
                            <span className="text-xs font-semibold text-gray-900">{pillar.score}/20</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(pillar.score / 20) * 100}%`,
                                backgroundColor: pillarColor(pillar.score),
                              }}
                            />
                          </div>
                          {pillar.reason && (
                            <p className="text-xs text-gray-500 mt-0.5">{pillar.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* What the science says — collapsible, only when insights present */}
                  {nutritionAnalysis.insights?.length > 0 && (
                    <ScienceInsights insights={nutritionAnalysis.insights} />
                  )}
                </Card>

                {/* Smart Combinations — synergy panel, only when synergies detected */}
                {nutritionAnalysis.synergies_detected?.length > 0 && (
                  <Card>
                    <CardTitle>Your shop's smart combinations</CardTitle>
                    <div className="mt-3 space-y-3">
                      {nutritionAnalysis.synergies_detected.map((syn, i) => (
                        <div key={i} className="border-l-2 border-teal-500 pl-3">
                          <p className="text-xs text-gray-400 mb-0.5">🔗 {syn.pair}</p>
                          <p className="text-sm text-gray-800">{syn.insight}</p>
                        </div>
                      ))}
                    </div>
                    {synergyScore > 0 && (
                      <p className="text-xs text-gray-400 mt-3 text-right">
                        {pillarTotal} + {synergyScore} synergy bonus = {totalScore}
                      </p>
                    )}
                  </Card>
                )}

                {/* One Thing Worth Adding */}
                {(nutritionAnalysis.one_addition || nutritionAnalysis.lowest_pillar_suggestion) && (
                  <Card className="bg-basket-green-50 border-basket-green-100">
                    <CardTitle>One Thing Worth Adding</CardTitle>
                    <p className="text-sm text-gray-700 mt-1">
                      {nutritionAnalysis.one_addition || nutritionAnalysis.lowest_pillar_suggestion}
                    </p>
                  </Card>
                )}

                {/* Good for the kids — separate card, only when kidsInsights present */}
                {nutritionAnalysis.kidsInsights?.length > 0 && (
                  <Card className="bg-orange-50 border-orange-100">
                    <KidsInsights insights={nutritionAnalysis.kidsInsights} />
                  </Card>
                )}
              </>
            );
          })()}

          {/* Batch Cooking */}
          {batchCooking?.recipes && (
            <Card>
              <CardTitle>Batch Cooking Plan</CardTitle>
              <p className="text-sm text-gray-500 mb-3">
                Tap a recipe for ingredients, full method, and cook mode
              </p>
              <div className="space-y-3">
                {batchCooking.recipes.map((recipe, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedBatchRecipe(recipe)}
                    className="p-3 bg-gray-200 rounded-xl cursor-pointer hover:bg-basket-green-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h4 className="font-semibold text-gray-900 leading-snug">{recipe.name}</h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {savedBatchRecipes.has(recipe.name) && (
                          <span className="text-xs text-basket-green-600 font-medium">Saved ✓</span>
                        )}
                        <Badge variant="primary">{recipe.portions || recipe.servings} portions</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Prep: {recipe.prepTime}</span>
                      <span>Cook: {recipe.cookTime}</span>
                      <span className="ml-auto text-basket-green-600">Tap for full recipe →</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Smart Swaps */}
          {smartSwaps?.swaps?.length > 0 && (
            <Card>
              <CardTitle>Smart Swaps</CardTitle>
              <p className="text-sm text-gray-500 mb-3">
                Potential savings: {formatPrice(smartSwaps.totalPotentialSaving || 0)}
              </p>
              <div className="space-y-3">
                {smartSwaps.swaps.slice(0, 3).map((swap, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 bg-gray-200 rounded-xl">
                    <div className="text-xl">
                      {swap.benefit === 'health' ? '🥗' : swap.benefit === 'budget' ? '💰' : '✨'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="text-gray-500">{swap.currentItem}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium text-basket-green-600">{swap.suggestedItem}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{swap.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Dictionary learning banner */}
          {showDictBanner && pendingDictEntries.length > 0 && (
            <div className="bg-basket-green-50 border border-basket-green-100 rounded-xl p-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-basket-green-800">Save these item names for future scans?</p>
                <p className="text-xs text-basket-green-600 mt-0.5">{pendingDictEntries.length} item{pendingDictEntries.length > 1 ? 's' : ''} added or corrected this scan</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { pendingDictEntries.forEach(({ raw, cleaned }) => addProductTranslation(raw, cleaned)); setPendingDictEntries([]); setShowDictBanner(false); }} className="text-xs font-medium text-basket-green-700 hover:text-basket-green-900">Save</button>
                <button onClick={() => setShowDictBanner(false)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
              </div>
            </div>
          )}

          {/* Save Trip */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetScan} className="flex-1">
              Scan Another
            </Button>
            <Button onClick={handleSaveTrip} className="flex-1">
              Save to History
            </Button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="bg-red-50 border-red-100 animate-shake">
          <p className="text-red-500 text-sm">{error}</p>
        </Card>
      )}

      {/* Batch recipe detail overlay */}
      {selectedBatchRecipe && (
        <RecipeDetailPage
          recipe={selectedBatchRecipe}
          onBack={() => setSelectedBatchRecipe(null)}
          onSave={
            savedBatchRecipes.has(selectedBatchRecipe.name)
              ? undefined
              : () => {
                  handleSaveBatchRecipe(selectedBatchRecipe);
                  setSelectedBatchRecipe(null);
                }
          }
        />
      )}

      {/* Add Translation Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product Translation"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
            <p className="font-medium">Tip: Aldi uses numeric product codes</p>
            <p className="text-blue-600 mt-1">Look for 5-6 digit numbers on your receipt (e.g., 852012, 701482)</p>
          </div>
          <Input
            label="Receipt Code"
            placeholder="e.g., 852012 or CKN THIGH FLIS"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
          />
          <Input
            label="Product Name"
            placeholder="e.g., Oranges or Chicken Thigh Fillets"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleAddTranslation} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </AnimatedPage>
  );
}

export default ScanPage;
