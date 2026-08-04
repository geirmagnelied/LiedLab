import { useState } from "react";

var BRAND = "#1B4332";
var BG = "#F4F5F0";
var BG2 = "#FFFFFF";
var BG3 = "#EEF0EB";
var BD = "#D6DAD0";
var TX = "#1A2E23";
var TX2 = "#3D5A47";
var TX3 = "#7A8F80";
var MO = "'IBM Plex Mono', monospace";

var PROJECT = { nr: "26001", name: "Einebustad Sjøgata 12", address: "Sjøgata 12", type: "Einebustad", bra: "186" };

var TEAM = [
  { id: "gm", name: "Geir Magne L.", ini: "GM", col: "#1B6B4A" },
  { id: "kl", name: "Kari Lien", ini: "KL", col: "#2563EB" },
  { id: "os", name: "Ola Sæther", ini: "OS", col: "#9333EA" },
];

var CTRL_TYPES = [
  { id: "skisse", label: "Skisseprosjekt", col: "#6B7280" },
  { id: "forprosjekt", label: "Forprosjekt", col: "#0891B2" },
  { id: "ramme", label: "Rammesøknad", col: "#2563EB" },
  { id: "detalj", label: "Detaljprosjekt", col: "#059669" },
  { id: "anna", label: "Anna", col: "#9333EA" },
];

var CPS = {
  Plan: [
    { id: "P01", txt: "Målestokk og nord-pil korrekt" },
    { id: "P02", txt: "Romnamn og areal vist (NS 3940)" },
    { id: "P03", txt: "Dører: retning, nr, fri opning" },
    { id: "P04", txt: "Vindaugssymbol konsistente" },
    { id: "P05", txt: "Rømningsvegar tydeleg vist" },
    { id: "P06", txt: "BRA/BYA stemmer med søknad" },
    { id: "P07", txt: "Snuareal Ø1500 dokumentert" },
    { id: "P08", txt: "Tekniske sjakter markerte" },
    { id: "P09", txt: "Veggtjukkelsar korrekte" },
    { id: "P10", txt: "Snitt-referansar korrekte" },
  ],
  Snitt: [
    { id: "S01", txt: "Etasjehøgder korrekte" },
    { id: "S02", txt: "Golv/tak-konstruksjon vist" },
    { id: "S03", txt: "Fundament og drenering korrekt" },
    { id: "S04", txt: "Isolasjon og U-verdiar angitt" },
    { id: "S05", txt: "Trapp: stigning/inntrinn OK" },
    { id: "S06", txt: "Referansekote stemmer" },
    { id: "S07", txt: "Takvinkel korrekt" },
  ],
  Fasade: [
    { id: "F01", txt: "Alle fasadar teikna" },
    { id: "F02", txt: "Material spesifisert" },
    { id: "F03", txt: "Opningar stemmer med plan" },
    { id: "F04", txt: "Terrenglinje korrekt" },
    { id: "F05", txt: "Kotehøgder angitt" },
    { id: "F06", txt: "NCS-fargekodar inkluderte" },
  ],
  Situasjonsplan: [
    { id: "SI01", txt: "Kartgrunnlag oppdatert" },
    { id: "SI02", txt: "Koordinatsystem korrekt" },
    { id: "SI03", txt: "Avstandar nabogrense målesett" },
    { id: "SI04", txt: "Byggjegrenser vist" },
    { id: "SI05", txt: "Tilkomst og parkering vist" },
    { id: "SI06", txt: "BYA dokumentert" },
  ],
  Detalj: [
    { id: "D01", txt: "Målestokk eigna" },
    { id: "D02", txt: "Materiale spesifiserte" },
    { id: "D03", txt: "Fuge/tetting angitt" },
    { id: "D04", txt: "Festemiddel vist" },
  ],
};

// Teikningar — med data som skriptet hentar frå tittelfelt i PDF
var DRAWINGS = [
  { id: "d1", nr: "A-10-01", title: "Situasjonsplan", dtype: "Situasjonsplan", rev: "C", scale: "1:500", drawnBy: "gm", ekPerson: "gm", fkPerson: "kl" },
  { id: "d2", nr: "A-20-01", title: "Plan 1. etasje", dtype: "Plan", rev: "B", scale: "1:100", drawnBy: "gm", ekPerson: "gm", fkPerson: "kl" },
  { id: "d3", nr: "A-20-02", title: "Plan 2. etasje", dtype: "Plan", rev: "A", scale: "1:100", drawnBy: "kl", ekPerson: "kl", fkPerson: "gm" },
  { id: "d4", nr: "A-30-01", title: "Snitt A-A", dtype: "Snitt", rev: "B", scale: "1:100", drawnBy: "kl", ekPerson: "kl", fkPerson: "gm" },
  { id: "d5", nr: "A-30-02", title: "Snitt B-B", dtype: "Snitt", rev: "A", scale: "1:100", drawnBy: "kl", ekPerson: "kl", fkPerson: "os" },
  { id: "d6", nr: "A-40-01", title: "Fasade nord", dtype: "Fasade", rev: "A", scale: "1:100", drawnBy: "kl", ekPerson: "kl", fkPerson: "gm" },
  { id: "d7", nr: "A-40-02", title: "Fasade sør", dtype: "Fasade", rev: "A", scale: "1:100", drawnBy: "os", ekPerson: "os", fkPerson: "kl" },
  { id: "d8", nr: "A-50-01", title: "Detalj vindaugssmyg", dtype: "Detalj", rev: "A", scale: "1:5", drawnBy: "gm", ekPerson: "gm", fkPerson: "kl" },
];

var INIT_CTRLS = [
  {
    id: "k01", seq: "01", ctype: "forprosjekt",
    name: "Forprosjekt — innlev. byggherre",
    date: "2026-06-01", phase: "ferdig",
    dids: ["d1", "d2", "d4", "d6"],
    revSnap: { d1: "B", d2: "A", d4: "A", d6: "A" },
  },
];

var INIT_CHK = {
  "k01_d1_ek": { SI01: "ok", SI02: "ok", SI03: "ok", SI04: "ok", SI05: "ok", SI06: "ok" },
  "k01_d1_fk": { SI01: "ok", SI02: "ok", SI03: "ok", SI04: "ok", SI05: "ok", SI06: "ok" },
  "k01_d2_ek": { P01: "ok", P02: "ok", P03: "ok", P04: "avvik", P04_k: "Dør D4 manglar mål", P05: "ok", P06: "ok", P07: "ok", P08: "ok", P09: "ok", P10: "ok" },
  "k01_d2_fk": { P01: "ok", P02: "ok", P03: "ok", P04: "avvik", P04_k: "Stadfest — må rettast", P05: "ok", P06: "ok", P07: "ok", P08: "ok", P09: "ok", P10: "ok" },
  "k01_d4_ek": { S01: "ok", S02: "ok", S03: "ok", S04: "ok", S05: "ok", S06: "ok", S07: "ok" },
  "k01_d4_fk": { S01: "ok", S02: "ok", S03: "ok", S04: "ok", S05: "ok", S06: "ok", S07: "ok" },
  "k01_d6_ek": { F01: "ok", F02: "ok", F03: "avvik", F03_k: "V3 avvik mot plan", F04: "ok", F05: "ok", F06: "ok" },
  "k01_d6_fk": { F01: "ok", F02: "ok", F03: "avvik", F03_k: "Stadfest avvik", F04: "ok", F05: "ok", F06: "ok" },
};

var PHASE = { ek: { l: "Egenkontroll", c: "#D97706" }, ek_ferdig: { l: "EK ferdig", c: "#2563EB" },
  fk: { l: "Fagkontroll", c: "#9333EA" }, ferdig: { l: "Ferdigstilt", c: "#059669" } };

function Av(props) {
  var p = TEAM.find(function(t) { return t.id === props.pid; });
  if (!p) { return <span style={{ fontSize: 18, color: TX3 }}>—</span>; }
  var s = props.size || 20;
  return (
    <div title={p.name} style={{ width: s, height: s, borderRadius: s, background: p.col,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: s * 0.4, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{p.ini}</div>
  );
}

function Ring(props) {
  var sz = props.size || 36; var sw = props.sw || 3; var pct = props.pct;
  var r = (sz - sw) / 2; var c = 2 * Math.PI * r;
  return (
    <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={BD} strokeWidth={sw} />
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={pct === 100 ? "#52B788" : BRAND}
        strokeWidth={sw} strokeDasharray={((pct/100)*c) + " " + c}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.4s" }} />
      <text x={sz/2} y={sz/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%",
          fontSize: sz * 0.26, fontWeight: 800, fill: TX, fontFamily: MO }}>{pct}</text>
    </svg>
  );
}

function Btn3(props) {
  var v = props.value;
  var items = [["ok", "✓", "#059669"], ["avvik", "!", "#DC2626"], ["na", "—", "#6B7280"]];
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {items.map(function(b) {
        var a = v === b[0];
        return (
          <button key={b[0]} onClick={function() { props.onSet(v === b[0] ? "" : b[0]); }}
            style={{ width: 24, height: 20, borderRadius: 3,
              border: a ? "2px solid " + b[2] : "1px solid " + BD,
              background: a ? b[2] : BG2, color: a ? "#fff" : b[2],
              fontSize: 18, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.1s", padding: 0 }}>{b[1]}</button>
        );
      })}
    </div>
  );
}

function CRow(props) {
  var cp = props.cp;
  var ek = props.ekV || ""; var fk = props.fkV || "";
  var ekK = props.ekK || ""; var fkK = props.fkK || "";
  var canFK = props.canFK;
  var _s = useState(Boolean(ekK) || Boolean(fkK) || ek === "avvik" || fk === "avvik");
  var open = _s[0]; var setOpen = _s[1];
  var bc = (fk === "avvik" || ek === "avvik") ? "#FEE2E2" : (ek === "ok" && (fk === "ok" || !canFK)) ? "#F0FDF4" : "transparent";

  return (
    <div style={{ background: bc, borderBottom: "1px solid " + BD, transition: "background 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "5px 8px", gap: 4 }}>
        <span style={{ width: 28, fontSize: 17, fontWeight: 700, color: TX3, fontFamily: MO, flexShrink: 0 }}>{cp.id}</span>
        <span style={{ flex: 1, fontSize: 17, color: TX,
          opacity: (ek === "na" && (!canFK || fk === "na")) ? 0.25 : 1,
          textDecoration: (ek === "ok" && (fk === "ok" || !canFK)) ? "line-through" : "none" }}>{cp.txt}</span>
        <Btn3 value={ek} onSet={function(v) { props.onEk(v); if (v === "avvik") { setOpen(true); } }} />
        {canFK ? (
          <Btn3 value={fk} onSet={function(v) { props.onFk(v); if (v === "avvik") { setOpen(true); } }} />
        ) : (
          <div style={{ width: 74, height: 20, borderRadius: 3, background: BG3,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: TX3 }}>—</div>
        )}
        <button onClick={function() { setOpen(!open); }}
          style={{ background: "none", border: "none", cursor: "pointer",
            fontSize: 18, color: (ekK || fkK) ? "#D97706" : BD, padding: "0 2px", flexShrink: 0 }}>💬</button>
      </div>
      {open && (
        <div style={{ display: "flex", gap: 6, padding: "0 8px 6px 36px" }}>
          <div style={{ flex: 1 }}>
            <textarea value={ekK} onChange={function(e) { props.onEkK(e.target.value); }}
              rows={1} placeholder="EK-kommentar…"
              style={{ width: "100%", padding: "4px 6px", borderRadius: 3,
                border: "1px solid " + (ek === "avvik" ? "#FECACA" : BD),
                background: ek === "avvik" ? "#FEF2F2" : BG3,
                fontSize: 18, color: TX, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>
          {canFK && (
            <div style={{ flex: 1 }}>
              <textarea value={fkK} onChange={function(e) { props.onFkK(e.target.value); }}
                rows={1} placeholder="FK-kommentar…"
                style={{ width: "100%", padding: "4px 6px", borderRadius: 3,
                  border: "1px solid " + (fk === "avvik" ? "#FECACA" : BD),
                  background: fk === "avvik" ? "#F5F3FF" : BG3,
                  fontSize: 18, color: TX, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KvalitetModule({ userId, projects, activeOfficeId }) {
  var _v = useState("oversikt"); var view = _v[0]; var setView = _v[1];
  var _c = useState(INIT_CTRLS); var ctrls = _c[0]; var setCtrls = _c[1];
  var _ch = useState(INIT_CHK); var chk = _ch[0]; var setChk = _ch[1];
  var _aid = useState(null); var aId = _aid[0]; var setAId = _aid[1];
  var _adid = useState(null); var aDid = _adid[0]; var setADid = _adid[1];
  var _nt = useState(""); var nType = _nt[0]; var setNT = _nt[1];
  var _nn = useState(""); var nName = _nn[0]; var setNN = _nn[1];
  var _nd = useState([]); var nDrw = _nd[0]; var setND = _nd[1];

  var nextSeq = String(ctrls.length + 1).padStart(2, "0");
  var aC = ctrls.find(function(c) { return c.id === aId; });
  var aD = DRAWINGS.find(function(d) { return d.id === aDid; });
  var aPts = aD ? (CPS[aD.dtype] || []) : [];
  var aEk = (aC && aDid) ? (chk[aC.id + "_" + aDid + "_ek"] || {}) : {};
  var aFk = (aC && aDid) ? (chk[aC.id + "_" + aDid + "_fk"] || {}) : {};
  var canFK = aC ? (aC.phase === "fk" || aC.phase === "ferdig") : false;

  function sv(cid, did, step, pid, val) {
    var key = cid + "_" + did + "_" + step;
    setChk(function(p) { var e = p[key] || {}; var u = Object.assign({}, e); u[pid] = e[pid] === val ? "" : val; var r = Object.assign({}, p); r[key] = u; return r; });
  }
  function sk(cid, did, step, pid, txt) {
    var key = cid + "_" + did + "_" + step;
    setChk(function(p) { var e = p[key] || {}; var u = Object.assign({}, e); u[pid + "_k"] = txt; var r = Object.assign({}, p); r[key] = u; return r; });
  }

  function gPr(cid, did, step) {
    var d = DRAWINGS.find(function(x) { return x.id === did; }); if (!d) { return { pct: 0 }; }
    var pts = CPS[d.dtype] || []; var cd = chk[cid + "_" + did + "_" + step] || {};
    var dn = pts.filter(function(p) { return cd[p.id] && cd[p.id] !== ""; }).length;
    return { pct: pts.length > 0 ? Math.round(dn / pts.length * 100) : 0 };
  }
  function gCPr(cid, step) {
    var ct = ctrls.find(function(c) { return c.id === cid; }); if (!ct) { return 0; }
    var ps = ct.dids.map(function(did) { return gPr(cid, did, step).pct; });
    return ps.length ? Math.round(ps.reduce(function(a, b) { return a + b; }, 0) / ps.length) : 0;
  }

  function create() {
    if (!nType || !nName.trim() || nDrw.length === 0) { return; }
    var id = "k" + nextSeq;
    var rs = {}; nDrw.forEach(function(did) { var d = DRAWINGS.find(function(x) { return x.id === did; }); if (d) { rs[did] = d.rev; } });
    setCtrls(function(p) { return p.concat([{ id: id, seq: nextSeq, ctype: nType, name: nName.trim(), date: new Date().toISOString().slice(0, 10), phase: "ek", dids: nDrw, revSnap: rs }]); });
    setAId(id); setADid(nDrw[0]); setView("kontroll"); setNT(""); setNN(""); setND([]);
  }

  function toFK(cid) { setCtrls(function(p) { return p.map(function(c) { return c.id === cid ? Object.assign({}, c, { phase: "fk" }) : c; }); }); }
  function finish(cid) { setCtrls(function(p) { return p.map(function(c) { return c.id === cid ? Object.assign({}, c, { phase: "ferdig" }) : c; }); }); }
  function togD(did) { setND(function(p) { return p.indexOf(did) >= 0 ? p.filter(function(x) { return x !== did; }) : p.concat([did]); }); }

  var ekPr = aC ? gCPr(aC.id, "ek") : 0;
  var fkPr = aC ? gCPr(aC.id, "fk") : 0;

  function Tab(vk, lb) {
    var a = view === vk;
    return <button key={vk} onClick={function() { setView(vk); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid " + (a ? "rgba(255,255,255,0.55)" : "transparent"), background: a ? "rgba(255,255,255,0.18)" : "transparent", color: a ? "#fff" : "rgba(255,255,255,0.65)", fontSize: 17, cursor: "pointer", fontWeight: a ? 700 : 500 }}>{lb}</button>;
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TX, display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 50, flexShrink: 0, background: BRAND, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginRight: 8 }}>Kvalitetssystem</span>
        {Tab("oversikt", "Oversikt")}{Tab("ny", "＋ Ny")}{Tab("kontroll", "Leveransekontroll")}{Tab("arkiv", "Arkiv")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: BG2, borderBottom: "1px solid " + BD, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MO, fontWeight: 700, fontSize: 13 }}>{PROJECT.nr}</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: TX2 }}>{PROJECT.name}</span>
        <span style={{ fontSize: 17, color: TX3 }}>{PROJECT.address} · {PROJECT.bra} m²</span>
      </div>

      {/* OVERSIKT */}
      {view === "oversikt" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}><div style={{ maxWidth: 700 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[["Kontrollar", ctrls.length, BRAND], ["Pågåande", ctrls.filter(function(c) { return c.phase !== "ferdig"; }).length, "#D97706"], ["Ferdigstilte", ctrls.filter(function(c) { return c.phase === "ferdig"; }).length, "#059669"]].map(function(i) {
              return <div key={i[0]} style={{ flex: 1, minWidth: 110, padding: 14, borderRadius: 10, background: BG2, border: "1px solid " + BD }}><div style={{ fontSize: 26, fontWeight: 800, color: i[2], fontFamily: MO }}>{i[1]}</div><div style={{ fontSize: 17, fontWeight: 600, color: TX3 }}>{i[0]}</div></div>;
            })}
          </div>
          {ctrls.filter(function(c) { return c.phase !== "ferdig"; }).map(function(ct) {
            var p = gCPr(ct.id, ct.phase === "ek" ? "ek" : "fk");
            return <div key={ct.id} onClick={function() { setAId(ct.id); setADid(ct.dids[0]); setView("kontroll"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: BG2, borderRadius: 8, border: "1px solid " + BD, marginBottom: 8, cursor: "pointer", borderLeft: "4px solid " + (PHASE[ct.phase] || PHASE.ek).c }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MO, color: BRAND }}>{ct.seq}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700 }}>{ct.name}</div><div style={{ fontSize: 17, color: TX3 }}>{ct.dids.length} tegn.</div></div>
              <Ring pct={p} size={40} sw={3.5} />
              <span style={{ fontSize: 17, fontWeight: 700, color: (PHASE[ct.phase] || PHASE.ek).c }}>{(PHASE[ct.phase] || PHASE.ek).l} →</span>
            </div>;
          })}
          <button onClick={function() { setView("ny"); }} style={{ padding: "12px 20px", borderRadius: 8, border: "2px dashed " + BD, background: "transparent", fontSize: 18, fontWeight: 700, color: TX2, cursor: "pointer", width: "100%", marginTop: 12 }}>＋ Opprett ny leveransekontroll</button>
        </div></div>
      )}

      {/* NY KONTROLL */}
      {view === "ny" && (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}><div style={{ maxWidth: 600 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>Ny leveransekontroll</div>
          <div style={{ fontSize: 18, color: TX3, marginBottom: 14 }}>Løpenr: <strong style={{ fontFamily: MO }}>{nextSeq}</strong></div>

          <div style={{ fontSize: 17, fontWeight: 600, color: TX3, marginBottom: 4 }}>NAMN</div>
          <input value={nName} onChange={function(e) { setNN(e.target.value); }} placeholder="T.d. «Rammesøknad — innsending kommune»" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid " + BD, fontSize: 18, color: TX, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />

          <div style={{ fontSize: 17, fontWeight: 600, color: TX3, marginBottom: 4 }}>TYPE</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {CTRL_TYPES.map(function(ct) { var s = nType === ct.id; return <button key={ct.id} onClick={function() { setNT(ct.id); }} style={{ padding: "7px 12px", borderRadius: 6, border: s ? "2px solid " + ct.col : "1.5px solid " + BD, background: s ? ct.col + "12" : BG2, color: s ? ct.col : TX2, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>{ct.label}</button>; })}
          </div>

          <div style={{ fontSize: 17, fontWeight: 600, color: TX3, marginBottom: 4 }}>TEIKNINGAR ({nDrw.length}) — EK/FK-person vert henta frå tittelfelt</div>
          {/* Tegningstabell med kolonne-headerar */}
          <div style={{ border: "1px solid " + BD, borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", background: BG3, borderBottom: "1px solid " + BD, gap: 6 }}>
              <span style={{ width: 20 }}></span>
              <span style={{ width: 60, fontSize: 17, fontWeight: 700, color: TX3 }}>NR.</span>
              <span style={{ width: 22, fontSize: 17, fontWeight: 700, color: TX3 }}>REV</span>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: TX3 }}>TITTEL</span>
              <span style={{ width: 50, fontSize: 17, fontWeight: 700, color: TX3 }}>SKALA</span>
              <span style={{ width: 70, fontSize: 17, fontWeight: 700, color: TX3 }}>TYPE</span>
              <span style={{ width: 24, fontSize: 17, fontWeight: 700, color: TX3, textAlign: "center" }}>EK</span>
              <span style={{ width: 24, fontSize: 17, fontWeight: 700, color: "#9333EA", textAlign: "center" }}>FK</span>
            </div>
            {DRAWINGS.map(function(d) {
              var s = nDrw.indexOf(d.id) >= 0;
              return (
                <div key={d.id} onClick={function() { togD(d.id); }} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid " + BG3, cursor: "pointer", background: s ? BRAND + "06" : "transparent", gap: 6 }}>
                  <input type="checkbox" checked={s} readOnly style={{ width: 16, height: 16, accentColor: BRAND }} />
                  <span style={{ width: 60, fontSize: 17, fontWeight: 700, fontFamily: MO }}>{d.nr}</span>
                  <span style={{ width: 22, fontSize: 17, fontWeight: 700, fontFamily: MO, color: TX2 }}>{d.rev}</span>
                  <span style={{ flex: 1, fontSize: 17, color: TX2 }}>{d.title}</span>
                  <span style={{ width: 50, fontSize: 18, color: TX3, fontFamily: MO }}>{d.scale}</span>
                  <span style={{ width: 70, fontSize: 18, color: TX3 }}>{d.dtype}</span>
                  <span style={{ width: 24, display: "flex", justifyContent: "center" }}><Av pid={d.ekPerson} size={18} /></span>
                  <span style={{ width: 24, display: "flex", justifyContent: "center" }}><Av pid={d.fkPerson} size={18} /></span>
                </div>
              );
            })}
          </div>

          <button onClick={create} disabled={!nType || !nName.trim() || nDrw.length === 0}
            style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: (nType && nName.trim() && nDrw.length) ? BRAND : "#E5E7EB", color: (nType && nName.trim() && nDrw.length) ? "#fff" : TX3, fontSize: 18, fontWeight: 700, cursor: (nType && nName.trim() && nDrw.length) ? "pointer" : "default" }}>Opprett kontroll {nextSeq}</button>
        </div></div>
      )}

      {/* LEVERANSEKONTROLL */}
      {view === "kontroll" && aC && (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* Kontroll-header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: BG3, borderBottom: "1px solid " + BD, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MO, color: BRAND }}>{aC.seq}</div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{aC.name}</div>
              <div style={{ fontSize: 17, color: TX3 }}>{aC.dids.length} teikningar</div>
            </div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: TX3 }}>EK</div><Ring pct={ekPr} size={34} sw={3} /></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#9333EA" }}>FK</div><Ring pct={fkPr} size={34} sw={3} /></div>
            {aC.phase === "ek" && ekPr === 100 && <button onClick={function() { toFK(aC.id); }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Send til FK →</button>}
            {aC.phase === "fk" && fkPr === 100 && <button onClick={function() { finish(aC.id); }} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Ferdigstill ✓</button>}
            {aC.phase === "ferdig" && <span style={{ padding: "5px 12px", background: "#D1FAE5", borderRadius: 8, fontSize: 18, fontWeight: 700, color: "#059669" }}>✓ Ferdigstilt</span>}
            {aC.phase === "ek" && ekPr < 100 && <span style={{ fontSize: 17, color: "#D97706" }}>EK pågår</span>}
            {aC.phase === "fk" && fkPr < 100 && <span style={{ fontSize: 17, color: "#9333EA" }}>FK pågår</span>}
          </div>

          {/* Teikning-faner med metadata */}
          <div style={{ display: "flex", gap: 3, padding: "6px 16px", background: BG2, borderBottom: "1px solid " + BD, flexShrink: 0, overflowX: "auto" }}>
            {aC.dids.map(function(did) {
              var d = DRAWINGS.find(function(x) { return x.id === did; }); if (!d) { return null; }
              var isA = aDid === did; var ep = gPr(aC.id, did, "ek").pct; var fp = gPr(aC.id, did, "fk").pct;
              return <button key={did} onClick={function() { setADid(did); }} style={{ padding: "5px 10px", borderRadius: 6, border: isA ? "2px solid " + BRAND : "1px solid " + BD, background: isA ? BRAND + "10" : BG2, fontSize: 17, fontWeight: isA ? 700 : 500, color: isA ? BRAND : TX2, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: MO, fontWeight: 700 }}>{d.nr}</span>
                <span style={{ fontSize: 17, color: ep === 100 ? "#059669" : "#D97706" }}>{ep}</span>
                {canFK && <span style={{ fontSize: 17, color: fp === 100 ? "#059669" : "#9333EA" }}>{fp}</span>}
              </button>;
            })}
          </div>

          {/* Sjekkpunkt-tabell med kolonneheadar */}
          {aD && (
            <div style={{ flex: 1, overflow: "auto" }}>
              {/* Teikning-info */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid " + BD, background: BG2 }}>
                <span style={{ fontFamily: MO, fontWeight: 700, fontSize: 13 }}>{aD.nr}</span>
                <span style={{ fontSize: 17, fontWeight: 600, color: TX2 }}>{aD.title}</span>
                <span style={{ fontSize: 17, color: TX3 }}>rev. {aD.rev}</span>
                <span style={{ fontSize: 17, color: TX3, fontFamily: MO }}>{aD.scale}</span>
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: 18, color: TX3 }}>EK:</span><Av pid={aD.ekPerson} size={18} />
                <span style={{ fontSize: 18, color: "#9333EA" }}>FK:</span><Av pid={aD.fkPerson} size={18} />
              </div>
              {/* Kolonne-header for sjekkpunkt */}
              <div style={{ display: "flex", alignItems: "center", padding: "4px 8px", background: BG3, borderBottom: "1.5px solid " + BD, gap: 4, position: "sticky", top: 0, zIndex: 2 }}>
                <span style={{ width: 28, fontSize: 18, fontWeight: 700, color: TX3 }}>NR</span>
                <span style={{ flex: 1, fontSize: 18, fontWeight: 700, color: TX3 }}>SJEKKPUNKT</span>
                <span style={{ width: 74, fontSize: 18, fontWeight: 700, color: TX3, textAlign: "center" }}>EGENKONTROLL</span>
                <span style={{ width: 74, fontSize: 18, fontWeight: 700, color: canFK ? "#9333EA" : BD, textAlign: "center" }}>FAGKONTROLL</span>
                <span style={{ width: 18 }}></span>
              </div>
              {/* Rader */}
              <div style={{ padding: "0" }}>
                {aPts.map(function(cp) {
                  return <CRow key={aC.id + "_" + aDid + "_" + cp.id} cp={cp}
                    ekV={aEk[cp.id] || ""} fkV={aFk[cp.id] || ""}
                    ekK={aEk[cp.id + "_k"] || ""} fkK={aFk[cp.id + "_k"] || ""}
                    canFK={canFK}
                    onEk={function(v) { sv(aC.id, aDid, "ek", cp.id, v); }}
                    onFk={function(v) { sv(aC.id, aDid, "fk", cp.id, v); }}
                    onEkK={function(t) { sk(aC.id, aDid, "ek", cp.id, t); }}
                    onFkK={function(t) { sk(aC.id, aDid, "fk", cp.id, t); }} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "kontroll" && !aC && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: BRAND }}>KS</div>
          <p style={{ fontSize: 17, color: TX3, textAlign: "center", maxWidth: 340 }}>Opprett ein kontroll frå «＋ Ny»-fana.</p>
        </div>
      )}

      {/* ARKIV */}
      {view === "arkiv" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}><div style={{ maxWidth: 700 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Kontrollarkiv</div>
          {ctrls.map(function(ct) {
            var isF = ct.phase === "ferdig"; var folder = ct.seq + "_" + ct.name.replace(/\s/g, "_");
            return (
              <div key={ct.id} style={{ marginBottom: 16, background: BG2, borderRadius: 10, border: "1px solid " + BD, overflow: "hidden", borderLeft: "4px solid " + (PHASE[ct.phase] || PHASE.ek).c }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: isF ? "#F0FDF4" : "transparent", cursor: !isF ? "pointer" : "default" }} onClick={function() { if (!isF) { setAId(ct.id); setADid(ct.dids[0]); setView("kontroll"); } }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MO, color: BRAND }}>{ct.seq}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700 }}>{ct.name}</div><div style={{ fontSize: 17, color: TX3 }}>{ct.date} · {ct.dids.length} tegn.</div></div>
                  <span style={{ fontSize: 17, fontWeight: 700, color: (PHASE[ct.phase] || PHASE.ek).c, padding: "3px 8px", background: (PHASE[ct.phase] || PHASE.ek).c + "18", borderRadius: 4 }}>{(PHASE[ct.phase] || PHASE.ek).l}</span>
                </div>
                {/* Tegningstabell med header */}
                <div style={{ borderTop: "1px solid " + BD }}>
                  <div style={{ display: "flex", padding: "4px 16px 4px 52px", background: BG3, borderBottom: "1px solid " + BD, gap: 6 }}>
                    <span style={{ width: 55, fontSize: 18, fontWeight: 700, color: TX3 }}>NR.</span>
                    <span style={{ flex: 1, fontSize: 18, fontWeight: 700, color: TX3 }}>TITTEL</span>
                    <span style={{ width: 40, fontSize: 18, fontWeight: 700, color: TX3 }}>SKALA</span>
                    <span style={{ width: 24, fontSize: 18, fontWeight: 700, color: TX3 }}>REV</span>
                    <span style={{ width: 20, fontSize: 18, fontWeight: 700, color: TX3 }}>EK</span>
                    <span style={{ width: 20, fontSize: 18, fontWeight: 700, color: "#9333EA" }}>FK</span>
                    <span style={{ width: 80, fontSize: 18, fontWeight: 700, color: TX3 }}>FIL</span>
                  </div>
                  {ct.dids.map(function(did) {
                    var d = DRAWINGS.find(function(x) { return x.id === did; }); if (!d) { return null; }
                    var rev = (ct.revSnap || {})[did] || d.rev;
                    return (
                      <div key={did} style={{ display: "flex", alignItems: "center", padding: "5px 16px 5px 52px", borderBottom: "1px solid " + BG3, gap: 6, fontSize: 11 }}>
                        <span style={{ width: 55, fontFamily: MO, fontWeight: 700 }}>{d.nr}</span>
                        <span style={{ flex: 1, color: TX2 }}>{d.title}</span>
                        <span style={{ width: 40, fontFamily: MO, fontSize: 18, color: TX3 }}>{d.scale}</span>
                        <span style={{ width: 24, fontFamily: MO, fontWeight: 700, color: BRAND }}>{rev}</span>
                        <span style={{ width: 20, display: "flex", justifyContent: "center" }}><Av pid={d.ekPerson} size={16} /></span>
                        <span style={{ width: 20, display: "flex", justifyContent: "center" }}><Av pid={d.fkPerson} size={16} /></span>
                        <span style={{ width: 80, fontFamily: MO, fontSize: 17, color: TX3 }}>{d.nr}_{rev}.pdf</span>
                      </div>
                    );
                  })}
                </div>
                {isF && (
                  <div style={{ borderTop: "1px solid " + BD, padding: "8px 16px", background: "#F0FDF4" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#059669", marginBottom: 3 }}>KOPIERT → Kontrollkopiar/{folder}/</div>
                    {ct.dids.map(function(did) { var d = DRAWINGS.find(function(x) { return x.id === did; }); if (!d) { return null; } var rev = (ct.revSnap || {})[did] || d.rev; return <div key={did} style={{ fontSize: 17, fontFamily: MO, color: TX2, padding: "1px 0" }}>✓ {d.nr}_{rev}.pdf</div>; })}
                  </div>
                )}
              </div>
            );
          })}
        </div></div>
      )}

      <div style={{ padding: "8px 16px", fontSize: 18, color: TX3, borderTop: "1px solid " + BD, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span>KS-modul · Kontor</span>
        <span style={{ fontFamily: MO }}>{ctrls.length} kontrollar · {PROJECT.nr}</span>
      </div>
    </div>
  );
}
