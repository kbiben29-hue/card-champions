# Card Champions

An unofficial browser table for **Marvel Champions: The Card Game** — solo, team-up (2–4 heroes on one
device) and the Civil War **hero vs hero** competitive mode (one device or online with a friend).

**Play:** https://kbiben29-hue.github.io/card-champions/
(iPhone/iPad: open it in Safari → Share → Add to Home Screen.)

- Every hero, villain, scenario, modular set and pack that MarvelCDB lists is in the game. The card data
  comes from MarvelCDB's public card data (github.com/zzorba/marvelsdb-json-data) and is refreshed every
  Monday by a workflow; card pictures load from marvelcdb.com.
- Decks: a starter deck for any hero + aspect from the packs you own (set once under *My collection*), or
  import any public MarvelCDB deck by its link.
- The game runs the rounds for you: villain phase threat, villain and minion activations with boost cards,
  defending, encounter cards, surge, guard/patrol/crisis, tough/stun/confused, stage changes and the end of
  the game. Card text the game can't read yet shows up as a short "do this by hand" step with table tools.

Solo and team-up use the table layout (like Earthborne Rangers / Holodeck); hero vs hero uses the console
layout with the other team across the top (like Argaia).

## Run it on your Mac

Double-click **Start Card Champions.command** (needs Node.js), or:

```bash
npm install
npm run dev
```

Fan project. Not affiliated with Fantasy Flight Games or Marvel.
