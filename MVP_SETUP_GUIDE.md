# 🚀 Ralli MVP Database Setup Guide - Google Places API Integration

## 🎯 **Quick Setup for MVP Testing**

This guide will get your database properly set up for MVP testing with **location-based discovery** using Google Places API. Your app will automatically find sports facilities anywhere in the world!

## 📋 **Prerequisites**

1. **Supabase Project**: Make sure you have a Supabase project set up
2. **Google Places API**: Ensure you have Google Places API (New) configured with API key
3. **Environment Variables**: Ensure your `.env` file has:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
4. **Database Access**: You need access to the Supabase SQL Editor

## 🔧 **Step 1: Clean Database Setup**

1. **Open Supabase SQL Editor**
2. **Run the main setup script**:
   ```sql
   -- Copy and paste the entire contents of mvp-database-setup.sql
   ```
3. **Wait for completion** - You should see the success message

## 🧪 **Step 2: Add Test Data**

1. **Run the test data script**:
   ```sql
   -- Copy and paste the entire contents of mvp-test-data.sql
   ```
2. **Wait for completion** - You should see the success message

## 🎮 **Step 3: Test the App**

1. **Start your app**: `npx expo start`
2. **Sign up for a new account** in the app
3. **Navigate through the tabs** to see real data

## 📊 **What You'll See**

### **Map Tab**
- ✅ **Real-time facility discovery** using Google Places API
- ✅ **Global coverage** - works anywhere in the world
- ✅ **Live capacity counts** for each sport at each facility
- ✅ **Check-in functionality** (GPS-verified with Google Place IDs)

### **Sessions Tab**
- ✅ **6 upcoming sessions** across different sports
- ✅ **Real session details** with Google Places locations and times
- ✅ **Join/RSVP functionality**

### **Squad Tab**
- ✅ **5 sample squads** for different sports
- ✅ **Social feed** with activities
- ✅ **Like and comment** functionality

### **Profile Tab**
- ✅ **Real user stats** (Level 12, XP: 2450, 7-day streak)
- ✅ **Sport preferences** and achievements
- ✅ **Activity history**

## 🔍 **Core MVP Features Working**

### **Location-Based Discovery** ✅
- **Google Places API Integration** - Find facilities anywhere in the world
- **Real-time Facility Data** - Hours, ratings, photos from Google Places
- **Dynamic Sport Detection** - Automatically detects available sports at each facility
- **No Hardcoded Locations** - Works globally, not just San Francisco

### **Check-In System** ✅
- **GPS-verified check-ins** using Google Place IDs
- **Real-time capacity updates** when users check in/out
- **Location-based validation** against Google Places data

### **Facility Capacity** ✅
- **Live player counts** per location and sport
- **Sport-specific capacity limits** (Basketball: 10, Tennis: 4, etc.)
- **Real-time updates** when users check in/out

### **Session Management** ✅
- **Create and join sessions** at any Google Places facility
- **RSVP system** (In/Out/Maybe)
- **Player count tracking** with real-time updates

### **Social Features** ✅
- **Squad creation and management**
- **Activity feed** with likes/comments
- **User profiles and stats**

## 🐛 **Troubleshooting**

### **"Table doesn't exist" errors**
- Make sure you ran `mvp-database-setup.sql` first
- Check that all tables were created successfully

### **"Permission denied" errors**
- Verify your Supabase API key is correct
- Check that RLS policies are properly set up

### **Empty data in app**
- Make sure you signed up for a new account
- The test data uses placeholder user IDs that need to be replaced

### **Check-ins not working**
- Ensure location permissions are granted
- Verify GPS is working on your device

## 🎯 **Next Steps After Setup**

1. **Test core flows**:
   - Sign up → Check in at a location → See capacity update
   - Create a session → Join from another device
   - Join a squad → Post in the feed

2. **Verify real-time updates**:
   - Check in at a location
   - See the capacity count increase
   - Check the map for updated counts

3. **Test social features**:
   - Create a squad
   - Post activities
   - Like and comment on posts

## 📱 **MVP Testing Checklist**

- [ ] Database setup completed
- [ ] Test data loaded
- [ ] App starts without errors
- [ ] Can sign up for new account
- [ ] Map shows courts with capacity counts
- [ ] Can check in at a location
- [ ] Sessions tab shows upcoming games
- [ ] Can create and join sessions
- [ ] Squad tab shows social feed
- [ ] Profile shows user stats
- [ ] Real-time updates work

## 🚀 **Ready for MVP Launch!**

Once all items are checked off, your app is ready for MVP testing with real users. The core value proposition (accurate location counts and check-ins) is fully functional with **global location-based discovery** powered by Google Places API.

## 🌍 **Global Coverage Benefits**

- **Works Anywhere**: Users can find sports facilities in any city worldwide
- **Real-time Data**: Always shows current facility information from Google Places
- **No Maintenance**: No need to manually add or update facility data
- **Accurate Information**: Hours, ratings, photos, and amenities from Google Places
- **Scalable**: Automatically handles new facilities as Google adds them

## 📞 **Need Help?**

If you encounter any issues:
1. Check the Supabase logs for database errors
2. Verify your environment variables
3. Make sure all scripts ran successfully
4. Test with a fresh user account

**Happy testing! 🎉**
