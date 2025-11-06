## Arquitectura y Herramientas
- **Lenguajes:**  
  - Frontend: Vite + React  
  - Backend: Node.js + Express  
  - Database: SQLite (persistente en `/home/site/data`)  
- **Entornos:**  
  - QA: Validación automática de despliegue  
  - Producción: Despliegue con aprobación manual  

---

## Recursos Cloud

| Recurso | Tipo | Propósito | Entorno |
|----------|------|------------|----------|
| miapp-front-qa | Azure Web App (Linux) | Frontend QA | QA |
| miapp-back-qa | Azure Web App (Linux) | Backend QA | QA |
| miapp-front-prod | Azure Web App (Linux) | Frontend Prod | Producción |
| miapp-back-prod | Azure Web App (Linux) | Backend Prod | Producción |

---


## Release Pipeline

### Estructura de stages

1. **Build**
   - Instala dependencias (Node 20)
   - Compila frontend (Vite)  
   - Empaqueta `front.zip` y `back.zip` como artefactos

2. **QA**
   - Despliega backend con ZipDeploy
   - Health check `/healthz`
   - Despliega frontend con `runFromPackage` (pm2 serve)
   - Health check `/` (HTTP 200)
   - Variables inyectadas dinámicamente desde `Library → QA`

3. **PROD**
   - Requiere aprobación manual  
   - Repite mismo flujo, usando variables de `Library → PROD`
   - Health checks automáticos post-deploy  

---

## Estrategia de Aprobaciones

- **Tipo:** Manual Approval en Environment `prod`
- **Responsable:** desarrollador o líder técnico (Santiago Llancamán)
- **Flujo:**  
  1. QA exitoso  
  2. Revisión manual  
  3. Aprobación → se habilita stage PROD  

---

## Health Checks

| Entorno | Endpoint | Resultado esperado |
|----------|-----------|--------------------|
| QA | `/healthz` | `{"status":"ok"}` |
| PROD | `/healthz` | `{"status":"ok"}` |
| Front QA | `/` | HTTP 200 |
| Front PROD | `/` | HTTP 200 |

Health checks automáticos validados desde el pipeline (`curl`).

---

## Decisiones Técnicas Clave

- Se eligió **Azure App Service** por su integración nativa con Azure DevOps.  
- Se separaron **4 App Services** (Front/Back en QA y PROD) para aislar entornos.  
- Se utilizó **SQLite persistente** para simplificar almacenamiento sin dependencia externa.  
- Se eliminaron dependencias de node_modules en build → el App Service instala en runtime.  
- Se parametrizó el `VITE_API_URL` mediante placeholder (`__API_URL__`) reemplazado por entorno.  
- Los health checks aseguran rollback automático si alguna etapa falla.

---

## Evidencias

En el archivo "Capturas"

---

## URLs finales

- **Frontend QA:** https://miapp-front-qa-fzbjenfqafc8bvea.canadacentral-01.azurewebsites.net 
- **Backend QA:** https://miapp-back-qa-c3ceb4a7f8edbgbp.canadacentral-01.azurewebsites.net/healthz 
- **Frontend PROD:** https://miapp-front-prod-g9cea7cucweeewez.canadacentral-01.azurewebsites.net 
- **Backend PROD:** https://miapp-back-prod-d2apb7dge4dadqag.canadacentral-01.azurewebsites.net/healthz

---

## Conclusión

El pipeline cumple con los requerimientos del TP05:
- Automatiza build + deploy de QA y PROD.
- Utiliza aprobaciones manuales.
- Valida despliegues con health checks.
- Mantiene configuración aislada por entorno.
- Logra un flujo CI/CD completo y estable.