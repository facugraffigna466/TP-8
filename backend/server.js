const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Mostrar ayuda y salir si se solicita
if (process.argv.includes('--help')) {
  console.log(`
Uso: node server.js

Variables de entorno:
  PORT             Puerto donde escucha el servidor (default 8080)
  CORS_ORIGIN      Orígenes permitidos para CORS (default "*")
  DATABASE_URL     Ruta del archivo SQLite (default backend/database.sqlite)
  NODE_ENV         Entorno de ejecución (default development)
`);
  process.exit(0);
}

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Base de datos SQLite
const DB_FILE = process.env.DATABASE_URL || path.join(__dirname, 'database.sqlite');
if (DB_FILE.startsWith('/home/site/data')) {
  try {
    fs.mkdirSync('/home/site/data', { recursive: true });
  } catch (e) {
    // ignore if already exists
  }
}
const db = new sqlite3.Database(DB_FILE);

// Crear tabla de tareas si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      completada INTEGER DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Rutas API

// Obtener todas las tareas
app.get('/api/tareas', (req, res) => {
  db.all('SELECT * FROM tareas ORDER BY fecha_creacion DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Obtener una tarea por ID
app.get('/api/tareas/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM tareas WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json(row);
  });
});

// Crear una nueva tarea
app.post('/api/tareas', (req, res) => {
  const { titulo, descripcion } = req.body;
  
  if (!titulo) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  db.run(
    'INSERT INTO tareas (titulo, descripcion) VALUES (?, ?)',
    [titulo, descripcion || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        titulo,
        descripcion: descripcion || '',
        completada: 0,
        fecha_creacion: new Date().toISOString()
      });
    }
  );
});

// Actualizar una tarea
app.put('/api/tareas/:id', (req, res) => {
  const id = req.params.id;
  const { titulo, descripcion, completada } = req.body;

  db.run(
    'UPDATE tareas SET titulo = ?, descripcion = ?, completada = ? WHERE id = ?',
    [titulo, descripcion, completada ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }
      res.json({ message: 'Tarea actualizada exitosamente' });
    }
  );
});

// Eliminar una tarea
app.delete('/api/tareas/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM tareas WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json({ message: 'Tarea eliminada exitosamente' });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// Iniciar servidor (un solo listen)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: ${DB_FILE}`);
});

// Cerrar conexión a la base de datos al cerrar la aplicación
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('📦 Conexión a la base de datos cerrada.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('📦 Conexión a la base de datos cerrada (SIGTERM).');
    process.exit(0);
  });
});
