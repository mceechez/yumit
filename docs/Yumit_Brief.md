# Yumit — Full Product Brief for Claude Code
**Version 3.0 — Complete Feature Set — Vercel Ready**

---

## Project Overview

Build a React web application called **Yumit** — a personal grocery intelligence tool that scans receipts, scores nutrition, plans batch cooking, generates shopping lists, and learns a household's food preferences over time.

**Tagline: Shop smarter. Eat better.**

Yumit works for any household — single people, couples, families. No demographic assumptions built into the UI or copy. Always refer to "your household" not "your family" throughout the app.

The app must work on both mobile browsers and desktop. No native app store deployment required — it is a Progressive Web App (PWA) accessible via a public URL.

---

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **State & Persistence:** localStorage (no backend database required at this stage)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514) for all intelligence features
- **PDF handling:** pdf.js for PDF receipt parsing
- **Barcode scanning:** html5-qrcode or ZXing for camera-based barcode scanning
- **Deployment:** Vercel — must be fully Vercel-ready from day one

---

## Vercel Deployment Requirements

- All environment variables must be configurable via Vercel environment variables panel
- No hardcoded API keys anywhere in the codebase
- `vercel.json` config file included in root
- Build command: `npm run build`
- Output directory: `dist`
- The app must pass Vercel's build pipeline without errors
- Include a `.env.example` file documenting all required environment variables

---

## API Key Handling

**Critical — no API keys hardcoded in source code.**

On first launch, if no API key is stored, show an API Key Setup screen before anything else. The user enters their own Anthropic API key. Store it in localStorage. All Claude API calls use this stored key.

Include a clear explanation on the setup screen:
- Where to get a free Anthropic API key (console.anthropic.com)
- That the key is stored locally on their device only
- That they pay for their own API usage (approximately £0.01–0.03 per receipt scan)

Add a Settings option to update or remove the API key at any time.

---

## Onboarding — First Run Household Profile

On first launch (after API key setup), show a household profile onboarding screen. This makes the app usable by any household — single person, couple, or family. No assumptions about household size or type.

Collect the following:

- Household name (e.g. "The Smiths" or just "Edem")
- Number of adults
- Number of children (optional — 0 is a valid answer with no further prompts)
- Children's names (optional, only shown if children > 0)
- Weekly grocery budget (£ amount, shown as a range slider with £20–£300)
- Primary supermarket (dropdown: Aldi, Lidl, Tesco, Sainsbury's, Waitrose, M&S, Asda, Morrisons, Ocado, Other)
- How many times per week they batch cook (1–7)
- How many days each batch covers (1–4)

Save this profile to localStorage as `yumit_profile`. Use it to dynamically generate the AI system prompt for every Claude API call. No personal data should be hardcoded.

Add a **Settings** page where the profile can be fully edited at any time.

---

## AI System Prompt — Dynamic Generation

Build a function `buildSystemPrompt(profile)` that takes the stored household profile and returns a personalised system prompt string. Example output:

```
You are a personal nutrition and grocery advisor.
HOUSEHOLD PROFILE:
- Household: The Smiths
- 2 adults, 2 children (Theo, Lucas)
- Weekly grocery budget: £90–£120
- Primary supermarket: Aldi
- Batch cook 2 times per week, each batch covers 2 days
- Goal: better nutrition without exceeding budget
- Location: UK — recommend UK supermarket products and brands
```

This prompt must be passed as the `system` parameter on every Claude API call.

---

## Feature 1 — Receipt Scanning (Three Input Methods)

Support three ways to input a receipt. All three feed into the same analysis pipeline.

### Method A: Photo Upload
Camera or file upload. User photographs a physical receipt. Claude reads the image using vision and extracts all items, quantities and prices.

### Method B: PDF Upload
Accept PDF receipt attachments (common from Tesco, Sainsbury's, Waitrose, Ocado). Use pdf.js to extract raw text from the PDF. Pass the extracted text to Claude for parsing. No image processing needed — text extraction is faster and more accurate.

### Method C: Text Paste
A text input box. User pastes raw email receipt content or copy-pastes from a supermarket app confirmation screen. Claude parses the plain text directly.

### Receipt Parsing Logic
For all three methods, Claude should return structured JSON:

```json
{
  "store": "Aldi",
  "date": "22/02/2026",
  "items": [
    {
      "name": "Chicken Thigh Fillets",
      "productCode": "701482",
      "price": 5.69,
      "quantity": 1,
      "originalCode": "CKN THIGH FLIS 900",
      "dictMatched": true
    }
  ],
  "total": 90.13
}
```

After Claude extraction, apply a second client-side dictionary pass (see Feature 2) before any analysis runs.

---

## Feature 2 — Product Dictionary

A learning dictionary that translates cryptic supermarket receipt codes and abbreviations into real product names.

### Primary Key: Numeric Product Codes
Match on 5–6 digit numeric product codes first. These are permanent and reliable across all receipts from the same store.

### Secondary Key: Text Abbreviations
If no numeric code match, attempt text-based matching against known abbreviations.

### Pre-seeded Aldi Dictionary (Numeric Codes)
Load these on first install for Aldi users:

| Code | Product | Category |
|------|---------|----------|
| 852012 | Oranges | Fruit |
| 830846 | Chopped Tomatoes (tin) | Tinned |
| 701482 | Chicken Thigh Fillets | Meat |
| 853803 | Frozen Coldwater Prawns | Fish |
| 832811 | Frozen Chips | Frozen |
| 48645 | Chocolate Pastries | Bakery |
| 60464 | Cod Fillets | Fish |
| 721630 | Pork Shoulder Steaks | Meat |
| 735335 | BBQ Ribs | Meat |
| 48727 | Mackerel Fillets | Fish |
| 830803 | Sausage Rolls | Bakery |
| 51029 | Cauliflower | Vegetables |
| 819957 | Broccoli | Vegetables |
| 830295 | Aubergine | Vegetables |
| 717110 | Onions Brown | Vegetables |
| 845472 | Spring Onions | Vegetables |
| 15256 | Sweetcorn | Vegetables |
| 836859 | Bananas | Fruit |
| 807345 | White Grapes | Fruit |
| 57475 | Strawberries | Fruit |
| 834701 | Baked Beans | Tinned |
| 46966 | Sweet Chilli Sauce | Condiments |
| 54702 | Fruit & Herb Tea | Drinks |
| 735058 | Cashews Salted | Snacks |
| 847944 | Red Wine Shiraz | Drinks |
| 706165 | Candle Jar | Non-food |
| 726231 | Cat Treats | Non-food |
| 717547 | Hair Care Product | Non-food |
| 849267 | Mamia Wipes | Non-food |
| 830976 | Surface Wipes | Non-food |

**Important:** Only show Aldi pre-seeded data to users who selected Aldi as their primary supermarket during onboarding. Other supermarket users start with an empty dictionary.

### Dictionary UI
Dedicated Dictionary tab with:
- Full table view of all entries (code, product name, store, category)
- Filter by store and category
- Search bar
- Add new entry form with:
  - Receipt code / numeric code field
  - Plain English name field
  - AI Guess button — sends the code to Claude and suggests a product name (one click to accept)
  - Store selector
  - Category selector
- Edit and delete any entry
- Stats: total products decoded, stores covered, non-food items flagged

### Fix Names in Results
In the receipt results view, a "Fix Names" toggle reveals an edit button on every item card. Tapping it prompts for the correct name and category. The correction saves instantly to the dictionary and never happens again.

### Visual Indicators
Items that were auto-translated show a blue border and display the original receipt code in small text beneath the corrected name.

---

## Feature 3 — Nutrition Scoring

After receipt parsing and dictionary translation, send the item list to Claude for nutrition analysis.

Claude returns:

```json
{
  "score": 72,
  "grade": "B",
  "summary": "Good protein variety but high in processed snacks",
  "positives": ["Excellent fish variety", "Strong vegetable range"],
  "flags": ["High processed snack count", "Low leafy greens"],
  "missing": ["Leafy greens", "Eggs", "Legumes"],
  "budgetStatus": "under",
  "budgetNote": "Spent £90.13 — £30 under your upper budget limit"
}
```

Display:
- Score circle (colour coded: green 70+, amber 50–69, red below 50)
- Grade badge
- Summary sentence
- Positive pills (green)
- Flag pills (amber)
- Budget status bar
- Missing nutrients section

---

## Feature 4 — Batch Cooking Plan

Generate a batch cooking plan from the scanned items, tailored to the family profile.

Rules passed to Claude:
- Cook [N] times per week (from profile)
- Each cook feeds the family for [N] days (from profile)
- Scale every recipe to family size
- UK meals, kid-friendly options where children are in the profile
- Prioritise ingredients already in the scanned shop
- Flag which meals refrigerate well vs. which don't batch well
- Note ingredient overlap across meals to minimise waste

Claude returns:

```json
{
  "recipes": [
    {
      "name": "Chicken & Veg Tray Bake",
      "cookDay": "Sunday",
      "serves": "4 people for 2 days",
      "prepTime": "15 mins",
      "cookTime": "45 mins",
      "ingredients": ["Chicken Thigh Fillets", "Cauliflower", "Broccoli"],
      "method": "Two sentence method description.",
      "batchTip": "Store in roasting tray, reheat covered at 180C for 15 mins.",
      "nutritionBoost": "High protein, vitamin C, iron"
    }
  ],
  "swaps": [...],
  "nextWeekTip": "Add a bag of spinach next week to address iron gap."
}
```

---

## Feature 5 — Smart Swaps

For each nutritional flag or low-quality item, Claude suggests a specific better alternative:

```json
{
  "current": "Sausage Rolls",
  "swap": "Box of eggs",
  "reason": "Eggs are complete protein with zero processing. Sausage rolls are processed meat with high salt.",
  "saving": "£0.46 cheaper"
}
```

Display as a card with current item on left, arrow, better option on right with reason and saving/cost note.

---

## Feature 6 — Barcode Scanner

A dedicated scan screen accessible from the main navigation. User points their phone camera at any food product barcode.

### Flow
1. Camera opens via html5-qrcode or ZXing
2. Barcode detected and decoded to EAN-13 or similar
3. Query Open Food Facts API: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
4. Extract: product name, brand, Nutri-Score grade, nutritional values per 100g (calories, protein, fat, saturated fat, carbohydrates, sugar, salt, fibre)
5. Display a product health card with full breakdown
6. Option to save product to the family dictionary with its barcode as the code
7. Option to add product to a manual shopping list

### Fallback
If Open Food Facts returns no result, send the barcode to Claude with any visible product name and ask for a nutrition estimate.

### Important Note
Barcode scanning works for packaged goods only. Not suitable for loose produce or unpackaged fresh items. Display a note explaining this to users.

---

## Feature 7 — URL Recipe Import

On the meal preferences page, provide two ways to add a favourite meal: manual entry OR URL import.

### URL Import Flow
1. User pastes a recipe URL (BBC Good Food, Jamie Oliver, any food blog)
2. App attempts to fetch and parse the page
3. Send page content to Claude with instruction to extract: recipe name, ingredient list with quantities, serving size, prep time, cook time, brief method summary
4. Claude maps ingredients to existing dictionary products where possible
5. Display extracted recipe for user review before saving
6. User confirms or edits, then saves to family favourites
7. Original URL stored with the recipe as a source reference link

### Fallback
Some sites block scraping. If fetch fails, show a manual paste fallback — a text area where the user pastes the ingredients list directly. Same Claude extraction then applies.

### Serving Size Scaling
When a recipe is imported, automatically scale ingredients to match the family profile's portion requirements (family size × days per batch).

---

## Feature 8 — Meal Preferences & Rotation Engine

A dedicated Meals page with three sections: Household Favourites, Adult Meals, and (if children in profile) Children's Meals. If no children in the profile, the Children's Meals section is hidden entirely.

### Adding Meals
Three ways to add a meal:
1. Type it manually (name + key ingredients)
2. Import from URL (see Feature 7)
3. Save from a generated batch cooking plan (one-tap save from results)

Each saved meal stores: name, ingredients list, source URL (if imported), tags (quick/slow cook, vegetarian, fish, etc.), last cooked date.

### Shopping List Generator — Rotation Engine

A dedicated "This Week's List" screen. User taps "Generate Shopping List" and the engine:

1. Reviews last 2 weeks of meal history to avoid repeating recent meals
2. Selects [N] meals from family favourites to fill the week's batch cook slots
3. Weights selection toward meals that address current nutritional gaps (from last receipt scan if available)
4. Combines all ingredients across selected meals
5. Deduplicates (if two meals need chicken, combines into one quantity)
6. Identifies nutritional gaps in the planned rotation and adds gap-filler ingredients (e.g. "add a bag of spinach — low on iron this week")
7. Groups the final list by supermarket aisle category: Produce, Meat & Fish, Dairy, Frozen, Tinned & Dry, Bakery, Drinks, Household

### Shopping List Output
Clean, printable shopping list view:
- Grouped by aisle category with clear headers
- Each item shows quantity needed and estimated price where known
- Gap-filler items clearly labelled as "Nutrition boost — optional"
- Estimated total at the bottom vs. your weekly budget
- Share button (copy to clipboard or share as text)
- Print/screenshot optimised layout (clean white background, no navigation chrome)

---

## Feature 9 — History & Trends

History tab showing all past scans in reverse chronological order.

Summary stats at the top:
- Total shops scanned
- Average weekly spend vs. budget
- Average nutrition score
- Score trend (improving / stable / declining)
- Dictionary size

Each history entry shows: store, date, item count, nutrition score, total spend, number of dictionary translations applied.

Tap any entry to view full results. Past results are read-only.

---

## Navigation Structure

Bottom navigation bar (mobile) / sidebar (desktop) with five tabs:
1. 📸 Scan — receipt input and analysis
2. 🍳 Meals — favourites, preferences, rotation
3. 📋 List — generated shopping list for this week
4. 📖 Dictionary — product code library
5. 📊 History — past shops and trends

Settings accessible from a gear icon in the header: family profile, API key, supermarket preference.

---

## UI & Design Requirements

- Works on mobile browser and desktop — fully responsive
- Warm, food-friendly colour palette (greens, creams, warm browns — not clinical blue/white)
- Georgia or similar serif font for headings — not generic sans-serif
- Cards, pills, and subtle shadows — no harsh borders
- Loading states with descriptive messages ("Reading your receipt...", "Building your batch plan...")
- Error states with clear, plain English explanations and retry options
- Empty states with helpful prompts rather than blank screens
- Dictionary-translated items visually distinguished (blue accent)
- Non-food items visually distinguished in item lists (amber/grey accent)
- Shopping list view has a clean print/screenshot mode with no navigation elements

---

## Data Privacy

- All data stored in localStorage on the user's device
- No data sent to any server except the Anthropic API for AI processing
- No analytics, no tracking, no user accounts
- API key stored in localStorage — user's responsibility
- Display a brief privacy note on the onboarding screen confirming this

---

## CLAUDE.md File

Create a CLAUDE.md in the project root containing:
- Project name: Yumit — Shop smarter. Eat better.
- Project overview and purpose
- Full tech stack
- Key file structure
- The household profile system explanation
- How the dynamic system prompt works
- Dictionary priority order (numeric codes first, text second)
- Inclusive language rules (household not family, any household size)
- npm run commands (dev, build, preview)
- Vercel deployment instructions

---

## File Structure

```
yumit/
├── public/
│   ├── manifest.json        # PWA manifest
│   └── icons/               # App icons for PWA
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Navigation.jsx
│   │   ├── ScoreCircle.jsx
│   │   ├── RecipeCard.jsx
│   │   ├── SwapCard.jsx
│   │   ├── ItemCard.jsx
│   │   └── LoadingSpinner.jsx
│   ├── pages/
│   │   ├── Onboarding.jsx
│   │   ├── ApiKeySetup.jsx
│   │   ├── Scan.jsx
│   │   ├── Results.jsx
│   │   ├── Meals.jsx
│   │   ├── ShoppingList.jsx
│   │   ├── Dictionary.jsx
│   │   ├── History.jsx
│   │   └── Settings.jsx
│   ├── hooks/
│   │   ├── useProfile.js
│   │   ├── useDictionary.js
│   │   ├── useHistory.js
│   │   └── useMeals.js
│   ├── utils/
│   │   ├── claude.js         # All Claude API call functions
│   │   ├── systemPrompt.js   # Dynamic system prompt builder
│   │   ├── dictionary.js     # Dictionary matching logic
│   │   ├── pdfParser.js      # PDF receipt text extraction
│   │   ├── recipeImport.js   # URL recipe scraping
│   │   └── openFoodFacts.js  # Barcode lookup
│   ├── data/
│   │   └── defaultDictionary.js  # Pre-seeded Aldi codes
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vercel.json
├── CLAUDE.md
├── vite.config.js
└── package.json
```

**localStorage key naming convention — all keys prefixed with `yumit_`:**
- `yumit_profile` — household profile
- `yumit_dictionary` — product code dictionary
- `yumit_history` — past shop scans
- `yumit_meals` — saved favourite meals
- `yumit_usage` — usage counter for sustainability nudge
- `yumit_apikey` — user's Anthropic API key

---

## vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## .env.example

```
# Anthropic API Key
# Get yours free at console.anthropic.com
# This is handled via the in-app API key setup screen
# Only needed if you want to pre-populate for development
VITE_ANTHROPIC_API_KEY=your_key_here
```

---

## Build Order Recommendation

Build in this order to have something working at each stage:

1. Project scaffold — Vite + React + Tailwind + Vercel config
2. API key setup screen
3. Onboarding + profile storage + dynamic system prompt
4. Receipt scanning — photo upload + Claude extraction
5. Product dictionary — storage, UI, pre-seed, auto-apply to scans
6. Nutrition scoring — display results
7. Batch cooking plan — recipe generation
8. Smart swaps
9. Meal preferences — manual entry
10. URL recipe import
11. Shopping list generator + rotation engine
12. Barcode scanner (Open Food Facts)
13. History tab
14. PDF and text paste receipt inputs
15. PWA manifest + icons + print mode for shopping list
16. Polish — empty states, loading states, error handling

---

## Important Notes for Claude Code

- App name is **Yumit**. Tagline is **Shop smarter. Eat better.**
- Use **household** not family throughout all UI copy — the app is for everyone
- Children's Meals section only appears if the household profile includes children
- Match numeric product codes FIRST, then fall back to text matching in the dictionary
- All localStorage keys must be prefixed with `yumit_`
- Non-food items (cleaning products, toiletries, pet food, candles) should be flagged and excluded from nutrition scoring but kept in the spend total
- All currency is GBP (£) — never USD
- All supermarket recommendations should be UK-specific
- Batch cooking recipes must automatically scale to the household's profile (size × days)
- The shopping list must always show an estimated total vs. the household's weekly budget
- Test the Vercel build locally with `npm run build` before considering any feature complete
- The app name Yumit should appear in the browser tab title, PWA manifest, and onboarding screen with the tagline beneath it
