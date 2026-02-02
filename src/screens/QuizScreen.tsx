/**
 * Quiz Screen
 * The main quiz gameplay screen
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight } from 'lucide-react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/common/Button';
import { QuizSession, QuizAnswer, QuizSettings } from '../types/quiz';
import { generateQuiz, submitAnswer, completeQuiz } from '../services/quiz/quizEngine';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type QuizRouteProp = RouteProp<RootStackParamList, 'Quiz'>;

/**
 * Feedback overlay component
 */
interface FeedbackOverlayProps {
  isCorrect: boolean;
  correctAnswer: string;
  visible: boolean;
}

function FeedbackOverlay({ isCorrect, correctAnswer, visible }: FeedbackOverlayProps): React.JSX.Element | null {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation('quiz');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  // Use solid background colors for better visibility
  const backgroundColor = isCorrect
    ? (isDark ? 'rgba(23, 191, 99, 0.95)' : 'rgba(23, 191, 99, 0.9)')
    : (isDark ? 'rgba(224, 36, 94, 0.95)' : 'rgba(224, 36, 94, 0.9)');
  // Use white for icon and text to contrast with colored background
  const iconColor = '#FFFFFF';

  return (
    <Animated.View
      style={[
        styles.feedbackOverlay,
        { backgroundColor, opacity: fadeAnim },
      ]}
    >
      {isCorrect ? (
        <>
          <Check size={48} color={iconColor} />
          <Text style={[styles.feedbackText, { color: iconColor }]}>
            {t('quiz.correct')}
          </Text>
        </>
      ) : (
        <>
          <X size={48} color={iconColor} />
          <Text style={[styles.feedbackText, { color: iconColor }]}>
            {t('quiz.incorrect')}
          </Text>
          <Text style={[styles.correctAnswerText, { color: colors.text }]}>
            {t('quiz.correctAnswer', { answer: correctAnswer })}
          </Text>
        </>
      )}
    </Animated.View>
  );
}

export function QuizScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<QuizRouteProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('quiz');
  const { colors } = useTheme();

  const { settings } = route.params;

  // Quiz state
  const [session, setSession] = useState<QuizSession | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<QuizAnswer | null>(null);

  const inputRef = useRef<TextInput>(null);
  const isExitingRef = useRef(false);

  // Initialize quiz
  useEffect(() => {
    async function initQuiz() {
      setIsLoading(true);
      const result = await generateQuiz(settings);
      if (result.success) {
        setSession(result.data);
      } else {
        Alert.alert(
          t('common:errors.error'),
          result.error.message,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
      setIsLoading(false);
    }
    initQuiz();
  }, [settings, navigation, t]);

  // Handle answer submission
  const handleSubmit = useCallback(() => {
    if (!session || !userAnswer.trim()) return;

    Keyboard.dismiss();
    setIsSubmitting(true);

    const answer = submitAnswer(session, userAnswer.trim());

    // Update session with new answer
    const updatedSession = {
      ...session,
      answers: [...session.answers, answer],
    };
    setSession(updatedSession);
    setLastAnswer(answer);
    setShowFeedback(true);
    setIsSubmitting(false);
  }, [session, userAnswer]);

  // Handle next question or complete quiz
  const handleNext = useCallback(async () => {
    if (!session) return;

    setShowFeedback(false);
    setUserAnswer('');
    setLastAnswer(null);

    const nextIndex = session.currentIndex + 1;

    if (__DEV__) {
      console.log('[Quiz] handleNext called', {
        currentIndex: session.currentIndex,
        nextIndex,
        totalQuestions: session.questions.length,
        answersCount: session.answers.length,
      });
    }

    if (nextIndex >= session.questions.length) {
      // Quiz completed
      if (__DEV__) {
        console.log('[Quiz] Completing quiz...', {
          answers: session.answers.length,
          questions: session.questions.length,
        });
      }

      setIsLoading(true);
      try {
        const result = await completeQuiz(session);
        setIsLoading(false);

        if (__DEV__) {
          console.log('[Quiz] completeQuiz result:', result.success, result.success ? result.data : result.error);
        }

        if (result.success) {
          navigation.replace('QuizResult', { result: result.data });
        } else {
          Alert.alert(t('common:errors.error'), result.error.message);
        }
      } catch (error) {
        setIsLoading(false);
        if (__DEV__) {
          console.error('[Quiz] completeQuiz error:', error);
        }
        Alert.alert(t('common:errors.error'), String(error));
      }
    } else {
      // Move to next question
      setSession({
        ...session,
        currentIndex: nextIndex,
      });
      // Focus input after state update
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [session, navigation, t]);

  // Handle exit confirmation
  const handleExit = useCallback(() => {
    Alert.alert(
      t('quiz.exitConfirmTitle'),
      t('quiz.exitConfirmMessage'),
      [
        { text: t('quiz.continue'), style: 'cancel' },
        {
          text: t('quiz.exit'),
          style: 'destructive',
          onPress: () => {
            isExitingRef.current = true;
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation, t]);

  // Prevent back navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation if intentionally exiting
      if (isExitingRef.current) {
        return;
      }

      if (showFeedback || isLoading) {
        // Allow navigation during feedback or loading
        return;
      }

      // Prevent default behavior
      e.preventDefault();

      // Show confirmation
      handleExit();
    });

    return unsubscribe;
  }, [navigation, showFeedback, isLoading, handleExit]);

  if (isLoading || !session) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common:loading.preparing')}
        </Text>
      </View>
    );
  }

  const currentQuestion = session.questions[session.currentIndex];
  const progress = session.currentIndex + 1;
  const total = session.questions.length;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* Progress header */}
        <View style={styles.header}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {t('quiz.progress', { current: progress, total })}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${(progress / total) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Question card */}
        <View style={[styles.questionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.questionLabel, { color: colors.textSecondary }]}>
            {t('quiz.question')}
          </Text>
          <Text style={[styles.questionText, { color: colors.text }]}>
            {currentQuestion.question}
          </Text>
          <Text style={[styles.directionHint, { color: colors.textSecondary }]}>
            {currentQuestion.questionType === 'en_to_ja'
              ? t('setup.questionType.enToJa')
              : t('setup.questionType.jaToEn')}
          </Text>
        </View>

        {/* Answer input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={t('quiz.answerPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={userAnswer}
            onChangeText={setUserAnswer}
            editable={!showFeedback}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          {!showFeedback ? (
            <Button
              title={t('quiz.submitButton')}
              onPress={handleSubmit}
              disabled={!userAnswer.trim() || isSubmitting}
              loading={isSubmitting}
              fullWidth
            />
          ) : (
            <Button
              title={
                progress === total
                  ? t('result.header')
                  : t('quiz.nextButton')
              }
              onPress={handleNext}
              rightIcon={<ArrowRight size={20} color="#FFFFFF" />}
              fullWidth
            />
          )}
        </View>
      </View>

      {/* Feedback overlay */}
      <FeedbackOverlay
        isCorrect={lastAnswer?.isCorrect ?? false}
        correctAnswer={lastAnswer?.correctAnswer ?? ''}
        visible={showFeedback}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  questionCard: {
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  directionHint: {
    fontSize: 12,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  feedbackOverlay: {
    position: 'absolute',
    top: '30%',
    left: 32,
    right: 32,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  feedbackText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  correctAnswerText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default QuizScreen;
