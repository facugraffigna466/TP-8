# Estrategia de CI/CD, Registry y Despliegues

## 1. Container Registry

- **Servicio elegido:** GitHub Container Registry (`ghcr.io`).
- **Justificación:** Permite alojar imágenes privadas o públicas en el mismo ecosistema del código fuente, reutiliza el `GITHUB_TOKEN` para autenticación, soporta políticas de retención y versionado automático y no requiere infraestructura extra.
- **Configuración:**
  1. Habilitar `GHCR` en la organización o cuenta personal (no requiere pasos adicionales si ya se usa GitHub).
  2. Crear un Personal Access Token (Classic) con scopes `read:packages` y `write:packages` para integraciones externas (Azure) y guardarlo como secreto `GHCR_TOKEN` en GitHub.
  3. Añadir un secreto `GHCR_USERNAME` con el nombre de usuario que generó el token.
  4. (Opcional) Configurar reglas de retención/visibilidad en <https://github.com/settings/packages>.
- **Integración en el pipeline:** El workflow `.github/workflows/ci-cd.yml` inicia sesión en `ghcr.io`, construye las imágenes `backend` y `frontend` y las publica con tags `latest` y `<rama>-<runNumber>`. Estas imágenes son la fuente de despliegue para QA y PROD.

## 2. Ambiente QA

- **Servicio elegido:** Render.com (servicios Docker privados).
- **Justificación:** Render ofrece nivel gratuito/asequible, despliegue sencillo de contenedores, soporte para imágenes alojadas en registries externos (GHCR) y aprovisiona HTTPS automáticamente. Es ideal para QA por su time-to-deploy rápido y porque no requiere infraestructura propia.
- **Configuración recomendada:**
  - Crear dos servicios Docker (uno para backend y otro para frontend) en un equipo o cuenta dedicado a QA.
  - En cada servicio, seleccionar “Deploy an existing image” e indicar:
    - `Image URL`: `ghcr.io/<owner>/<repo>/backend:<TAG>` o `frontend:<TAG>` (usar `qa` como valor inicial; el pipeline actualizará la etiqueta exacta en cada despliegue).
    - `Registry` → “Custom”: usuario `GHCR_USERNAME`, contraseña `GHCR_TOKEN`.
  - Variables de entorno QA:
    - Backend: `PORT=8080`, `CORS_ORIGIN=https://<qa-frontend>.onrender.com`, `DATABASE_URL=<cadena PostgreSQL gestionada (Railway/Render)>`, `PGSSL=true` (necesario para conexiones TLS).
    - Frontend: `API_URL=https://<qa-backend>.onrender.com`.
  - Recursos sugeridos QA:
    - Backend: plan Starter, 0.5 vCPU, 512 MB RAM, 1 réplica.
    - Frontend: plan Starter, 0.1 vCPU, 256 MB RAM, 1 réplica.
- **Deploy:** El job `deploy-qa` invoca la API GraphQL de Render para actualizar el servicio con la imagen versionada que se generó en la etapa de build.

## 3. Ambiente PROD

- **Servicio elegido:** Render.com (mismo proveedor para simplificar operaciones) en un equipo/servicios separados.
- **Justificación:** Mantener Render reduce el contexto operativo y permite segregar recursos usando servicios independientes. En producción se incrementan CPU/RAM y réplicas para alta disponibilidad.
- **Configuración recomendada:**
  - Crear dos servicios Docker adicionales (backend y frontend prod) apuntando inicialmente a la etiqueta `prod`.
  - Variables de entorno PROD:
    - Backend: `PORT=8080`, `CORS_ORIGIN=https://<prod-frontend>.onrender.com`, `DATABASE_URL=<cadena PostgreSQL productiva>`, `PGSSL=true`.
    - Frontend: `API_URL=https://<prod-backend>.onrender.com`.
  - Recursos PROD:
    - Backend: 1 vCPU, 2 GB RAM, mínimo 2 réplicas, máximo 4.
    - Frontend: 1 vCPU, 1 GB RAM, mínimo 2 réplicas, máximo 4.
  - Activar métricas/alertas en Render + Integraciones con Datadog o Prometheus si se necesita monitoreo centralizado.
- **Segregación:** QA y PROD usan servicios y dominios distintos; la configuración se almacena en environments separados en GitHub (`qa` y `prod`) para forzar aprobaciones.

## 4. Pipeline CI/CD

El workflow `CI/CD - TP-8` automatiza el proceso completo:

1. **Build & Test (`build-and-test`):**
   - Instala dependencias con `npm install` (no hay lockfile aún).
   - Ejecuta build del frontend como “smoke test”.
   - Paso placeholder para pruebas del backend (se puede sustituir por Jest/Supertest).
2. **Build & Push (`build-and-push`):**
   - Calcula una etiqueta inmutable `<rama>-<runNumber>`.
   - Construye imágenes dockerizadas de backend y frontend.
   - Publica las imágenes en `ghcr.io/<repo>` con las etiquetas:
     - `latest` (para debugging manual).
     - `<rama>-<runNumber>` (usada en despliegues automáticos).
3. **Deploy QA (`deploy-qa`):**
   - Ejecuta los Deploy Hooks de Render (`QA_BACKEND_DEPLOY_HOOK`, `QA_FRONTEND_DEPLOY_HOOK`) enviando la imagen versionada publicada en GHCR.
   - Se asocia al environment `qa` de GitHub; se pueden agregar revisores opcionales.
4. **Deploy PROD (`deploy-prod`):**
   - Requiere aprobación manual del environment `prod`.
   - Reutiliza el mismo tag publicado en GHCR para garantizar paridad QA→PROD.
   - Dispara los hooks de Render para backend y frontend productivo utilizando la misma imagen versionada.

### Quality Gates y Segregación

- El environment `prod` en GitHub debe configurarse con “Required reviewers” para habilitar un gate manual.
- Los secretos sensibles (`RENDER_*`, URLs finales) se guardan en environments separados (QA/PROD) y no se comparten.
- El pipeline solo corre en `main` o bajo `workflow_dispatch`, evitando despliegues accidentales desde ramas experimentales.

### Gestión de Secretos en GitHub

Registrar los siguientes secretos (según environment adecuado):

| Secreto | Uso |
|---|---|
| `QA_BACKEND_DEPLOY_HOOK`, `QA_FRONTEND_DEPLOY_HOOK` | URLs de Deploy Hook para los servicios QA. |
| `PROD_BACKEND_DEPLOY_HOOK`, `PROD_FRONTEND_DEPLOY_HOOK` | URLs de Deploy Hook para los servicios PROD. |
| `GHCR_TOKEN` | PAT con scopes `read:packages` y `write:packages` (Render lo usará para descargar imágenes privadas). |
| `GHCR_USERNAME` | Usuario dueño del PAT anterior (solo necesario al crear servicios en Render). |

> **Tip:** Los IDs y tokens pueden definirse a nivel de environment (`qa`, `prod`) en la pestaña *Settings → Environments* para reforzar la segregación.

## 5. Render – Primer Aprovisionamiento

Pasos sugeridos por ambiente (QA/PROD):

1. Crear servicio backend (Docker) seleccionando “Deploy an existing image” e introduciendo `ghcr.io/<owner en minúsculas>/tp-8/backend:qa` (o `:latest` para el primer despliegue).
2. Configurar variables: `PORT=8080`, `CORS_ORIGIN=<url del frontend>` y `DATABASE_URL=<cadena PostgreSQL con sslmode=require>`.
3. Crear servicio frontend (Static) apuntando a `ghcr.io/<owner>/tp-8/frontend:qa` y puerto `80`. Definir `API_URL` con la URL pública del backend.
4. Repetir los pasos 1-3 para PROD (cambiando las URLs y la cadena `DATABASE_URL`).
5. Generar los Deploy Hooks desde *Settings → Deploy Hooks* para cada servicio y guardarlos en GitHub como secretos.

> Una vez creado el pipeline, la primera ejecución manual (`workflow_dispatch`) publicará una nueva imagen con tag `<rama>-<runNumber>`. Esa misma ejecución reconfigurará los servicios para usar el tag versionado, garantizando que QA y PROD corren exactamente la misma build.

## 6. Próximos pasos sugeridos

- Añadir suites de pruebas automatizadas para backend y frontend.
- Incluir escaneo de vulnerabilidades (`trivy`, `npm audit`, `osv-scanner`).
- Gestionar migraciones y backups de PostgreSQL (por ejemplo con `prisma migrate`, `sqitch` o `pg_dump`).
- Configurar monitoreo (Render Metrics, Prometheus, Sentry) y alertas de uptime.

