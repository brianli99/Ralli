import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Chip({ label, selected = false, onPress, style, textStyle }: ChipProps) {
  const theme = useTheme();
  const backgroundColor = selected ? theme.colors.primary + '20' : theme.colors.surface;
  const borderColor = selected ? theme.colors.primary : theme.colors.border;
  const color = selected ? theme.colors.primary : theme.colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.base, { backgroundColor, borderColor }, style]}
      activeOpacity={0.9}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, { color }, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: DesignTokens.text.sm.fontSize,
    lineHeight: DesignTokens.text.sm.lineHeight,
    fontWeight: DesignTokens.weight.semibold,
  },
});


