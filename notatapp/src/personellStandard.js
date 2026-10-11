import { supabase } from './supabase'
import { namnFraEpost } from './dtmKonstantar'

// Innlogga brukar skal vere med som personell i sine eigne prosjekt (brukar sitt krav 11. okt. 2026).
// – nyttProsjekt/addProject kallar `leggTilMegSomPersonell` rett etter opprettinga
// – for EKSISTERANDE prosjekt utan personell fyller `sikrStandardPersonell` inn brukaren fyrste gong
//   personell-lista vert opna (merkt i localStorage, så ei bevisst sletting ikkje vert gjort om att).
// Fornamn/etternamn (krav 12. okt.): hentast frå ei tidlegare personell-rad med same e-post (brukaren sine
// andre prosjekt), elles frå kontoen sine metadata, elles frå e-posten viss han har forma fornamn.etternamn.

const nokkel = (pid) => `liedlab-personell-seed-${pid}`
const hugsa = (pid) => { try { localStorage.setItem(nokkel(pid), '1') } catch { /* privat modus */ } }
const erSeedet = (pid) => { try { return localStorage.getItem(nokkel(pid)) === '1' } catch { return false } }

async function hentEpost() {
  const { data } = await supabase.auth.getUser()
  return { epost: data?.user?.email || '', meta: data?.user?.user_metadata || {} }
}

async function finnNamn(userId, epost, meta) {
  const { data } = await supabase.from('prosjekt_personell').select('fornamn,etternamn,namn').eq('user_id', userId).ilike('epost', epost)
    .neq('fornamn', '').neq('etternamn', '').limit(1)
  if (data?.length) return { fornamn: data[0].fornamn, etternamn: data[0].etternamn }
  if (meta.fornamn || meta.etternamn) return { fornamn: meta.fornamn || '', etternamn: meta.etternamn || '' }
  const heile = (meta.full_name || meta.name || '').trim()
  if (/\s/.test(heile)) return { fornamn: heile.replace(/\s+\S+$/, ''), etternamn: heile.match(/\S+$/)[0] }
  const delar = epost.split('@')[0].split(/[._-]+/).filter(Boolean)
  if (delar.length >= 2) {
    const kap = (d) => d.charAt(0).toUpperCase() + d.slice(1)
    return { fornamn: delar.slice(0, -1).map(kap).join(' '), etternamn: kap(delar[delar.length - 1]) }
  }
  return { fornamn: '', etternamn: '' } // ukjent — brukaren fyller inn i personell-lista
}

// Legg innlogga brukar til i prosjektet (hoppar over viss e-posten alt finst). Gjev ny rad eller null.
export async function leggTilMegSomPersonell(userId, projectId, { eksisterande = null } = {}) {
  const { epost, meta } = await hentEpost()
  let finst = eksisterande
  if (!finst) {
    const { data } = await supabase.from('prosjekt_personell').select('namn,epost').eq('user_id', userId).eq('project_id', projectId)
    finst = data || []
  }
  if (epost && finst.some(p => p.epost && p.epost.toLowerCase() === epost.toLowerCase())) return null
  const { fornamn, etternamn } = await finnNamn(userId, epost, meta)
  const namn = [fornamn, etternamn].filter(Boolean).join(' ') || namnFraEpost(epost) || 'Meg'
  if (finst.some(p => p.namn.trim().toLowerCase() === namn.toLowerCase())) return null
  const { data, error } = await supabase.from('prosjekt_personell')
    .insert({ user_id: userId, project_id: projectId, namn, fornamn, etternamn, rolle: '', prosent: 100, epost, merknad: '', sortering: finst.length })
    .select().single()
  if (error) { console.warn('[Personell] kunne ikkje leggje til brukaren:', error.message); return null }
  return data
}

// Fyller inn brukaren i eit prosjekt utan personell, éin gong per prosjekt. Gjev ny rad eller null.
export async function sikrStandardPersonell(userId, projectId, noverande) {
  if (!userId || !projectId || noverande.length > 0 || erSeedet(projectId)) return null
  hugsa(projectId)
  return leggTilMegSomPersonell(userId, projectId, { eksisterande: noverande })
}
export const merkSeedet = hugsa
