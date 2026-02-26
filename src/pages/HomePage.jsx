import { Link } from 'react-router-dom';
import { Card, CardTitle, CardDescription } from '../components/ui/Card';
import { AnimatedPage } from '../components/AnimatedPage';
import { getStatistics, getShoppingHistory } from '../services/storage';
import { formatPrice, formatRelativeDate } from '../utils/formatters';
import { GradeBadge } from '../components/ui/Badge';
import { getGrade } from '../services/nutrition';
import { getProfile, LIFE_STAGES } from '../services/profile';

export function HomePage() {
  const stats = getStatistics();
  const recentShop = getShoppingHistory()[0];
  const profile = getProfile();

  return (
    <AnimatedPage className="space-y-4">
      {/* Welcome */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.householdName ? `Welcome back, ${profile.householdName}` : 'Welcome to Yumit'}
        </h2>
        <p className="text-gray-500 mt-1">
          Shop smarter. Eat better.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-basket-green-500">
            {stats.totalShops}
          </p>
          <p className="text-sm text-gray-500">Shopping trips</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-basket-orange-500">
            {formatPrice(stats.averageSpend)}
          </p>
          <p className="text-sm text-gray-500">Avg weekly spend</p>
        </Card>
      </div>

      {/* Last Shop Summary */}
      {recentShop ? (
        <Card>
          <CardTitle>Last Shop</CardTitle>
          <CardDescription>{formatRelativeDate(recentShop.date)}</CardDescription>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{formatPrice(recentShop.total)}</p>
              <p className="text-sm text-gray-500">{recentShop.items?.length || 0} items</p>
            </div>
            {recentShop.nutritionScore && (
              <div className="text-center">
                <GradeBadge grade={getGrade(recentShop.nutritionScore)} size="xl" />
                <p className="text-xs text-gray-500 mt-1">Nutrition</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="text-center py-6">
          <p className="text-gray-500">No shopping history yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Scan your first receipt to get started
          </p>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">Quick Actions</h3>

        <Link to="/scan">
          <Card className="flex items-center gap-4 hover:bg-gray-200 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-basket-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-basket-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Scan Receipt</h4>
              <p className="text-sm text-gray-500">Upload an Aldi receipt photo</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Card>
        </Link>

        <Link to="/list">
          <Card className="flex items-center gap-4 hover:bg-gray-200 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-basket-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-basket-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Generate Shopping List</h4>
              <p className="text-sm text-gray-500">AI-powered weekly list</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Card>
        </Link>

        <Link to="/meals">
          <Card className="flex items-center gap-4 hover:bg-gray-200 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">View Batch Cooking</h4>
              <p className="text-sm text-gray-500">Recipes from your last shop</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Card>
        </Link>
      </div>

      {/* Household Info */}
      {profile && (
        <Card className="bg-basket-green-50 border-basket-green-100">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛒</span>
            <div>
              <p className="font-medium text-basket-green-700">{profile.householdName}</p>
              <p className="text-sm text-basket-green-600">
                {profile.members?.length > 0
                  ? profile.members.map(m => m.name || LIFE_STAGES[m.lifeStage]?.label).filter(Boolean).join(', ')
                  : `${profile.members?.length || 0} household member${profile.members?.length !== 1 ? 's' : ''}`
                }
                {profile.supermarket ? ` · ${profile.supermarket}` : ''}
              </p>
            </div>
          </div>
        </Card>
      )}
    </AnimatedPage>
  );
}

export default HomePage;
