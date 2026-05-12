import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Error types for better handling
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
}

/**
 * Parse and categorize errors
 */
export function parseError(error: any): AppError {
  // Network errors
  if (error?.message?.includes('network') || 
      error?.message?.includes('fetch') ||
      error?.code === 'NETWORK_ERROR') {
    return {
      type: ErrorType.NETWORK,
      message: 'Unable to connect. Please check your internet connection.',
      originalError: error,
      retryable: true,
    };
  }

  // Auth errors
  if (error?.code === 'PGRST301' || 
      error?.message?.includes('JWT') ||
      error?.message?.includes('auth') ||
      error?.status === 401) {
    return {
      type: ErrorType.AUTH,
      message: 'Session expired. Please sign in again.',
      originalError: error,
      retryable: false,
    };
  }

  // Not found
  if (error?.code === 'PGRST116' || error?.status === 404) {
    return {
      type: ErrorType.NOT_FOUND,
      message: 'The requested item was not found.',
      originalError: error,
      retryable: false,
    };
  }

  // Validation errors
  if (error?.code?.startsWith('23') || error?.status === 400) {
    return {
      type: ErrorType.VALIDATION,
      message: error?.message || 'Invalid data provided.',
      originalError: error,
      retryable: false,
    };
  }

  // Server errors
  if (error?.status >= 500) {
    return {
      type: ErrorType.SERVER,
      message: 'Server error. Please try again later.',
      originalError: error,
      retryable: true,
    };
  }

  // Unknown
  return {
    type: ErrorType.UNKNOWN,
    message: error?.message || 'An unexpected error occurred.',
    originalError: error,
    retryable: true,
  };
}

/**
 * Show error alert with optional retry
 */
export function showErrorAlert(
  error: AppError | any,
  onRetry?: () => void,
  title?: string
): void {
  const appError = error.type ? error as AppError : parseError(error);
  
  const buttons: any[] = [{ text: 'OK', style: 'cancel' }];
  
  if (appError.retryable && onRetry) {
    buttons.unshift({ text: 'Retry', onPress: onRetry });
  }

  Alert.alert(
    title || 'Error',
    appError.message,
    buttons
  );
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const appError = parseError(error);
      
      // Don't retry non-retryable errors
      if (!appError.retryable) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  } catch {
    return true; // Assume online if check fails
  }
}

/**
 * Execute function only if online, with offline message
 */
export async function requireOnline<T>(
  fn: () => Promise<T>,
  offlineMessage: string = 'This action requires an internet connection.'
): Promise<T | null> {
  const online = await isOnline();
  
  if (!online) {
    Alert.alert('Offline', offlineMessage);
    return null;
  }
  
  return fn();
}

/**
 * Debounce function for preventing rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= limitMs) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timeoutId = null;
      }, limitMs - timeSinceLastCall);
    }
  };
}

/**
 * Safe async wrapper that catches errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Safe async error:', error);
    return fallback;
  }
}

export default {
  parseError,
  showErrorAlert,
  withRetry,
  isOnline,
  requireOnline,
  debounce,
  throttle,
  safeAsync,
};
