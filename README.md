# Tiny Grand Prix — Spelling Race

A voice-powered sight-word kart race for children. Read words aloud to earn turbo, steer through three laps, and race visible rivals around a Singapore-inspired track.

This repository is the public standalone game copy. It contains the game source, local word logic, Three.js renderer, tests, and required 3D assets. It does not include the private SG dad P1 calculator, its data, or analytics credentials.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm test
npm run lint
npm run build
```

The game is designed for current Safari on iPad and modern desktop browsers. Microphone permission is required for voice play; touch steering remains available as a fallback.

## Privacy

Audio, transcripts, child names, and race results are kept in memory only. The public copy has no analytics or server-side storage.
