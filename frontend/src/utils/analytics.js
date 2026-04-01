/**
 * Push events to GTM dataLayer for GA4 tracking.
 * All events use the 'repitela_' prefix to distinguish from default GA events.
 */

export function trackEvent(eventName, params = {}) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event: eventName,
    ...params,
  })
}

// ===== USER EVENTS =====

export function trackUserRegistered(venueSlug, isReturning = false) {
  trackEvent(isReturning ? 'repitela_user_returned' : 'repitela_user_registered', {
    venue_slug: venueSlug,
  })
}

export function trackSessionStarted(venueSlug) {
  trackEvent('repitela_session_started', { venue_slug: venueSlug })
}

export function trackSessionKicked(venueSlug) {
  trackEvent('repitela_session_kicked', { venue_slug: venueSlug })
}

// ===== SONG EVENTS =====

export function trackSongSearched(query, resultsCount) {
  trackEvent('repitela_song_searched', {
    search_query: query,
    results_count: resultsCount,
  })
}

export function trackSongSubmitted(youtubeId, title) {
  trackEvent('repitela_song_submitted', {
    youtube_id: youtubeId,
    song_title: title,
  })
}

export function trackSongConfirmed(youtubeId, title, position) {
  trackEvent('repitela_song_confirmed', {
    youtube_id: youtubeId,
    song_title: title,
    queue_position: position,
  })
}

export function trackSongCancelled(songId) {
  trackEvent('repitela_song_cancelled', { song_id: songId })
}

// ===== PLAYBACK EVENTS =====

export function trackSongPlayed(youtubeId, title, isFallback = false) {
  trackEvent('repitela_song_played', {
    youtube_id: youtubeId,
    song_title: title,
    is_fallback: isFallback,
  })
}

export function trackSongEnded(youtubeId, title) {
  trackEvent('repitela_song_ended', {
    youtube_id: youtubeId,
    song_title: title,
  })
}

export function trackSongError(youtubeId, errorCode) {
  trackEvent('repitela_song_error', {
    youtube_id: youtubeId,
    error_code: errorCode,
  })
}

export function trackFallbackActivated(venueSlug) {
  trackEvent('repitela_fallback_activated', { venue_slug: venueSlug })
}

// ===== ADMIN EVENTS =====

export function trackAdminAction(action, details = {}) {
  trackEvent('repitela_admin_action', {
    admin_action: action,
    ...details,
  })
}
