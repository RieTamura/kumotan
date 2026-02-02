/**
 * Answer Validator
 * Handles flexible answer matching with tolerance for variations
 */

/**
 * Normalization options
 */
interface NormalizeOptions {
  ignoreCase: boolean;
  ignoreSpaces: boolean;
  ignoreHyphens: boolean;
  ignorePunctuation: boolean;
  normalizeJapanese: boolean;
}

const defaultOptions: NormalizeOptions = {
  ignoreCase: true,
  ignoreSpaces: true,
  ignoreHyphens: true,
  ignorePunctuation: true,
  normalizeJapanese: true,
};

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string, options: NormalizeOptions = defaultOptions): string {
  let normalized = str.trim();

  if (options.ignoreCase) {
    normalized = normalized.toLowerCase();
  }

  if (options.ignoreSpaces) {
    // Normalize multiple spaces to single, then remove all spaces
    normalized = normalized.replace(/\s+/g, '');
  }

  if (options.ignoreHyphens) {
    normalized = normalized.replace(/-/g, '');
  }

  if (options.ignorePunctuation) {
    // Remove common punctuation
    normalized = normalized.replace(/[.,!?;:'"()[\]{}]/g, '');
  }

  if (options.normalizeJapanese) {
    // Convert full-width to half-width characters for consistency
    normalized = normalized.replace(/[\uff01-\uff5e]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );

    // Normalize Japanese punctuation
    normalized = normalized.replace(/[、。・「」『』【】（）]/g, '');

    // Normalize long vowel marks
    normalized = normalized.replace(/ー/g, '');
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if answer is correct with tolerance
 */
export function isAnswerCorrect(
  userAnswer: string,
  correctAnswer: string,
  alternativeAnswers?: string[]
): boolean {
  // Empty answer is always incorrect
  if (!userAnswer.trim()) {
    return false;
  }

  const normalizedUser = normalizeString(userAnswer);
  const normalizedCorrect = normalizeString(correctAnswer);

  // Exact match after normalization
  if (normalizedUser === normalizedCorrect) {
    return true;
  }

  // Check alternative answers
  if (alternativeAnswers) {
    for (const alt of alternativeAnswers) {
      if (normalizedUser === normalizeString(alt)) {
        return true;
      }
    }
  }

  // Allow minor typos (1 character difference for longer words)
  if (normalizedCorrect.length >= 4) {
    const distance = levenshteinDistance(normalizedUser, normalizedCorrect);
    const threshold = Math.floor(normalizedCorrect.length / 5); // 20% tolerance
    if (distance <= Math.max(1, threshold)) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Japanese field that may contain multiple answers
 * e.g., "りんご、林檎" -> ["りんご", "林檎"]
 * e.g., "走る, 駆ける" -> ["走る", "駆ける"]
 */
export function parseMultipleAnswers(answerField: string): string[] {
  // Split by common delimiters
  const delimiters = /[,、;；\/／]/;
  return answerField
    .split(delimiters)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Get the primary answer (first one) from a field
 */
export function getPrimaryAnswer(answerField: string): string {
  const answers = parseMultipleAnswers(answerField);
  return answers[0] || answerField;
}

/**
 * Get all acceptable answers from a field
 */
export function getAllAcceptableAnswers(answerField: string): {
  primary: string;
  alternatives: string[];
} {
  const answers = parseMultipleAnswers(answerField);
  return {
    primary: answers[0] || answerField,
    alternatives: answers.slice(1),
  };
}
