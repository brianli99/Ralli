import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/auth';
import { DesignTokens, createTextStyle, Gradients } from '../design/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// FLOATING SPORT ANIMATION COMPONENT
// ============================================

interface FloatingSportProps {
  emoji: string;
  delay: number;
  duration: number;
  x: number;
  y: number;
  size?: number;
}

const FloatingSport = ({ emoji, delay, duration, x, y, size = 32 }: FloatingSportProps) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, {
      toValue: 0.4,
      duration: 800,
      delay,
      useNativeDriver: true,
    }).start();

    // Float animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -15,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, {
          toValue: 1,
          duration: duration * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: duration * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.floatingEmoji,
        {
          left: x,
          top: y,
          fontSize: size,
          transform: [{ translateY }, { rotate: rotateInterpolate }],
          opacity,
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
};

// ============================================
// INPUT FIELD COMPONENT
// ============================================

interface InputFieldProps {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  showPasswordToggle?: boolean;
}

const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  showPasswordToggle = false,
}: InputFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.4)'],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.12)'],
  });

  return (
    <Animated.View
      style={[
        styles.inputWrapper,
        { borderColor, backgroundColor },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={isFocused ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPassword}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {showPasswordToggle && (
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="rgba(255,255,255,0.5)"
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ============================================
// MAIN AUTH SCREEN
// ============================================

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const formSlideAnim = useRef(new Animated.Value(60)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Staggered entry animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!email.trim() || !password.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      Alert.alert('Missing Information', 'Please enter your full name');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      Alert.alert('Email required', 'Please enter your email first.');
      return;
    }

    try {
      setResetLoading(true);
      await AuthService.resetPassword(targetEmail);
      setShowResetForm(false);
      Alert.alert(
        'Check your email',
        `If an account exists for ${targetEmail}, you will receive a password reset link shortly.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not send reset email. Try again later.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setShowResetForm(true);
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (e) {
      // noop
    }
  };

  const toggleMode = () => {
    // Animate form transition
    Animated.sequence([
      Animated.timing(formSlideAnim, {
        toValue: 20,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    setIsSignUp(!isSignUp);
    // Reset form
    setEmail('');
    setPassword('');
    setFullName('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a'] as const}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      >
        {/* Floating Sports Background */}
        <FloatingSport emoji="🏀" delay={0} duration={2800} x={SCREEN_WIDTH * 0.08} y={SCREEN_HEIGHT * 0.12} size={36} />
        <FloatingSport emoji="🎾" delay={300} duration={3200} x={SCREEN_WIDTH * 0.82} y={SCREEN_HEIGHT * 0.08} size={28} />
        <FloatingSport emoji="⚽" delay={600} duration={2600} x={SCREEN_WIDTH * 0.75} y={SCREEN_HEIGHT * 0.22} size={32} />
        <FloatingSport emoji="🏐" delay={200} duration={3000} x={SCREEN_WIDTH * 0.15} y={SCREEN_HEIGHT * 0.28} size={26} />
        <FloatingSport emoji="🏓" delay={400} duration={2900} x={SCREEN_WIDTH * 0.88} y={SCREEN_HEIGHT * 0.38} size={24} />
        <FloatingSport emoji="🏃" delay={500} duration={3100} x={SCREEN_WIDTH * 0.05} y={SCREEN_HEIGHT * 0.45} size={28} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: logoScale }],
              },
            ]}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[...Gradients.ralliSecondary]}
                style={styles.logoBadge}
              >
                <Text style={styles.logoEmoji}>🏀</Text>
              </LinearGradient>
              <Text style={styles.logoText}>Ralli</Text>
            </View>

            {/* Tagline */}
            <Text style={styles.tagline}>Find your game in seconds</Text>

            {/* Value Props */}
            <View style={styles.valueProps}>
              <View style={styles.valueProp}>
                <Ionicons name="location" size={14} color="#00D2FF" />
                <Text style={styles.valuePropText}>10k+ courts</Text>
              </View>
              <View style={styles.valuePropDot} />
              <View style={styles.valueProp}>
                <Ionicons name="people" size={14} color="#00D2FF" />
                <Text style={styles.valuePropText}>Active players</Text>
              </View>
              <View style={styles.valuePropDot} />
              <View style={styles.valueProp}>
                <Ionicons name="flash" size={14} color="#00D2FF" />
                <Text style={styles.valuePropText}>Real-time</Text>
              </View>
            </View>
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlideAnim }],
              },
            ]}
          >
            <BlurView intensity={25} tint="dark" style={styles.blur}>
              <View style={styles.formInner}>
                {/* Form Title */}
                <Text style={styles.formTitle}>
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </Text>
                <Text style={styles.formSubtitle}>
                  {isSignUp
                    ? 'Join the community and start playing'
                    : 'Sign in to find your next game'}
                </Text>

                {/* Form Fields */}
                <View style={styles.formFields}>
                  {isSignUp && (
                    <InputField
                      icon="person-outline"
                      placeholder="Full Name"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  )}

                  <InputField
                    icon="mail-outline"
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                  />

                  <InputField
                    icon="lock-closed-outline"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    showPasswordToggle
                  />

                  {!isSignUp && (
                    <>
                      <TouchableOpacity
                        onPress={handleForgotPassword}
                        style={styles.forgotButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.forgotText}>Forgot password?</Text>
                      </TouchableOpacity>
                      {showResetForm && (
                        <View style={styles.resetForm}>
                          <Text style={styles.resetHint}>
                            Enter your email and we’ll send a reset link.
                          </Text>
                          <InputField
                            icon="mail-outline"
                            placeholder="Email for reset link"
                            value={resetEmail}
                            onChangeText={setResetEmail}
                            keyboardType="email-address"
                          />
                          <TouchableOpacity
                            style={[styles.resetButton, resetLoading && styles.resetButtonDisabled]}
                            onPress={sendPasswordReset}
                            disabled={resetLoading}
                          >
                            {resetLoading ? (
                              <ActivityIndicator color="white" size="small" />
                            ) : (
                              <Text style={styles.resetButtonText}>Send Reset Link</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowResetForm(false)} style={styles.resetCancel}>
                            <Text style={styles.resetCancelText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={loading ? ['#475569', '#334155'] : [...Gradients.ralliSecondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitText}>
                          {isSignUp ? 'Create Account' : 'Sign In'}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Switch Mode */}
                <TouchableOpacity style={styles.switchButton} onPress={toggleMode}>
                  <Text style={styles.switchText}>
                    {isSignUp
                      ? 'Already have an account? '
                      : "Don't have an account? "}
                    <Text style={styles.switchTextBold}>
                      {isSignUp ? 'Sign In' : 'Sign Up'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerText}>
              By continuing, you agree to our{' '}
              <Text
                style={styles.footerLink}
                onPress={() => openLink('https://ralli.app/terms')}
              >
                Terms
              </Text>
              {' '}and{' '}
              <Text
                style={styles.footerLink}
                onPress={() => openLink('https://ralli.app/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: DesignTokens.space['2xl'],
    paddingVertical: DesignTokens.space['4xl'],
  },
  floatingEmoji: {
    position: 'absolute',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: DesignTokens.space['4xl'],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    marginBottom: DesignTokens.space.lg,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: DesignTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignTokens.shadow.lg,
  },
  logoEmoji: {
    fontSize: 28,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -1,
  },
  tagline: {
    ...createTextStyle('xl', 'medium'),
    color: 'rgba(255,255,255,0.9)',
    marginBottom: DesignTokens.space.lg,
  },
  valueProps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
  },
  valuePropText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.7)',
  },
  valuePropDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Form Card
  formCard: {
    borderRadius: DesignTokens.radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DesignTokens.shadow.xl,
  },
  blur: {
    padding: DesignTokens.space['2xl'],
  },
  formInner: {
    gap: DesignTokens.space.xl,
  },
  formTitle: {
    ...createTextStyle('2xl', 'bold'),
    color: 'white',
    textAlign: 'center',
  },
  formSubtitle: {
    ...createTextStyle('base', 'regular'),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: -DesignTokens.space.md,
  },
  formFields: {
    gap: DesignTokens.space.lg,
  },

  // Input Field
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: DesignTokens.space.lg,
    borderWidth: 1,
    gap: DesignTokens.space.md,
    height: DesignTokens.inputHeight.lg,
  },
  input: {
    flex: 1,
    color: 'white',
    ...createTextStyle('base', 'regular'),
  },

  // Submit Button
  submitButton: {
    borderRadius: DesignTokens.radius.md,
    overflow: 'hidden',
    marginTop: DesignTokens.space.sm,
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: DesignTokens.buttonHeight.lg,
    gap: DesignTokens.space.sm,
  },
  submitText: {
    color: 'white',
    ...createTextStyle('lg', 'bold'),
  },

  // Switch Button
  switchButton: {
    alignItems: 'center',
    paddingVertical: DesignTokens.space.sm,
  },
  switchText: {
    ...createTextStyle('base', 'regular'),
    color: 'rgba(255,255,255,0.6)',
  },
  switchTextBold: {
    color: '#00D2FF',
    fontWeight: '600',
  },

  // Footer
  footer: {
    marginTop: DesignTokens.space['3xl'],
    alignItems: 'center',
  },
  footerText: {
    ...createTextStyle('sm', 'regular'),
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  footerLink: {
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'underline',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.75)',
  },
  resetForm: {
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.sm,
  },
  resetHint: {
    ...createTextStyle('sm', 'regular'),
    color: 'rgba(255,255,255,0.65)',
  },
  resetButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: DesignTokens.radius.lg,
    backgroundColor: '#00D2FF',
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    ...createTextStyle('base', 'bold'),
    color: 'white',
  },
  resetCancel: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetCancelText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.6)',
  },
});
