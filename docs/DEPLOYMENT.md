# Despliegue - BarQueue

## Requisitos

| Requisito | Versión mínima | Uso |
|-----------|---------------|-----|
| Python | 3.11+ | Backend FastAPI |
| Node.js | 18+ | Build del frontend Vue.js |
| Docker | 24+ | Contenedores para Dokploy |
| Docker Compose | 2.0+ | Orquestación de servicios |
| YouTube Data API Key | v3 | Validación de videos |

---

## Variables de Entorno

### Backend

```env
# Aplicación
APP_ENV=production               # development | production
APP_SECRET_KEY=your-secret-key   # Clave para firmar JWT (cambiar en prod)
APP_DEBUG=false

# Base de datos
DATABASE_PATH=/data/barqueue.db  # Ruta al archivo SQLite

# YouTube
YOUTUBE_API_KEY=AIza...          # API key de Google Cloud Console

# CORS
CORS_ORIGINS=https://app.barqueue.com  # Orígenes permitidos (separados por coma)

# Rate limiting
MAX_SONGS_PER_WINDOW=5           # Canciones por ventana (default: 5)
WINDOW_MINUTES=30                # Ventana en minutos (default: 30)

# JWT
JWT_EXPIRATION_HOURS=24          # Expiración de tokens de cliente
JWT_ADMIN_EXPIRATION_HOURS=8     # Expiración de tokens de admin
```

### Frontend

```env
VITE_API_URL=https://api.barqueue.com    # URL del backend
VITE_WS_URL=wss://api.barqueue.com      # URL del WebSocket
```

---

## Estructura Docker (Monorepo)

### `docker-compose.yml`

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - sqlite_data:/data
    environment:
      - APP_ENV=production
      - APP_SECRET_KEY=${APP_SECRET_KEY}
      - DATABASE_PATH=/data/barqueue.db
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=${VITE_API_URL}
        - VITE_WS_URL=${VITE_WS_URL}
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  sqlite_data:
    driver: local
```

### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY app/ ./app/

# Crear directorio para datos
RUN mkdir -p /data

# Exponer puerto
EXPOSE 8000

# Ejecutar con gunicorn + uvicorn workers
CMD ["gunicorn", "app.main:app", \
     "-w", "2", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-"]
```

### `frontend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_WS_URL

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA: todas las rutas van a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy al backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## Despliegue con Dokploy

[Dokploy](https://dokploy.com/) es una plataforma de despliegue self-hosted que soporta Docker Compose.

### Pasos

1. **Configurar servidor:**
   - VPS con Ubuntu 22.04+ (mínimo 1 GB RAM, 20 GB disco)
   - Instalar Dokploy siguiendo su [documentación oficial](https://docs.dokploy.com/)

2. **Crear proyecto en Dokploy:**
   - Conectar repositorio de GitHub
   - Tipo de despliegue: Docker Compose
   - Apuntar al `docker-compose.yml` en la raíz del repo

3. **Configurar variables de entorno:**
   - En Dokploy, ir a Settings > Environment Variables
   - Agregar todas las variables listadas arriba

4. **Configurar dominio:**
   - Asignar dominio al servicio frontend (ej: `app.barqueue.com`)
   - Dokploy gestiona certificados SSL automáticamente con Let's Encrypt

5. **Deploy:**
   - Push al branch principal dispara deploy automático
   - Verificar health check: `curl https://app.barqueue.com/api/health`

---

## Setup de Desarrollo Local

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
cp .env.example .env
# Editar .env con tus valores

# Ejecutar migraciones
python -m app.db.migrate

# Iniciar servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env
# Editar .env con tus valores

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173
```

### Base de datos (desarrollo)

En desarrollo, SQLite se crea automáticamente en `backend/data/barqueue.db`.

Para insertar datos de prueba:
```bash
cd backend
python -m app.db.seed
```

Esto crea:
- 1 venue de prueba ("Bar Dev", slug: "bar-dev")
- 1 admin (username: `admin`, password: `admin123`)
- 5 mesas con QR

---

## HTTPS

HTTPS es **obligatorio** en producción por:
- WebSocket seguro (`wss://`) requerido por navegadores modernos
- JWT en headers requiere canal cifrado
- Datos personales (teléfonos) deben transmitirse cifrados

**Con Dokploy:** SSL automático via Let's Encrypt.
**Sin Dokploy:** usar Caddy (auto-SSL) o Nginx + Certbot.

---

## Backup

### SQLite

```bash
# Cron job diario a las 3 AM
0 3 * * * cp /data/barqueue.db /backups/barqueue_$(date +\%Y\%m\%d).db
```

**Importante:** SQLite en WAL mode puede tener archivos `-wal` y `-shm`. Para un backup consistente:

```bash
# Backup con sqlite3 (preferido)
0 3 * * * sqlite3 /data/barqueue.db ".backup '/backups/barqueue_$(date +\%Y\%m\%d).db'"
```

### Retención

- Mantener backups de los últimos 30 días
- Limpiar automáticamente:
```bash
find /backups -name "barqueue_*.db" -mtime +30 -delete
```

---

## Monitoreo

### Health Check

El endpoint `/api/health` verifica:
- Conexión a SQLite
- Versión de la aplicación

### Monitoreo recomendado

- **Uptime Kuma** (self-hosted): monitorear `/api/health` cada 60 segundos
- **Alertas:** notificación por Telegram/email si el health check falla
- **Logs:** Docker logs accesibles desde Dokploy o `docker compose logs -f`

### Métricas a observar

| Métrica | Dónde | Umbral de alerta |
|---------|-------|------------------|
| Health check | `/api/health` | Falla 3 veces consecutivas |
| Tamaño SQLite | Disco | > 500 MB |
| Conexiones WebSocket | Logs | > 200 simultáneas |
| Errores 5xx | Logs | > 10 por minuto |
| Uso de disco | Sistema | > 80% |
