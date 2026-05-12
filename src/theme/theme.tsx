import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type PaletteName = 'electric' | 'night' | 'fresh' | 'sunset' | 'desert' | 'coral' | 'charcoal';
export type Mode = 'light' | 'dark';

export interface Colors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}

export interface GradientDef {
  id: string;
  label: string;
  colors: string[];
}

export interface ThemeTokens {
  colors: Colors;
  radius: { sm: number; md: number; lg: number };
  space: number[];
  elevation: number[];
  motion: { fast: number; normal: number; slow: number };
  gradient: GradientDef;
}

const gradients: Record<string, GradientDef> = {
  ralliElectricBase: { id: 'ralliElectricBase', label: 'Ralli Electric', colors: ['#6759FF', '#00D2FF'] },
  electricShift: { id: 'electricShift', label: 'Electric Shift', colors: ['#3B57FF', '#00D2FF'] },
  nightNeon: { id: 'nightNeon', label: 'Night Neon', colors: ['#0F1424', '#1E2A47'] },
  frescoMint: { id: 'frescoMint', label: 'Fresco Mint', colors: ['#0EA5E9', '#10B981'] },
  sunsetRim: { id: 'sunsetRim', label: 'Sunset Rim', colors: ['#FF6B35', '#7C5CFF'] },
  graphiteShift: { id: 'graphiteShift', label: 'Graphite Shift', colors: ['#0C0F14', '#1A1F29'] },
};

const paletteColors: Record<PaletteName, { light: Colors; dark: Colors }> = {
  electric: {
    light: {
      primary: '#3B57FF',
      secondary: '#00D2FF',
      accent: '#8A7CFF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      border: '#E5E7EB',
    },
    dark: {
      primary: '#3B57FF',
      secondary: '#00D2FF',
      accent: '#8A7CFF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0C0F14',
      surface: '#1A1F29',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#8A94A6',
      border: '#2A3140',
    },
  },
  night: {
    light: {
      primary: '#7C5CFF',
      secondary: '#00C2FF',
      accent: '#FF7A59',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F1F5F9',
      surface: '#FFFFFF',
      textPrimary: '#0A0D14',
      textSecondary: '#1B2332',
      textMuted: '#3A4760',
      border: '#E2E8F0',
    },
    dark: {
      primary: '#7C5CFF',
      secondary: '#00C2FF',
      accent: '#FF7A59',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0A0D14',
      surface: '#121826',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#8A94A6',
      border: '#253146',
    },
  },
  fresh: {
    light: {
      primary: '#0EA5E9',
      secondary: '#10B981',
      accent: '#F97316',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      border: '#E2E8F0',
    },
    dark: {
      primary: '#0EA5E9',
      secondary: '#10B981',
      accent: '#F97316',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0F172A',
      surface: '#1E293B',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: '#334155',
    },
  },
  sunset: {
    light: {
      primary: '#1A73E8',
      secondary: '#7C5CFF',
      accent: '#00D2FF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F9FAFB',
      surface: '#FFFFFF',
      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#6B7280',
      border: '#E5E7EB',
    },
    dark: {
      primary: '#1A73E8',
      secondary: '#7C5CFF',
      accent: '#00D2FF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0F172A',
      surface: '#1F2937',
      textPrimary: '#FFFFFF',
      textSecondary: '#D1D5DB',
      textMuted: '#9CA3AF',
      border: '#374151',
    },
  },
  desert: {
    // Desert Dusk (bold, energetic)
    light: {
      primary: '#FF6B35',
      secondary: '#7C5CFF',
      accent: '#00D2FF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      border: '#E5E7EB',
    },
    dark: {
      primary: '#FF6B35',
      secondary: '#7C5CFF',
      accent: '#00D2FF',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0F172A',
      surface: '#1F2937',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: '#334155',
    },
  },
  coral: {
    // Coral Night (warm + cool balance)
    light: {
      primary: '#FF7A59',
      secondary: '#8B5CF6',
      accent: '#22D3EE',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F1F5F9',
      surface: '#FFFFFF',
      textPrimary: '#0B1220',
      textSecondary: '#2B3347',
      textMuted: '#8A94A6',
      border: '#E2E8F0',
    },
    dark: {
      primary: '#FF7A59',
      secondary: '#8B5CF6',
      accent: '#22D3EE',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0B1220',
      surface: '#161E2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#8A94A6',
      border: '#2B3347',
    },
  },
  charcoal: {
    // Charcoal Pop (premium, dark-first)
    light: {
      primary: '#7C5CFF',
      secondary: '#FF6B35',
      accent: '#38BDF8',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#F1F5F9',
      surface: '#FFFFFF',
      textPrimary: '#0A0D14',
      textSecondary: '#1B2332',
      textMuted: '#3A4760',
      border: '#E2E8F0',
    },
    dark: {
      primary: '#7C5CFF',
      secondary: '#FF6B35',
      accent: '#38BDF8',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      bg: '#0A0D14',
      surface: '#121826',
      textPrimary: '#FFFFFF',
      textSecondary: '#CBD5E1',
      textMuted: '#8A94A6',
      border: '#253146',
    },
  },
};

const baseTokens = {
  radius: { sm: 8, md: 12, lg: 16 },
  space: [4, 8, 12, 16, 20, 24, 32],
  elevation: [0, 1, 2, 4, 8],
  motion: { fast: 120, normal: 200, slow: 300 },
};

export interface ThemeContextValue extends ThemeTokens {
  mode: Mode;
  paletteName: PaletteName;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setPalette: (p: PaletteName) => void;
  setGradientById: (id: string) => void;
  availableGradients: GradientDef[];
  availablePalettes: PaletteName[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');
  const [paletteName, setPaletteName] = useState<PaletteName>('sunset');
  const [gradient, setGradient] = useState<GradientDef>(gradients.sunsetRim);

  const tokens: ThemeTokens = useMemo(() => ({
    colors: paletteColors[paletteName][mode],
    gradient,
    ...baseTokens,
  }), [mode, paletteName, gradient]);

  const value: ThemeContextValue = useMemo(() => ({
    ...tokens,
    mode,
    paletteName,
    setMode: (m) => setMode(m),
    toggleMode: () => setMode(prev => prev === 'light' ? 'dark' : 'light'),
    setPalette: (p) => setPaletteName(p),
    setGradientById: (id) => setGradient(gradients[id] || gradients.ralliElectricBase),
    availableGradients: Object.values(gradients),
    availablePalettes: ['electric', 'night', 'fresh', 'sunset', 'desert', 'coral', 'charcoal'],
  }), [tokens, mode, paletteName]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}


