# Ideas de producto: viabilidad y diseño

> Backlog de ideas evaluadas sobre el código actual (2026-08-21).
> Complementa `docs/PLAN_MEJORAS_ESCALA.md` (fixes + suscripciones + escalada).
>
> **Veredicto global: las 18 ideas son posibles.** Una ya está implementada (#5),
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
      ├── #11 Carta digital (add-on cobrable; v1-link no depende de nada)
      ├── #13 Onboarding del bar (sin él, los trials de #2 no activan)
      └── #15 Micropagos del usuario final (reusa el checkout/webhook de #2)
#5 ya existe · #7 independiente · #8 independiente (legal)
#9 chatbot ventas ──┐
#2 registro/pagos ──┴── #12 HubSpot (CRM: recibe leads de #9 y estados de #2)
#14 medición/UTMs — transversal: instrumenta la landing, #2, #9, #12 y #13
                    (hacerla ANTES de invertir en adquisición)
#16 higiene de cola (necesita la tarea de fondo P1.2)
 └── #18 control de presencia (capas: PIN ya existe + #16 + #17 QR por mesa)
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

## #12 — Integración con HubSpot (CRM comercial)

**Veredicto: POSIBLE — esfuerzo S-M.** HubSpot se vuelve la columna vertebral
comercial (leads, pipeline, marketing B2B), sin duplicar lo que el backend ya
hace. Regla de oro: **HubSpot maneja bares y prospectos (B2B); los usuarios
finales de los bares nunca se suben a HubSpot** — son datos de los bares y
aplica la Ley 1581 (#8).

**Puntos de integración:**
- **Chatbot WhatsApp (#9) → HubSpot**: cada lead capturado se crea/actualiza
  como Contact + Deal vía API (private app token) en un pipeline de ventas:
  `Lead → Contactado → Demo → Trial → Pagando → Perdido`. La tabla `leads`
  local queda como espejo mínimo (o se elimina y HubSpot es la fuente).
- **Registro autogestionado (#2) → HubSpot**: al crearse un venue con trial
  se crea Company + Deal en etapa `Trial`; los eventos de suscripción mueven
  el deal automáticamente: pago aprobado (webhook Wompi) → `Pagando`,
  suspensión → `Perdido/En riesgo`, reactivación → `Pagando`. El pipeline
  refleja el estado real de la base instalada sin trabajo manual.
- **Ciclo de facturación → propiedades del deal**: `paid_until`, plan, MRR
  del bar como propiedades custom — reportes de ingresos y churn salen de
  HubSpot sin construirlos.
- **Marketing B2B**: secuencias y correos a prospectos y bares (recordatorios
  comerciales, novedades, upsell de add-ons #3/#6/#11) desde HubSpot en vez
  de construir un motor de campañas propio.
- **Centro de control (#1)**: link directo a la ficha HubSpot de cada bar.
  División clara: HubSpot = vista comercial (pipeline, ingresos, tratos);
  centro de control = vista operativa (salud, actividad, alertas). No
  duplicar métricas operativas en HubSpot.
- **Técnica**: API REST de HubSpot con private app token desde el backend
  (crear/actualizar contacts, companies, deals); llamadas asíncronas y
  best-effort (un fallo de HubSpot jamás bloquea un registro o un pago) con
  reintentos en la tarea de fondo (P1.2).
- **Costo**: CRM gratis alcanza para empezar (contacts, companies, deals,
  pipeline); Starter (~USD 15-20/mes por asiento) cuando se necesiten
  secuencias automatizadas de correo.

---

## #13 — Onboarding y documentación para el usuario final

**Veredicto: POSIBLE — esfuerzo S-M.** Hoy la documentación vive en el repo
(`ADMIN_GUIDE.md`, `USER_FLOW.md`) — sirve para desarrollo, no para un bar
que se registra solo. Sin esto, el registro autogestionado (#2) genera
trials que no se activan.

**Diseño propuesto — tres audiencias:**
- **El bar (admin), al registrarse**: checklist guiado dentro del panel la
  primera vez: ① sube tu logo → ② importa tu playlist de respaldo →
  ③ descarga e imprime tu QR → ④ abre el kiosko en el TV → ⑤ pide tu primera
  canción de prueba. Con barra de progreso y estado persistido
  (`venues.config.onboarding_step`). Un bar que completa el checklist en su
  primer día es un trial que convierte — y el checklist incompleto es una
  alerta en el centro de control (#1) y un trigger de secuencia en
  HubSpot (#12): "vimos que no has impreso tu QR, ¿te ayudamos?".
- **El bar, operación diaria**: centro de ayuda público (`/ayuda`) con guías
  cortas por tarea ("cómo saltar una canción", "cómo funciona el PIN", "qué
  hago si un video falla", "cómo leo mis analíticas") + videos de 60 s.
  Generable desde los docs existentes; alojable en la landing (Astro ya
  está).
- **El cliente en el bar**: micro-onboarding de 3 pantallas la primera vez
  que escanea el QR ("busca tu canción → confírmala → mírala en pantalla"),
  con las reglas visibles (cuántas canciones tienes, cuándo se renuevan).
  Reduce el abandono en el primer uso — medible con el journey de #1.

---

## #14 — Medición correcta: UTMs, eventos y el funnel completo hasta el bar que compra

**Veredicto: POSIBLE Y URGENTE — esfuerzo S-M.** Hoy llega mucho `(not set)`
a Analytics: tráfico sin atribución. Sin esto, no se puede saber qué canal
trae bares que pagan — y todo lo comercial (#9, #12) queda a ciegas.
La base ya existe: GTM en la landing (`docs/ANALYTICS.md`,
`docs/gtm-container.json`) y analítica de producto en el backend.

**Diseño propuesto:**
- **Plan de medición escrito** (una página, fuente de verdad): taxonomía de
  eventos GA4 con nomenclatura fija (`snake_case`, prefijos por superficie:
  `landing_*`, `app_*`, `kiosk_*`), parámetros obligatorios y qué pregunta
  responde cada evento. El `(not set)` casi siempre es eventos sin parámetros
  consistentes o tráfico sin UTM — se ataca por ambos lados.
- **Convención UTM única para todo link saliente de Repítela**:
  `utm_source` (whatsapp, instagram, qr, chatbot, hubspot) ·
  `utm_medium` (social, chat, print, email) · `utm_campaign` (nombre fijo
  por campaña) · `utm_content` (variante). Aplica a: landing, links del
  chatbot (#9), QRs impresos (¡cada QR de bar/mesa con su UTM — el QR es un
  canal!), redes del bar (#3) y correos de HubSpot (#12).
- **El funnel completo, punta a punta**:
  `visita landing → lead (form o WhatsApp) → demo → registro/trial (#2) →
  activación (checklist #13 completo) → pago (webhook Wompi)`.
  Los pasos de servidor (registro, activación, pago) se reportan a GA4 por
  **Measurement Protocol** desde el backend — el pago nunca ocurre en el
  navegador, así que sin esto el funnel siempre estará roto. El mismo evento
  actualiza el deal en HubSpot (#12): una sola verdad, dos destinos.
- **Consent mode** en GTM condicionado al banner de cookies (#8) — medir
  bien y legal a la vez.
- **Higiene GA4**: filtrar tráfico interno y de los kioskos (¡un TV
  reproduciendo 24/7 contamina todo!), marcar conversiones clave
  (lead, trial, pago), y auditar el contenedor GTM actual contra el plan.

---

## #15 — Funcionalidades que el usuario final pagaría desde su teléfono

**Veredicto: POSIBLE — esfuerzo M (una vez exista el micropago). Es la
segunda línea de ingresos: el que paga no es solo el bar, también su
cliente.** Todo con micropagos Wompi (Nequi/tarjeta) y **reparto con el bar**
(ej. 70/30) — así el bar promueve estas features en vez de tolerarlas.

**Catálogo propuesto, de mayor a menor potencial:**
- **Cola VIP** ($3.000-5.000 COP): tu canción sube de posición. El modelo
  probado de las rockolas digitales (TouchTunes). Reglas: máximo N saltos por
  hora, nunca desplaza a otra VIP, el admin puede desactivarla. Es la
  feature #1 de esta lista por ingreso esperado.
- **Dedicatorias en pantalla** ($2.000-4.000): mensaje junto a tu canción
  cuando suena ("Feliz cumpleaños, Laura 🎂"). Moderación automática con IA
  (Haiku, centavos — ver roadmap IA) antes de mostrarse; el admin puede
  vetar. Emocional, viral y de margen altísimo.
- **Canciones extra**: compra un slot adicional cuando agotaste tu límite de
  la ventana. Convierte la frustración del rate limit en ingreso; límites
  duros por hora para no romper la equidad de la cola.
- **Saludo/foto en pantalla** ($5.000-10.000): foto + mensaje en el kiosko
  entre canciones (cumpleaños, despedidas). Moderación IA + aprobación del
  admin obligatoria. Precio premium por lo prominente.
- **Paquete "evento especial"** ($15.000-30.000): vienes por una despedida
  de soltero, cumpleaños, aniversario → pagas y el grupo aparece en pantalla
  durante la noche: nombre del festejado y foto en momentos programados
  (ej. cada 30-45 min o entre canciones), con plantillas por tipo de evento.
  Es el saludo individual convertido en producto de ocasión: se compra
  **antes** de llegar (link compartible para que el grupo lo pague entre
  todos) o en el bar. Tabla `special_events` (`venue_id`, tipo, nombres,
  foto, fecha, franjas de aparición, estado de pago). Moderación IA +
  aprobación del admin. El bar lo promociona porque le llena mesas de grupos.
- **Turno de karaoke prioritario**: cuando exista el modo karaoke, reservar
  turno pagando. Mismo motor que la cola VIP.
- **Infraestructura común**: tabla `microtransactions` (`user_id`,
  `venue_id`, tipo, monto, estado, referencia Wompi, reparto), checkout Wompi
  embebido en la vista del cliente, webhook compartido con #2, y liquidación
  mensual al bar visible en su panel ("este mes tus clientes gastaron X, tu
  parte es Y") — ese reporte es, en sí mismo, la mejor herramienta de
  retención del bar.

---

## #16 — Higiene de la cola: solo los del día y expulsión por inactividad

**Veredicto: POSIBLE — esfuerzo S. La mitad ya existe; falta que corra sola.**

**Estado actual:** la expiración por inactividad ya está implementada
(`session_inactivity_minutes`, default 120) pero es **perezosa**: solo se
evalúa cuando el usuario hace una request, y el barrido masivo
(`expire_stale_sessions`) solo corre al arrancar el contenedor. Expulsar mesa
(`kick_table`) también existe, pero es manual.

**Diseño propuesto:**
- **Inactividad a 1 hora, automática**: hacer `session_inactivity_minutes`
  configurable por venue (60 para este caso) y ejecutar
  `expire_stale_sessions` cada 5-10 min en la tarea de fondo (P1.2). Al
  expirar una sesión: marcar sus canciones `pending` como `removed` (misma
  lógica de `kick_table`), notificar por WebSocket (`session_kicked`) y
  refrescar la vista del admin.
- **Solo los del día**: cierre diario por venue a una hora configurable
  (ej. 6 a.m.): expira todas las sesiones abiertas y limpia colas huérfanas.
  El "día" del bar arranca limpio siempre, sin depender de reinicios.
- Todo se apoya en columnas y funciones existentes (`last_activity_at`,
  migración 009) — es orquestación, no modelo nuevo.

---

## #17 — QR asignado a cada mesa

**Veredicto: POSIBLE — esfuerzo S-M.** Hoy `table_number` lo escribe el
cliente (o se autogenera): cualquiera puede decir que es la mesa 5.

**Diseño propuesto:**
- Tabla `venue_tables` (`venue_id`, `table_number`, `qr_token` único,
  `active`). El QR de la mesa codifica
  `/{slug}/usuario?t=<qr_token>` — **la mesa la determina el QR, no el
  usuario** (el campo de mesa desaparece del registro: un paso menos de
  fricción, dato más confiable).
- El token es firmado/aleatorio: no se puede adivinar el de otra mesa ni
  inventar mesas. Si un QR se filtra o la mesa cambia, se regenera solo ese
  token.
- **Generador de QRs imprimibles** en el panel del admin: hoja PDF con los
  QRs de todas las mesas (con el logo del bar — se conecta con la
  personalización #3), cada uno con su UTM (#14: cada mesa se vuelve un
  canal medible — "la mesa 7 es la que más pide").
- Beneficios en cadena: `kick_table` y los cupones por mesa (#6) operan
  sobre mesas reales; el centro de control (#1) muestra ocupación por mesa
  confiable; y es el cimiento del control de presencia (#18).

---

## #18 — Impedir que alguien ponga música desde su casa

**Veredicto: POSIBLE con capas — esfuerzo S-M. Honestidad primero: ninguna
técnica sola lo garantiza al 100%, pero la combinación lo vuelve
impráctico.** Y la primera capa **ya está construida**.

**El problema:** el link `/{slug}/usuario` es estático; quien lo guarda puede
volver a entrar desde donde sea, y el JWT dura 24 h.

**Capas de defensa (en orden de costo/beneficio):**
1. **PIN diario en pantalla — YA EXISTE** (`require_pin` +
   `venue_daily_pins`, migración 006): el registro exige un PIN de 4 dígitos
   que solo se ve en el TV del bar y cambia cada día. El link guardado no
   sirve mañana sin estar frente a la pantalla. **Acción: activarlo por
   defecto en el onboarding (#13) y explicárselo al bar.** Refinamiento:
   regenerarlo también a mitad de jornada si el bar quiere.
2. **Expulsión por inactividad (#16)**: la sesión de hoy muere en 1 h sin
   actividad — el que se fue del bar pierde acceso pronto aunque conozca el
   PIN de hoy.
3. **QR por mesa (#17) + re-validación**: entrar exige un token de mesa
   real; combinado con el PIN, "guardarse el link" exige además estar viendo
   la pantalla hoy.
4. **Re-entrada solo por escaneo (grants de un solo uso)** — la capa
   principal. Requisitos de producto: **cero fricción** (nada de teclear
   códigos) y **sin señales de red ni geolocalización**. Diseño abajo.

**Restricción física a aceptar primero:** un QR impreso es tinta — su URL
no puede cambiar sola. Por eso el diseño separa dos problemas: (a) que la
URL que la gente guarda en su navegador muera sola (resuelto 100% por
software), y (b) que el objeto físico entregue algo distinto cada vez
(resuelto por la pantalla gratis, o por NFC con hardware barato).

**Diseño de la capa 4 — grants de un solo uso:**

- El QR no apunta a la app sino a un **endpoint de entrada** ("taquilla"):
  `repitela.co/e/<token_de_mesa>`. Al visitarse, el backend emite un
  **grant de un solo uso** (~60 s de vida, tabla `entry_grants` o firmado
  con nonce) y redirige a `/{slug}/usuario?g=<grant>`.
- La app canjea el grant por la sesión y **lo borra de la barra de
  direcciones** (`history.replaceState`). El grant muere al usarse: la URL
  que queda en el navegador/historial lleva una boleta consumida —
  **guardarla hoy no sirve mañana, ni en una hora**.
- **`/api/auth/register` pasa a exigir un grant válido** — hoy basta
  conocer el slug del bar; ese es el cambio de fondo.
- Al caducar la sesión (#16): pantalla "Tu sesión terminó — escanea el QR
  de tu mesa para volver a pedir". Escanear ya es el gesto de entrada;
  ahora también es el de re-entrada. Cero códigos.

**Riesgo residual — aceptado por decisión de negocio:** la URL impresa de
la taquilla, copiada deliberadamente desde la cámara, seguiría funcionando
(la tinta no puede rotar). Se acepta porque **el daño está acotado por
diseño**: el rate limit da ~3 canciones por ventana, la inactividad (#16)
mata la sesión en 1 h, y el admin puede quitar la canción y expulsar la
mesa en dos taps. Blindar ese último resquicio (QR físico dinámico vía NFC,
verificación de red o ubicación) **queda explícitamente descartado** — el
costo y la fricción no se justifican contra un abuso de 3 canciones.

Mitigaciones baratas que sí quedan (opcionales, del lado del bar):
- **Taquilla solo con el bar abierto**: solo emite grants mientras el
  kiosko del venue está encendido (el backend ya lo sabe — el kiosko le
  habla cada 10 s). Señal del bar, no del usuario.
- **Revocación por mesa** (#17): si una mesa muestra un patrón raro, el
  admin regenera solo ese token y reimprime ese papel.
- **QR de pantalla**: su token puede rotar gratis (es un render); bares
  estrictos pueden dirigir a la gente a escanear la pantalla.

**Recomendación**: capas 1+2 casi gratis (config + #16); capa 3 con #17;
capa 4 = grants de un solo uso + las mitigaciones opcionales de arriba.
El PIN diario existente queda como opción manual para bares que lo
prefieran, pero deja de ser el mecanismo principal.

---

## Priorización sugerida

| Orden | Idea | Por qué |
|---|---|---|
| 1 | **#2** Registro + trials + Wompi, con **#13** onboarding y **#14** medición integrados desde el día 1 | El negocio; un trial sin onboarding no activa y un funnel sin medición no se puede optimizar |
| 2 | **#5** (ajustes) + **#1** salud/alertas + **#16** higiene de cola + **#18** capas 1-2 (activar PIN + inactividad) | Baratos, mejoran la operación diaria ya; #16/#18 son config + la tarea de fondo P1.2 |
| 3 | **#3** promos + redes sociales + **#11 v1** link a carta + **#7** votos + **#17** QR por mesa | Valor visible para bar y usuarios; redes, link-carta y QR por mesa son días de trabajo |
| 4 | **#8** legal | Antes de crecer en usuarios y de campañas de marketing; el consent mode de #14 depende de esto |
| 5 | **#9** chatbot WhatsApp (Cloud API) + **#12** HubSpot | Motor de adquisición para vender #2; HubSpot ordena el pipeline desde el primer lead |
| 6 | **#15** micropagos del usuario (cola VIP primero) | Segunda línea de ingresos; reusa el checkout de #2 y convierte al bar en socio |
| 7 | **#6** cupones + **#4** algoritmo playlist + **#11 v2** carta alojada | Add-ons de retención/upsell |
| 8 | **#10** fiestas | Nueva línea B2C sobre lo ya construido |

> Recordatorio transversal: los fixes P0/P1 y la tarea de fondo de
> `PLAN_MEJORAS_ESCALA.md` son prerequisito de #1 y #4, y el modelo de
> suscripciones de ese mismo doc es la base de #2, #3, #6 y #10.
