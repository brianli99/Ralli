/**
 * Optional Sentry initialization. Set EXPO_PUBLIC_SENTRY_DSN in your env
 * (e.g. .env) for production crash reporting. No-ops when unset.
 */
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    if (__DEV__) {
      console.info('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set; skipping init.');
    }
    return;
  }

  Sentry.init({
    dsn,
    enabled: !__DEV__,
  });
}

export { Sentry };
