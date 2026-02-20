import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { X, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { Input } from './common/Input';
import { Button } from './common/Button';
import { API, APP_INFO } from '../constants/config';
import { getLogsAsString } from '../utils/logger';

export type FeedbackType = 'word_search' | 'bug' | 'feature';

interface FeedbackModalProps {
  visible: boolean;
  type?: FeedbackType;
  word?: string; // or title/subject
  partOfSpeech?: string;
  postUrl?: string;
  onClose: () => void;
}

export function FeedbackModal({ visible, type = 'word_search', word: initialWord = '', partOfSpeech, postUrl, onClose }: FeedbackModalProps) {
  const { t } = useTranslation('wordPopup');
  const { colors } = useTheme();
  const [subject, setSubject] = useState(initialWord);
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reset local state when initialWord changes (important for different entry points)
  React.useEffect(() => {
    setSubject(initialWord);
    setDescription('');
    setComment('');
  }, [initialWord, visible]);

  const config = useMemo(() => {
    switch (type) {
      case 'bug':
        return {
          title: t('feedback.types.bug'),
          description: t('feedback.descriptions.bugWithLogs'),
          subjectLabel: t('feedback.labels.bugTitle'),
          subjectPlaceholder: '例: ログインできない、画面が真っ白になる',
          descLabel: t('feedback.labels.reproSteps'),
          descPlaceholder: '例: 1. アプリを起動する 2. ログインボタンを押す...',
        };
      case 'feature':
        return {
          title: t('feedback.types.feature'),
          description: t('feedback.descriptions.feature'),
          subjectLabel: t('feedback.labels.featureTitle'),
          subjectPlaceholder: '例: ダークモードの実装、単語の音声再生機能',
          descLabel: t('feedback.labels.featureDetail'),
          descPlaceholder: '例: 目の疲れを軽減するためにダークモードが欲しいです',
        };
      case 'word_search':
      default:
        return {
          title: t('feedback.types.word_search'),
          description: t('feedback.descriptions.word_search'),
          subjectLabel: t('feedback.labels.word'),
          subjectPlaceholder: '',
          descLabel: t('feedback.labels.expectation'),
          descPlaceholder: '例: 会議、打ち合わせ',
        };
    }
  }, [type, t]);

  const handleSend = async () => {
    if (!subject.trim()) {
      Alert.alert(t('alerts.error'), '件名または単語を入力してください。');
      return;
    }

    if (API.FEEDBACK.GAS_URL.includes('YOUR_GAS_URL_HERE')) {
      Alert.alert(t('alerts.error'), 'Feedback API URL is not configured.');
      return;
    }

    setIsSending(true);
    try {
      const bugExtras = type === 'bug'
        ? {
            logs: await getLogsAsString(),
            app_version: APP_INFO.VERSION,
            platform: Platform.OS,
            os_version: String(Platform.Version),
          }
        : {};

      const response = await fetch(API.FEEDBACK.GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          type,
          word: subject,          // For backward compatibility on GAS or mapping to word
          title: subject,         // Preferred for bug/feature
          expectation: description, // For backward compatibility
          description: description, // Preferred for bug/feature
          comment,
          part_of_speech: partOfSpeech || '',
          post_url: postUrl || '',
          ...bugExtras,
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        Alert.alert(t('alerts.success'), t('feedback.success'));
        setSubject('');
        setDescription('');
        setComment('');
        onClose();
      } else {
        throw new Error(result.message || 'Failed to send feedback');
      }
    } catch (error) {
      console.error('Feedback send error:', error);
      Alert.alert(t('alerts.error'), t('feedback.error'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{config.description}</Text>

            <Input
              label={config.subjectLabel}
              value={subject}
              onChangeText={setSubject}
              editable={type !== 'word_search'} // Keep fixed for word lookup feedback
              placeholder={config.subjectPlaceholder}
              containerStyle={styles.input}
            />

            <Input
              label={config.descLabel}
              value={description}
              onChangeText={setDescription}
              placeholder={config.descPlaceholder}
              multiline
              numberOfLines={3}
              style={styles.textAreaSmall}
              containerStyle={styles.input}
            />

            <Input
              label={t('feedback.labels.comment')}
              value={comment}
              onChangeText={setComment}
              placeholder="例: このアプリはとても使いやすいです！"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              containerStyle={styles.input}
            />

            <Button
              title={isSending ? t('feedback.sending') : t('feedback.send')}
              onPress={handleSend}
              loading={isSending}
              disabled={isSending}
              leftIcon={<Send size={20} color="#FFFFFF" />}
              style={styles.sendButton}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    padding: Spacing.lg,
    maxHeight: 500,
  },
  descriptionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  input: {
    marginBottom: Spacing.md,
  },
  textAreaSmall: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
});
