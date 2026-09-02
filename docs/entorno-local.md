# Guía de desarrollo local — BarQueue / Repitela

> **Índice:** [[README]] · **Autoridad sobre:** levantar el proyecto en local · **Últ. cambio:** 2026-05-05 · **Revisada contra el código:** 2026-09-02
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Todo lo que necesitas para levantar el sistema localmente y probar las implementaciones.

> **Revisión del 2026-09-02.** Esta guía tenía tres errores que impedían seguirla
> tal cual. Corregidos abajo: el `.env` **no** viene en el repo, la ruta del
> kiosco es `/video` y no `/kiosk`, y los comandos eran de PowerShell en un
> equipo macOS. El bloque de variables estaba incompleto: faltaban las de
> Turnstile, Brevo, Google y Wompi, añadidas después de que se escribiera.

---

## Requisitos previos

| Herramienta | Versión mínima | Verificar con |
|-------------|----------------|---------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | cualquiera | `git --version` |

---

## Estructura del proyecto

```
Music-video/
├── backend/      → FastAPI + SQLite (puerto 8000)
└── frontend/     → Vue 3 + Vite    (puerto 5173)
```

Ambos deben correr en paralelo en terminales separadas.

---

## 1. Backend (FastAPI)

### 1.1 Instalar dependencias

```bash
cd backend
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 1.2 Configurar variables de entorno

Copia el ejemplo y edítalo:

El `.env` **no está versionado** (`.gitignore:15`). Hay que crearlo desde el
ejemplo:

```bash
cp .env.example .env
```

Mínimo para arrancar en local. Todo lo demás tiene default en
`backend/app/config.py`:

```env
APP_ENV=development
APP_SECRET_KEY=change-me-in-production
APP_DEBUG=true

DATABASE_PATH=data/barqueue.db

YOUTUBE_API_KEY=           # <-- única clave que debes obtener (ver sección YouTube API)

CORS_ORIGINS=http://localhost:5173

MAX_SONGS_PER_WINDOW=5
WINDOW_MINUTES=20          # OJO: produccion usa 30 (docker-compose.yml). Ver [[reglas-de-negocio]] BR-05

JWT_EXPIRATION_HOURS=24
JWT_ADMIN_EXPIRATION_HOURS=8
```

Opcionales; sin ellas la feature correspondiente queda apagada o abierta, nunca
rota:

```env
TURNSTILE_SECRET_KEY=      # vacia = el anti-bot acepta todo (util en local)
BREVO_API_KEY=             # vacia = el link de verificacion se loguea en vez de enviarse
GOOGLE_CLIENT_ID=          # vacia = login con Google no funciona
WOMPI_PUBLIC_KEY=          # vacias = el checkout responde 503
GOOGLE_SIGNUP=true         # kill-switches reversibles
PAGOS=true
```

> `APP_SECRET_KEY=change-me-in-production` sirve en local, pero **el backend se
> niega a arrancar** con ese valor si `APP_ENV=production` o si la clave tiene
> menos de 32 caracteres (`config.py:44-50`). Es a propósito: con el secreto por
> defecto cualquiera puede forjar un token de superadmin.

### 1.3 Inicializar la base de datos con datos de prueba

```bash
# Desde la carpeta backend/ con el venv activado
python -m app.db.seed
```

Esto crea automáticamente:
- La base de datos SQLite en `backend/data/barqueue.db`
- Aplica todas las migraciones en orden
- Inserta venues, admins y super admin de prueba

### 1.4 Levantar el servidor

```bash
# Desde backend/ con venv activado
uvicorn app.main:app --reload --port 8000
```

Confirma que funciona: `http://localhost:8000/api/health` debe devolver `{"status": "ok"}`.

La documentación interactiva de la API está en `http://localhost:8000/docs`.

---

## 2. Frontend (Vue + Vite)

### 2.1 Instalar dependencias

```bash
cd frontend
npm install
```

### 2.2 Configurar variables de entorno

El archivo `frontend/.env.example` ya tiene los valores correctos para local. Cópialo:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Contenido de `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 2.3 Levantar el servidor de desarrollo

```bash
# Desde frontend/
npm run dev
```

La app estará disponible en `http://localhost:5173`.

---

## 3. Credenciales de prueba

Todas las credenciales son creadas por el script `seed.py`.

### Super Admin

| Campo | Valor |
|-------|-------|
| URL | `http://localhost:5173/superadmin` |
| Username | `william` |
| Password | `super123` |

Desde aquí puedes crear nuevos venues y admins.

### Admin — Venue "Bar Dev"

| Campo | Valor |
|-------|-------|
| URL de admin | `http://localhost:5173/bar-dev/admin` |
| Username | `admin` |
| Password | `admin123` |

### Admin — Venue "Kiosko"

| Campo | Valor |
|-------|-------|
| URL de admin | `http://localhost:5173/kiosko/admin` |
| Username | `kiosko_admin` |
| Password | `admin123` |

---

## 4. URLs del sistema por rol

Reemplaza `{venue}` con `bar-dev` o `kiosko`.

| Vista | URL | Quién la usa |
|-------|-----|-------------|
| Kiosco (pantalla del bar) | `/bar-dev/video` | TV / pantalla del bar |
| Panel admin | `/bar-dev/admin` | Admin del bar |
| Registro de usuario (QR) | `/bar-dev/registro` | Clientes |
| Dashboard de usuario | `/bar-dev/usuario` | Clientes (post-registro) |
| Super admin | `/superadmin` | Dueño del SaaS |

---

## 5. YouTube API Key

La YouTube Data API v3 se usa para validar URLs y buscar videos. Sin esta key, la búsqueda de canciones y la validación de URLs no funciona.

### Obtener la key (gratuito)

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un proyecto nuevo (o usar uno existente)
3. Activar **YouTube Data API v3** en "APIs y servicios"
4. Crear credenciales → **Clave de API**
5. Copiar la clave y pegarla en `backend/.env`:

```env
YOUTUBE_API_KEY=AIzaSy...tu_clave_aqui
```

6. Reiniciar el backend

> **Límite gratuito:** 10,000 unidades/día. Para desarrollo local es más que suficiente (una búsqueda usa ~100 unidades).

---

## 6. Flujo de prueba completo

Para probar todas las implementaciones recientes:

### Probar lista de respaldo (Fallback)

1. Abre el kiosco: `http://localhost:5173/bar-dev/video` → clic en **INICIAR REPRODUCTOR**
2. Abre el panel admin: `http://localhost:5173/bar-dev/admin`
3. En el admin, ve a la sección de playlist de respaldo e importa una playlist de YouTube
4. Activa la playlist desde el admin
5. Verifica que las canciones se reproducen en **orden aleatorio**
6. Prueba el botón **Siguiente** del admin mientras suena el fallback:
   - Sin canciones en cola → debe ir a la siguiente canción aleatoria del fallback
   - Con canciones en cola → debe saltar al queue inmediatamente

### Probar transición Fallback → Queue

1. Mientras suena el fallback, abre una sesión de usuario: `http://localhost:5173/bar-dev/registro`
2. Registra un número de celular y agrega una canción
3. Verifica que el kiosco espera a que termine la canción actual del fallback antes de cambiar
4. Presiona **Siguiente** desde el admin → debe cambiar inmediatamente a la canción del usuario

### Probar sincronización de admin entre dispositivos

1. Abre el panel admin en dos tabs/ventanas del navegador
2. Mueve el slider de volumen en una ventana
3. Verifica que el slider se actualiza automáticamente en la otra ventana
4. Lo mismo con: estado del fallback (pausar/reanudar), banner, QR

### Probar anti anger-click (usuario)

1. Abre el dashboard de usuario: `http://localhost:5173/bar-dev/registro`
2. Registra y ve al dashboard
3. Busca una canción → en los resultados, haz clic en el botón `+`
4. Verifica que aparece un spinner en ese resultado y los demás se dimean
5. No debe ser posible hacer clic en otro resultado mientras el primero carga

---

## 7. Reiniciar la base de datos

Si necesitas empezar desde cero:

```bash
rm -f backend/data/barqueue.db
cd backend && python -m app.db.seed
```

---

## 8. Comandos de referencia rápida

```bash
# Backend (terminal 1)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend && npm run dev

# Reset DB + seed
rm -f backend/data/barqueue.db && cd backend && python -m app.db.seed

# Tests del backend: en Docker, no con el python local (3.9 vs 3.11 del proyecto)
# y siempre con timeout: una conexion aiosqlite sin cerrar cuelga a pytest en verde.
docker compose run --rm backend timeout 120 python -m pytest

# Ver logs del backend en tiempo real
uvicorn app.main:app --reload --port 8000 --log-level debug
```
