import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-gray-100/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 no-print">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-xl font-bold text-basket-green-500">Yumit</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <Navigation />
    </div>
  );
}

export default Layout;
