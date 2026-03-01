/**
 * UpdateNotesModal
 * Displays release notes or dictionary update info in-app.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { stripMarkdown } from '../services/updates/githubUpdateChecker';
import { EXTERNAL_LINKS } from '../constants/config';

interface AppUpdateModalProps {
  type: 'app';
  version: string;
  releaseNotes: string;
  releaseUrl: string;
  onClose: () => void;
}

interface DictionaryUpdateModalProps {
  type: 'dictionary';
  commitMessage: string;
  onClose: () => void;
}

type UpdateNotesModalProps = (AppUpdateModalProps | DictionaryUpdateModalProps) & {
  visible: boolean;
};

export function UpdateNotesModal(props: UpdateNotesModalProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const handleOpenAppStore = async () => {
    await Linking.openURL(EXTERNAL_LINKS.APP_STORE);
  };

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.overlay} onPress={props.onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }, Shadows.md]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {props.type === 'app'
                ? t('updates.appUpdateModalTitle', { version: props.version })
                : t('updates.dictionaryUpdateModalTitle')}
            </Text>
            <Pressable
              onPress={props.onClose}
              style={styles.closeButton}
              hitSlop={8}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {props.type === 'app' ? (
              <Text style={[styles.notes, { color: colors.text }]}>
                {props.releaseNotes
                  ? stripMarkdown(props.releaseNotes)
                  : t('updates.noReleaseNotes')}
              </Text>
            ) : (
              <>
                <Text style={[styles.commitLabel, { color: colors.textSecondary }]}>
                  {t('updates.dictionaryLatestCommit')}
                </Text>
                <Text style={[styles.notes, { color: colors.text }]}>
                  {props.commitMessage}
                </Text>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {props.type === 'app' && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.storeButton, { backgroundColor: colors.primary }]}
                onPress={handleOpenAppStore}
              >
                <Text style={styles.storeButtonText}>{t('updates.openAppStore')}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  body: {
    maxHeight: 320,
  },
  bodyContent: {
    padding: Spacing.lg,
  },
  commitLabel: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  notes: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storeButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  storeButtonText: {
    color: Colors.textInverse,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
