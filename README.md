# 第五人格 · 輔助技能冷卻追蹤

Mobile-first single-screen tracker built with Vite and vanilla TypeScript. No backend or account required.

## Run locally

Requires Node.js 22.12+ (or 20.19+).

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
Open the address printed by Vite. To try it on your iPhone, connect both devices to the same Wi-Fi and open the printed Network URL. Windows Firewall may need to permit the development server.

```sh
npm run build
npm run preview
npm test
```

Tests use Node's TypeScript stripping; use Node 22.18+ or Node 24 for `npm test`.

## Behaviour

- Start begins the elapsed match clock and initial skill cooldowns.
- Tap an available skill once to record use, start its cooldown, swap it with the first card, and open its timestamps.
- Undo restores the state and positions before the last activation, without rewinding the match clock. Undo is available after dismissing the modal and after refresh; only the last activation can be undone.
- Change in the skill popup replaces the last activation while preserving its original timestamp and applying the replacement skill's cooldown. Only skills available at that original time can be selected. The mistaken skill and previous card order are restored before the replacement is applied; Undo still restores the state before that activation.
- Reset asks for confirmation, then clears the timer, cooldowns, records and undo, restoring the default order.
- Active matches are saved locally on this browser. Refresh or returning from background recalculates time from the original timestamp. If browser storage is unavailable, tracking still works but refresh recovery does not.

## Skill configuration

Values supplied by the project owner on 2026-10-09, in seconds. Edit `src/skills.ts` to change them.

| Skill | Initial | Repeat cooldown |
| --- | ---: | ---: |
| 閃現 | 60 | 150 |
| 移形 | 50 | 100 |
| 興奮 | 40 | 100 |
| 放狗 | 30 | 90 |
| 失常 | 40 | 90 |
| 傳送 | 45 | 100 |

Each tap starts a fixed cooldown immediately. Charge mechanics, effects that modify cooldowns, Trump Card conversion, and automatic in-game detection are outside this version.

## Files

- `src/main.ts`: screen, modal and event handlers; local persistence.
- `src/state.ts`: skill activation, swapping, undo and saved-state validation.
- `src/timer.ts`: timestamp calculations and display formatting.
- `src/skills.ts`: names and timing rules.
- `src/styles.css`: responsive layout and cooldown waterline.
- `tests/state.test.ts`: timer, activation, undo and persistence checks.

## Deploy

Run `npm run build`, then publish the `dist/` folder to static hosting. For hosts that build from this repository, set the build command to `npm run build` and output directory to `dist`. No environment variables or server are needed. Hosting under a subdirectory requires setting Vite's `base` to that path.

## Device acceptance check

Primary target: iPhone 17 Pro Max, portrait Safari. Before release, check on the actual device:

1. All six cards and Start/Undo/Reset fit without scrolling with Safari's bars visible.
2. Initial cooldowns match the table; disabled cards do not activate.
3. Activating card 4 changes order `123456` to `423156`; the modal shows correct match timestamps.
4. Close the modal and undo: previous cooldown and card order return.
5. Lock the phone briefly, return, and refresh: elapsed time and cooldowns remain correct.
6. Cancel Reset to keep the match; confirm Reset to restore the starting screen.

The layout uses the small viewport height and safe-area insets. Very short screens below 560 CSS pixels may scroll to keep controls usable. System clock changes can affect the elapsed timer. The optional Google font falls back to the device's system font if unavailable.
