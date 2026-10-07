import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { hentKalender, STANDARD_KONTORKALENDER } from './kontorkalender'

// Les/skriv kontorkalenderen (kontor_kalender, éi rad per brukar). Gjev
// standardkalenderen (8 t, man–fre, stille veke, jul …) til oppsettet er lasta
// og viss brukaren ikkje har lagra noko eige enno.
export default function useKontorkalender(userId) {
  const [kal, setKal] = useState(STANDARD_KONTORKALENDER)
  const [lastar, setLastar] = useState(true)
  const [feil, setFeil] = useState('')

  useEffect(() => {
    let avbrote = false
    if (!userId) { setLastar(false); return }
    supabase.from('kontor_kalender').select('innstillingar').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (avbrote) return
        if (error) console.warn('[Kontorkalender] kunne ikkje lese:', error.message)
        setKal(hentKalender(data?.innstillingar))
        setLastar(false)
      })
    return () => { avbrote = true }
  }, [userId])

  const lagre = useCallback(async (ny) => {
    setKal(ny); setFeil('')
    const { error } = await supabase.from('kontor_kalender')
      .upsert({ user_id: userId, innstillingar: ny, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) setFeil('Klarte ikkje lagre kalenderen: ' + error.message)
  }, [userId])

  return { kal, lagre, lastar, feil }
}
