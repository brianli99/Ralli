import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO_WIDTH = SCREEN_WIDTH - 32;
const PHOTO_HEIGHT = 200;
const THUMBNAIL_SIZE = 60;

interface Photo {
  name: string;
  widthPx: number;
  heightPx: number;
}

interface FacilityPhotoGalleryProps {
  photos: Photo[];
  facilityName: string;
}

export default function FacilityPhotoGallery({ photos, facilityName }: FacilityPhotoGalleryProps) {
  const theme = useTheme();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  if (!photos || photos.length === 0) {
    return (
      <View style={[styles.noPhotos, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="image-outline" size={48} color={theme.colors.border} />
        <Text style={[styles.noPhotosText, { color: theme.colors.textSecondary }]}>No photos available</Text>
      </View>
    );
  }

  const getPhotoUrl = (photo: Photo, maxWidth: number = 800) => {
    // Google Places API photo URL construction
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
  };

  const handleImageLoadStart = (index: number) => {
    setLoadingImages(prev => new Set(prev).add(index));
  };

  const handleImageLoadEnd = (index: number) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const openLightbox = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const closeLightbox = () => {
    setSelectedPhotoIndex(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (selectedPhotoIndex === null) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = selectedPhotoIndex > 0 ? selectedPhotoIndex - 1 : photos.length - 1;
    } else {
      newIndex = selectedPhotoIndex < photos.length - 1 ? selectedPhotoIndex + 1 : 0;
    }
    
    setSelectedPhotoIndex(newIndex);
  };

  const renderMainPhoto = () => {
    const mainPhoto = photos[0];
    const isLoading = loadingImages.has(0);
    
    return (
      <TouchableOpacity
        style={styles.mainPhotoContainer}
        onPress={() => openLightbox(0)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: getPhotoUrl(mainPhoto, PHOTO_WIDTH * 2) }}
          style={styles.mainPhoto}
          onLoadStart={() => handleImageLoadStart(0)}
          onLoadEnd={() => handleImageLoadEnd(0)}
        />
        {isLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.photoOverlay}>
          <View style={styles.photoCount}>
            <Ionicons name="images" size={16} color="white" />
            <Text style={styles.photoCountText}>{photos.length}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderThumbnails = () => {
    if (photos.length <= 1) return null;

    return (
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailScrollView}
        contentContainerStyle={styles.thumbnailContainer}
      >
        {photos.slice(1, 6).map((photo, index) => {
          const actualIndex = index + 1;
          const isLoading = loadingImages.has(actualIndex);
          
          return (
            <TouchableOpacity
              key={actualIndex}
              style={styles.thumbnail}
              onPress={() => openLightbox(actualIndex)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: getPhotoUrl(photo, THUMBNAIL_SIZE * 2) }}
                style={styles.thumbnailImage}
                onLoadStart={() => handleImageLoadStart(actualIndex)}
                onLoadEnd={() => handleImageLoadEnd(actualIndex)}
              />
              {isLoading && (
                <View style={styles.thumbnailLoader}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              )}
              {index === 4 && photos.length > 6 && (
                <View style={styles.morePhotosOverlay}>
                  <Text style={styles.morePhotosText}>+{photos.length - 6}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderLightbox = () => {
    if (selectedPhotoIndex === null) return null;

    const selectedPhoto = photos[selectedPhotoIndex];
    
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLightbox}
      >
        <BlurView intensity={100} style={styles.lightboxContainer}>
          <SafeAreaView style={styles.lightboxContent}>
            {/* Header */}
            <View style={styles.lightboxHeader}>
              <View style={styles.lightboxInfo}>
                <Text style={styles.lightboxTitle}>{facilityName}</Text>
                <Text style={styles.lightboxCounter}>
                  {selectedPhotoIndex + 1} of {photos.length}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeLightbox}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Main Image */}
            <View style={styles.lightboxImageContainer}>
              <Image
                source={{ uri: getPhotoUrl(selectedPhoto, SCREEN_WIDTH * 2) }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            </View>

            {/* Navigation */}
            {photos.length > 1 && (
              <View style={styles.lightboxNavigation}>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigatePhoto('prev')}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigatePhoto('next')}
                >
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </BlurView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderMainPhoto()}
      {renderThumbnails()}
      {renderLightbox()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  noPhotos: {
    height: PHOTO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  noPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  mainPhotoContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mainPhoto: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  thumbnailScrollView: {
    marginTop: 12,
  },
  thumbnailContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbnail: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  thumbnailLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  morePhotosOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePhotosText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  lightboxContainer: {
    flex: 1,
  },
  lightboxContent: {
    flex: 1,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  lightboxInfo: {
    flex: 1,
  },
  lightboxTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  lightboxCounter: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lightboxImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT - 200,
  },
  lightboxNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
