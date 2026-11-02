import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import ProsjektChat from './ProsjektChat'
import { vedleggOpplastingSti } from './vedlegg'

// ═══════════════════════════════════════════════════════════════════
//  Prosjekt-dashboard (Prosjektstyring) — det aktive prosjektet samla på éi side:
//  prosjektbilete (Vedlegg-bøtta, <prosjekt-id>/prosjektbilete/…), nyheiter (prosjekt_nyheiter) og prosjektchat.
//  Tilgang: alle med tilgang til prosjektet (RLS: kan_se_prosjekt / bøtte-policy kan_se_sti_prosjekt).
// ═══════════════════════════════════════════════════════════════════
const namnFraEpost = (e) => (e || '?').split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const tidTekst = (iso) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
const SIDE = 12   // bilete per «Vis fleire»

function Kort({ tittel, ikon, farge, hogre, children, stil }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...stil }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: farge }}/>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text2)', flex: 1 }}>{ikon} {tittel}</span>
        {hogre}
      </div>
      {children}
    </div>
  )
}

const KNAPP = { padding: '6px 12px', borderRadius: 'var(--r)', border: '1.5px solid var(--brand2)', background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }

// ── Prosjektbilete ────────────────────────────────────────────────
function Prosjektbilete({ pid }) {
  const [bilete, setBilete] = useState([])      // [{ namn, sti, url, tid }]
  const [lastar, setLastar] = useState(true)
  const [melding, setMelding] = useState('')
  const [opptatt, setOpptatt] = useState(false)
  const [antal, setAntal] = useState(SIDE)
  const [vist, setVist] = useState(null)        // indeks i lightbox
  const [dra, setDra] = useState(false)
  const filRef = useRef(null)
  const mappe = `${pid}/prosjektbilete`

  const last = useCallback(async () => {
    setLastar(true); setMelding('')
    const { data, error } = await supabase.storage.from('Vedlegg').list(mappe, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) { setMelding('Klarte ikkje hente bilete: ' + error.message); setBilete([]); setLastar(false); return }
    const filer = (data || []).filter(f => f.name && f.id)
    const stiar = filer.map(f => `${mappe}/${f.name}`)
    const { data: sign } = stiar.length ? await supabase.storage.from('Vedlegg').createSignedUrls(stiar, 3600) : { data: [] }
    const urlAv = Object.fromEntries((sign || []).map(s => [s.path, s.signedUrl]))
    setBilete(filer.map(f => ({ namn: f.name.replace(/^\d+_[a-z0-9]+_/, ''), sti: `${mappe}/${f.name}`, url: urlAv[`${mappe}/${f.name}`], tid: f.created_at })))
    setLastar(false)
  }, [mappe])
  useEffect(() => { setAntal(SIDE); setVist(null); last() }, [last])

  const lastOpp = async (filer) => {
    const bileteFiler = Array.from(filer || []).filter(f => f.type.startsWith('image/'))
    if (!bileteFiler.length) { setMelding('Berre biletfiler kan leggjast til her.'); return }
    setOpptatt(true); setMelding('')
    let feil = 0
    for (const f of bileteFiler) {
      const namn = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('Vedlegg').upload(vedleggOpplastingSti(pid, 'prosjektbilete/' + namn), f, { contentType: f.type })
      if (error) feil++
    }
    setOpptatt(false)
    if (feil) setMelding(feil + ' av ' + bileteFiler.length + ' bilete vart ikkje lasta opp.')
    await last()
  }
  const slett = async (b) => {
    if (!window.confirm('Slette biletet «' + b.namn + '»?')) return
    const { error } = await supabase.storage.from('Vedlegg').remove([b.sti])
    if (error) { setMelding('Klarte ikkje slette: ' + error.message); return }
    setVist(null); await last()
  }

  useEffect(() => {
    if (vist == null) return undefined
    const tast = (e) => {
      if (e.key === 'Escape') setVist(null)
      else if (e.key === 'ArrowRight') setVist(i => (i + 1) % bilete.length)
      else if (e.key === 'ArrowLeft') setVist(i => (i - 1 + bilete.length) % bilete.length)
    }
    window.addEventListener('keydown', tast)
    return () => window.removeEventListener('keydown', tast)
  }, [vist, bilete.length])

  const valt = vist != null ? bilete[vist] : null
  return (
    <Kort tittel="Prosjektbilete" ikon="🖼" farge="#F4A261"
      hogre={<>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{bilete.length} bilete</span>
        <button onClick={() => filRef.current?.click()} disabled={opptatt} style={{ ...KNAPP, opacity: opptatt ? .6 : 1 }}>{opptatt ? 'Lastar opp…' : '+ Legg til bilete'}</button>
        <input ref={filRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { lastOpp(e.target.files); e.target.value = '' }}/>
      </>}>
      <div onDragOver={e => { e.preventDefault(); setDra(true) }} onDragLeave={() => setDra(false)} onDrop={e => { e.preventDefault(); setDra(false); lastOpp(e.dataTransfer.files) }}
        style={{ padding: 14, background: dra ? 'var(--brandbg)' : 'transparent', transition: 'background .15s' }}>
        {melding && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 10 }}>{melding}</div>}
        {lastar ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
          : bilete.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '34px 12px', color: 'var(--text3)', fontSize: 13, border: '1.5px dashed var(--border)', borderRadius: 'var(--r)' }}>
              Ingen bilete enno. Dra bilete hit, eller trykk «Legg til bilete».
            </div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {bilete.slice(0, antal).map((b, i) => (
                <button key={b.sti} onClick={() => setVist(i)} title={b.namn}
                  style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)', aspectRatio: '4 / 3' }}>
                  {b.url && <img src={b.url} alt={b.namn} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}
                </button>
              ))}
            </div>
            {bilete.length > antal && <button onClick={() => setAntal(a => a + SIDE)} style={{ ...KNAPP, marginTop: 10 }}>Vis fleire ({bilete.length - antal})</button>}
          </>)}
      </div>

      {valt && (
        <div onClick={e => { if (e.target === e.currentTarget) setVist(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <img src={valt.url} alt={valt.namn} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 110px)', objectFit: 'contain', borderRadius: 6 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, color: '#fff', fontSize: 13 }}>
            <button onClick={() => setVist((vist - 1 + bilete.length) % bilete.length)} style={{ ...KNAPP, background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none' }}>‹</button>
            <span>{valt.namn} · {vist + 1}/{bilete.length}{valt.tid ? ' · ' + new Date(valt.tid).toLocaleDateString('nb-NO') : ''}</span>
            <button onClick={() => setVist((vist + 1) % bilete.length)} style={{ ...KNAPP, background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none' }}>›</button>
            <button onClick={() => slett(valt)} style={{ ...KNAPP, background: 'transparent', color: '#FCA5A5', borderColor: '#FCA5A5' }}>Slett</button>
            <button onClick={() => setVist(null)} style={{ ...KNAPP, background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none' }}>Lukk</button>
          </div>
        </div>
      )}
    </Kort>
  )
}

// ── Nyheiter ──────────────────────────────────────────────────────
function Nyheiter({ prosjekt, userId }) {
  const pid = prosjekt.id
  const [liste, setListe] = useState([])
  const [namn, setNamn] = useState({})
  const [erAdmin, setErAdmin] = useState(false)
  const [tittel, setTittel] = useState('')
  const [tekst, setTekst] = useState('')
  const [lastar, setLastar] = useState(true)
  const [opptatt, setOpptatt] = useState(false)
  const [feil, setFeil] = useState('')

  useEffect(() => {
    let avbrote = false
    setLastar(true); setFeil('')
    ;(async () => {
      const [n, k, a] = await Promise.all([
        supabase.from('prosjekt_nyheiter').select('*').eq('project_id', pid).order('created_at', { ascending: false }).limit(100),
        prosjekt.officeId ? supabase.from('office_members').select('user_id, invited_email').eq('office_id', prosjekt.officeId).eq('status', 'active') : Promise.resolve({ data: [] }),
        prosjekt.officeId ? supabase.from('office_members').select('id').eq('office_id', prosjekt.officeId).eq('user_id', userId).eq('role', 'admin').eq('status', 'active').limit(1) : Promise.resolve({ data: [] }),
      ])
      if (avbrote) return
      if (n.error) setFeil('Klarte ikkje hente nyheiter: ' + n.error.message)
      setListe(n.data || [])
      setNamn(Object.fromEntries((k.data || []).filter(x => x.user_id).map(x => [x.user_id, namnFraEpost(x.invited_email)])))
      setErAdmin(!!a.data?.length)
      setLastar(false)
    })()
    return () => { avbrote = true }
  }, [pid, prosjekt.officeId, userId])

  const publiser = async () => {
    if (!tekst.trim() || opptatt) return
    setOpptatt(true); setFeil('')
    const { data, error } = await supabase.from('prosjekt_nyheiter').insert({ project_id: pid, user_id: userId, tittel: tittel.trim(), tekst: tekst.trim() }).select().single()
    setOpptatt(false)
    if (error) { setFeil('Klarte ikkje publisere: ' + error.message); return }
    setListe(l => [data, ...l]); setTittel(''); setTekst('')
  }
  const slett = async (n) => {
    if (!window.confirm('Slette denne nyheita?')) return
    const { error } = await supabase.from('prosjekt_nyheiter').delete().eq('id', n.id)
    if (error) { setFeil('Klarte ikkje slette: ' + error.message); return }
    setListe(l => l.filter(x => x.id !== n.id))
  }
  const felt = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', outline: 'none' }

  return (
    <Kort tittel="Nyheiter" ikon="📰" farge="#52B788" hogre={<span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{liste.length} innlegg</span>}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={tittel} onChange={e => setTittel(e.target.value)} maxLength={200} placeholder="Overskrift (valfri)" style={felt}/>
        <textarea value={tekst} onChange={e => setTekst(e.target.value)} rows={3} maxLength={8000} placeholder="Del ei nyheit frå prosjektet — t.d. status, møte, vedtak eller milepæl…" style={{ ...felt, resize: 'vertical' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={publiser} disabled={!tekst.trim() || opptatt}
            style={{ padding: '8px 18px', borderRadius: 'var(--r)', border: 'none', background: tekst.trim() ? 'var(--brand)' : 'var(--bg3)', color: tekst.trim() ? '#fff' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: tekst.trim() ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>
            {opptatt ? 'Publiserer…' : 'Publiser'}
          </button>
          {feil && <span style={{ fontSize: 12.5, color: 'var(--danger)' }}>{feil}</span>}
        </div>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {lastar ? <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
          : liste.length === 0 ? <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Ingen nyheiter enno.</div>
          : liste.map(n => (
            <div key={n.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {n.tittel && <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>{n.tittel}</div>}
                {!n.tittel && <div style={{ flex: 1 }}/>}
                {(n.user_id === userId || erAdmin) && <button onClick={() => slett(n)} title="Slett nyheita" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, opacity: .7 }}>🗑</button>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 6px' }}>{n.user_id === userId ? 'Du' : (namn[n.user_id] || 'Ukjend')} · {tidTekst(n.created_at)}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.tekst}</div>
            </div>
          ))}
      </div>
    </Kort>
  )
}

// ── Sida ──────────────────────────────────────────────────────────
const STATUS_NAMN = { tilbod: 'Tilbod', sendt: 'Tilbod sendt', aktiv: 'Aktivt', tapt: 'Tapt', fullfort: 'Fullført' }

export default function ProsjektDashboard({ prosjekt, userId }) {
  if (!prosjekt) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>Vel eit prosjekt øvst for å sjå prosjekt-dashboardet.</div>
  }
  const smal = typeof window !== 'undefined' && window.innerWidth < 900
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '26px 24px 48px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>
            {prosjekt.projectNumber && <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', marginRight: 10 }}>{prosjekt.projectNumber}</span>}{prosjekt.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Prosjekt-dashboard{prosjekt.status ? ' · ' + (STATUS_NAMN[prosjekt.status] || prosjekt.status) : ''}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: smal ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(340px, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Prosjektbilete pid={prosjekt.id}/>
            <Nyheiter prosjekt={prosjekt} userId={userId}/>
          </div>
          <Kort tittel="Prosjektchat" ikon="💬" farge="#A78BFA" stil={{ height: smal ? 520 : 'calc(100vh - 210px)', minHeight: 480, position: smal ? 'static' : 'sticky', top: 16 }}>
            <div style={{ flex: 1, minHeight: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
              <ProsjektChat key={prosjekt.id} prosjekt={prosjekt} userId={userId}/>
            </div>
          </Kort>
        </div>
      </div>
    </div>
  )
}
