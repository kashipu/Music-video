# Marcar con UTM los QR de mesa y de pantalla

**Estado:** implementada — pendiente de verificar en `staging`
**Linear:** [WIL-226](https://linear.app/william-moreno/issue/WIL-226/todo-el-que-entra-escaneando-un-qr-en-un-bar-aparece-en-analytics-como)

## Objetivo

Que el equipo pueda separar en GA4 cuánta gente entra escaneando el QR **de su
mesa** frente al **de la pantalla**, para decidir si vale la pena imprimir más
mesas o agrandar el QR de la TV.

## Ya existente

Revisado `docs/features.md`. Los dos QR ya existen —"QR en pantalla" en el
kiosco y "QR" en el panel de operación— y la app ya lleva el contenedor de GTM
(`GTM-PPVKNTZB`, `frontend/index.html:9`). Esto es una **mejora de medición**,
no una feature nueva: no se monta nada de analítica.

La convención de UTM y la regla "la UTM va en el redirect, no en el código" ya
están fijadas y verificadas en producción con el sticker de la landing —
`docs/analitica.md`, sección *Convención de UTM*. Esta spec la aplica, no la
redefine.

**Momento:** confirmado el 2026-09-03 que **no hay ningún QR de mesa impreso
todavía** y que **ningún bar tiene `qr_url` manual**. Se entra en limpio: no hay
piezas viejas que queden sin marcar ni bares que haya que tratar aparte.

## Alcance

Dos rutas de redirect nuevas en el nginx del frontend, y los dos QR apuntando a
ellas:

| QR | Hoy apunta a | Pasa a apuntar a | El redirect 302 lleva a |
|---|---|---|---|
| De mesa (`useAdminDashboard.js:110-117`) | `/{slug}/registro` | `/{slug}/a` | `/{slug}/registro?utm_source=mesa&utm_medium=qr` |
| De pantalla (`Kiosk.vue:18-19`) | `/{slug}/registro` | `/{slug}/v` | `/{slug}/registro?utm_source=pantalla&utm_medium=qr` |

Sin `utm_campaign`: el bar ya va en la ruta y GA4 segmenta por página de destino.

**La letra nombra la superficie, no el destino** — `/a` lo imprime el panel
admin, `/v` está en la pantalla de video, igual que el `/s` de la landing. Una
letra y no dos (`/a`, no `/ad`): cuestan lo mismo en módulos, pero "ad" es lo que
más filtran los bloqueadores y el fallo se vería como una página en blanco.
La convención completa, con el techo de 17 caracteres de slug, en `docs/analitica.md`.

El redirect sigue siendo la forma correcta aunque todavía no haya nada impreso,
por las dos razones de `docs/analitica.md`: la UTM inline sube el QR de 37 a 49
módulos —y el de pantalla se escanea desde la mesa, el caso más exigente— y en
cuanto se imprima la primera tanda, la marcación se podrá cambiar sin reimprimir.

Tres detalles que no son opcionales, aprendidos desplegando el `/s` de la landing:

- **302, no 301.** El 301 se cachea de forma permanente en el teléfono y el
  destino deja de poder cambiarse en quien ya escaneó.
- **`absolute_redirect off;`** en `frontend/nginx.conf`. Nginx corre detrás de
  Traefik, que termina el TLS; sin esa directiva reconstruye el `Location` en
  `http://` y cada escaneo paga un salto extra.
- Las nuevas `location` van con regex (`~`), que gana al `location /` del
  catch-all de la SPA. El slug capturado se acota a `[A-Za-z0-9_-]+` para no
  reflejar cualquier cosa en la cabecera `Location`.

El texto que se imprime debajo del QR pasa a ser también `/{slug}/a`: más corto
de teclear y coherente con lo que el código encodea.

Actualizar la tabla de *Piezas vivas* de `docs/analitica.md` con las dos piezas
nuevas, y `docs/features.md` al entregar.

## No-alcance

- **No se meten las UTM dentro del QR.** Medido en `docs/analitica.md`: 49
  módulos contra 37.
- **`qr_url` manual sigue respetándose tal cual.** Hoy no lo usa ningún bar; si
  algún día se fija uno a mano, ese QR va sin marcar y es responsabilidad de
  quien lo puso. No se le inyectan parámetros.
- **No funciona en `npm run dev`.** El redirect vive en nginx, no en Vite: en
  local `/{slug}/a` da 404. Es aceptable — se verifica en `staging`.
- No se añade `utm_campaign`, ni un tercer canal, ni informes nuevos en GA4.

## Criterios de aceptación

- [ ] Escanear el QR de la pantalla abre `/{slug}/registro?utm_source=pantalla&utm_medium=qr`
      y el registro funciona igual que hoy.
- [ ] Escanear el QR impreso desde el panel abre `/{slug}/registro?utm_source=mesa&utm_medium=qr`.
- [x] El nginx responde **302** en `/{slug}/a` y `/{slug}/v`, con `Location`
      relativo (`absolute_redirect off`), y `registro` / `admin` / `video` /
      `/superadmin` siguen sirviendo la SPA con 200. Verificado el 2026-09-03
      levantando `frontend/nginx.conf` contra el `dist` real.
- [ ] Repetido contra `https://st.repitela.com/{slug}/a`, con `Location` en `https://`.
- [ ] En GA4 el tráfico aparece agrupado bajo `medium=qr` y separable por
      `source` en `mesa` / `pantalla`, junto al `sticker` de la landing.
- [x] El QR no gana módulos: `/{slug}/a` es más corto que `/{slug}/registro`.
- [x] Un slug inexistente en `/{slug}/a` no rompe: redirige y la SPA muestra lo
      mismo que antes para un bar que no existe.
- [x] `docs/analitica.md` lista las dos piezas nuevas en *Piezas vivas*.

## Decisiones que abre

Ninguna. Todo reversible: son dos `location` en `frontend/nginx.conf` y dos
cadenas en el frontend. La convención de UTM ya está decidida en
`docs/analitica.md`.
