// Nutrition scoring utilities

// Get grade letter from score
export function getGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// Get grade color class
export function getGradeColor(grade) {
  switch (grade) {
    case 'A':
      return 'text-green-600 bg-green-100';
    case 'B':
      return 'text-blue-600 bg-blue-100';
    case 'C':
      return 'text-yellow-600 bg-yellow-100';
    case 'D':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

// Get score color for progress bars
export function getScoreColor(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// Calculate a basic nutrition score from items (fallback if API fails)
export function calculateBasicScore(items) {
  if (!items || items.length === 0) return { score: 0, grade: 'D' };

  const freshKeywords = ['banana', 'apple', 'orange', 'tomato', 'potato', 'carrot', 'broccoli', 'lettuce', 'cucumber', 'pepper', 'spinach', 'fruit', 'veg', 'salad'];
  const proteinKeywords = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'prawn', 'egg', 'turkey'];
  const processedKeywords = ['crisp', 'chip', 'chocolate', 'biscuit', 'cookie', 'sweet', 'candy', 'pizza', 'nugget', 'finger'];

  let freshCount = 0;
  let proteinCount = 0;
  let processedCount = 0;

  for (const item of items) {
    const name = (item.name || item.code || '').toLowerCase();

    for (const keyword of freshKeywords) {
      if (name.includes(keyword)) {
        freshCount++;
        break;
      }
    }

    for (const keyword of proteinKeywords) {
      if (name.includes(keyword)) {
        proteinCount++;
        break;
      }
    }

    for (const keyword of processedKeywords) {
      if (name.includes(keyword)) {
        processedCount++;
        break;
      }
    }
  }

  // Calculate score
  const total = items.length;
  const freshRatio = freshCount / total;
  const proteinRatio = proteinCount / total;
  const processedRatio = processedCount / total;

  // Base score
  let score = 50;

  // Fresh produce bonus (up to 25 points)
  score += freshRatio * 25;

  // Protein bonus (up to 15 points)
  score += proteinRatio * 15;

  // Variety bonus (up to 10 points)
  const hasVariety = freshCount > 0 && proteinCount > 0;
  if (hasVariety) score += 10;

  // Processed food penalty (up to -25 points)
  score -= processedRatio * 25;

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    grade: getGrade(score),
  };
}
