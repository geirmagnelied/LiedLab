import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════
//  Brukarprofil (tabell brukar_profil, bøtte «brukar»): namn, adresse, fødselsår, tittel, bilete, språk, kompetanse og
//  prosjekterfaring. Lagring er automatisk (debounce 800 ms). Språkvalet vert òg hugsa i localStorage så appen startar
//  på rett språk før profilen er lasta.
// ═══════════════════════════════════════════════════════════════════

const TOM = { namn: '', adresse: '', postnr: '', poststad: '', fodselsaar: null, fodselsdato: null, tittel: '', sprak: 'nn', bilete_sti: '', kompetanse: [], prosjekterfaring: [] }
const lesSprak = () => { try { const v = localStorage.getItem('liedlab-sprak'); return v === 'bm' ? 'bm' : 'nn' } catch { return 'nn' } }

export async function signerteUrlar(stiar) {
  const unike = [...new Set((stiar || []).filter(Boolean))]
  if (!unike.length) return {}
  const { data } = await supabase.storage.from('brukar').createSignedUrls(unike, 3600)
  const ut = {}
  for (const d of data || []) if (d.signedUrl) ut[d.path] = d.signedUrl
  return ut
}

// Skaler eit bilete ned (maks `maks` px på lengste sida) og gjev JPEG-blob
export function skalerBilete(fil, maks = 1400, kvalitet = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fil)
    const img = new Image()
    img.onload = () => {
      const f = Math.min(1, maks / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Kunne ikkje lese biletet.'))), 'image/jpeg', kvalitet)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunne ikkje lese biletet.')) }
    img.src = url
  })
}
export async function lastOppBilete(userId, mappe, fil, maks) {
  const blob = await skalerBilete(fil, maks)
  const sti = `${userId}/${mappe}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const { error } = await supabase.storage.from('brukar').upload(sti, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return sti
}
export const slettBilete = (sti) => (sti ? supabase.storage.from('brukar').remove([sti]) : Promise.resolve())

export default function useBrukar(userId, userEmail) {
  const [profil, setProfil] = useState({ ...TOM, sprak: lesSprak(), namn: '' })
  const [lastar, setLastar] = useState(true)
  const [status, setStatus] = useState('') // '' | 'lagrar' | 'lagra' | 'feil'
  const [bileteUrl, setBileteUrl] = useState('')
  const timer = useRef(null)
  const ref = useRef(profil)
  const finst = useRef(false) // finst rada i databasen?

  const lagreNo = useCallback(async () => {
    if (!userId) return
    setStatus('lagrar')
    const p = ref.current
    const { error } = await supabase.from('brukar_profil').upsert({
      user_id: userId, namn: p.namn || '', adresse: p.adresse || '', postnr: p.postnr || '', poststad: p.poststad || '', fodselsaar: p.fodselsaar || null, fodselsdato: p.fodselsdato || null,
      tittel: p.tittel || '', sprak: p.sprak || 'nn', bilete_sti: p.bilete_sti || '', kompetanse: p.kompetanse || [], prosjekterfaring: p.prosjekterfaring || [], updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) { console.warn('[Brukar] lagring feila:', error.message); setStatus('feil'); return }
    finst.current = true
    setStatus('lagra')
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let avbrote = false
    supabase.from('brukar_profil').select('*').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (avbrote) return
      if (error) console.warn('[Brukar] kunne ikkje lese profil:', error.message)
      if (data) {
        finst.current = true
        const p = { ...TOM, ...data, sprak: data.sprak === 'bm' ? 'bm' : 'nn', kompetanse: data.kompetanse || [], prosjekterfaring: data.prosjekterfaring || [] }
        ref.current = p; setProfil(p)
        try { localStorage.setItem('liedlab-sprak', p.sprak) } catch { /* privat modus */ }
      } else {
        const p = { ...TOM, sprak: lesSprak(), namn: '' }
        ref.current = p; setProfil(p)
      }
      setLastar(false)
    })
    return () => { avbrote = true }
  }, [userId])

  // signert URL til profilbiletet
  useEffect(() => {
    let avbrote = false
    if (!profil.bilete_sti) { setBileteUrl(''); return }
    signerteUrlar([profil.bilete_sti]).then(m => { if (!avbrote) setBileteUrl(m[profil.bilete_sti] || '') })
    return () => { avbrote = true }
  }, [profil.bilete_sti])

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); lagreNo() } }, [lagreNo])

  const oppdater = useCallback((patch) => {
    const ny = { ...ref.current, ...patch }
    ref.current = ny
    setProfil(ny)
    if (patch.sprak) { try { localStorage.setItem('liedlab-sprak', ny.sprak) } catch { /* privat modus */ } }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; lagreNo() }, 800)
  }, [lagreNo])

  const visNamn = (profil.namn || '').trim() || (userEmail || '').split('@')[0]
  return { profil, lastar, status, oppdater, bileteUrl, visNamn, sprak: profil.sprak === 'bm' ? 'bm' : 'nn' }
}
