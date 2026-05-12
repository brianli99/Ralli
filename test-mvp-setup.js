#!/usr/bin/env node

/**
 * Ralli MVP Setup Verification Script
 * 
 * This script helps verify that your MVP setup is working correctly
 * Run with: node test-mvp-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Ralli MVP Setup Verification\n');

// Check if required files exist
const requiredFiles = [
  'mvp-database-setup.sql',
  'mvp-test-data.sql',
  'MVP_SETUP_GUIDE.md',
  'MVP_DEPLOYMENT_GUIDE.md',
  '.env'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Please check your setup.');
  process.exit(1);
}

// Check .env file for required variables
console.log('\n🔧 Checking environment variables...');
const envPath = '.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY'
  ];
  
  let allVarsPresent = true;
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`✅ ${varName}`);
    } else {
      console.log(`❌ ${varName} - MISSING`);
      allVarsPresent = false;
    }
  });
  
  if (!allVarsPresent) {
    console.log('\n❌ Some environment variables are missing. Please check your .env file.');
    process.exit(1);
  }
} else {
  console.log('❌ .env file not found');
  process.exit(1);
}

// Check package.json for required dependencies
console.log('\n📦 Checking package.json dependencies...');
const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    '@supabase/supabase-js',
    'expo',
    'react-native-maps',
    'expo-location',
    '@expo/vector-icons'
  ];
  
  let allDepsPresent = true;
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
      allDepsPresent = false;
    }
  });
  
  if (!allDepsPresent) {
    console.log('\n❌ Some required dependencies are missing. Run: npm install');
    process.exit(1);
  }
}

// Check app structure
console.log('\n🏗️ Checking app structure...');
const requiredDirs = [
  'src',
  'src/components',
  'src/screens',
  'src/services',
  'src/contexts',
  'src/navigation',
  'src/types'
];

let allDirsExist = true;
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - MISSING`);
    allDirsExist = false;
  }
});

if (!allDirsExist) {
  console.log('\n❌ Some required directories are missing. Please check your app structure.');
  process.exit(1);
}

// Check key source files
console.log('\n📱 Checking key source files...');
const keyFiles = [
  'src/services/supabase.ts',
  'src/services/placesApi.ts',
  'src/services/capacityService.ts',
  'src/contexts/AuthContext.tsx',
  'src/screens/MapScreen.tsx',
  'src/screens/SessionsScreen.tsx',
  'src/screens/ProfileScreen.tsx'
];

let allKeyFilesExist = true;
keyFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allKeyFilesExist = false;
  }
});

if (!allKeyFilesExist) {
  console.log('\n❌ Some key source files are missing. Please check your app structure.');
  process.exit(1);
}

console.log('\n🎉 MVP Setup Verification Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Run the database setup scripts in Supabase SQL Editor');
console.log('2. Start your app with: npx expo start');
console.log('3. Test core functionality as outlined in MVP_DEPLOYMENT_GUIDE.md');
console.log('4. Deploy for MVP testing!');
console.log('\n🚀 Ready for MVP launch!');


