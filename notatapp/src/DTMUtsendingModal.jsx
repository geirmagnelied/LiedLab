import { useState, useMemo } from 'react'
import { finnGjeldandeKategori, KATEGORI_LABEL } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTMUtsendingModal — registrering av éi utsending (t.d. e-post) av eitt
//  eller fleire dokument. Sjå claude/dtm-modul.md.
//
//  Lagra som KLADD i Supabase med det same ho vert oppretta (sjå
//  DTMModule.jsx sin opprettUtsendingKladd()) — å lukke dette vindauget
//  mistar difor ALDRI noko. Brukar kan opne e-postprogrammet, dra ut for
//  å faktisk sende, og kome attende hit seinare (via «Utsendingar»-lista)
//  for å leggje til fleire dokument eller stadfeste sending.
//
//  «Stadfesting av sending» har to nivå:
//   1. Sjølvmelding — brukar trykker «Stadfest sending» sjølv.
//   2. Ekte kvittering — brukar dreg inn den FAKTISK sendte e-posten
//      (Outlook let deg dra ein e-post ut som .msg-fil) som prov. Dette
//      set status til sendt automatisk, sidan ei kvittering FRÅ e-post-
//      programmet er sterkare dokumentasjon enn ei eigenmelding.
// ═══════════════════════════════════════════════════════════════════

const KANALAR = [
  { key:'epost', namn:'E-post' },
  { key:'webhotell', namn:'Webhotell' },
  { key:'anna', namn:'Anna' },
]

export default function DTMUtsendingModal({ utsending, dokumenter, oppdragsSti, onLukk,
                                             onOppdater, onLeggTilDokument, onFjernDokument,
                                             onApneEpost, onBekreftSendt, onLagreKvittering, onApneKvittering }) {
  const [søk, setSøk] = useState('')
  const [dragOverKvittering, setDragOverKvittering] = useState(false)
  const [feil, setFeil] = useState('')
  const [lagrarKvittering, setLagrarKvittering] = useState(false)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const sendt = utsending.status === 'sendt'
  const alleredeLagt = new Set((utsending.dokument || []).map(d => d.nr))

  const treff = useMemo(() => {
    if (!søk.trim()) return []
    const s = søk.toLowerCase()
    return dokumenter
      .filter(d => !alleredeLagt.has(d.nr) && (d.nr.toLowerCase().includes(s) || (d.tittel || '').toLowerCase().includes(s)))
      .slice(0, 8)
  }, [søk, dokumenter, alleredeLagt])

  const leggTil = (dok) => {
    const sett = finnGjeldandeKategori(dok)
    const g = sett && dok[sett]
    onLeggTilDokument({
      dokument_id: dok.id, nr: dok.nr, kategori: sett || '',
      filnamn: g?.filnamn || '', revisjon: g?.revisjon || '',
    })
    setSøk('')
  }

  const handleKvitteringDrop = async (e) => {
    e.preventDefault()
    setDragOverKvittering(false)
    if (!harBru) return
    const filer = Array.from(e.dataTransfer.files || [])
    const kjeldeSti = filer.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)[0]
    if (!kjeldeSti) return
    setLagrarKvittering(true)
    setFeil('')
    try {
      await onLagreKvittering(kjeldeSti)
    } catch (e2) {
      setFeil('Klarte ikkje lagre kvitteringa: ' + e2.message)
    }
    setLagrarKvittering(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:'min(94vw, 640px)',
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#2563EB' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Registrer utsending</span>
          <span style={{ marginLeft:4, padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700,
            textTransform:'uppercase', letterSpacing:'.03em',
            background: sendt ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.15)', color:'#fff' }}>
            {sendt ? 'Sendt' : 'Kladd'}
          </span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk (lagrar automatisk)"
            style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
              color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Felt namn="Mottakar">
              <input className="dt-input" value={utsending.mottakar || ''} disabled={sendt}
                onChange={e => onOppdater('mottakar', e.target.value)} placeholder="Namn/firma/e-post"/>
            </Felt>
            <Felt namn="Kanal">
              <select className="dt-input" value={utsending.kanal || 'epost'} disabled={sendt}
                onChange={e => onOppdater('kanal', e.target.value)}>
                {KANALAR.map(k => <option key={k.key} value={k.key}>{k.namn}</option>)}
              </select>
            </Felt>
            <Felt namn="Dato">
              <input type="date" className="dt-input" value={utsending.dato || ''} disabled={sendt}
                onChange={e => onOppdater('dato', e.target.value)}/>
            </Felt>
            <Felt namn="Kommentar">
              <input className="dt-input" value={utsending.kommentar || ''} disabled={sendt}
                onChange={e => onOppdater('kommentar', e.target.value)} placeholder="Valfritt"/>
            </Felt>
          </div>

          {/* Dokumentliste */}
          <div>
            <div className="dt-etikett" style={{ marginBottom:6 }}>Dokument i denne utsendinga ({(utsending.dokument || []).length})</div>
            <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
              {(utsending.dokument || []).length === 0 ? (
                <div style={{ padding:'12px', fontSize:12.5, color:'var(--text3)' }}>Ingen dokument lagt til enno.</div>
              ) : utsending.dokument.map((d, i) => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', fontSize:12.5 }}>{d.nr}</span>
                  <span style={{ fontSize:11.5, color:'var(--text3)' }}>{KATEGORI_LABEL[d.kategori] || d.kategori}</span>
                  <span style={{ fontSize:11.5, color:'var(--text3)', flex:1, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={d.filnamn}>{d.filnamn}</span>
                  {!sendt && (
                    <button onClick={() => onFjernDokument(d.id)} title="Fjern"
                      style={{ border:'none', background:'transparent', color:'var(--text3)', fontSize:14, cursor:'pointer', fontWeight:800 }}>×</button>
                  )}
                </div>
              ))}
            </div>
            {!sendt && (
              <div style={{ position:'relative', marginTop:8 }}>
                <input className="dt-input" value={søk} onChange={e => setSøk(e.target.value)}
                  placeholder="Søk for å leggje til fleire dokument (nr. eller tittel)…"/>
                {treff.length > 0 && (
                  <div className="dt-meny" style={{ position:'absolute', left:0, top:'calc(100% + 4px)', width:'100%' }}>
                    {treff.map(d => (
                      <button key={d.id} type="button" className="dt-val" onClick={() => leggTil(d)}>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', marginRight:8 }}>{d.nr}</span>
                        <span>{d.tittel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kvittering */}
          <div>
            <div className="dt-etikett" style={{ marginBottom:6 }}>Kvittering (dokumentasjon på at e-posten faktisk vart sendt)</div>
            {utsending.kvittering_fil ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                border:'1.5px solid var(--border)', borderRadius:'var(--r)', fontSize:12.5 }}>
                <span>📎</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{utsending.kvittering_fil}</span>
                <button className="dt-knapp" onClick={onApneKvittering}>Opne</button>
              </div>
            ) : (
              <div onDragOver={e => { e.preventDefault(); setDragOverKvittering(true) }}
                onDragLeave={() => setDragOverKvittering(false)} onDrop={handleKvitteringDrop}
                style={{ border:`2px dashed ${dragOverKvittering ? '#2563EB' : 'var(--border2)'}`,
                  borderRadius:'var(--r)', background: dragOverKvittering ? 'var(--bg3)' : 'var(--bg2)',
                  padding:'16px', textAlign:'center', fontSize:12, color:'var(--text3)' }}>
                {lagrarKvittering ? 'Lagrar…' : (
                  <>Dra den sendte e-posten hit (t.d. dra ho til skrivebordet frå Outlook fyrst, dra så .msg-fila hit) —
                  valfritt, men gjev sikrare dokumentasjon enn berre å stadfeste sjølv.</>
                )}
              </div>
            )}
            {feil && <div style={{ marginTop:8, fontSize:12, color:'var(--danger)' }}>{feil}</div>}
          </div>

          {sendt && (
            <div style={{ fontSize:11.5, color:'var(--text3)' }}>
              Stadfesta sendt av {utsending.bekrefta_av || '—'}
              {utsending.bekrefta_tid && ` ${new Date(utsending.bekrefta_tid).toLocaleString('no-NO')}`}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <button className="dt-knapp" disabled={!harBru || (utsending.dokument || []).length === 0} onClick={onApneEpost}>
            Opne e-post
          </button>
          <div style={{ flex:1 }}/>
          {!sendt && (
            <button className="dt-knapp hovud" onClick={onBekreftSendt}>Stadfest sending</button>
          )}
          <button className="dt-knapp" onClick={onLukk}>Lukk</button>
        </div>
      </div>
    </div>
  )
}

function Felt({ namn, children }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span className="dt-etikett">{namn}</span>
      {children}
    </label>
  )
}
