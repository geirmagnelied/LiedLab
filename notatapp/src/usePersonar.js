import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Namn på personar som kan ha ansvar for ei oppgåve: prosjektets personell + brukaren sjølv (frå profilen).
// `meg` er standard ansvarleg for oppgåver brukaren skriv sjølv.
export default function usePersonar(userId, projectId) {
  const [personell, setPersonell] = useState([])
  const [meg, setMeg] = useState('')
  useEffect(() => {
    if (!userId) return
    let ok = true
    supabase.from('brukar_profil').select('namn').eq('user_id', userId).maybeSingle().then(({ data }) => { if (ok) setMeg((data?.namn || '').trim()) })
    return () => { ok = false }
  }, [userId])
  useEffect(() => {
    if (!userId || !projectId) { setPersonell([]); return }
    let ok = true
    supabase.from('prosjekt_personell').select('namn').eq('user_id', userId).eq('project_id', projectId).order('sortering').order('id')
      .then(({ data }) => { if (ok) setPersonell((data || []).map(p => p.namn).filter(Boolean)) })
    return () => { ok = false }
  }, [userId, projectId])
  const personar = Array.from(new Set([meg, ...personell].filter(Boolean)))
  return { personar, meg }
}
