# CLAUDE.md

Card Champions is an unofficial browser table for **Marvel Champions: The Card Game** (Fantasy Flight Games).
Sibling of Argaia (kbiben29-hue/Argaia), Earthborne Rangers, Afterlife and Holodeck; same tooling
(Vite + React + TypeScript, Pages + Tauri release workflow). Kris plays on iPhone and iPad.

Layouts (Kris's request): **solo / team-up = the Earthborne Rangers table** (villain and schemes across the
top, your minions, your hero mat, fanned hand; drag cards from hand; tray prompts), **hero vs hero (Civil War
competitive) = the Argaia console** (table left, side column with status / prompt / viewer / log on the right,
other team's area across the top).

## Commands

```bash
npm run dev     # Vite app on :5173
npm test        # tsx --test src/**/*.test.ts (node:test)
npm run sim -- 50  # autoplayer games over every scenario; prints results and manual-prompt count
npm run build   # vite build (base './')
npm run data -- /path/to/marvelsdb-json-data   # rebuild src/data/cards.json + meta.json
```

## Layout

- `src/data/cards.json`, `meta.json` — compact MarvelCDB card data (all packs), built by
  `scripts/build-data.mjs` from github.com/zzorba/marvelsdb-json-data; `.github/workflows/update-cards.yml`
  refreshes it every Monday. Reprints (`duplicate_of`) carry the original's fields and picture (`img`).
- `src/data/data.ts` — typed access; `heroes()` (identity sides, kit, obligation, nemesis set),
  `scenarios()` read from each main scheme 1A's Contents text (villain stages for standard/expert, scheme
  deck, story sets, recommended modular sets) plus the Civil War / Synthezoid Smackdown leaders (with their
  Registration/Resistance scheme decks). Pictures: `https://marvelcdb.com/bundles/cards/<code>.png|jpg`.
  MarvelCDB lacks ~400 pictures (many villain/scheme a/b sides): `scripts/check-images.mjs` (weekly, in
  update-cards.yml) writes `src/data/images.json` {missing, jpg}; `imageUrls()` asks for the right file first,
  `CardImg` retries twice on errors, missing ones get a comic-styled `TextCard`, and menus use
  `pictureOf()` / `scenarioPicture()` to pick a card from the set that has a picture. Second source:
  `scripts/fetch-missing-images.mjs` downloads missing ones into `public/cards/<code>.jpg` (served by the game,
  listed in images.json → local) from FFG's CDN (`lcgcdn.s3.amazonaws.com/mc/MC<product>en_<n><side>.jpg`, old
  packs; prefix → product map `FFG`) and Hall of Heroes pack pages (scans named by code; slug map `HOH`), shrunk
  to 560px. ~160 still have none (Mad Titan's Shadow a/b sides, Age of Apocalypse, Elektra, Iron Fist…).
- `src/engine/text.ts` — reads card text: keywords (Guard, Toughness, Retaliate 2, Incite 1, Uses (3)…),
  constant modifiers ("Your hero gets +1 ATK"), "Attach to …", and abilities (`timing`, Hero/Alter-Ego form,
  `(attack)` tag, trigger + `window`, costs before "→", limits) whose effect sentences become `Step`s.
  Conditions "(5 instead if …)", "If X, Y", "You may X" become a quick yes/no `choose`. Anything unread
  becomes a `manual` step (shown with the table tools). `manualCount()` / `/tmp`-style coverage scripts: see
  `npm run sim` output ("manual prompts").
- `src/engine/engine.ts` — the rules, pure: `newGame(setup)`, `apply(game, intent)` (structuredClone, never
  mutates). Jobs stack (`g.jobs`: steps, villainPhase, activate, reveal, endRound) run by `run()` until a
  `Prompt` is queued (`g.queue`: mulligan, target, choose, defend, window, manual, searchPick, allyLimit).
  Round: player phase (each player's turn; `endTurn` with optional discards) → end of player phase draw up +
  ready → villain phase (threat + acceleration, villain then minions activate per player with boost cards,
  deal 1 + hazard encounter cards, reveal in order) → end of round (Temporary, first player).
  Competitive (`mode: 'pvp'`): area 0 = Registration team (faces the Resistance leader), area 1 =
  Resistance; round = Registration player phase, Resistance player phase, both villain phases. Choosing
  Sides is revealed at setup; co-op leader games reveal the leader's side scheme.
  Trigger windows (`openWindow`): villainAttacksYou (free identity interrupts like Spider-Sense resolve by
  themselves), attackDamage (Backflip-style prevention), treachery (cancel When Revealed), threatPlaced.
  Armour attachments ("place it here instead … at least N damage") are handled in `damage()`.
  Table tools (`tool` intent) fix anything by hand.
- `src/engine/decks.ts` — starter decks (hero kit + aspect + basic, 40 cards from owned packs),
  MarvelCDB import (`fromMarvelCdb`, public API `/api/public/decklist|deck/<id>`).
- `src/engine/autoplay.ts` — a simple autoplayer for tests and `npm run sim` (not an opponent).
- New-game wizard (`Screens.tsx`): 1 How to play (solo · two-handed solo · co-op on one device or online ·
  1 v 1 on one device or online; "New to Marvel Champions?" rules) → 2 Decks (seat tabs; every official
  precon `PRECONS`/`preconDeck()` as a gallery with aspect/owned filters, or upload a MarvelCDB link) →
  3 Villain (grid of every expansion → its scenarios, or search; 1 v 1: the two leaders) → 4 Ready
  (Standard/Expert, modular sets). Collection (📦) dims unowned packs. Online co-op: host + 1 friend in area 0.
- Precons: `src/data/precons.json` (built by `scripts/build-data.mjs`): each hero box prints its 40-card deck
  as one numbered run after the hero (stops at a gap or the next hero; hero-special decks left out); the
  core set's five come from MarvelCDB's starter decklists 1–5 (`data/core-precons.json`).
- Rules in context (`src/ui/rules.ts`, our own wording after the Rules Reference): `RULES` glossary (the 📖
  Rules panel, searchable), `rulesForText()` (rules for keywords on the card in the viewer),
  `ruleForPrompt()` (📖 note on prompts), `tipForLog()` (one-time tips the first time something happens;
  "No more tips" → localStorage `champions.tips`).
- Look: comic lettering — Bangers for titles and every button (black-outlined caption boxes with hard
  shadows), POW starburst (`clip-path`) for each screen's main action (`button.primary`), Comic Neue text.
- Solo / team-up / phones / upright screens use the **tabletop** (`.board.tabletop`, like Earthborne Rangers,
  Kris's favourite layout): a normal responsive page (no scaled stage; `--cw` card width from the screen),
  villain + schemes + piles at the top, an inked dashed "Engaged with …" zone, your mat (name chip, HP/THW/
  ATK/DEF stat chips, identity, in-play reach, piles), and the hand docked at the bottom with action pills
  (`.handbar`); prompts float bottom-right above it. Cards sit at small random tilts. The scaled
  comic-page grid below is only the 1 v 1 console on iPads/computers held sideways.
- Menus show hero portraits cropped from card art (`Face` in `Screens.tsx`), no emoji.
- The comic page (`.felt.page` CSS grid of `.cpanel` sections on white paper gutters, each with a
  `Caption` box, flat colour + Ben-Day halftone dots; the villain is the splash panel with speed lines):
  villain · scheme · encounter / minions (· team) / hero · in play · your deck / hand. Landscape grid,
  `.pocket` (phones sideways: villain row, your row, hand) and `.portrait` (upright: two columns, stacked).
  The hand fans with CSS container units so every card fits (`--n`, `--cw`).
- Screen sizes (`App.tsx useFit`): upright screens (`portrait`) get a 1080-wide stage (640 on phones); phones (coarse pointer, short side < 600) get a 960-wide stage and the
  `.pocket` CSS (compact cards, full-screen viewer/log sheets, 1 v 1 uses the table + enemy strip instead of
  the console); tablets/computers get 1440 wide, `.tall` bigger cards when the stage is ≥ 960 high (iPad).
  The stage sits inside the safe area (notch / home bar).
- `src/ui/` — `Board.tsx` (both layouts, drag & drop with window-level pointer listeners — `onDown`/`drop`,
  landing animation `SlamFx` (cracks, dust, WHAM, table shake) for any card that newly lands on the table, tap → `Viewer` with actions and
  table tools, `PromptBox`, `Reference` rules card, log), `Screens.tsx` (home, new game: heroes, aspects,
  deck import, collection, villain + modular + expert, Civil War leaders, join), `Card.tsx` (pictures with
  fallback text cards, rules text with icons), `styles.css`.
- `src/App.tsx` — 1440-wide stage scaled to fit (height follows the screen's shape: 800–1080), autosave
  (`champions.save.v1`), undo, hot-seat hand-off cover between competitive teams, online host/guest.
- `src/net/` — PeerJS online play copied from Argaia (`champions-<code>` peer ids; `?net=local` for tabs).

## Hard rules

- **Engine determinism**: no `Math.random`, `Date.now` or `new Date` in `src/engine/**`; use `g.rng`.
- **The engine is DOM-free**: no imports from `src/ui`.
- **Rules source**: the Marvel Champions Rules Reference (+ Civil War rulebook for competitive mode). Card text overrides rules.
- Every rules change gets a test in `src/engine/*.test.ts`; run `npm test` before committing.

## Next steps

0. Card text automation in progress (goal agreed with Kris: 75%): read so far ~55% of player abilities, ~51% of
   encounter abilities (~53% overall); measure with a coverage script over `CARDS` × `parse()` counting
   abilities with no `manual` step; `npm run sim -- 120 --why` lists the unread text players actually hit, most first.
   "When X attacks" abilities now run as steps during the activation (`attackPlus`, choices, discard after
   attack); "Special" abilities (with their italic labels, e.g. The Hood's Foul Play) resolve via `special`;
   coloured costs inside choices via `spendRes`. Also: `fallback()` in text.ts (tidy qualifiers, split "A and
   B", "each player …s", "the player who defeated …"), `cardFilter()` for deck searches, `deckUntil`, `later`
   ("at the end of the phase/round"), `branch` (resource / form / pick-a-row lists), `fdBoost` (facedown
   boost cards for the next activation), `{expr}` numbers ("equal to your ATK", "where X is …"). Engine steps added: encounter searches (`encSearch`), drones (facedown 1/1/1
   minions), "if X is (not) in play", "(N instead if …)" yes/no, "for each …" counts (`countOf`),
   look-at-top-N, counters on named cards, shield, win… Next: the long tail from the coverage script
   (scenario-specific: Kang, Hood, Loki, Mojo, missions; resource-colour conditions).
1. More card text read automatically (sim reports manual prompts): "for each …", "deal damage equal to",
   "it gets +N DEF for that defense", player-side "Search the encounter deck …", resource-colour conditions
   (track which resources paid), hero alt forms (Ant-Man/Wasp giant/tiny, Ironheart upgrades, SP//dr),
   hero special decks (Invocation, Weather, Labor/Gift, Sense, Ninja).
2. Scenario special rules: multi-villain scenarios (Wrecking Crew, Sinister Six, Mansion Attack, Horsemen,
   Tower Defense), Kang, Fear No Evil underlings (not listed yet), campaign modes.
3. Competitive mode: "the enemy team chooses" searches (now automatic/manual), leader basic cards from
   Choosing Sides / Now It's Personal, the equal-phases tie rule, 2v2 teams.
4. Tutorial / coach like Holodeck and Argaia; card motion like Earthborne's `motion.ts`.
