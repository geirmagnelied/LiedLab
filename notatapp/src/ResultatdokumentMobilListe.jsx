import { useState } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════
//  ResultatdokumentMobilListe — vist i DTM-modulen i staden for den
//  vanlege «Krev skrivebordsversjonen»-sperra, NÅR prosjektet har slått
//  på «Skyopplasting» (sjå Prosjekt-modulen/claude/dtm-modul.md). Fungerer
//  i EIN KVAR nettlesar (ingen Electron-bru) — same idé som Bilete-
//  modulen sin mobil-opplasting, berre omvendt veg (last NED i staden
//  for OPP).
//
//  Filene sjølve vert ALDRI lasta ned hit på førehand — kvar «Opne»-klikk
//  bed Supabase Storage om ei fersk, kortvarig signert lenke (60 sek) og
//  opnar ho i ein ny fane, sidan bøtta er PRIVAT (ikkje offentleg lesbar).
// ═══════════════════════════════════════════════════════════════════

export default function ResultatdokumentMobilListe({ dokumenter, userId, activeProjectId }) {
  const [status, setStatus] = useState({}) // id -> 'lastar' | 'feil' | undefined

  const resultatDok = dokumenter
    .filter(d => d.resultatdokument?.filnamn)
    .sort((a, b) => a.nr.localeCompare(b.nr, 'no', { numeric:true }))

  const opne = async (d) => {
    setStatus(s => ({ ...s, [d.id]: 'lastar' }))
    const ext = /\.([a-z0-9]+)$/i.exec(d.resultatdokument.filnamn)?.[1]?.toLowerCase() || 'pdf'
    const sti = `${userId}/${activeProjectId}/${d.nr}.${ext}`
    const { data, error } = await supabase.storage.from('dtm-resultatdokument').createSignedUrl(sti, 60)
    if (error || !data?.signedUrl) { setStatus(s => ({ ...s, [d.id]: 'feil' })); return }
    window.open(data.signedUrl, '_blank')
    setStatus(s => ({ ...s, [d.id]: undefined }))
  }

  return (
    <div style={{ padding:'20px 16px', maxWidth:560, margin:'0 auto' }}>
      <div className="dt-etikett" style={{ marginBottom:10 }}>
        Resultatdokument frå skya ({resultatDok.length})
      </div>
      {resultatDok.length === 0 ? (
        <p style={{ fontSize:13, color:'var(--text3)', lineHeight:1.6 }}>
          Ingen resultatdokument er lasta opp til skya for dette prosjektet enno — dei vert lasta opp
          automatisk frå skrivebordsappen etter kvart som dei vert importerte/oppdaterte der.
        </p>
      ) : (
        <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
          {resultatDok.map((d, i) => (
            <button key={d.id} onClick={() => opne(d)} disabled={status[d.id] === 'lastar'}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                padding:'12px 14px', border:'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                background:'var(--bg2)', cursor:'pointer', fontFamily:'var(--font)' }}>
              <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', fontSize:13, flexShrink:0 }}>
                {d.nr}
              </span>
              <span style={{ flex:1, fontSize:13, color:'var(--text)', overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {d.tittel || d.nr}
              </span>
              <span style={{ fontSize:11.5, color: status[d.id] === 'feil' ? 'var(--danger)' : 'var(--text3)', flexShrink:0 }}>
                {status[d.id] === 'lastar' ? 'Opnar…' : status[d.id] === 'feil' ? 'Ikkje funne i skya' : 'Opne ›'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
