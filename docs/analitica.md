# Plan de Medicion - Repitela Analytics

> **Índice:** [[README]] · **Autoridad sobre:** qué se mide y de dónde sale · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

## Resumen

Repitela usa Google Tag Manager (GTM-PPVKNTZB) para enviar eventos a GA4. Los eventos se pushean al `dataLayer` desde el frontend y GTM los captura y envia a Google Analytics.

Ademas, el backend registra eventos clave en la tabla `analytics_events` para el dashboard de admin.

## Eventos Implementados

### Eventos de Usuario / Sesion

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_user_registered` | QRLanding - registro exitoso (usuario nuevo) | `venue_slug`, `registration_time_sec` |
| `repitela_user_returned` | QRLanding - registro exitoso (usuario existente) | `venue_slug`, `registration_time_sec` |
| `repitela_session_started` | QRLanding - despues de registro | `venue_slug` |
| `repitela_session_kicked` | CustomerDashboard - admin expulsa al usuario | `venue_slug` |
| `repitela_session_expired` | CustomerDashboard - sesion expira automaticamente | `venue_slug`, `expiry_reason`, `session_duration_sec` |

### Eventos de Busqueda

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_song_searched` | SongSubmit - busqueda completada | `search_query`, `results_count`, `has_results`, `search_duration_ms` |
| `repitela_search_result_selected` | SongSubmit - usuario toca un resultado | `search_query`, `result_position`, `total_results`, `youtube_id`, `song_title`, `time_to_select_sec` |

### Eventos de Canciones (submit/confirm/cancel)

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_song_submitted` | SongSubmit - cancion seleccionada para preview | `youtube_id`, `song_title`, `submission_source`, `result_position` |
| `repitela_song_confirmed` | CustomerDashboard - cancion confirmada a la cola | `youtube_id`, `song_title`, `queue_position`, `time_to_confirm_sec` |
| `repitela_song_cancelled` | CustomerDashboard - usuario cancela su cancion | `song_id` |

### Eventos de Reproduccion

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_song_played` | Kiosk - video empieza a reproducirse | `youtube_id`, `song_title`, `is_fallback` |
| `repitela_song_ended` | Kiosk - video termina naturalmente | `youtube_id`, `song_title` |
| `repitela_song_error` | Kiosk - error de YouTube (bloqueado/removido) | `youtube_id`, `error_code` |
| `repitela_fallback_activated` | Kiosk - playlist de respaldo se activa | `venue_slug` |

### Eventos de Admin

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_admin_action` | AdminDashboard - cualquier accion admin | `admin_action`, + detalles |

Valores de `admin_action`:
- `start_playback` - iniciar reproduccion
- `skip_song` - saltar cancion
- `pause_playback` - pausar
- `resume_playback` - reanudar
- `skip_fallback` - saltar cancion de playlist
- `play_now` - reproducir cancion especifica (+ `song_id`)
- `clear_queue` - vaciar cola (+ `songs_cleared`)
- `remove_song` - quitar cancion (+ `song_id`)
- `kick_table` - expulsar usuario (+ `table_number`)
- `reset_limit` - resetear limite (+ `table_number`)

### Eventos de la Landing (repitela.com)

Se pushean desde `landing/src/lib/analytics.ts` (`track()`). No llevan `venue_slug`
ni `session_duration_sec`: la landing es publica y no hay sesion de bar.

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_landing_whatsapp_click` | Clic en cualquier CTA de WhatsApp directo | `location` |
| `repitela_landing_demo_opened` | Se abre el modal del formulario de demo | `location` |
| `repitela_landing_lead_submitted` | Se envia el formulario (nombre/bar/ciudad/direccion) | `location`, `ciudad` |

Valores de `location`: `navbar`, `navbar_mobile`, `hero`, `for_bars`, `pricing`,
`cta_final`, `footer`, `floating`, `blog_post`, `blog_sidebar`, `blog_post_body`.

### Eventos del Blog (repitela.com/blog)

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_blog_post_viewed` | Al cargar un artículo | `post_slug`, `post_title`, `reading_time_min` |
| `repitela_blog_read_progress` | Al llegar al 50% y 90% de lectura | `post_slug`, `post_title`, `percent` |
| `repitela_blog_share_clicked` | Al compartir por Facebook, X, WhatsApp o copiar enlace | `post_slug`, `post_title`, `share_platform` |
| `repitela_blog_cta_clicked` | Al abrir la demo desde la barra lateral | `post_slug`, `post_title`, `cta_type`, `location` |

El CTA lateral conserva `data-open-lead` para abrir el modal, pero no emite `repitela_landing_demo_opened`: registra solo el evento específico `repitela_blog_cta_clicked` para no duplicar conversiones.

Las visitas (`page_view`, usuarios, fuentes de trafico) las reporta sola la
etiqueta de Google (`G-JFQN47GREE`) que ya dispara en All Pages.

### Contexto comun (todos los eventos)

Todos los eventos incluyen automaticamente:
- `venue_slug` — identificador del bar
- `session_duration_sec` — segundos desde que el usuario inicio sesion

## Diccionario de Parametros

| Parametro | Tipo | Descripcion | Ejemplo |
|-----------|------|-------------|---------|
| `venue_slug` | string | Slug unico del bar | `"bar-la-esquina"` |
| `registration_time_sec` | number | Segundos desde que se abrio la pagina de registro hasta que se completo | `15` |
| `session_duration_sec` | number | Segundos desde el inicio de la sesion actual | `342` |
| `search_query` | string | Texto que busco el usuario | `"bad bunny"` |
| `results_count` | number | Numero de resultados devueltos | `8` |
| `has_results` | boolean | Si la busqueda devolvio al menos 1 resultado | `true` |
| `search_duration_ms` | number | Milisegundos que tardo la API en responder | `420` |
| `result_position` | number | Posicion (0-indexed) del resultado seleccionado en la lista | `2` |
| `total_results` | number | Total de resultados cuando se selecciono uno | `8` |
| `time_to_select_sec` | number | Segundos desde que aparecieron los resultados hasta que se selecciono uno | `4` |
| `submission_source` | string | Metodo usado para enviar la cancion: `"search"` o `"paste"` | `"search"` |
| `time_to_confirm_sec` | number | Segundos desde la primera busqueda hasta confirmar la cancion | `18` |
| `queue_position` | number | Posicion en la cola al confirmar | `3` |
| `youtube_id` | string | ID del video de YouTube | `"dQw4w9WgXcQ"` |
| `song_title` | string | Titulo del video | `"Rick Astley - Never..."` |
| `is_fallback` | boolean | Si es cancion de playlist de respaldo | `false` |
| `error_code` | string | Codigo de error de YouTube | `"BLOCKED"` |
| `expiry_reason` | string | Razon de expiracion de sesion: `"expired"`, `"not_found"` | `"expired"` |
| `admin_action` | string | Tipo de accion admin | `"skip_song"` |
| `song_id` | number | ID interno de la cancion | `42` |
| `table_number` | string | Identificador de mesa/usuario | `"A3F21B"` |
| `songs_cleared` | number | Canciones eliminadas al vaciar cola | `5` |
| `location` | string | Ubicacion en la interfaz donde ocurrio el clic | `"blog_sidebar"` |
| `ciudad` | string | Ciudad ingresada en el formulario de lead | `"Bogotá"` |
| `post_slug` | string | Slug identificador del articulo del blog | `"playlist-para-bares-restaurantes"` |
| `post_title` | string | Titulo completo del articulo del blog | `"Playlist para bares y restaurantes..."` |
| `reading_time_min` | number | Minutos estimados de lectura del post | `5` |
| `percent` | number | Hito de lectura alcanzado en el articulo | `50` |
| `share_platform` | string | Plataforma seleccionada para compartir | `"whatsapp"` |
| `cta_type` | string | Tipo de CTA del blog | `"demo_modal"` |

## Arquitectura

```
Frontend (Vue)
  |
  | window.dataLayer.push({ event: 'repitela_xxx', ... })
  v
Google Tag Manager (GTM-PPVKNTZB)
  |
  | Triggers: Custom Event → Tag GA4
  v
Google Analytics 4 (G-JFQN47GREE)
  |
  v
Reportes / Explorations
```

### Archivo fuente
- Helper: `frontend/src/utils/analytics.js`
- Todas las funciones de tracking son wrappers de `dataLayer.push()`

## Configuracion en GTM

### Importar contenedor
El archivo `docs/gtm-container.json` contiene la configuracion completa lista para importar en GTM:
1. Ir a GTM > Admin > Importar contenedor
2. Seleccionar `gtm-container.json`
3. Elegir "Combinar" > "Renombrar etiquetas, activadores y variables en conflicto"
4. Revisar y publicar

### Que incluye el contenedor
- **19 variables** de capa de datos (12 originales + 7 nuevas)
- **15 triggers** (13 originales + 2 nuevos: `search_result_selected`, `session_expired`)
- **16 tags** de GA4 (14 originales + 2 nuevos)

### Variables nuevas (v2)

| Variable GTM | Clave del dataLayer |
|-------------|---------------------|
| dlv - registration_time_sec | registration_time_sec |
| dlv - session_duration_sec | session_duration_sec |
| dlv - search_duration_ms | search_duration_ms |
| dlv - has_results | has_results |
| dlv - result_position | result_position |
| dlv - total_results | total_results |
| dlv - time_to_select_sec | time_to_select_sec |
| dlv - submission_source | submission_source |
| dlv - time_to_confirm_sec | time_to_confirm_sec |
| dlv - expiry_reason | expiry_reason |

### Variables originales (v1)

| Variable GTM | Clave del dataLayer |
|-------------|---------------------|
| dlv - venue_slug | venue_slug |
| dlv - youtube_id | youtube_id |
| dlv - song_title | song_title |
| dlv - queue_position | queue_position |
| dlv - search_query | search_query |
| dlv - results_count | results_count |
| dlv - error_code | error_code |
| dlv - is_fallback | is_fallback |
| dlv - admin_action | admin_action |
| dlv - song_id | song_id |
| dlv - table_number | table_number |
| dlv - songs_cleared | songs_cleared |

---

## Configuracion en GA4

### Paso 1: Dimensiones personalizadas (solo texto/categorias)

Ir a **GA4 > Administrar > Definiciones personalizadas > Dimensiones personalizadas > Crear dimension personalizada**

Las dimensiones son para valores de texto que usas para filtrar y agrupar (NO crear dimensiones para valores numericos/timings).

| Nombre de la dimension | Ambito | Descripcion | Parametro del evento |
|------------------------|--------|-------------|---------------------|
| Venue | Evento | Bar donde ocurrio el evento | `venue_slug` |
| YouTube ID | Evento | ID del video | `youtube_id` |
| Titulo cancion | Evento | Titulo del video | `song_title` |
| Accion admin | Evento | Tipo de accion del administrador | `admin_action` |
| Busqueda | Evento | Texto buscado por el usuario | `search_query` |
| Codigo error | Evento | Codigo de error de YouTube | `error_code` |
| Tiene resultados | Evento | Si la busqueda devolvio resultados | `has_results` |
| Fuente de envio | Evento | Metodo: busqueda o pegar link | `submission_source` |
| Razon de expiracion | Evento | Por que expiro la sesion | `expiry_reason` |
| Es fallback | Evento | Si es cancion de playlist de respaldo | `is_fallback` |
| Ubicacion Landing/Blog | Evento | Componente o seccion de origen del clic | `location` |
| Ciudad Lead | Evento | Ciudad del bar en formulario de lead | `ciudad` |
| Slug Articulo Blog | Evento | Identificador slug del articulo | `post_slug` |
| Titulo Articulo Blog | Evento | Titulo del post de blog | `post_title` |
| Plataforma Compartir | Evento | Red o canal donde se compartio el post | `share_platform` |
| Tipo CTA Blog | Evento | Accion CTA disparada en el blog | `cta_type` |

### Paso 2: Metricas personalizadas (solo valores numericos)

Ir a **GA4 > Administrar > Definiciones personalizadas > Metricas personalizadas > Crear metrica personalizada**

Las metricas son para valores numericos que quieres promediar, sumar, etc. **Un mismo parametro NO puede ser dimension y metrica a la vez.** Si ya creaste alguno de estos como dimension, primero archivalo en Dimensiones y luego crealo aqui.

| Nombre de la metrica | Descripcion | Parametro del evento | Unidad de medida |
|---------------------|-------------|---------------------|------------------|
| Tiempo de registro | Segundos que tardo el usuario en completar el registro | `registration_time_sec` | Segundos |
| Duracion de sesion custom | Segundos desde el inicio de la sesion del usuario | `session_duration_sec` | Segundos |
| Duracion de busqueda | Milisegundos que tardo la API de busqueda en responder | `search_duration_ms` | Milisegundos |
| Resultados de busqueda | Cantidad de resultados devueltos en una busqueda | `results_count` | Estandar |
| Posicion del resultado | Posicion del resultado seleccionado (0 = primero) | `result_position` | Estandar |
| Total de resultados | Total de resultados al momento de seleccionar | `total_results` | Estandar |
| Tiempo hasta seleccionar | Segundos desde que aparecen resultados hasta que elige uno | `time_to_select_sec` | Segundos |
| Tiempo hasta confirmar | Segundos desde la busqueda hasta confirmar la cancion en la cola | `time_to_confirm_sec` | Segundos |
| Posicion en cola | Posicion asignada en la cola al confirmar | `queue_position` | Estandar |
| Canciones limpiadas | Canciones eliminadas en accion de vaciar cola | `songs_cleared` | Estandar |
| Minutos lectura blog | Tiempo estimado de lectura del post | `reading_time_min` | Estandar |
| Porcentaje scroll blog | Hito de lectura alcanzado | `percent` | Estandar |

> **IMPORTANTE: Dimension vs Metrica — no se pueden duplicar**
>
> GA4 no permite que un mismo parametro de evento sea dimension Y metrica.
> Si ves el error "Ya hay una dimension o metrica registrada con este nombre de parametro",
> significa que ya lo creaste en el otro tipo. Ve a la lista correspondiente, archivalo, y crealo donde corresponde.
>
> **Regla rapida:**
> - Si el valor es texto (venue_slug, search_query, submission_source) → **Dimension**
> - Si el valor es numero que quieres promediar/sumar (tiempos, conteos, posiciones) → **Metrica**
>
> **Unidades disponibles en el desplegable:**
> - **Estandar** — para conteos simples (cantidad de resultados, posicion)
> - **Segundos** — para tiempos en segundos
> - **Milisegundos** — para tiempos en milisegundos
> - **Moneda** — no aplica aqui
> - **Moneda** — no aplica aqui

---

## Reportes Sugeridos en GA4

### Reporte 1: Funnel de Conversion (Busqueda → Cancion en Cola)

**GA4 > Explorar > Explorar embudos**

Pasos del embudo:
1. `repitela_session_started` — Usuario entra al bar
2. `repitela_song_searched` — Busca una cancion
3. `repitela_search_result_selected` — Selecciona un resultado
4. `repitela_song_submitted` — Envia la cancion al preview
5. `repitela_song_confirmed` — Confirma y la agrega a la cola

Dimensiones de desglose: `venue_slug`, `submission_source`

**Pregunta que responde:** Donde pierdes usuarios en el flujo? Buscan pero no seleccionan? Seleccionan pero no confirman?

---

### Reporte 2: Comportamiento de Busqueda

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `search_query`, `has_results` |
| Metricas | Recuento de eventos, Resultados de busqueda (promedio), Posicion del resultado (promedio), Tiempo hasta seleccionar (promedio) |
| Filtro | Nombre del evento = `repitela_song_searched` |

**Pregunta que responde:** Que buscan los usuarios? Cuantos resultados obtienen? Que busquedas no devuelven resultados?

---

### Reporte 3: Velocidad del Flujo (Cuanto les toma)

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `venue_slug` |
| Metricas | Tiempo de registro (promedio), Tiempo hasta seleccionar (promedio), Tiempo hasta confirmar (promedio) |
| Filtro | Nombre del evento = `repitela_song_confirmed` (para tiempos de cancion) o `repitela_user_registered` (para tiempo de registro) |

**Pregunta que responde:** Cuanto tarda un usuario en registrarse? Cuanto tarda en encontrar y poner una cancion? Hay diferencia entre bares?

---

### Reporte 4: Busqueda vs Pegar Link

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `submission_source` |
| Metricas | Recuento de eventos |
| Filtro | Nombre del evento = `repitela_song_submitted` |

**Pregunta que responde:** Los usuarios prefieren buscar o pegar links? Esto ayuda a decidir si priorizar la UX de busqueda o la de paste.

---

### Reporte 5: Posicion de Resultados Seleccionados

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `result_position` |
| Metricas | Recuento de eventos |
| Filtro | Nombre del evento = `repitela_search_result_selected` |

**Pregunta que responde:** Los usuarios siempre eligen el primer resultado? O bajan la lista? Si la posicion promedio es alta, los resultados de busqueda podrian mejorar.

---

### Reporte 6: Sesiones Expiradas

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `expiry_reason`, `venue_slug` |
| Metricas | Recuento de eventos, Duracion de sesion custom (promedio) |
| Filtro | Nombre del evento = `repitela_session_expired` |

**Pregunta que responde:** Cuantas sesiones expiran? Es por inactividad o por tiempo maximo? Cuanto duraban antes de expirar?

---

### Reporte 7: Top Busquedas Sin Resultados

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `search_query` |
| Metricas | Recuento de eventos |
| Filtro | Nombre del evento = `repitela_song_searched` AND `has_results` = `false` |

**Pregunta que responde:** Que buscan los usuarios y no encuentran? Estas busquedas son oportunidades de mejora en el motor de busqueda o contenido.

---

### Reporte 8: Performance General por Bar

**GA4 > Explorar > Formato libre**

| Config | Valor |
|--------|-------|
| Dimensiones | `venue_slug` |
| Metricas | Sesiones (session_started), Canciones (song_confirmed), Tiempo de registro (promedio), Tiempo hasta confirmar (promedio) |

**Pregunta que responde:** Comparar bares entre si. Cual tiene mas engagement? Cual tiene el flujo mas rapido?

---

## Expiracion de Sesiones

Las sesiones de usuario se expiran automaticamente bajo dos condiciones:

| Regla | Config (`.env`) | Default |
|-------|----------------|---------|
| Inactividad | `SESSION_INACTIVITY_MINUTES` | 120 min (2 horas) |
| Duracion maxima | `SESSION_MAX_HOURS` | 24 horas |

**Como funciona:**
- El frontend hace heartbeat cada 10s via `GET /api/auth/session`
- El backend actualiza `last_activity_at` en cada heartbeat
- Si la sesion excede los limites, el backend responde `401` y el frontend redirige al registro
- Al iniciar el servidor se limpian sesiones stale automaticamente

**Evento de analytics:** Cuando una sesion expira, se dispara `repitela_session_expired` con `expiry_reason` y `session_duration_sec`.

---

## Backend Analytics (Dashboard Admin)

El backend tambien registra eventos en la tabla `analytics_events` y calcula metricas para el dashboard de admin:

### Metricas del Dashboard

| Seccion | Metricas |
|---------|----------|
| **Resumen** | Total canciones, usuarios unicos, canciones unicas, largo promedio de cola, skip rate, error rate, fallback activations, nuevos vs recurrentes |
| **Busquedas** | Top 20 queries buscados, total busquedas, busquedas con resultados, promedio de resultados |
| **Funnel** | Total sesiones → confirmaciones, tasa de conversion |
| **Duracion de sesion** | Promedio y maximo en minutos |
| **Rankings** | Top 10 canciones, top 10 artistas, horas pico, top 10 usuarios |

### Endpoint
`GET /api/admin/analytics?period=week` (day/week/month/all)

---

## Verificacion

1. Abrir GTM en modo Preview (boton "Vista previa" en GTM)
2. Abrir la app en otra pestana
3. Registrarse como usuario, buscar cancion, seleccionar resultado, confirmar
4. Verificar que los eventos aparecen en el panel de debug de GTM con todos los parametros
5. Verificar en GA4 > Tiempo real que los eventos llegan
6. Esperar 24-48h para que los datos aparezcan en Explorar

### Checklist de parametros por evento

- [ ] `repitela_user_registered` → tiene `venue_slug`, `registration_time_sec`
- [ ] `repitela_song_searched` → tiene `search_query`, `results_count`, `has_results`, `search_duration_ms`
- [ ] `repitela_search_result_selected` → tiene `result_position`, `total_results`, `time_to_select_sec`
- [ ] `repitela_song_submitted` → tiene `submission_source`, `result_position`
- [ ] `repitela_song_confirmed` → tiene `queue_position`, `time_to_confirm_sec`
- [ ] `repitela_session_expired` → tiene `expiry_reason`, `session_duration_sec`
- [ ] Todos los eventos → tienen `venue_slug`, `session_duration_sec`

## Convención de UTM

Establecida el 2026-09-02 con el primer QR impreso. **No inventar otra**: si dos
piezas usan esquemas distintos, GA4 las cuenta como canales distintos y el
informe deja de servir.

| Parámetro | Qué significa | Valores en uso |
|---|---|---|
| `utm_medium` | El **tipo de canal**. Es el eje por el que se agrupa | `qr` |
| `utm_source` | La **pieza concreta** de donde viene | `sticker` |
| `utm_campaign` | La **tirada**, para distinguir lotes | `primeros-stickers` |

Con esa forma, GA4 agrupa por `medium=qr` todo el tráfico que entra escaneando
—stickers, portamenús, afiches— y luego se abre por `source` para ver cuál
funciona. Añadir una superficie nueva es un `source` nuevo, no un esquema nuevo.

`utm_campaign` nombra la tirada para poder comparar lotes. Se usa un nombre
legible (`primeros-stickers`) y no una fecha: en el informe de GA4 lo que se lee
es el nombre, y "de qué tirada era" se responde mejor con una palabra que con un
mes. Como vive en el redirect y no en el papel, se puede renombrar cuando haga
falta.

### Piezas vivas

| Pieza | Lo que lleva impreso | A dónde va | Archivos |
|---|---|---|---|
| Sticker 9×2,5 cm, QR de 2×2 cm, primera tirada | `https://repitela.com/s` | `/?utm_source=sticker&utm_medium=qr&utm_campaign=primeros-stickers` | `qr-sticker-caja-20mm.svg` (para arte final), `qr-sticker-20mm.svg` (sin caja), `qr-sticker-600.png` |

**La UTM no va impresa: va en el redirect** (`landing/nginx.conf`, `location = /s`).
Dos razones, y la segunda importa más que la primera:

1. **No cabe.** A 2×2 cm, la URL completa con UTM son 53 módulos = **0,33 mm por
   módulo**, por debajo de lo que un teléfono lee con fiabilidad. Bajar la
   corrección de errores a media da 0,41 mm, que sigue siendo justo para vinilo
   impreso. Con `/s` son 29 módulos y **0,54 mm**, cómodo.
2. **Un sticker impreso no se puede editar.** Con la UTM en el redirect, se
   puede renombrar la campaña, cambiar el destino o corregir un error **sin
   reimprimir nada**. Con la UTM impresa, el vinilo queda congelado para siempre.

Es un **302, no un 301**, a propósito: un 301 lo cachea el navegador de forma
permanente y dejaría de poderse cambiar el destino en los teléfonos que ya lo
escanearon.

### Medidas del sticker, para que no se interprete mal

Los **2 × 2 cm son la caja blanca completa, con la zona tranquila dentro**.
No el código solo. Si se toma como el código solo, la caja tendría que medir
**25,5 mm** y no cabría en un sticker de 25 mm de alto.

| Elemento | Medida |
|---|---|
| Caja blanca | 20 × 20 mm |
| Símbolo (los 29 módulos) | 15,7 mm |
| Zona tranquila | 2,2 mm por lado (= 4 módulos) |
| Un módulo | 0,54 mm |

`qr-sticker-caja-20mm.svg` ya viene con la caja blanca y las esquinas
redondeadas: se coloca a 20 × 20 mm y no hay nada que ajustar.

**En la versión negra del sticker, ese blanco no es decorativo.** Es lo que
separa el código del fondo oscuro; recortarlo para ganar espacio hace que
muchos lectores dejen de encontrarlo.

Nunca invertir el QR (módulos blancos sobre negro): buena parte de los lectores
no lo procesan.

**Para imprimir usar el SVG**, que ya viene dimensionado a 20 × 20 mm. El PNG de
600 px equivale a 762 dpi a ese tamaño y sirve de respaldo si la imprenta no
acepta vectores.

No confundir con el QR **de cada bar**, que es otra cosa: lo genera el sistema
por bar, va en las mesas y hoy depende de un servicio externo (WIL-201).
