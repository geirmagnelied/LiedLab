import DataTabell from './DataTabell'

// ═══════════════════════════════════════════════════════════════════
//  BileteTabell — tynn wrapper rundt DataTabell.jsx for Bilete-modulen,
//  same mønster som SakerTabell/TeikningTabell/DTMTabell. Sjå
//  claude/bilete-modul.md.
// ═══════════════════════════════════════════════════════════════════

const KOLONNAR = [
  { key:'nr',             label:'Nr.',           art:'tekst', mono:true, opnaFil:true, totalTeljing:true },
  { key:'filnamn',        label:'Filnamn',       art:'tekst', opnaFil:true, beregna:true },
  { key:'dato_tatt',      label:'Dato teke',     art:'dato',  mono:true, redigerbar:true },
  { key:'plassering',     label:'Plassering',    art:'tekst', redigerbar:true },
  { key:'teke_av',        label:'Teke av',       art:'tekst', redigerbar:true },
  { key:'importert_av',   label:'Importert av',  art:'val',   beregna:true },
  { key:'importert_dato', label:'Importert',     art:'dato',  mono:true, beregna:true },
  { key:'kjelde',         label:'Kjelde',        art:'val',   val:['skrivebord', 'mobil'], beregna:true },
]

const hentVerdi = (rad, key) => rad[key] ?? ''

export default function BileteTabell({ bilete, onSetVerdi, onOpneFil, merking }) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:300,
      border:'1.5px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
      <DataTabell
        rader={bilete}
        kolonnar={KOLONNAR}
        hentVerdi={hentVerdi}
        radId={r => r.id}
        onSetVerdi={onSetVerdi}
        onOpneFil={onOpneFil}
        merking={merking}
        rutenettRedigering
        prefsKey="liedlab-bilete-tabell-v1"
        itemNamn="bilete"
        defaultSortering={{ key:'nr', dir:'desc' }}
      />
    </div>
  )
}
