import { supabase } from './supabase'

// Vedlegg-bøtta er privat: lenkjer er signerte og tidsavgrensa (1 time). Gamle vedlegg har berre den tidlegare offentlege URL-en lagra — stien vert henta ut av han.
export function vedleggSti(att) {
  if (att?.path) return att.path
  const m = String(att?.url || '').match(/\/Vedlegg\/(.+?)(\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}
export async function vedleggUrl(att) {
  const sti = vedleggSti(att)
  if (!sti) return att?.url
  const { data, error } = await supabase.storage.from('Vedlegg').createSignedUrl(sti, 3600)
  if (error) { console.error('Signert vedlegg-lenkje feila:', error.message); return att?.url }
  return data.signedUrl
}
// onClick-handterar for <a href={att.url}>: opnar signert lenkje i ny fane
export async function opneVedlegg(e, att) {
  e.preventDefault()
  const url = await vedleggUrl(att)
  if (url) window.open(url, '_blank', 'noopener')
}
