// A very simple player used by the tests and `npm run sim`: plays whatever it can afford,
// thwarts when the main scheme is getting full, otherwise attacks, and answers every question
// with the first sensible option. It is not a good player — it's there to shake out rule bugs.
import { allies, attackTargets, canAct, playProblem, thwartTargets, threshold, type Game, type Intent } from './engine'

export function autoIntent(g: Game): Intent | null {
	const q = g.queue[0]
	if (q) {
		const p = q.who
		switch (q.kind) {
			case 'mulligan':
				return { t: 'mulligan', player: p, cards: [] }
			case 'target':
			case 'searchPick':
				return { t: 'answer', player: p, value: q.options[0] ?? null }
			case 'defend':
				return { t: 'answer', player: p, value: q.options[0] ?? null }
			case 'choose':
			case 'window':
				return { t: 'answer', player: p, value: 0 }
			case 'allyLimit': {
				const a = Object.values(g.insts).find((x) => x.zone === 'play' && x.ctrl === p)
				return { t: 'answer', player: p, value: a?.uid ?? null }
			}
			default:
				return { t: 'answer', player: p, value: 1 }
		}
	}
	if (g.phase !== 'player') return null
	const p = g.active
	if (!canAct(g, p)) return null
	const pl = g.players[p]
	for (const u of pl.hand) if (!playProblem(g, p, u)) return { t: 'play', player: p, uid: u, pay: [] }
	const h = g.insts[pl.ident]
	if (!h.ex) {
		if (pl.form === 'alter' && !pl.flippedThisRound && h.dmg < 6) return { t: 'flip', player: p }
		if (pl.form === 'alter') return { t: 'basic', player: p, power: 'recover' }
		const main = g.insts[g.areas[pl.area].main]
		const th = thwartTargets(g, p)
		const at = attackTargets(g, p)
		if (th.length && (main.thr * 2 >= threshold(g, pl.area) || !at.length)) return { t: 'basic', player: p, power: 'thwart', target: th[0] }
		if (at.length) return { t: 'basic', player: p, power: 'attack', target: at[at.length - 1] }
	}
	const at = attackTargets(g, p)
	for (const a of allies(g, p)) if (!a.ex && a.dmg === 0 && at.length) return { t: 'ally', player: p, uid: a.uid, power: 'attack', target: at[at.length - 1] }
	return { t: 'endTurn', player: p }
}
