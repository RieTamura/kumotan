/**
 * ContentLabelModal Component
 * Bottom sheet modal for selecting content warning labels (selfLabels).
 * Follows the same pattern as ReplySettingsModal.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

interface ContentLabelModalProps {
  visible: boolean;
  labels: string[];
  onSave: (labels: string[]) => void;
  onClose: () => void;
}

/**
 * Checkbox option component for label selections
 */
function CheckboxOption({
  label,
  checked,
  onPress,
  colors,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  colors: Record<string, string>;
}): React.JSX.Element {
  return (
    <Pressable style={styles.checkboxRow} onPress={onPress}>
      <View
        style={[
          styles.checkboxOuter,
          { borderColor: colors.border },
          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {checked && <Text style={styles.checkboxCheck}>✓</Text>}
      </View>
      <Text style={[styles.checkboxLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ContentLabelModal({
  visible,
  labels,
  onSave,
  onClose,
}: ContentLabelModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const [localLabels, setLocalLabels] = useState<string[]>(labels);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalLabels(labels);
    }
  }, [visible, labels]);

  const handleToggleLabel = useCallback((label: string) => {
    setLocalLabels((prev) => {
      if (prev.includes(label)) {
        return prev.filter((l) => l !== label);
      }
      return [...prev, label];
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(localLabels);
    onClose();
  }, [localLabels, onSave, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('contentLabel')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} bounces={false}>
            {/* Adult Content section */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('contentLabelAdult')}
            </Text>
            <View style={[styles.checkboxGroup, { borderColor: colors.border }]}>
              <CheckboxOption
                label={t('contentLabelSexual')}
                checked={localLabels.includes('sexual')}
                onPress={() => handleToggleLabel('sexual')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <CheckboxOption
                label={t('contentLabelNudity')}
                checked={localLabels.includes('nudity')}
                onPress={() => handleToggleLabel('nudity')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <CheckboxOption
                label={t('contentLabelPorn')}
                checked={localLabels.includes('porn')}
                onPress={() => handleToggleLabel('porn')}
                colors={colors}
              />
            </View>

            {/* Other section */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('contentLabelOther')}
            </Text>
            <View style={[styles.checkboxGroup, { borderColor: colors.border }]}>
              <CheckboxOption
                label={t('contentLabelGraphicMedia')}
                checked={localLabels.includes('graphic-media')}
                onPress={() => handleToggleLabel('graphic-media')}
                colors={colors}
              />
            </View>
          </ScrollView>

          {/* Done button */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>{t('contentLabelDone')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  checkboxGroup: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  checkboxLabel: {
    fontSize: 15,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ContentLabelModal;
