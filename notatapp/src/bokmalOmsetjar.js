// ═══════════════════════════════════════════════════════════════════
//  Bokmål-omsetjar: kjeldespråket i appen er nynorsk. Når brukaren har valt bokmål (Brukar → Brukarinfo) vert synleg
//  tekst (tekstnodar, placeholder, title) omsett ord for ord med ordlista under, rett i DOM-en — så heile appen følgjer
//  språkvalet utan å skrive om kvar komponent. Eigne, nøyaktige formuleringar ligg i sprak.js (`t('nøkkel')`) og går føre.
//  Rører ALDRI redigerbart innhald (contenteditable, input, textarea) eller kode (pre/code/script/style), og originaltekst
//  vert hugsa så ein kan bytte attende til nynorsk utan omlasting. Legg nye ord i ORD under (nynorsk → bokmål, små bokstavar).
//  Merk: dette er ei ordbasert omsetjing; ordet «vel» (verb) vert t.d. «velg». Brukarskrive tekst i prosjektnamn o.l. som
//  tilfeldigvis inneheld nynorske ord vert òg vist på bokmål (berre visinga, aldri lagra data).
// ═══════════════════════════════════════════════════════════════════

const ORD = Object.fromEntries(`
ikkje=ikke eit=et ei=en ein=en eigen=egen eigne=egne eige=eget kva=hva kven=hvem kvar=hver kor=hvor korleis=hvordan dei=de
berre=bare enno=ennå allereie=allerede nokon=noen noko=noe nokre=noen mykje=mye fleire=flere heile=hele heilt=helt
frå=fra utan=uten saman=sammen attende=tilbake vidare=videre no=nå då=da viss=hvis sidan=siden medan=mens
vert=blir vart=ble verte=bli vere=være fekk=fikk gjer=gjør gjere=gjøre sjå=se vel=velg opne=åpne opnar=åpner opna=åpnet
lagrar=lagrer lagra=lagret leggje=legge slette=slette sletta=slettet endra=endret endrar=endrer fjerna=fjernet fjernar=fjerner
flytta=flyttet flyttar=flytter kople=koble kopla=koblet koplar=kobler kopling=kobling koplingar=koblinger hentar=henter henta=hentet
finst=finnes fann=fant kjem=kommer reknast=regnes rekna=regnet reknar=regner rekne=regne brukar=bruker brukarar=brukere brukast=brukes
namn=navn namnet=navnet månaden=måneden veka=uka oppgåva=oppgaven teikninga=tegningen tal=tall talet=tallet veke=uke veker=uker vekene=ukene vekenummer=ukenummer månad=måned månader=måneder
timar=timer timane=timene dagar=dager dagane=dagene skildring=beskrivelse skildringa=beskrivelsen bilete=bilde bileta=bildene biletet=bildet
teikning=tegning teikningar=tegninger teikningsnummer=tegningsnummer teikningsliste=tegningsliste modellar=modeller
leveransar=leveranser leveransane=leveransene oppgåve=oppgave oppgåver=oppgaver oppgåvene=oppgavene fristar=frister
kundar=kunder fasar=faser aktivitetar=aktiviteter aktivitetane=aktivitetene ressursar=ressurser ressursane=ressursene personar=personer
innstillingar=innstillinger val=valg vala=valgene kolonnar=kolonner rader=rader
gamal=gammel høg=høy høgre=høyre høgast=høyest fyrste=første førre=forrige føregåande=foregående
meir=mer samanlikn=sammenlign samanlikna=sammenlignet samla=samlet samanlagd=sammenlagt
førehandsvising=forhåndsvisning førehandsvis=forhåndsvis førehandsdefinerte=forhåndsdefinerte hugsa=husket hugs=husk
stadfeste=bekrefte stadfestar=bekrefter stadfesting=bekreftelse søkje=søke innhald=innhold innhaldet=innholdet
tilgjengeleg=tilgjengelig synleg=synlig mogleg=mulig moglegheit=mulighet moglege=mulige naudsynt=nødvendig
eigenskapar=egenskaper eigenskap=egenskap løysing=løsning løysingar=løsninger laga=laget lagar=lager
breidde=bredde breidd=bredde høgde=høyde storleik=størrelse storleiken=størrelsen fargar=farger utval=utvalg utvalet=utvalget
rekkjefølgje=rekkefølge rekkjefølgja=rekkefølgen tilbod=tilbud tilbodsteikning=tilbudstegning søknadsteikning=søknadstegning
oppdragsgjevar=oppdragsgiver oppdragsgivar=oppdragsgiver gjeremål=gjøremål innlogga=innlogget heim=hjem ansvarleg=ansvarlig
utarbeidd=utarbeidet utarbeida=utarbeidet meldingar=meldinger mottakar=mottaker mottakarar=mottakere kvalitetssystem=kvalitetssystem
gjenståande=gjenstående gjenstår=gjenstår påløpt=påløpt påløpte=påløpte lukka=lukket opna=åpnet
tidlegare=tidligere seinare=senere tidlegast=tidligst seinast=senest oppsummering=oppsummering føreslå=foreslå forslag=forslag
nynorsk=bokmål lastar=laster last=last henting=henting klarte=klarte laga=laget lagt=lagt
skrivast=skrives skriv=skriv skrive=skrive vise=vise viser=viser vist=vist visast=vises vising=visning visingar=visninger
kjende=kjente kjend=kjent attkjent=gjenkjent knytt=knyttet knytte=knytte tilknytt=tilknyttet tilhøyrer=tilhører
kvifor=hvorfor kvarandre=hverandre desse=disse slike=slike nokolunde=noenlunde omtrent=omtrent
sleppe=slippe slepp=slipp dra=dra drar=drar dregen=dratt
etterkvart=etter hvert ellers=ellers likevel=likevel framleis=fremdeles fremdeles=fremdeles
prosjekterfaring=prosjekterfaring kompetanse=kompetanse utdanning=utdanning vidareutdanning=videreutdanning
fødselsår=fødselsår kontaktperson=kontaktperson mappa=mappen mappe=mappe filene=filene fila=filen
seksjon=seksjon kategoriar=kategorier kategori=kategori kategorien=kategorien
eksempel=eksempel døme=eksempel t.d.=f.eks. td=f.eks.
`.trim().split(/\s+/).filter(x => x.includes('=') && !x.startsWith('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).replace(/_/g, ' ')] }))

const SKIP = 'SCRIPT,STYLE,TEXTAREA,INPUT,SELECT,OPTION,PRE,CODE,NOSCRIPT'
const ORD_RE = /[A-Za-zÆØÅæøå]+/g
const original = new WeakMap()       // tekstnode → original tekst
const originalAttr = new WeakMap()   // element → { attr: originaltekst }

export function tilBokmal(tekst) {
  if (!tekst || !/[A-Za-zÆØÅæøå]/.test(tekst)) return tekst
  return tekst.replace(ORD_RE, (ord) => {
    const bm = ORD[ord.toLowerCase()]
    if (bm === undefined) return ord
    if (ord === ord.toUpperCase() && ord.length > 1) return bm.toUpperCase()
    if (ord[0] === ord[0].toUpperCase()) return bm[0].toUpperCase() + bm.slice(1)
    return bm
  })
}

const SKIP_LISTE = SKIP.split(',')
const hoppOver = (el, utanSkjema = false) => {
  for (let e = el; e; e = e.parentElement) {
    if (e.isContentEditable || e.contentEditable === 'true') return true
    if (SKIP_LISTE.includes(e.tagName) && !(utanSkjema && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName) && e === el)) return true
    if (e.hasAttribute && e.hasAttribute('data-notranslate')) return true
  }
  return false
}

function omsettNode(n) {
  if (n.nodeType === 3) {
    if (!n.parentElement || hoppOver(n.parentElement)) return
    const noko = n.nodeValue
    const kjelde = original.has(n) ? original.get(n) : noko
    const ny = tilBokmal(kjelde)
    // viss React har sett ny nynorsk tekst (nodeValue ≠ det me sist skreiv), tel den nye teksten som kjelde
    if (original.has(n) && noko !== n.__bm && noko !== kjelde) { original.set(n, noko); const r = tilBokmal(noko); n.__bm = r; if (r !== noko) n.nodeValue = r; return }
    if (ny !== noko) { original.set(n, kjelde); n.__bm = ny; n.nodeValue = ny }
    return
  }
  if (n.nodeType !== 1) return
  if (!hoppOver(n, true)) {
  for (const a of ['placeholder', 'title', 'aria-label']) {
    const v = n.getAttribute?.(a)
    if (!v) continue
    const sporing = originalAttr.get(n) || {}
    const kjelde = sporing[a] !== undefined && v === sporing[a + '_bm'] ? sporing[a] : v
    const ny = tilBokmal(kjelde)
    if (ny !== v) { sporing[a] = kjelde; sporing[a + '_bm'] = ny; originalAttr.set(n, sporing); n.setAttribute(a, ny) }
  }
  }
  if (hoppOver(n)) return
  for (const c of n.childNodes) omsettNode(c)
}

// Startar omsetjinga for heile dokumentet; gjev ein stopp-funksjon som set attende nynorsk tekst.
export function startBokmalOmsetjar() {
  let ventar = new Set()
  let planlagt = false
  const kjør = () => { planlagt = false; const liste = [...ventar]; ventar = new Set(); for (const n of liste) { if (document.contains(n)) omsettNode(n) } }
  const planlegg = (n) => { ventar.add(n); if (!planlagt) { planlagt = true; setTimeout(kjør, 0) } }
  omsettNode(document.body)
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') planlegg(m.target)
      else if (m.type === 'attributes') planlegg(m.target)
      else for (const n of m.addedNodes) planlegg(n)
    }
  })
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] })
  return () => {
    obs.disconnect()
    const gaa = (n) => {
      if (n.nodeType === 3) { if (original.has(n)) { n.nodeValue = original.get(n); original.delete(n) } return }
      if (n.nodeType !== 1) return
      const sp = originalAttr.get(n)
      if (sp) { for (const a of ['placeholder', 'title', 'aria-label']) if (sp[a] !== undefined) n.setAttribute(a, sp[a]); originalAttr.delete(n) }
      for (const c of n.childNodes) gaa(c)
    }
    gaa(document.body)
  }
}
