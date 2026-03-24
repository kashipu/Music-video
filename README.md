# BarQueue - La Música la Pones Tú

Aplicación web para bares que permite a los clientes encolar canciones de YouTube desde su celular. Escaneas el QR de tu mesa, pegas el link y tu canción entra a la cola.

## Como Funciona

### Para el Cliente
1. Llegas al bar y escaneas el **QR de tu mesa** con el celular
2. Te registras con tu **número de celular** y aceptas el uso de datos
3. Pegas un **link de YouTube**, la app te muestra el preview de la canción
4. **Confirmas** y tu canción entra a la cola
5. Puedes pedir hasta **5 canciones cada 30 minutos**

### Para el Administrador del Bar
1. Accedes al **panel de admin** con username/password
2. Ves la **cola completa** con quién pidió qué desde qué mesa
3. Puedes **saltar, remover, reordenar** canciones o **agregar** las tuyas
4. Configuras la **playlist por defecto** para cuando no hay pedidos
5. Accedes a **analytics**: canciones populares, horas pico, tendencias

### El Kiosco (Pantalla del Bar)
- Un navegador en pantalla completa que **reproduce las canciones**
- Muestra la **canción actual**, quién la pidió y las siguientes en cola
- **Avanza automáticamente** cuando termina cada canción

## Tech Stack

| Componente | Tecnología |
|------------|-----------|
| Backend | Python + FastAPI |
| Frontend | Vue.js 3 + Vite |
| Base de datos | SQLite (WAL mode) |
| Tiempo real | WebSockets |
| Contenedores | Docker + Docker Compose |
| Deploy | Dokploy (VPS) |
| Reproducción | YouTube IFrame API / yt-dlp |

## Estructura del Monorepo

```
Music-video/
├── README.md               # Este archivo
├── docker-compose.yml      # Orquestación Docker para Dokploy
├── backend/                # API REST + WebSocket (Python/FastAPI)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/        # auth, queue, admin, playback
│   │   ├── services/       # Lógica de negocio
│   │   ├── models/         # Schemas Pydantic
│   │   └── db/             # Migraciones SQLite
│   └── tests/
├── frontend/               # SPA (Vue.js 3 + Vite)
│   ├── Dockerfile
│   ├── package.json
│   ├── nginx.conf
│   └── src/
│       ├── views/          # QRLanding, Dashboard, Admin, Kiosk
│       ├── components/     # SongCard, QueueList, NowPlaying
│       ├── composables/    # useWebSocket, useAuth, useQueue
│       └── stores/         # Pinia (auth, queue)
└── docs/                   # Documentación completa
```

## Quickstart

### Desarrollo Local

```bash
# Clonar
git clone https://github.com/kashipu/Music-video.git
cd Music-video

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

### Docker

```bash
# Crear .env con las variables necesarias (ver docs/DEPLOYMENT.md)
docker compose up --build
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [Arquitectura](docs/ARCHITECTURE.md) | Diseño del sistema, componentes, decisiones técnicas |
| [Reglas de Negocio](docs/BUSINESS_RULES.md) | Todas las reglas del dominio (rate limit, FIFO, validaciones) |
| [Modelo de Datos](docs/DATA_MODEL.md) | Esquema SQLite, tablas, índices, consultas frecuentes |
| [API](docs/API.md) | Referencia completa de endpoints REST y WebSocket |
| [Flujo del Usuario](docs/USER_FLOW.md) | Experiencia paso a paso del cliente, wireframes |
| [Guía del Admin](docs/ADMIN_GUIDE.md) | Panel de admin, kiosco, analytics, QR |
| [Despliegue](docs/DEPLOYMENT.md) | Docker, Dokploy, variables de entorno, backups |
| [Contribuir](docs/CONTRIBUTING.md) | Setup de desarrollo, convenciones, herramientas |

## Data Mining y Analytics

El sistema recopila datos (con consentimiento) para generar insights:

- **Canciones populares** por venue, día, semana, mes
- **Horas pico** de actividad musical
- **Co-ocurrencia** de canciones (qué se pide junto)
- **Preferencias por mesa** y zona del bar
- **Artistas/géneros trending** basados en metadata de YouTube
- **Recomendaciones** tipo "quienes pidieron X también pidieron Y"

## Licencia

Por definir.
