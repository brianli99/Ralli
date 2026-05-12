import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { FriendshipApi, SquadApi } from '../services/squadApi';
import { DesignTokens, createTextStyle } from '../design/tokens';

type QRScannerNavigationProp = StackNavigationProp<RootStackParamList>;
type QRScannerRouteProp = RouteProp<RootStackParamList, 'QRScanner'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export default function QRScannerScreen() {
  const navigation = useNavigation<QRScannerNavigationProp>();
  const route = useRoute<QRScannerRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const scanType = route.params?.type || 'friend';

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || processing) return;
    
    setScanned(true);
    setProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Parse the QR data
      // Expected format: ralli://friend/{userId} or ralli://squad/{squadId}
      const parsed = parseQRCode(data);
      
      if (!parsed) {
        Alert.alert('Invalid QR Code', 'This QR code is not a valid Ralli code.', [
          { text: 'Scan Again', onPress: () => setScanned(false) }
        ]);
        return;
      }

      if (parsed.type === 'friend' && user) {
        // Send friend request
        if (parsed.id === user.id) {
          Alert.alert('Oops!', "You can't add yourself as a friend!", [
            { text: 'OK', onPress: () => setScanned(false) }
          ]);
          return;
        }

        const { error } = await FriendshipApi.sendFriendRequest(parsed.id);
        
        if (error) {
          Alert.alert('Error', typeof error === 'string' ? error : 'Failed to send friend request', [
            { text: 'OK', onPress: () => setScanned(false) }
          ]);
        } else {
          Alert.alert('Success!', 'Friend request sent!', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      } else if (parsed.type === 'squad') {
        // Join squad
        const { error } = await SquadApi.requestToJoin(parsed.id);
        
        if (error) {
          Alert.alert('Error', typeof error === 'string' ? error : 'Failed to join squad', [
            { text: 'OK', onPress: () => setScanned(false) }
          ]);
        } else {
          Alert.alert('Success!', 'You have joined the squad!', [
            { text: 'View Squad', onPress: () => navigation.navigate('SquadDetail', { squadId: parsed.id }) },
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      Alert.alert('Error', 'Failed to process QR code', [
        { text: 'Try Again', onPress: () => setScanned(false) }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const parseQRCode = (data: string): { type: 'friend' | 'squad'; id: string } | null => {
    try {
      // Try URL format: ralli://friend/{id}, ralli://user/{id}, or ralli://squad/{id}
      if (data.startsWith('ralli://')) {
        const parts = data.replace('ralli://', '').split('/');
        if (parts.length === 2) {
          const rawType = parts[0];
          const id = parts[1];
          // Treat 'user' as 'friend' for backwards compatibility
          const type: 'friend' | 'squad' | null =
            rawType === 'friend' || rawType === 'user' ? 'friend'
            : rawType === 'squad' ? 'squad'
            : null;
          if (type && id) {
            return { type, id };
          }
        }
      }
      
      // Try JSON format: { type: 'friend', id: '...' }
      const json = JSON.parse(data);
      if (json.type && json.id) {
        return { type: json.type, id: json.id };
      }
      
      // Try UUID format (assume friend)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(data)) {
        return { type: 'friend', id: data };
      }
      
      return null;
    } catch {
      return null;
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.textMuted} />
          <Text style={[styles.permissionTitle, { color: theme.colors.textPrimary }]}>
            Camera Access Required
          </Text>
          <Text style={[styles.permissionText, { color: theme.colors.textSecondary }]}>
            We need camera access to scan QR codes and add friends.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={styles.headerGradient}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Scan {scanType === 'friend' ? 'Friend' : 'Squad'} QR Code
          </Text>
          <View style={styles.headerSpacer} />
        </LinearGradient>

        {/* Scan Area */}
        <View style={styles.scanAreaContainer}>
          <View style={styles.scanArea}>
            {/* Corner Markers */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Footer */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.footerGradient}
        >
          <Text style={styles.instructionText}>
            {processing
              ? 'Processing...'
              : `Point your camera at a ${scanType === 'friend' ? "friend's" : "squad's"} QR code`}
          </Text>
          {scanned && !processing && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: DesignTokens.space.lg,
    paddingBottom: DesignTokens.space.xl,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...createTextStyle('lg', 'semibold'),
    color: 'white',
  },
  headerSpacer: {
    width: 44,
  },
  scanAreaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FF6B35',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 16,
  },
  footerGradient: {
    alignItems: 'center',
    paddingBottom: 60,
    paddingTop: DesignTokens.space['2xl'],
  },
  instructionText: {
    ...createTextStyle('base', 'medium'),
    color: 'white',
    textAlign: 'center',
  },
  scanAgainButton: {
    marginTop: DesignTokens.space.lg,
    paddingHorizontal: DesignTokens.space.xl,
    paddingVertical: DesignTokens.space.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: DesignTokens.radius.lg,
  },
  scanAgainText: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DesignTokens.space.xl,
  },
  permissionTitle: {
    ...createTextStyle('xl', 'bold'),
    marginTop: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.sm,
  },
  permissionText: {
    ...createTextStyle('base', 'regular'),
    textAlign: 'center',
    marginBottom: DesignTokens.space.xl,
  },
  permissionButton: {
    paddingHorizontal: DesignTokens.space['2xl'],
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
  },
  permissionButtonText: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
  cancelButton: {
    marginTop: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
  },
  cancelButtonText: {
    ...createTextStyle('base', 'medium'),
  },
});
