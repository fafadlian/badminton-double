# Badminton Doubles

A phone web app that plans and scores a night of badminton doubles for 4–8 players on one court, then sums it up with standings, stats and awards. It is used by one scorer on one phone, live, at the court. Hosted on GitHub Pages from this repo.

## Hard constraints

- **One file, no backend.** The whole app is `index.html`: markup, CSS and JavaScript. No build step, no framework, no server, no accounts.
- **Offline first.** `sw.js` caches the app (network first, cache fallback). Scores live in the browser's `localStorage` only.
- **Phone first.** Design for 390 px wide, one-handed, in light and dark mode. Tap targets at least 44 px. No horizontal page scroll; wide tables scroll inside `.tablebox`.
- **No form submission.** The app also runs inside a sandboxed frame (the Claude viewer) where `<form>` submit events are blocked. Buttons must use `type="button"` with a `data-act` handler. Never rely on `submit`.
- **No `alert`, `confirm` or `prompt`.** Confirm in the page itself (two-tap buttons, inline cards).
- **External resources:** only Google Fonts (Barlow, Barlow Condensed) with system fallbacks.

## How index.html is organised

All behaviour is in one inline `<script>`, in this order:

1. **Planner**: `mulberry32`, `buildStats`, `planGames(players, history, count)`. Deterministic (seeded), so the same players, levels and history always give the same plan.
2. **State**: `KEY` for localStorage, `DEFAULT_NAMES`, `initial()`, `newSession()`.
3. **Game mode**: `DEFAULT_RULES`, `PRESETS`, `regularWin`, `validScore`, the per-game timer, `rulesLine` and `rulesSentence`.
4. **Levels**: `LEVELS`, `levelNote()`.
5. **Session planner**: pace (seconds per point, learned from finish times), minutes per game, games that fit.
6. **Tabs**: `showTab`, `route`, `goTab` (hash routing: `#play`, `#results`, `#setup`, `#about`).
7. **Render functions**: one per section (`renderCourt`, `renderStandings`, `renderStats`, `renderChars` for awards, `renderPairs`, `renderRoster`, `renderMode`, `renderSession`, `renderBackup`, `renderAbout`...). `render()` calls them all.
8. **Actions**: one delegated `click` listener switching on `data-act`, plus `change` (level selects, file import) and `keydown` (Enter in the player editor).

### State shape (saved in localStorage and in exported files)

```js
state = {
  players: [{ id, here, offset, level }],   // level 1 Beginner, 2 Intermediate, 3 Advanced, 4 Pro
  history: [{ a:[id,id], b:[id,id], sa, sb, t, to, dz, timed, cr }], // finished games
  //   t finish time (ms), to points-to-win, dz false if deuce was off, timed true if ended by the time limit,
  //   cr { id: points won personally } when the scorer tapped names
  plan: [{ a, b }],                          // games still to play; plan[0] is on court
  cur: { sa, sb, log:[{ s:'a'|'b', by:id|null }], start },  // game on court
  target,                                    // total games planned
  clockStart, date: 'YYYY-MM-DD', started,
  rules: { target, deuce:'none'|'cap'|'nocap', cap, limit, timeUp:'golden'|'draw', sessionMin, warmup, rounds }
}
```

Export format: `{ app:'thursday-doubles', v:4, date, players, history, target, rules }`. `parseSession` validates everything before `applySession` replaces the current session.

## Planner rules, in priority order

1. Everyone partners everyone once (`unc * 1000`).
2. Nobody sits out twice in a row (unavoidable with 8 players, where half the group sits each game).
3. Game counts stay within one of each other.
4. Partnerships and opponents don't repeat more than needed.
5. **Levels:** games against the top level present are shared out evenly, and the lowest level never faces them more than anyone else. Off when everyone is at the same level. Implemented as extra restarts that lean towards spreading the top level, plus `polish()`, which swaps opponents between two games (partnerships and game counts unchanged) when that scores better.

When levels or attendance change, `replan()` keeps the game on court (once play has started) and re-plans the rest.

## Decisions already made (don't reopen without asking)

- **Levels** only decide who plays the strongest players. They never change who partners whom.
- **No Elo, no head start, no in-night learning of ratings.** All were explored in simulation and judged over-engineered for this group.
- **Standings** rank by win % (a draw counts as half), then points won %, then point difference per game.
- **Terms:** P, W, D, L, PF, PA, PD, Win %, Pts won %, Own pts, Own share, Deuce W–L, Max score, Golden point, Total games, Awards. Use these words in UI copy.
- **Awards** are rule-based (no AI). One award per player, no award given twice.

## Conventions

- Colours come from CSS tokens on `:root`, redefined for dark mode under `prefers-color-scheme` and `[data-theme]`. No literal colours in component rules.
- UI copy: plain, short, active voice. Name things the way players say them.
- Keep the Claude-viewer compatibility rules above (no submit, no dialogs, no downloads by link outside `saveFile`).

## Checking changes

- `node tests/planner-check.mjs` checks the planner for 4–8 players, with and without levels: every partnership happens, game counts are even, no back-to-back sit-outs (up to 7 players), the top level is shared out evenly, and the plan is deterministic. Run it after any planner change.
- For UI changes, check at 390 px wide in light and dark mode, and check that the page never scrolls sideways.

## Ideas on the roadmap (not started)

1. **Two courts, one phone:** plan in rounds of two simultaneous games (Court 1 and Court 2, with the rest sitting out) for about 10 players. One scorer enters both courts.
2. **Two phones without a backend:** share the plan by export and import at the start, then merge results at the end.
3. **Live sync between phones:** needs shared storage (for example Firebase with a session code). Only if 1 and 2 aren't enough.

## Privacy

Session exports contain real names and results. Don't commit them. The `Claude outputs/` folder holds past analysis files and real session data and should stay out of the repo (add it to `.gitignore`).
