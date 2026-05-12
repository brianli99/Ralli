import React, { ErrorInfo, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/contexts/AuthContext';
import { PresenceProvider } from './src/contexts/PresenceContext';
import { ThemeProvider } from './src/theme/theme';
import { ToastProvider } from './src/components/ui';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Sentry } from './src/monitoring/sentryInit';
import AppNavigator from './src/navigation/AppNavigator';
import { runBetaSchemaDiagnostics } from './src/services/schemaDiagnostics';

export default function App() {
  useEffect(() => {
    if (__DEV__) {
      void runBetaSchemaDiagnostics();
    }
  }, []);

  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
          Sentry.captureException(error, {
            level: 'fatal',
            extra: { componentStack: errorInfo.componentStack },
          });
        } else {
          console.error('Uncaught app error (no Sentry DSN):', error, errorInfo);
        }
      }}
    >
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <PresenceProvider>
                <AppNavigator />
              </PresenceProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
