import { useState } from 'react'

// Kollapsbar verktøylinje like til høgre for venstremenyen (AppRail) i Framdrift: legg til
// fase/aktivitet/milepæl, malar, import og angre. Open/lukka-val vert hugsa i localStorage.
const LAGRE = 'liedlab-framdrift-verktoy-open'

export default function FramdriftVerktoy({ onLeggTil, onMal, onImport, onAngre, angreAntal }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(LAGRE) !== '0' } catch { return true } })
  const veksle = () => setOpen(o => { const n = !o; try { localStorage.setItem(LAGRE, n ? '1' : '0') } catch { /* privat modus */ } return n })

  const Val = ({ ikon, tekst, onClick, hovud, disabled, tips }) => (
    <button onClick={onClick} disabled={disabled} title={tips || tekst}
      className={'fd-knapp' + (hovud ? ' hovud' : '')}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: open ? 'flex-start' : 'center', padding: open ? '7px 10px' : '7px 0' }}>
      <span style={{ fontSize: 15, lineHeight: 1, width: 16, textAlign: 'center' }}>{ikon}</span>
      {open && <span>{tekst}</span>}
    </button>
  )

  return (
    <div style={{ width: open ? 158 : 46, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 6px',
      background: 'var(--bg3)', borderRight: '1px solid var(--border)', transition: 'width .15s', overflow: 'hidden' }}>
      <button onClick={veksle} title={open ? 'Skjul verktøylinja' : 'Vis verktøylinja'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px 8px',
          color: 'var(--text3)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font)' }}>
        <span style={{ fontSize: 14 }}>{open ? '‹' : '›'}</span>{open && 'Verktøy'}
      </button>
      <Val hovud ikon="▬" tekst="+ Fase" tips="Ny fase" onClick={() => onLeggTil('fase')}/>
      <Val ikon="▭" tekst="+ Aktivitet" tips="Ny aktivitet" onClick={() => onLeggTil('aktivitet')}/>
      <Val ikon="◆" tekst="+ Milepæl" tips="Ny milepæl" onClick={() => onLeggTil('milepael')}/>
      <div style={{ height: 1, background: 'var(--border)', margin: '4px 2px' }}/>
      <Val ikon="▤" tekst="Malar…" onClick={onMal}/>
      <Val ikon="⇩" tekst="Importer…" onClick={onImport}/>
      <Val ikon="↶" tekst="Angre" tips="Angre siste endring (Ctrl+Z)" onClick={onAngre} disabled={!angreAntal}/>
    </div>
  )
}
