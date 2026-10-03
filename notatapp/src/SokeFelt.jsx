import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════
//  SokeFelt — delt, gjenbrukbar søkjekomponent (input + nedtrekks-
//  resultatliste), sjå claude/sok-modul.md og sok_index/sok()-RPC-en i
//  supabase-sok-index.sql. Same utforming og plassering (oppe til
//  venstre i kvar modul sin verktøylinje) overalt — brukar sitt eige
//  krav 29. sept. 2026.
//
//  Reint UI-lag — kallaren (kvar modul) avgjer sjølv KVA eit treff skal
//  gjere (opne eit notat, ei sak, ei fil …) via `onVelgResultat`, sidan
//  kvar modul alt har sin eigen «opne dette»-logikk (t.d. DTMModule sin
//  opneFil()) som denne komponenten ikkje skal duplisere.
// ═══════════════════════════════════════════════════════════════════

const KJELDE_NAMN = { notes:'Notat', cases:'Sak', dtm_dokumenter:'DTM-dokument' }

export default function SokeFelt({ projectId, kjelder, onVelgResultat, plassholder = 'Søk…', breidd = 230 }) {
  const [tekst, setTekst]         = useState('')
  const [resultat, setResultat]   = useState([])
  const [open, setOpen]           = useState(false)
  const [lastar, setLastar]       = useState(false)
  const boksRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!tekst.trim()) { setResultat([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLastar(true)
      const { data, error } = await supabase.rpc('sok', {
        q: tekst.trim(), p_project_id: projectId ?? null, p_kjelder: kjelder ?? null,
      })
      setLastar(false)
      if (!error) { setResultat(data || []); setOpen(true) }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [tekst, projectId, kjelder])

  useEffect(() => {
    const lukk = (e) => { if (boksRef.current && !boksRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', lukk)
    return () => document.removeEventListener('mousedown', lukk)
  }, [])

  return (
    <div ref={boksRef} style={{ position:'relative', width:breidd, flexShrink:0 }}>
      <input value={tekst} onChange={e => setTekst(e.target.value)}
        onFocus={() => resultat.length > 0 && setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur() } }}
        placeholder={plassholder}
        style={{ width:'100%', padding:'7px 11px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
          background:'var(--bg2)', color:'var(--text)', fontSize:12.5, fontFamily:'var(--font)',
          outline:'none', boxSizing:'border-box' }}/>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, width:Math.max(breidd, 320),
          maxHeight:360, overflow:'auto', background:'var(--bg2)', border:'1px solid var(--border)',
          borderRadius:'var(--r2)', boxShadow:'var(--shadow-lg)', zIndex:300 }}>
          {lastar ? (
            <div style={{ padding:'10px 14px', fontSize:12.5, color:'var(--text3)' }}>Søkjer…</div>
          ) : resultat.length === 0 ? (
            <div style={{ padding:'10px 14px', fontSize:12.5, color:'var(--text3)' }}>Ingen treff.</div>
          ) : resultat.map(r => (
            <button key={`${r.kjelde_tabell}-${r.kjelde_id}`} type="button"
              onClick={() => { onVelgResultat?.(r); setOpen(false); setTekst('') }}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 14px', border:'none',
                borderBottom:'1px solid var(--border)', background:'transparent', cursor:'pointer' }}>
              <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase',
                color:'var(--brand)' }}>
                {KJELDE_NAMN[r.kjelde_tabell] || r.kjelde_tabell}
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.tittel || '(utan tittel)'}</div>
              {r.samandrag && (
                <div style={{ fontSize:11.5, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis',
                  whiteSpace:'nowrap' }}>{r.samandrag}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
