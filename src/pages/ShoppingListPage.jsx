import { useState } from 'react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SkeletonShoppingList } from '../components/ui/Skeleton';
import { AnimatedPage } from '../components/AnimatedPage';
import { useClaudeAI } from '../hooks/useClaudeAI';
import { getMealPreferences, getLastWeekMeals, getSettings, updateLastWeekMeals } from '../services/storage';
import { getProfile } from '../services/profile';
import { formatPrice } from '../utils/formatters';
import { aisleCategories, getCategoryByName } from '../data/aisleCategories';

export function ShoppingListPage() {
  const { loading, error, generateShoppingList } = useClaudeAI();
  const [shoppingList, setShoppingList] = useState(null);

  const handleGenerate = async () => {
    const preferences = getMealPreferences();
    const lastWeekMeals = getLastWeekMeals();
    const settings = getSettings();

    try {
      const result = await generateShoppingList({
        adultMeals: preferences.adults,
        kidMeals: preferences.kids,
        lastWeekMeals,
        budget: {
          min: settings.budgetMin,
          max: settings.budgetMax,
        },
      });

      setShoppingList(result);

      // Update last week's meals
      if (result.selectedMeals) {
        updateLastWeekMeals(result.selectedMeals.map(m => m.name));
      }
    } catch (err) {
      console.error('Failed to generate shopping list:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatedPage className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Shopping List</h2>
        {shoppingList && (
          <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
            Print
          </Button>
        )}
      </div>

      {!shoppingList && !loading && (
        <Card className="text-center py-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-basket-orange-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-basket-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Generate Weekly List</h3>
              <p className="text-sm text-gray-500 mt-1">
                AI creates a shopping list based on your household&apos;s favourite meals
              </p>
            </div>
            <Button onClick={handleGenerate}>
              Generate Shopping List
            </Button>
          </div>
        </Card>
      )}

      {/* Skeleton loader while generating */}
      {loading && !shoppingList && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 text-center animate-pulse">Building your list…</p>
          <SkeletonShoppingList />
        </div>
      )}

      {error && (
        <Card className="bg-red-50 border-red-100">
          <p className="text-red-500 text-sm">{error}</p>
        </Card>
      )}

      {shoppingList && (
        <div className="space-y-4 print:space-y-2">
          {/* Header for print */}
          <div className="hidden print:block text-center mb-4">
            <h1 className="text-2xl font-bold">Yumit Shopping List</h1>
            <p className="text-gray-500">{getProfile()?.supermarket || 'Shopping'} • {new Date().toLocaleDateString('en-GB')}</p>
          </div>

          {/* Meal Plan */}
          {shoppingList.mealPlan && (
            <Card className="print:border print:shadow-none">
              <CardTitle>This Week&apos;s Meals</CardTitle>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(shoppingList.mealPlan).map(([day, meal]) => (
                  <div key={day} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-600 w-16">{day.slice(0, 3)}</span>
                    <span className="text-gray-900">{meal}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Shopping List by Aisle */}
          {shoppingList.shoppingList && (
            <div className="space-y-3 print:space-y-2">
              {Object.entries(shoppingList.shoppingList).map(([aisle, items]) => {
                if (!items || items.length === 0) return null;
                const category = getCategoryByName(aisle);

                return (
                  <Card key={aisle} className="print:border print:shadow-none print:p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl print:text-base">{category?.icon || '📦'}</span>
                      <h3 className="font-semibold text-gray-900">{aisle}</h3>
                      <Badge variant="default" size="sm">{items.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between py-1 border-b border-gray-200 last:border-0 animate-item-appear stagger-${Math.min(index, 12)}`}
                        >
                          <div className="flex items-center gap-2">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                            <span className="text-gray-900">{item.item}</span>
                            {item.quantity && (
                              <span className="text-sm text-gray-500">({item.quantity})</span>
                            )}
                          </div>
                          {item.estimatedPrice && (
                            <span className="text-sm text-gray-500">
                              {formatPrice(item.estimatedPrice)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Gap Fillers */}
          {shoppingList.gapFillers?.length > 0 && (
            <Card className="bg-blue-50 border-blue-100 print:border print:bg-white">
              <CardTitle className="text-blue-700">Nutrition Gap Fillers</CardTitle>
              <p className="text-sm text-blue-700 mb-2">Added to balance the household&apos;s nutrition</p>
              <div className="space-y-1">
                {shoppingList.gapFillers.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500">+</span>
                    <span className="font-medium">{item.item}</span>
                    <span className="text-gray-500">- {item.reason}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Estimated Total */}
          {shoppingList.estimatedTotal && (
            <Card className="bg-basket-green-50 border-basket-green-100 print:border print:bg-white">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-basket-green-700">Estimated Total</span>
                <span className="text-2xl font-bold text-basket-green-500">
                  {formatPrice(shoppingList.estimatedTotal)}
                </span>
              </div>
            </Card>
          )}

          {/* Generate New Button */}
          <Button
            onClick={handleGenerate}
            variant="outline"
            loading={loading}
            disabled={loading}
            className="w-full no-print"
          >
            Generate New List
          </Button>
        </div>
      )}
    </AnimatedPage>
  );
}

export default ShoppingListPage;
