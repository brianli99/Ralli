# 🏀 Ralli - Multi-Sport Community App

A mobile-first React Native app built with Expo and TypeScript for discovering, checking into, and scheduling casual games across multiple sports—basketball, tennis, pickleball, volleyball, running, and soccer.

## ✨ Features

### 🗺️ Multi-Sport Court Discovery
- **Interactive Map View**: Real-time map with facility pins powered by Google Places API
- **Sport Filtering**: Filter facilities by sport type with dynamic search
- **Facility Details**: Comprehensive information including ratings, hours, contact info
- **Multi-Sport Display**: Shows all sports offered at each facility
- **Capacity Tracking**: Crowdsourced real-time occupancy reporting

### 📍 GPS-Based Check-In System
- **Location Validation**: Uses `expo-location` for precise GPS verification
- **Real-Time Check-Ins**: Only allows check-ins when physically present at facilities
- **Activity Tracking**: Complete history of user check-ins and sessions

### 🗓️ Session Scheduling & RSVP
- **Multi-Sport Sessions**: Create and join sessions for any supported sport
- **RSVP System**: In/Out/Maybe responses with participant tracking
- **Session Management**: View upcoming sessions per user or facility
- **Sport-Specific Flows**: Tailored scheduling for different sports

### 👤 User Authentication & Profiles
- **Supabase Auth**: Secure email/password authentication
- **User Profiles**: Preferred sports, skill levels, activity history
- **Social Features**: Friends system and activity feeds (roadmap)

### 🎯 Sport-Specific Interactions
- **Basketball**: "Open run @ 6PM" style sessions
- **Tennis**: "Need a doubles partner" matchmaking
- **Running**: Pace-based group organization
- **Multi-Sport**: Flexible session types for all sports

## 🛠️ Tech Stack

- **Frontend**: React Native + Expo + TypeScript
- **Backend**: Supabase (Database, Auth, Real-time)
- **Maps**: react-native-maps with Google Places API (New)
- **Location**: expo-location for GPS services
- **Navigation**: React Navigation v6
- **State Management**: React Context + Hooks

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (Mac) or Android Studio (for emulators)
- Expo Go app on your physical device (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/[your-username]/ralli.git
   cd ralli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your actual API keys
   # See Configuration section below for detailed setup instructions
   ```

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run on device/simulator**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app for physical device

## ⚙️ Configuration

### Required API Keys

#### 1. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Run the SQL schema files in Supabase SQL Editor:
   - `supabase-schema.sql` (main tables)
   - `capacity-schema-update.sql` (capacity tracking)

#### 2. Google Places API Setup
1. Create a Google Cloud Project
2. Enable "Places API (New)" 
3. Create an API key and restrict it to Places API
4. See `GOOGLE_PLACES_SETUP.md` for detailed instructions

#### 3. Environment Variables
Create a `.env` file in the project root with your actual API keys:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Places API Configuration
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

**⚠️ Security Notes:**
- Never commit your `.env` file to Git
- The `.env` file is already in `.gitignore`
- Use different API keys for development and production
- Rotate API keys regularly for security

## 📱 App Structure

```
src/
├── components/          # Reusable UI components
│   ├── CapacityReporter.tsx
│   └── LoadingScreen.tsx
├── constants/           # App constants and configurations
│   └── sports.ts
├── contexts/           # React Context providers
│   └── AuthContext.tsx
├── navigation/         # Navigation configuration
│   ├── AppNavigator.tsx
│   └── types.ts
├── screens/           # Screen components
│   ├── AuthScreen.tsx
│   ├── CourtDetailScreen.tsx
│   ├── CreateSessionScreen.tsx
│   ├── MapScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── SessionDetailScreen.tsx
│   └── SessionsScreen.tsx
├── services/          # API and external services
│   ├── auth.ts
│   ├── capacity.ts
│   ├── location.ts
│   ├── placesApi.ts
│   └── supabase.ts
├── types/            # TypeScript type definitions
│   ├── database.types.ts
│   └── index.ts
└── utils/            # Utility functions
    └── sampleData.ts
```

## 🗄️ Database Schema

### Core Tables
- **users**: User profiles and preferences
- **courts**: Facility information (legacy, now using Google Places)
- **check_ins**: User check-in records with GPS validation
- **sessions**: Scheduled game sessions
- **session_participants**: RSVP tracking
- **facility_capacity**: Crowdsourced occupancy reporting

### Key Features
- Row Level Security (RLS) enabled
- Real-time subscriptions for live updates
- Automatic timestamp tracking
- Cascading deletes for data integrity

## 🔧 Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web (limited functionality)

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for React Native
- Prettier for code formatting
- Absolute imports configured

### Key Dependencies
```json
{
  "@expo/vector-icons": "^14.0.4",
  "@react-native-community/datetimepicker": "8.4.1",
  "@react-navigation/native": "^6.1.18",
  "@supabase/supabase-js": "^2.45.4",
  "expo": "~52.0.11",
  "expo-location": "~18.0.4",
  "react-native-maps": "1.20.1",
  "react-native-reanimated": "~3.17.4"
}
```

## 🚧 Current Status & Roadmap

### ✅ Completed (v1.0)
- Real-time facility discovery with Google Places API
- GPS-based check-in system
- User authentication and profiles
- Basic session scheduling
- Crowdsourced capacity tracking
- Multi-sport support

### 🔄 In Progress (v1.1)
- Enhanced multi-sport facility display
- Improved tennis court discovery
- Dynamic search radius controls
- Session scheduling fixes

### 📋 Roadmap (v2.0+)
- **Social Features**: Friends system, activity feeds
- **Group Formation**: Create teams and communities
- **Chat System**: In-app messaging for coordination
- **Advanced Matching**: AI-powered player recommendations
- **Gamification**: Achievements, streaks, leaderboards
- **Business Integration**: Facility partnerships, booking

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join our GitHub Discussions for questions

## 🙏 Acknowledgments

- **Google Places API** for real-time facility data
- **Supabase** for backend infrastructure
- **Expo** for development platform
- **React Native Community** for excellent libraries

---

**Built with ❤️ for the recreational sports community**

*Making it easy to find games, connect with players, and stay active in your city.*