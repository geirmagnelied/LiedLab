# Notatapp — Liedlab

Intern notat- og prosjektapp for liedarkitektur.no

## Teknologi
- React + Vite
- localStorage (v6) — Supabase kjem i v7
- Deploy: Vercel
- Domene: liedarkitektur.no/liedlab/notatblokk

## Lokal utvikling

```bash
npm install
npm run dev
```

Opnar på http://localhost:5173/liedlab/notatblokk/

## Deploy til Vercel

Push til `main`-greina på GitHub — Vercel deployer automatisk.

Build-innstillingar i Vercel:
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## Mappestruktur

```
src/
  App.jsx          — Hovudapp, layout, routing
  Sidebar.jsx      — Venstremeny med prosjekt
  NoteInput.jsx    — Nytt/rediger notat
  NoteList.jsx     — Notatliste med oppgåver
  CalendarView.jsx — Månadskalender
  DeadlineView.jsx — Fristsoversikt
  Timeline.jsx     — Horisontal tidslinje
  SketchPad.jsx    — Skisseringsverktøy
  useStore.js      — localStorage state management
  dateUtils.js     — Dato-hjelpar (nextFriday, fmt)
  index.css        — Global CSS / design tokens
```

## Kommande (v7)
- Supabase-integrasjon (sky-lagring)
- Fleire brukarar / familiekontoar
- Poengsystem for husoppgåver
- Outlook-kalender-sync
- E-postvarsling om fristar
