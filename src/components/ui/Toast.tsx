import React, { useEffect, useRef, useState, createContext, useContext, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignTokens, createTextStyle } from '../../design/tokens';

// ============================================
// TYPES
// ============================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

// ============================================
// CONTEXT
// ============================================

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================
// PROVIDER
// ============================================

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const showToast = (config: ToastConfig) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setToast(config);
    setVisible(true);
    
    // Auto hide after duration
    const duration = config.duration || 3000;
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };
  
  const hideToast = () => {
    setVisible(false);
    // Clear toast after animation
    setTimeout(() => setToast(null), 300);
  };
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <ToastComponent
          {...toast}
          visible={visible}
          onDismiss={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}

// ============================================
// TOAST COMPONENT
// ============================================

interface ToastComponentProps extends ToastConfig {
  visible: boolean;
  onDismiss: () => void;
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        bgColor: '#059669',
        iconColor: '#ffffff',
      };
    case 'error':
      return {
        icon: 'close-circle' as const,
        bgColor: '#DC2626',
        iconColor: '#ffffff',
      };
    case 'warning':
      return {
        icon: 'warning' as const,
        bgColor: '#D97706',
        iconColor: '#ffffff',
      };
    case 'info':
    default:
      return {
        icon: 'information-circle' as const,
        bgColor: '#2563EB',
        iconColor: '#ffffff',
      };
  }
};

function ToastComponent({
  message,
  type = 'info',
  visible,
  onDismiss,
  action,
}: ToastComponentProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  const config = getToastConfig(type);
  
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  
  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: insets.top + DesignTokens.space.md,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.toast, { backgroundColor: config.bgColor }]}>
        <Ionicons 
          name={config.icon} 
          size={DesignTokens.iconSize.lg} 
          color={config.iconColor} 
        />
        <Text style={styles.toastMessage} numberOfLines={2}>
          {message}
        </Text>
        {action && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: DesignTokens.space.lg,
    right: DesignTokens.space.lg,
    zIndex: DesignTokens.zIndex.toast,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.space.md,
    paddingLeft: DesignTokens.space.lg,
    paddingRight: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    gap: DesignTokens.space.md,
    maxWidth: 400,
    width: '100%',
    ...DesignTokens.shadow.xl,
  },
  toastMessage: {
    flex: 1,
    color: '#ffffff',
    ...createTextStyle('base', 'medium'),
  },
  actionButton: {
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: DesignTokens.radius.sm,
  },
  actionText: {
    color: '#ffffff',
    ...createTextStyle('sm', 'semibold'),
  },
  closeButton: {
    padding: DesignTokens.space.xs,
  },
});

export default ToastProvider;

