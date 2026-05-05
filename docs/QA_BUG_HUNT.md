# QA Bug Hunt - Repitela

Casos de prueba derivados de [BUSINESS_RULES.md](BUSINESS_RULES.md), enfocados en **detectar bugs ahora**.
Cada caso tiene: BR vinculado, pasos, resultado esperado, **señales de bug** (que se vean cuando algo falla), y prioridad.

> **Estado actual:** 20/20 casos automatizables PASAN ([scripts/qa_bug_hunt.py](../scripts/qa_bug_hunt.py)).
> Los casos visuales (Kiosk + multi-vista) están planeados con Playwright en [QA_PLAYWRIGHT_PLAN.md](QA_PLAYWRIGHT_PLAN.md).
> Última actualización: 2026-05-05.

> Cómo usar: corre los casos en orden de prioridad (P0 → P2). Para cada uno, ten abiertos a la vez **Admin + Kiosk + Usuario** (3 ventanas/dispositivos) y observa los 3 simultáneamente — la mayoría de bugs son desincronizaciones entre estas vistas.

---

## P0 — Bloqueantes (núcleo de reproducción y cola)

### BH-01 · Sincronización de título del fallback (BR-12, BR-12a)
**Pasos:** Cola vacía → fallback empieza → esperar 30s → comparar título en Admin / Kiosk / Customer.
**Esperado:** Los 3 muestran el mismo título de canción.
**Señal de bug:** Admin muestra "Sonando automaticamente" genérico mientras Customer muestra el título real.
**Cobertura:** caché `_fallback_now_playing` + `/api/admin/queue` + WS `now_playing_changed`.

### BH-02 · Skip fallback con cola pendiente (BR-12b caso 2)
**Pasos:** Fallback sonando → usuario agrega 1 canción → admin click "Siguiente".
**Esperado:** Kiosk corta el fallback **inmediatamente** y empieza la canción de usuario. Admin/Customer muestran la canción de usuario como "sonando".
**Señal de bug:** (a) sigue sonando el fallback, (b) la canción de usuario desaparece de la cola sin sonar, (c) suena pero queda como "pending" en mis canciones.

### BH-03 · Skip fallback sin cola (BR-12b caso 3)
**Pasos:** Fallback sonando + cola vacía → admin click "Siguiente".
**Esperado:** Avanza a la siguiente canción aleatoria del fallback. Las 3 vistas se actualizan al nuevo título.
**Señal de bug:** (a) Kiosk se queda en silencio, (b) Admin/Customer muestran el título viejo, (c) repite la misma canción del fallback.

### BH-04 · Skip queue normal vuelve a fallback (BR-12, BR-13)
**Pasos:** 1 sola canción de usuario sonando + cola vacía → admin click "Siguiente".
**Esperado:** La canción se marca `played`, se libera el slot del usuario, fallback arranca automáticamente.
**Señal de bug:** (a) Kiosk en silencio, (b) usuario no recupera su slot (`rate_limit_reset` no llega), (c) admin sigue mostrando la canción que ya saltó.

### BH-05 · Fin natural durante fallback (BR-12b caso 1)
**Pasos:** Fallback sonando → usuario agrega canción → **NO** dar skip, esperar a que termine la canción del fallback.
**Esperado:** Al terminar el fallback, Kiosk arranca la canción del usuario automáticamente. La canción NO se ve como "sonando" mientras el fallback aún reproduce.
**Señal de bug:** (a) la canción aparece como "sonando" antes de tiempo (en Customer/Admin), (b) al terminar el fallback no arranca y se queda mudo, (c) suena el fallback en bucle ignorando la cola.

### BH-06 · Pausa/Resume coherente (BR-10, F11)
**Pasos:** (a) Admin pausa → ¿Kiosk pausa? ¿Customer no muestra estado contradictorio? (b) Reanudar desde Kiosk → ¿Admin se actualiza?
**Esperado:** Estado idéntico en las 3 vistas en <1s.
**Señal de bug:** Admin dice "PAUSADO" pero Kiosk sigue sonando, o viceversa.

### BH-07 · Botones transversales (regla unificada)
**Pasos:** En cada uno de estos estados, click "Siguiente" y "Pausar/Reanudar":
- (a) Solo fallback sonando
- (b) Fallback + 1 en cola
- (c) Canción de usuario sonando + cola vacía
- (d) Canción de usuario sonando + 2 en cola
- (e) Pausado en cualquiera de los anteriores

**Esperado:** Mismos botones funcionan en todos los estados sin necesidad de UI distinta.
**Señal de bug:** Botón "Siguiente" no hace nada en algún estado, o hace algo distinto a lo descrito en BR-12b.

### BH-08 · Deduplicación en cola activa (BR-08)
**Pasos:** Usuario A agrega `videoX` → Usuario B intenta agregar `videoX`.
**Esperado:** Error 409 "Esta canción ya está en la cola".
**Señal de bug:** Acepta el duplicado y queda 2 veces en cola.
**Bonus:** Esperar a que `videoX` se reproduzca y termine → mismo usuario vuelve a pedir → debe permitirse (BR-08 final).

### BH-09 · Race condition: doble Siguiente rápido
**Pasos:** Cola con 3 canciones → admin hace doble click rápido en "Siguiente".
**Esperado:** Salta exactamente 1 canción (botón con loading).
**Señal de bug:** Salta 2 canciones, o queue queda inconsistente, o slot de usuario no se libera.

### BH-10 · Auto-reproducción al confirmar con cola vacía (U8)
**Pasos:** Cola vacía + sin fallback → usuario confirma 1ra canción.
**Esperado:** Empieza a sonar inmediatamente, banner "TU CANCION ESTA SONANDO".
**Señal de bug:** Queda en "pending" pero no arranca; o arranca pero el banner sale en el usuario equivocado.

### BH-31 · Skip con cola pendiente devuelve la siguiente, NO None (BR-13a) ✅ automatizado
**Pasos:** 3 canciones de usuarios (1 playing + 2 pending) → admin click Siguiente.
**Esperado:** Backend devuelve `now_playing` con la 2da canción y promueve a `playing` en BD. Mismo invariante en el 2do click.
**Señal de bug:** Respuesta HTTP `now_playing: null` con BD que sí avanzó → admin/Kiosk piensan que la cola se vació y activan la playlist de respaldo aunque haya canciones pendientes.
**Contexto:** este bug existió en mayo 2026 — `_advance_queue` devolvía `None` por una línea `return` borrada accidentalmente. Caso de regresión permanente.

### BH-32 · finish_song con cola pendiente devuelve la siguiente (BR-13a) ✅ automatizado
**Pasos:** Cola con 1 playing + 1 pending → kiosk POST `/api/playback/finished` reportando que la canción terminó.
**Esperado:** Backend responde `next_song` con la canción pendiente, ya promovida a `playing`.
**Señal de bug:** `next_song: null` con BD avanzada → Kiosk activa fallback indebidamente.

### BH-33 · error_song con cola pendiente devuelve la siguiente (BR-13a) ✅ automatizado
**Pasos:** Cola con 1 playing + 1 pending → kiosk POST `/api/playback/error` con error_code 150.
**Esperado:** Canción con error queda `played`, video bloqueado en `blocked_videos`, slot del usuario liberado, `next_song` con la siguiente.
**Señal de bug:** Respuesta correcta del side-effect (slot/blocked) pero `next_song: null` → fallback indebido.

### BH-34 · skip + finish concurrentes — atomicidad (BR-13a) ✅ automatizado
**Pasos:** 3 canciones (1 playing + 2 pending). Disparar `admin/skip` y `playback/finished` para la canción actual en paralelo.
**Esperado:** Estado final consistente — exactamente 1 canción en `playing`, 1 o 2 en `played`, el resto `pending`. **Nunca 2 canciones en `playing` simultáneamente.**
**Señal de bug:** `playing_count > 1` (race promovió dos), o canciones perdidas (todo `played` con cola pendiente).

### BH-35 · Cancelar canción pendiente no rompe FIFO (BR-04) ✅ automatizado
**Pasos:** Cola: U1 playing, U2 pending #2, U3 pending #3 → U2 cancela su canción.
**Esperado:** Queda U1 playing + U3 pending. Cuando U1 termine, U3 arranca.
**Señal de bug:** Posiciones se duplican, U3 no avanza correctamente, o U2 queda fantasma en la cola.

---

## P1 — Importantes (rate limit, errores, sesión)

### BH-11 · Rate limit y liberación de slot (BR-05, U10)
**Pasos:** Configurar venue con `max_songs=2, window_minutes=30` → usuario agrega 2 canciones → 3ra debe rechazar (429) → esperar a que la 1ra termine → reintentar.
**Esperado:** `songs_remaining` pasa de 0 → 1 al terminar la canción. La 3ra ahora se acepta.
**Señal de bug:** Slot no se libera (queda en 0 indefinido), countdown muestra tiempo incorrecto.

### BH-12 · Error de video libera slot (BR-05 + F2)
**Pasos:** Llenar rate limit → la 1ra es un video con error de derechos.
**Esperado:** Modal de error al usuario, slot liberado, `songs_remaining` aumenta, video queda en `blocked_videos`.
**Señal de bug:** Slot no se libera al fallar; el video sigue apareciendo en búsquedas.

### BH-13 · Cancelar canción pendiente NO libera slot (U12)
**Pasos:** Usuario agrega canción → tocar X antes de que suene.
**Esperado:** Sale de cola, pero el slot **no** se devuelve (BR-05 lo cuenta por `submission_log`).
**Señal de bug:** Cancelar devuelve el slot (permite gaming del rate limit).

### BH-14 · FIFO estricto (BR-04)
**Pasos:** 3 usuarios distintos agregan en este orden: U1, U2, U3.
**Esperado:** Suenan U1 → U2 → U3, sin importar quién recargó la página o cuándo.
**Señal de bug:** Orden alterado (especialmente si hubo error/skip en medio).

### BH-15 · Reorden por admin no rompe FIFO interno (A7 + BR-04)
**Pasos:** Cola: U1, U2, U3, U4 → admin arrastra U4 a posición 1 → terminar canción actual.
**Esperado:** Suena U4, luego U1, U2, U3.
**Señal de bug:** Posiciones se corrompen; aparece duplicada o se salta una.

### BH-16 · Video bloqueado filtrado de búsqueda (U14, F2)
**Pasos:** Provocar error en `videoX` → buscar el mismo término después.
**Esperado:** `videoX` no aparece en resultados.
**Señal de bug:** Sigue apareciendo (filtro `blocked_videos` no aplica).

### BH-17 · Sesión kicked redirige a registro (A8, U17)
**Pasos:** Usuario activo → admin click "Kick" en su mesa.
**Esperado:** Customer recibe `session_kicked`, sale toast, redirige a `/registro` en <2s. Las canciones pendientes del usuario se eliminan de la cola.
**Señal de bug:** Usuario sigue viendo el dashboard, o las canciones quedan en cola "huérfanas".

### BH-18 · PIN diario válido/inválido (U2-U4 + BR-18-PIN)
**Pasos:** Activar PIN en venue → registrar sin PIN, con PIN incorrecto, con PIN correcto.
**Esperado:** Solo el correcto pasa. Los incorrectos dan 403 con mensaje claro.
**Señal de bug:** Acepta sin PIN cuando está activado, o el PIN del día no rota.

### BH-19 · Validación de duración (BR-09, U21)
**Pasos:** Configurar `max_duration_sec=180` → intentar agregar video de 5 min.
**Esperado:** Rechazo "supera el limite de 3 minutos".
**Señal de bug:** Acepta, o el límite usa default global ignorando config del venue.

### BH-20 · 3 errores consecutivos de fallback (K8)
**Pasos:** Forzar 3 errores seguidos en canciones del fallback.
**Esperado:** Fallback se detiene tras el 3ro, Kiosk muestra estado "esperando".
**Señal de bug:** Bucle infinito de errores, o se detiene antes/después del 3.

---

## P2 — Resiliencia, edge cases y UX

### BH-21 · Reconexión de WebSocket (U19, F4)
**Pasos:** Tener Kiosk reproduciendo → desconectar red 30s → reconectar.
**Esperado:** Kiosk sincroniza estado actual (no reinicia desde cero), no duplica eventos.
**Señal de bug:** Estado divergente, canción reinicia, eventos perdidos no se recuperan.

### BH-22 · Sesión expirada (BR-02, U16)
**Pasos:** Bajar TTL del JWT a 1 min para test → esperar → intentar agregar canción.
**Esperado:** 401 → redirige a `/registro`.
**Señal de bug:** Acepta token expirado, o queda en loop.

### BH-23 · Pausar fallback (A20, F12)
**Pasos:** Fallback sonando → admin "Pausar Fallback".
**Esperado:** Kiosk se detiene, Admin muestra "PLAYLIST PAUSADA", Customer limpia "now playing".
**Señal de bug:** Customer sigue mostrando canción obsoleta, o admin muestra "Sin reproducción" en vez de "Pausado".

### BH-24 · Reanudar fallback (A21)
**Pasos:** Tras BH-23 → click "Reanudar".
**Esperado:** Empieza nueva canción aleatoria del fallback (no la misma que estaba pausada).
**Señal de bug:** Reanuda en silencio, o repite la misma canción.

### BH-25 · Volumen sincronizado (A10, K9)
**Pasos:** Mover slider de volumen en Admin1 → abrir Admin2 (otro tab).
**Esperado:** Admin2 muestra el mismo valor.
**Señal de bug:** Cada admin tiene su propio valor, o Kiosk no aplica el cambio.

### BH-26 · Banner desaparece a los 3 min (A11)
**Pasos:** Enviar texto al banner → esperar 3 min.
**Esperado:** Texto se quita automáticamente del Kiosk.
**Señal de bug:** Persiste, o desaparece antes/después.

### BH-27 · Logo del venue en Kiosk + Admin (cambios visuales)
**Pasos:** Super admin sube logo nuevo → Admin existente recarga → Kiosk recarga.
**Esperado:** Las 3 vistas usan el logo nuevo.
**Señal de bug:** Logo en caché 404, o vista admin no actualiza tras `refreshAdminInfo`.

### BH-28 · Múltiples usuarios concurrentes (E2)
**Pasos:** 3 usuarios distintos confirman canción en el mismo segundo.
**Esperado:** Las 3 entran a la cola, posiciones consecutivas, sin colisiones de `position`.
**Señal de bug:** 2 canciones con misma `position`, o alguna se pierde.

### BH-29 · Click duplicado en confirmar (E6)
**Pasos:** Tocar "Confirmar" 2 veces en <500ms.
**Esperado:** Solo 1 canción en cola.
**Señal de bug:** Aparece 2 veces (BR-08 debe atrapar el duplicado).

### BH-30 · Thumbnails con DNS bloqueado
**Pasos:** Bloquear `i.ytimg.com` en hosts/extension → recargar Admin.
**Esperado:** Imagen rota muestra placeholder, no rompe layout, no spam de errores en consola.
**Señal de bug actual:** Lista interminable de `ERR_NAME_NOT_RESOLVED` y placeholders rotos visibles.

---

## P3 — Awareness y feedback (UX nueva, requiere navegador)

### BH-40 · Badge unificado de estado en admin (BR-19)
**Pasos:** Recorrer los 8 estados configurando cada uno (cola vacía sin fallback, fallback sonando, fallback pausado, usuario sonando, pausado, etc.).
**Esperado:** El badge muestra exactamente 1 etiqueta de las 8 definidas en BR-19, con el color correcto.
**Señal de bug:** Estado ambiguo (ej. dice "SONANDO USUARIO" pero el Kiosk muestra el fallback), o el badge se queda en un estado obsoleto tras una transición.

### BH-41 · Toast en cada acción del admin (BR-21)
**Pasos:** Para cada acción admin (skip, pausa, resume, fallback play/pause/skip, play-now, remove, kick, reset, banner, QR, volumen):
1. Click con backend up → toast verde con mensaje específico
2. Click con backend caído (parar uvicorn) → toast rojo "X: error de red"
3. Click con respuesta 4xx (ej. agregar video bloqueado) → toast rojo con `detail` del backend
**Esperado:** Toast aparece para los 3 escenarios. Loading desaparece. UI optimista revierte en error.
**Señal de bug:** Acción falla silenciosamente, loading se queda spinning, o UI optimista queda en estado mentiroso (ej. "Pausado" cuando el backend nunca recibió la pausa).

### BH-42 · Confirmación en acciones destructivas (BR-21)
**Pasos:** Click "Expulsar" en una mesa, click "Vaciar cola".
**Esperado:** Diálogo `confirm()` antes de ejecutar. Cancel en el diálogo no envía petición.
**Señal de bug:** Acción se ejecuta sin pregunta → kick accidental por click errado.

### BH-43 · Indicador WS admin (BR-22)
**Pasos:** Admin abierto → matar backend (`Stop-Process` uvicorn) → esperar 2s → arrancar de nuevo.
**Esperado:** Pill "Conectado" verde → "Reconectando…" rojo pulsante → toast "Conexión perdida — reintentando…" → al volver: pill verde + toast "Conexión restaurada".
**Señal de bug:** Pill se queda en verde mintiendo, o no hay toast en transiciones.

### BH-44 · Banner WS customer (BR-22)
**Pasos:** Cliente registrado → matar backend → observar 2s → restaurar.
**Esperado:** Banner rojo sticky "Sin conexión — reintentando…" aparece tras 2s. Desaparece al reconectar + toast verde.
**Señal de bug:** Banner aparece inmediatamente (flickea en reconexiones rápidas), o no aparece nunca.

### BH-45 · Notificación "tu canción es la siguiente" (BR-20)
**Pasos:** 3 usuarios con canciones en cola. Cuando #2 sube a #1 (porque #1 termina/se salta), su cliente recibe toast.
**Esperado:** Toast verde 6s `🎵 Tu canción es la siguiente: "X"`. Solo se emite **una vez** por canción (set `notifiedNextUp`).
**Señal de bug:** Spam de toast en cada poll mientras posición siga en 1, o no aparece nunca.

### BH-46 · Notificación de progreso de posición (BR-20)
**Pasos:** Cliente con canción en posición #4 → admin elimina las 2 anteriores → cliente queda en #2.
**Esperado:** Toast info `Subiste a #2: "X"` al detectar el cambio en `mySongs`.
**Señal de bug:** Sin toast, o toast con posición vieja, o toast de bajada (no debería notificar bajadas).

### BH-47 · Slot liberado al usuario (BR-20)
**Pasos:** Usuario con rate limit lleno → su canción termina o tiene error → cliente recibe toast.
**Esperado:** Toast info `Slot liberado — puedes pedir otra canción` y `songs_remaining` aumenta visiblemente.
**Señal de bug:** Slot se libera en backend pero el cliente no se entera hasta que pollee 30s después.

---

## Cobertura por BR (matriz)

✅ = automatizado en `scripts/qa_bug_hunt.py` · 🌐 = requiere Playwright/manual

| BR | Casos |
|----|-------|
| BR-01/02 (registro/sesión) | BH-17 🌐, BH-18 🌐, BH-22 🌐 |
| BR-04 (FIFO) | BH-14 ✅, BH-15 🌐, BH-28 ✅, BH-35 ✅ |
| BR-05 (rate limit) | BH-11 ✅, BH-12 ✅, BH-13 ✅ |
| BR-06/07 (validación URL) | BH-29 ✅ |
| BR-08 (dedupe) | BH-08 ✅, BH-08b ✅, BH-29 ✅ |
| BR-09 (duración) | BH-19 ✅ |
| BR-10 (admin) | BH-06 🌐, BH-07 🌐, BH-15 🌐, BH-25 🌐 |
| BR-12 / 12a / 12b (fallback) | BH-01..05 🌐, BH-07 🌐, BH-20 🌐, BH-23/24 🌐 |
| **BR-13a (contrato skip/finish/error)** | **BH-04 ✅, BH-31 ✅, BH-32 ✅, BH-33 ✅, BH-34 ✅** |
| BR-13b (skip durante fallback) | BH-02 🌐 |
| BR-14 (notif "tu canción sonando") | BH-10 ✅, BH-45 🌐 |
| BR-18 (QR/PIN) | BH-18 🌐 |
| **BR-19 (badge unificado admin)** | **BH-40 🌐** |
| **BR-20 (notif progreso usuario)** | **BH-45 🌐, BH-46 🌐, BH-47 🌐** |
| **BR-21 (toast feedback admin)** | **BH-41 🌐, BH-42 🌐** |
| **BR-22 (awareness conexión WS)** | **BH-21 🌐, BH-43 🌐, BH-44 🌐** |

---

## Setup recomendado para una sesión de hunt

1. **Venue de prueba** con `window_minutes=5, max_songs=3, max_duration_sec=300` para iterar rápido.
2. **3 ventanas abiertas:** Admin, Kiosk (en pantalla completa), Customer (en otro device o ventana incógnito).
3. **DevTools abierto en las 3** → tab Network + Console → ver eventos WS y errores.
4. **Playlist de respaldo con 3-4 canciones** (mínimo viable para BR-12a).
5. **2 usuarios distintos** registrados (para BH-08, BH-14, BH-28).

## Bugs históricos resueltos

- ✅ Admin perdía título del fallback tras 30s de polling ([admin.py:104](../backend/app/routers/admin.py#L104), [AdminDashboard.vue:185](../frontend/src/views/AdminDashboard.vue#L185)).
- ✅ `/api/queue/songs/confirm` no validaba duración — cliente podía saltar el preview con un yt_id ya cacheado y meter una canción que excedía `max_duration_sec`. Fix en [queue.py:185-194](../backend/app/routers/queue.py#L185-L194). Cubierto por BH-19.
- ✅ Race condition en `add_song` — `SELECT MAX(position)+1` y el INSERT no eran atómicos. 3 confirms concurrentes producían `[1,2,2]`. Violaba BR-04. Fix con `asyncio.Lock` + dedupe re-check ([queue_service.py:13-20, 100-138](../backend/app/services/queue_service.py#L13-L20)). Cubierto por BH-28, BH-29.
- ✅ Doble-skip y skip+finish concurrentes podían promover dos canciones a `playing` o perder canciones. Fix con `_playback_lock` + UPDATE condicional en `skip_song`/`finish_song`/`error_song` ([playback_service.py:13-19](../backend/app/services/playback_service.py#L13-L19)). Cubierto por BH-09, BH-34.
- ✅ **CRÍTICO** `_advance_queue` devolvía `None` por una línea `return` borrada accidentalmente al refactorizar para el lock — admin/Kiosk creían que la cola estaba vacía y activaban fallback aunque hubiera canciones de usuarios pendientes. Fix: restaurar el return en [playback_service.py:209](../backend/app/services/playback_service.py#L209). **Caso de regresión permanente: BH-31, BH-32, BH-33.**

## Bugs abiertos

- ⚠️ Thumbnails rotos cuando red bloquea `i.ytimg.com` (ver BH-30) — falta `@error` con placeholder.

## Suite automatizada

[scripts/qa_bug_hunt.py](../scripts/qa_bug_hunt.py) corre todos los casos de API (no requiere navegador):

- Crea venue limpio `qa-test` con `max_songs=3, window=5, max_duration=300`
- Pre-cachea metadata en `song_metadata` para evitar llamadas a YouTube API
- 20 chequeos cubriendo todos los BR automatizables:
  - **Núcleo cola** (BR-04, BR-08, BR-12b, BR-13, BR-13a): BH-04, BH-08, BH-08b, BH-09, BH-10, BH-14, BH-31, BH-32, BH-33, BH-34, BH-35
  - **Rate limit** (BR-05): BH-11, BH-11b, BH-12, BH-12b, BH-13
  - **Validación** (BR-09, BR-08): BH-19, BH-29
  - **Concurrencia** (BR-04): BH-28

```powershell
# Backend debe estar arriba en :8000
cd e:\code\Music-video
backend\venv\Scripts\python.exe scripts\qa_bug_hunt.py
```

Para los casos visuales (Kiosk + YouTube + 3 vistas simultáneas, awareness/UX), ver [QA_PLAYWRIGHT_PLAN.md](QA_PLAYWRIGHT_PLAN.md).

---

## Comportamiento esperado del sistema (resumen ejecutivo)

> Este es el "norte" del sistema. Si algo no se siente así, hay un bug.

### El admin siempre sabe qué está pasando

1. **Un solo badge** (BR-19) le dice si está sonando un usuario, la playlist, está pausado, o sin conexión.
2. **Un toast por cada acción suya** (BR-21) confirma éxito o le grita el error — nunca silenciosa.
3. **Un indicador WS** (BR-22) le avisa cuando los datos pueden estar viejos.
4. **Acciones destructivas** (kick, vaciar) piden confirmación.

### Las canciones nunca se pierden

1. **Skip** (BR-13a): siempre devuelve la siguiente canción si hay pendientes; nunca `None` con cola llena.
2. **Finish** y **Error** (BR-13a): mismo contrato — si hay pendientes, devuelven la siguiente.
3. **Operaciones atómicas** (`_playback_lock`): doble click o eventos simultáneos nunca duplican `playing` ni borran canciones.
4. **Idempotencia**: un `UPDATE` que ya pasó no rompe el estado.
5. **Skip durante fallback con cola** (BR-13b): conmuta inmediatamente a la canción de usuario, sin esperar fin natural del fallback, sin perder la canción si el evento `fallback_skip` se pierde (mecanismo `pendingUserSong`).

### El usuario sabe el progreso de su pedido

1. **Confirma canción** → toast con la posición (`#3` o "eres la siguiente" si cae en #1).
2. **Sube en la cola** → toast `Subiste a #2: "X"` (BR-20).
3. **Queda como siguiente** → toast `🎵 Tu canción es la siguiente` (BR-20, una sola vez).
4. **Empieza a sonar** → toast + browser notification (BR-14).
5. **Slot liberado** → toast `Slot liberado — puedes pedir otra` (BR-20).
6. **Conexión cae** → banner sticky rojo (BR-22).
7. **Errores** → toasts rojos con mensaje específico, no strings tirados al limbo.

### Los botones funcionan igual en cualquier estado (BR-12b, BR-13b)

- **Siguiente** sirve para usuario sonando, fallback sonando con cola, fallback solo, sin cola.
- **Pausar/Reanudar** afecta lo que sea que esté sonando (usuario o fallback).
- El admin no tiene que pensar "¿qué botón uso ahora?" — son transversales.
