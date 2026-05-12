import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../../theme/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  style?: ViewStyle;
  radius?: number;
}

export default function Skeleton({ width = '100%', height = 16, style, radius }: SkeletonProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          backgroundColor: theme.colors.border,
          borderRadius: radius ?? theme.radius.md,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
