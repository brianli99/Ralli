/**
 * Ralli Design Tokens
 * 
 * Unified design system for consistent styling across the app.
 * Use these tokens instead of hardcoded values.
 */

export const DesignTokens = {
  // ============================================
  // SPACING SCALE (4pt grid system)
  // ============================================
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
  },

  // ============================================
  // TYPOGRAPHY SCALE
  // ============================================
  text: {
    xs: { fontSize: 11, lineHeight: 14 },
    sm: { fontSize: 13, lineHeight: 18 },
    base: { fontSize: 15, lineHeight: 22 },
    lg: { fontSize: 17, lineHeight: 24 },
    xl: { fontSize: 20, lineHeight: 28 },
    '2xl': { fontSize: 24, lineHeight: 32 },
    '3xl': { fontSize: 30, lineHeight: 38 },
    '4xl': { fontSize: 36, lineHeight: 44 },
    '5xl': { fontSize: 48, lineHeight: 56 },
  },

  // ============================================
  // FONT WEIGHTS
  // ============================================
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // ============================================
  // BORDER RADII (standardized)
  // ============================================
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadow: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 8,
    },
    '2xl': {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 12,
    },
  },

  // ============================================
  // ANIMATION DURATIONS
  // ============================================
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },

  // ============================================
  // Z-INDEX SCALE
  // ============================================
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modal: 400,
    popover: 500,
    tooltip: 600,
    toast: 700,
  },

  // ============================================
  // ICON SIZES
  // ============================================
  iconSize: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
  },

  // ============================================
  // AVATAR SIZES
  // ============================================
  avatarSize: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
    '2xl': 64,
    '3xl': 80,
    '4xl': 96,
  },

  // ============================================
  // BUTTON HEIGHTS
  // ============================================
  buttonHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // ============================================
  // INPUT HEIGHTS
  // ============================================
  inputHeight: {
    sm: 40,
    md: 48,
    lg: 56,
  },
};

// ============================================
// SEMANTIC COLORS (use with theme)
// ============================================
export const SemanticColors = {
  // Status colors
  success: {
    light: '#DCFCE7',
    main: '#22C55E',
    dark: '#16A34A',
  },
  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#D97706',
  },
  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#DC2626',
  },
  info: {
    light: '#DBEAFE',
    main: '#3B82F6',
    dark: '#2563EB',
  },

  // Capacity levels
  capacity: {
    low: '#22C55E',
    medium: '#F59E0B',
    high: '#EF4444',
    full: '#7C3AED',
  },

  // Activity status
  activity: {
    active: '#22C55E',
    away: '#F59E0B',
    offline: '#9CA3AF',
  },
};

// ============================================
// GRADIENT PRESETS
// ============================================
export const Gradients = {
  // Primary gradients
  ralliPrimary: ['#6759FF', '#00D2FF'] as const,
  ralliSecondary: ['#FF6B35', '#FF8A5C'] as const,
  
  // Dark gradients
  darkOverlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)'] as const,
  darkBlue: ['#1a1a2e', '#16213e', '#0f3460'] as const,
  
  // Success/Action gradients
  success: ['#22C55E', '#16A34A'] as const,
  warning: ['#F59E0B', '#D97706'] as const,
  danger: ['#EF4444', '#DC2626'] as const,
  
  // Sport-specific gradients
  basketball: ['#FF6B35', '#E85D26'] as const,
  tennis: ['#4CAF50', '#388E3C'] as const,
  pickleball: ['#9C27B0', '#7B1FA2'] as const,
  volleyball: ['#2196F3', '#1976D2'] as const,
  soccer: ['#795548', '#5D4037'] as const,
  badminton: ['#00BCD4', '#0097A7'] as const,
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a consistent card style
 */
export const createCardStyle = (elevation: keyof typeof DesignTokens.shadow = 'md') => ({
  borderRadius: DesignTokens.radius.lg,
  padding: DesignTokens.space.lg,
  ...DesignTokens.shadow[elevation],
});

/**
 * Create consistent text styles
 */
export const createTextStyle = (
  size: keyof typeof DesignTokens.text,
  weight: keyof typeof DesignTokens.weight = 'regular'
) => ({
  ...DesignTokens.text[size],
  fontWeight: DesignTokens.weight[weight],
});

/**
 * Get sport gradient colors
 */
export const getSportGradient = (sport: string): readonly [string, string] => {
  const gradientMap: Record<string, readonly [string, string]> = {
    basketball: Gradients.basketball,
    tennis: Gradients.tennis,
    pickleball: Gradients.pickleball,
    volleyball: Gradients.volleyball,
    soccer: Gradients.soccer,
    badminton: Gradients.badminton,
  };
  return gradientMap[sport] || Gradients.ralliPrimary;
};

/**
 * Get capacity color
 */
export const getCapacityColor = (level: 'low' | 'medium' | 'high' | 'full'): string => {
  return SemanticColors.capacity[level];
};

export default DesignTokens;

