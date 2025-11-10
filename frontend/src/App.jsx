import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const runtimeApiUrl = typeof window !== 'undefined' && window.__APP_CONFIG__
  ? window.__APP_CONFIG__.apiUrl
  : null

const API_URL = runtimeApiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8080'

function App() {
  const [tareas, setTareas] = useState([])
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: '', descripcion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Cargar tareas al iniciar
  useEffect(() => {
    cargarTareas()
  }, [])

  const cargarTareas = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/api/tareas`)
      setTareas(response.data)
      setError(null)
    } catch (err) {
      setError('Error al cargar las tareas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const agregarTarea = async (e) => {
    e.preventDefault()
    if (!nuevaTarea.titulo.trim()) return

    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/api/tareas`, nuevaTarea)
      setTareas([response.data, ...tareas])
      setNuevaTarea({ titulo: '', descripcion: '' })
      setError(null)
    } catch (err) {
      setError('Error al crear la tarea')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleCompletada = async (id, completada) => {
    try {
      const tarea = tareas.find(t => t.id === id)
      await axios.put(`${API_URL}/api/tareas/${id}`, {
        ...tarea,
        completada: !completada
      })
      cargarTareas()
    } catch (err) {
      setError('Error al actualizar la tarea')
      console.error(err)
    }
  }

  const eliminarTarea = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return

    try {
      await axios.delete(`${API_URL}/api/tareas/${id}`)
      setTareas(tareas.filter(t => t.id !== id))
      setError(null)
    } catch (err) {
      setError('Error al eliminar la tarea')
      console.error(err)
    }
  }

  const tareasCompletadas = tareas.filter(t => t.completada === 1).length
  const tareasPendientes = tareas.filter(t => t.completada === 0).length

  return (
    <div className="app">
      <div className="container">
        <header>
          <h1>📋 Gestión de Tareas</h1>
          <p className="subtitle">Organiza tu día de forma eficiente</p>
        </header>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="stats">
          <div className="stat-card">
            <span className="stat-number">{tareas.length}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{tareasPendientes}</span>
            <span className="stat-label">Pendientes</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{tareasCompletadas}</span>
            <span className="stat-label">Completadas</span>
          </div>
        </div>

        <form onSubmit={agregarTarea} className="form-nueva-tarea">
          <input
            type="text"
            placeholder="Título de la tarea..."
            value={nuevaTarea.titulo}
            onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
            className="input-titulo"
          />
          <textarea
            placeholder="Descripción (opcional)..."
            value={nuevaTarea.descripcion}
            onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
            className="input-descripcion"
            rows="3"
          />
          <button type="submit" className="btn-agregar" disabled={loading}>
            {loading ? 'Agregando...' : '+ Agregar Tarea'}
          </button>
        </form>

        <div className="tareas-lista">
          {loading && tareas.length === 0 ? (
            <div className="loading">Cargando tareas...</div>
          ) : tareas.length === 0 ? (
            <div className="empty-state">
              <p>🎉 No hay tareas aún. ¡Agrega tu primera tarea!</p>
            </div>
          ) : (
            tareas.map(tarea => (
              <div
                key={tarea.id}
                className={`tarea-card ${tarea.completada === 1 ? 'completada' : ''}`}
              >
                <div className="tarea-content">
                  <input
                    type="checkbox"
                    checked={tarea.completada === 1}
                    onChange={() => toggleCompletada(tarea.id, tarea.completada)}
                    className="checkbox"
                  />
                  <div className="tarea-info">
                    <h3 className={tarea.completada === 1 ? 'tachado' : ''}>
                      {tarea.titulo}
                    </h3>
                    {tarea.descripcion && (
                      <p className={tarea.completada === 1 ? 'tachado' : ''}>
                        {tarea.descripcion}
                      </p>
                    )}
                    <span className="fecha">
                      {new Date(tarea.fecha_creacion).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => eliminarTarea(tarea.id)}
                  className="btn-eliminar"
                  title="Eliminar tarea"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App

