import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import { useAuth } from '../contexts/AuthContext';

interface QRCodeGeneratorProps {
  type?: 'profile' | 'squad';
  squadId?: string;
  squadName?: string;
}

export default function QRCodeGenerator({ type = 'profile', squadId, squadName }: QRCodeGeneratorProps) {
  const { user } = useAuth();

  // Generate username from email or id
  const getUsername = () => {
    if (!user) return 'ralli-user';
    // Use email prefix as username, or first part of id
    if (user.email) {
      return user.email.split('@')[0];
    }
    return user.id.substring(0, 8);
  };

  // Generate the QR code value based on type
  const getQRValue = () => {
    if (type === 'squad' && squadId) {
      // For squads, encode a deep link or squad ID
      return `ralli://squad/${squadId}`;
    }
    // For profiles, encode user ID for friend adding (must match QR scanner parser)
    return `ralli://friend/${user?.id || ''}`;
  };

  // Generate share message based on type
  const getShareMessage = () => {
    const username = getUsername();
    
    if (type === 'squad' && squadName) {
      return `Join my squad "${squadName}" on Ralli!\n\n${getQRValue()}\n\nDownload Ralli to join the crew!`;
    }
    
    return `Add me on Ralli! My username is @${username}\n\n${getQRValue()}\n\nDownload Ralli to connect!`;
  };

  const handleShareQR = async () => {
    try {
      const shareMessage = getShareMessage();
      
      await Share.share({
        message: shareMessage,
        title: type === 'squad' ? `Join ${squadName}` : 'Add me on Ralli',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleCopyCode = async () => {
    const codeToCopy = getQRValue();
    
    await Clipboard.setStringAsync(codeToCopy);
    Alert.alert(
      'Copied!', 
      type === 'squad' 
        ? 'Squad invite link copied to clipboard'
        : 'Profile invite link copied to clipboard'
    );
  };

  if (!user) return null;

  const username = getUsername();
  const displayName = type === 'squad' ? squadName : (user.full_name || 'Ralli User');
  const qrValue = getQRValue();

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        {/* Real QR Code */}
        <View style={styles.qrWrapper}>
          <QRCode
            value={qrValue}
            size={160}
            color="#1a73e8"
            backgroundColor="white"
            logo={undefined}
            logoSize={40}
            logoBackgroundColor="white"
            logoMargin={2}
            logoBorderRadius={8}
            quietZone={10}
          />
        </View>
        
        {type === 'squad' ? (
          <>
            <Text style={styles.displayName}>{squadName}</Text>
            <Text style={styles.codeText}>Code: {squadId?.slice(0, 8).toUpperCase()}</Text>
          </>
        ) : (
          <>
            <Text style={styles.username}>@{username}</Text>
            <Text style={styles.displayName}>{displayName}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCopyCode}
        >
          <Ionicons name="copy" size={20} color="#1a73e8" />
          <Text style={styles.actionButtonText}>Copy Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShareQR}
        >
          <Ionicons name="share" size={20} color="#1a73e8" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instructions}>
        {type === 'squad' 
          ? 'Share this QR code or squad code with friends to invite them!'
          : 'Share this QR code or your username with friends to connect on Ralli!'
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  codeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a73e8',
    backgroundColor: '#f8f9fa',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a73e8',
    marginLeft: 8,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
