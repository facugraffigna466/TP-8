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
    - Backend: `PORT=8080`, `CORS_ORIGIN=https://<qa-frontend>.onrender.com`, `DATABASE_URL=/data/database.sqlite` (se monta volumen persistente Render, 1 GiB).
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
    - Backend: `PORT=8080`, `CORS_ORIGIN=https://<prod-frontend>.onrender.com`, `DATABASE_URL=/data/database.sqlite` (o migrar a PostgreSQL administrado si se requiere HA).
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
   - Invoca el script reutilizable `.github/scripts/render_deploy.py`, que consume el token de API de Render y llama al endpoint GraphQL `deployService` para actualizar los servicios QA con la imagen versionada.
   - Se asocia al environment `qa` de GitHub; se pueden agregar revisores opcionales.
4. **Deploy PROD (`deploy-prod`):**
   - Requiere aprobación manual del environment `prod`.
   - Reutiliza el mismo tag publicado en GHCR para garantizar paridad QA→PROD.
   - Ejecuta el mismo script para disparar despliegues en los servicios PROD y deja el resultado del request en los logs de la acción.

### Quality Gates y Segregación

- El environment `prod` en GitHub debe configurarse con “Required reviewers” para habilitar un gate manual.
- Los secretos sensibles (`RENDER_*`, URLs finales) se guardan en environments separados (QA/PROD) y no se comparten.
- El pipeline solo corre en `main` o bajo `workflow_dispatch`, evitando despliegues accidentales desde ramas experimentales.

### Gestión de Secretos en GitHub

Registrar los siguientes secretos (según environment adecuado):

| Secreto | Uso |
|---|---|
| `RENDER_API_TOKEN` | Token Personal API de Render con permisos de `deploy`. |
| `RENDER_QA_BACKEND_SERVICE_ID`, `RENDER_QA_FRONTEND_SERVICE_ID` | IDs de los servicios QA (ver en Render UI → Settings → General). |
| `RENDER_PROD_BACKEND_SERVICE_ID`, `RENDER_PROD_FRONTEND_SERVICE_ID` | IDs de los servicios PROD. |
| `GHCR_TOKEN` | PAT con scopes `read:packages` y `write:packages` (Render lo usará para descargar imágenes privadas). |
| `GHCR_USERNAME` | Usuario dueño del PAT anterior (solo necesario al crear servicios en Render). |

> **Tip:** Los IDs y tokens pueden definirse a nivel de environment (`qa`, `prod`) en la pestaña *Settings → Environments* para reforzar la segregación.

## 5. Render – Primer Aprovisionamiento

Pasos sugeridos por ambiente (QA/PROD):

1. Generar `RENDER_API_TOKEN` en *Account → API Keys*.
2. Crear servicio backend (Docker) seleccionando “Existing image” e introduciendo:
   - `ghcr.io/<owner en minúsculas>/tp-8/backend:qa` (tag inicial arbitraria; en GHCR los nombres deben ir en minúsculas).
   - “Background worker” desactivado, `PORT 8080`.
   - Montar disco persistente (opcional) para `database.sqlite`.
   - Variables de entorno listadas antes.
3. Crear servicio frontend similar pero con `ghcr.io/<owner en minúsculas>/tp-8/frontend:qa` y puerto `80`.
4. Guardar los `Service ID` desde la sección Settings.
5. Añadir los secretos en GitHub (environments `qa` y `prod`).

> Una vez creado el pipeline, la primera ejecución manual (`workflow_dispatch`) publicará una nueva imagen con tag `<rama>-<runNumber>`. Esa misma ejecución reconfigurará los servicios para usar el tag versionado, garantizando que QA y PROD corren exactamente la misma build.

## 6. Próximos pasos sugeridos

- Añadir suites de pruebas automatizadas para backend y frontend.
- Incluir escaneo de vulnerabilidades (`trivy`, `npm audit`, `osv-scanner`).
- Implementar migraciones de base de datos o migrar a un motor administrado si se escala más allá de SQLite.
- Configurar monitoreo (Render Metrics, Prometheus, Sentry) y alertas de uptime.

