# New Chat Starter (Copy/Paste)

Use this prompt to start the next dialogue with full continuity:

```text
You are continuing work on AwakeMode in this repository:
/Users/williamgordon/Downloads/awakemode

Before making any changes, read these files:
1) docs/handoffs/2026-03-09-awakemode-v1.3.3.md
2) docs/runbooks/dev-commands.md

Context:
- v1.2-v1.3.3 has been implemented (minimal main UI, settings drawer, pause/resume timer, floating mini controls, startup chirp + 10-second alerts, event log table with duration column behavior, status-pill border polish, clickability/UI polish).
- Keep browser-only scope unless explicitly instructed otherwise.
- Chromium is the first-class target.

Your startup tasks:
1. Summarize the current implementation status from the handoff.
2. List the top 5 next improvements with impact/effort.
3. Propose the next sprint plan.
4. After approval, implement changes directly and run:
   npm run test && npm run build
5. Report exact files changed and verification results.

Important constraints:
- Keep logic modular and reusable (clean separation between engine/state and presentational components).
- Preserve existing AwakeMode design language.
- Avoid introducing backend or extension APIs unless requested.
```

---

## Optional: Starter Prompt for Chrome Extension Phase

```text
Continue from AwakeMode v1.3.3 and begin Chrome extension architecture planning.
Read first:
- docs/handoffs/2026-03-09-awakemode-v1.3.3.md
- docs/runbooks/dev-commands.md

Deliver:
1) extension architecture options (MV3) with pros/cons,
2) shared-module migration plan for wakeSession/wakeProfiles/wakeShortcuts/wakeAlerts,
3) phased implementation roadmap,
4) risk list (permissions, lifecycle, wake reliability),
5) minimal scaffold implementation once plan is approved.
```
