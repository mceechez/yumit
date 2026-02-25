import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, GradeBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useClaudeAI } from '../hooks/useClaudeAI';
import {
  researchNutrition,
  generateBatchCooking as batchCookingService,
  getSmartSwaps as swapsService,
} from '../services/claude';
import { translateCode } from '../data/productDictionary';
import { formatPrice } from '../utils/formatters';
import { getProductDictionary, addProductTranslation, addShoppingTrip } from '../services/storage';

// ─── "What the science says" collapsible ─────────────────────────────────────
function ScienceInsights({ insights }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-semibold text-blue-700">What the science says</span>
        <span className="text-blue-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="bg-blue-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-blue-900">{insight.heading}</p>
              <p className="text-sm text-blue-800 leading-relaxed">{insight.body}</p>
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

export function ScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { loading, error, parseReceipt } = useClaudeAI();

  const [step, setStep] = useState('upload'); // upload, parsed, analyzed
  const [imagePreviews, setImagePreviews] = useState([]); // Support multiple images
  const [parsedReceipt, setParsedReceipt] = useState(null);
  const [nutritionAnalysis, setNutritionAnalysis] = useState(null);
  const [batchCooking, setBatchCooking] = useState(null);
  const [smartSwaps, setSmartSwaps] = useState(null);
  const [processingStep, setProcessingStep] = useState('');

  // Modal for adding new product translations
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  // Store files for later processing
  const [selectedFiles, setSelectedFiles] = useState([]);

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
      setStep('parsed');
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

    const allItems = parsedReceipt.items.map(i => ({
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
    } catch (err) {
      console.error('Analysis failed:', err);
      setProcessingStep('');
    }
  };

  const handleSaveTrip = () => {
    const trip = addShoppingTrip({
      items: parsedReceipt.items,
      total: parsedReceipt.total,
      nutritionScore: nutritionAnalysis?.score || 0,
      nutritionGrade: nutritionAnalysis?.grade || 'D',
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
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Scan Receipt</h2>

      {/* Step indicator — visible whenever a background step is running */}
      {processingStep && (
        <div className="flex items-center gap-3 bg-basket-green-50 border border-basket-green-200 rounded-xl px-4 py-3">
          <div className="w-4 h-4 border-2 border-basket-green-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-basket-green-700">{processingStep}</span>
        </div>
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <Card className="text-center py-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-basket-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-basket-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Upload Receipt Photos</h3>
              <p className="text-sm text-gray-500 mt-1">
                Long receipt? Upload multiple photos - we&apos;ll combine them
              </p>
            </div>

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Receipt ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border-2 border-basket-green-200"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                variant={imagePreviews.length > 0 ? 'outline' : 'primary'}
                onClick={() => fileInputRef.current?.click()}
                loading={loading}
                disabled={loading}
              >
                {loading ? processingStep : imagePreviews.length > 0 ? '+ Add More' : 'Choose Photos'}
              </Button>
              {imagePreviews.length > 0 && !loading && (
                <Button
                  onClick={handleProcessImages}
                  disabled={loading}
                >
                  Scan {imagePreviews.length} Photo{imagePreviews.length > 1 ? 's' : ''}
                </Button>
              )}
            </div>
            {imagePreviews.length > 0 && (
              <p className="text-xs text-gray-400">
                {imagePreviews.length} photo{imagePreviews.length > 1 ? 's' : ''} selected
              </p>
            )}

            {/* Tips — shown when no images have been added yet */}
            {imagePreviews.length === 0 && (
              <div className="text-left bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-600">Tips for best results</p>
                <ul className="space-y-1.5 text-xs text-gray-500">
                  <li>Lay receipt flat on a dark surface</li>
                  <li>Ensure all text is in frame</li>
                  <li>Good lighting, no shadows across the text</li>
                  <li>If receipt is long, use the + Add More option</li>
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Parsed Step */}
      {step === 'parsed' && parsedReceipt && (
        <div className="space-y-4">
          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <Card padding="sm">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imagePreviews.map((preview, index) => (
                  <img
                    key={index}
                    src={preview}
                    alt={`Receipt ${index + 1}`}
                    className="h-32 object-contain rounded-lg bg-gray-100 flex-shrink-0"
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                {imagePreviews.length} image{imagePreviews.length > 1 ? 's' : ''} scanned
              </p>
            </Card>
          )}

          {/* Parsed Items */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Items Found ({parsedReceipt.items.length})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                + Add Code
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedReceipt.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.translatedName || item.name}
                    </p>
                    {item.translatedName !== item.originalCode && (
                      <p className="text-xs text-gray-400">{item.originalCode}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(item.price)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-400">x{item.quantity}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-basket-green-600">
                {formatPrice(parsedReceipt.total)}
              </span>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetScan} className="flex-1">
              Scan Again
            </Button>
            <Button
              onClick={handleAnalyze}
              loading={loading}
              disabled={loading || !!processingStep}
              className="flex-1"
            >
              Analyze & Plan
            </Button>
          </div>
        </div>
      )}

      {/* Analyzed Step */}
      {step === 'analyzed' && (
        <div className="space-y-4">
          {/* Nutrition Score */}
          {nutritionAnalysis && (
            <Card>
              <CardTitle>Nutrition Score</CardTitle>
              <div className="mt-3 flex items-center gap-4">
                <GradeBadge grade={nutritionAnalysis.grade} size="xl" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          nutritionAnalysis.score >= 80 ? 'bg-green-500' :
                          nutritionAnalysis.score >= 60 ? 'bg-blue-500' :
                          nutritionAnalysis.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${nutritionAnalysis.score}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold">{nutritionAnalysis.score}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{nutritionAnalysis.summary}</p>
                </div>
              </div>

              {/* Positives */}
              {nutritionAnalysis.positives?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-green-700 mb-2">Positives</p>
                  <div className="space-y-1">
                    {nutritionAnalysis.positives.map((pos, i) => (
                      <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500">✓</span> {pos}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags */}
              {nutritionAnalysis.flags?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-yellow-700 mb-2">Areas to Watch</p>
                  <div className="space-y-1">
                    {nutritionAnalysis.flags.map((flag, i) => (
                      <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-yellow-500">!</span> {flag}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {nutritionAnalysis.gaps?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Missing Food Groups</p>
                  <div className="flex flex-wrap gap-2">
                    {nutritionAnalysis.gaps.map((gap, i) => (
                      <Badge key={i} variant="danger">{gap}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* What the science says — collapsible, only when insights present */}
              {nutritionAnalysis.insights?.length > 0 && (
                <ScienceInsights insights={nutritionAnalysis.insights} />
              )}
            </Card>
          )}

          {/* Good for the kids — separate card, only when kidsInsights present */}
          {nutritionAnalysis?.kidsInsights?.length > 0 && (
            <Card className="bg-orange-50 border-orange-100">
              <KidsInsights insights={nutritionAnalysis.kidsInsights} />
            </Card>
          )}

          {/* Batch Cooking */}
          {batchCooking?.recipes && (
            <Card>
              <CardTitle>Batch Cooking Plan</CardTitle>
              <p className="text-sm text-gray-500 mb-3">
                2 recipes to cook this week, each feeds 4 for 2 days
              </p>
              <div className="space-y-4">
                {batchCooking.recipes.map((recipe, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{recipe.name}</h4>
                      <Badge variant="primary">{recipe.servings} portions</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Prep: {recipe.prepTime}</span>
                      <span>Cook: {recipe.cookTime}</span>
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
                  <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
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
        <Card className="bg-red-50 border-red-200">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      {/* Add Translation Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product Translation"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
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
    </div>
  );
}

export default ScanPage;
