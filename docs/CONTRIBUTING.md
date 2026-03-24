# Contribuir a BarQueue

## Setup del Entorno de Desarrollo

### Requisitos

- Python 3.11+
- Node.js 18+
- Git

### Clonar e Instalar

```bash
# Clonar el repositorio
git clone https://github.com/kashipu/Music-video.git
cd Music-video

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Herramientas de desarrollo

# Frontend
cd ../frontend
npm install
```

### Ejecutar en Desarrollo

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

El frontend corre en `http://localhost:5173` y hace proxy al backend en `http://localhost:8000`.

---

## Estructura del Proyecto

```
Music-video/
├── backend/           # Python + FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── routers/   # Endpoints de la API
│   │   ├── services/  # Lógica de negocio
│   │   ├── models/    # Schemas Pydantic + modelos DB
│   │   └── db/        # Migraciones SQL
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/          # Vue.js 3 + Vite
│   ├── src/
│   │   ├── views/     # Páginas/vistas
│   │   ├── components/# Componentes reutilizables
│   │   ├── composables/# Composables (hooks)
│   │   ├── stores/    # Pinia stores
│   │   └── utils/     # Utilidades
│   └── package.json
├── docs/              # Documentación
└── docker-compose.yml
```

---

## Herramientas de Desarrollo

### Backend

| Herramienta | Uso | Comando |
|-------------|-----|---------|
| **pytest** | Tests | `pytest` |
| **pytest-asyncio** | Tests async | (incluido con pytest) |
| **ruff** | Linter + formatter | `ruff check .` / `ruff format .` |
| **mypy** | Type checking | `mypy app/` |

```bash
# Correr tests
cd backend
pytest

# Correr tests con coverage
pytest --cov=app --cov-report=term-missing

# Linting
ruff check .

# Formateo
ruff format .

# Type checking
mypy app/
```

### Frontend

| Herramienta | Uso | Comando |
|-------------|-----|---------|
| **Vitest** | Tests | `npm run test` |
| **ESLint** | Linter | `npm run lint` |
| **Prettier** | Formatter | `npm run format` |

```bash
# Correr tests
cd frontend
npm run test

# Linting
npm run lint

# Formateo
npm run format

# Build de producción
npm run build
```

---

## Convenciones

### Branches

```
main                    # Producción, siempre estable
develop                 # Integración de features
feature/nombre-corto    # Features nuevas
fix/descripcion-bug     # Corrección de bugs
docs/que-se-documenta   # Documentación
```

**Ejemplos:**
```
feature/admin-analytics
fix/rate-limit-off-by-one
docs/api-websocket-events
```

### Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(scope): descripción corta

Cuerpo opcional con más detalle.
```

**Tipos:**

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Documentación |
| `refactor` | Refactorización sin cambio funcional |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento |
| `style` | Formateo, sin cambios de lógica |

**Ejemplos:**
```
feat(queue): agregar deduplicación de canciones en cola activa
fix(auth): corregir expiración de JWT en timezone UTC
docs(api): documentar endpoint de analytics
test(queue): agregar tests para rate limiting
```

### Código

**Backend (Python):**
- Seguir PEP 8 (enforced por ruff)
- Type hints en funciones públicas
- Docstrings en servicios y funciones complejas
- Async/await para todas las operaciones I/O

**Frontend (Vue.js):**
- Composition API (no Options API)
- `<script setup>` en todos los componentes
- Componentes en PascalCase (`SongCard.vue`)
- Composables prefijados con `use` (`useQueue.js`)
- Props tipadas con `defineProps` + TypeScript

---

## Pull Requests

### Antes de abrir un PR

1. Asegurar que los tests pasan: `pytest` (backend) y `npm run test` (frontend)
2. Asegurar que el linting pasa: `ruff check .` y `npm run lint`
3. Actualizar documentación si es necesario

### Template de PR

```markdown
## Descripción
Breve descripción del cambio.

## Tipo de cambio
- [ ] Feature nueva
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentación

## Testing
- [ ] Tests unitarios agregados/actualizados
- [ ] Tests manuales realizados

## Screenshots (si aplica)
```

---

## Base de Datos en Desarrollo

### Reset de la base de datos

```bash
cd backend
rm -f data/barqueue.db
python -m app.db.migrate  # Re-crear esquema
python -m app.db.seed     # Datos de prueba
```

### Agregar una migración

1. Crear archivo en `backend/app/db/migrations/`:
   ```
   NNN_descripcion.sql
   ```
   Donde `NNN` es el siguiente número secuencial.

2. Escribir el SQL de la migración.

3. La migración se aplica automáticamente al iniciar la app.
