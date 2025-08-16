import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoadingScreen() {
  return (
    <LinearGradient colors={['#1a73e8', '#4285f4']} style={styles.container}>
      <Text style={styles.logo}>🏀 Ralli</Text>
      <ActivityIndicator size="large" color="white" style={styles.loader} />
      <Text style={styles.text}>Loading your games...</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40,
  },
  loader: {
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
});
