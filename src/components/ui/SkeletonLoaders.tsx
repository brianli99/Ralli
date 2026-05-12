import React from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

// ============================================
// BASE SKELETON COMPONENT
// ============================================

interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: object;
}

const SkeletonBox = ({ width = '100%', height = 16, radius = 8, style }: SkeletonBoxProps) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.border,
        },
        style,
      ]}
    />
  );
};

// ============================================
// SESSION CARD SKELETON
// ============================================

export const SessionCardSkeleton = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.sessionCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sessionCardInner}>
        {/* Sport icon */}
        <SkeletonBox width={56} height={56} radius={12} />
        
        {/* Session info */}
        <View style={styles.sessionInfo}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <SkeletonBox width="70%" height={18} />
            <SkeletonBox width={60} height={24} radius={12} />
          </View>
          
          {/* Location */}
          <SkeletonBox width="80%" height={14} style={{ marginTop: 8 }} />
          
          {/* Time */}
          <SkeletonBox width="60%" height={14} style={{ marginTop: 6 }} />
          
          {/* Players */}
          <SkeletonBox width="40%" height={14} style={{ marginTop: 6 }} />
          
          {/* Footer */}
          <View style={[styles.sessionFooter, { marginTop: 12 }]}>
            <SkeletonBox width={80} height={24} radius={8} />
            <View style={styles.hostInfo}>
              <SkeletonBox width={28} height={28} radius={14} />
              <SkeletonBox width={60} height={12} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// ============================================
// SQUAD CARD SKELETON
// ============================================

export const SquadCardSkeleton = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.squadCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.squadHeader}>
        <View style={styles.squadInfo}>
          <SkeletonBox width={48} height={48} radius={12} />
          <View style={styles.squadDetails}>
            <SkeletonBox width={120} height={16} />
            <SkeletonBox width={80} height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
        <SkeletonBox width={20} height={20} radius={10} />
      </View>
    </View>
  );
};

// ============================================
// FEED ITEM SKELETON
// ============================================

export const FeedItemSkeleton = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.feedCard, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.feedHeader}>
        <View style={styles.userInfo}>
          <SkeletonBox width={44} height={44} radius={22} />
          <View style={styles.userDetails}>
            <SkeletonBox width={100} height={14} />
            <SkeletonBox width={150} height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
        <SkeletonBox width={40} height={12} />
      </View>
      
      {/* Content */}
      <SkeletonBox width="100%" height={60} radius={12} style={{ marginTop: 12 }} />
      
      {/* Actions */}
      <View style={styles.feedActions}>
        <SkeletonBox width={40} height={24} radius={12} />
        <SkeletonBox width={40} height={24} radius={12} />
        <SkeletonBox width={40} height={24} radius={12} />
      </View>
    </View>
  );
};

// ============================================
// PROFILE STATS SKELETON
// ============================================

export const ProfileStatsSkeleton = () => {
  const theme = useTheme();
  
  return (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <SkeletonBox width={40} height={40} radius={20} style={{ marginBottom: 8 }} />
          <SkeletonBox width={50} height={24} style={{ marginBottom: 4 }} />
          <SkeletonBox width={70} height={12} />
        </View>
      ))}
    </View>
  );
};

// ============================================
// MAP FACILITY SKELETON
// ============================================

export const FacilityCalloutSkeleton = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.facilityCallout, { backgroundColor: theme.colors.surface }]}>
      {/* Title */}
      <SkeletonBox width="70%" height={20} style={{ marginBottom: 8 }} />
      <SkeletonBox width="50%" height={14} style={{ marginBottom: 16 }} />
      
      {/* Sports row */}
      <View style={styles.sportsRow}>
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} width={70} height={80} radius={12} />
        ))}
      </View>
      
      {/* CTA */}
      <SkeletonBox width="100%" height={48} radius={12} style={{ marginTop: 16 }} />
    </View>
  );
};

// ============================================
// LIST SKELETON (Multiple items)
// ============================================

interface ListSkeletonProps {
  count?: number;
  type: 'session' | 'squad' | 'feed' | 'friend';
}

export const ListSkeleton = ({ count = 3, type }: ListSkeletonProps) => {
  const items = Array.from({ length: count }, (_, i) => i);
  
  return (
    <View style={styles.listContainer}>
      {items.map((i) => {
        switch (type) {
          case 'session':
            return <SessionCardSkeleton key={i} />;
          case 'squad':
            return <SquadCardSkeleton key={i} />;
          case 'feed':
            return <FeedItemSkeleton key={i} />;
          default:
            return null;
        }
      })}
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  
  // Session card
  sessionCard: {
    borderRadius: DesignTokens.radius.lg,
    marginBottom: DesignTokens.space.md,
    ...DesignTokens.shadow.sm,
  },
  sessionCardInner: {
    flexDirection: 'row',
    padding: DesignTokens.space.lg,
    gap: DesignTokens.space.md,
  },
  sessionInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: DesignTokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  
  // Squad card
  squadCard: {
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.md,
    ...DesignTokens.shadow.sm,
  },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  squadDetails: {
    gap: 4,
  },
  
  // Feed card
  feedCard: {
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.lg,
    ...DesignTokens.shadow.md,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  feedActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.xl,
    marginTop: DesignTokens.space.md,
  },
  
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.space.md,
  },
  statCard: {
    width: '47%',
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    alignItems: 'center',
    ...DesignTokens.shadow.sm,
  },
  
  // Facility callout
  facilityCallout: {
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.xl,
  },
  sportsRow: {
    flexDirection: 'row',
    gap: DesignTokens.space.md,
  },
  
  // List
  listContainer: {
    padding: DesignTokens.space.lg,
  },
});

export default {
  SessionCardSkeleton,
  SquadCardSkeleton,
  FeedItemSkeleton,
  ProfileStatsSkeleton,
  FacilityCalloutSkeleton,
  ListSkeleton,
};

