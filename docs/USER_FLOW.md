# Flujo del Usuario - BarQueue

## Resumen

El usuario llega al bar, escanea un QR en su mesa, se registra con su celular y puede empezar a encolar canciones desde un dashboard sencillo.

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DEL CLIENTE                            │
│                                                                 │
│  1. Escanea QR ──► 2. Registro ──► 3. Dashboard ──► 4. Encolar │
│     (mesa)           (celular)       (pegar link)     (confirma)│
└─────────────────────────────────────────────────────────────────┘
```

---

## Paso 1: Escaneo del QR

El usuario llega a su mesa y encuentra un código QR (sticker, cartel, o tarjeta).

**QR contiene:**
```
https://app.barqueue.com/bar-la-esquina?mesa=5
```

- `bar-la-esquina` = slug del venue
- `mesa=5` = número de mesa (pre-cargado)

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
│  │ 🪑 Número de mesa         │  │
│  │ 5                (del QR)  │  │
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
| Número de mesa | Sí | Pre-llenado del QR, editable |
| Nombre | No | Para mostrar en la cola |
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
│  Bar La Esquina    Mesa 5   [≡]  │
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
│  🎶 PEGAR LINK DE YOUTUBE       │
│  ┌────────────────────────────┐  │
│  │ https://youtu.be/...       │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │       ENVIAR  ►           │  │
│  └────────────────────────────┘  │
│                                  │
│  Te quedan 3 canciones          │
│  (se reinicia en 18 min)        │
│                                  │
├──────────────────────────────────┤
│  🎵 Mis canciones               │
│  • Never Gonna... (sonando)     │
│  • Despacito (en cola, pos. 2)  │
└──────────────────────────────────┘
```

**Elementos del dashboard:**

1. **Header:** nombre del venue, número de mesa, menú
2. **Now Playing:** canción actual con thumbnail, título, progreso, quién la pidió
3. **Cola:** lista ordenada de canciones pendientes (actualizada en tiempo real vía WebSocket)
4. **Formulario:** campo para pegar URL de YouTube + botón enviar
5. **Rate limit:** indicador visual de canciones restantes y tiempo de reinicio
6. **Mis canciones:** lista de canciones propias y su estado

---

## Paso 4: Encolar una Canción

### 4a. Enviar URL

El usuario pega un link de YouTube y presiona "Enviar".

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

## Paso 5: Tiempo Real

Mientras el usuario está en el dashboard:

- **WebSocket** mantiene la cola actualizada sin recargar
- Ve cuando su canción avanza de posición
- Ve cuando su canción empieza a sonar
- Recibe notificación si el admin remueve su canción

**Eventos WebSocket relevantes para el cliente:**

| Evento | Efecto en UI |
|--------|-------------|
| `song_added` | Nueva canción aparece en la cola |
| `song_removed` | Canción desaparece de la cola |
| `now_playing_changed` | Se actualiza el "Sonando ahora" |
| `queue_reordered` | Se reordenan las posiciones |
| `playback_status_changed` | Indicador de pausa/play |

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
- **Input de URL:** campo con `type="url"` y `inputmode="url"` para teclado optimizado
- **Clipboard:** botón "Pegar" que lee del clipboard (`navigator.clipboard.readText()`)
- **Touch-friendly:** botones mínimo 44x44px, espaciado generoso
- **Conexión:** manejar gracefully la pérdida de conexión WiFi (reconexión automática de WebSocket)
- **PWA (futuro):** potencial para agregar como Progressive Web App con notificaciones push
