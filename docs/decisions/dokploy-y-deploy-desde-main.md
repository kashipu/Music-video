# Dokploy, un solo servidor, y `main` = producción

**Estado:** vigente, con mitigación parcial · **Registrada el:** 2026-09-02

## Qué se decidió

Despliegue con Dokploy (self-hosted, v0.30.2) sobre Docker Compose, en un
servidor de **2 vCPU / 1 GB compartido con otros proyectos**. Cada push a `main`
dispara build y despliegue a producción.

## Por qué, de verdad

Es el panel que ya se usaba para los demás proyectos del mismo servidor. Costo
marginal cero para arrancar.

## Qué obliga

- **No hay ensayo antes de producción.** Una migración mala en `main` llega a los
  bares sin escala intermedia. Agravado porque no hay CI (F1).
- **Se construye en la máquina de producción.** Cada push corre dos `npm ci` +
  `npm run build` + `pip install` en el mismo servidor que está atendiendo bares.
- **Preview Deployments de Dokploy no aplican**: no funcionan en proyectos
  Docker Compose, y este lo es.

## Mitigación puesta el 2026-09-02

- **Staging** en `st.repitela.com`, como *Environment* del mismo proyecto
  (no un segundo proyecto: Dokploy v0.30 tiene Environments). Rama `staging`,
  **auto-deploy apagado** para que sus builds no compitan con los bares.
- **Backups** del volumen a Cloudflare R2, diarios, retención 14.

## Deuda que queda

La configuración de infraestructura —environments, dominios, variables, backups,
schedules— **vive solo en el panel de Dokploy**. No está declarada en el repo. Si
hay que rehacerla, la fuente de verdad es una UI.

## Costo de salida

**Bajo para mover el build** (publicar imágenes desde CI y que el Compose de
producción use `image:` en vez de `build:` — F5b).
**Alto para cambiar de plataforma**, y no hay razón: Dokploy trae resueltas
varias cosas que aún están sin usar (notificaciones, monitoreo, rollbacks).
