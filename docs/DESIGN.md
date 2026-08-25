# Repítela — Documento de Diseño y Especificación Visual de la Landing Page
**Versión:** 2.0  
**Fecha de actualización:** 2026-08-14  
**Proyecto:** Repítela (`landing/`)  
**Audiencia Objetivo:** Dueños, administradores y gerentes de bares, discotecas, gastrobares y eventos en Colombia y Latinoamérica.

---

## 1. Visión y Propósito del Rediseño

### 1.1 El Problema Actual de la Landing
1. **Estética Genérica:** Usa un fondo oscuro con tonos púrpuras genéricos (`hsl(252 85% 68%)`) y una foto de stock estática en el Hero en lugar de mostrar la interfaz real y el valor tangible del producto.
2. **Falta de Demostración Visual:** El cliente no "ve" la magia del producto en acción: cómo se conecta el celular del cliente con la pantalla del bar (Kiosk TV) en tiempo real.
3. **Copy Desenfocado:** No cuantifica el retorno de inversión (ROI) para el dueño del bar (aumento de permanencia, consumo por mesa y satisfacción del cliente).
4. **Falta de Interactividad:** La landing carece de componentes vivos (simulador interactivo, ecualizadores de audio animados, mockups sincronizados) que transmitan la atmósfera nocturna y musical.

### 1.2 Objetivos de Diseño
- **Transmitir "Nightlife Tech & Modern Vibe":** Una estética oscura, elegante y premium inspirada en los mejores locales nocturnos, con acentos vibrantes de color (Neón Sunset / Ámbar Eléctrico / Púrpura Profundo) y tipografía moderna con personalidad.
- **Mostrar el Producto Real (Show, Don't Tell):** Reemplazar fotos de stock por mockups interactivos duales: **Celular del Cliente (App Web)** ↔ **Pantalla Kiosk del Bar (TV 16:9)**.
- **Optimizar la Conversión B2B:** Facilitar la contratación directa a través de WhatsApp ($50.000 COP/mes) y generar confianza inmediata con cifras claras, ROI y configuración en 3 minutos.
- **Experiencia Móvil Impecable:** +70% del tráfico B2B abrirá la web desde Instagram/WhatsApp en su smartphone. El diseño debe ser 100% fluido y responsive.

---

## 2. Sistema de Diseño (Design System Tokens)

### 2.1 Paleta de Color Oficial (Brand Core & Tailwind Config)
Inspirada en el ambiente nocturno de bares: Obsidian profundo, contrastes precisos, acentos de neón energéticos y legibilidad WCAG AAA.

| Token de Marca | Hex | HSL (Tailwind) | RGB / Alpha | Contexto y Uso |
| :--- | :--- | :--- | :--- | :--- |
| **`brand.orange` (Primario)** | `#FF5522` | `16 100% 60%` | `rgb(255, 85, 34)` | **Color primario de marca.** CTAs principales, botones de acción (`.btn-primary`), badges de estado activo, foco/ring de accesibilidad, resplandores primarios (`glow-primary`). |
| **`brand.orange.dark` (Hover/Active)** | `#E04010` | `16 100% 47%` | `rgb(224, 64, 16)` | Estado hover y active de botones y elementos interactivos primarios. |
| **`brand.orange.soft` (Tinte)** | `rgba(255,85,34,0.15)` | `16 100% 60% / 0.15` | `rgba(255, 85, 34, 0.15)` | Fondos sutiles de badges, estados de selección, halos de iluminación en inputs. |
| **`brand.amber`** | `#FFB800` | `43 100% 50%` | `rgb(255, 184, 0)` | **Acento cálido / Atención.** Iconos de destacados (`sparkles`), indicador de "Sonando Ahora", tags de pricing ("COP/mes"). |
| **`brand.cyan` (Acento Neón)** | `#00C8FF` | `195 100% 50%` | `rgb(0, 200, 255)` | **Acento fresco.** Indicadores de reproducción en vivo, badges tecnológicos, feedback secundario. |
| **`brand.purple` (Secundario)** | `#A855F7` | `270 85% 65%` | `rgb(168, 85, 247)` | **Color secundario de marca.** Gradientes complementarios de títulos, ecualizadores de audio, fondos desenfocados. |

---

### 2.2 Superficies y Fondos (Dark Mode & Light Mode)

#### Dark Mode (Default)
| Token | Hex | HSL / Definición | Uso |
| :--- | :--- | :--- | :--- |
| **`brand.dark` (`--bg`)** | `#07070B` | `240 18% 4%` | Fondo base de la aplicación (Obsidian profundo). |
| **`brand.darker`** | `#040407` | `240 27% 2%` | Fondos de backdrops de diálogos y modales (`dialog::backdrop`). |
| **`brand.card` (`--bg-card`)** | `#161626` | `240 27% 12%` | Superficies de tarjetas, paneles laterales y contenedores modulares (elevado sobre fondo). |
| **`--bg-elevated`** | `#26263C` | `240 23% 19%` | Inputs de formulario, estados hover de cards, botones secundarios (`.btn-secondary`). |
| **`--border`** | `#3A3A56` | `240 19% 28%` | Bordes principales de componentes y separadores visuales. |
| **`--border-soft`** | `rgba(255,255,255,0.12)` | — | Bordes sutiles en tarjetas con efecto glassmorphism. |
| **`--text` (`--foreground`)** | `#F4F4F6` | `0 0% 98%` | Texto principal de alto contraste. |
| **`--text-muted`** | `#A6A6B8` | `240 11% 69%` | Subtítulos, labels secundarios y placeholders. |
| **`--kiosk-bg`** | `#000000` | `0 0% 0%` | Fondo negro puro e inmutable para la pantalla Kiosk de televisión. |

#### Light Mode
| Token | Hex | Uso |
| :--- | :--- | :--- |
| **`--bg`** | `#F5F5FA` | Fondo claro neutro para entornos iluminados. |
| **`--bg-card`** | `#FFFFFF` | Tarjetas y contenedores con elevación blanca limpia. |
| **`--bg-elevated`** | `#EBEBF2` | Campos de entrada y botones secundarios. |
| **`--border`** | `#D4D4E0` | Bordes y líneas divisorias. |
| **`--border-soft`** | `rgba(0,0,0,0.08)` | Bordes suaves. |
| **`--text`** | `#0E0E14` | Tipografía principal oscura de alta legibilidad. |
| **`--text-muted`** | `#525266` | Textos secundarios y metadatos. |
| **`--primary-dark`** | `#E04010` | Hover del botón primario en modo claro. |
| **`--primary-soft`** | `rgba(255,85,34,0.12)` | Fondos de badges y focos en modo claro. |

---

### 2.3 Estados Semánticos (Preservados)

| Estado | Dark Mode | Light Mode | Tinte Suave (`-soft`) | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Peligro (`--danger`)** | `#F87171` | `#DC2626` | `rgba(248, 113, 113, 0.15)` | Mensajes de error de autenticación, cancelar canción, advertencias destructivas. |
| **Alerta (`--warning`)** | `#FFB800` | `#D97706` | `rgba(255, 184, 0, 0.15)` | Estados de espera, límites de mesa alcanzados, avisos de moderación. |
| **Éxito (`--success`)** | `#34D399` | `#059669` | `rgba(52, 211, 153, 0.15)` | Canción agregada con éxito, sesión confirmada, verificación de conexión. |

---

### 2.4 Radios de Borde, Sombras y Glow

* **Radios de Borde:**
  - `--radius-sm`: `8px` (`0.5rem`) — Botones compactos, inputs y badges.
  - `--radius`: `12px` (`0.75rem`) — Botones principales, cards estándar de la aplicación.
  - `--radius-lg`: `16px` (`1rem`) — Modales, cards grandes y contenedores de vistas.
  - `rounded-2xl` / `rounded-3xl` (`20px` - `24px`): Contenedores hero y mockups en landing.

* **Sombras y Glow:**
  - `--shadow`: `0 1px 3px rgba(0, 0, 0, 0.4)`
  - `--shadow-glow-primary`: `0 0 30px rgba(255, 85, 34, 0.25), 0 0 60px rgba(255, 85, 34, 0.1)`
  - `--shadow-glow-sm`: `0 0 20px rgba(255, 85, 34, 0.18)`
  - `--shadow-glass`: `0 8px 32px 0 rgba(0, 0, 0, 0.45)`

* **Gradientes Oficiales:**
  ```css
  /* Gradiente de Marca para Títulos */
  .text-gradient-brand {
    background: linear-gradient(135deg, #FF6B35 0%, #FF2A6D 50%, #A855F7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Gradiente Primario para Botones CTA */
  .btn-primary-gradient {
    background: linear-gradient(to right, #FF5522, #FF6B35);
  }
  ```

---

### 2.5 Mapeo Bidireccional de Tokens (`landing/` ↔ `frontend/`)

| Concepto de Diseño | Token `landing/` (Tailwind / CSS Vars) | Token `frontend/src/style.css` | Valor Dark | Valor Light |
| :--- | :--- | :--- | :--- | :--- |
| **Primario** | `hsl(var(--primary))` / `brand.orange` | `--primary` | `#FF5522` | `#FF5522` |
| **Primario Hover** | `hover:opacity-90` / `from-primary to-orange-500` | `--primary-dark` | `#E04010` | `#E04010` |
| **Primario Soft** | `bg-primary/15` | `--primary-soft` | `rgba(255, 85, 34, 0.15)` | `rgba(255, 85, 34, 0.12)` |
| **Texto en Primario** | `hsl(var(--primary-foreground))` | `--text-on-primary` | `#FFFFFF` | `#FFFFFF` |
| **Secundario** | `hsl(var(--secondary))` / `brand.purple` | `--secondary` | `#A855F7` | `#9333EA` |
| **Acento** | `hsl(var(--accent))` / `brand.cyan` | `--accent` | `#00C8FF` | `#0099CC` |
| **Fondo Base** | `hsl(var(--background))` / `brand.dark` | `--bg` | `#07070B` | `#F5F5FA` |
| **Fondo Tarjeta** | `hsl(var(--card))` / `brand.card` | `--bg-card` | `#161626` | `#FFFFFF` |
| **Fondo Elevado** | `bg-white/10` / `glass-card` | `--bg-elevated` | `#26263C` | `#EBEBF2` |
| **Texto Principal** | `hsl(var(--foreground))` | `--text` | `#F4F4F6` | `#0E0E14` |
| **Texto Secundario** | `hsl(var(--muted-foreground))` | `--text-muted` | `#A6A6B8` | `#525266` |
| **Borde** | `hsl(var(--border))` | `--border` | `#3A3A56` | `#D4D4E0` |
| **Borde Suave** | `border-white/15` | `--border-soft` | `rgba(255, 255, 255, 0.12)` | `rgba(0, 0, 0, 0.08)` |
| **Anillo de Foco** | `hsl(var(--ring))` | `--ring` (usado en `:focus-visible`) | `#FF5522` | `#FF5522` |
| **Peligro / Error** | `hsl(var(--destructive))` | `--danger` | `#F87171` | `#DC2626` |
| **Advertencia** | `brand.amber` | `--warning` | `#FFB800` | `#D97706` |
| **Éxito** | `emerald-500` / `text-emerald-400` | `--success` | `#34D399` | `#059669` |
| **Kiosk Black** | `#000000` | `--kiosk-bg` | `#000000` | `#000000` |

---

### 2.6 Sistema de diseño de la aplicación

Esta sección documenta la aplicación Vue, no la landing. Se mantiene aquí porque los
tokens son el puente visual entre ambas superficies; no es un plan de trabajo.

La aplicación usa tokens CSS para superficies (`--bg`, `--bg-card`,
`--bg-elevated`), texto (`--text`, `--text-muted`), marca (`--primary`,
`--primary-dark`, `--primary-soft`, `--text-on-primary`), bordes y sombras, estados
semánticos (`--success`, `--warning`, `--danger`) y geometría
(`--radius`, `--radius-sm`, `--radius-lg`). Los tokens separan la identidad del bar
de los significados operativos: los estados y la geometría permanecen consistentes
en toda la app.

Un venue puede seleccionar un preset de tema o personalizar `accent`, `bg`, `text`
y `mode`. No puede alterar los tokens semánticos ni los radios: un tema no debe
cambiar el significado de éxito, advertencia o error, ni romper la geometría común.

Se extrae un componente o composable cuando tiene estado o lógica propios, o cuando
su interfaz se usa en más de una vista. Antes de extraer, se revisan `components/`,
`composables/` y `stores/`; todo componente reutilizable debe tener un consumidor
real.

---

## 3. Estructura y Wireframe de la Landing Page

La página se organiza en **9 secciones estratégicas**, optimizadas para el embudo de conversión B2B:

```mermaid
graph TD
  A[1. Navbar Fijo con CTA Directo] --> B[2. Hero: Hook + Dual Mockup TV/Móvil]
  B --> C[3. Social Proof & Marquee de Bares]
  C --> D[4. El Dilema del Bar: Antes vs Con Repítela]
  D --> E[5. Cómo Funciona en 3 Pasos Simples]
  E --> F[6. Beneficios Clave para el Dueño del Bar]
  F --> G[7. Pricing Transparente: $50.000 COP]
  G --> H[8. FAQ & CTA Final WhatsApp]
```

---

### Detalle por Sección:

### Sección 1: Navbar
- **Logo:** Icono de nota musical + tipografía "Repítela" con badge `V2.0`.
- **Links de navegación:**
  - ¿Cómo funciona? (`#como-funciona`)
  - Para tu Bar (`#para-bares`)
  - Simulador (`#simulador`)
  - Precios (`#precio`)
  - Preguntas (`#faq`)
- **Acceso Clientes / Admin:** Enlace discreto "Ingresar a mi Bar" (`https://app.repitela.com/admin`).
- **CTA Destacado:** Botón `Activar mi Bar — $50k/mes`.

---

### Sección 2: Hero Section (Impacto & Dual Mockup)
- **Badge Superior:** `🔥 El Jukebox Digital #1 para Bares en Colombia` (con icono de fuego y pulso de audio).
- **Titular (H1):**
  > **La música la ponen tus clientes.**  
  > <span class="text-gradient-brand">El control y las ganancias, tú.</span>
- **Subtítulo:**
  > Tus clientes escanean el QR de la mesa, buscan su canción favorita de YouTube y la encolan al instante. Tu televisor reproduce los videos sin publicidad y tu bar se llena de energía.
- **Acciones (CTAs):**
  - **Botón Primario:** `🚀 Empezar prueba gratis (WhatsApp)`
  - **Botón Secundario:** `▶ Ver cómo funciona (30s)` o `Probar simulador`
- **Métricas Rápidas:**
  - ⚡ **0 descargas:** Funciona directo en el navegador web móvil.
  - ⏱️ **Setup en 3 min:** Solo necesitas una pantalla o Smart TV con navegador.
  - 🚫 **Cero silencios:** Playlist de respaldo automática cuando la cola se vacía.
- **Visual Hero (Dual Mockup Interactivo):**
  - **Izquierda/Centro (Laptop/TV Kiosk):** Mockup de pantalla 16:9 con video de YouTube simulado, barra de progreso personalizada, logo del bar en la esquina, indicador "Sonando ahora: Shakira - Te Felicito", y un mini QR animado de escaneo.
  - **Derecha (Móvil del Cliente en perspectiva):** Mockup de iPhone mostrando la barra de búsqueda "Buscar canción en YouTube...", lista de canciones en cola con avatars de los clientes en cada mesa y botón "Pedir Canción".

---

### Sección 3: Social Proof & Bares en Vivo
- **Ticker / Marquee animado:**
  "Sonando ahora en más de 45 bares y gastrobares en Bogotá, Medellín, Cali y Cartagena 🇨🇴".
- **Tarjetas de Estadísticas Clave:**
  - **+35%** en tiempo promedio de permanencia por mesa.
  - **4.9/5** estrellas de satisfacción de clientes.
  - **>120.000** canciones reproducidas sin interrupciones.

---

### Sección 4: El Dilema del Bar (Antes vs Con Repítela)
Una comparativa visual clara que ataca los dolores tradicionales del dueño del bar:

| El Bar Tradicional ❌ | Con Repítela ✅ |
| :--- | :--- |
| El mesero o bartender pierde tiempo cambiando canciones en Spotify o YouTube. | **100% automático:** Los clientes encolan desde su celular sin molestar al staff. |
| Clientes insatisfechos porque nunca suena su canción o pelean por el cable auxiliar. | **Cola democrática y justa:** Todos ven su turno en pantalla en tiempo real. |
| Pantallas de TV apagadas o mostrando videos genéricos con comerciales molestos. | **Pantalla Kiosk profesional:** Videos limpios con tu logo, banner publicitario y QR. |
| Si nadie pide música, el bar queda en silencio incómodo. | **Playlist de respaldo inteligente:** Música continua que se adapta automáticamente. |

---

### Sección 5: Cómo Funciona en 3 Pasos (Visual & Simple)
1. **Paso 1: El Bar crea su cuenta en 3 min**
   - Configura el nombre del bar, sube su logo, elige sus colores y conecta la pantalla del TV.
2. **Paso 2: El cliente escanea el QR en la mesa**
   - Abre la cámara de su celular, digita su nombre y número. ¡Sin descargar apps pesadas!
3. **Paso 3: ¡La fiesta empieza!**
   - El cliente busca en YouTube, encola su canción y la pantalla del bar la reproduce en alta definición.

---

### Sección 6: Simulador Interactivo en Vivo ("Live Demo")
Un componente interactivo en la landing page donde el usuario puede:
- Escribir un nombre de canción de prueba (ej: *Bad Bunny, Queen, Carlos Vives*).
- Presionar **"Encolar"** y ver cómo la canción entra a una simulación de la cola en vivo.
- Ver el estado cambiar a "🎵 ¡Tu canción es la siguiente en sonar!".
- *Call to action contextual:* "¿Te imaginas esto en las pantallas de tu bar? Actívalo hoy mismo".

---

### Sección 7: Características del Panel de Control (Command Center)
Explicación detallada de las 4 suites de herramientas incluidas:
1. **📺 Pantalla Kiosk para TV:**
   - Modo pantalla completa sin interfaz de YouTube.
   - Logo del bar y colores corporativos personalizados.
   - QR inteligente que aparece y desaparece en ciclos configurables.
   - Banner de promociones del bar (ej: "2x1 en Cócteles hasta las 9 PM").
2. **🎛️ Panel de Control para el Administrador:**
   - Reordenar canciones con Drag & Drop.
   - Saltar canciones inapropiadas con un clic.
   - Control de volumen centralizado y botón de mute.
   - Moderación de usuarios y límites de canciones por mesa.
3. **📊 Métricas y Analíticas en Tiempo Real:**
   - Top 10 artistas más pedidos en tu bar.
   - Horarios pico de mayor interacción musical.
   - Clientes recurrentes y frecuencia de visita.
4. **🛡️ Seguridad & Anti-Trolls:**
   - Límite de canciones por usuario (ej: máx. 5 canciones cada 30 min).
   - Verificación física opcional por PIN del día.
   - Salto automático de videos con restricciones geográficas o copyright.

---

### Sección 8: Pricing Transparente (Sin Letra Pequeña)
Una sola tarjeta destacada, con diseño premium y alto impacto:

- **Precio:** **$50.000 COP / mes**
- **Para los clientes:** **100% Gratis** (sin micro-cobros ni monedas virtuales).
- **Incluye:**
  - ✅ Canciones y búsquedas ilimitadas en YouTube.
  - ✅ Pantalla Kiosk HD para televisores ilimitados.
  - ✅ Panel de administración completo para PC y Móvil.
  - ✅ Código QR imprimible en alta resolución con logo del bar.
  - ✅ Playlist de respaldo automática (Pop, Rock, Reggaeton, Crossover).
  - ✅ Banner publicitario para promociones de tu carta/licores.
  - ✅ Soporte prioritario por WhatsApp 24/7.
  - ✅ **Garantía:** Sin contratos de permanencia. Cancela cuando quieras.
- **CTA:** Botón gigante verde WhatsApp `📲 Activar mi Bar por WhatsApp`.

---

### Sección 9: Preguntas Frecuentes (Accordion) & Footer
- **FAQ:**
  1. *¿Necesito comprar equipos o computadores costosos?* -> No, cualquier Smart TV, Chromecast, Fire TV Stick o computador con navegador web sirve.
  2. *¿Los clientes tienen que pagar por pedir canciones?* -> No, para los clientes es totalmente gratis, lo que incentiva que consuman más en el bar.
  3. *¿Qué pasa si ponen una canción que no va con el estilo de mi bar?* -> Tienes control total desde tu celular: puedes saltarla, pausarla o eliminarla al instante.
  4. *¿Cómo recibo los códigos QR para las mesas?* -> El sistema te genera un archivo PDF listo para imprimir con el logo y colores de tu bar.
  5. *¿Cómo se realiza el pago mensual?* -> Por transferencia Bancolombia, Nequi, Daviplata o tarjeta de crédito.

- **Footer:**
  - Enlaces a términos, privacidad, soporte, redes sociales (`@repitela.musica`), y badge de "Hecho con orgullo en Colombia 🇨🇴".

---

## 4. Componentes a Crear / Refactorizar en `landing/src/`

Para llevar a cabo este diseño, los archivos de la landing se organizarán de la siguiente manera:

```
landing/src/
├── components/
│   ├── landing/
│   │   ├── Navbar.tsx             # Navbar translúcido con blur y botón WhatsApp
│   │   ├── Hero.tsx               # Hero con H1 impactante, copy optimizado y Dual Mockup
│   │   ├── DualMockup.tsx         # Componente visual: TV Kiosk + Mobile App sincronizados
│   │   ├── SocialProof.tsx        # Ticker de bares, métricas de retención y testimonios
│   │   ├── PainVsGain.tsx         # Comparativa visual Antes vs Después con Repítela
│   │   ├── HowItWorks.tsx         # 3 pasos interactivos con animaciones
│   │   ├── InteractiveDemo.tsx    # Simulador en vivo de pedir canción
│   │   ├── FeatureGrid.tsx        # 4 pilares: Kiosk, Admin, Analytics, Moderación
│   │   ├── ROICalculator.tsx      # Calculadora de ventas adicionales por mesa
│   │   ├── Pricing.tsx            # Tarjeta de precio $50.000 COP con garantía
│   │   ├── FAQ.tsx                # Preguntas frecuentes en Accordion accesible
│   │   ├── CTAFinal.tsx           # Bloque de cierre con botón de contacto
│   │   ├── Footer.tsx             # Footer completo con copyright y contacto
│   │   └── SoundEqualizer.tsx     # Micro-componente de ondas de sonido animadas
│   └── ui/                        # Componentes Radix / Shadcn (Button, Accordion, Dialog, etc.)
├── index.css                      # Variables de diseño, animaciones y tokens
└── tailwind.config.ts             # Configuración de colores, sombras y animaciones
```

---

## 5. Especificaciones Técnicas y Rendimiento

1. **Rendimiento Web Vitals:**
   - **LCP (Largest Contentful Paint):** `< 1.2s` (cargar mockups vectoriales/SVG o WebP optimizados sin dependencias pesadas).
   - **CLS (Cumulative Layout Shift):** `0.00` (reserva de altura fija en el Hero y sliders).
   - **Accesibilidad (a11y):** Contraste superior a 4.5:1 en todos los textos sobre fondos oscuros.
2. **SEO & OpenGraph:**
   - Meta title: `Repítela | El Jukebox Digital para Bares y Discotecas`
   - Meta description: `Convierte tu bar en una experiencia interactiva. Tus clientes piden canciones desde su celular y suenan en tus televisores. $50.000/mes.`
   - OpenGraph Image: Mockup 1200x630px del Kiosk TV y el celular con el logo de Repítela.
3. **Tracking & Analytics:**
   - Eventos GTM / GA4 configurados en cada botón de WhatsApp (`repitela_cta_whatsapp_click`).
   - Tracking del simulador interactivo (`repitela_interactive_demo_submit`).

---

## 6. Plan de Ejecución

1. **Fase 1: Tokens y Base CSS (`tailwind.config.ts` + `index.css`)**
   - Actualizar variables HSL a la paleta Obsidian & Sunset Orange.
   - Definir clases utilitarias (`.glass-card`, `.text-gradient-brand`, `.glow-primary`).
2. **Fase 2: Mockups Visuales e Interactividad**
   - Desarrollar `DualMockup.tsx` y `SoundEqualizer.tsx`.
   - Crear `InteractiveDemo.tsx` (Simulador de cola en vivo).
3. **Fase 3: Refactorización de Secciones de Contenido**
   - Actualizar `Hero.tsx`, `SocialProof.tsx`, `HowItWorks.tsx`, `PainVsGain.tsx`.
   - Refactorizar `Pricing.tsx` y `CTAFinal.tsx` con el copy B2B refinado.
4. **Fase 4: QA, Mobile Testing & Deploy**
   - Validar navegación en resoluciones de 360px a 4K.
   - Comprobar enlaces de WhatsApp con mensajes prellenados.
