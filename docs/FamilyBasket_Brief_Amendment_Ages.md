# FamilyBasket — Brief Amendment: Family Age Ranges & Life Stages

Add the following to the onboarding flow and family profile system.

---

## The Problem This Solves

The current onboarding captures how many adults and children are in the
family but treats everyone as nutritionally identical. A family with a
toddler, a primary school child and two adults has completely different
nutritional needs, portion requirements and recipe tolerances than a family
with two teenagers. The app needs enough context to give genuinely useful
advice rather than generic guidance.

---

## Updated Onboarding — Family Members Screen

Replace the current "number of adults / number of children" fields with a
dynamic family builder. The user adds each family member one at a time.

### For each family member collect:

**Name** (optional but encouraged — makes the app feel personal)

**Life stage** — presented as simple, friendly tiles rather than a dropdown:

```
👶 Toddler        Under 5
🧒 Child          5 to 10
🧑 Young Teen     11 to 16
👤 Adult          17 to 64
🧓 Senior         65 and over
```

For adults only, one optional follow-up question presented gently:

```
Anything we should know?

  [ None ]  [ Pregnant ]  [ Breastfeeding ]  [ Vegetarian ]  [ Vegan ]
```

This is optional and skippable. It is not a medical form — just enough
context to make nutrition advice relevant.

### Example completed family profile:

```
Your Family

  Edem      Adult
  Wife      Adult       Vegetarian
  Theo      Child       Age 5–10
  Lucas     Young Teen  Age 11–16

  + Add another family member
```

### Add / Edit / Remove

Family members can be added, edited or removed at any time from the
Settings page. Changes take effect on the next scan or shopping list
generation.

---

## How Age Ranges Change the AI Behaviour

Pass the full family composition to Claude in the dynamic system prompt.
Claude should use this context in the following ways:

### Nutrition Scoring

Score the shop against the combined nutritional needs of the whole family
rather than a generic adult standard. Flag gaps that are specifically
relevant to the ages present.

Examples of age-aware flags:
- Toddler in family → flag low iron, flag high salt items as a concern
- Child 5–10 → flag calcium levels, flag sugar-heavy snacks
- Young teen → flag protein adequacy, flag iron for girls if relevant
- Senior → flag vitamin D, flag fibre levels
- Pregnant adult → flag folate, flag iron, flag oily fish frequency
- Vegetarian/vegan → flag B12, flag complete protein sources

### Portion Sizing

Scale batch cooking quantities using approximate relative portion sizes:

| Life Stage   | Relative Portion |
|--------------|-----------------|
| Toddler      | 0.4             |
| Child 5–10   | 0.7             |
| Young Teen   | 1.0             |
| Adult        | 1.0             |
| Senior       | 0.85            |

Example: Family of 2 adults + 1 child (5–10) + 1 young teen cooking for
2 days = (1.0 + 1.0 + 0.7 + 1.0) × 2 = 7.4 portions. Round up to 8 for
safety. This is significantly more accurate than simply multiplying family
size by days.

### Recipe Suggestions

Tailor recipe complexity and ingredient choices to the ages present:

- Toddler present → avoid whole nuts, strong spices, high salt ingredients.
  Flag recipes that need texture modification for young children.
- Child 5–10 → favour familiar flavours, mild spices, visible vegetables
  that can be identified rather than hidden (builds food confidence)
- Young teen → can handle more adventurous flavours. Suggest higher protein
  options to support growth.
- Pregnant adult → avoid recipes featuring soft cheeses, raw/undercooked
  eggs, liver, or high-mercury fish. Flag these proactively.
- Vegetarian/vegan family member → ensure at least one batch cook option
  each week that works for them. Flag if the planned rotation has no
  suitable meals.

### Shopping List

When generating the weekly shopping list, the estimated total should reflect
the accurate portion calculation above rather than a flat family headcount
multiply.

---

## Updated System Prompt Builder

Update `buildSystemPrompt(profile)` to include full family composition:

```
FAMILY MEMBERS:
- Edem: Adult
- [Wife's name]: Adult, Vegetarian  
- Theo: Child (5–10)
- Lucas: Young Teen (11–16)

NUTRITIONAL PRIORITIES BASED ON FAMILY COMPOSITION:
- Calcium and vitamin D: important for growing children
- Iron: important for teenagers
- Protein: adequate levels for teen growth
- Salt: monitor — toddler/young child present (if applicable)
- B12 and complete protein: vegetarian adult present
- Varied vegetables: support children's food development
```

Claude should use this context naturally in all responses — nutrition
scoring, recipe suggestions, swap recommendations and shopping list
generation — without making the output feel like a medical document.

---

## Tone Guidelines for Claude

Age-aware advice should feel like a knowledgeable friend who happens to
know a lot about nutrition — not a dietitian writing a clinical report.

Good: "Worth adding some calcium this week — good for Theo and Lucas at
their ages."

Bad: "Children aged 5–16 require 800–1000mg of calcium per day according
to NHS guidelines."

Keep it warm, specific to the family's actual names where possible, and
always actionable.

---

## Notes for Claude Code

- Life stage selection should use visual tiles with emoji — not a dropdown.
  This makes onboarding feel friendly rather than bureaucratic.
- The optional adult follow-up question must be clearly optional with a
  prominent "Skip" or "None" option — never make health questions feel
  mandatory.
- Portion calculation utility function should live in utils/portions.js
  and be used consistently across batch cooking plan generation AND
  shopping list quantity calculations.
- Store family members as an array in the profile object:

```json
{
  "familyName": "The Edem Family",
  "members": [
    { "name": "Edem", "lifeStage": "adult", "notes": [] },
    { "name": "Wife", "lifeStage": "adult", "notes": ["vegetarian"] },
    { "name": "Theo", "lifeStage": "child-5-10", "notes": [] },
    { "name": "Lucas", "lifeStage": "young-teen", "notes": [] }
  ],
  "budget": { "min": 90, "max": 120 },
  "supermarket": "Aldi",
  "batchCooksPerWeek": 2,
  "daysPerBatch": 2
}
```

- If no names are provided, use friendly defaults: "Adult 1", "Child 1" etc.
- Never display ages or life stages judgementally — this is purely for
  nutritional calibration behind the scenes.
