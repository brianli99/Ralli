import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'accent';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Badge({ label, tone = 'primary', style, textStyle }: BadgeProps) {
  const theme = useTheme();
  const bg = {
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    accent: theme.colors.accent,
  }[tone];

  return (
    <View style={[styles.base, { backgroundColor: bg } as ViewStyle, style]}>
      <Text style={[styles.text, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    color: 'white',
    fontSize: DesignTokens.text.xs.fontSize,
    lineHeight: DesignTokens.text.xs.lineHeight,
    fontWeight: DesignTokens.weight.bold,
  },
});


