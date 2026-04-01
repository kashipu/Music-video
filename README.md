# Repitela - La Musica la Pones Tu

Plataforma SaaS multi-tenant para bares que permite a los clientes encolar canciones de YouTube desde su celular. Cada bar tiene su propia cola, panel de admin, y pantalla de video.

## Como Funciona

### Para el Cliente
1. Escanea el **QR** (visible en la pantalla del bar o impreso en la mesa)
2. Se registra con **numero de celular** y nombre
3. Busca una cancion o pega un **link de YouTube**
4. **Confirma** y la cancion entra a la cola
5. Puede pedir hasta **5 canciones cada 30 minutos** (configurable por bar)
6. Ve en que posicion esta su cancion y recibe notificacion cuando suena
7. Puede cancelar canciones pendientes

### Para el Administrador del Bar
1. Accede al **panel de admin** desde `app.repitela.com/admin` (login global, redirige a su bar)
2. Layout de **2 columnas**: info del bar a la izquierda, musica/mesas/analytics a la derecha
3. Controles de reproduccion: **pausar, siguiente, play, mute, volumen** con estados de carga
4. **Drag & drop** para reordenar canciones en la cola
5. **Buscar en YouTube** o re-encolar desde **biblioteca** de canciones ya reproducidas
6. **Playlist de respaldo** que suena cuando la cola esta vacia (con skip y pause)
7. Gestion de **mesas/usuarios**: ver actividad, resetear limites, expulsar
8. **QR dinamico** con descarga e impresion + toggle para mostrar QR en pantalla del Kiosk
9. **Banner publicitario** scrollable con auto-hide de 3 minutos
10. **Logo/nombre del bar** toggle en la pantalla de video
11. **Analytics** con selector de periodo (hoy/semana/mes/todo): canciones, usuarios, skips, errores, top artistas, horas pico, mesas activas

### La Pantalla de Video (Kiosk)
- Reproduce canciones en **pantalla completa** sin UI de YouTube visible
- **Controles propios**: barra de progreso con tiempo, play/pause, adelantar/retroceder (-10s, +10s)
- La barra aparece al pasar el mouse y se contrae automaticamente
- **Playlist de respaldo** suena cuando la cola esta vacia, sin interrumpir al agregar canciones
- **QR en pantalla**: grande en overlay de espera, mini QR durante reproduccion (ciclo 2min visible / 1min oculto, controlado desde admin)
- **Deteccion de errores de video**: salta automaticamente si un video esta bloqueado/removido
- **Deteccion de audio bloqueado**: muestra boton "ACTIVAR SONIDO" si el browser bloquea autoplay
- **Pre-buffering**: segundo player oculto pre-carga el siguiente video para transiciones rapidas
- Overlay con nombre de cancion (15s), barra inferior con cancion actual/siguiente
- Hereda el **tema/colores** del venue

### Super Admin (Dueno de la plataforma)
- Crea y gestiona **multiples bares** desde un solo panel
- Configura por bar: nombre, logo, slug, QR URL, rate limits, tema
- Importa **playlists de YouTube** como musica de respaldo por bar
- Gestiona **administradores** por bar
- Ve **usuarios registrados** con nombre y telefono
- Activa, desactiva o elimina bares

## Funcionalidades v1.0.2

### Reproduccion
- Playlist sin interrupciones: cuando un usuario agrega cancion durante fallback, espera a que termine la cancion actual
- Deteccion de errores de YouTube (codigos 101, 150, 100): salta automaticamente + notifica al admin
- Pre-buffering de siguiente cancion con segundo player oculto
- Controles de video propios: barra de progreso, seek, play/pause (YouTube UI deshabilitada)
- Deteccion de audio bloqueado por el browser con overlay de activacion

### Admin
- Estados de carga individuales por boton (skip, pause, play, kick, etc.)
- Skip y pause para playlist de respaldo
- Toggle para mostrar/ocultar QR en pantalla del Kiosk (ciclo 2min on / 1min off)
- Login global en `/admin` (sin necesidad de saber el slug del bar)

### Analytics
- Tabla `analytics_events` para tracking granular de eventos
- `play_history` ya no se borra (retencion permanente para analytics)
- Eventos trackeados: song_played, song_skipped, song_removed, song_error, fallback_activated, user_registered, user_returned, session_started, session_kicked
- Metricas: skip rate, error rate, activaciones de fallback, usuarios nuevos vs recurrentes, top artistas, dias activos
- Selector de periodo: hoy, semana, mes, todo

### Google Analytics (GTM + GA4)
- Google Tag Manager integrado (GTM-PPVKNTZB)
- 13 eventos custom enviados al dataLayer (`repitela_*`)
- Contenedor GTM importable en `docs/gtm-container.json`
- Documentacion completa en `docs/ANALYTICS.md`

### UX
- Registro de usuario muestra logo y nombre del bar (no "BarQueue")
- Texto "por Repitela" en registro
- Herencia de tema/colores del venue en todas las vistas (registro, usuario, admin, kiosk)
- Toggle tema claro/oscuro funcional con preservacion de colores del venue
- Contraste mejorado en ambos temas
- PIN diario opcional para verificar presencia fisica (desactivado por defecto)

### Seguridad
- Slugs de venue unicos (constraint UNIQUE en DB)
- Usernames de admin unicos
- Error handling robusto en super admin login

## Arquitectura Multi-Tenant

```
Super Admin (/superadmin)
  |
  |-- Bar La Esquina (/bar-la-esquina/*)
  |     |-- /registro     (cliente se registra)
  |     |-- /usuario      (cliente encola canciones)
  |     |-- /admin        (panel de administracion)
  |     |-- /video        (pantalla de reproduccion)
  |
  |-- Bar El Rincon (/bar-el-rincon/*)
  |     |-- (mismas rutas)
  |
  |-- ... (N bares)

Rutas globales:
  /admin          (login admin universal)
  /superadmin     (gestion de la plataforma)
```

Todos los bares comparten la misma base de datos SQLite, aislados por `venue_id`.

## Tech Stack

| Componente | Tecnologia |
|------------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | Vue.js 3 + Pinia + Vite |
| Base de datos | SQLite (WAL mode) |
| Tiempo real | WebSockets nativo |
| Contenedores | Docker + Docker Compose |
| Deploy | Dokploy (VPS) |
| Reproduccion | YouTube IFrame Player API |
| QR | api.qrserver.com |
| Analytics | Google Tag Manager + GA4 |

## Estructura del Proyecto

```
Music-video/
├── README.md
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app, CORS, lifespan
│       ├── config.py            # Settings desde .env
│       ├── database.py          # SQLite connection + migrations
│       ├── routers/
│       │   ├── auth.py          # Registro, sesiones, JWT, venue-info
│       │   ├── queue.py         # Cola de canciones (cliente)
│       │   ├── admin.py         # Panel admin + daily-pin + show-qr
│       │   ├── playback.py      # Control de reproduccion + error handling
│       │   ├── websocket.py     # WebSocket manager
│       │   └── superadmin.py    # CRUD de bares, playlists, usuarios
│       ├── services/
│       │   ├── auth_service.py      # + daily PIN
│       │   ├── queue_service.py
│       │   ├── youtube_service.py
│       │   ├── playback_service.py  # + error_song()
│       │   ├── playlist_service.py
│       │   └── analytics_service.py # + log_event() + enhanced metrics
│       ├── models/
│       │   └── schemas.py
│       └── db/
│           └── migrations/      # SQL migrations (001-007)
├── frontend/
│   ├── Dockerfile
│   ├── index.html               # GTM container
│   └── src/
│       ├── style.css            # Temas dark/light con buen contraste
│       ├── router/index.js      # + /admin login global
│       ├── stores/
│       │   ├── auth.js          # + PIN support
│       │   └── queue.js
│       ├── composables/
│       │   ├── useWebSocket.js
│       │   └── useTheme.js      # + venue theme preservation on toggle
│       ├── utils/
│       │   ├── youtube.js
│       │   └── analytics.js     # GTM dataLayer helper
│       ├── views/
│       │   ├── QRLanding.vue          # + venue logo/name/theme
│       │   ├── CustomerDashboard.vue  # + loading states
│       │   ├── AdminLogin.vue         # + global login (sin slug)
│       │   ├── AdminDashboard.vue     # + per-button loading + QR toggle + fallback skip
│       │   ├── Kiosk.vue              # + progress bar + controls + QR + error detection + pre-buffer
│       │   ├── SuperAdminLogin.vue    # + error handling
│       │   ├── SuperAdminPanel.vue
│       │   └── SuperAdminVenueDetail.vue
│       └── components/
│           ├── SongSubmit.vue         # + analytics tracking
│           └── SongPreview.vue        # + loading state
└── docs/
    ├── ANALYTICS.md             # Plan de medicion completo
    ├── gtm-container.json       # Contenedor GTM importable
    └── ...                      # Arquitectura, API, flujos
```

## Quickstart

### Desarrollo Local

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
copy .env.example .env
npm run dev
```

Accede a:
- Admin login: http://localhost:5173/admin
- Super Admin: http://localhost:5173/superadmin/login

### Docker

```bash
docker compose up --build
```

## Base de Datos

SQLite con WAL mode. 11 tablas:

| Tabla | Descripcion |
|-------|-------------|
| `venues` | Bares (name, slug, logo, config JSON, QR URL) |
| `users` | Usuarios (phone, name, consent) |
| `user_sessions` | Sesiones por venue (table_number) |
| `queue_songs` | Cola de canciones (FIFO, status) |
| `submission_log` | Rate limiting (rolling window) |
| `admins` | Admins por venue (bcrypt) |
| `super_admins` | Super administradores |
| `play_history` | Historial de reproduccion (permanente) |
| `song_metadata` | Cache de metadata YouTube |
| `fallback_songs` | Playlist de respaldo por venue |
| `venue_daily_pins` | PINs diarios por venue |
| `analytics_events` | Eventos de analytics granulares |

## Variables de Entorno

### Backend (.env)
```
APP_SECRET_KEY=cambiar-en-produccion
DATABASE_PATH=data/barqueue.db
YOUTUBE_API_KEY=              # Opcional
CORS_ORIGINS=http://localhost:5173
MAX_SONGS_PER_WINDOW=5
WINDOW_MINUTES=30
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Licencia

Propietario.
