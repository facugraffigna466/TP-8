# Aplicación de Gestión de Tareas

Una aplicación web simple con frontend (React), backend (Node.js/Express) y base de datos PostgreSQL.

## 📁 Estructura del Proyecto

```
Pagina-tp5/
├── backend/
│   ├── server.js          # Servidor Express con API REST
│   └── package.json       # Dependencias del backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Componente principal
│   │   ├── App.css        # Estilos de la aplicación
│   │   ├── main.jsx       # Punto de entrada
│   │   └── index.css      # Estilos globales
│   ├── index.html         # HTML principal
│   ├── vite.config.js     # Configuración de Vite
│   └── package.json       # Dependencias del frontend
└── README.md
```

## 🚀 Instalación y Ejecución

### Opción 1: Script Automático (Recomendado)
.
```bash
# Iniciar todo automáticamente
./start.sh
```

Esto iniciará el backend y el frontend, liberando puertos si es necesario.

### Opción 2: Manual (Dos Terminales)

#### Backend

1. Navegar a la carpeta del backend:
```bash
cd backend
```

2. Instalar dependencias (solo la primera vez):
```bash
npm install
```

3. Si el puerto 8080 está ocupado, detener el proceso:
```bash
# Detener procesos en puerto 8080
lsof -ti:8080 | xargs kill -9
```

4. Iniciar el servidor:
```bash
npm start
```

El servidor correrá en `http://localhost:8080`

#### Frontend

1. Abrir una nueva terminal y navegar a la carpeta del frontend:
```bash
cd frontend
```

2. Instalar dependencias (solo la primera vez):
```bash
npm install
```

3. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Detener Servidores

```bash
# Detener todos los servidores
./stop.sh
```

## 📡 API Endpoints

- `GET /api/tareas` - Obtener todas las tareas
- `GET /api/tareas/:id` - Obtener una tarea por ID
- `POST /api/tareas` - Crear una nueva tarea
- `PUT /api/tareas/:id` - Actualizar una tarea
- `DELETE /api/tareas/:id` - Eliminar una tarea
- `GET /health` - Health check del servidor

## 🗄️ Base de Datos

El backend utiliza PostgreSQL. En desarrollo puedes levantarlo con Docker:

```bash
docker run --name tp8-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tp8 \
  -p 5432:5432 \
  -d postgres:16

# Exporta la URL antes de iniciar el backend
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tp8
```

En Render/Railway basta con definir la variable `DATABASE_URL` con la cadena de conexión provista por el servicio gestionado. El backend inicializa automáticamente la tabla `tareas`:

- `id` (SERIAL PRIMARY KEY)
- `titulo` (TEXT)
- `descripcion` (TEXT)
- `completada` (BOOLEAN)
- `fecha_creacion` (TIMESTAMPTZ)

Para inspeccionar la base en producción puedes usar el cliente web de Render/Railway o cualquier herramienta compatible con PostgreSQL (`psql`, TablePlus, DBeaver, etc.).

> ℹ️ Las guías relacionadas a SQLite (`GUIA_SQLITE.md`, `backend/ejemplos-sqlite.sql`, etc.) se conservan solo como referencia histórica.

## 🌐 Variables de Entorno

Para producción, puedes configurar:

- `PORT`: Puerto del servidor backend (default: 8080)
- `CORS_ORIGIN`: Orígenes permitidos para el backend (default: `*`)
- `DATABASE_URL`: Cadena de conexión PostgreSQL (ej. `postgresql://user:pass@host:5432/db`)
- `PGSSL`: Forzar o deshabilitar SSL (`true`/`false`). Por defecto se activa automáticamente para hosts no locales.
- `API_URL`: URL del API backend que consumirá el frontend (inyectado en tiempo de ejecución dentro del contenedor; default: `http://localhost:8080`)

Consulta `docs/deployment.md` para la estrategia completa de registry, QA, PROD y pipeline CI/CD.

## 📝 Funcionalidades

- ✅ Crear nuevas tareas
- ✅ Marcar tareas como completadas/pendientes
- ✅ Eliminar tareas
- ✅ Ver estadísticas (total, pendientes, completadas)
- ✅ Interfaz moderna y responsive

## 🔧 Tecnologías Utilizadas

- **Frontend**: React 18, Vite, Axios
- **Backend**: Node.js, Express, PostgreSQL (pg)
- **Estilos**: CSS puro con diseño moderno

