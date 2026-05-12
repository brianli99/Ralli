/**
 * Shared check-in / presence geofence constants (meters).
 * Check-in must be within CHECK_IN_RADIUS_METERS of the facility.
 * Auto check-out triggers when distance exceeds CHECK_OUT_RADIUS_METERS
 * (buffer above check-in to reduce GPS jitter).
 */
export const CHECK_IN_RADIUS_METERS = 200;
export const CHECK_OUT_RADIUS_METERS = 280;

/** How long “active” check-ins / presence count toward “who’s playing” */
export const CHECK_IN_LISTING_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
