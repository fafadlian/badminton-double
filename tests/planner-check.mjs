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

const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];
const gamesToPairAll = n => Math.ceil(n * (n - 1) / 4);
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } };

function analyse(players, plan) {
  const ids = players.map(p => p.id), st = X.buildStats(players, plan);
  let unpaired = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!st.P[X.pk(ids[i], ids[j])]) unpaired++;
  let doubleSits = 0;
  for (let i = 1; i < plan.length; i++) {
    const a = new Set([...plan[i - 1].a, ...plan[i - 1].b]), b = new Set([...plan[i].a, ...plan[i].b]);
    for (const p of ids) if (!a.has(p) && !b.has(p)) doubleSits++;
  }
  const games = ids.map(i => st.gp[i]);
  const lv = Object.fromEntries(players.map(p => [p.id, p.level || 2]));
  const top = Math.max(...Object.values(lv)), low = Math.min(...Object.values(lv));
  const facedTop = Object.fromEntries(ids.filter(i => lv[i] !== top).map(i => [i, 0]));
  for (const g of plan) for (const [s, o] of [[g.a, g.b], [g.b, g.a]]) {
    const t = s.filter(x => lv[x] === top).length;
    if (t) for (const x of o) if (x in facedTop) facedTop[x] += t;
  }
  return { unpaired, doubleSits, games, facedTop, lv, top, low };
}

function run(label, n, levels = {}, rounds = 1) {
  const players = NAMES.slice(0, n).map(id => ({ id, here: true, offset: 0, level: levels[id] || 2 }));
  const count = gamesToPairAll(n) * rounds;
  const plan = X.planGames(players, [], count);
  const again = X.planGames(players, [], count);
  const r = analyse(players, plan);
  console.log(`${label}: ${count} games, unpaired ${r.unpaired}, back-to-back sit-outs ${r.doubleSits}, games each ${Math.min(...r.games)}-${Math.max(...r.games)}` +
    (r.top > r.low ? `, facing top level ${JSON.stringify(r.facedTop)}` : ''));
  check(plan.length === count, `${label}: planned ${plan.length} games, expected ${count}`);
  check(JSON.stringify(plan) === JSON.stringify(again), `${label}: same input gave a different plan`);
  check(r.unpaired === 0, `${label}: ${r.unpaired} partnerships never happen`);
  check(Math.max(...r.games) - Math.min(...r.games) <= 1, `${label}: game counts differ by more than 1`);
  if (n <= 7) check(r.doubleSits === 0, `${label}: someone sits out twice in a row`);
  if (r.top > r.low) {
    const f = Object.values(r.facedTop), mean = f.reduce((a, b) => a + b, 0) / f.length;
    if (n <= 7) check(Math.max(...f) - Math.min(...f) <= 1, `${label}: facing the top level is not shared out evenly`);
    for (const [id, v] of Object.entries(r.facedTop)) if (r.lv[id] === r.low && r.low < 2) check(v <= Math.ceil(mean), `${label}: lowest level ${id} faces the top level ${v} times, more than the ${mean.toFixed(1)} average`);
  }
}

console.log('Without levels');
for (const n of [4, 5, 6, 7, 8]) { run(`${n} players`, n); run(`${n} players, 2 rounds`, n, {}, 2); }
console.log('With levels');
run('7 players, one Advanced', 7, { Ana: 3 });
run('7 players, one Advanced, one Beginner', 7, { Ana: 3, Gus: 1 });
run('7 players, Pro, Advanced, Beginner', 7, { Ana: 4, Ben: 3, Gus: 1 });
run('6 players, one Advanced, one Beginner', 6, { Ana: 3, Fay: 1 });
run('5 players, one Advanced, one Beginner', 5, { Ana: 3, Eli: 1 });
run('8 players, one Advanced, two Beginners', 8, { Ana: 3, Gus: 1, Hal: 1 });

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
