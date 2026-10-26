// ═══════════════════════════════════════════════════════════════════
//  kanbanLogikk — reine funksjonar for Kanban-modulen (claude/kanban-modul.md). Ingen React/Supabase.
// ═══════════════════════════════════════════════════════════════════
import { LEVERANSE_FASAR, tolkDato } from './dtmKonstantar'

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

// ── Tavle per fase ──────────────────────────────────────────────────
// Dei fire standardfasane (same som fasane i DTM sin leveranseliste). Ei tavle per fase prosjektet er inne i.
export const TAVLE_FASAR = [
  { key: 'skisse',      namn: 'Skisseprosjekt' },
  { key: 'forprosjekt', namn: 'Forprosjekt' },
  { key: 'soknad',      namn: 'Byggesøknad' },
  { key: 'detalj',      namn: 'Detaljprosjekt' },
]
export const faseNamn = (key) => (TAVLE_FASAR.find(f => f.key === key) || {}).namn || ''
// DTM-dokumentet sitt fase-felt er fritekst («Detaljprosjekt», «Skisseprosjekt» …) — gjenkjend på nøkkelord
export function faseFraTekst(t) {
  const s = String(t || '').toLowerCase()
  if (/skisse|moglegheit|mulighet/.test(s)) return 'skisse'
  if (/forprosjekt|førprosjekt/.test(s)) return 'forprosjekt'
  if (/søknad|soknad|rammesøk|byggesøk/.test(s)) return 'soknad'
  if (/detalj|arbeidsteikn|arbeidstegn/.test(s)) return 'detalj'
  return null
}

// ── DTM-leveransar → kort (automatisk, ei-vegs frå DTM til Kanban) ───
// Ein leveranse = eit DTM-dokument i leveranselista: minst éin planlagt_<type>-dato eller sendt_<type>-hake.
export const DTM_KOLONNER = ['id', 'nr', 'tittel', 'fase', 'utarbeida_av', 'kontrollstatus', ...LEVERANSE_FASAR.flatMap(f => ['planlagt_' + f.key, 'sendt_' + f.key])]
const FAGKONTROLL_FERDIG = ['klar_godkjenning', 'godkjenning_pagaende', 'godkjent']
export function dtmLeveransar(dok) {
  return LEVERANSE_FASAR.filter(f => (dok['planlagt_' + f.key] || '').toString().trim() || dok['sendt_' + f.key])
    .map(f => ({ key: f.key, namn: f.namn, planlagt: (dok['planlagt_' + f.key] || '').toString().trim(), sendt: !!dok['sendt_' + f.key] }))
}
// Kolonne ut frå DTM-tilstanden: ferdig fagkontrollert OG sendt ut → ferdig; sendt utan fagkontroll → eksternt;
// fagkontroll klar/pågåande/ferdig → internt; egenkontroll pågår → under arbeid; elles komande.
export function dtmStatus(dok) {
  const lev = dtmLeveransar(dok)
  const sendt = lev.length > 0 && lev.every(l => l.sendt)
  const ks = dok.kontrollstatus || 'ikkje_starta'
  const fagFerdig = FAGKONTROLL_FERDIG.includes(ks)
  if (sendt && fagFerdig) return 'ferdig'
  if (sendt) return 'godkjenning_ekstern'
  if (fagFerdig || ks === 'klar_fagkontroll' || ks === 'fagkontroll_pagaende') return 'godkjenning_intern'
  if (ks === 'egenkontroll_pagaende') return 'under_arbeid'
  return 'komande'
}
function isoDato(d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null }
export function dtmKortData(dok) {
  const lev = dtmLeveransar(dok)
  const opne = lev.filter(l => !l.sendt)
  const datoar = opne.map(l => tolkDato(l.planlagt)).filter(Boolean).sort((a, b) => a - b)
  return {
    tittel: [dok.nr, dok.tittel].filter(Boolean).join(' ') || 'Dokument',
    skildring: 'Leveranse frå DTM: ' + lev.map(l => l.namn + (l.sendt ? ' ✓ sendt' : l.planlagt ? ' (planlagt ' + l.planlagt + ')' : '')).join(', '),
    frist: isoDato(datoar[0]),
    ansvarleg: dok.utarbeida_av || '',
  }
}
// Samanlikn DTM-leveransane for ei fase med korta: { opprett: [...], endre: [{id, patch}] }
export function planDtmSync(tavle, kort, dokumenter, userId) {
  const opprett = [], endre = []
  const kjende = new Map(kort.filter(k => k.dtm_ref?.dokument_id != null).map(k => [String(k.dtm_ref.dokument_id), k]))
  let sortering = kortIKolonne(kort.filter(k => k.tavle_id === tavle.id), 'komande').length
  for (const dok of dokumenter) {
    if (faseFraTekst(dok.fase) !== tavle.fase || !dtmLeveransar(dok).length) continue
    const data = dtmKortData(dok); const status = dtmStatus(dok)
    const k = kjende.get(String(dok.id))
    if (!k) {
      opprett.push({ user_id: userId, project_id: tavle.project_id, tavle_id: tavle.id, ...data, status, fase: tavle.fase, sortering: sortering++, farge: null,
        ferdig_dato: status === 'ferdig' ? new Date().toISOString() : null, dtm_ref: { dokument_id: dok.id, sist_status: status } })
      continue
    }
    if (k.dtm_ref?.skjult || k.tavle_id !== tavle.id) continue
    const patch = {}
    for (const f of ['tittel', 'skildring', 'frist']) if ((k[f] || null) !== (data[f] || null)) patch[f] = data[f]
    if (!k.ansvarleg && data.ansvarleg) patch.ansvarleg = data.ansvarleg
    if (k.dtm_ref?.sist_status !== status) {
      patch.status = status; patch.dtm_ref = { ...k.dtm_ref, sist_status: status }
      patch.ferdig_dato = status === 'ferdig' ? new Date().toISOString() : null
    }
    if (Object.keys(patch).length) endre.push({ id: k.id, patch })
  }
  return { opprett, endre }
}
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
// Fast, unik farge per person (frå namnet) — brukt på alt som er knytt til personen (ansvarleg på kort, i tabellar, i menyar).
export function personFarge(namn) {
  const n = String(namn || '').trim().toLowerCase(); if (!n) return null
  let h = 5381; for (const c of n) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  const tone = (h % 360)
  return { fg: `hsl(${tone} 62% 38%)`, bg: `hsl(${tone} 70% 45% / .16)` }
}
// Neste løpenummer (O-nummer) for oppgåver/kort i eit prosjekt: høgste eksisterande + 1
export const nesteKortNummer = (kort) => Math.max(0, ...kort.map(k => Number(k.nummer) || 0)) + 1
// Set løpenummer på ei liste nye kort (etter dei eksisterande)
export const medKortNummer = (nye, eksisterande) => { const base = nesteKortNummer(eksisterande); return nye.map((k, i) => ({ ...k, nummer: base + i })) }

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
