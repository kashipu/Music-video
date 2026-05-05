import { expect } from '@playwright/test';

const API = 'http://localhost:8001';

export async function resetDb() {
  const res = await fetch(`${API}/api/test/reset`, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to reset DB: ${res.statusText} - ${text}`);
  }
  return res.json();
}

export async function registerUser(phone: string, venueSlug = 'e2e-test') {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      venue_slug: venueSlug,
      data_consent: true,
      display_name: `User ${phone}`
    })
  });
  if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to register user: ${JSON.stringify(err.detail)}`);
  }
  const data = await res.json();
  return data.token;
}

export async function confirmSong(token: string, youtubeId: string, venueSlug = 'e2e-test') {
  // 1. Search/Add to temporary list
  const res = await fetch(`${API}/api/queue/songs`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ youtube_url: `https://youtube.com/watch?v=${youtubeId}` })
  });
  if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to add song to temporary list: ${JSON.stringify(err.detail)}`);
  }
  const songData = await res.json();

  // 2. Confirm the song
  const confirmRes = await fetch(`${API}/api/queue/songs/confirm`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      venue_slug: venueSlug,
      youtube_id: songData.youtube_id,
      title: songData.title
    })
  });
  if (!confirmRes.ok) {
      const err = await confirmRes.json();
      throw new Error(`Failed to confirm song: ${JSON.stringify(err.detail)}`);
  }
  return confirmRes.json();
}

export async function seedFallbackPlaylist(songs: {id: string, title: string}[]) {
  // We can't easily seed fallback via API without being admin, 
  // but resetDb already seeds 3. If we need custom ones, we'd need admin login.
  // For now, let's assume resetDb is enough or implement it if needed.
}
