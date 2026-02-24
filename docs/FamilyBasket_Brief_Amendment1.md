# FamilyBasket — Brief Amendment 1
## Usage Counter & Sustainability Nudge

Add this to the project brief as an additional feature to build after the API key setup screen (between steps 1 and 2 in the build order).

---

## Feature: Usage Counter & Sustainability Nudge

### Purpose
The app currently runs on the owner's Anthropic API key. To protect against unexpected costs as users grow, implement a transparent usage counter that nudges users toward contributing once they've experienced real value.

### Implementation

Track scan usage in localStorage under `fb_usage`:

```json
{
  "totalScans": 7,
  "firstScanDate": "2026-02-22",
  "nudgeShown": false,
  "userApiKey": null
}
```

### Behaviour by Scan Count

**Scans 1–9 (Free tier)**
No interruption. App works normally. 
Show a small, unobtrusive counter in the Settings page only:
"You've run 7 scans — this app runs on the Anthropic API."

**Scan 10 (First nudge)**
After the scan completes and results are shown, display a friendly non-blocking modal:

> "🧺 FamilyBasket has saved you time on 10 shops now.
> 
> This app runs on the Anthropic API which costs a small amount per scan (roughly 3p each).
> 
> To keep it running sustainably, you can add your own free Anthropic API key — it takes 2 minutes and gives you your own usage allowance.
> 
> [Add My API Key]  [Maybe Later]"

Set `nudgeShown: true`. Do not show again for 10 more scans.

**Scans 20+ (Recurring gentle reminder)**
Every 10 scans after the first nudge, show a lighter one-line banner at the top of the results screen only (not a modal):

> "💡 Enjoying FamilyBasket? Add your own API key in Settings to keep it free for everyone."

Dismiss button. Never blocks usage.

**If user adds their own API key**
Counter still tracks scans but nudges stop entirely. Show a thank you message once:
> "✅ Thanks for adding your own key — you're all set and fully independent."

### Tone Guidelines
- Never guilt. Never block. Never aggressive.
- Frame it as sustainability, not payment.
- Always show the value first (results), then the nudge after.
- Keep copy warm and honest — explain exactly what the API cost is.

### Settings Page Addition
Add a "Usage" section to Settings showing:
- Total scans run
- Estimated API cost to date (total scans × £0.03)
- API key status (owner key / your own key)
- Link to get a free Anthropic API key

### Future Hook
When a subscription model is added later, this counter becomes the natural trigger point. The nudge modal gets a third button: "[Support with £3/month]" — but do not build this yet. Just leave a clearly commented placeholder in the code:

```javascript
// FUTURE: Add subscription option here when Stripe is integrated
// Trigger: scan count > 10 and no user API key
```

---

## How to Use This Amendment

Paste this into Claude Code when it pauses between tasks:

```
Please also implement the usage counter and sustainability nudge 
as described in the Brief Amendment 1 document. Build it after 
the API key setup screen. The nudge should never block usage — 
it only appears after results are shown. Tone should be warm 
and transparent, not aggressive. Leave a commented placeholder 
for future Stripe integration as specified.
```
