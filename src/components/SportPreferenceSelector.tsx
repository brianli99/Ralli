import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Sport } from '../types';
import { SPORTS_CONFIG, SPORT_FILTERS } from '../constants/sports';

interface SportPreferenceSelectorProps {
  initialPreferences?: string[];
  initialOrder?: string[];
  onSave: (preferences: string[], order: string[]) => Promise<void>;
  onCancel: () => void;
}

interface SportItem {
  key: string;
  sport: Sport;
  selected: boolean;
}

export default function SportPreferenceSelector({
  initialPreferences = [],
  initialOrder = [],
  onSave,
  onCancel,
}: SportPreferenceSelectorProps) {
  const [selectedSports, setSelectedSports] = useState<Set<string>>(
    new Set(initialPreferences)
  );
  const [sportOrder, setSportOrder] = useState<string[]>(
    initialOrder.length > 0 ? initialOrder : initialPreferences
  );
  const [saving, setSaving] = useState(false);

  // Create ordered list of sport items for drag list
  const createOrderedSportItems = (): SportItem[] => {
    const orderedItems: SportItem[] = [];
    
    // Add ordered preferred sports first
    sportOrder.forEach(sport => {
      if (selectedSports.has(sport) && SPORT_FILTERS.includes(sport as Sport)) {
        orderedItems.push({
          key: sport,
          sport: sport as Sport,
          selected: true,
        });
      }
    });

    // Add any selected sports that weren't in the order
    selectedSports.forEach(sport => {
      if (!sportOrder.includes(sport) && SPORT_FILTERS.includes(sport as Sport)) {
        orderedItems.push({
          key: sport,
          sport: sport as Sport,
          selected: true,
        });
      }
    });

    // Add unselected sports at the end
    SPORT_FILTERS.forEach(sport => {
      if (!selectedSports.has(sport)) {
        orderedItems.push({
          key: sport,
          sport: sport,
          selected: false,
        });
      }
    });

    return orderedItems;
  };

  const [sportItems, setSportItems] = useState<SportItem[]>(createOrderedSportItems());

  useEffect(() => {
    setSportItems(createOrderedSportItems());
  }, [selectedSports, sportOrder]);

  const toggleSport = (sport: Sport) => {
    const newSelected = new Set(selectedSports);
    if (newSelected.has(sport)) {
      newSelected.delete(sport);
      // Remove from order as well
      setSportOrder(prev => prev.filter(s => s !== sport));
    } else {
      newSelected.add(sport);
      // Add to end of order if not already there
      setSportOrder(prev => prev.includes(sport) ? prev : [...prev, sport]);
    }
    setSelectedSports(newSelected);
  };

  const moveSportUp = (sport: Sport) => {
    const currentIndex = sportOrder.indexOf(sport);
    if (currentIndex > 0) {
      const newOrder = [...sportOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setSportOrder(newOrder);
    }
  };

  const moveSportDown = (sport: Sport) => {
    const currentIndex = sportOrder.indexOf(sport);
    if (currentIndex < sportOrder.length - 1 && currentIndex !== -1) {
      const newOrder = [...sportOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setSportOrder(newOrder);
    }
  };

  const handleSave = async () => {
    if (selectedSports.size === 0) {
      Alert.alert('No Sports Selected', 'Please select at least one sport.');
      return;
    }

    setSaving(true);
    try {
      const preferences = Array.from(selectedSports);
      const order = sportOrder.filter(sport => selectedSports.has(sport));
      
      await onSave(preferences, order);
    } catch (error) {
      console.error('Error saving sport preferences:', error);
      Alert.alert('Error', 'Failed to save sport preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderSportItem = (item: SportItem) => {
    const config = SPORTS_CONFIG[item.sport];
    const currentIndex = sportOrder.indexOf(item.sport);
    const canMoveUp = item.selected && currentIndex > 0;
    const canMoveDown = item.selected && currentIndex < sportOrder.length - 1 && currentIndex !== -1;
    
    return (
      <View key={item.key} style={[
        styles.sportItem,
        item.selected && styles.sportItemSelected,
      ]}>
        <TouchableOpacity
          style={styles.sportToggle}
          onPress={() => toggleSport(item.sport)}
        >
          <View style={[
            styles.sportIcon,
            { backgroundColor: item.selected ? config.color : '#f0f0f0' }
          ]}>
            <Text style={[
              styles.sportEmoji,
              { opacity: item.selected ? 1 : 0.5 }
            ]}>
              {config.icon}
            </Text>
          </View>
          
          <View style={styles.sportInfo}>
            <Text style={[
              styles.sportName,
              { color: item.selected ? '#333' : '#999' }
            ]}>
              {config.name}
            </Text>
            {item.selected && (
              <Text style={styles.sportRank}>
                #{currentIndex + 1} preference
              </Text>
            )}
          </View>

          <Ionicons 
            name={item.selected ? 'checkmark-circle' : 'ellipse-outline'} 
            size={24} 
            color={item.selected ? config.color : '#ccc'} 
          />
        </TouchableOpacity>

        {item.selected && (
          <View style={styles.reorderButtons}>
            <TouchableOpacity
              style={[styles.reorderButton, !canMoveUp && styles.reorderButtonDisabled]}
              onPress={() => moveSportUp(item.sport)}
              disabled={!canMoveUp}
            >
              <Ionicons name="chevron-up" size={16} color={canMoveUp ? '#666' : '#ccc'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reorderButton, !canMoveDown && styles.reorderButtonDisabled]}
              onPress={() => moveSportDown(item.sport)}
              disabled={!canMoveDown}
            >
              <Ionicons name="chevron-down" size={16} color={canMoveDown ? '#666' : '#ccc'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sport Preferences</Text>
        <Text style={styles.subtitle}>
          Select your favorite sports and use the arrows to reorder by preference
        </Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {sportItems.map(renderSportItem)}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  list: {
    flex: 1,
    padding: 16,
  },
  sportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sportItemSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#f8f9ff',
  },
  sportToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  sportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sportEmoji: {
    fontSize: 20,
  },
  sportInfo: {
    flex: 1,
  },
  sportName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  sportRank: {
    fontSize: 12,
    color: '#1a73e8',
    fontWeight: '500',
  },
  reorderButtons: {
    flexDirection: 'column',
    paddingRight: 8,
  },
  reorderButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
