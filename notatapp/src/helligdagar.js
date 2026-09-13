// ── Norske heilagdagar / fridagar ────────────────────────────────────
// Påskedag er rekna ut med Meeus/Jones/Butcher-algoritmen (proleptisk
// gregoriansk kalender, gjeld for alle år appen realistisk vil vise).
// Resten av dei rørlege heilagdagane er faste avstandar frå påskedag.
// Ingen ekstern avhengigheit — brukt av KalenderModule.jsx.

function paaskedag(aar) {
  const a = aar % 19
  const b = Math.floor(aar / 100)
  const c = aar % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maanad = Math.floor((h + l - 7 * m + 114) / 31)
  const dag    = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(aar, maanad - 1, dag)
}

function nokkel(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const cache = new Map()

function helligdagarForAr(aar) {
  if (cache.has(aar)) return cache.get(aar)
  const p = paaskedag(aar)
  const flytt = (n) => { const x = new Date(p); x.setDate(x.getDate() + n); return x }
  const liste = [
    [new Date(aar, 0, 1),   'Fyrste nyttårsdag'],
    [flytt(-3),             'Skjærtorsdag'],
    [flytt(-2),             'Langfredag'],
    [flytt(0),              'Fyrste påskedag'],
    [flytt(1),              'Andre påskedag'],
    [new Date(aar, 4, 1),   'Arbeidarane sin dag'],
    [new Date(aar, 4, 17),  'Grunnlovsdagen'],
    [flytt(39),             'Kristi himmelfartsdag'],
    [flytt(49),             'Fyrste pinsedag'],
    [flytt(50),             'Andre pinsedag'],
    [new Date(aar, 11, 25), 'Fyrste juledag'],
    [new Date(aar, 11, 26), 'Andre juledag'],
  ]
  const map = new Map(liste.map(([dato, namn]) => [nokkel(dato), namn]))
  cache.set(aar, map)
  return map
}

// Namnet på heilagdagen på ein gjeven dato, eller null om det ikkje er ein.
export function helligdagNamn(dato) {
  return helligdagarForAr(dato.getFullYear()).get(nokkel(dato)) || null
}
