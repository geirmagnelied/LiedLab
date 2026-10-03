import { addDays, format, parseISO } from 'date-fns'
import { helligdagNamn } from './helligdagar'

// ═══════════════════════════════════════════════════════════════════
//  Dato-hjelparar for Framdrift-modulen (sjå claude/framdrift-modul.md).
//  Alle datoar i planen vert lagra som ISO-tekst «yyyy-MM-dd» (lokal dato,
//  ingen klokkeslett/tidssone) og samanlikna som tekst, som held same
//  rekkjefølgje som kalenderdatoen. Arbeidsdag = måndag–fredag som ikkje
//  er norsk heilagdag (helligdagar.js).
// ═══════════════════════════════════════════════════════════════════

export const iso = (d) => format(d, 'yyyy-MM-dd')
export const tilDato = (s) => parseISO(s)

export function erArbeidsdag(d) {
  const w = d.getDay()
  return w !== 0 && w !== 6 && !helligdagNamn(d)
}

// Fyrste arbeidsdag på eller etter `d`.
export function nesteArbeidsdag(d) {
  let x = d
  for (let i = 0; i < 30 && !erArbeidsdag(x); i++) x = addDays(x, 1)
  return x
}

// Siste arbeidsdag på eller før `d`.
export function forrigeArbeidsdag(d) {
  let x = d
  for (let i = 0; i < 30 && !erArbeidsdag(x); i++) x = addDays(x, -1)
  return x
}

// `n` arbeidsdagar etter `d` (n ≥ 0; n = 0 gjev `d` sjølv).
export function leggTilArbeidsdagar(d, n) {
  let x = d
  let att = n
  while (att > 0) {
    x = addDays(x, 1)
    if (erArbeidsdag(x)) att--
  }
  return x
}

// Tal arbeidsdagar frå `a` til og med `b` (minst 1).
export function arbeidsdagarMellom(a, b) {
  let n = 0
  for (let x = a; x <= b; x = addDays(x, 1)) if (erArbeidsdag(x)) n++
  return Math.max(1, n)
}

export function formaterDato(s) {
  return s ? format(parseISO(s), 'dd.MM.yyyy') : ''
}

// Les ein dato frå brukarskriven tekst: «5.10.2026», «05.10.26», «2026-10-05»,
// «5/10/2026». Gjev Date eller null.
export function parseDato(tekst) {
  const t = String(tekst ?? '').trim()
  let y, m, d
  let tr = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (tr) { y = +tr[1]; m = +tr[2]; d = +tr[3] }
  else {
    tr = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/.exec(t)
    if (!tr) return null
    d = +tr[1]; m = +tr[2]; y = +tr[3]
    if (tr[3].length === 2) y += y > 50 ? 1900 : 2000
  }
  const dato = new Date(y, m - 1, d)
  return dato.getFullYear() === y && dato.getMonth() === m - 1 && dato.getDate() === d ? dato : null
}
