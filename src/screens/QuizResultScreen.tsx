/**
 * Quiz Result Screen
 * Displays quiz results and incorrect answers
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  RotateCcw,
  Home,
  ChevronRight,
  X,
  Check,
} from 'lucide-react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/common/Button';
import { QuizResult } from '../types/quiz';
import { formatTimeSpent, getEncouragementKey } from '../services/quiz/quizEngine';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type QuizResultRouteProp = RouteProp<RootStackParamList, 'QuizResult'>;

/**
 * Score circle component
 */
interface ScoreCircleProps {
  accuracy: number;
  correctCount: number;
  totalQuestions: number;
}

function ScoreCircle({ accuracy, correctCount, totalQuestions }: ScoreCircleProps): React.JSX.Element {
  const { colors } = useTheme();

  // Determine color based on accuracy
  const getScoreColor = () => {
    if (accuracy >= 80) return colors.success;
    if (accuracy >= 60) return colors.warning;
    return colors.error;
  };

  return (
    <View style={[styles.scoreCircle, { borderColor: getScoreColor() }]}>
      <Text style={[styles.scorePercentage, { color: getScoreColor() }]}>
        {accuracy}%
      </Text>
      <Text style={[styles.scoreCount, { color: colors.textSecondary }]}>
        {correctCount}/{totalQuestions}
      </Text>
    </View>
  );
}

/**
 * Incorrect word item component
 */
interface IncorrectWordItemProps {
  word: string;
  userAnswer: string;
  correctAnswer: string;
}

function IncorrectWordItem({
  word,
  userAnswer,
  correctAnswer,
}: IncorrectWordItemProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation('quiz');

  return (
    <View style={[styles.incorrectItem, { backgroundColor: colors.card }]}>
      <View style={styles.incorrectHeader}>
        <Text style={[styles.incorrectWord, { color: colors.text }]}>
          {word}
        </Text>
      </View>
      <View style={styles.answerRow}>
        <X size={16} color={colors.error} />
        <Text style={[styles.answerLabel, { color: colors.error }]}>
          {t('result.yourAnswer', { answer: userAnswer || '-' })}
        </Text>
      </View>
      <View style={styles.answerRow}>
        <Check size={16} color={colors.success} />
        <Text style={[styles.answerLabel, { color: colors.success }]}>
          {t('result.correctAnswer', { answer: correctAnswer })}
        </Text>
      </View>
    </View>
  );
}

export function QuizResultScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<QuizResultRouteProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('quiz');
  const { colors } = useTheme();

  const { result } = route.params;

  const timeFormatted = formatTimeSpent(result.timeSpentSeconds);
  const encouragementKey = getEncouragementKey(result.accuracy);

  // Handle retry with same settings
  const handleRetry = useCallback(() => {
    // Go back to quiz setup to start a new quiz
    navigation.navigate('QuizSetup');
  }, [navigation]);

  // Handle go home
  const handleGoHome = useCallback(() => {
    navigation.navigate('Main');
  }, [navigation]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Trophy icon */}
      <View style={styles.trophyContainer}>
        <Trophy size={48} color={colors.primary} />
      </View>

      {/* Score display */}
      <ScoreCircle
        accuracy={result.accuracy}
        correctCount={result.correctCount}
        totalQuestions={result.totalQuestions}
      />

      {/* Encouragement message */}
      <Text style={[styles.encouragement, { color: colors.text }]}>
        {t(`result.${encouragementKey}`)}
      </Text>

      {/* Stats row */}
      <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {result.correctCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('result.score', { correct: '', total: '' }).split('/')[0].trim()}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {result.incorrectCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('result.incorrectWords')}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {timeFormatted.minutes}:{timeFormatted.seconds.toString().padStart(2, '0')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('result.timeTaken', { minutes: '', seconds: '' }).split(':')[0].trim()}
          </Text>
        </View>
      </View>

      {/* Incorrect words section */}
      {result.incorrectWords.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('result.incorrectWords')} ({result.incorrectWords.length})
          </Text>
          {result.incorrectWords.map((item, index) => (
            <IncorrectWordItem
              key={`${item.word.id}-${index}`}
              word={item.word.english}
              userAnswer={item.userAnswer}
              correctAnswer={item.correctAnswer}
            />
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title={t('result.retryButton')}
          onPress={handleRetry}
          variant="outline"
          leftIcon={<RotateCcw size={20} color={colors.primary} />}
          fullWidth
          style={styles.button}
        />
        <Button
          title={t('result.homeButton')}
          onPress={handleGoHome}
          leftIcon={<Home size={20} color="#FFFFFF" />}
          fullWidth
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  trophyContainer: {
    marginBottom: 24,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scorePercentage: {
    fontSize: 48,
    fontWeight: '700',
  },
  scoreCount: {
    fontSize: 16,
    marginTop: 4,
  },
  encouragement: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  incorrectItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  incorrectHeader: {
    marginBottom: 8,
  },
  incorrectWord: {
    fontSize: 16,
    fontWeight: '600',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  answerLabel: {
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    marginBottom: 0,
  },
});

export default QuizResultScreen;
