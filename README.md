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

- Before the match, the timer area shows only Start. Starting replaces the button with the elapsed MM:SS clock and begins initial skill cooldowns.
- Tap an available skill once to record use, start its cooldown, swap it with the first card, and open its timestamps.
- Tap a cooling-down skill to reopen its existing activation without changing any match state. Initial cooldowns have no activation to show. Cards display only the image, name and configured initial/repeat durations; the waterline and status still reflect availability.
- The skill popup shows usage and ready timestamps, with 更變技能 on the left and 撤銷使用 on the right. Undo restores the state and positions before the last activation without rewinding the clock.
- The popup overlays the lower four grid cards without moving them, leaving the timer and upper two cards visible. Older activations are viewable, but Change/Undo remain limited to the most recent activation; their buttons are disabled for older records.
- 更變技能 closes the popup and enters Change Mode. Tap a replacement card in the grid to preserve the original timestamp and apply that skill's cooldown. Only skills available at the original time can be selected, even if their current cooldown display differs. The mistaken skill and previous order are restored before the replacement's swap is applied. The corrected timestamps then appear in the popup.
- Cancel Change Mode with 取消更變 or Escape. Entering or cancelling never changes the original event. Refresh exits this temporary mode while retaining the original saved match.
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
- `src/change-mode.ts`: temporary correction mode and original-event selection guards.
- `src/card-interaction.ts`: record ready skills or reopen cooling skill records without mutation.
- `src/popup-layout.ts`: popup bounds anchored to grid rows two and three.
- `src/state.ts`: skill activation, swapping, undo and saved-state validation.
- `src/timer.ts`: timestamp calculations and display formatting.
- `src/skills.ts`: names and timing rules.
- `src/styles.css`: responsive layout and cooldown waterline.
- `public/skills/*.PNG`: skill images matched by skill ID, with aspect ratios preserved.
- `tests/state.test.ts`: timer, activation, undo and persistence checks.

## Deploy

Run `npm run build`, then publish the `dist/` folder to static hosting. For hosts that build from this repository, set the build command to `npm run build` and output directory to `dist`. No environment variables or server are needed. Hosting under a subdirectory requires setting Vite's `base` to that path.

## Device acceptance check

Primary target: iPhone 17 Pro Max, portrait Safari. Before release, check on the actual device:

1. All six image cards and Start/Reset fit without scrolling with Safari's bars visible. Starting replaces the button with the clock.
2. Initial cooldowns match the table; disabled cards do not activate.
3. Activating card 4 changes order `123456` to `423156`; the modal shows correct match timestamps.
4. In the popup, choose 更變技能, select a replacement from the grid, and check that the original usage time is preserved. Cancel Change Mode and confirm the event is unchanged. 撤銷使用 restores the prior cooldown and order.
5. Lock the phone briefly, return, and refresh: elapsed time and cooldowns remain correct.
6. Cancel Reset to keep the match; confirm Reset to restore the starting screen.

The white layout uses system fonts, small viewport height and safe-area insets. The popup has no internal scroll area or background blur and overlays only grid rows two and three. Geometry tests cover several mobile viewport sizes; actual iPhone Safari rendering still needs device verification, especially with enlarged text. System clock changes can affect the elapsed timer.
