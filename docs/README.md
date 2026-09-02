# Wiki del proyecto — Repítela

Índice de `docs/`. **Se lee primero**, antes que Linear o cualquier otra fuente.

Esquema wiki-llm: una página por cosa, kebab-case, enlaces `[[pagina]]`, toda
afirmación con su origen, fecha en lo que caduca. Un enlace a una página que no
existe todavía está bien — marca un hueco por llenar.

## Cómo se usa

**Los hechos entran, los enlaces salen.** Linear y Notion son material de
entrada: de ahí se extrae el hecho durable y se cita el origen
(`(source: WIL-129)`). Nunca al revés — una copia en dos sitios diverge, y la
del repo gana porque es la que se revisa en un PR.

Autoridad, cuando dos fuentes se contradicen:

| Fuente | Manda sobre | Nunca manda sobre |
|---|---|---|
| `docs/` | cómo funciona el sistema y por qué se eligió | estado del trabajo, precio al cliente |
| Linear | estado, intención, prioridad, quién | cómo funciona el sistema |
| Notion | negocio y uso: precios, acuerdos, guías | arquitectura, convenciones, decisiones |

Una contradicción es un hallazgo, no un fastidio: se resuelve y se anota aquí
cuál ganó y por qué.

## Páginas

La fecha es la del último commit que tocó el archivo. **Una fecha vieja no
significa que esté mal — significa que nadie lo ha verificado desde
entonces.** `rev. <fecha>` sí es una revisión contra el código.

Las páginas revisadas el 2026-09-02 llevan marcadas con ⚠️ las afirmaciones
que el código **no cumple**. Se dejan escritas en vez de borrarlas: la regla
que alguien creyó cierta es la que hay que rastrear.

### Cómo funciona el sistema

| Página | Sobre qué manda | Últ. cambio |
|---|---|---|
| [[api]] | Los 86 endpoints: cuerpo, respuesta, errores, eventos | 2026-08-25 |
| [[arquitectura]] | Topología del backend y flujo de una petición | 2026-08-25 |
| [[arquitectura-frontend]] | Capas del frontend, naming, techos de línea, Storybook | 2026-08-27 |
| [[modelo-de-datos]] | Las 16 tablas y sus relaciones | 2026-08-25 |
| [[eventos-tiempo-real]] | Qué manda el WebSocket y cuándo | rev. 2026-09-02 |
| [[reglas-de-negocio]] | Límites, cola, suscripción, roles | rev. 2026-09-02 |

### Operar

| Página | Sobre qué manda | Últ. cambio |
|---|---|---|
| [[despliegue]] | Dokploy, variables, backups a R2, staging | rev. 2026-09-02 |
| [[capacidad]] | Cuántos bares aguanta y dónde se rompe | 2026-08-25 |
| [[entorno-local]] | Levantar el proyecto en una máquina | rev. 2026-09-02 |
| [[contribuir]] | Ramas, commits, PRs | 2026-09-01 |
| [[plan-de-pruebas]] | Qué se prueba y cómo | 2026-08-25 |
| [[analitica]] | Qué se mide, convención de UTM y los QR | rev. 2026-09-02 |

### Producto y diseño

| Página | Sobre qué manda | Últ. cambio |
|---|---|---|
| [[features]] | **Índice de lo que ya existe.** Se lee antes de proponer nada | 2026-09-02 |
| [[flujo-de-usuario]] | El recorrido de cliente, admin y superadmin | 2026-08-25 |
| [[guia-del-bar]] | Cómo opera un dueño de bar su panel | 2026-08-11 ⚠️ |
| [[sistema-de-diseno]] | Temas, tokens, logo y las trampas de Storybook | 2026-09-01 |
| [[diseno-landing]] | Especificación visual de la landing pública | 2026-08-25 |

### Por qué se eligió lo que hay

Una página por decisión cara de revertir, con su porqué **real** y su costo de
salida. Ninguna de estas cuatro se decidió conscientemente; se registran igual.

- [[decisions/sqlite-como-base]] — el techo de escala del producto
- [[decisions/sql-a-mano-sin-orm]] — 139 `execute()` que atan a SQLite
- [[decisions/vue-sin-typescript]] — por qué el contrato con el backend solo existe en prosa
- [[decisions/dokploy-y-deploy-desde-main]] — `main` es producción

### Auditoría

`reviews/` es una foto del 2026-09-02, no una página viva. **No se actualiza al
cambiar el código**: cuando un hallazgo se cierra, el hecho durable se sube a la
página que corresponda y el issue de Linear lo enlaza.

- [[reviews/INDEX]] — los 50 hallazgos en 12 fases, con su orden de ataque

## Fuera del esquema

`gtm-container.json`, `gtm-landing-events.json` y `wireframe-superadmin.html` no
son páginas: son artefactos que se consumen, no que se lean.

## Mantenimiento

- Un PR que cambia comportamiento actualiza su página en el **mismo PR**.
- [[features]] se actualiza al **entregar**, no al planear.
- Una decisión que dejó de ser cierta se marca `Estado: superada por [[otra]]`.
  No se borra: el porqué del cambio vale tanto como la decisión.
- Una página que nadie enlaza y nadie lee, se borra.
