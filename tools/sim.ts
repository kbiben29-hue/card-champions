// npm run sim -- 50   → plays games with the simple autoplayer and prints results per scenario.
import { heroes, scenarios } from '../src/data/data'
import { apply, newGame, type Game } from '../src/engine/engine'
import { autoIntent } from '../src/engine/autoplay'
import { deckCodes, starterDeck } from '../src/engine/decks'

const n = Number(process.argv[2] ?? 30)
const ASP = ['aggression', 'justice', 'leadership', 'protection']
let wins = 0
let manual = 0
for (let k = 0; k < n; k++) {
	const s = scenarios()[k % scenarios().length]
	const h = heroes()[(k * 5) % heroes().length]
	let g: Game = newGame({ mode: 'coop', seed: k + 1, players: [{ name: 'P1', hero: h.set, deck: deckCodes(starterDeck(h.set, ASP[k % 4], null, k)) }], areas: [{ scenario: s.id, modular: s.modular.slice(0, s.modularCount), expert: false }] })
	let steps = 0
	while (g.phase !== 'over' && steps++ < 3000) {
		const it = autoIntent(g)!
		if (g.queue[0]?.kind === 'manual') manual++
		try {
			g = apply(g, it)
		} catch {
			g = apply(g, { t: 'endTurn', player: it.player })
		}
	}
	if (g.winner === 'heroes') wins++
	console.log(`${s.id.padEnd(24)} ${h.name.padEnd(18)} ${g.winner ?? 'unfinished'} in round ${g.round}`)
}
console.log(`${wins}/${n} won · ${manual} manual prompts`)
