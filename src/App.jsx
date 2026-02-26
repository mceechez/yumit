import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { getProfile } from './services/profile';
import { runStartupMigration } from './services/storage';

// Run once at startup — migrates legacy data and marks existing users as initialised
runStartupMigration();
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import ShoppingListPage from './pages/ShoppingListPage';
import MealsPage from './pages/MealsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
// import ApiKeySetupPage from './pages/ApiKeySetupPage'; // TESTING: API key gate disabled
import OnboardingPage from './pages/OnboardingPage';

function App() {
  // const [apiKey, setApiKey] = useState(() => getApiKey()); // TESTING: not needed while using server key
  const [profile, setProfile] = useState(() => getProfile());

  // TESTING: Gate 1 (API key setup screen) is disabled.
  // All Claude calls route through the server proxy using process.env.ANTHROPIC_API_KEY.
  // To restore per-user key flow, uncomment the block below and re-enable the import above.
  //
  // if (!apiKey) {
  //   return (
  //     <ApiKeySetupPage
  //       onComplete={() => setApiKey(getApiKey())}
  //     />
  //   );
  // }

  // Gate 2: no household profile → show onboarding wizard
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
                // onApiKeyChange={() => setApiKey(getApiKey())} // TESTING: disabled with API key gate
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
