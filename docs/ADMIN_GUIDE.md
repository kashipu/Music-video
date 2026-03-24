# Guía del Administrador - BarQueue

## Acceso al Panel

El panel de administración está en la misma aplicación, accesible desde:

```
https://app.barqueue.com/admin
```

**Login:** username + password (creado durante el setup inicial del venue).

---

## Dashboard Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│  BarQueue Admin │ Bar La Esquina      [Analytics] [Config] [Logout] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🎵 SONANDO AHORA                              ⏸ Pausar │ ⏭ Skip  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ [thumbnail]  Never Gonna Give You Up - Rick Astley            │  │
│  │              ▶ 2:15 / 3:33                                    │  │
│  │              Pedida por: Carlos (+573001234567) │ Mesa: 5      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  📋 COLA (4 canciones)                    [+ Agregar canción]       │
│  ┌───┬──────────────────────────────┬──────────┬──────┬──────────┐  │
│  │ ≡ │ Despacito - Luis Fonsi      │ María    │ M.3  │ [✕] [↑↓] │  │
│  │ ≡ │ Blinding Lights - The Weeknd│ Pedro    │ M.7  │ [✕] [↑↓] │  │
│  │ ≡ │ Shape of You - Ed Sheeran   │ Ana      │ M.2  │ [✕] [↑↓] │  │
│  │ ≡ │ Bohemian Rhapsody - Queen   │ Carlos   │ M.5  │ [✕] [↑↓] │  │
│  └───┴──────────────────────────────┴──────────┴──────┴──────────┘  │
│   ≡ = drag to reorder │ ✕ = remover │ ↑↓ = mover posición          │
│                                                                     │
│  📊 RESUMEN DE HOY                                                  │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────┐  │
│  │ 🎵 42 songs  │ 👥 18 users │ 🪑 12 mesas │ ⏱ ~4 min espera │  │
│  └──────────────┴──────────────┴──────────────┴──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Funciones del Admin

### Controles de Reproducción

| Acción | Descripción | Endpoint |
|--------|-------------|----------|
| **Pausar** | Pausa la reproducción en el kiosco | `POST /api/admin/playback/pause` |
| **Reanudar** | Reanuda la reproducción | `POST /api/admin/playback/resume` |
| **Skip** | Salta la canción actual, avanza a la siguiente | `POST /api/admin/queue/skip` |

### Gestión de la Cola

#### Remover una canción
- Click en el botón **[✕]** junto a la canción
- Confirmación: "¿Remover 'Despacito' de la cola?"
- La canción se marca como `removed` y desaparece
- Se notifica a todos los clientes vía WebSocket

#### Reordenar canciones
- **Drag & drop:** arrastrar el handle **[≡]** para mover la canción
- **Botones ↑↓:** subir o bajar una posición
- El cambio se refleja en tiempo real para todos los clientes

#### Agregar una canción (como admin)
- Click en **[+ Agregar canción]**
- Pegar URL de YouTube
- La canción se agrega sin restricción de rate limit
- Se marca como agregada por "admin" en el historial

### Historial de Pedidos

Vista completa de todas las canciones pedidas, con filtros:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📜 HISTORIAL DE PEDIDOS                                            │
│                                                                     │
│  Filtros: [Hoy ▼] [Todas las mesas ▼] [Buscar canción...]         │
│                                                                     │
│  ┌────────┬──────────────────────┬──────────┬──────┬──────────────┐ │
│  │ Hora   │ Canción              │ Usuario  │ Mesa │ Estado       │ │
│  ├────────┼──────────────────────┼──────────┼──────┼──────────────┤ │
│  │ 23:15  │ Never Gonna Give...  │ Carlos   │ 5    │ ▶ Sonando   │ │
│  │ 23:12  │ Despacito            │ María    │ 3    │ ⏳ En cola   │ │
│  │ 23:05  │ Bad Guy - Billie...  │ Pedro    │ 7    │ ✓ Reproducida│ │
│  │ 22:58  │ Thriller - Michael.. │ Ana      │ 2    │ ✗ Removida  │ │
│  └────────┴──────────────────────┴──────────┴──────┴──────────────┘ │
│                                                                     │
│  Página 1 de 5  [◄] [►]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Kiosco de Reproducción

El kiosco es la pantalla del bar que muestra lo que está sonando. Se accede desde:

```
https://app.barqueue.com/kiosk/bar-la-esquina
```

### Configuración del Kiosco

1. Abrir la URL del kiosco en un navegador (Chrome recomendado)
2. Presionar **F11** para pantalla completa
3. El kiosco se conecta automáticamente por WebSocket
4. Auto-advance: cuando termina una canción, avanza automáticamente

### Vista del Kiosco

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    🎵 Bar La Esquina                                │
│                                                                     │
│         ┌─────────────────────────────────┐                        │
│         │                                 │                        │
│         │     [YouTube Player / Video]     │                        │
│         │                                 │                        │
│         │                                 │                        │
│         └─────────────────────────────────┘                        │
│                                                                     │
│         Never Gonna Give You Up                                    │
│         Rick Astley                                                │
│         ████████████░░░░░░  2:15 / 3:33                           │
│         Pedida por Carlos 🪑 Mesa 5                                │
│                                                                     │
│  ───────────────────────────────────────────────────────           │
│  SIGUIENTE:                                                        │
│  2. Despacito - Luis Fonsi (María, Mesa 3)                        │
│  3. Blinding Lights - The Weeknd (Pedro, Mesa 7)                  │
│  4. Shape of You - Ed Sheeran (Ana, Mesa 2)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────┐              │
│  │ Escanea el QR de tu mesa para pedir canciones!  │              │
│  └──────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

**Elementos del kiosco:**
- Video de YouTube (IFrame Player API) o visualización con carátula
- Título y artista de la canción actual
- Barra de progreso
- Quién la pidió y desde qué mesa
- Próximas canciones en cola
- Mensaje invitando a escanear el QR

---

## Configuración del Venue

Accesible desde el panel de admin:

### Opciones configurables

| Setting | Descripción | Default |
|---------|-------------|---------|
| Nombre del venue | Nombre que se muestra a los clientes | - |
| Slug | URL del venue | - |
| Max duración de canción | Duración máxima permitida (minutos) | 10 min |
| Canciones por ventana | Max canciones por usuario por ventana | 5 |
| Ventana de tiempo | Minutos de la ventana de rate limit | 30 min |
| Modo cola vacía | `playlist` o `youtube_recommendations` | `playlist` |
| Playlist por defecto | Lista de youtube_ids para fallback | [] |

### Configurar Playlist por Defecto

1. Ir a **Config > Playlist por defecto**
2. Pegar URLs de YouTube una por línea
3. Las canciones se validan automáticamente
4. Guardar — estas canciones suenan cuando la cola está vacía

### Modo Recomendaciones de YouTube

Si se selecciona este modo, cuando la cola está vacía:
- El kiosco deja que YouTube reproduzca automáticamente videos recomendados
- Basado en el historial de reproducción del venue
- El admin puede interrumpir en cualquier momento

---

## Generación de Códigos QR

Desde el panel de admin:

1. Ir a **Config > Códigos QR**
2. Ingresar el rango de mesas (ej: 1 a 20)
3. Click en **Generar QR**
4. Se genera un PDF con un QR por mesa, listo para imprimir

**Cada QR contiene:**
```
https://app.barqueue.com/{venue_slug}?mesa={table_number}
```

**Formato de impresión sugerido:**
- Stickers individuales para pegar en las mesas
- Tarjetas plastificadas tipo porta-menú
- Incluir texto: "Escanea para elegir la música" y el nombre del bar

---

## Analytics

Dashboard de analytics accesible desde el panel de admin.

### Métricas Disponibles

#### Canciones Populares
- Top 10/20 canciones más pedidas
- Filtrable por período (hoy, semana, mes, todo)
- Muestra veces pedida, último pedido

#### Horas Pico
- Gráfico de barras mostrando pedidos por hora del día
- Identifica cuándo hay más actividad musical
- Útil para planificar promociones o staffing

#### Mesas Más Activas
- Ranking de mesas por cantidad de canciones pedidas
- Útil para identificar zonas del bar más interactivas
- Puede informar distribución de QR o atención

#### Usuarios
- Usuarios únicos por noche
- Usuarios recurrentes (mismo teléfono en múltiples noches)
- Promedio de canciones por usuario

#### Co-ocurrencia de Canciones
- "Quienes pidieron X también pidieron Y"
- Patrones de gustos musicales del venue
- Útil para mejorar la playlist por defecto

#### Artistas/Géneros Trending
- Artistas más pedidos por período
- Tendencias de géneros musicales
- Evolución de gustos a lo largo del tiempo

### Exportar Datos

- Exportar historial como CSV
- Filtrable por rango de fechas
- Incluye: canción, artista, usuario (anonimizado), mesa, hora
