# Features

Lo que Repítela **ya hace**. Se lee antes de proponer algo nuevo: si algo se
parece, la propuesta es de mejora, no de feature.

Levantado el 2026-09-02 recorriendo `frontend/src/router/index.js` (23 rutas) y
`backend/app/routers/` (86 endpoints, catálogo completo en [`API.md`](api.md)).
Se actualiza al **entregar**, no al planear.

## Cliente del bar

- **Entrar escaneando el QR de la mesa** — `/:venueSlug/registro`. PIN diario por
  bar; no hay contraseña.
- **Pedir canciones de YouTube** — busca, previsualiza y encola. Con límite de
  canciones por ventana de tiempo, configurable por bar.
- **Ver la cola y sus propias canciones** — `/:venueSlug/usuario`, en tiempo real
  por WebSocket. Puede cancelar una canción propia mientras siga pendiente.

## Kiosco (la pantalla del bar)

- **Reproducir la cola** — `/:venueSlug/video`. Reproductor de YouTube embebido,
  overlay con la canción actual y quién la pidió, banner configurable y QR en
  pantalla para que las mesas se unan. El QR pasa por `/{slug}/v`, que le añade
  `utm_source=pantalla_video` — ver [[analitica]].
- **Playlist de respaldo** — cuando la cola se vacía suena la lista de fallback
  del bar.

## Administrador del bar

- **Registro con verificación por correo** — `/admin/signup`, más recuperación de
  contraseña (`/admin/forgot-password`, `/admin/reset-password`) y alta con
  Google (kill-switch `GOOGLE_SIGNUP`).
- **Onboarding** — `/admin/onboarding`: nombre del bar, slug y configuración
  inicial.
- **Panel de operación** — `/:venueSlug/admin`. Cola, reproducción (play/pausa/
  saltar), volumen, canción sonando, historial, banner, QR, marca y mesas. El QR
  que se imprime pasa por `/{slug}/a`, que le añade `utm_source=panel_admin`.
- **Suscripción** — `/:venueSlug/admin/suscripcion`. Estado de pago, historial y
  renovación. Pago automático por Wompi (kill-switch `PAGOS`) y pago manual por
  WhatsApp. Aviso a 3 días del vencimiento y bloqueo del panel al suspenderse.

## Superadmin y ventas

- **Panel de bares** — `/superadmin`: alta (`/superadmin/crear-bar`), detalle,
  configuración, límites, administradores, playlist y borrado por bar.
- **Usuarios de un bar** — `/superadmin/venue/:venueId/usuarios`.
- **Ventas** — `/superadmin/ventas`: estado de pago de todos los bares.
- **Administradores de la plataforma** — `/superadmin/admins`.

## Plataforma

- **Analítica por bar** — reproducciones, visitantes únicos, personas por día,
  ranking de canciones y de usuarios.
- **12 temas visuales por bar** más logo propio con variantes clara y oscura.
- **Landing pública** — `repitela.com`, Astro, con WhatsApp flotante.
- **Política de privacidad** — `/privacidad`.
- **Alerta por correo** cuando la base supera el umbral de tamaño.
- **Bloqueo de videos** — hoy es global, no por bar. Ver [[decisions/sqlite-como-base]].

## Lo que NO hace

Para cortar propuestas que asumen lo contrario:

- No hay app nativa: todo es web.
- No hay pagos por canción; el modelo es suscripción mensual del bar.
- No hay multi-idioma: todo en español.
- No hay zona horaria; todo asume Colombia. Ver [[decisions/sqlite-como-base]].
- No hay entorno de staging automático por PR; el ensayo es manual en `staging`.
