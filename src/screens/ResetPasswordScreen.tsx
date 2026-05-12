import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

import { RootStackParamList } from '../navigation/types';
import { AuthService } from '../services/auth';
import { supabase } from '../services/supabase';
import { useTheme } from '../theme/theme';

type ResetPasswordNavigationProp = StackNavigationProp<RootStackParamList, 'ResetPassword'>;

function getUrlParam(url: string, key: string): string | null {
  const [, paramString = ''] = url.split(/[?#]/);
  const params = new URLSearchParams(paramString);
  return params.get(key);
}

export default function ResetPasswordScreen() {
  const navigation = useNavigation<ResetPasswordNavigationProp>();
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const establishRecoverySession = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const code = getUrlParam(url, 'code');
          const accessToken = getUrlParam(url, 'access_token');
          const refreshToken = getUrlParam(url, 'refresh_token');

          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      } catch (error: any) {
        Alert.alert(
          'Reset Link Error',
          error?.message || 'This reset link could not be opened. Please request a new password reset email.'
        );
      } finally {
        if (mounted) setReady(true);
      }
    };

    establishRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Please enter the same password twice.');
      return;
    }

    try {
      setSaving(true);
      await AuthService.updatePassword(password);
      Alert.alert('Password Updated', 'You can now continue using Ralli.', [
        {
          text: 'OK',
          onPress: () => {
            if (navigation.canGoBack()) navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message || 'Could not update your password. Try requesting a new reset link.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>Opening reset link...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Set a New Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Enter a new password for your Ralli account.
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
          placeholder="New password"
          placeholderTextColor={theme.colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
          placeholder="Confirm new password"
          placeholderTextColor={theme.colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.colors.primary }, saving && styles.disabled]}
          onPress={handleUpdatePassword}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginTop: 12,
    fontSize: 15,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  disabled: {
    opacity: 0.7,
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
