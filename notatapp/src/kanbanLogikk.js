// ═══════════════════════════════════════════════════════════════════
//  kanbanLogikk — reine funksjonar for Kanban-modulen (claude/kanban-modul.md). Ingen React/Supabase.
// ═══════════════════════════════════════════════════════════════════
import { FASEKODAR } from './framdriftLogikk'

export { FASEKODAR }

// Arbeidsflyt venstre → høgre. «ferdig» vert ikkje vist som open kolonne, men som arkiv (+ ei smal slepp-sone på tavla).
export const KOLONNER = [
  { key: 'ide',                 label: 'Idé',                     farge: '#94A3B8', wip: false },
  { key: 'komande',             label: 'Komande oppgåver',        farge: '#60A5D4', wip: false },
  { key: 'under_arbeid',        label: 'Under arbeid',            farge: '#4EADA3', wip: true },
  { key: 'godkjenning_intern',  label: 'Til godkjenning internt', farge: '#E9C46A', wip: true },
  { key: 'godkjenning_ekstern', label: 'Til godkjenning eksternt', farge: '#D4537E', wip: true },
]
export const FERDIG = { key: 'ferdig', label: 'Ferdigstilt', farge: '#52B788' }
export const ALLE_STATUSAR = [...KOLONNER, FERDIG]
export const statusNamn = (k) => (ALLE_STATUSAR.find(s => s.key === k) || {}).label || k

export const KORT_FARGAR = ['#D4537E', '#E9A23B', '#E9C46A', '#52B788', '#60A5D4', '#9B7BD4']

export const faseNamn = (kode) => { const f = FASEKODAR.find(x => x.kode === kode); return f ? f.namn : '' }

// Kort i ei kolonne, sortert (sortering, så oppretta)
export function kortIKolonne(kort, status) {
  return kort.filter(k => k.status === status).sort((a, b) => (a.sortering - b.sortering) || (String(a.created_at).localeCompare(String(b.created_at))))
}

// WIP: tal kort per person i ei kolonne → { namn: tal }
export function wipTelling(liste) {
  const m = {}
  for (const k of liste) { const n = (k.ansvarleg || '').trim(); if (n) m[n] = (m[n] || 0) + 1 }
  return m
}
// Personar som har fleire kort enn grensa (grense 0 = av)
export function wipOverskrid(liste, grense) {
  if (!grense || grense <= 0) return []
  return Object.entries(wipTelling(liste)).filter(([, n]) => n > grense).map(([namn, n]) => ({ namn, n }))
}

// Rekn ut nye feltverdiar når eit kort vert flytta til ny kolonne på ein gitt plass.
// Gjev liste av endringar [{ id, patch }] for flytta kort + alle i målkolonna som får ny sortering.
export function planFlytting(kort, id, tilStatus, indeks) {
  const flytta = kort.find(k => k.id === id)
  if (!flytta) return []
  const mal = kortIKolonne(kort, tilStatus).filter(k => k.id !== id)
  const pos = indeks == null ? mal.length : Math.max(0, Math.min(indeks, mal.length))
  mal.splice(pos, 0, flytta)
  const endringar = []
  mal.forEach((k, i) => {
    const patch = {}
    if (k.sortering !== i) patch.sortering = i
    if (k.id === id && k.status !== tilStatus) {
      patch.status = tilStatus
      patch.ferdig_dato = tilStatus === 'ferdig' ? new Date().toISOString() : null
    }
    if (Object.keys(patch).length) endringar.push({ id: k.id, patch })
  })
  return endringar
}

export const idag = () => new Date().toISOString().slice(0, 10)
export const fristForfalt = (k) => !!k.frist && k.status !== 'ferdig' && k.frist < idag()
export function fmtDato(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) } catch { return '' }
}
export const initialar = (namn) => (String(namn || '').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2) || '?').toUpperCase()

// Lenkje-oppslag (referanse, aldri styrande)
export function finnOppgave(notes, ref) {
  if (!ref || ref.note_id == null) return null
  const note = (notes || []).find(n => n.id === ref.note_id)
  const task = note?.tasks?.find(t => String(t.id) === String(ref.task_id))
  return note && task ? { note, task } : null
}
export function finnAktivitet(elementer, ref) {
  if (!ref || !ref.element_id) return null
  return (elementer || []).find(e => String(e.id) === String(ref.element_id)) || null
}
export function aktivitetNamn(e) {
  if (!e) return ''
  const kode = String(e.kode || '').trim()
  return (kode && !String(e.namn || '').startsWith(kode) ? kode + ' ' : '') + (e.namn || '')
}

// Filter (fase, person, fritekst)
export function filtrer(kort, { fase, person, sok }) {
  const s = (sok || '').trim().toLowerCase()
  return kort.filter(k =>
    (!fase || k.fase === fase) &&
    (!person || (person === '__ingen__' ? !k.ansvarleg : k.ansvarleg === person)) &&
    (!s || (k.tittel + ' ' + (k.skildring || '') + ' ' + (k.ansvarleg || '')).toLowerCase().includes(s)))
}
