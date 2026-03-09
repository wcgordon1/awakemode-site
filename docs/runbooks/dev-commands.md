# AwakeMode Dev Commands and QA Runbook

## Environment
- Project root: `/Users/williamgordon/Downloads/awakemode`
- Package manager: `npm`
- Framework: Astro + Vitest

## Setup
```bash
npm install
```

## Daily Commands

### Local dev server
```bash
npm run dev
```

### Unit tests (single run)
```bash
npm run test
```

### Unit tests (watch)
```bash
npm run test:watch
```

### Production build
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## Fast Validation Loop
Use this before handing off work:
```bash
npm run test && npm run build
```

## Manual QA Checklist (Chromium-first)

### Core wake flow
1. Load homepage in Chrome/Edge/Brave.
2. Start indefinite session.
3. Confirm status becomes `Active`.
4. Stop session and confirm status returns `Released`.

### Timer flow + pause/resume
1. Switch to timer mode.
2. Test preset launch (15/30/60/120).
3. Test custom minutes input.
4. Confirm countdown and progress bar update.
5. Pause timer from main panel.
6. Resume timer from main panel.
7. Confirm timer completes and session auto-releases.

### Floating mini controls (cross-page)
1. Start timer session on homepage.
2. Scroll main Awake panel out of view and confirm mini controls appear.
3. Use mini controls: Pause/Play/Stop.
4. Navigate to another page and confirm mini controls remain available.
5. Return homepage and confirm mini controls hide when main panel is visible.
6. On mobile viewport, confirm mini controls do not collide with nav/search actions.

### Beep alert
1. Ensure beep toggle is enabled in settings.
2. Start a short timer and let it cross 10 seconds remaining.
3. Confirm triple beep plays once.
4. Disable beep toggle and repeat; confirm no beep.
5. Refresh and confirm beep preference persists.

### Profiles
1. Open profile selector and verify custom themed dropdown.
2. Verify keyboard interaction:
   - Up/Down navigation
   - Enter/Space selection
   - Escape close
3. Click `+` near profile count and confirm:
   - selector moves to “Create new profile”
   - name input receives focus
   - pulse highlight appears briefly
4. Create/edit/delete profile.
5. Set default profile.
6. Launch quick profiles via click and keys `1`, `2`, `3`.
7. Refresh and confirm selected profile continuity.

### Shortcuts
- `Space`: Start/Stop
- `T`: Toggle mode
- `1..3`: Launch quick profile
- `R`: Retry wake lock
- Confirm shortcuts do **not** fire while typing in input/textarea/select/contenteditable.

### Unsupported browser path
1. Open in a browser without `wakeLock` support.
2. Confirm unsupported banner appears.
3. Confirm start is disabled and fallback guidance is visible.

## Key Files for v1.3.1
- `src/components/awake/AwakeControlPanel.astro`
- `src/components/awake/AwakeMiniControls.astro`
- `src/components/awake/SessionStatusBadge.astro`
- `src/components/awake/ProfileManager.astro`
- `src/lib/wakeSession.ts`
- `src/lib/wakeSessionRuntime.ts`
- `src/lib/wakeAlerts.ts`
- `src/lib/wakeUiPreferences.ts`
- Tests under `src/lib/*.test.ts`
