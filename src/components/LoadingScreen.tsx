import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle, Gradients } from '../design/tokens';

export default function LoadingScreen() {
  const theme = useTheme();
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotOpacity1 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity2 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity3 = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    // Entry animations
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Text fade in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Gentle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Dot loading animation
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity1, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity2, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dotOpacity3, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(dotOpacity1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
            Animated.timing(dotOpacity2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
            Animated.timing(dotOpacity3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ])
      ).start();
    };
    animateDots();
  }, []);
  
  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b', '#0f172a'] as const}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient
              colors={[...Gradients.ralliSecondary]}
              style={styles.logoBadge}
            >
            <Text style={styles.logoEmoji}>🏀</Text>
          </LinearGradient>
        </Animated.View>
        <Text style={styles.logoText}>Ralli</Text>
      </Animated.View>
      
      {/* Loading Text */}
      <Animated.View style={[styles.loadingContainer, { opacity: textOpacity }]}>
        <Text style={styles.loadingText}>Loading your games</Text>
        <View style={styles.dotsContainer}>
          <Animated.Text style={[styles.dot, { opacity: dotOpacity1 }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dotOpacity2 }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dotOpacity3 }]}>.</Animated.Text>
        </View>
      </Animated.View>
      
      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: textOpacity }]}>
        Find your game in seconds
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DesignTokens.space['2xl'],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    marginBottom: DesignTokens.space['4xl'],
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: DesignTokens.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignTokens.shadow.lg,
  },
  logoEmoji: {
    fontSize: 36,
  },
  logoText: {
    fontSize: 52,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignTokens.space['5xl'],
  },
  loadingText: {
    ...createTextStyle('lg', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  dot: {
    ...createTextStyle('lg', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },
  tagline: {
    ...createTextStyle('base', 'regular'),
    color: 'rgba(255,255,255,0.5)',
    position: 'absolute',
    bottom: 60,
  },
});
