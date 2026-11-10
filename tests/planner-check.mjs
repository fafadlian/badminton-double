// Checks the game planner in index.html keeps its promises.
// Run from the repo root:  node tests/planner-check.mjs
// Exits with code 1 if any check fails.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/g).map(s => s.slice(8, -9)).find(s => s.includes('function planGames'));
const start = script.indexOf('function mulberry32');
const end = script.indexOf('// ---------- state');
if (start < 0 || end < 0) { console.error('Could not find the planner section in index.html'); process.exit(1); }
const X = {};
new Function('X', script.slice(start, end) + ';X.planGames=planGames;X.buildStats=buildStats;X.pk=pk;')(X);

const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon'];
const gamesToPairAll = n => Math.ceil(n * (n - 1) / 4);
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } };

function analyse(players, plan) {
  const ids = players.map(p => p.id), st = X.buildStats(players, plan);
  const lv = Object.fromEntries(players.map(p => [p.id, p.level || 2]));
  let unpaired = 0, maxPair = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const c = st.P[X.pk(ids[i], ids[j])] || 0;
    if (!c) unpaired++;
    if (c > maxPair) maxPair = c;
  }
  let doubleSits = 0;
  for (let i = 1; i < plan.length; i++) {
    const a = new Set([...plan[i - 1].a, ...plan[i - 1].b]), b = new Set([...plan[i].a, ...plan[i].b]);
    for (const p of ids) if (!a.has(p) && !b.has(p)) doubleSits++;
  }
  let worst = 0;
  for (const p of ids) { let s = 0; for (const g of plan) { if (g.a.includes(p) || g.b.includes(p)) s = 0; else if (++s > worst) worst = s; } }
  let lop = 0, uneven = 0;
  for (const g of plan) {
    const d = Math.abs(g.a.reduce((s, i) => s + lv[i], 0) - g.b.reduce((s, i) => s + lv[i], 0));
    if (d >= 2) uneven++;
    if (d >= 3) lop++;
  }
  const games = ids.map(i => st.gp[i]);
  const top = Math.max(...Object.values(lv)), low = Math.min(...Object.values(lv));
  const facedTop = Object.fromEntries(ids.filter(i => lv[i] !== top).map(i => [i, 0]));
  for (const g of plan) for (const [s, o] of [[g.a, g.b], [g.b, g.a]]) {
    const t = s.filter(x => lv[x] === top).length;
    if (t) for (const x of o) if (x in facedTop) facedTop[x] += t;
  }
  return { unpaired, maxPair, doubleSits, worst, lop, uneven, games, facedTop, lv, top, low, pairs: ids.length * (ids.length - 1) / 2 };
}

// even: the 'Even games' pairing mode from Setup > Matchups. It trades rule 1, even game counts
// and the shared-out top level for matched sides, so those checks loosen and the side checks tighten.
function run(label, n, levels = {}, rounds = 1, games = null, even = false) {
  const players = NAMES.slice(0, n).map(id => ({ id, here: true, offset: 0, level: levels[id] || 2 }));
  const count = games ?? gamesToPairAll(n) * rounds;
  const opts = even ? { even: true } : {};
  const t0 = Date.now();
  const plan = X.planGames(players, [], count, opts);
  const ms = Date.now() - t0;
  const again = X.planGames(players, [], count, opts);
  const r = analyse(players, plan);
  const roomForAll = count * 2 >= r.pairs;   // each game uses two partnerships
  console.log(`${label}: ${count} games, unpaired ${r.unpaired}/${r.pairs}, back-to-back sit-outs ${r.doubleSits}, longest sit-out run ${r.worst}, games each ${Math.min(...r.games)}-${Math.max(...r.games)}, ${ms}ms` +
    (r.top > r.low ? `, uneven sides ${r.uneven} (lopsided ${r.lop}), facing top level ${JSON.stringify(r.facedTop)}` : ''));
  check(plan.length === count, `${label}: planned ${plan.length} games, expected ${count}`);
  check(JSON.stringify(plan) === JSON.stringify(again), `${label}: same input gave a different plan`);
  const spread = even ? 2 : 1;
  check(Math.max(...r.games) - Math.min(...r.games) <= spread, `${label}: game counts differ by more than ${spread}`);
  check(ms < 5000, `${label}: took ${ms}ms to plan, too slow to re-plan on a phone`);
  if (roomForAll) check(r.unpaired <= (even ? 2 : 0), `${label}: ${r.unpaired} partnerships never happen`);
  // Fewer games than the full rotation needs: nobody partners twice until everyone has partnered once.
  else check(r.maxPair <= (even ? 2 : 1), `${label}: a pair partners ${r.maxPair} times while ${r.unpaired} pairs never do`);
  if (n <= 7) check(r.doubleSits === 0, `${label}: someone sits out twice in a row`);
  // From 9 players up, more people sit than can come on: 4 of the n-4 who sat play next,
  // so n-8 of them sit again. That floor is unavoidable, so the planner must not exceed it.
  // Levels buy evener sides with a few extra rests (see README), so the floor is exact only
  // when everyone is the same level; with levels on, allow a small margin over it.
  if (n >= 9) {
    const floor = (count - 1) * (n - 8), slack = r.top > r.low ? Math.ceil(count / 5) : 0;
    check(r.doubleSits <= floor + slack, `${label}: ${r.doubleSits} back-to-back sit-outs, above the ${floor}${slack ? ` (+${slack} allowed for levels)` : ''} unavoidable`);
  }
  // Matched sides narrow the usable foursomes, so 'even' is allowed one extra game in a row on the bench.
  check(r.worst <= Math.max(2, n - 6) + (even ? 1 : 0), `${label}: someone sits out ${r.worst} games in a row`);
  // Sides should be matched: rule 1 forces two Beginners to partner sooner or later, so a few
  // uneven games are unavoidable, but a blowout like Advanced+Intermediate vs two Beginners
  // should be rare. polish() evens these out without touching partnerships.
  if (r.top > r.low && !even) check(r.lop <= Math.ceil(count / 10), `${label}: ${r.lop} lopsided games (sides three levels apart) in ${count}`);
  // Even games is the point of the mode: never a game three levels apart, and from 7 players up
  // never one even two apart. Below that the rotation pins the sides - with 5 players, 4 of whom
  // play each game, the Advanced and the Beginner have to face each other whatever the planner does.
  if (r.top > r.low && even) {
    check(r.lop === 0, `${label}: ${r.lop} lopsided games (sides three levels apart) in ${count}`);
    check(n >= 7 ? r.uneven === 0 : r.uneven <= 2, `${label}: ${r.uneven} uneven games (sides two levels apart) in ${count}`);
  }
  // Sharing out the top level is what 'even' trades away: matched sides mean the strongest players
  // face each other, so the Beginners may face them rarely or never. Only 'mix' promises this.
  if (r.top > r.low && !even) {
    const f = Object.values(r.facedTop), mean = f.reduce((a, b) => a + b, 0) / f.length;
    if (n <= 7) check(Math.max(...f) - Math.min(...f) <= 1, `${label}: facing the top level is not shared out evenly`);
    for (const [id, v] of Object.entries(r.facedTop)) if (r.lv[id] === r.low && r.low < 2) check(v <= Math.ceil(mean), `${label}: lowest level ${id} faces the top level ${v} times, more than the ${mean.toFixed(1)} average`);
  }
  return r;
}

// Every level mix, run in both pairing modes.
const MIXES = [
  ['7 players, one Advanced', 7, { Ana: 3 }],
  ['7 players, one Advanced, one Beginner', 7, { Ana: 3, Gus: 1 }],
  ['7 players, Pro, Advanced, Beginner', 7, { Ana: 4, Ben: 3, Gus: 1 }],
  ['6 players, one Advanced, one Beginner', 6, { Ana: 3, Fay: 1 }],
  ['5 players, one Advanced, one Beginner', 5, { Ana: 3, Eli: 1 }],
  ['8 players, one Advanced, two Beginners', 8, { Ana: 3, Gus: 1, Hal: 1 }],
  ['10 players, one Advanced, one Beginner', 10, { Ana: 3, Jon: 1 }],
  ['10 players, one Advanced, one Beginner, 14 games', 10, { Ana: 3, Jon: 1 }, 1, 14],
  ['8 players, two Advanced, four Beginners', 8, { Ana: 3, Ben: 3, Eli: 1, Fay: 1, Gus: 1, Hal: 1 }],
  ['8 players, a Pro and an Advanced, two Beginners', 8, { Ana: 4, Ben: 3, Gus: 1, Hal: 1 }],
  ['10 players, a Pro and an Advanced, two Beginners', 10, { Ana: 4, Ben: 3, Ivy: 1, Jon: 1 }],
  ['10 players, a Pro, two Advanced, four Beginners', 10, { Ana: 4, Ben: 3, Cal: 3, Gus: 1, Hal: 1, Ivy: 1, Jon: 1 }],
];

console.log('Without levels');
for (const n of [4, 5, 6, 7, 8]) { run(`${n} players`, n); run(`${n} players, 2 rounds`, n, {}, 2); }
for (const n of [9, 10]) run(`${n} players`, n);
console.log('More players than the booking fits');
run('9 players, 14 games', 9, {}, 1, 14);
run('10 players, 14 games', 10, {}, 1, 14);
run('10 players, 18 games', 10, {}, 1, 18);
console.log('With levels, mixing everyone (the default)');
const mixed = MIXES.map(([label, n, levels, rounds, games]) => run(label, n, levels, rounds, games, false));
console.log('With levels, even games');
MIXES.forEach(([label, n, levels, rounds, games], i) => {
  const r = run(label, n, levels, rounds, games, true);
  // Whatever else it trades, 'even' must never hand out worse matchups than 'mix' does.
  check(r.uneven <= mixed[i].uneven, `${label}: even games gave ${r.uneven} uneven games, worse than mixing everyone (${mixed[i].uneven})`);
});
console.log('Even games with one level present plans the same games as mixing everyone');
for (const n of [6, 8, 10]) {
  const players = NAMES.slice(0, n).map(id => ({ id, here: true, offset: 0, level: 2 }));
  const count = gamesToPairAll(n);
  const a = JSON.stringify(X.planGames(players, [], count, { even: true }));
  const b = JSON.stringify(X.planGames(players, [], count));
  check(a === b, `${n} players, no levels: the pairing mode changed the plan`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
