# Revisión de arquitectura — Integración entre capas

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: cómo se comunican frontend y backend (86 endpoints REST + 17 eventos
WebSocket), diseño de URLs en ambos lados, estado de la documentación de la API
y estilo arquitectónico de cada capa.

Complementa a [FRONTEND.md](FRONTEND.md), [BACKEND.md](BACKEND.md) y
[SYSTEM.md](SYSTEM.md): aquí solo va lo que vive **entre** las capas.

Conclusión corta: los canales están bien elegidos y la API está
excepcionalmente bien documentada. Lo que falla es que el frontend no confía en
los eventos que recibe, que el diseño de URLs mezcla dos estilos sin criterio
escrito, y que el espacio de nombres de la raíz está comprometido sin que nadie
lo haya declarado.

---

## Fortalezas

- Dos canales con roles claros: REST para comandos y carga inicial, WebSocket
  para invalidación.
- **Los 86 endpoints están documentados en `docs/API.md`**, con método, cuerpo,
  forma de la respuesta, códigos de error y qué eventos WebSocket dispara cada
  uno. Verificado por script: 0 endpoints sin mencionar.
- `docs/API.md` documenta sus propias inconsistencias: deja constancia de que el
  header `X-Error-Code` solo está implementado en 2 de los 8 routers.
- Catálogo completo de los 17 eventos WebSocket (`docs/API.md` §5).
- Actualización optimista con rollback en las acciones críticas del panel:
  `pausePlayback`, `resumePlayback` y `toggleFallback` revierten el estado si la
  API responde error (`useAdminDashboard.js:271-345`).
- Las referencias de línea de `docs/API.md` siguen siendo correctas: 9
  comprobadas al azar en `admin.py`, 9 exactas.

---

## Hallazgos

### INT-1 · Los eventos WebSocket traen los datos y el frontend los descarta

**Severidad:** media · **Esfuerzo:** medio

De los 12 eventos que maneja `useAdminDashboard.js:156-192`, solo 5 aplican el
payload recibido (`volume_changed`, `banner_changed`,
`fallback_status_changed`, `qr_visibility_changed`,
`playback_status_changed`). Los otros 7 —`song_added`, `song_removed`,
`queue_reordered`, `now_playing_changed`, `table_registered`, `song_error`,
`your_song_playing`— disparan un refetch completo.

El WebSocket se usa como campana, no como transporte. Y el refetch no es uno:
`fetchQueue()` llama a `fetchPlayed()` dentro, y varios eventos disparan además
`fetchTables()`. En un bar lleno, cada canción que agrega cualquier mesa provoca
tres GET en todos los paneles conectados.

Encima de eso hay polling: 30 s en el panel admin, 10 s en el kiosco y 3 GET
cada 30 s por cliente (medido en `docs/CAPACITY.md`). Los dos mecanismos se
solapan sin que ninguno sepa del otro.

**Propuesta:** aplicar el payload del evento donde ya viene completo; reservar
el refetch para los eventos cuyo payload es parcial. El polling queda solo como
red de seguridad cuando `wsConnected` es `false`. Ver también
[FE-7](FRONTEND.md#fe-7--estado-de-servidor-sin-disciplina-de-caché).

### INT-2 · Cuatro endpoints tienen dos clientes con contratos incompatibles

**Severidad:** media · **Esfuerzo:** bajo (se resuelve con FE-1)

| Endpoint | Cliente 1 | Cliente 2 | Al fallar devuelve |
|---|---|---|---|
| `/api/playback/now-playing` | `services/admin.js:24` | `services/kiosk.js:21` | `{error:true}` vs `null` |
| `/api/queue/search` | `services/admin.js:31` | `components/SongSubmit.vue:69` (fetch crudo) | `{error:true}` vs `Response` |
| `/api/admin/playback/pause` | `services/admin.js` | `services/kiosk.js` | `{error:true}` vs `null` |
| `/api/admin/playback/resume` | `services/admin.js` | `services/kiosk.js` | `{error:true}` vs `null` |

El mismo endpoint se comporta distinto según qué parte de la app lo llame. Es la
consecuencia visible de
[FE-1](FRONTEND.md#fe-1--no-existe-una-capa-http-existen-cinco).

### INT-3 · La tenancy se expresa de tres formas distintas en la misma API

**Severidad:** media · **Esfuerzo:** alto (cambio incompatible)

| Mecanismo | Ejemplo | Consumidor |
|---|---|---|
| JWT | `GET /api/admin/queue` saca `venue_id` del token | Panel admin |
| Path | `GET /api/superadmin/venues/{venue_id}/stats` | Superadmin |
| Query string | `GET /api/playback/now-playing?venue={slug}` | Kiosco y público |

Cada capa del frontend tiene que saber cuál le toca, y el backend resuelve el
venue de tres maneras distintas según el router. Además mezcla los dos
identificadores de la entidad: `venue_id` numérico en superadmin, `slug` en el
resto.

Es un cambio incompatible: requiere INT-5 (versionado) antes de poder unificarse.

### INT-4 · Seis POST mandan el estado por query string en vez de body

**Severidad:** media · **Esfuerzo:** medio (cambio incompatible)

| Endpoint | Definición |
|---|---|
| `POST /api/admin/volume?volume=` | `admin.py:632` |
| `POST /api/admin/banner?text=&show_brand=` | `admin.py:656-657` |
| `POST /api/admin/fallback-status?paused=` | `admin.py:425` |
| `POST /api/admin/show-qr?show=&size=` | `admin.py:688-689` |
| `POST /api/admin/fallback/add?youtube_id=` | `admin.py:494` |
| `POST /api/admin/settings/pin?require=` | `admin.py:882` |

Consecuencias:

- El cuerpo queda vacío y se pierde el esquema Pydantic de validación, que es lo
  que el resto de la API sí usa.
- El texto del banner (hasta 500 caracteres, contenido que el bar muestra en su
  televisor) viaja URL-encoded en la línea de petición y por tanto queda en los
  access logs de nginx.
- Evolucionar el contrato obliga a romper la URL en vez de agregar un campo.

**Propuesta:** mover a body con modelo Pydantic. Requiere INT-5 o un periodo de
convivencia aceptando ambos.

### INT-5 · La API no tiene versionado

**Severidad:** media · **Esfuerzo:** bajo · **Habilitador**

No existe `/api/v1/`. Los 86 endpoints cuelgan directamente de `/api/`.

Importa más de lo habitual en este producto: la PWA cachea assets 30 días
(`frontend/nginx.conf`) y el kiosco corre durante semanas sin recargar
(`docs/ARCHITECTURE.md` §4.2 lo documenta: `/:slug/video` reproduce durante horas
y un reload la cortaría). Un cambio de contrato no tiene ruta de convivencia: o
rompe a los clientes viejos, o no se hace.

Es habilitador: INT-3, INT-4 e INT-6 son cambios incompatibles que hoy no se
pueden desplegar de forma segura.

### INT-6 · `/api/admin` mezcla autenticación pública y operación autenticada

**Severidad:** baja · **Esfuerzo:** medio (cambio incompatible)

Dos routers distintos comparten el mismo prefijo: `admin_auth.py` (7 endpoints
públicos: `login`, `signup`, `google-signup`, `verify-email`,
`forgot-password`, `reset-password`) y `admin.py` (29 endpoints que exigen token
de admin). El cliente no puede deducir de la URL si necesita autenticarse.

Contrasta con el lado cliente, donde sí están separados: `/api/auth` para
identidad y `/api/queue` para operación.

### INT-7 · El espacio de nombres de la raíz está comprometido y no hay slugs reservados

**Severidad:** alta · **Esfuerzo:** bajo · **Se encarece con el tiempo**

Las rutas de bar viven en la **raíz del dominio**: `/:venueSlug/registro`,
`/:venueSlug/usuario`, `/:venueSlug/video`, `/:venueSlug/admin`
(`frontend/src/router/index.js:64-137`), y el QR de cada mesa apunta a
`${origin}/${slug}/registro`.

El espacio de nombres de primer nivel queda compartido entre los slugs de los
bares y las rutas del producto (`/admin`, `/superadmin`, `/privacidad`), y **no
existe ninguna lista de slugs reservados**: `_slugify()`
(`app/services/admin_signup_service.py:19-32`) genera el slug desde el nombre del
bar y solo comprueba unicidad contra la tabla; `create_venue`
(`app/routers/superadmin.py:285`) solo comprueba unicidad. Un bar llamado
"Admin", "Superadmin", "Privacidad" o "Video" obtiene ese slug por autoservicio,
sin pasar por un superadmin.

Con las rutas de hoy no rompe nada —las rutas de bar siempre llevan un segundo
segmento que no colisiona con ninguna estática— pero es una restricción que
nadie declaró y que nada verifica. En cuanto se quiera una ruta nueva de primer
nivel (`/precios`, `/ayuda`, `/blog`), o un bar tome un slug que después se
necesite, el conflicto es silencioso.

**Por qué urge pese al esfuerzo bajo:** el slug va impreso en los códigos QR de
las mesas. Cada bar que se registra con un slug conflictivo encarece la
corrección, porque cambiarlo después obliga a reimprimir sus QR.

**Propuesta inmediata:** lista de reservados en `_slugify()` y en
`create_venue`. **Propuesta estructural:** mover los bares a un prefijo
(`/b/{slug}/registro`) o a subdominios, con redirección desde las URLs viejas.

### INT-8 · Mezcla de idiomas e identificadores en las rutas del frontend

**Severidad:** baja · **Esfuerzo:** medio

Español e inglés alternan dentro del mismo módulo:
`/superadmin/crear-bar`, `/superadmin/ventas`, `/superadmin/admins`,
`/superadmin/venue/:venueId`, `/superadmin/venue/:venueId/configuracion`,
`/superadmin/venue/:venueId/usuarios`, `/:venueSlug/registro`,
`/:venueSlug/usuario`, `/:venueSlug/video`, `/:venueSlug/admin/suscripcion`.

Además `/superadmin/venue/:venueId` usa el ID numérico y es singular, mientras
`/superadmin/admins` es plural y el resto de la app identifica al bar por slug.
Enlazar desde el panel de superadmin a la vista pública de un bar exige traducir
`venueId` a `slug`.

### INT-9 · 132 enlaces rotos en la documentación

**Severidad:** baja · **Esfuerzo:** trivial

`docs/API.md` tiene 112 y `docs/ARCHITECTURE.md` 20, todos con la forma:

```
file:///Users/williammoreno/orca/workspaces/Music-video/docs-api-arch/backend/...
```

Apuntan a una ruta local de otra máquina y a una copia de trabajo distinta
(`docs-api-arch`). Para cualquiera que no sea ese equipo están muertos.

**Propuesta:** reemplazo por rutas relativas del repo, como ya hace
`docs/DATA_MODEL.md`.

### INT-10 · Cero inyección de dependencias: `Depends(get_db)` no se usa nunca

**Severidad:** alta · **Esfuerzo:** medio

Los servicios llaman `get_db()` —un global de módulo (`app/database.py:9`)— 51
veces, y `Depends(get_db)` **no aparece ni una vez** en todo el proyecto: el
mecanismo de inyección de dependencias de FastAPI está sin usar para la base de
datos.

El costo es medible y explica la cobertura de tests: cada test tiene que parchear
el global por servicio.

```python
monkeypatch.setattr(billing_service, "get_db", test_db)   # tests/test_billing.py:62
```

Cada archivo de test reinventa su fixture, y por eso hay 22 tests y no 200.

**Propuesta:** pasar la conexión como parámetro a los servicios, con
`Depends(get_db)` en los routers. Encaja de forma natural con el helper de
transacciones de [BE-2](BACKEND.md#be-2--dbcommit-no-hace-nada-45-llamadas-dan-falsa-atomicidad),
que ya necesita que la conexión viaje explícita.

---

## Estilo arquitectónico: ni MVC ni hexagonal

Ambas capas usan **arquitectura por capas técnicas** (*layered / n-tier*). En el
backend, además, incompleta.

### Backend

Tiene la forma `routers → services → SQL`, pero le faltan las dos propiedades
que definen lo hexagonal:

- **No hay modelo de dominio.** `app/models/schemas.py` son 14 clases Pydantic
  con **cero métodos y cero validadores**: DTOs de transporte, no entidades con
  comportamiento. Las reglas de negocio viven repartidas entre servicios y
  routers.
- **La flecha de dependencia apunta al revés.** En hexagonal el dominio define
  el puerto y la infraestructura lo implementa; aquí el dominio importa
  `aiosqlite` a través de un global (INT-10).

Tampoco es MVC: no hay modelo con comportamiento ni capa de vista, y los
routers serializan JSON a mano.

Y la capa está a medias: 126 de las 259 sentencias SQL viven en los routers,
saltándose los servicios. En `superadmin.py` la capa de servicios directamente
no existe. Ver [BE-4](BACKEND.md#be-4--la-capa-de-servicios-existe-a-medias-126-sentencias-sql-en-routers).

### Frontend

También por capas, con sabor MVVM. `docs/FRONTEND_ARCHITECTURE.md` §1 define
explícitamente las capas y la dirección única de dependencia
(`vistas → componentes → primitivos`, `vistas/componentes → stores → services`).
En términos de Vue: template = vista, `script setup` + composables = view-model,
stores + services = modelo. Correcto como elección; el problema es de
cumplimiento, no de estilo (ver
[FE-2](FRONTEND.md#fe-2--25-fetch-en-vistas-y-componentes)).

### Recomendación

**No migrar a hexagonal.** Para un CRUD con tiempo real de este tamaño, layered
es la elección correcta y hexagonal sería sobreingeniería: agregaría puertos,
adaptadores y mapeadores para un dominio que hoy cabe en nueve servicios.

Lo que sí vale la pena, y es el 80 % del beneficio de lo hexagonal sin su costo,
es **invertir la dependencia de la base de datos** (INT-10). Eso elimina el
monkeypatch de cada test, habilita tests con base transaccional descartable y
encaja con el helper de transacciones que ya hace falta por BE-2.
