import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CapacityService } from '../services/capacityService';
import { useAuth } from '../contexts/AuthContext';
import { Sport } from '../types';

interface CapacityReporterProps {
  facilityId: string;
  facilityName: string;
  sport: Sport;
  visible: boolean;
  onClose: () => void;
  onReported: () => void;
}

export default function CapacityReporter({
  facilityId,
  facilityName,
  sport,
  visible,
  onClose,
  onReported,
}: CapacityReporterProps) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  const capacityLevels = [
    { 
      level: 'low' as const, 
      emoji: '🟢', 
      title: 'Low Activity', 
      description: 'Few people, plenty of space' 
    },
    { 
      level: 'medium' as const, 
      emoji: '🟡', 
      title: 'Moderate Activity', 
      description: 'Some people, still room to play' 
    },
    { 
      level: 'high' as const, 
      emoji: '🔴', 
      title: 'High Activity', 
      description: 'Busy but you can probably join' 
    },
    { 
      level: 'full' as const, 
      emoji: '🚫', 
      title: 'Very Busy', 
      description: 'Packed, might need to wait' 
    },
  ];

  const handleReport = async (level: 'low' | 'medium' | 'high' | 'full') => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to report capacity');
      return;
    }

    setReporting(true);
    try {
      const success = await CapacityService.reportCapacity(
        facilityId,
        sport,
        level,
        user.id
      );

      if (success) {
        Alert.alert(
          'Thanks!', 
          'Your capacity report helps other players find the best times to play.',
          [{ text: 'OK', onPress: () => {
            onReported();
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', 'Failed to report capacity. Please try again.');
      }
    } catch (error) {
      console.error('Error reporting capacity:', error);
      Alert.alert('Error', 'Failed to report capacity. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>How busy is it right now?</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.facilityInfo}>
          <Text style={styles.facilityName}>{facilityName}</Text>
          <Text style={styles.sportName}>{sport}</Text>
        </View>

        <Text style={styles.instruction}>
          Help other players by reporting the current activity level:
        </Text>

        <View style={styles.options}>
          {capacityLevels.map((option) => (
            <TouchableOpacity
              key={option.level}
              style={[
                styles.optionButton,
                { borderColor: CapacityService.getCapacityColor(option.level) }
              ]}
              onPress={() => handleReport(option.level)}
              disabled={reporting}
            >
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your report will help other players for the next 2 hours
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  facilityInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  facilityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sportName: {
    fontSize: 16,
    color: '#666',
    textTransform: 'capitalize',
  },
  instruction: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    lineHeight: 22,
  },
  options: {
    paddingHorizontal: 20,
    gap: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    padding: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});
