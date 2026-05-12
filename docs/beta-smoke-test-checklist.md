# Ralli Beta Smoke Test Checklist

Run this on a real iOS device and a real Android device before inviting beta testers.

## Setup
- Apply `sql/beta-schema-consolidated.sql` in Supabase.
- Start the app in a clean install state.
- Confirm there are no beta schema warnings in the development console.
- Confirm Google Places usage is visible in Google Cloud Console.

## Critical Flows
- Create a new account, complete sport onboarding, sign out, and sign back in.
- Send a password reset email, open the `ralli://reset-password` link, and set a new password.
- Scan or open a `ralli://friend/{userId}` link and send a friend request.
- Scan or open a `ralli://squad/{squadId}` link and join a public squad.
- Create a session, RSVP `in`, switch to `maybe`, switch to `out`, and confirm player counts stay accurate.
- Join a full session waitlist, free a spot from another account, and confirm promotion behavior.
- Check into a facility, leave the geofence, and confirm auto-checkout decrements capacity.
- Register for push notifications, receive a test notification, and confirm tapping it routes to the right screen.

## Social Flows
- Start a brand-new direct message thread and confirm the first reply appears realtime.
- Create a feed activity, like it, comment on it, and confirm counts update.
- Join a crew, challenge another crew with a scheduled time, accept/decline, and record a result.
- Search for friends and confirm emails are not exposed in discovery results.

## Map And Cost Checks
- Launch the map near the default/current location and confirm results load.
- Pan away and use `Search this area`; confirm results merge without repeated automatic searches.
- Toggle sport filters and confirm no Google request fires until an explicit search/location/radius action.
- Turn on airplane mode and confirm map errors are understandable and not repetitive.
- Check Google Cloud Console after testing for Text Search and Place Details usage spikes.
