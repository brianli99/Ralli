import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Easing } from 'react-native';
import { DesignTokens, createTextStyle } from '../../design/tokens';

// ============================================
// PULSING DOT - For live/active indicators
// ============================================

interface PulsingDotProps {
  color?: string;
  size?: number;
  pulseScale?: number;
  duration?: number;
}

export const PulsingDot = ({
  color = '#22C55E',
  size = 8,
  pulseScale = 2,
  duration = 1500,
}: PulsingDotProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: pulseScale,
              duration: duration,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: duration,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };

    animate();
  }, []);

  return (
    <View style={[styles.pulsingDotContainer, { width: size * pulseScale, height: size * pulseScale }]}>
      <Animated.View
        style={[
          styles.pulsingDotOuter,
          {
            width: size,
            height: size,
            backgroundColor: color,
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      <View
        style={[
          styles.pulsingDotInner,
          {
            width: size,
            height: size,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

// ============================================
// BOUNCING BADGE - For new notifications/content
// ============================================

interface BouncingBadgeProps {
  count: number;
  color?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  animate?: boolean;
}

export const BouncingBadge = ({
  count,
  color = '#EF4444',
  textColor = 'white',
  size = 'medium',
  animate = true,
}: BouncingBadgeProps) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(count);

  const sizes = {
    small: { minWidth: 16, height: 16, fontSize: 10, padding: 4 },
    medium: { minWidth: 20, height: 20, fontSize: 12, padding: 6 },
    large: { minWidth: 24, height: 24, fontSize: 14, padding: 8 },
  };

  useEffect(() => {
    if (animate && count !== prevCount.current && count > 0) {
      bounceAnim.setValue(0);
      Animated.sequence([
        Animated.spring(bounceAnim, {
          toValue: 1,
          tension: 300,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 0,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCount.current = count;
  }, [count, animate]);

  if (count <= 0) return null;

  const sizeConfig = sizes[size];
  const scale = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <Animated.View
      style={[
        styles.bouncingBadge,
        {
          minWidth: sizeConfig.minWidth,
          height: sizeConfig.height,
          backgroundColor: color,
          paddingHorizontal: sizeConfig.padding,
          transform: [{ scale }],
        },
      ]}
    >
      <Text
        style={[
          styles.bouncingBadgeText,
          {
            fontSize: sizeConfig.fontSize,
            color: textColor,
          },
        ]}
      >
        {count > 99 ? '99+' : count}
      </Text>
    </Animated.View>
  );
};

// ============================================
// SHIMMER EFFECT - For loading states
// ============================================

interface ShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export const Shimmer = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: ShimmerProps) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        styles.shimmerContainer,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmerGradient,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

// ============================================
// SUCCESS CHECKMARK - Animated success indicator
// ============================================

interface SuccessCheckmarkProps {
  size?: number;
  color?: string;
  onComplete?: () => void;
}

export const SuccessCheckmark = ({
  size = 60,
  color = '#22C55E',
  onComplete,
}: SuccessCheckmarkProps) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onComplete) {
        setTimeout(onComplete, 500);
      }
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.successCheckmark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={[styles.successCheckmarkIcon, { fontSize: size * 0.5 }]}>✓</Text>
    </Animated.View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  pulsingDotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingDotOuter: {
    position: 'absolute',
    borderRadius: 100,
  },
  pulsingDotInner: {
    borderRadius: 100,
  },
  bouncingBadge: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bouncingBadgeText: {
    fontWeight: '700',
  },
  shimmerContainer: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  shimmerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  successCheckmark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheckmarkIcon: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default {
  PulsingDot,
  BouncingBadge,
  Shimmer,
  SuccessCheckmark,
};

