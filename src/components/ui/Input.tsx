import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export default function Input({
  label,
  helperText,
  errorText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  ...props
}: InputProps) {
  const theme = useTheme();
  const hasError = Boolean(errorText);

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
      )}
      <View style={[
        styles.field,
        {
          borderColor: hasError ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
        }
      ]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={theme.colors.textSecondary} style={styles.iconLeft} />
        )}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.textPrimary }, inputStyle]}
          selectionColor={theme.colors.primary}
          {...props}
        />
        {rightIcon && (
          <Ionicons name={rightIcon} size={18} color={theme.colors.textSecondary} style={styles.iconRight} />
        )}
      </View>
      {!!helperText && !errorText && (
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>{helperText}</Text>
      )}
      {!!errorText && (
        <Text style={[styles.helper, { color: theme.colors.danger }]}>{errorText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    minHeight: DesignTokens.inputHeight.md,
    paddingHorizontal: DesignTokens.space.md,
  },
  input: {
    flex: 1,
    fontSize: DesignTokens.text.base.fontSize,
    lineHeight: DesignTokens.text.base.lineHeight,
    paddingVertical: 0,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  helper: {
    fontSize: 12,
    marginTop: 6,
  },
});


