# Flujo del Usuario - BarQueue

> **Índice:** [[README]] · **Autoridad sobre:** el recorrido de cada rol · **Últ. cambio:** 2026-08-25
> Si esta página contradice al código, gana el código y esta página tiene un bug.

## Resumen

El usuario llega al bar, escanea un QR, se registra con su celular y puede empezar a encolar canciones desde un dashboard sencillo.

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DEL CLIENTE                            │
│                                                                 │
│  1. Escanea QR ──► 2. Registro ──► 3. Dashboard ──► 4. Encolar │
│                  (celular + PIN*)    (buscar)          (confirma)│
└─────────────────────────────────────────────────────────────────┘
```

---

## Paso 1: Escaneo del QR

El usuario encuentra un código QR (sticker, cartel o pantalla del bar).

**QR contiene:**
```
https://repitela.com/bar-la-esquina/registro
```

- `bar-la-esquina` = slug del venue
- `/registro` = formulario de registro; el dashboard del cliente es `/:venueSlug/usuario`

**Al escanear:**
- Se abre el navegador del celular
- Si ya tiene sesión activa (cookie/JWT válido), va directo al dashboard
- Si no, muestra el formulario de registro

---

## Paso 2: Registro

```
┌──────────────────────────────────┐
│        🎵 Bar La Esquina         │
│                                  │
│  ¡Elige la música que suena!     │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 📱 Tu número de celular   │  │
│  │ +57 300 123 4567           │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 👤 Tu nombre (opcional)   │  │
│  │ Carlos                     │  │
│  └────────────────────────────┘  │
│                                  │
│  ☑ Acepto el uso de mis datos   │
│    para mejorar la experiencia   │
│    musical del bar.              │
│    Ver política de privacidad    │
│                                  │
│  ┌────────────────────────────┐  │
│  │        ENTRAR  ►          │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Campos:**
| Campo | Requerido | Notas |
|-------|-----------|-------|
| Número de celular | Sí | Formato con código de país |
| Nombre | No | Para mostrar en la cola |
| PIN diario | Condicional | Se solicita si el venue lo exige; aparece en la pantalla del bar |
| Consentimiento de datos | Sí | Checkbox obligatorio |

**Al enviar:**
- `POST /api/auth/register`
- Se crea/reutiliza el usuario
- Se genera sesión + JWT
- Redirección al dashboard

---

## Paso 3: Dashboard del Cliente

Vista principal después del registro. Diseño mobile-first.

```
┌──────────────────────────────────┐
│  Bar La Esquina              [≡]  │
├──────────────────────────────────┤
│                                  │
│  🎵 SONANDO AHORA               │
│  ┌────────────────────────────┐  │
│  │ [thumb] Never Gonna Give   │  │
│  │         You Up             │  │
│  │         Rick Astley        │  │
│  │         ▶ 2:15 / 3:33     │  │
│  │         Pedida por Carlos  │  │
│  └────────────────────────────┘  │
│                                  │
│  📋 SIGUIENTE EN LA COLA (4)     │
│  ┌────────────────────────────┐  │
│  │ 2. Despacito - Luis Fonsi │  │
│  │ 3. Blinding Lights - Weeknd│  │
│  │ 4. Shape of You - Sheeran │  │
│  │ 5. Bohemian Rhapsody      │  │
│  └────────────────────────────┘  │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  🎶 BUSCAR UNA CANCIÓN           │
│  ┌────────────────────────────┐  │
│  │ artista o título...         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │       ENVIAR  ►           │  │
│  └────────────────────────────┘  │
│                                  │
│  Te quedan 3 canciones          │
│  (se reinicia en 18 min)        │
│                                  │
├──────────────────────────────────┤
│  🕐 Ya pediste (últimas 2h)    │
│  • Never Gonna... (hace 45 min)│
│  • Despacito (hace 12 min)     │
├──────────────────────────────────┤
│  🎵 Mis canciones               │
│  • Never Gonna... (sonando)     │
│  • Despacito (en cola, pos. 2)  │
└──────────────────────────────────┘
```

**Elementos del dashboard:**

1. **Header:** nombre del venue y menú
2. **Now Playing:** canción actual con thumbnail, título, progreso, quién la pidió
3. **Cola:** lista ordenada de canciones pendientes (actualizada en tiempo real vía WebSocket)
4. **Buscador:** consulta por artista o título; el usuario selecciona un resultado y confirma. Pegar una URL de YouTube sigue disponible como alternativa.
5. **Rate limit:** indicador visual de canciones restantes y tiempo de reinicio
6. **Ya pediste:** canciones enviadas en las últimas 2 horas (anti-repetición)
7. **Mis canciones:** lista de canciones propias y su estado

---

## Paso 4: Encolar una Canción

### 4a. Buscar o enviar URL

El camino principal busca por artista o título mediante `GET /api/queue/search?q=...` y muestra resultados de YouTube. También puede pegar un enlace de YouTube y enviarlo directamente.

```
GET /api/queue/search?q=rick+astley
```

Para la alternativa por enlace:

```
POST /api/queue/songs { youtube_url: "https://youtu.be/dQw4w9WgXcQ" }
```

**Validaciones en este paso:**
- URL es de YouTube (formato válido)
- El video existe y es embebible
- No excede duración máxima
- No está ya en la cola activa
- El usuario no ha excedido el rate limit

### 4b. Preview y Confirmación

Si la validación pasa, se muestra un preview:

```
┌──────────────────────────────────┐
│                                  │
│  ¿Quieres encolar esta canción? │
│                                  │
│  ┌────────────────────────────┐  │
│  │ [████████████████████████] │  │
│  │                            │  │
│  │  Never Gonna Give You Up   │  │
│  │  Rick Astley               │  │
│  │  Duración: 3:33            │  │
│  └────────────────────────────┘  │
│                                  │
│  Posición estimada: #6          │
│  Espera aproximada: ~15 min     │
│                                  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ Cancelar│  │  Confirmar ✓ │  │
│  └─────────┘  └──────────────┘  │
└──────────────────────────────────┘
```

### 4c. Confirmación exitosa

```
POST /api/queue/songs/confirm { youtube_id: "dQw4w9WgXcQ" }
```

```
┌──────────────────────────────────┐
│                                  │
│  ✓ ¡Canción agregada!           │
│                                  │
│  Never Gonna Give You Up        │
│  Posición: #6                   │
│  Espera: ~15 min                │
│                                  │
│  Te quedan 2 canciones          │
│  en los próximos 22 min         │
│                                  │
└──────────────────────────────────┘
```

---

## Paso 5: Notificaciones y Tiempo Real

Mientras el usuario está en el dashboard:

- **WebSocket** mantiene la cola actualizada sin recargar
- Ve cuando su canción avanza de posición
- Recibe notificación si el admin remueve su canción

### Notificación: "Tu canción está sonando"

Cuando la canción del usuario comienza a reproducirse, recibe una notificación prominente:

```
┌──────────────────────────────────┐
│                                  │
│  🎵 ¡Tu canción está sonando!   │
│                                  │
│  Never Gonna Give You Up        │
│  Rick Astley                     │
│                                  │
│  ┌────────────────────────────┐  │
│  │         ¡Genial!           │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

- **App en primer plano:** toast/modal dentro de la app
- **App en segundo plano:** notificación nativa del navegador (Notification API)
- El permiso de notificaciones se solicita después de la primera canción encolada:

```
┌──────────────────────────────────┐
│  ¿Quieres recibir una           │
│  notificación cuando tu canción │
│  empiece a sonar?               │
│                                  │
│  [No gracias]  [Sí, avisenme]  │
└──────────────────────────────────┘
```

**Eventos WebSocket relevantes para el cliente:**

| Evento | Efecto en UI |
|--------|-------------|
| `song_added` | Nueva canción aparece en la cola |
| `song_removed` | Canción desaparece de la cola |
| `now_playing_changed` | Se actualiza el "Sonando ahora" |
| `your_song_playing` | Notificación personal: tu canción está sonando |
| `queue_reordered` | Se reordenan las posiciones |
| `playback_status_changed` | Indicador de pausa/play |
| `session_kicked` | Cierra la sesión del cliente expulsado |
| `rate_limit_reset` | Actualiza los cupos disponibles del cliente autenticado |
| `volume_changed` | Sincroniza el volumen de los clientes conectados |
| `banner_changed` | Actualiza el banner del venue |
| `qr_visibility_changed` | Actualiza la visibilidad del QR en pantalla |

Los saltos de canción se registran para analytics, pero no se comunican como evento WebSocket; el cliente no debe esperar una notificación específica para ese caso.

---

## Paso 6: Historial Reciente (Anti-repetición)

El dashboard muestra las canciones que el usuario ya pidió en las **últimas 2 horas**, para que no las repita sin querer.

```
┌──────────────────────────────────┐
│                                  │
│  🕐 YA PEDISTE (últimas 2h)    │
│  ┌────────────────────────────┐  │
│  │ • Never Gonna Give You Up  │  │
│  │   hace 45 min ✓ Reproducida│  │
│  │                            │  │
│  │ • Despacito                │  │
│  │   hace 12 min ⏳ En cola   │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

Si el usuario intenta encolar una canción que ya pidió en las últimas 2 horas:

```
┌──────────────────────────────────┐
│                                  │
│  ⚠ Ya pediste esta canción      │
│  hace 45 minutos.                │
│                                  │
│  ¿Quieres repetirla?            │
│                                  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ Cancelar│  │ Sí, repetir  │  │
│  └─────────┘  └──────────────┘  │
└──────────────────────────────────┘
```

- **No se bloquea**, solo se advierte
- El usuario puede confirmar y la canción se encola normalmente
- La ventana de 2 horas es configurable por el admin del venue

---

## Manejo de Errores (UX)

### URL inválida
```
┌──────────────────────────────────┐
│  ✗ Eso no parece un link de     │
│    YouTube. Intenta con uno      │
│    como: youtube.com/watch?v=... │
└──────────────────────────────────┘
```

### Video no disponible
```
┌──────────────────────────────────┐
│  ✗ No encontramos ese video.    │
│    Puede que sea privado o       │
│    no esté disponible.           │
└──────────────────────────────────┘
```

### Rate limit alcanzado
```
┌──────────────────────────────────┐
│  ⏳ Ya usaste tus 5 canciones.  │
│     Podrás pedir más en 12 min. │
│                                  │
│     ████████░░░░  12:00          │
└──────────────────────────────────┘
```

### Canción duplicada
```
┌──────────────────────────────────┐
│  ℹ Esta canción ya está en la   │
│    cola. ¡Alguien más la pidió! │
└──────────────────────────────────┘
```

### Duración excedida
```
┌──────────────────────────────────┐
│  ✗ Esta canción dura 15 min.    │
│    El máximo permitido es 10 min.│
└──────────────────────────────────┘
```

---

## Consideraciones Mobile-First

- **Diseño responsive:** optimizado para pantallas de 320px a 428px de ancho
- **Búsqueda:** campo de texto para buscar canciones; el enlace de YouTube es una alternativa.
- **Touch-friendly:** botones mínimo 44x44px, espaciado generoso
- **Conexión:** manejar gracefully la pérdida de conexión WiFi (reconexión automática de WebSocket)
- **PWA:** `vite-plugin-pwa` está configurado con actualización automática y manifest; las notificaciones del dashboard usan la Notification API cuando el navegador concede permiso.

---

## Flujo del Dueño del Bar

1. **Registro:** entra a `/admin/signup` (`AdminSignup.vue`) y crea la cuenta con correo y contraseña, o con Google Sign-In. El registro exige Turnstile y aceptación de términos y privacidad.
2. **Verificación:** el backend crea el administrador y su trial, y envía un enlace por Brevo cuando `BREVO_API_KEY` está configurada. El enlace abre `/admin/verify-email` (`VerifyEmail.vue`).
3. **Recuperación:** desde el login solicita el enlace en `/admin/forgot-password` (`ForgotPassword.vue`) y establece la nueva contraseña en `/admin/reset-password` (`ResetPassword.vue`).
4. **Ingreso y onboarding:** el administrador inicia en `/admin` o `/:venueSlug/admin/login` (`AdminLogin.vue`). Si `onboarding_completed_at` es nulo, el guard redirige obligatoriamente a `/admin/onboarding` (`AdminOnboarding.vue`) antes de permitir el panel.
5. **Operación del bar:** completado el onboarding, usa `/:venueSlug/admin` (`AdminDashboard.vue`) para administrar su venue.
6. **Suscripción y pago:** en `/:venueSlug/admin/suscripcion` (`AdminSubscription.vue`) consulta trial, estado e historial, y abre el checkout de Wompi. El webhook firmado confirma el pago; el superadmin consulta los movimientos en `/superadmin/ventas` (`SuperAdminSales.vue`).

Las rutas están definidas en `frontend/src/router/index.js:80-129`; el guard de onboarding está en `frontend/src/router/index.js:182-190`. La verificación de email y el onboarding son rutas separadas: el guard obligatorio actualmente aplica al onboarding, no a la verificación de correo.
