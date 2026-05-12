import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens, createTextStyle } from '../design/tokens';

interface SessionCountdownProps {
  scheduledFor: string;
  onExpire?: () => void;
  compact?: boolean;
  showLabels?: boolean;
  color?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const calculateTimeLeft = (targetDate: Date): TimeLeft => {
  const difference = targetDate.getTime() - Date.now();
  
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  };
};

export default function SessionCountdown({
  scheduledFor,
  onExpire,
  compact = false,
  showLabels = true,
  color = '#3B82F6',
}: SessionCountdownProps) {
  const targetDate = new Date(scheduledFor);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(targetDate));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevSeconds = useRef(timeLeft.seconds);

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setTimeLeft(newTimeLeft);
      
      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduledFor, onExpire]);

  // Pulse animation when seconds change
  useEffect(() => {
    if (timeLeft.seconds !== prevSeconds.current) {
      prevSeconds.current = timeLeft.seconds;
      
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeLeft.seconds]);

  // If the session is in the past
  if (timeLeft.total <= 0) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.expiredBadge, { backgroundColor: '#22C55E' }]}>
          <Ionicons name="play-circle" size={16} color="white" />
          <Text style={styles.expiredText}>Game Time!</Text>
        </View>
      </View>
    );
  }

  // If session is more than 7 days away, show date instead
  if (timeLeft.days > 7) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.dateBadge, { backgroundColor: color + '20' }]}>
          <Ionicons name="calendar" size={14} color={color} />
          <Text style={[styles.dateText, { color }]}>
            {targetDate.toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  }

  // Render compact version
  if (compact) {
    const mainValue = timeLeft.days > 0 
      ? `${timeLeft.days}d ${timeLeft.hours}h`
      : timeLeft.hours > 0
        ? `${timeLeft.hours}h ${timeLeft.minutes}m`
        : `${timeLeft.minutes}m ${timeLeft.seconds}s`;

    return (
      <View style={[styles.container, styles.containerCompact]}>
        <View style={[styles.compactBadge, { backgroundColor: color + '15' }]}>
          <Ionicons name="time-outline" size={12} color={color} />
          <Text style={[styles.compactText, { color }]}>{mainValue}</Text>
        </View>
      </View>
    );
  }

  // Full countdown display
  const timeUnits = [];
  
  if (timeLeft.days > 0) {
    timeUnits.push({ value: timeLeft.days, label: 'days' });
  }
  if (timeLeft.days > 0 || timeLeft.hours > 0) {
    timeUnits.push({ value: timeLeft.hours, label: 'hours' });
  }
  timeUnits.push({ value: timeLeft.minutes, label: 'mins' });
  timeUnits.push({ value: timeLeft.seconds, label: 'secs' });

  // Limit to 4 units max
  const displayUnits = timeUnits.slice(0, 4);

  return (
    <View style={styles.container}>
      <View style={styles.countdownHeader}>
        <Ionicons name="time" size={14} color={color} />
        <Text style={[styles.headerText, { color }]}>Starts in</Text>
      </View>
      
      <View style={styles.unitsContainer}>
        {displayUnits.map((unit, index) => (
          <React.Fragment key={unit.label}>
            <Animated.View
              style={[
                styles.unitContainer,
                index === displayUnits.length - 1 && { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <LinearGradient
                colors={[color, `${color}CC`] as [string, string]}
                style={styles.unitGradient}
              >
                <Text style={styles.unitValue}>
                  {unit.value.toString().padStart(2, '0')}
                </Text>
              </LinearGradient>
              {showLabels && (
                <Text style={styles.unitLabel}>{unit.label}</Text>
              )}
            </Animated.View>
            {index < displayUnits.length - 1 && (
              <Text style={[styles.separator, { color }]}>:</Text>
            )}
          </React.Fragment>
        ))}
      </View>
      
      {/* Progress indicator for sessions starting soon */}
      {timeLeft.total < 60 * 60 * 1000 && ( // Less than 1 hour
        <View style={styles.urgencyBadge}>
          <Ionicons name="flash" size={12} color="#F59E0B" />
          <Text style={styles.urgencyText}>Starting soon!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerCompact: {
    flexDirection: 'row',
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: DesignTokens.space.sm,
  },
  headerText: {
    ...createTextStyle('sm', 'semibold'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  unitContainer: {
    alignItems: 'center',
  },
  unitGradient: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...DesignTokens.shadow.sm,
  },
  unitValue: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
  },
  unitLabel: {
    ...createTextStyle('xs', 'medium'),
    color: '#6B7280',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  separator: {
    ...createTextStyle('2xl', 'bold'),
    marginBottom: 16,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.lg,
  },
  expiredText: {
    ...createTextStyle('sm', 'bold'),
    color: 'white',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.lg,
  },
  dateText: {
    ...createTextStyle('sm', 'semibold'),
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: 4,
    borderRadius: DesignTokens.radius.md,
  },
  compactText: {
    ...createTextStyle('sm', 'bold'),
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: DesignTokens.space.md,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.lg,
  },
  urgencyText: {
    ...createTextStyle('xs', 'semibold'),
    color: '#92400E',
  },
});

