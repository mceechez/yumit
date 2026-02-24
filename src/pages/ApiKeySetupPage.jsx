import { useState } from 'react';
import { saveApiKey } from '../services/profile';
import { Button } from '../components/ui/Button';

export function ApiKeySetupPage({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError]   = useState('');

  const handleSubmit = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('Please enter your API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError("That doesn't look right — Anthropic API keys start with sk-ant-");
      return;
    }
    saveApiKey(trimmed);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-basket-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo / Hero */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mx-auto">
            <span className="text-4xl">🧺</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Yumit</h1>
          <p className="text-gray-500">Shop smarter. Eat better.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900">Connect your Anthropic API key</h2>
            <p className="text-sm text-gray-500 mt-1">
              Yumit uses Claude AI to read receipts and plan your meals.
              You&apos;ll need a free Anthropic API key to get started.
            </p>
          </div>

          {/* How to get a key */}
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-2">
            <p className="font-medium">How to get your free key (2 minutes):</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Visit <span className="font-mono">console.anthropic.com</span></li>
              <li>Sign up for a free account</li>
              <li>Go to API Keys and create a new key</li>
              <li>Paste it below</li>
            </ol>
          </div>

          {/* Input */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Your API key</label>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoComplete="off"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500 font-mono"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!apiKey.trim()}
            className="w-full"
          >
            Continue
          </Button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Your key is stored only on this device and never shared.
            Each receipt scan costs approximately £0.01–0.03 in API usage.
          </p>
        </div>

      </div>
    </div>
  );
}

export default ApiKeySetupPage;
