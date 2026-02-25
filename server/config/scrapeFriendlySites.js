// Sites known to work with server-side scraping for recipe search.
// WordPress-based sites (?s= search) return server-rendered HTML with article links,
// making them the most reliable for extracting first-result URLs.
// Update this list if sites change their rendering approach.

export const SCRAPE_FRIENDLY_SITES = [
  {
    name: 'Budget Bytes',
    domain: 'budgetbytes.com',
    searchUrl: (q) => `https://www.budgetbytes.com/?s=${encodeURIComponent(q)}`,
  },
  {
    name: 'RecipeTin Eats',
    domain: 'recipetineats.com',
    searchUrl: (q) => `https://www.recipetineats.com/?s=${encodeURIComponent(q)}`,
  },
  {
    name: 'Simply Recipes',
    domain: 'simplyrecipes.com',
    searchUrl: (q) => `https://www.simplyrecipes.com/search/?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'AllRecipes',
    domain: 'allrecipes.com',
    searchUrl: (q) => `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'Food.com',
    domain: 'food.com',
    searchUrl: (q) => `https://www.food.com/search/${encodeURIComponent(q)}`,
  },
  {
    name: 'BBC Good Food',
    domain: 'bbcgoodfood.com',
    searchUrl: (q) => `https://www.bbcgoodfood.com/search?q=${encodeURIComponent(q)}`,
  },
];
