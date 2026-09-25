import { useState, useMemo } from 'react'
import { finnGjeldandeKategori, KATEGORI_LABEL, UTSENDING_KANALAR, utsendingsnrTekst } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTMUtsendingModal — registrering av éi utsending (t.d. e-post) av eitt
//  eller fleire dokument. Sjå claude/dtm-modul.md.
//
//  Lagra som KLADD i Supabase med det same ho vert oppretta — å lukke
//  dette vindauget mistar difor ALDRI noko. Brukar kan opne e-postpro-
//  grammet, dra ut for å faktisk sende, og kome attende hit seinare (via
//  «Utsendingar»-lista) for å leggje til fleire dokument eller stadfeste.
//
//  «Stadfesting av sending» har to nivå:
//   1. Sjølvmelding — brukar trykker «Stadfest sending» sjølv.
//   2. Ekte kvittering — brukar legg ved den FAKTISK sendte e-posten
//      (t.d. .msg-fil). Dette set status til sendt automatisk.
// ═══════════════════════════════════════════════════════════════════

export default function DTMUtsendingModal({ utsending, dokumenter, oppdragsSti, onLukk,
                                             onOppdater, onLeggTilDokument, onFjernDokument,
                                             onApneEpost, onBekreftSendt, onLagreKvittering, onApneKvittering }) {
  const [visVeljar, setVisVeljar] = useState(false)
  const [veljarSøk, setVeljarSøk] = useState('')
  const [veljarValde, setVeljarValde] = useState(() => new Set())
  const [feil, setFeil] = useState('')
  const [epostStatus, setEpostStatus] = useState(null) // { ok, metode, melding } frå siste «Opne e-post»
  const [opnarEpost, setOpnarEpost] = useState(false)
  const [lagrarKvittering, setLagrarKvittering] = useState(false)
  const [dragOverKvittering, setDragOverKvittering] = useState(false)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const sendt = utsending.status === 'sendt'
  const alleredeLagt = new Set((utsending.dokument || []).map(d => d.nr))
  const kanalSett = new Set(utsending.kanal || [])

  const veljarTreff = useMemo(() => {
    const s = veljarSøk.toLowerCase()
    return dokumenter.filter(d => !alleredeLagt.has(d.nr)
      && (!s || d.nr.toLowerCase().includes(s) || (d.tittel || '').toLowerCase().includes(s)))
  }, [veljarSøk, dokumenter, alleredeLagt])

  const veksleKanal = (key) => {
    if (sendt) return
    const nytt = new Set(kanalSett)
    nytt.has(key) ? nytt.delete(key) : nytt.add(key)
    onOppdater('kanal', [...nytt])
  }

  const opneVeljar = () => { setVeljarSøk(''); setVeljarValde(new Set()); setVisVeljar(true) }
  const veksleVeljarVal = (id) => {
    setVeljarValde(v => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const leggTilValde = () => {
    for (const dok of dokumenter) {
      if (!veljarValde.has(dok.id)) continue
      const sett = finnGjeldandeKategori(dok)
      const g = sett && dok[sett]
      onLeggTilDokument({ dokument_id: dok.id, nr: dok.nr, kategori: sett || '', filnamn: g?.filnamn || '', revisjon: g?.revisjon || '' })
    }
    setVisVeljar(false)
  }

  const opneEpost = async () => {
    setOpnarEpost(true)
    setEpostStatus(null)
    try {
      const svar = await onApneEpost()
      setEpostStatus(svar || null)
    } catch (e) {
      setEpostStatus({ ok:false, melding: e.message })
    }
    setOpnarEpost(false)
  }

  const lagreKvitteringFraSti = async (kjeldeSti) => {
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

  const velgKvitteringsfil = async () => {
    if (!harBru) return
    const sti = await window.resultatdokumentAPI.dtmVelgKvitteringsfil()
    if (sti) await lagreKvitteringFraSti(sti)
  }

  const handleKvitteringDrop = async (e) => {
    e.preventDefault()
    setDragOverKvittering(false)
    if (!harBru) return
    const filer = Array.from(e.dataTransfer.files || [])
    const kjeldeSti = filer.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)[0]
    if (kjeldeSti) await lagreKvitteringFraSti(kjeldeSti)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:'min(94vw, 680px)',
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#2563EB' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
            Registrer utsending {utsending.utsendingsnr ? `— ${utsendingsnrTekst(utsending.utsendingsnr)}` : ''}
          </span>
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
            <Felt namn="Dato">
              <input type="date" className="dt-input" value={utsending.dato || ''} disabled={sendt}
                onChange={e => onOppdater('dato', e.target.value)}/>
            </Felt>
            <Felt namn="Emnefelt (e-post)">
              <input className="dt-input" value={utsending.emne || ''} disabled={sendt}
                onChange={e => onOppdater('emne', e.target.value)} placeholder="T.d. Oversending av tegningar"/>
            </Felt>
            <Felt namn="Kommentar">
              <input className="dt-input" value={utsending.kommentar || ''} disabled={sendt}
                onChange={e => onOppdater('kommentar', e.target.value)} placeholder="Valfritt"/>
            </Felt>
          </div>

          <Felt namn="Kanal (kan velje fleire)">
            <div style={{ display:'flex', gap:14 }}>
              {UTSENDING_KANALAR.map(k => (
                <label key={k.key} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5,
                  color:'var(--text2)', cursor: sendt ? 'default' : 'pointer' }}>
                  <input type="checkbox" checked={kanalSett.has(k.key)} disabled={sendt} onChange={() => veksleKanal(k.key)}/>
                  {k.namn}
                </label>
              ))}
            </div>
          </Felt>

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
            {!sendt && !visVeljar && (
              <button className="dt-knapp" style={{ marginTop:8 }} onClick={opneVeljar}>+ Legg til dokument…</button>
            )}
            {!sendt && visVeljar && (
              <div style={{ marginTop:8, border:'1.5px solid var(--border)', borderRadius:'var(--r)', padding:10 }}>
                <input autoFocus className="dt-input" value={veljarSøk} onChange={e => setVeljarSøk(e.target.value)}
                  placeholder="Filtrer på nr. eller tittel…" style={{ marginBottom:8 }}/>
                <div style={{ maxHeight:220, overflow:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
                  {veljarTreff.length === 0 ? (
                    <div style={{ padding:10, fontSize:12, color:'var(--text3)' }}>Ingen treff.</div>
                  ) : veljarTreff.map(d => (
                    <label key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      borderBottom:'1px solid var(--border)', cursor:'pointer', fontSize:12.5 }}>
                      <input type="checkbox" checked={veljarValde.has(d.id)} onChange={() => veksleVeljarVal(d.id)}/>
                      <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)' }}>{d.nr}</span>
                      <span style={{ color:'var(--text2)' }}>{d.tittel}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  <button className="dt-knapp" onClick={() => setVisVeljar(false)}>Avbryt</button>
                  <button className="dt-knapp hovud" disabled={veljarValde.size === 0} onClick={leggTilValde}>
                    Legg til valde ({veljarValde.size})
                  </button>
                </div>
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
                  padding:'14px', textAlign:'center', fontSize:12, color:'var(--text3)' }}>
                {lagrarKvittering ? 'Lagrar…' : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
                    <span>Dra den sendte e-posten hit, eller vel ho frå disken. (Direkte drag frå Outlook fungerer
                      ikkje alltid — dra ho i så fall fyrst til skrivebordet, dra så .msg-fila hit i staden.)</span>
                    <button className="dt-knapp" onClick={velgKvitteringsfil} disabled={!harBru}>Vel fil…</button>
                  </div>
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

          {epostStatus && (
            <div style={{ fontSize:12, color: epostStatus.metode === 'outlook' ? 'var(--success)' : 'var(--warn)' }}>
              {epostStatus.metode === 'outlook'
                ? `✓ E-post oppretta i Outlook med ${epostStatus.talVedlegg} vedlegg lagt ved. Sjå over og trykk send i Outlook.`
                : `Kunne ikkje leggje ved filene automatisk (${epostStatus.melding || 'Outlook ikkje tilgjengeleg'}) — opna e-post med filstiane i teksten i staden (kopiert til utklippstavla òg).`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <button className="dt-knapp" disabled={!harBru || (utsending.dokument || []).length === 0 || opnarEpost} onClick={opneEpost}>
            {opnarEpost ? 'Opnar…' : 'Opne e-post'}
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
