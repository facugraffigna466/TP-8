const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`
Uso: node server.js

Variables de entorno:
  PORT             Puerto donde escucha el servidor (default 8080)
  CORS_ORIGIN      Orígenes permitidos para CORS (default "*")
  DATABASE_URL     Cadena de conexión PostgreSQL
  PGSSL            Forzar uso de SSL (true/false). Por defecto se activa automáticamente fuera de localhost.
`);
  process.exit(0);
}

const app = express();
const PORT = process.env.PORT || 8080;

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tp8';

const shouldUseSSL = () => {
  if (typeof process.env.PGSSL !== 'undefined') {
    return process.env.PGSSL === 'true';
  }
  return !/localhost|127\.0\.0\.1/.test(DATABASE_URL);
};

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: shouldUseSSL() ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('⚠️  Error inesperado en el pool de PostgreSQL', err);
});

const normalizeRow = (row) => ({
  id: row.id,
  titulo: row.titulo,
  descripcion: row.descripcion || '',
  completada: row.completada ? 1 : 0,
  fecha_creacion: row.fecha_creacion
    ? new Date(row.fecha_creacion).toISOString()
    : new Date().toISOString()
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      completada BOOLEAN DEFAULT FALSE,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

initializeDatabase().catch((err) => {
  console.error('❌ Error inicializando la base de datos', err);
  process.exit(1);
});

app.get('/api/tareas', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, titulo, descripcion, completada, fecha_creacion FROM tareas ORDER BY fecha_creacion DESC'
    );
    res.json(rows.map(normalizeRow));
  } catch (error) {
    console.error('Error obteniendo tareas', error);
    res.status(500).json({ error: 'Error interno al obtener las tareas' });
  }
});

app.get('/api/tareas/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, titulo, descripcion, completada, fecha_creacion FROM tareas WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    res.json(normalizeRow(rows[0]));
  } catch (error) {
    console.error('Error obteniendo tarea', error);
    res.status(500).json({ error: 'Error interno al obtener la tarea' });
  }
});

app.post('/api/tareas', async (req, res) => {
  const { titulo, descripcion } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tareas (titulo, descripcion)
       VALUES ($1, $2)
       RETURNING id, titulo, descripcion, completada, fecha_creacion`,
      [titulo.trim(), (descripcion || '').trim()]
    );

    res.status(201).json(normalizeRow(rows[0]));
  } catch (error) {
    console.error('Error creando tarea', error);
    res.status(500).json({ error: 'Error interno al crear la tarea' });
  }
});

app.put('/api/tareas/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { titulo, descripcion, completada } = req.body;
  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE tareas
         SET titulo = $1,
             descripcion = $2,
             completada = $3
       WHERE id = $4`,
      [titulo.trim(), (descripcion || '').trim(), Boolean(completada), id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    res.json({ message: 'Tarea actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando tarea', error);
    res.status(500).json({ error: 'Error interno al actualizar la tarea' });
  }
});

app.delete('/api/tareas/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM tareas WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando tarea', error);
    res.status(500).json({ error: 'Error interno al eliminar la tarea' });
  }
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Problemas con la base de datos' });
  }
});

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error' });
  }
});

const safeDbUrl = (() => {
  try {
    const parsed = new URL(DATABASE_URL);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (error) {
    return 'PostgreSQL (credenciales ocultas)';
  }
})();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🗄️  Conectado a: ${safeDbUrl}`);
});

const closePool = async () => {
  try {
    await pool.end();
    console.log('🔌 Conexión a PostgreSQL cerrada.');
  } catch (error) {
    console.error('Error cerrando la conexión a PostgreSQL', error);
  }
};

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

