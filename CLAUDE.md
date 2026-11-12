# Badminton Doubles

A phone web app that plans and scores a night of badminton doubles for 4–10 players on one court, then sums it up with standings, stats and awards. It is used by one scorer on one phone, live, at the court. Hosted on GitHub Pages from this repo.

## Hard constraints

- **One file, no backend.** The whole app is `index.html`: markup, CSS and JavaScript. No build step, no framework, no server, no accounts.
- **Offline first.** `sw.js` caches the app (network first, cache fallback). Scores live in the browser's `localStorage` only.
- **Phone first.** Design for 390 px wide, one-handed, in light and dark mode. Tap targets at least 44 px. No horizontal page scroll; wide tables scroll inside `.tablebox`.
- **No form submission.** The app also runs inside a sandboxed frame (the Claude viewer) where `<form>` submit events are blocked. Buttons must use `type="button"` with a `data-act` handler. Never rely on `submit`.
- **No hash navigation.** The viewer refuses `location.hash` changes (`Not allowed to navigate top frame to data URL`) and `hashchange` may never fire, so a bare `<a href="#play">` does nothing. Tabs switch through a click handler calling `goTab`/`showTab`; the hash is only kept in step with `history.pushState` for deep links and the back button.
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
7. **Render functions**: one per section (`renderCourt`, `renderStandings`, `renderStats`, `renderChars` for awards, `renderPairs`, `renderRoster`, `renderMode`, `renderMatch`, `renderSession`, `renderBackup`, `renderAbout`...). `render()` calls them all.
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
  rules: { target, deuce:'none'|'cap'|'nocap', cap, limit, timeUp:'golden'|'draw', sessionMin, warmup, rounds,
           pairing:'mix'|'even' }       // what the planner puts first when levels differ
}
```

Export format: `{ app:'thursday-doubles', v:5, date, players, history, target, rules }`. `parseSession` validates everything before `applySession` replaces the current session. `v` is written but never read: older files still import because `sanitizeRules` fills in anything missing, so a v4 file simply comes back as `pairing:'mix'`.

## Planner rules, in priority order

1. Everyone partners everyone once (`unc * 1000`).
2. Nobody sits out twice in a row. Unavoidable from 8 players up: with 8 the group splits in half and rule 1 wins, and from 9 up only four of the `n-4` people sitting can come on, so `n-8` of them sit again every game. The planner holds that floor exactly at 9 and 10.
3. Game counts stay within one of each other.
4. Partnerships and opponents don't repeat more than needed.
5. **Levels:** games against the top level present are shared out evenly, the lowest level never faces them more than anyone else, and the two sides of a game are matched so their levels add up to about the same (no Advanced+Intermediate against two Beginners). Off when everyone is at the same level. Implemented as extra restarts that lean towards spreading the top level, plus `polish()`, which swaps opponents between two games (partnerships and game counts unchanged) when that scores better.
6. **Pairing mode (`rules.pairing`, Setup → Matchups).** `'mix'`, the default, is the order above. `'even'` puts rule 5's matched sides first instead: `unc` drops from 1000 to 200, the side-balance weight doubles from 4 to 8, and balance is scored in the greedy candidate cost and the restart score as well as in `polish()`. It does nothing when everyone is at the same level. What it trades away is measured, not guessed — see the decision below.
7. **Restart budget:** each restart costs `count × C(n,4)` pairings, so 4–8 players keep the full 300 restarts (their plans are unchanged) and 9–10 scale down to hold a re-plan near 700 ms. With levels the budget doubles and, above 8 players, 60% of it goes to the level-aware half.

When levels or attendance change, `replan()` keeps the game on court (once play has started) and re-plans the rest.

## Decisions already made (don't reopen without asking)

- **Levels** only decide who plays the strongest players and who faces whom. They never change who partners whom — except in the `'even'` pairing mode, which is the one place that trade is on offer, and the card says so before the group picks it.
- **Even sides are scored in `polish()` only.** Swapping opponents there cannot change a partnership or a game count, so it is free. Scoring side balance while building the plan instead does trade rule 1 away: measured over ten level mixes, a weight of 4 left 5 partnerships unplayed, 8 left 11 and 20 left 28. Polish-only at weight 4 cuts lopsided games (sides three levels apart) from 19 to 3 in 134 games and costs nothing. Raising it past 4 buys one more game for 20 extra back-to-back sit-outs, so don't.
- **A few uneven games are unavoidable.** Rule 1 makes the two weakest players partner sooner or later, and their opponents can only be so weak.
- **Dropping rule 1 for even games was tried as a default and rejected (2026-11-09), then shipped as a toggle (2026-11-10).** Softening `unc*1000` to 200 and scoring side balance during the build does make games even: over the 12 level mixes in the tests, uneven games fall from 25 to 3 in 171 games and lopsided ones from 4 to 0. The costs are real and were measured twice: 1-2 partnerships a night never happen, game counts drift to a spread of 2 (raising `imb*imb*15` four-fold did not fix it), someone can sit one more game in a row, and the group stratifies — with a Pro and an Advanced among 10, the Pro's side faces the second-strongest six times and the two Beginners **zero**. A night where the weakest and strongest never meet is not something a group should get by accident, so this is `rules.pairing` on Setup → Matchups and not the default, with its costs written on the card. Don't make `'even'` the default, and don't quietly widen what it trades: the few uneven games left in `'mix'` are the price of the full rotation, not a bug.
- **Even sides change who faces the top level.** Matching the sides means the strongest two players meet each other more often, so "shared out evenly" now holds among players of similar level rather than across everyone. The lowest level still faces the top least, which is the part that matters. Levels also buy this with a few extra back-to-back rests, so the sit-out floor in the tests is exact only when levels are off.
- **No Elo, no head start, no in-night learning of ratings.** All were explored in simulation and judged over-engineered for this group.
- **Standings** rank by win % (a draw counts as half), then points won %, then point difference per game.
- **Terms:** P, W, D, L, PF, PA, PD, Win %, Pts won %, Own pts, Own share, Deuce W–L, Max score, Golden point, Total games, Awards. Use these words in UI copy.
- **Awards** are rule-based (no AI). One award per player, no award given twice. Every candidate carries a `key`, and the greedy pass in `archetypes()` skips a candidate whose player or whose key is already taken, so the keys are what keep titles unique. Six low-scoring fallbacks (`social`, `opener`, `closer`, `utility`, `workhorse`, `grafter`, scored 10 down to 5, far below the ~47 floor of a real award) are keyed the same way, so a quiet night hands out six distinct leftovers rather than one repeated. `'The Regular'` is the last resort after those and is the one title with no key: with 10 players it can still be reached, but at most by one player, because three real keys (`pts`, `lungs`, `wall`) always have candidates. Checked over 6,600 simulated nights at 8-10 players: no repeated title, never more than one `The Regular`.

## Conventions

- Colours come from CSS tokens on `:root`, redefined for dark mode under `prefers-color-scheme` and `[data-theme]`. No literal colours in component rules.
- UI copy: plain, short, active voice. Name things the way players say them.
- Keep the Claude-viewer compatibility rules above (no submit, no dialogs, no hash navigation, no downloads by link outside `saveFile`).

## Checking changes

- `node tests/planner-check.mjs` checks the planner for 4–10 players, with and without levels, and runs every level mix in **both pairing modes**: every partnership happens when the games fit, game counts are even, no back-to-back sit-outs (up to 7 players) and no more than the unavoidable floor (9–10), nobody sits out more than `n-6` games in a row, the top level is shared out evenly, planning stays under 5 s, and the plan is deterministic. When fewer games are planned than the full rotation needs, it checks no pair partners twice before every pair has partnered once. In `'even'` mode it loosens exactly what that mode trades (up to 2 partnerships missed, game counts 2 apart, one extra game on the bench, no shared-out top level) and tightens what it promises: no lopsided game at all, no uneven game from 7 players up, and never worse matchups than `'mix'` gave the same night. It also checks that with one level present both modes plan the same games. Run it after any planner change.
- For UI changes, check at 390 px wide in light and dark mode, and check that the page never scrolls sideways.

## Ideas on the roadmap (not started)

1. **Two courts, one phone:** plan in rounds of two simultaneous games (Court 1 and Court 2, with the rest sitting out) for about 10 players. One scorer enters both courts.
2. **Two phones without a backend:** share the plan by export and import at the start, then merge results at the end.
3. **Live sync between phones:** needs shared storage (for example Firebase with a session code). Only if 1 and 2 aren't enough.

## Privacy

Session exports contain real names and results. Don't commit them. The `Claude outputs/` folder holds past analysis files and real session data and should stay out of the repo (add it to `.gitignore`).
