# FamilyBasket — Brief Amendment: Flexible Batch Cooking Duration

Add the following to the recipe generation and meal planning features.

---

## The Problem This Solves

Right now the app assumes every batch cook feeds the family for exactly the
same number of days — whatever was set in the family profile. In reality,
life isn't that consistent. Some weeks you want a curry to last three days
because it's a busy week at work. Other times you're cooking something special
that you only want to eat once. The app should flex around real life rather
than enforcing a fixed rule.

---

## Feature: Per-Meal Batch Duration Selector

### Where It Appears

In three places:

1. **On the batch cooking plan results screen** — after a receipt is scanned
   and recipes are generated, each recipe card gets a duration selector before
   the user finalises the plan.

2. **On the meal preferences page** — when saving a favourite meal (manually
   or via URL import), the user sets a default batch preference for that
   specific meal. A lasagne might always be worth making for 3 days. A fresh
   fish dish might always be 1 day only.

3. **In the shopping list generator** — when the rotation engine selects meals
   for the week, it uses each meal's batch duration to work out total ingredient
   quantities needed.

---

## UI — Duration Selector

Display a simple, friendly prompt directly on each recipe card:

```
How long would you like this to last?

  [ 1 day ]  [ 2 days ]  [ 3 days ]  [ 4 days ]  [ Just tonight ]
```

- Default pre-selected to the family profile setting
- "Just tonight" is a special option meaning single serving — no scaling up,
  cook normally for the family size but don't plan for leftovers
- Selection is per-meal, per-week — it doesn't permanently change the profile

---

## What Changes When Duration Is Selected

When the user picks a duration, the app immediately:

- Recalculates ingredient quantities for that recipe to match the new portion
  count (family size × days selected)
- Updates the estimated cost contribution for that meal in the shopping list
- Flags if the selected duration means the ingredient won't stay fresh that
  long (e.g. fresh fish selected for 3 days gets a gentle amber warning:
  "Fresh fish is best within 2 days — consider freezing a portion")

---

## Freshness & Food Safety Awareness

Claude should be aware of basic UK food safety guidelines when generating
batch suggestions. If a chosen duration conflicts with safe storage, show
a brief, non-alarming tip rather than blocking the choice. Examples:

- Fresh fish or prawns beyond 2 days → "Best to freeze day 2's portion"
- Rice dishes beyond 1 day → "Cool quickly and refrigerate — reheat once only"
- Dishes with cream or soft cheese → "Best eaten within 2 days"

Keep the tone practical and helpful — like advice from a knowledgeable friend,
not a health warning label.

---

## Shopping List Integration

When the rotation engine builds the weekly shopping list, it uses each
meal's selected or default batch duration to calculate exact quantities.
The list should show the user clearly:

```
Chicken Thigh Fillets    900g × 2 packs
(Tray Bake — 3 days + Fish Stew — 2 days)
```

So the user can see exactly why a quantity was chosen, not just a number
pulled from nowhere.

---

## Notes for Claude Code

- Duration selector state is session-level for the scan results screen
  (resets each scan) but persistent for saved favourite meals
- The freshness logic should live in a small utility function that maps
  ingredient categories to maximum recommended refrigerator days
- Scaling logic must account for "Just tonight" correctly — use raw
  family size from profile, no multiplication
- Keep the UI compact — the selector should not dominate the recipe card,
  just sit naturally below the recipe summary
