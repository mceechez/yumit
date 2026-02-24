# FamilyBasket — Brief Amendment 2
## Remove Favourite Dishes

Add this to the Meals page (Feature 8) implementation.

---

## Feature: Remove & Manage Favourite Meals

Every saved meal — whether added manually, imported via URL, or saved from a batch cooking plan — must have full management options.

### Delete a Single Meal

On every meal card in the Family Favourites, Adult Meals, and Children's Meals sections, add a delete button (🗑 icon, top right of card).

Behaviour:
- Tap delete icon
- Show a small inline confirmation prompt on the card itself (not a full modal):
  > "Remove [Meal Name] from favourites? [Yes, Remove] [Cancel]"
- On confirm: remove from localStorage and remove card with a smooth fade-out animation
- On cancel: dismiss prompt, card returns to normal

Do not use browser `confirm()` dialogs — keep it inline and visually clean.

### Delete All Meals (Reset)

In the Meals page header, add a "Manage" button that reveals bulk actions:

- **Clear Adults' Meals** — removes all meals tagged as adult favourites
- **Clear Children's Meals** — removes all meals tagged as children's favourites  
- **Clear All Favourites** — removes everything

Each bulk action requires a confirmation modal before executing:
> "This will remove all [X] saved meals. This cannot be undone. [Confirm] [Cancel]"

Show the count of meals that will be deleted so the user knows exactly what they're removing.

### Edit a Meal

While we're here — also add an Edit option on each meal card alongside the delete button (✏️ icon). Tapping it opens the meal in an editable form (same fields as the add form) with a Save Changes button. This prevents users having to delete and re-add a meal just to fix a typo or update ingredients.

### Empty State

When all meals have been removed, show a helpful empty state rather than a blank screen:

> "No favourite meals saved yet.
> Add your first meal manually, import from a recipe URL, or save one from your next batch cooking plan."

With a prominent [Add a Meal] button.

### Rotation Engine Protection

If a meal is deleted that was part of the current week's generated shopping list, add a warning before deletion:

> "This meal is in your current shopping list. Removing it won't update the list automatically. [Remove Anyway] [Cancel]"

---

## How to Use This Amendment

Paste into Claude Code when building the Meals page:

```
When building the Meals page, please also implement the meal 
management features from Brief Amendment 2 — individual meal 
deletion with inline confirmation, bulk clear options, and 
edit functionality on each meal card. Use smooth animations 
for card removal. Protect against accidental deletion of meals 
currently in the active shopping list.
```
