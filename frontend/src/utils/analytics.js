/**
 * Push events to GTM dataLayer for GA4 tracking.
 * All events use the 'repitela_' prefix to distinguish from default GA events.
 *
 * Enhanced with:
 * - Session context (venue_slug, session duration) on every event
 * - Timing measurements (registration, search, song flow)
 * - Source tracking (search vs paste)
 * - Funnel position (result_position, queue_position)
 */

// Shared session context — set once after registration
const _ctx = {
  venue_slug: null,
  session_start: null,      // timestamp ms
  search_start: null,        // timestamp ms of last search
  search_query: null,        // last search query
  flow_start: null,          // timestamp ms of current song flow (search→confirm)
}

/**
 * Call once after login/register to tag every subsequent event.
 */
export function setAnalyticsContext(venueSlug) {
  _ctx.venue_slug = venueSlug
  _ctx.session_start = Date.now()
}

function sessionDurationSec() {
  return _ctx.session_start ? Math.round((Date.now() - _ctx.session_start) / 1000) : null
}

export function trackEvent(eventName, params = {}) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event: eventName,
    venue_slug: _ctx.venue_slug,
    session_duration_sec: sessionDurationSec(),
    ...params,
  })
}

// ===== USER / SESSION EVENTS =====

export function trackUserRegistered(venueSlug, isReturning = false, registrationTimeSec = null) {
  trackEvent(isReturning ? 'repitela_user_returned' : 'repitela_user_registered', {
    venue_slug: venueSlug,
    registration_time_sec: registrationTimeSec,
  })
}

export function trackSessionStarted(venueSlug) {
  setAnalyticsContext(venueSlug)
  trackEvent('repitela_session_started', { venue_slug: venueSlug })
}

export function trackSessionKicked(venueSlug) {
  trackEvent('repitela_session_kicked', { venue_slug: venueSlug })
}

export function trackSessionExpired(venueSlug, reason = 'inactivity') {
  trackEvent('repitela_session_expired', {
    venue_slug: venueSlug,
    expiry_reason: reason,
  })
}

// ===== SONG SEARCH EVENTS =====

/**
 * Fired after each search completes.
 * @param {string} query
 * @param {number} resultsCount
 * @param {number|null} searchDurationMs - time from keystroke to results
 */
export function trackSongSearched(query, resultsCount, searchDurationMs = null) {
  _ctx.search_start = Date.now()
  _ctx.search_query = query
  if (!_ctx.flow_start) _ctx.flow_start = Date.now()
  trackEvent('repitela_song_searched', {
    search_query: query,
    results_count: resultsCount,
    has_results: resultsCount > 0,
    search_duration_ms: searchDurationMs,
  })
}

/**
 * Fired when the user taps a search result to submit it.
 * @param {string} query - the search query that produced the results
 * @param {number} resultPosition - 0-indexed position in the results list
 * @param {number} totalResults
 * @param {string} youtubeId
 * @param {string} title
 */
export function trackSearchResultSelected(query, resultPosition, totalResults, youtubeId, title) {
  const timeToSelectSec = _ctx.search_start
    ? Math.round((Date.now() - _ctx.search_start) / 1000)
    : null
  trackEvent('repitela_search_result_selected', {
    search_query: query,
    result_position: resultPosition,
    total_results: totalResults,
    youtube_id: youtubeId,
    song_title: title,
    time_to_select_sec: timeToSelectSec,
  })
}

// ===== SONG SUBMISSION / CONFIRMATION =====

/**
 * @param {string} youtubeId
 * @param {string} title
 * @param {'search'|'paste'} source
 * @param {number|null} resultPosition - position in results if source=search
 */
export function trackSongSubmitted(youtubeId, title, source = 'search', resultPosition = null) {
  trackEvent('repitela_song_submitted', {
    youtube_id: youtubeId,
    song_title: title,
    submission_source: source,
    result_position: resultPosition,
  })
}

/**
 * @param {string} youtubeId
 * @param {string} title
 * @param {number} position - queue position
 */
export function trackSongConfirmed(youtubeId, title, position) {
  const flowTimeSec = _ctx.flow_start
    ? Math.round((Date.now() - _ctx.flow_start) / 1000)
    : null
  trackEvent('repitela_song_confirmed', {
    youtube_id: youtubeId,
    song_title: title,
    queue_position: position,
    time_to_confirm_sec: flowTimeSec,
  })
  // Reset flow timer for next song
  _ctx.flow_start = null
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
