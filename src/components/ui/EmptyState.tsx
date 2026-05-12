import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import type { Colors } from '../../theme/theme';
import { DesignTokens, createTextStyle, SemanticColors } from '../../design/tokens';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'success' | 'friends' | 'sessions' | 'squads' | 'map' | 'notifications' | 'achievements';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  variant?: EmptyStateVariant;
  compact?: boolean;
}

/** 8-digit #RRGGBBAA for gradient halos */
const hexAlpha = (hex: string, suffix: string) =>
  hex.length === 7 ? `${hex}${suffix}` : hex;

const getVariantConfig = (variant: EmptyStateVariant, c: Colors) => {
  switch (variant) {
    case 'search':
      return {
        colors: [SemanticColors.info.main, SemanticColors.info.dark] as const,
        icon: 'search-outline' as const,
        bgColors: [hexAlpha(SemanticColors.info.main, '15'), hexAlpha(SemanticColors.info.dark, '08')] as const,
      };
    case 'error':
      return {
        colors: [SemanticColors.error.main, SemanticColors.error.dark] as const,
        icon: 'alert-circle-outline' as const,
        bgColors: [hexAlpha(SemanticColors.error.main, '15'), hexAlpha(SemanticColors.error.dark, '08')] as const,
      };
    case 'success':
      return {
        colors: [SemanticColors.success.main, SemanticColors.success.dark] as const,
        icon: 'checkmark-circle-outline' as const,
        bgColors: [hexAlpha(SemanticColors.success.main, '15'), hexAlpha(SemanticColors.success.dark, '08')] as const,
      };
    case 'friends':
      return {
        colors: [c.secondary, c.accent] as const,
        icon: 'people-outline' as const,
        bgColors: [hexAlpha(c.secondary, '26'), hexAlpha(c.accent, '14')] as const,
      };
    case 'sessions':
      return {
        colors: [SemanticColors.warning.main, SemanticColors.warning.dark] as const,
        icon: 'calendar-outline' as const,
        bgColors: [hexAlpha(SemanticColors.warning.main, '15'), hexAlpha(SemanticColors.warning.dark, '08')] as const,
      };
    case 'squads':
      return {
        colors: [SemanticColors.success.main, SemanticColors.success.dark] as const,
        icon: 'people-circle-outline' as const,
        bgColors: [hexAlpha(SemanticColors.success.main, '15'), hexAlpha(SemanticColors.success.dark, '08')] as const,
      };
    case 'map':
      return {
        colors: [c.accent, c.primary] as const,
        icon: 'map-outline' as const,
        bgColors: [hexAlpha(c.accent, '26'), hexAlpha(c.primary, '14')] as const,
      };
    case 'notifications':
      return {
        colors: [c.accent, c.secondary] as const,
        icon: 'notifications-outline' as const,
        bgColors: [hexAlpha(c.accent, '26'), hexAlpha(c.secondary, '14')] as const,
      };
    case 'achievements':
      return {
        colors: [SemanticColors.warning.main, SemanticColors.warning.dark] as const,
        icon: 'trophy-outline' as const,
        bgColors: [hexAlpha(SemanticColors.warning.main, '20'), hexAlpha(SemanticColors.warning.dark, '10')] as const,
      };
    default:
      return {
        colors: [c.primary, c.secondary] as const,
        icon: 'information-circle-outline' as const,
        bgColors: [hexAlpha(c.primary, '26'), hexAlpha(c.secondary, '14')] as const,
      };
  }
};

export default function EmptyState({
  icon,
  emoji,
  title,
  subtitle,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  variant = 'default',
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();
  const config = getVariantConfig(variant, theme.colors);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const iconToUse = icon || config.icon;
  
  return (
    <Animated.View 
      style={[
        styles.container,
        compact && styles.containerCompact,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
          ],
        },
      ]}
    >
      {/* Animated icon container */}
      <Animated.View 
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
        ]}
      >
        <LinearGradient
          colors={config.bgColors}
          style={[styles.iconBackground, compact && styles.iconBackgroundCompact]}
        >
          <LinearGradient
            colors={config.colors}
            style={[styles.iconInner, compact && styles.iconInnerCompact]}
          >
            {emoji ? (
              <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji}</Text>
            ) : (
              <Ionicons 
                name={iconToUse} 
                size={compact ? 24 : 32} 
                color="white" 
              />
            )}
          </LinearGradient>
        </LinearGradient>
      </Animated.View>
      
      {/* Text content */}
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.title, 
            compact && styles.titleCompact,
            { color: theme.colors.textPrimary }
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            style={[
              styles.subtitle, 
              compact && styles.subtitleCompact,
              { color: theme.colors.textSecondary }
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      
      {/* Action buttons */}
      {(actionText || secondaryActionText) && (
        <View style={[styles.actionsContainer, compact && styles.actionsContainerCompact]}>
          {actionText && onAction && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={onAction}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={config.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.actionGradient, compact && styles.actionGradientCompact]}
              >
                <Text style={styles.actionText}>{actionText}</Text>
                <Ionicons name="arrow-forward" size={compact ? 16 : 18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {secondaryActionText && onSecondaryAction && (
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={onSecondaryAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
                {secondaryActionText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: DesignTokens.space['5xl'],
    paddingHorizontal: DesignTokens.space['3xl'],
  },
  containerCompact: {
    paddingVertical: DesignTokens.space['2xl'],
    paddingHorizontal: DesignTokens.space.xl,
  },
  iconContainer: {
    marginBottom: DesignTokens.space['2xl'],
  },
  iconContainerCompact: {
    marginBottom: DesignTokens.space.lg,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBackgroundCompact: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emoji: {
    fontSize: 36,
  },
  emojiCompact: {
    fontSize: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: DesignTokens.space.xl,
  },
  title: {
    ...createTextStyle('xl', 'bold'),
    textAlign: 'center',
    marginBottom: DesignTokens.space.sm,
  },
  titleCompact: {
    ...createTextStyle('lg', 'semibold'),
  },
  subtitle: {
    ...createTextStyle('base', 'regular'),
    textAlign: 'center',
    maxWidth: 280,
  },
  subtitleCompact: {
    ...createTextStyle('sm', 'regular'),
    maxWidth: 240,
  },
  actionsContainer: {
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  actionsContainerCompact: {
    gap: DesignTokens.space.sm,
  },
  actionButton: {
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
    ...DesignTokens.shadow.xs,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space['2xl'],
    paddingVertical: DesignTokens.space.lg,
    gap: DesignTokens.space.sm,
  },
  actionGradientCompact: {
    paddingHorizontal: DesignTokens.space.xl,
    paddingVertical: DesignTokens.space.md,
  },
  actionText: {
    color: 'white',
    ...createTextStyle('base', 'semibold'),
  },
  secondaryButton: {
    paddingVertical: DesignTokens.space.sm,
    paddingHorizontal: DesignTokens.space.lg,
  },
  secondaryButtonText: {
    ...createTextStyle('sm', 'medium'),
  },
});
