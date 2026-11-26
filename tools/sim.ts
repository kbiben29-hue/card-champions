// npm run sim -- 50   → plays games with the simple autoplayer and prints results per scenario.
import { heroes, scenarios } from '../src/data/data'
import { apply, newGame, type Game } from '../src/engine/engine'
import { autoIntent } from '../src/engine/autoplay'
import { deckCodes, starterDeck } from '../src/engine/decks'

const n = Number(process.argv[2] ?? 30)
const ASP = ['aggression', 'justice', 'leadership', 'protection']
let wins = 0
let manual = 0
const why = new Map<string, number>()
for (let k = 0; k < n; k++) {
	const s = scenarios()[k % scenarios().length]
	const h = heroes()[(k * 5) % heroes().length]
	let g: Game = newGame({ mode: 'coop', seed: k + 1, players: [{ name: 'P1', hero: h.set, deck: deckCodes(starterDeck(h.set, ASP[k % 4], null, k)) }], areas: [{ scenario: s.id, modular: s.modular.slice(0, s.modularCount), expert: false }] })
	let steps = 0
	while (g.phase !== 'over' && steps++ < 3000) {
		const it = autoIntent(g)!
		const q = g.queue[0] as { kind: string; text?: string; card?: number } | undefined
		if (q?.kind === 'manual') {
			manual++
			const key = `${q.card !== undefined ? g.insts[q.card]?.code + ' ' + g.insts[q.card] && '' : ''}${((q as { lines?: string[] }).lines ?? [q.text ?? '']).join(' / ').slice(0, 150)}`
			why.set(key, (why.get(key) ?? 0) + 1)
		}
		try {
			g = apply(g, it)
		} catch {
			g = apply(g, { t: 'endTurn', player: it.player })
		}
	}
	if (g.winner === 'heroes') wins++
	console.log(`${s.id.padEnd(24)} ${h.name.padEnd(18)} ${g.winner ?? 'unfinished'} in round ${g.round}`)
}
if (process.argv.includes('--why')) for (const [k, v] of [...why].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(String(v).padStart(4), k)
console.log(`${wins}/${n} won · ${manual} manual prompts`)
