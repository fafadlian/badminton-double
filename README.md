# Thursday Doubles

A badminton doubles scorekeeper for 4 to 8 players sharing one court. It plans who plays with whom so that everyone partners everyone, keeps score from one phone, and turns the night's results into standings, stats and a fun title for each player.

It is a single HTML file with no backend, account or install. Open it in a phone browser, or add it to your home screen.

<p>
  <img src="docs/court.png" alt="Game in progress: the court with four players, the score 10–8, and the next games in the queue" width="260">
  <img src="docs/standings.png" alt="Standings table ranked by win rate, then share of points won" width="260">
  <img src="docs/characters.png" alt="Characters: a fun title for each player, such as The Final Boss and Giant Killer" width="260">
</p>

<sub>Screenshots use made-up names and scores.</sub>

## What it does

- **Partner rotation.** Plans the games so every pair partners at least once, games are shared out evenly, and nobody sits out more than they have to.
- **Late arrivals and early leavers.** Mark someone as here or not here and the remaining games are re-planned. The game on court stays as it is unless someone in it leaves.
- **Scoring from one phone.** Tap a player's name to give their side the point and credit that player. Use **+** for points nobody really earned. Scores follow the house rules below, so a game can't be finished on an impossible score.
- **Standings.** Ranked by win rate, then by **Won %**, the share of all points played that your side won.
- **Stats.** Points per game, points conceded, ± per game, deuce record, personal credits, a form chart for each player, and a breakdown of how each player does with each partner and against each opponent.
- **Characters.** One title per player, earned from the night's results.
- **Partners grid.** Shows which pairs have played together, which are coming up, and which won't fit in the games planned.
- **Results list** with undo for the last game.
- **Session clock** for a two-hour booking, with the time left per remaining game.
- **Copy and paste a session** to back it up or move it to another phone.
- Works offline once it has been opened online, and follows the phone's light or dark mode.

## House rules

- Games are to **15 points**.
- From **14–14** a side must win by 2.
- The game is capped at **20**, so 20–19 wins.
- There are no draws.

To change these, edit `validScore()` in `index.html`.

## How many games?

Each game uses two partnerships, so pairing everyone once takes:

| Players | Partnerships | Games needed | Games each | Sitting out each game |
|---|---|---|---|---|
| 4 | 6 | 3 | 3 | 0 |
| 5 | 10 | 5 | 4 | 1 |
| 6 | 15 | 8 | 5–6 | 2 |
| 7 | 21 | 11 | 6–7 | 3 |
| 8 | 28 | 14 | 7 | 4 |

The app plans this many games when a session starts. In a two-hour booking at about 10 minutes a game, 14 games for 8 players is tight. Lower the game count under **Session** and the Partners grid shows which pairs will miss out, or play to a lower score.

With 6 or 7 players the planner avoids anyone sitting out two games in a row. With 8, half the group sits each game, so a few people sit out twice in a row to fit every partnership in.

## Characters

Each title comes from a rule about the night's results, not from AI, so it works offline. The app gives each player their strongest title, and no two players share one.

| Title | Earned by |
|---|---|
| The Final Boss | Top of the standings |
| Giant Killer | Beating the night's winner |
| Robbed by the Scoreboard | Winning far more points than games |
| Ice in the Veins | Winning games that went to deuce |
| On Fire | The longest winning streak (3 or more) |
| The Finisher | The biggest share of their side's points personally (needs tap-to-credit scoring) |
| Points Machine | The most points scored |
| The Wall | The fewest points conceded per game |
| The Pendulum | Alternating wins and losses all night |
| Strong Finisher | A much better second half of the night |
| Out of the Blocks | A much better first half of the night |
| The Metronome | The steadiest margins |
| The Rollercoaster | The wildest swings between big wins and big losses |
| Iron Lungs | The most total points played |
| The Social Butterfly / The Grafter | Fallbacks when nothing else fits |

## Using it at the court

1. Open the site on the phone you'll score with. Use **Add to Home Screen** to get an app icon.
2. Under **Players**, tap **Edit players** to rename people, or add players up to 8.
3. Mark anyone who hasn't arrived as **Not here**.
4. Start the 2-hour clock, then score each game and tap **Finish**.
5. If the line-up on court is different from the plan, tap **Change line-up** and swap names. The games after it re-plan around the change.

**Reset session** clears the scores but keeps the player names.

## Your data

Scores are saved in the phone's browser storage (`localStorage`). Nothing is sent anywhere, and nothing is stored in this repository.

- Each phone and browser has its own copy.
- Clearing browser data, or using a private window, loses it.
- To keep a night's results, use **Session → Copy session** and paste the text somewhere safe. **Paste a session** loads it back.

## Hosting on GitHub Pages

1. Push this folder to a GitHub repository. Free GitHub Pages needs the repository to be public.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. After a minute or two the site is live at `https://<username>.github.io/<repository>/`.

Every push to `main` redeploys the site.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: layout, styles and code |
| `sw.js` | Offline support (service worker) |
| `manifest.webmanifest` | App name, colours and icons for Add to Home Screen |
| `icons/` | App icons |
| `docs/` | Screenshots for this README |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

To change the names a new phone starts with, edit `DEFAULT_NAMES` in the script in `index.html`. After you push a change, phones pick it up the next time they open the site with a signal.
