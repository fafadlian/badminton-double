"""
Resimulate a doubles session from its pair scores.

Only pair scores are known, so individual points are estimated:
1. Rate each player. Every rally is won by side A with probability
   sigmoid(rA1 + rA2 - rB1 - rB2). Ratings get a mild normal prior so that
   11 games cannot push anyone to an extreme. Fitted by MAP with a Laplace
   (normal) approximation to the posterior for uncertainty.
2. Split each pair's actual points between the two partners: player i wins
   share sigmoid(ri - rj) of their pair's points (the stronger partner wins
   more of them). This is an assumption, not something the scores show.
3. Replay the whole schedule many times rally by rally under the session's
   rules, to see how many games each player "should" have won.

Usage: python resimulate.py doubles-2026-11-05.json
"""
import json
import sys

import numpy as np
import pandas as pd

PRIOR_SD = 0.35  # spread of player ratings before seeing any games
DRAWS = 20_000
rng = np.random.default_rng(20261105)


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def load(path):
    d = json.load(open(path))
    players = [p["id"] for p in d["players"]]
    idx = {p: i for i, p in enumerate(players)}
    games = [(idx[g["a"][0]], idx[g["a"][1]], idx[g["b"][0]], idx[g["b"][1]], g["sa"], g["sb"]) for g in d["history"]]
    rules = d.get("rules", {"target": 15, "deuce": "cap", "cap": 20})
    return players, np.array(games), rules


def fit(n, games):
    """MAP ratings and covariance (Laplace approximation)."""
    X = np.zeros((len(games), n))
    for k, (a1, a2, b1, b2, _, _) in enumerate(games):
        X[k, [a1, a2]] += 1
        X[k, [b1, b2]] -= 1
    won, played = games[:, 4], games[:, 4] + games[:, 5]
    r = np.zeros(n)
    for _ in range(100):  # Newton's method on the log posterior
        p = sigmoid(X @ r)
        grad = X.T @ (won - played * p) - r / PRIOR_SD**2
        hess = -(X.T * (played * p * (1 - p))) @ X - np.eye(n) / PRIOR_SD**2
        step = np.linalg.solve(hess, grad)
        r -= step
        if np.abs(step).max() < 1e-10:
            break
    cov = np.linalg.inv(-hess)
    return r, cov


def finished(a, b, rules):
    hi, lo, t = max(a, b), min(a, b), rules["target"]
    if rules.get("deuce") == "none":
        return hi == t
    if hi == t and lo <= t - 2:
        return True
    cap = rules.get("cap", 99) if rules.get("deuce") == "cap" else 99
    return (lo >= t - 1 and hi - lo == 2 and hi <= cap) or (hi == cap and lo == cap - 1)


def play(p, rules):
    a = b = 0
    while not finished(a, b, rules):
        if rng.random() < p:
            a += 1
        else:
            b += 1
    return a, b


def main(path):
    players, games, rules = load(path)
    n = len(players)
    r_map, cov = fit(n, games)
    draws = rng.multivariate_normal(r_map, cov, size=DRAWS)
    draws -= draws.mean(axis=1, keepdims=True)  # only differences matter

    est_pts = np.zeros((DRAWS, n))  # estimated personal points in the real games
    sim_wins = np.zeros((DRAWS, n))  # wins in a replayed session
    for s, r in enumerate(draws):
        for a1, a2, b1, b2, sa, sb in games:
            for (i, j, pts) in ((a1, a2, sa), (b1, b2, sb)):
                k = rng.binomial(pts, sigmoid(r[i] - r[j]))
                est_pts[s, i] += k
                est_pts[s, j] += pts - k
            xa, xb = play(sigmoid(r[a1] + r[a2] - r[b1] - r[b2]), rules)
            for i in (a1, a2) if xa > xb else (b1, b2):
                sim_wins[s, i] += 1

    played = np.zeros(n, int)
    wins = np.zeros(n, int)
    pair_pts = np.zeros(n, int)
    for a1, a2, b1, b2, sa, sb in games:
        for side, pts, won in (((a1, a2), sa, sa > sb), ((b1, b2), sb, sb > sa)):
            for i in side:
                played[i] += 1
                wins[i] += won
                pair_pts[i] += pts

    lo, hi = np.percentile(est_pts, [10, 90], axis=0)
    table = pd.DataFrame({
        "player": players,
        "played": played,
        "won": wins,
        "rally_win_pct": (sigmoid(r_map) * 100).round(1),
        "rating_sd": np.sqrt(np.diag(cov)).round(2),
        "pair_points": pair_pts,
        "est_points": est_pts.mean(axis=0).round(1),
        "est_low": lo.round(0).astype(int),
        "est_high": hi.round(0).astype(int),
        "est_share_pct": (est_pts.mean(axis=0) / pair_pts * 100).round(1),
        "est_per_game": (est_pts.mean(axis=0) / played).round(1),
        "replay_wins": sim_wins.mean(axis=0).round(1),
    })
    table["luck"] = (table["won"] - table["replay_wins"]).round(1)
    table = table.sort_values("est_points", ascending=False).reset_index(drop=True)
    return table


if __name__ == "__main__":
    t = main(sys.argv[1] if len(sys.argv) > 1 else "doubles-2026-11-05.json")
    pd.set_option("display.width", 200)
    print(t.to_string(index=False))
    t.to_csv("resimulated-points.csv", index=False)
