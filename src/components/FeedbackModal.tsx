import React, { useState } from 'react';
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
import { Input } from './common/Input';
import { Button } from './common/Button';
import { API } from '../constants/config';

interface FeedbackModalProps {
  visible: boolean;
  word: string;
  onClose: () => void;
}

export function FeedbackModal({ visible, word, onClose }: FeedbackModalProps) {
  const { t } = useTranslation('wordPopup');
  const [expectation, setExpectation] = useState('');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (API.FEEDBACK.GAS_URL === 'YOUR_GAS_URL_HERE') {
      Alert.alert(t('alerts.error'), 'Feedback API URL is not configured.');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(API.FEEDBACK.GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // GAS doPost requires this or just no content-type for simple POST
        },
        body: JSON.stringify({
          word,
          expectation,
          comment,
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        Alert.alert(t('alerts.success'), t('feedback.success'));
        setExpectation('');
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
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('feedback.title')}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.description}>{t('feedback.description')}</Text>

            <Input
              label={t('feedback.wordLabel')}
              value={word}
              editable={false}
              containerStyle={styles.input}
            />

            <Input
              label={t('feedback.expectationLabel')}
              value={expectation}
              onChangeText={setExpectation}
              placeholder="例: 会議、打ち合わせ"
              containerStyle={styles.input}
            />

            <Input
              label={t('feedback.commentLabel')}
              value={comment}
              onChangeText={setComment}
              placeholder="例: この単語はBlueskyでよく見かけるスラングです"
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
  description: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  input: {
    marginBottom: Spacing.md,
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
