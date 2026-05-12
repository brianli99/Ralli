import React from 'react';
import { TouchableOpacity, View, Text, ActivityIndicator, StyleSheet, GestureResponderEvent, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

type ButtonVariant = 'solid' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'solid',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const theme = useTheme();

  const sizes = {
    sm: { minHeight: DesignTokens.buttonHeight.sm, paddingHorizontal: 12, fontSize: 14, icon: 16, radius: theme.radius.sm },
    md: { minHeight: DesignTokens.buttonHeight.md, paddingHorizontal: 16, fontSize: 16, icon: 18, radius: theme.radius.md },
    lg: { minHeight: DesignTokens.buttonHeight.lg, paddingHorizontal: 20, fontSize: 17, icon: 20, radius: theme.radius.lg },
  }[size];

  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizes.radius,
    minHeight: sizes.minHeight,
    paddingHorizontal: sizes.paddingHorizontal,
    gap: 8,
  };

  const variants: Record<ButtonVariant, ViewStyle> = {
    solid: { backgroundColor: theme.colors.primary },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.primary },
    ghost: { backgroundColor: 'transparent' },
  };

  const textColor = variant === 'solid' ? 'white' : theme.colors.primary;
  const opacity = disabled || loading ? 0.6 : 1;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[baseStyle, variants[variant], { opacity }, style]}
      activeOpacity={0.9}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {iconLeft && (
            <Ionicons name={iconLeft} size={sizes.icon} color={textColor} />
          )}
          <Text style={[styles.title, { color: textColor, fontSize: sizes.fontSize }, textStyle]}>
            {title}
          </Text>
          {iconRight && (
            <Ionicons name={iconRight} size={sizes.icon} color={textColor} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    fontWeight: '700',
  },
});


