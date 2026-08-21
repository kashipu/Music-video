# Ideas de producto: viabilidad y diseño

> Backlog de ideas evaluadas sobre el código actual (2026-08-21).
> Complementa `docs/PLAN_MEJORAS_ESCALA.md` (fixes + suscripciones + escalada).
>
> **Veredicto global: las 11 ideas son posibles.** Una ya está implementada (#5),
> el chatbot (#9) se diseña con la API oficial de WhatsApp (Baileys descartado por
> riesgo de baneo), y una necesita abogado además de código (#8). Ninguna
> requiere cambiar de stack.

**Esfuerzo**: S = días · M = 1-3 semanas · L = 1-2 meses

---

## Mapa de dependencias

```
Fixes P0/P1 (PLAN_MEJORAS_ESCALA.md)
 ├── #1 Journey + alertas + salud     (necesita la tarea de fondo P1.2)
 ├── #4 Algoritmo de playlist         (necesita el fix P0.1: hoy las búsquedas NO se guardan)
 └── #2 Registro autogestionado + Wompi  ← LA PIEZA CENTRAL
      ├── #3 Personalización, publicidad y redes sociales (add-on cobrable)
      ├── #6 Cupones en el teléfono (add-on cobrable)
      ├── #10 Repítela para fiestas (nuevo plan B2C)
      └── #11 Carta digital (add-on cobrable; v1-link no depende de nada)
#5 ya existe · #7 independiente · #8 independiente (legal) · #9 independiente (canal de ventas)
```

---

## #1 — Centro de control superadmin: journey, alertas y salud de los bares

**Veredicto: POSIBLE — esfuerzo M-L.** Los datos ya se capturan
(`analytics_events`, `user_sessions`, `play_history`); falta agregarlos y
convertir el panel superadmin en un **centro de control de toda la red**: la
vista desde donde se opera el negocio completo, no solo un CRUD de venues.

**Diseño propuesto — dos niveles:**

**Nivel red (la vista de "mi negocio"):**
- **Tablero general**: bares activos ahora, usuarios conectados en toda la
  red, canciones sonando, ingresos del mes (cuando exista #2), bares en
  trial / gracia / suspendidos, mapa o lista ordenada por actividad.
- **Alertas operativas**: tabla `superadmin_alerts` + reglas en el job
  nocturno y en tiempo real: "bar X se conectó hoy por primera vez",
  "bar Y lleva 2 días sin actividad", "bar Z con tasa de error > 20%",
  "pago de W vence en 3 días", "kiosko de V desconectado en horario de
  apertura". Canal: campana en el panel + WhatsApp/email al superadmin.
- **Feed de actividad**: línea de tiempo de la red (registros, pagos,
  desconexiones, picos) para entrar en la mañana y ver qué pasó anoche.

**Nivel bar (drill-down por venue):**
- **Salud del bar** (semáforo): kiosko conectado (el kiosko ya hace polling a
  `/now-playing` cada 10 s → registrar `last_kiosk_seen_at` por venue),
  última canción reproducida, tasa de errores de video, sesiones activas,
  estado de pago. Verde / amarillo / rojo.
- **Resumen diario**: job nocturno (la tarea de fondo P1.2) que materializa
  una fila por venue/día en `venue_daily_stats` (usuarios únicos, canciones,
  búsquedas, errores, horas pico). Evita recalcular sobre `analytics_events`
  en cada carga y sobrevive a la poda de eventos. "¿Cuántos usuarios tuvo el
  bar X ayer?" se responde con un SELECT a esta tabla.
- **Journey por usuario**: ya existe la cadena de eventos
  (`session_started` → `song_searched` → `song_confirmed` → `song_played`).
  Un endpoint que la reconstruya por `session_id` y la muestre como línea de
  tiempo: dónde entra la gente, dónde abandona, cuánto tarda en pedir su
  primera canción. *Depende del fix P0.1 para que `song_searched` se guarde.*
- Acceso directo a las analíticas que ya existen (`/api/admin/analytics`)
  vistas como superadmin, sin pedirle credenciales al bar.

---

## #2 — Registro autogestionado, trials, códigos de descuento y Wompi

**Veredicto: POSIBLE — esfuerzo L. Es la pieza central: sin esto, nada de lo
cobrable (#3, #6, #10) se puede vender.** El modelo de datos base
(`plans`, `subscriptions`, `payments`, `billing_notifications`) ya está
diseñado en `PLAN_MEJORAS_ESCALA.md`; esto lo extiende.

**Diseño propuesto:**
- **Registro público del bar**: formulario → verifica email/teléfono → crea
  `venue` + `admin` + suscripción en estado `trial`, todo en una transacción.
  El bar entra directo a un onboarding guiado (logo, playlist de respaldo,
  imprimir QR, probar el kiosko).
- **Trials de 7 / 15 / 30 días**: campo `trial_days` en el código de invitación
  o en el plan. La app funciona completa durante el trial; al vencer pasa a
  `suspended` (los puntos de corte ya existen en `register_user` y
  `admin_login`).
- **"Cuánto tiempo me queda"**: banner permanente en el panel del admin con
  `current_period_end` (y días de trial restantes). Endpoint
  `GET /api/admin/subscription`.
- **Códigos de descuento**: tabla `discount_codes` (`code`, `type`:
  porcentaje/monto/días-gratis, `max_uses`, `valid_until`, `plan_id`
  opcional) + tabla `code_redemptions` (única por venue). Se aplica en el
  checkout.
- **Wompi**: checkout con link/widget de Wompi → webhook
  `POST /api/billing/webhook/wompi` con **verificación de firma de eventos** e
  idempotencia por referencia de transacción → registra en `payments` →
  activa/extiende la suscripción. Wompi cobra ~2,65 % + IVA + fijo por
  transacción; soporta Nequi, PSE, tarjetas — ideal para bares colombianos.
- **Habilitación al pagar**: el estado del venue se deriva de la suscripción;
  el webhook de pago aprobado es lo único que mueve `trial/grace/suspended`
  → `active`. Avisos automáticos de vencimiento: ya diseñados en
  `PLAN_MEJORAS_ESCALA.md` (job + `billing_notifications`).

---

## #3 — Vender personalización y publicidad en las pantallas

**Veredicto: POSIBLE — esfuerzo S-M.** La mitad ya existe: `banner_text`,
logo, tema por venue, mostrar/ocultar marca. Falta empaquetarlo y cobrarlo.

**Diseño propuesto:**
- **Personalización como feature de plan**: tema completo, logo prominente,
  ocultar marca Repítela → flags en `plans.features` (plan Pro).
- **Promos programadas en pantalla**: tabla `screen_promos` (`venue_id`,
  imagen o texto+estilo, `starts_at`, `ends_at`, días/horas de la semana,
  prioridad). El kiosko ya recibe eventos por WebSocket (`banner_changed`) —
  se extiende a un carrusel de promos entre canciones o en franja fija.
- **Publicidad de terceros** (marcas): mismo motor de `screen_promos` con
  `advertiser` distinto del venue y reportes de impresiones (el kiosko
  reporta qué promo mostró). Vender por red de pantallas cuando haya volumen.
- **Redes sociales del bar en la vista del usuario** (parte de la
  personalización): bloque "Síguenos" en la pantalla del cliente con
  Instagram / TikTok / Facebook / WhatsApp del bar. Se guarda en
  `venues.config.social` (mismo patrón que logo y tema) y se edita desde el
  panel del bar.
  - **Atribución conservada para Repítela, en dos sentidos**: (a) la marca
    Repítela permanece visible en la vista aunque el bar personalice todo lo
    demás, y (b) cada tap se registra como evento `social_click` en
    `analytics_events` y los links salen con UTM
    (`utm_source=repitela&utm_medium=app&utm_campaign=<slug>`), de modo que
    puedes **demostrarle al bar cuántos seguidores y visitas le llevó
    Repítela** — es el argumento de venta del add-on y aparece en el reporte
    del bar y en el centro de control (#1).
- **Cobro**: add-on mensual sobre la suscripción (#2) o incluido en plan Pro.

---

## #4 — Algoritmo de playlist de respaldo por género y recurrencia

**Veredicto: POSIBLE — esfuerzo M.** Todos los insumos existen o están a un
fix de distancia.

**Insumos y sus estados:**
| Insumo | Estado |
|---|---|
| Historial de reproducción por bar (`play_history`) | ✅ existe y se conserva |
| Búsquedas por bar | ❌ hoy NO se guardan (bug P0.1) — **arreglar primero** |
| Género por canción | ⚠️ pobre (`genre` = categoryId de YouTube); enriquecer con IA en batch (Haiku, centavos por catálogo — ver roadmap de IA) |
| Recurrencia | ✅ derivable de `play_history` (veces pedida, por franja horaria) |

**Diseño propuesto:**
- Job nocturno por venue: score por canción =
  `w1·veces_pedida + w2·veces_buscada + w3·afinidad_de_género_del_bar −
  w4·tasa_de_skip`, con ventana de recencia (lo de los últimos 30 días pesa
  más). Género del bar = distribución de géneros de su `play_history`.
- Salida: reordena/regenera `fallback_songs` del venue (respetando las que el
  admin fijó a mano — añadir flag `pinned`).
- Variante por franja: playlist distinta para tarde vs. noche usando la hora
  de `play_history`.
- v1 es SQL + pesos (sin IA en el camino crítico); la IA solo enriquece
  género/mood offline.

---

## #5 — No mostrar en búsquedas los videos que ya sabemos que fallan

**Veredicto: YA EXISTE.** Implementado en `queue.py:17-32`: los resultados de
`/api/queue/search` se filtran contra `blocked_videos`, y el bloqueo también
se aplica en submit y confirm. Los videos entran a `blocked_videos`
automáticamente cuando el kiosko reporta error de reproducción.

**Ajustes pendientes (S):**
- Decidir si el bloqueo es global o por bar: hoy el índice único es solo por
  `youtube_id`, así que un error en un bar bloquea el video para todos
  (hallazgo de la revisión — probablemente correcto para errores de
  copyright, pero confirmarlo).
- Umbral opcional: bloquear tras N errores (no al primero) para errores
  transitorios, distinguiendo por `error_code`.
- Panel superadmin para ver/desbloquear videos.

---

## #6 — Cupones del bar en el teléfono del cliente ("muéstralo en la barra")

**Veredicto: POSIBLE — esfuerzo M.** Monetizable como add-on (depende de #2
para cobrarlo).

**Diseño propuesto:**
- Tablas `coupons` (`venue_id`, título, descripción, condiciones, `starts_at`,
  `ends_at`, `max_redemptions`, segmento objetivo) y `coupon_redemptions`
  (`coupon_id`, `user_id`, `redeemed_at`, único por usuario).
- Al cliente le aparece el cupón en su pantalla de la cola; al tocarlo se
  muestra una vista de canje con código corto de 4-6 caracteres o QR + reloj
  animado (anti-captura). El mesero lo valida de vista o el admin lo marca
  canjeado desde su panel (un tap) — sin hardware nuevo.
- Segmentación simple con datos que ya hay: todos, primera visita
  (`user_registered`), recurrentes (`user_returned`), el "DJ de la noche".
- Reporte para el bar: emitidos / vistos / canjeados → es el argumento de
  venta del add-on ("trajiste 40 consumos este mes").

---

## #7 — Comunidad: me gusta / votos a canciones para promoverlas en la cola

**Veredicto: POSIBLE — esfuerzo M.** El tiempo real ya está resuelto
(WebSocket por venue); es modelo de datos + reglas anti-abuso.

**Diseño propuesto:**
- Tabla `song_votes` (`queue_song_id`, `user_id`, `value` +1, único por
  usuario/canción). Broadcast `song_voted` → contadores en vivo en todos los
  teléfonos y en la pantalla.
- **Efecto en la cola, con reglas** (para no romper la equidad BR-04):
  los votos NO saltan la cola libremente; a partir de N votos la canción sube
  máximo K posiciones, nunca por encima de una que ya subió por votos esa
  ronda. Configurable por venue (el admin puede apagarlo).
- Anti-abuso: solo usuarios con sesión activa en ese venue, 1 voto por
  canción, límite de votos por ventana.
- Extensiones naturales: "me gusta" a la que está sonando (feedback para el
  algoritmo de #4 y para el "DJ de la noche"), historial de likes del usuario
  como su "perfil musical" en ese bar (semilla de comunidad).

---

## #8 — Términos y condiciones, cookies y ley colombiana

**Veredicto: POSIBLE Y NECESARIO — esfuerzo técnico S, pero el texto legal
debe redactarlo/revisarlo un abogado.** No es opcional: se recolectan datos
personales (teléfonos) y se envían mensajes.

**Marco aplicable (Colombia):**
- **Ley 1581 de 2012 + Decreto 1377 de 2013** (Habeas Data): política de
  tratamiento de datos publicada, finalidades explícitas, derechos ARCO
  (acceso, rectificación, cancelación, oposición), y autorización previa e
  informada.
- **Consentimiento separado por finalidad**: hoy `data_consent` es un booleano
  único. Debe separarse: (a) operación del servicio, (b) marketing del bar,
  (c) marketing de Repítela. Guardar **versión del texto aceptado + timestamp**
  por usuario (tabla `consent_log`).
- **Registro Nacional de Bases de Datos (SIC)**: verificar si aplica según el
  tamaño de la sociedad (hoy aplica a sociedades con activos > umbral —
  confirmar con el abogado).
- **Cookies**: la landing ya usa GTM (`docs/ANALYTICS.md`); falta banner de
  consentimiento que condicione los tags de analítica/marketing (GTM consent
  mode) y página de política de cookies.
- **Menores**: bares = mayores de edad; declararlo en T&C.

**Técnico:** páginas T&C/privacidad versionadas, checkbox por finalidad en el
registro, `consent_log`, banner de cookies, endpoint de solicitud de
eliminación de datos (derecho de supresión).

---

## #9 — Chatbot de WhatsApp para capturar leads y vender la app

**Veredicto: POSIBLE — esfuerzo M. Con WhatsApp Business Cloud API (la API
oficial de Meta).**

**Diseño propuesto:**
- **Canal**: WhatsApp Business Cloud API. Costo: el tier de servicio es
  gratis dentro de la ventana de 24 h de conversación iniciada por el usuario
  (los leads entrantes son exactamente eso); las plantillas salientes de
  marketing se pagan (~USD 0,01-0,05/mensaje). Número verificado y estable —
  es un activo del negocio.
- **Webhook de mensajes entrantes** → endpoint en el backend FastAPI (encaja
  natural con la arquitectura actual).
- **Bot con IA**: Claude Haiku 4.5 con un prompt que conoce la app, los
  planes, precios y objeciones frecuentes + tool use para: guardar el lead
  (tabla `leads`: teléfono, nombre, bar, ciudad, etapa del funnel), agendar
  demo, y enviar el link de registro con trial (#2). Costo IA: centavos por
  conversación. Escalamiento a humano con palabra clave o cuando el bot
  detecta intención de compra caliente.
- **Sinergia**: el mismo número y la misma integración sirven después para
  los avisos de pago (#2), las campañas de cupones (#6) y las alertas al
  superadmin (#1).
- Los leads capturados alimentan el centro de control (#1): funnel de ventas
  visible junto a la operación.

> Nota: se descartó Baileys (librería no oficial de WhatsApp Web): viola los
> términos de servicio de WhatsApp y Meta banea los números que la usan —
> inaceptable para el número comercial de ventas.

---

## #10 — Repítela para fiestas (B2C, 2 días)

**Veredicto: POSIBLE — esfuerzo S-M una vez exista #2. Muy buena idea: usa
el 100% del producto existente con otro empaque.**

**Diseño propuesto:**
- Nuevo tipo de plan `party` en `plans`: precio único (no recurrente),
  `period_days = 2` (o variantes 1/2/3 días).
- Flujo express: "Crea tu fiesta" → nombre del evento → pago Wompi → venue
  efímero listo con QR descargable/compartible + link del kiosko para el
  TV de la casa (Chromecast/smart TV con navegador).
- Diferencias vs. bar: sin PIN diario por defecto, límites más laxos
  (configurables), sin facturación recurrente, y `expires_at`: al vencer, el
  venue pasa a `archived` (el job nocturno lo limpia).
- El modelo multi-tenant actual soporta venues efímeros sin cambios de
  esquema — es un venue con suscripción de tipo distinto.
- Sinergia: es un funnel hacia el B2B ("¿te gustó en tu fiesta? Móntalo en tu
  bar") y viceversa (el bar puede regalar códigos de fiesta a clientes).

---

## #11 — Carta digital del bar (servicio adicional)

**Veredicto: POSIBLE — esfuerzo S en v1, M en v2. Add-on cobrable natural
(depende de #2 para venderlo).**

**Diseño propuesto — dos niveles:**
- **v1 — Link a la carta (S, días)**: campo `menu_url` en `venues.config`. En
  la vista del usuario aparece el botón "Ver la carta" junto al bloque de
  redes; abre la carta que el bar ya tenga (PDF, link de terceros, etc.).
  Cada tap se registra como evento `menu_click` — misma lógica de atribución
  que las redes (#3): puedes mostrar cuántas veces se consultó la carta
  desde Repítela. Incluible en cualquier plan como gancho.
- **v2 — Carta digital alojada por Repítela (M, cobrable)**: módulo propio:
  tablas `menu_categories` y `menu_items` (`venue_id`, nombre, descripción,
  precio, foto, disponible, orden), página pública `/{slug}/carta` con el
  tema del bar, editable desde el panel del admin, con su propio QR. El bar
  deja de pagar otra herramienta de carta digital y lo tiene todo en un solo
  lugar y un solo QR.
- **Sinergias**: los cupones (#6) pueden enlazar productos de la carta
  ("2x1 en este coctel"); las promos de pantalla (#3) también; los taps a la
  carta alimentan el centro de control (#1). A futuro, "lo más visto de la
  carta" es un dato que ningún bar tiene hoy.
- Fuera de alcance (por ahora): pedidos y pagos desde la carta — eso es un
  producto entero (comandas, cocina); la carta es solo consulta.

---

## Priorización sugerida

| Orden | Idea | Por qué |
|---|---|---|
| 1 | **#2** Registro + trials + Wompi | Desbloquea todo lo cobrable; es el negocio |
| 2 | **#5** (ajustes) + **#1** salud/alertas | Baratos, mejoran operación diaria ya |
| 3 | **#3** promos + redes sociales + **#11 v1** link a carta + **#7** votos | Valor visible para bar y usuarios; redes y link-carta son días de trabajo |
| 4 | **#8** legal | Antes de crecer en usuarios y de campañas de marketing |
| 5 | **#9** chatbot WhatsApp (Cloud API) | Motor de adquisición para vender #2 |
| 6 | **#6** cupones + **#4** algoritmo playlist + **#11 v2** carta alojada | Add-ons de retención/upsell |
| 7 | **#10** fiestas | Nueva línea B2C sobre lo ya construido |

> Recordatorio transversal: los fixes P0/P1 y la tarea de fondo de
> `PLAN_MEJORAS_ESCALA.md` son prerequisito de #1 y #4, y el modelo de
> suscripciones de ese mismo doc es la base de #2, #3, #6 y #10.
