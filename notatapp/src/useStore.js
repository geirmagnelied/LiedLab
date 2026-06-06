import { useState, useEffect } from 'react'

const KEY = 'notatapp_v4'
const OLD_KEYS = ['notatapp_v3', 'notatapp_v2', 'notatapp_v1', 'notatapp_data', 'notatapp']
const defaults = { notes: [], projects: [] }

function migrate() {
  for (const oldKey of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(oldKey)
      if (!raw) continue
      const old = JSON.parse(raw)
      if (!old) continue
      const notes    = Array.isArray(old.notes)    ? old.notes    : []
      const projects = Array.isArray(old.projects) ? old.projects : []
      if (notes.length === 0 && projects.length === 0) continue
      // Strip 'type' field from notes (jobb/privat no longer used)
      const cleaned = notes.map(n => { const { type, ...rest } = n; return rest })
      const migrated = { notes: cleaned, projects }
      localStorage.setItem(KEY, JSON.stringify(migrated))
      localStorage.setItem(oldKey + '_migrated', '1')
      console.info(`Notatapp: migrerte ${notes.length} notatar frå "${oldKey}"`)
      return migrated
    } catch (e) { console.warn('Migrasjon feila for', oldKey, e) }
  }
  return null
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
    const migrated = migrate()
    if (migrated) return { ...defaults, ...migrated }
    return defaults
  } catch { return defaults }
}

export function useStore() {
  const [state, setState] = useState(load)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)) }, [state])

  const addNote = (n) => {
    const note = {
      id:        Date.now(),
      title:     n.title     || '',
      text:      n.text      || '',
      html:      n.html      || n.text || '',
      tasks:     n.tasks     || [],
      tag:       n.tag       || null,
      projectId: n.projectId || null,
      isEmail:       n.isEmail       || false,
      sketchDataUrl: n.sketchDataUrl || null,
      done:      false,
      createdAt: new Date().toISOString(),
    }
    setState(s => ({ ...s, notes: [note, ...s.notes] }))
    return note
  }

  const updateNote = (id, changes) => {
    setState(s => ({
      ...s,
      notes: s.notes.map(n =>
        n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
      ),
    }))
  }

  const deleteNote = (id) => setState(s => ({ ...s, notes: s.notes.filter(n => n.id !== id) }))
  const toggleDone = (id) => setState(s => ({
    ...s, notes: s.notes.map(n => n.id === id ? { ...n, done: !n.done } : n),
  }))

  const addTask = (noteId, taskText, taskDate) => {
    const task = { id: Date.now(), text: taskText, done: false, date: taskDate || null }
    setState(s => ({
      ...s, notes: s.notes.map(n =>
        n.id === noteId ? { ...n, tasks: [...(n.tasks || []), task] } : n
      ),
    }))
  }

  const updateTask = (noteId, taskId, changes) => {
    setState(s => ({
      ...s, notes: s.notes.map(n =>
        n.id === noteId
          ? { ...n, tasks: (n.tasks || []).map(t => t.id === taskId ? { ...t, ...changes } : t) }
          : n
      ),
    }))
  }

  const deleteTask = (noteId, taskId) => {
    setState(s => ({
      ...s, notes: s.notes.map(n =>
        n.id === noteId
          ? { ...n, tasks: (n.tasks || []).filter(t => t.id !== taskId) }
          : n
      ),
    }))
  }

  const addProject = (name) => {
    const ex = state.projects.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (ex) return ex
    const p = { id: Date.now(), name, createdAt: new Date().toISOString() }
    setState(s => ({ ...s, projects: [...s.projects, p] }))
    return p
  }

  const toggleFavorite = (id) => setState(s => ({
    ...s,
    projects: s.projects.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p),
  }))

  const deleteProject = (id) => setState(s => ({
    ...s,
    projects: s.projects.filter(p => p.id !== id),
    notes:    s.notes.map(n => n.projectId === id ? { ...n, projectId: null } : n),
  }))

  return {
    notes: state.notes, projects: state.projects,
    addNote, updateNote, deleteNote, toggleDone,
    addTask, updateTask, deleteTask,
    addProject, deleteProject, toggleFavorite,
  }
}
