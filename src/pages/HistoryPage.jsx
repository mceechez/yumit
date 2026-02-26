import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge, GradeBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { AnimatedPage } from '../components/AnimatedPage';
import { getShoppingHistory, getStatistics } from '../services/storage';
import { formatPrice, formatDate, formatRelativeDate, formatDateShort } from '../utils/formatters';
import { getGrade } from '../services/nutrition';

export function HistoryPage() {
  const [selectedTrip, setSelectedTrip] = useState(null);
  const history = getShoppingHistory();
  const stats = getStatistics();

  // Prepare chart data (reversed for chronological order)
  const chartData = history.slice(0, 10).reverse().map(h => ({
    date: formatDateShort(h.date),
    spend: h.total || 0,
    score: h.nutritionScore || 0,
  }));

  return (
    <AnimatedPage className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Shopping History</h2>

      {history.length === 0 ? (
        <Card className="text-center py-8">
          <div className="space-y-3">
            <span className="text-5xl">📋</span>
            <h3 className="font-semibold text-gray-900">No History Yet</h3>
            <p className="text-sm text-gray-500">
              Scan receipts to build up your shopping history
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center" padding="sm">
              <p className="text-2xl font-bold text-basket-green-600">{stats.totalShops}</p>
              <p className="text-xs text-gray-500">Total Shops</p>
            </Card>
            <Card className="text-center" padding="sm">
              <p className="text-2xl font-bold text-basket-orange-500">
                {formatPrice(stats.averageSpend)}
              </p>
              <p className="text-xs text-gray-500">Avg Spend</p>
            </Card>
            <Card className="text-center" padding="sm">
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(stats.averageNutritionScore)}
              </p>
              <p className="text-xs text-gray-500">Avg Score</p>
            </Card>
          </div>

          {/* Spend Trend Chart */}
          {chartData.length > 1 && (
            <Card>
              <CardTitle>Weekly Spend Trend</CardTitle>
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#8E8E93' }}
                      stroke="#3A3A3C"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#8E8E93' }}
                      stroke="#3A3A3C"
                      tickFormatter={(value) => `£${value}`}
                    />
                    <Tooltip
                      formatter={(value) => [`£${value.toFixed(2)}`, 'Spend']}
                      labelStyle={{ color: '#EBEBF5' }}
                      contentStyle={{
                        backgroundColor: '#2C2C2E',
                        border: '1px solid #3A3A3C',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#4CAF50"
                      strokeWidth={2}
                      dot={{ fill: '#4CAF50', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Nutrition Score Trend */}
          {chartData.length > 1 && (
            <Card>
              <CardTitle>Nutrition Score Trend</CardTitle>
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#8E8E93' }}
                      stroke="#3A3A3C"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#8E8E93' }}
                      stroke="#3A3A3C"
                    />
                    <Tooltip
                      formatter={(value) => [value, 'Score']}
                      labelStyle={{ color: '#EBEBF5' }}
                      contentStyle={{
                        backgroundColor: '#2C2C2E',
                        border: '1px solid #3A3A3C',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#0A84FF"
                      strokeWidth={2}
                      dot={{ fill: '#0A84FF', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Shopping History List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Recent Shops</h3>
            {history.map((trip) => (
              <Card
                key={trip.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedTrip(trip)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {trip.store || 'Aldi Chingford'}
                      </span>
                      <Badge variant="default" size="sm">
                        {trip.items?.length || 0} items
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatRelativeDate(trip.date)}
                    </p>
                    {trip.batchMeals?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        🍳 {trip.batchMeals.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatPrice(trip.total)}
                    </p>
                    {trip.nutritionScore && (
                      <GradeBadge grade={getGrade(trip.nutritionScore)} size="sm" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Trip Detail Modal */}
      <Modal
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={`Shop - ${formatDate(selectedTrip?.date)}`}
        size="lg"
      >
        {selectedTrip && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{selectedTrip.store || 'Aldi Chingford'}</p>
                <p className="text-2xl font-bold">{formatPrice(selectedTrip.total)}</p>
              </div>
              {selectedTrip.nutritionScore && (
                <div className="text-center">
                  <GradeBadge grade={getGrade(selectedTrip.nutritionScore)} size="xl" />
                  <p className="text-sm text-gray-500 mt-1">Score: {selectedTrip.nutritionScore}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Items ({selectedTrip.items?.length || 0})
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {selectedTrip.items?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1 text-sm border-b border-gray-200"
                  >
                    <span>{item.translatedName || item.name || item.code}</span>
                    <span className="text-gray-500">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Meals */}
            {selectedTrip.batchMeals?.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3">
                <h4 className="font-semibold text-blue-700 mb-2">Batch Cooking</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTrip.batchMeals.map((meal, i) => (
                    <Badge key={i} variant="info">{meal}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AnimatedPage>
  );
}

export default HistoryPage;
