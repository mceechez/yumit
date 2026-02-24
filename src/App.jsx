import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { getApiKey, getProfile } from './services/profile';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import ShoppingListPage from './pages/ShoppingListPage';
import MealsPage from './pages/MealsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import ApiKeySetupPage from './pages/ApiKeySetupPage';
import OnboardingPage from './pages/OnboardingPage';

function App() {
  const [apiKey, setApiKey]   = useState(() => getApiKey());
  const [profile, setProfile] = useState(() => getProfile());

  // Gate 1: no API key → show setup screen
  if (!apiKey) {
    return (
      <ApiKeySetupPage
        onComplete={() => setApiKey(getApiKey())}
      />
    );
  }

  // Gate 2: no family profile → show onboarding wizard
  if (!profile) {
    return (
      <OnboardingPage
        onComplete={() => setProfile(getProfile())}
      />
    );
  }

  // Normal app
  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="list" element={<ShoppingListPage />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route
            path="settings"
            element={
              <SettingsPage
                onProfileChange={() => setProfile(getProfile())}
                onApiKeyChange={() => setApiKey(getApiKey())}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
