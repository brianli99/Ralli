# Ralli - Multi-Sport Community App

Ralli is a mobile-first React Native app for finding places to play, checking in at real facilities, creating pickup sessions, and coordinating with squads and friends. It is built with Expo, TypeScript, Supabase, and Google Places.

The current app is focused on the beta loop: discover a nearby court or field, see what is happening there, check in, create or join a session, and keep playing with the same people through squads, chat, friends, and activity feeds.

## Current Version

**Version:** `1.1`

This version expands Ralli from a map and session prototype into a more complete community product:

- Real Google Places facility discovery and enhanced court detail screens.
- GPS-validated check-ins with presence/capacity support.
- Session creation, RSVP, nearby sorting, past sessions, cancel flow, and session confidence signals.
- Squad creation, squad detail management, squad discovery, member roles, chat, and invites.
- Friends, QR-based connections, direct/squad messaging, and activity feed features.
- Profile improvements including sport preferences, skill levels, profile pictures, gamification, streaks, XP, and ranking.
- Notification plumbing, Sentry initialization, error boundaries, and beta/deployment documentation.

## Features

### Multi-Sport Facility Discovery

- **Interactive map:** Facility discovery powered by Google Places API.
- **Sport filters:** Browse supported sports such as basketball, tennis, pickleball, volleyball, soccer, and badminton.
- **Enhanced place details:** Facility photos, ratings, addresses, hours, sport detection, and action buttons.
- **Venue consolidation:** Nearby duplicate places can be grouped into cleaner facility cards.
- **Capacity signals:** Crowdsourced capacity reporting and presence-aware facility state.

### GPS Check-Ins & Presence

- **Location validation:** Check-ins are guarded by `expo-location` distance checks.
- **Fresh GPS checks:** The app requests device location before allowing venue-sensitive actions.
- **Presence context:** Active check-in state can be shared through the app.
- **Check-in history:** Profile and activity surfaces use real check-in data where available.

### Sessions

- **Create sessions from venues:** Sessions are tied to `google_place_id`, venue name, latitude, and longitude.
- **Nearby tab:** Sessions with coordinates can be sorted and filtered by distance.
- **RSVP support:** Users can mark `in`, `maybe`, or leave a session.
- **Past sessions:** Past/cancelled/completed sessions are separated from upcoming discovery.
- **Cancel session:** Session creators can cancel sessions.
- **Confidence signals:** Sessions can display social proof and likelihood signals from app data.

### Squads & Community

- **Squads:** Create and manage squads by sport.
- **Member management:** Owners/admins can add members, remove members, and manage roles with guardrails.
- **Find Squads:** Public squad discovery excludes squads the current user already belongs to.
- **Squad chat:** Real-time squad messaging through Supabase.
- **Invites and QR:** QR/deep-link based sharing for profiles and squads.
- **Community screens:** Court chat, court crews, crew creation, and crew detail screens are included for local venue communities.

### Friends, Feed & Messaging

- **Friends:** Search users, send requests, accept/decline requests, and view friends.
- **QR scanner:** Scan Ralli profile or squad QR codes.
- **Activity feed:** Feed activities include joined user profile data instead of placeholder names.
- **Comments and likes:** Feed activities support likes and comments.
- **Direct messaging:** Direct chat paths are available alongside squad chat.

### Profiles & Onboarding

- **Supabase Auth:** Email/password auth with profile upsert/retry handling.
- **Sport onboarding:** Users can select preferred sports and ordering.
- **Profile editing:** Display name, sport preferences, skill levels, password updates, and profile photo uploads.
- **Gamification:** XP, level, streak, goals, squads, favorite courts, and ranking surfaces.
- **Public profiles:** User profile screens can show another user's sports and activity summary.

### Notifications & Reliability

- **Push notification service:** Expo notification token registration and app notification plumbing.
- **Notification screens:** Notifications and notification settings screens are present.
- **Sentry setup:** Sentry initialization hooks are included for runtime monitoring.
- **Error boundaries:** App-level error UI improves recovery from unexpected crashes.

## Tech Stack

- **Frontend:** React Native `0.81`, Expo SDK `54`, TypeScript
- **Backend:** Supabase Database, Auth, Storage, Realtime, and RLS
- **Maps and places:** Google Places API (New), `react-native-maps`, `expo-maps`
- **Location:** `expo-location`
- **Camera and QR:** `expo-camera`, `react-native-qrcode-svg`
- **Media and storage:** `expo-image-picker`, `expo-file-system`, Supabase Storage
- **Notifications:** `expo-notifications`
- **Navigation:** React Navigation v7
- **Monitoring:** `@sentry/react-native`
- **State:** React Context and hooks

## Quick Start

### Prerequisites

- Node.js 18 or newer recommended
- npm
- Expo CLI via `npx expo ...`
- iOS Simulator, Android Emulator, or Expo Go on a physical device
- Supabase project
- Google Cloud project with Places API (New) enabled

### Installation

1. Clone the repository:
  ```bash
   git clone https://github.com/[your-username]/ralli.git
   cd ralli
  ```
2. Install dependencies:
  ```bash
   npm install
  ```
3. Create `.env`:
  ```bash
   cp .env.example .env
  ```
4. Add required environment variables:
  ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
  ```
5. Start Expo:
  ```bash
   npx expo start
  ```
6. Run the app:
  - Press `i` for iOS Simulator.
  - Press `a` for Android Emulator.
  - Scan the QR code with Expo Go for a physical device.

## Supabase Setup

Ralli depends on several SQL files in this repo. Apply them intentionally in your Supabase SQL editor and keep `src/types/database.types.ts` aligned with the live schema.

### Core Schema Areas

- `users`: Profiles, preferences, onboarding, avatars, and sport settings.
- `check_ins`: GPS-backed venue check-in records.
- `facility_capacity`: Crowdsourced venue capacity state.
- `sessions`: Scheduled games tied to Google Places and venue coordinates.
- `session_participants`: RSVP and attendance state.
- `squads` and `squad_members`: Squad ownership, roles, and membership.
- `squad_messages`, `direct_threads`, `direct_messages`: Chat and messaging.
- `friendships`: Friend request and accepted friend relationships.
- `feed_activities`, `activity_likes`, `activity_comments`: Social feed.
- `push_tokens`, `app_notifications`, notification preferences: Notification support.
- Community tables for court chat, crews, and crew membership.

### Important Migration Notes

- If session creation fails with a missing `latitude` or `longitude` column, run `sql/sessions-add-location-columns.sql`.
- If squad chat fails with a missing `squad_messages` table, apply the squad schema SQL before testing chat.
- If notifications fail, confirm notification SQL has been applied and push token policies exist.
- Storage must include a public or policy-accessible `avatars` bucket for profile pictures.
- RLS policies need to be applied with the schema, not added later as an afterthought.

## Project Structure

```text
src/
├── components/             # Shared UI, QR, galleries, loading/error states
│   └── ui/                 # Design-system primitives
├── constants/              # Sports, check-in distances, sport templates
├── contexts/               # Auth and presence providers
├── design/                 # Tokens and design helpers
├── hooks/                  # Reusable hooks
├── monitoring/             # Sentry initialization
├── navigation/             # Stack/tab navigation and route types
├── screens/                # Auth, map, sessions, profile, notifications, QR
│   ├── community/          # Court chat and crew screens
│   ├── friends/            # Friends screen
│   └── squad/              # Squad tab, detail, create, and chat screens
├── services/               # Supabase APIs, Places, notifications, smart signals
├── theme/                  # App theme provider
├── types/                  # App and generated database types
└── utils/                  # Sample data, error handling, venue consolidation
```

## Development

### Scripts

- `npm start` - Start Expo development server.
- `npm run android` - Start Expo for Android.
- `npm run ios` - Start Expo for iOS.
- `npm run web` - Start Expo web. Some native features are limited on web.

### Useful Checks

```bash
npx tsc --noEmit
npx expo start --clear
```

### Environment & Security Notes

- Do not commit `.env`.
- Restrict Google API keys by API and platform where possible.
- Use separate Supabase projects for development and production.
- Regenerate or update database types after schema changes.
- Keep SQL migration files ordered and documented before beta testing.

## Recent Changes

### App Platform

- Upgraded the project to Expo SDK 54 and React Native 0.81.
- Added native modules for camera, notifications, image picking, file system access, QR codes, and Sentry.
- Added `eas.json` and deployment/beta setup documentation.

### Map & Venue Experience

- Replaced legacy court detail usage with enhanced venue details.
- Added facility photo gallery support.
- Improved sport detection and venue consolidation utilities.
- Added check-in UI polish and theme-aligned gradients.

### Sessions

- Added venue coordinate fields to session creation.
- Added a migration for session `location_name`, `latitude`, `longitude`, and related session columns.
- Added nearby distance support, past session separation, and cancel-session flow.
- Added session confidence service integration.

### Squads, Friends & Feed

- Added full squad screens and APIs for squad creation, discovery, roles, member management, invites, and chat.
- Added friends screen, friend requests, direct messaging paths, and QR scanner support.
- Replaced feed placeholder names with real joined user data.
- Fixed QR copy/share behavior to use scanner-compatible Ralli deep links.

### Profile & Account

- Added sport onboarding and editable sport preferences.
- Added profile picture upload through Expo ImagePicker/FileSystem and Supabase Storage.
- Added gamified profile stats, XP, levels, streaks, goals, squads, ranking, and favorite courts.
- Added notification settings and notifications screens.

### Reliability

- Added error boundary component and centralized error handling utilities.
- Added Sentry initialization.
- Added database and RLS fix scripts for beta setup.

## Current Status

### Beta-Ready Core

- Facility discovery
- GPS check-ins
- Session creation and RSVP
- Squad creation and chat
- Friends and QR connection flows
- Profile editing and profile pictures
- Activity feed basics

### Needs Careful Verification

- Supabase schema and RLS applied in the correct order.
- Notification tables, push token policies, and device token registration.
- Avatar storage bucket and policies.
- Community crew/chat SQL and RPC functions.
- Location permission edge cases on real devices.
- Google Places quota, API key restrictions, and map behavior without location permission.

## Roadmap

- Harden database migrations into a single ordered setup path.
- Expand push notification scheduling and reminders.
- Improve venue deduplication and sport classification accuracy.
- Add stronger moderation/reporting for community chat and public squads.
- Add smarter matching recommendations for players, sports, and facilities.
- Add production analytics and beta feedback loops.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m 'Add amazing feature'`.
4. Push to the branch: `git push origin feature/amazing-feature`.
5. Open a pull request.

## Support

- Check the `docs/` folder for planning and strategy notes.
- Review SQL files in the project root and `sql/` before testing database-backed features.
- Use GitHub Issues for bugs and GitHub Discussions for product/development questions.

## Acknowledgments

- Google Places API for facility discovery.
- Supabase for auth, database, storage, and realtime infrastructure.
- Expo and React Native for the mobile development platform.

---

Built for recreational athletes who want to find games, meet players, and stay active in their city.