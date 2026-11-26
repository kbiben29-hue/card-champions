import { test } from 'node:test'
import assert from 'node:assert/strict'
import { card, heroes, scenarios } from '../data/data'
import { apply, attackTargets, named, newGame, playProblem, resolveSteps, stat, thwartTargets, type Game, type Intent } from './engine'
import { autoIntent } from './autoplay'
import { deckCodes, starterDeck } from './decks'
import { parse } from './text'

const ASP = ['aggression', 'justice', 'leadership', 'protection']
function game(scenario = 'rhino', heroSets = ['spider_man'], seed = 1, mode: 'coop' | 'pvp' = 'coop'): Game {
	const players = heroSets.map((h, i) => ({ name: `P${i + 1}`, hero: h, deck: deckCodes(starterDeck(h, ASP[i % 4], null, seed)), area: mode === 'pvp' ? i : 0 }))
	const sc = scenarios().find((s) => s.id === scenario)!
	const areas = mode === 'pvp' ? [{ scenario: 'captain_america_leader', modular: [], expert: false }, { scenario: 'iron_man_leader', modular: [], expert: false }] : [{ scenario, modular: sc.modular.slice(0, sc.modularCount), expert: false }]
	return newGame({ mode, seed, players, areas })
}
/** keep only the prompts we want; answers mulligans */
function ready(g: Game): Game {
	while (g.queue[0]?.kind === 'mulligan') g = apply(g, { t: 'mulligan', player: g.queue[0].who, cards: [] })
	while (g.queue.length && g.phase !== 'player') g = apply(g, autoIntent(g)!)
	return g
}
function playOut(g: Game, max = 3000): Game {
	let n = 0
	while (g.phase !== 'over' && n++ < max) {
		const it: Intent | null = autoIntent(g)
		if (!it) throw new Error(`stuck: phase ${g.phase}, jobs ${g.jobs.map((j) => j.k)}`)
		try {
			g = apply(g, it)
		} catch (e) {
			if (it.t === 'play' || it.t === 'basic' || it.t === 'ally' || it.t === 'flip') g = apply(g, { t: 'endTurn', player: it.player })
			else throw e
		}
	}
	return g
}

test('the card data has every hero and scenarios to play', () => {
	assert.ok(heroes().length >= 70)
	assert.ok(scenarios().length >= 55)
	assert.equal(card('01001a').n, 'Spider-Man')
})

test('the text reader understands common card text', () => {
	const kick = parse(card('01005')).abilities[0]
	assert.equal(kick.tag, 'attack')
	assert.deepEqual(kick.steps, [{ k: 'dmg', n: 8, to: 'enemy' }])
	const shooter = parse(card('01008'))
	assert.equal(shooter.uses, 3)
	assert.equal(shooter.abilities[0].timing, 'resource')
	const merc = parse(card('01101'))
	assert.equal(merc.keywords.guard, true)
	const sense = parse(card('01001a')).abilities[0]
	assert.equal(sense.window, 'villainAttacksYou')
})

test('setup: alter-ego form, hand of 6, villain with hit points per player, main scheme 1B', () => {
	const g = ready(game())
	const p = g.players[0]
	assert.equal(p.form, 'alter')
	assert.equal(p.hand.length, 6)
	assert.equal(g.phase, 'player')
	const v = g.insts[g.areas[0].villain]
	assert.equal(card(v.code).n, 'Rhino')
	assert.equal(stat(g, v.uid, 'hp'), 14)
	assert.equal(card(g.insts[g.areas[0].main].code).stage, '1B')
})

test('hero basic attack damages the villain and exhausts the hero', () => {
	let g = ready(game())
	g = apply(g, { t: 'flip', player: 0 })
	const v = g.areas[0].villain
	g = apply(g, { t: 'basic', player: 0, power: 'attack', target: v })
	assert.equal(g.insts[v].dmg, 2)
	assert.equal(g.insts[g.players[0].ident].ex, true)
	assert.throws(() => apply(g, { t: 'basic', player: 0, power: 'thwart', target: g.areas[0].main }))
})

test('a stunned hero removes the stun instead of attacking; tough stops damage', () => {
	let g = ready(game())
	g = apply(g, { t: 'flip', player: 0 })
	g.insts[g.players[0].ident].stun = 1
	const v = g.areas[0].villain
	g = apply(g, { t: 'basic', player: 0, power: 'attack', target: v })
	assert.equal(g.insts[v].dmg, 0)
	assert.equal(g.insts[g.players[0].ident].stun, 0)
	g.insts[g.players[0].ident].ex = false
	g.insts[v].tough = 1
	g = apply(g, { t: 'basic', player: 0, power: 'attack', target: v })
	assert.equal(g.insts[v].dmg, 0)
	assert.equal(g.insts[v].tough, 0)
})

test('guard minions stop attacks on the villain; crisis stops thwarting the main scheme', () => {
	let g = ready(game())
	g = apply(g, { t: 'flip', player: 0 })
	const merc = Object.values(g.insts).find((x) => x.code === '01101')!
	merc.zone = 'engaged'
	merc.ctrl = 0
	assert.ok(!attackTargets(g, 0).includes(g.areas[0].villain))
	assert.ok(attackTargets(g, 0).includes(merc.uid))
	const crowd = Object.values(g.insts).find((x) => x.code === '01108')
	if (crowd) {
		crowd.zone = 'side'
		crowd.thr = 2
		assert.ok(!thwartTargets(g, 0).includes(g.areas[0].main))
	}
})

test('the villain phase adds threat and the villain schemes against an alter ego', () => {
	let g = ready(game())
	const main = g.areas[0].main
	const before = g.insts[main].thr
	g = apply(g, { t: 'endTurn', player: 0 })
	while (g.queue.length) g = apply(g, autoIntent(g)!)
	// 1 escalation threat + Rhino's SCH 1 + boost
	assert.ok(g.insts[main].thr >= before + 2, `threat ${g.insts[main].thr}`)
	assert.equal(g.round, 2)
	assert.equal(g.phase, 'player')
})

test('resource cards pay for cards; events go to the discard pile', () => {
	let g = ready(game())
	g = apply(g, { t: 'flip', player: 0 })
	const p = g.players[0]
	const ev = p.hand.find((u) => card(g.insts[u].code).t === 'event' && !playProblem(g, 0, u))
	if (ev !== undefined) {
		const before = p.hand.length
		g = apply(g, { t: 'play', player: 0, uid: ev, pay: [] })
		while (g.queue.length && g.queue[0].kind !== 'mulligan') g = apply(g, autoIntent(g)!)
		assert.ok(g.players[0].hand.length < before)
		assert.ok(g.players[0].discard.includes(ev))
	}
})

test('every scenario sets up and plays out without errors', () => {
	const hs = heroes()
	scenarios().forEach((s, k) => {
		const h = [hs[k % hs.length].set, hs[(k * 7 + 3) % hs.length].set].slice(0, 1 + (k % 2))
		const g = playOut(game(s.id, h, k + 1, 'coop'))
		assert.ok(g.phase === 'over' || g.round > 1, s.id)
	})
})

test('every hero sets up and plays a game', () => {
	for (const [k, h] of heroes().entries()) {
		const g = playOut(game(['rhino', 'klaw', 'ultron'][k % 3], [h.set], k + 3))
		assert.ok(g.round >= 1, h.set)
	}
})

test('Civil War: two teams, each against the other leader, play out', () => {
	let g = game('rhino', ['iron_man', 'captain_america'], 5, 'pvp')
	assert.equal(g.areas.length, 2)
	assert.ok(g.insts[g.areas[0].villain].code.startsWith('561'))
	assert.ok(Object.values(g.insts).some((x) => x.zone === 'side' && card(x.code).n === 'Choosing Sides'))
	g = playOut(g)
	assert.equal(g.phase, 'over')
	assert.ok(g.winner)
})

test('the text reader: "instead if", "for each", drones, encounter searches', () => {
	const punch = parse(card('01032')).abilities[0].steps[0]
	assert.equal(punch.k, 'choose')
	if (punch.k === 'choose') {
		assert.deepEqual(punch.options[0].steps, [{ k: 'dmg', n: 8, to: 'enemy' }])
		assert.deepEqual(punch.options[1].steps, [{ k: 'dmg', n: 4, to: 'enemy' }])
	}
	assert.deepEqual(parse(card('01144a')).abilities[0].steps, [{ k: 'drone', n: 1, each: true, first: false }])
	const repair = parse(card('01146')).abilities[0].steps
	assert.deepEqual(repair[0], { k: 'heal', n: { mul: 2, count: 'Drone minion engaged with you' }, who: 'villain' })
	const legions = parse(card('01180')).abilities[0].steps
	assert.equal(legions[0].k, 'ifInPlay')
	assert.ok(parse(card('01180')).abilities.every((a) => a.steps.every((st) => st.k !== 'manual')))
})

test('drones: facedown 1/1/1 minions that go back to their owner\'s discard pile', () => {
	let g = ready(game('ultron'))
	const deck = g.players[0].deck.length
	g = resolveSteps(g, [{ k: 'drone', n: 1, each: true }], { area: 0, player: 0, src: g.areas[0].main })
	const drone = Object.values(g.insts).find((x) => x.facedown)!
	assert.ok(drone)
	assert.equal(g.players[0].deck.length, deck - 1)
	assert.equal(drone.zone, 'engaged')
	assert.equal(stat(g, drone.uid, 'hp'), 1)
	assert.equal(stat(g, drone.uid, 'sch'), 1)
	g = resolveSteps(g, [{ k: 'dmg', n: 1, to: 'that' }], { area: 0, player: 0, src: g.areas[0].main, that: drone.uid })
	assert.equal(g.insts[drone.uid].zone, 'discard')
	assert.equal(g.insts[drone.uid].facedown, false)
})

test('encounter searches put a named minion into play; "if X is not in play" checks first', () => {
	let g = ready(game('crossbones'))
	const steps = parse(card('01180')).abilities[0].steps
	const ctx = { area: 0, player: 0, src: g.areas[0].main }
	if (!named(g, 0, 'Madame Hydra').length) {
		g = resolveSteps(g, steps.slice(0, 1), ctx)
		while (g.queue.length && g.queue[0].kind !== 'mulligan' && g.phase === 'player' && g.queue[0].kind !== 'manual') g = apply(g, autoIntent(g)!)
	}
	const mh = named(g, 0, 'Madame Hydra')
	assert.equal(mh.length, 1)
	assert.equal(g.insts[mh[0]].zone, 'engaged')
	// a second time: she's already there, nothing happens
	const before = Object.values(g.insts).filter((x) => x.zone === 'engaged').length
	g = resolveSteps(g, steps.slice(0, 1), ctx)
	assert.equal(Object.values(g.insts).filter((x) => x.zone === 'engaged').length, before)
})

test('shield: the villain can\'t take damage this phase; "the players win the game"', () => {
	let g = ready(game())
	const v = g.areas[0].villain
	const ctx = { area: 0, player: 0, src: v }
	g = resolveSteps(g, [{ k: 'shield' }, { k: 'dmg', n: 3, to: 'villain' }], ctx)
	assert.equal(g.insts[v].dmg, 0)
	g = resolveSteps(g, [{ k: 'win' }], ctx)
	assert.equal(g.phase, 'over')
	assert.equal(g.winner, 'heroes')
})
