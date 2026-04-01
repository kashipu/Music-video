from pydantic import BaseModel, Field
from datetime import datetime


# --- Auth ---

class RegisterRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    table_number: str | None = None
    venue_slug: str
    data_consent: bool
    display_name: str | None = None
    pin: str | None = None


class RegisterResponse(BaseModel):
    token: str
    user: dict
    session: dict


class ProfileUpdateRequest(BaseModel):
    display_name: str


# --- Queue ---

class SongSubmitRequest(BaseModel):
    youtube_url: str


class SongConfirmRequest(BaseModel):
    youtube_id: str


class SongPreview(BaseModel):
    youtube_id: str
    title: str
    thumbnail_url: str
    duration_sec: int
    duration_formatted: str
    valid: bool = True
    recently_played_by_user: bool = False
    recently_played_minutes_ago: int | None = None


class SongConfirmResponse(BaseModel):
    id: int
    youtube_id: str
    title: str
    position: int
    estimated_wait_sec: int
    songs_remaining: int
    window_resets_at: str


class RateLimitInfo(BaseModel):
    songs_remaining: int
    max_songs: int
    window_minutes: int
    window_resets_at: str
    recent_submissions: int


# --- Admin ---

class AdminLoginRequest(BaseModel):
    username: str
    password: str
    venue_slug: str | None = None


class AdminLoginResponse(BaseModel):
    token: str
    admin: dict


class AdminSongAddRequest(BaseModel):
    youtube_url: str


class AdminReorderRequest(BaseModel):
    position: int


# --- Playback ---

class PlaybackFinishedRequest(BaseModel):
    song_id: int
    venue_slug: str


class PlaybackErrorRequest(BaseModel):
    song_id: int
    venue_slug: str
    error_code: int
