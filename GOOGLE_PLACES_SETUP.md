# Google Places API (New) Setup Guide

To enable real-time sports facility discovery in Ralli, you'll need to set up the Google Places API (New).

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Ralli" and click "Create"

## Step 2: Enable Places API (New)

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Places API (New)"
3. Click on "Places API (New)" and click "Enable"
4. **Important**: Make sure you enable the NEW Places API, not the legacy one

## Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key that's generated

## Step 4: Secure Your API Key (Recommended)

1. Click on your API key to edit it
2. Under "Application restrictions":
   - For development: Choose "None" 
   - For production: Choose "iOS apps" or "Android apps" and add your bundle ID
3. Under "API restrictions":
   - Choose "Restrict key"
   - Select "Places API (New)"
4. Click "Save"

## Step 5: Add API Key to Ralli

1. Open `src/services/placesApi.ts`
2. Replace `YOUR_GOOGLE_PLACES_API_KEY` with your actual API key:

```typescript
const GOOGLE_PLACES_API_KEY = 'your_actual_api_key_here';
```

## Step 6: Test the Integration

1. Restart your Expo app
2. Allow location permissions when prompted
3. Toggle "Live Data" on in the map screen
4. You should see real sports facilities near your location!

## API Usage & Costs

- **Free tier**: 100,000 requests per month
- **Cost**: $17 per 1,000 requests after free tier
- **Typical usage**: 10-50 requests per app session

## Troubleshooting

### "API key invalid" error
- Make sure you copied the key correctly
- Ensure Places API (New) is enabled, not the legacy version
- Check API key restrictions

### No facilities showing
- Verify location permissions are granted
- Try increasing search radius (up to 10km)
- Check console for error messages

### "REQUEST_DENIED" error
- API key might not have Places API enabled
- Check billing is set up (even for free tier)

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for production**
3. **Restrict API key to specific APIs and apps**
4. **Monitor usage in Google Cloud Console**

## Alternative: Environment Variables (Recommended for Production)

Instead of hardcoding the API key, use environment variables:

1. Create `.env` file in project root:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_api_key_here
```

2. Update `placesApi.ts`:
```typescript
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'YOUR_GOOGLE_PLACES_API_KEY';
```

3. Add `.env` to your `.gitignore` file

---

Once configured, Ralli will show real sports facilities with:
- ✅ Actual court locations near you
- ✅ Facility ratings and hours
- ✅ Real-time capacity tracking
- ✅ Dynamic search radius
- ✅ Sport-specific filtering
