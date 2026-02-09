/**
 * ReplySettingsModal Component
 * Bottom sheet modal for configuring post reply and quote settings.
 * Mirrors Bluesky's official "投稿への反応の設定" UI.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import {
  PostReplySettings,
  DEFAULT_REPLY_SETTINGS,
  ThreadgateAllowRule,
} from '../services/bluesky/feed';

interface ReplySettingsModalProps {
  visible: boolean;
  settings: PostReplySettings;
  onSave: (settings: PostReplySettings) => void;
  onClose: () => void;
}

/**
 * Radio option component for "Everyone" / "No replies" selection
 */
function RadioOption({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: Record<string, string>;
}): React.JSX.Element {
  return (
    <Pressable style={styles.radioOption} onPress={onPress}>
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        {selected && (
          <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
        )}
      </View>
      <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Checkbox option component for rule selections
 */
function CheckboxOption({
  label,
  checked,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: Record<string, string>;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.checkboxRow, disabled && styles.checkboxRowDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <View
        style={[
          styles.checkboxOuter,
          { borderColor: disabled ? colors.disabled : colors.border },
          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {checked && <Text style={styles.checkboxCheck}>✓</Text>}
      </View>
      <Text
        style={[
          styles.checkboxLabel,
          { color: disabled ? colors.disabled : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ReplySettingsModal({
  visible,
  settings,
  onSave,
  onClose,
}: ReplySettingsModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  // Local state for editing (so we can cancel without saving)
  const [localSettings, setLocalSettings] = useState<PostReplySettings>(settings);

  // Sync local state when modal opens with new settings
  React.useEffect(() => {
    if (visible) {
      setLocalSettings(settings);
    }
  }, [visible, settings]);

  const handleSetAllowAll = useCallback(() => {
    setLocalSettings((prev) => ({
      ...prev,
      allowAll: true,
      allowRules: [],
    }));
  }, []);

  const handleSetNoReply = useCallback(() => {
    setLocalSettings((prev) => ({
      ...prev,
      allowAll: false,
      allowRules: [],
    }));
  }, []);

  const handleToggleRule = useCallback((rule: ThreadgateAllowRule) => {
    setLocalSettings((prev) => {
      const hasRule = prev.allowRules.includes(rule);
      const newRules = hasRule
        ? prev.allowRules.filter((r) => r !== rule)
        : [...prev.allowRules, rule];
      return {
        ...prev,
        allowAll: false,
        allowRules: newRules,
      };
    });
  }, []);

  const handleToggleQuote = useCallback((value: boolean) => {
    setLocalSettings((prev) => ({ ...prev, allowQuote: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(localSettings);
    onClose();
  }, [localSettings, onSave, onClose]);

  const isDefault =
    localSettings.allowAll &&
    localSettings.allowRules.length === 0 &&
    localSettings.allowQuote;

  const rulesDisabled = localSettings.allowAll;

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
              {t('replySettings')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} bounces={false}>
            {/* Reply-to section */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('replySettingsReplyTo')}
            </Text>

            {/* Radio: Everyone / No replies */}
            <View style={styles.radioRow}>
              <RadioOption
                label={t('replySettingsEveryone')}
                selected={localSettings.allowAll}
                onPress={handleSetAllowAll}
                colors={colors}
              />
              <RadioOption
                label={t('replySettingsNoReply')}
                selected={!localSettings.allowAll && localSettings.allowRules.length === 0}
                onPress={handleSetNoReply}
                colors={colors}
              />
            </View>

            {/* Checkboxes: Followers / Following / Mentioned */}
            <View style={[styles.checkboxGroup, { borderColor: colors.border }]}>
              <CheckboxOption
                label={t('replySettingsFollowers')}
                checked={localSettings.allowRules.includes('follower')}
                disabled={rulesDisabled}
                onPress={() => handleToggleRule('follower')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <CheckboxOption
                label={t('replySettingsFollowing')}
                checked={localSettings.allowRules.includes('following')}
                disabled={rulesDisabled}
                onPress={() => handleToggleRule('following')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <CheckboxOption
                label={t('replySettingsMentioned')}
                checked={localSettings.allowRules.includes('mention')}
                disabled={rulesDisabled}
                onPress={() => handleToggleRule('mention')}
                colors={colors}
              />
            </View>

            {/* Quote toggle */}
            <View style={[styles.quoteRow, { borderColor: colors.border }]}>
              <Text style={[styles.quoteLabel, { color: colors.text }]}>
                {'\u{201C}\u{201D}'} {t('replySettingsAllowQuote')}
              </Text>
              <Switch
                value={localSettings.allowQuote}
                onValueChange={handleToggleQuote}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Default notice */}
            {isDefault && (
              <Text style={[styles.defaultNotice, { color: colors.textSecondary }]}>
                {t('replySettingsDefault')}
              </Text>
            )}
          </ScrollView>

          {/* Save button */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>{t('replySettingsSave')}</Text>
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
  radioRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  radioOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
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
  checkboxRowDisabled: {
    opacity: 0.4,
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
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  quoteLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  defaultNotice: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
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

export default ReplySettingsModal;
