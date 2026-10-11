import { supabase } from './supabase'
import { namnFraEpost } from './dtmKonstantar'

// Innlogga brukar skal vere med som personell i sine eigne prosjekt (brukar sitt krav 11. okt. 2026).
// – nyttProsjekt/addProject kallar `leggTilMegSomPersonell` rett etter opprettinga
// – for EKSISTERANDE prosjekt utan personell fyller `sikrStandardPersonell` inn brukaren fyrste gong
//   personell-lista vert opna (merkt i localStorage, så ei bevisst sletting ikkje vert gjort om att).

const nokkel = (pid) => `liedlab-personell-seed-${pid}`
const hugsa = (pid) => { try { localStorage.setItem(nokkel(pid), '1') } catch { /* privat modus */ } }
const erSeedet = (pid) => { try { return localStorage.getItem(nokkel(pid)) === '1' } catch { return false } }

async function hentEpost() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.email || ''
}

// Legg innlogga brukar til i prosjektet (hoppar over viss same namn/e-post alt finst). Gjev ny rad eller null.
export async function leggTilMegSomPersonell(userId, projectId, { eksisterande = null } = {}) {
  const epost = await hentEpost()
  const namn = namnFraEpost(epost) || 'Eg'
  let finst = eksisterande
  if (!finst) {
    const { data } = await supabase.from('prosjekt_personell').select('namn,epost').eq('user_id', userId).eq('project_id', projectId)
    finst = data || []
  }
  if (finst.some(p => (p.epost && p.epost.toLowerCase() === epost.toLowerCase()) || p.namn.trim().toLowerCase() === namn.toLowerCase())) return null
  const { data, error } = await supabase.from('prosjekt_personell')
    .insert({ user_id: userId, project_id: projectId, namn, rolle: '', prosent: 100, epost, merknad: '', sortering: finst.length })
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
