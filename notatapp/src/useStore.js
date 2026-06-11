import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const OLD_KEYS = ['notatapp_v4','notatapp_v3','notatapp_v2','notatapp_v1']

// ── Migrate old localStorage data to Supabase (run once) ─────────────────
async function migrateLocalStorage(userId) {
  const migrated = localStorage.getItem('notatapp_migrated_' + userId)
  if (migrated) return

  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const old = JSON.parse(raw)
      const notes    = Array.isArray(old.notes)    ? old.notes    : []
      const projects = Array.isArray(old.projects) ? old.projects : []
      if (!notes.length && !projects.length) continue

      // Insert projects first
      for (const p of projects) {
        await supabase.from('projects').upsert({
          id:         p.id,
          user_id:    userId,
          name:       p.name,
          favorite:   p.favorite || false,
          created_at: p.createdAt || new Date().toISOString(),
        })
      }

      // Insert notes
      for (const n of notes) {
        await supabase.from('notes').upsert({
          id:              n.id,
          user_id:         userId,
          title:           n.title || '',
          text:            n.text  || '',
          html:            n.html  || '',
          tasks:           n.tasks || [],
          tag:             n.tag   || null,
          project_id:      n.projectId || null,
          is_email:        n.isEmail || false,
          sketch_data_url: n.sketchDataUrl || null,
          done:            n.done || false,
          created_at:      n.createdAt || new Date().toISOString(),
        })
      }

      console.info(`Migrerte ${notes.length} notatar og ${projects.length} prosjekt frå ${key}`)
      localStorage.setItem('notatapp_migrated_' + userId, '1')
      break
    } catch (e) { console.warn('Migrasjon feila:', e) }
  }
}

export function useStore(userId) {
  const [notes,    setNotes]    = useState([])
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)

  // ── Load from Supabase ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    await migrateLocalStorage(userId)

    const [{ data: pData }, { data: nData }] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', userId).order('favorite', { ascending: false }).order('name'),
      supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    setProjects((pData || []).map(p => ({
      id: p.id, name: p.name, favorite: p.favorite,
      type: p.type || 'work',
      createdAt: p.created_at,
    })))
    setNotes((nData || []).map(n => ({
      id: n.id, title: n.title, text: n.text, html: n.html,
      tasks: n.tasks || [], tag: n.tag, projectId: n.project_id,
      isEmail: n.is_email, sketchDataUrl: n.sketch_data_url,
      attachments: n.attachments || [],
      isMeeting: n.is_meeting, meetingTime: n.meeting_time,
      meetingDuration: n.meeting_duration, meetingLocation: n.meeting_location,
      attendees: n.attendees || [],
      done: n.done, createdAt: n.created_at,
    })))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Notes ─────────────────────────────────────────────────────────────
  const addNote = async (n) => {
    const id = Date.now()
    const row = {
      id, user_id: userId,
      title: n.title || '', text: n.text || '', html: n.html || '',
      tasks: n.tasks || [], tag: n.tag || null,
      project_id: n.projectId || null,
      is_email:         n.isEmail         || false,
      sketch_data_url:  n.sketchDataUrl   || null,
      attachments:      n.attachments     || [],
      is_meeting:       n.isMeeting       || false,
      meeting_time:     n.meetingTime     || null,
      meeting_duration: n.meetingDuration || null,
      meeting_location: n.meetingLocation || null,
      attendees:        n.attendees       || [],
      done: false, created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('notes').insert(row)
    if (!error) await loadAll()
  }

  const updateNote = async (id, changes) => {
    const row = {
      ...(changes.title     !== undefined && { title:           changes.title }),
      ...(changes.text      !== undefined && { text:            changes.text }),
      ...(changes.html      !== undefined && { html:            changes.html }),
      ...(changes.tasks     !== undefined && { tasks:           changes.tasks }),
      ...(changes.tag       !== undefined && { tag:             changes.tag }),
      ...(changes.projectId !== undefined && { project_id:      changes.projectId }),
      ...(changes.done      !== undefined && { done:            changes.done }),
      ...(changes.sketchDataUrl !== undefined && { sketch_data_url: changes.sketchDataUrl }),
      updated_at: new Date().toISOString(),
    }
    await supabase.from('notes').update(row).eq('id', id).eq('user_id', userId)
    await loadAll()
  }

  const deleteNote = async (id) => {
    await supabase.from('notes').delete().eq('id', id).eq('user_id', userId)
    setNotes(n => n.filter(x => x.id !== id))
  }

  const toggleDone = async (id) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    await updateNote(id, { done: !note.done })
  }

  // ── Tasks ─────────────────────────────────────────────────────────────
  const addTask = async (noteId, taskText, taskDate, taskStart, taskHours) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    const task = {
      id: Date.now(), text: taskText, done: false,
      date:      taskDate  || null,
      startDate: taskStart || null,
      hours:     taskHours !== undefined ? taskHours : 0.5,
    }
    await updateNote(noteId, { tasks: [...(note.tasks || []), task] })
  }

  const updateTask = async (noteId, taskId, changes) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    const tasks = (note.tasks || []).map(t => t.id === taskId ? { ...t, ...changes } : t)
    await updateNote(noteId, { tasks })
  }

  const deleteTask = async (noteId, taskId) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    await updateNote(noteId, { tasks: (note.tasks || []).filter(t => t.id !== taskId) })
  }

  // ── Projects ──────────────────────────────────────────────────────────
  const addProject = async (name, type='work') => {
    const ex = projects.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (ex) return ex
    const id = Date.now()
    const { error } = await supabase.from('projects').insert({
      id, user_id: userId, name, favorite: false, type,
      created_at: new Date().toISOString(),
    })
    if (!error) await loadAll()
    return { id, name, favorite: false }
  }

  const updateProject = async (id, changes) => {
    await supabase.from('projects').update(changes).eq('id', id).eq('user_id', userId)
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  const deleteProject = async (id) => {
    await supabase.from('projects').delete().eq('id', id).eq('user_id', userId)
    await supabase.from('notes').update({ project_id: null }).eq('project_id', id).eq('user_id', userId)
    await loadAll()
  }

  const toggleFavorite = async (id) => {
    const proj = projects.find(p => p.id === id)
    if (!proj) return
    await supabase.from('projects').update({ favorite: !proj.favorite }).eq('id', id).eq('user_id', userId)
    setProjects(ps => ps.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p)
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name)))
  }

  return {
    notes, projects, loading,
    addNote, updateNote, deleteNote, toggleDone,
    addTask, updateTask, deleteTask,
    addProject, updateProject, deleteProject, toggleFavorite,
  }
}
