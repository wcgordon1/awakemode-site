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
3. Confirm status becomes `Active` and timer row hidden.
4. Stop session and confirm status returns `Released`.

### Timer flow
1. Switch to timer mode.
2. Test preset launch (15/30/60/120).
3. Test custom minutes input.
4. Confirm countdown updates and auto-release at completion.

### Block/retry reliability
1. Trigger blocked state (simulate denied permission/system policy where possible).
2. Confirm `Blocked` badge + retry button shown.
3. Click retry and press `R`; confirm event log updates with retry events.

### Visibility/reacquire
1. Start session.
2. Hide tab/minimize and return.
3. Confirm reacquire attempts/events appear when needed and session remains stable.

### Profiles
1. Create profile (timer + indefinite).
2. Edit name/mode/duration.
3. Set default profile.
4. Delete profile.
5. Confirm max-count/validation rules.
6. Launch quick profiles via click and keys `1`, `2`, `3`.
7. Refresh and confirm selected profile continuity.

### Shortcuts
- `Space`: Start/Stop
- `T`: Toggle mode
- `1..3`: Launch quick profile
- `R`: Retry wake lock
- Confirm shortcuts do **not** fire while typing in input/textarea/select/contenteditable.

### Unsupported browser path
1. Open in a browser without wakeLock support.
2. Confirm unsupported banner appears.
3. Confirm start is disabled and fallback guidance is visible.

## Key Files for v1.1
- `src/components/awake/AwakeControlPanel.astro`
- `src/components/awake/StatusRail.astro`
- `src/components/awake/ProfileManager.astro`
- `src/components/awake/ProfileQuickLaunch.astro`
- `src/components/awake/ShortcutHints.astro`
- `src/lib/wakeSession.ts`
- `src/lib/wakeProfiles.ts`
- `src/lib/wakeShortcuts.ts`
- Tests under `src/lib/*.test.ts`
