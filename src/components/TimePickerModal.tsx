/**
 * TimePickerModal Component
 * Native time picker (spinner) wrapped in a modal for reminder time selection
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';

interface TimePickerModalProps {
  visible: boolean;
  initialHour: number;
  initialMinute: number;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

export function TimePickerModal({
  visible,
  initialHour,
  initialMinute,
  onConfirm,
  onCancel,
}: TimePickerModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(initialHour, initialMinute, 0, 0);
    return d;
  });

  // Reset selected date to initial values whenever modal opens
  React.useEffect(() => {
    if (visible) {
      const d = new Date();
      d.setHours(initialHour, initialMinute, 0, 0);
      setSelectedDate(d);
    }
  }, [visible, initialHour, initialMinute]);

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedDate.getHours(), selectedDate.getMinutes());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('notifications.reminderTime')}
          </Text>
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display="spinner"
            onChange={handleChange}
            locale="ja-JP"
            style={styles.picker}
            textColor={colors.text}
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.backgroundSecondary }]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {tc('buttons.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {tc('buttons.confirm')}
              </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '85%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  picker: {
    width: '100%',
    height: 180,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
});
