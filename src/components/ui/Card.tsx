import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...DesignTokens.shadow.xs,
  },
});


