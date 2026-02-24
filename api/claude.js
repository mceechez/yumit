// Vercel serverless function — proxies requests to Anthropic API.
// The API key is never sent to the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey =
    req.headers['authorization']?.replace('Bearer ', '').trim() ||
    process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return res.status(401).json({
      error: 'No API key configured. Please add your Anthropic API key in Settings.',
    });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
