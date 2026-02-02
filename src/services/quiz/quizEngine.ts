/**
 * Quiz Engine
 * Handles quiz generation and session management
 */

import { Word } from '../../types/word';
import {
  QuizSettings,
  QuizQuestion,
  QuizSession,
  QuizAnswer,
  QuizResult,
} from '../../types/quiz';
import { Result } from '../../types/result';
import { AppError, ErrorCode } from '../../utils/errors';
import { getRandomWordsForQuiz, saveQuizAttempt, saveQuizSession } from '../database/quiz';
import {
  isAnswerCorrect,
  getAllAcceptableAnswers,
  getPrimaryAnswer,
} from './answerValidator';

/**
 * Generate quiz questions from settings
 */
export async function generateQuiz(
  settings: QuizSettings
): Promise<Result<QuizSession, AppError>> {
  // Get random words
  const wordsResult = await getRandomWordsForQuiz(settings.questionCount);

  if (!wordsResult.success) {
    return wordsResult as Result<never, AppError>;
  }

  const words = wordsResult.data;

  if (words.length < settings.questionCount) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        `クイズに必要な単語数が足りません。${settings.questionCount}問に対して${words.length}単語しかありません。`
      ),
    };
  }

  // Generate questions
  const questions: QuizQuestion[] = words.map((word, index) => {
    // Determine question type for this question
    let questionType: 'en_to_ja' | 'ja_to_en';
    if (settings.questionType === 'mixed') {
      // Alternate between types
      questionType = index % 2 === 0 ? 'en_to_ja' : 'ja_to_en';
    } else {
      questionType = settings.questionType;
    }

    return buildQuestion(word, questionType);
  });

  const session: QuizSession = {
    settings,
    questions,
    answers: [],
    currentIndex: 0,
    startedAt: new Date().toISOString(),
  };

  return { success: true, data: session };
}

/**
 * Build a question from a word and question type
 */
function buildQuestion(word: Word, questionType: 'en_to_ja' | 'ja_to_en'): QuizQuestion {
  if (questionType === 'en_to_ja') {
    // English -> Japanese: Show English, answer Japanese
    const { primary, alternatives } = getAllAcceptableAnswers(word.japanese || '');
    return {
      word,
      questionType,
      question: word.english,
      correctAnswer: primary,
      alternativeAnswers: alternatives,
    };
  } else {
    // Japanese -> English: Show Japanese, answer English
    const questionText = getPrimaryAnswer(word.japanese || '');
    return {
      word,
      questionType,
      question: questionText,
      correctAnswer: word.english,
      alternativeAnswers: [], // English usually has one answer
    };
  }
}

/**
 * Submit an answer for the current question
 */
export function submitAnswer(
  session: QuizSession,
  userAnswer: string
): QuizAnswer {
  const question = session.questions[session.currentIndex];

  const correct = isAnswerCorrect(
    userAnswer,
    question.correctAnswer,
    question.alternativeAnswers
  );

  const answer: QuizAnswer = {
    questionIndex: session.currentIndex,
    wordId: question.word.id,
    questionType: question.questionType,
    userAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect: correct,
    answeredAt: new Date().toISOString(),
  };

  return answer;
}

/**
 * Complete a quiz session and save results
 */
export async function completeQuiz(
  session: QuizSession
): Promise<Result<QuizResult, AppError>> {
  const completedAt = new Date();
  const startedAt = new Date(session.startedAt);
  const timeSpentSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const incorrectCount = session.answers.length - correctCount;

  // Save session to database
  const sessionResult = await saveQuizSession({
    questionType: session.settings.questionType,
    totalQuestions: session.questions.length,
    correctCount,
    startedAt: session.startedAt,
    completedAt: completedAt.toISOString(),
    timeSpentSeconds,
  });

  if (!sessionResult.success) {
    return sessionResult as Result<never, AppError>;
  }

  // Save individual attempts
  for (const answer of session.answers) {
    await saveQuizAttempt({
      wordId: answer.wordId,
      questionType: answer.questionType,
      userAnswer: answer.userAnswer,
      correctAnswer: answer.correctAnswer,
      isCorrect: answer.isCorrect,
    });
  }

  // Build result
  const incorrectWords = session.answers
    .filter((a) => !a.isCorrect)
    .map((a) => {
      const question = session.questions[a.questionIndex];
      return {
        word: question.word,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
      };
    });

  const result: QuizResult = {
    sessionId: sessionResult.data.id,
    totalQuestions: session.questions.length,
    correctCount,
    incorrectCount,
    accuracy: Math.round((correctCount / session.questions.length) * 100),
    incorrectWords,
    timeSpentSeconds,
  };

  return { success: true, data: result };
}

/**
 * Format time spent as readable string
 */
export function formatTimeSpent(seconds: number): { minutes: number; seconds: number } {
  return {
    minutes: Math.floor(seconds / 60),
    seconds: seconds % 60,
  };
}

/**
 * Get encouragement message based on accuracy
 */
export function getEncouragementKey(accuracy: number): string {
  if (accuracy === 100) {
    return 'perfect';
  } else if (accuracy >= 80) {
    return 'great';
  } else if (accuracy >= 60) {
    return 'good';
  } else {
    return 'keepTrying';
  }
}
