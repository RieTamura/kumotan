/**
 * Quiz Setup Screen
 * Allows users to configure quiz settings before starting
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HelpCircle, Lightbulb } from 'lucide-react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/common/Button';
import { QuestionType, QuestionCount, QuizSettings } from '../types/quiz';
import { getQuizableWordCount } from '../services/database/quiz';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Option button component for selection
 */
interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

function OptionButton({ label, selected, onPress, disabled }: OptionButtonProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.optionButton,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.optionButtonText,
          { color: selected ? '#FFFFFF' : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function QuizSetupScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('quiz');
  const { t: tNav } = useTranslation('navigation');
  const { t: th } = useTranslation('home');
  const { colors, isDark } = useTheme();

  // Quiz settings state
  const [questionType, setQuestionType] = useState<QuestionType>('en_to_ja');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(10);
  const [availableWordCount, setAvailableWordCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load available word count
  useEffect(() => {
    async function loadWordCount() {
      setIsLoading(true);
      const result = await getQuizableWordCount();
      if (result.success) {
        setAvailableWordCount(result.data);
      }
      setIsLoading(false);
    }
    loadWordCount();
  }, []);

  // Check if quiz can start
  const canStartQuiz = availableWordCount >= questionCount;

  // Handle start quiz
  const handleStartQuiz = useCallback(() => {
    if (!canStartQuiz) {
      Alert.alert(
        t('setup.notEnoughWords'),
        t('setup.notEnoughWordsHint', { count: questionCount })
      );
      return;
    }

    const settings: QuizSettings = {
      questionType,
      questionCount,
    };

    navigation.navigate('Quiz', { settings });
  }, [canStartQuiz, questionType, questionCount, navigation, t]);

  const questionCountOptions: QuestionCount[] = [5, 10, 20];

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
        paddingTop: insets.top,
      }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {tNav('headers.quizSetup')}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Tips')}
          style={({ pressed }) => [
            styles.headerIconButton,
            pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
          ]}
          accessible={true}
          accessibilityLabel={th('tips')}
          accessibilityHint={th('tipsHint')}
          accessibilityRole="button"
        >
          <Lightbulb size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
      {/* Available words info */}
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <HelpCircle size={20} color={colors.textSecondary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {t('setup.availableWords', { count: availableWordCount })}
        </Text>
      </View>

      {/* Question Type Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('setup.questionType.title')}
        </Text>
        <View style={styles.optionsRow}>
          <OptionButton
            label={t('setup.questionType.enToJa')}
            selected={questionType === 'en_to_ja'}
            onPress={() => setQuestionType('en_to_ja')}
          />
          <OptionButton
            label={t('setup.questionType.jaToEn')}
            selected={questionType === 'ja_to_en'}
            onPress={() => setQuestionType('ja_to_en')}
          />
          <OptionButton
            label={t('setup.questionType.mixed')}
            selected={questionType === 'mixed'}
            onPress={() => setQuestionType('mixed')}
          />
        </View>
      </View>

      {/* Question Count Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('setup.questionCount.title')}
        </Text>
        <View style={styles.optionsRow}>
          {questionCountOptions.map((count) => (
            <OptionButton
              key={count}
              label={t('setup.questionCount.questions', { count })}
              selected={questionCount === count}
              onPress={() => setQuestionCount(count)}
              disabled={availableWordCount < count}
            />
          ))}
        </View>
      </View>

      {/* Start Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={t('setup.startButton')}
          onPress={handleStartQuiz}
          disabled={!canStartQuiz || isLoading}
          loading={isLoading}
          rightIcon={<ArrowRight size={20} color="#FFFFFF" />}
          fullWidth
        />
      </View>

      {/* Warning if not enough words */}
      {!canStartQuiz && !isLoading && (
        <View style={[styles.warningCard, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.warningText, { color: colors.warning }]}>
            {t('setup.notEnoughWordsHint', { count: questionCount })}
          </Text>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 9999,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 16,
  },
  warningCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default QuizSetupScreen;
