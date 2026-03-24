# BarQueue - La Musica la Pones Tu

Plataforma SaaS multi-tenant para bares que permite a los clientes encolar canciones de YouTube desde su celular. Cada bar tiene su propia cola, panel de admin, y pantalla de video.

## Como Funciona

### Para el Cliente
1. Escanea el **QR de la mesa** con el celular
2. Se registra con **numero de celular** y nombre
3. Pega un **link de YouTube**, ve el preview de la cancion
4. **Confirma** y la cancion entra a la cola
5. Puede pedir hasta **5 canciones cada 30 minutos** (configurable)
6. Ve en que posicion esta su cancion y recibe notificacion cuando suena

### Para el Administrador del Bar
1. Accede al **panel de admin** con username/password
2. Layout de **2 columnas**: info del bar a la izquierda, musica a la derecha
3. Controles: **pausar, siguiente, play, mute, volumen** con labels
4. **Drag & drop** para reordenar canciones en la cola
5. **Biblioteca** de canciones ya reproducidas para re-encolar
6. **Playlist de respaldo** que suena automaticamente cuando la cola esta vacia
7. Gestion de **mesas**: ver actividad, resetear limites, expulsar
8. **QR dinamico** con descarga e impresion
9. **Analytics**: canciones populares, horas pico, mesas activas

### La Pantalla de Video (Kiosco)
- Reproduce las canciones en **pantalla completa**
- Overlay con nombre de la cancion que aparece 15 segundos y desaparece
- Barra sutil inferior con cancion actual y siguiente
- **Playlist de respaldo** suena automaticamente sin repetir cuando la cola esta vacia
- Indicador visual "PLAYLIST" cuando suena musica de respaldo
- Control de volumen y pausa remotos desde el admin

### Super Admin (Dueno de la plataforma)
- Crea y gestiona **multiples bares** desde un solo panel
- Configura por bar: nombre, logo, slug, QR URL, rate limits
- Importa **playlists de YouTube** como musica de respaldo por bar
- Gestiona **administradores** por bar
- Ve **usuarios registrados** con nombre y telefono
- Activa, desactiva o elimina bares
- Ve estadisticas globales de todos los bares

## Arquitectura Multi-Tenant

```
Super Admin (/superadmin)
  |
  |-- Bar La Esquina (/bar-la-esquina/*)
  |     |-- /registro     (cliente se registra)
  |     |-- /usuario      (cliente encola canciones)
  |     |-- /admin/login  (admin del bar)
  |     |-- /admin        (panel de administracion)
  |     |-- /video        (pantalla de reproduccion)
  |
  |-- Bar El Rincon (/bar-el-rincon/*)
  |     |-- (mismas rutas)
  |
  |-- ... (N bares)
```

Todos los bares comparten la misma base de datos SQLite, aislados por `venue_id`.

## Tech Stack

| Componente | Tecnologia |
|------------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | Vue.js 3 + Vite |
| Base de datos | SQLite (WAL mode) |
| Tiempo real | WebSockets nativo |
| Contenedores | Docker + Docker Compose |
| Deploy | Dokploy (VPS) |
| Reproduccion | YouTube IFrame Player API |
| QR | api.qrserver.com (sin dependencias) |

## Estructura del Proyecto

```
Music-video/
├── README.md
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── app/
│       ├── main.py              # FastAPI app, CORS, lifespan
│       ├── config.py            # Settings desde .env
│       ├── database.py          # SQLite connection + migrations
│       ├── routers/
│       │   ├── auth.py          # Registro, sesiones, JWT
│       │   ├── queue.py         # Cola de canciones (cliente)
│       │   ├── admin.py         # Panel admin del bar
│       │   ├── playback.py      # Control de reproduccion
│       │   ├── websocket.py     # WebSocket manager
│       │   └── superadmin.py    # CRUD de bares, playlists, usuarios
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── queue_service.py
│       │   ├── youtube_service.py
│       │   ├── playback_service.py
│       │   ├── playlist_service.py
│       │   └── analytics_service.py
│       ├── models/
│       │   └── schemas.py       # Pydantic models
│       └── db/
│           ├── migrations/      # SQL migrations (001-005)
│           ├── seed.py          # Datos iniciales
│           └── update_titles.py # Actualizar titulos de YouTube
├── frontend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── style.css            # Variables CSS, tema oscuro
│       ├── router/index.js      # Vue Router con guards
│       ├── stores/
│       │   ├── auth.js          # Pinia: auth state
│       │   └── queue.js         # Pinia: queue state
│       ├── composables/
│       │   └── useWebSocket.js  # WebSocket con reconnect
│       ├── utils/
│       │   └── youtube.js       # Parseo URLs YouTube
│       ├── views/
│       │   ├── QRLanding.vue          # Registro del cliente
│       │   ├── CustomerDashboard.vue  # Dashboard del cliente
│       │   ├── AdminLogin.vue         # Login admin
│       │   ├── AdminDashboard.vue     # Panel admin (2 columnas)
│       │   ├── Kiosk.vue              # Pantalla video fullscreen
│       │   ├── SuperAdminLogin.vue    # Login super admin
│       │   ├── SuperAdminPanel.vue    # Listado de bares
│       │   └── SuperAdminVenueDetail.vue  # Detalle/config de un bar
│       └── components/
│           ├── NowPlaying.vue
│           ├── QueueList.vue
│           ├── SongCard.vue
│           ├── SongSubmit.vue
│           └── SongPreview.vue
└── docs/                        # Documentacion de diseno
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
python -m app.db.seed
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
copy .env.example .env
npm run dev
```

Accede a:
- Super Admin: http://localhost:5173/superadmin/login (william / super123)
- Crea un bar desde el super admin y usa las URLs generadas

### Docker

```bash
docker compose up --build
```

## Base de Datos

SQLite con WAL mode. 9 tablas:

| Tabla | Descripcion |
|-------|-------------|
| `venues` | Bares (name, slug, logo, config, QR URL) |
| `users` | Usuarios (phone, name, consent) |
| `user_sessions` | Sesiones por venue (table_number) |
| `queue_songs` | Cola de canciones (FIFO, status) |
| `submission_log` | Rate limiting (rolling window) |
| `admins` | Admins por venue (bcrypt) |
| `super_admins` | Super administradores |
| `play_history` | Historial de reproduccion |
| `song_metadata` | Cache de metadata YouTube |
| `fallback_songs` | Playlist de respaldo por venue |

## API Endpoints

### Auth
- `POST /api/auth/register` — Registro cliente
- `GET /api/auth/session` — Info sesion actual
- `PATCH /api/auth/profile` — Actualizar nombre

### Queue (Cliente)
- `GET /api/queue?venue=slug` — Cola actual
- `POST /api/queue/songs` — Validar URL (preview)
- `POST /api/queue/songs/confirm` — Confirmar y encolar
- `GET /api/queue/my-songs` — Mis canciones
- `DELETE /api/queue/my-songs/{id}` — Cancelar mi cancion
- `GET /api/queue/remaining-slots` — Rate limit info

### Admin
- `POST /api/admin/login` — Login admin
- `GET /api/admin/queue` — Cola completa
- `POST /api/admin/queue/songs` — Agregar cancion
- `POST /api/admin/queue/songs/{id}/play-now` — Reproducir ahora
- `DELETE /api/admin/queue/songs/{id}` — Remover
- `PATCH /api/admin/queue/songs/{id}` — Reordenar
- `POST /api/admin/queue/skip` — Saltar cancion
- `POST /api/admin/playback/start` — Iniciar reproduccion
- `POST /api/admin/playback/pause` — Pausar
- `POST /api/admin/playback/resume` — Reanudar
- `POST /api/admin/volume?volume=N` — Cambiar volumen
- `POST /api/admin/fallback-status?paused=bool` — Pausar/activar playlist
- `POST /api/admin/fallback-play` — Reproducir playlist ahora
- `GET /api/admin/played` — Canciones ya reproducidas
- `GET /api/admin/playlist` — Playlist de respaldo
- `GET /api/admin/library?search=` — Buscar en biblioteca
- `GET /api/admin/tables` — Mesas activas
- `POST /api/admin/tables/{n}/kick` — Expulsar mesa
- `POST /api/admin/tables/{n}/reset-limit` — Resetear limite
- `GET /api/admin/analytics?period=` — Analytics
- `GET /api/admin/history` — Historial

### Playback
- `GET /api/playback/now-playing?venue=slug` — Que esta sonando
- `POST /api/playback/finished` — Cancion termino

### Super Admin
- `POST /api/superadmin/login` — Login
- `GET /api/superadmin/venues` — Listar bares
- `POST /api/superadmin/venues` — Crear bar
- `PATCH /api/superadmin/venues/{id}` — Editar bar
- `DELETE /api/superadmin/venues/{id}` — Eliminar bar
- `GET /api/superadmin/venues/{id}/stats` — Estadisticas
- `GET /api/superadmin/venues/{id}/users` — Usuarios del bar
- `POST /api/superadmin/venues/{id}/admins` — Agregar admin
- `DELETE /api/superadmin/venues/{id}/admins/{id}` — Quitar admin
- `GET /api/superadmin/venues/{id}/playlist` — Playlist
- `POST /api/superadmin/venues/{id}/playlist/import` — Importar playlist YouTube
- `POST /api/superadmin/venues/{id}/playlist/add` — Agregar cancion
- `DELETE /api/superadmin/venues/{id}/playlist/{id}` — Quitar cancion
- `PATCH /api/superadmin/venues/{id}/playlist/{id}/toggle` — Activar/desactivar

### WebSocket
- `ws://host/ws/queue?venue=slug&user_id=N` — Tiempo real

## Variables de Entorno

### Backend (.env)
```
APP_SECRET_KEY=cambiar-en-produccion
DATABASE_PATH=data/barqueue.db
YOUTUBE_API_KEY=              # Opcional, usa oEmbed sin key
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
