// The rules of Marvel Champions: The Card Game (Rules Reference), as a pure state machine.
//   newGame(setup) → Game;  apply(game, intent) → new Game (never mutates the input).
// Effects run as jobs in g.jobs (a stack); a job that needs a decision pushes a Prompt to g.queue
// and stops. Answering the prompt (intent 'answer') resumes the job.
import { card, CARDS, has, heroes, scenarioById, setCards, type CardData } from '../data/data'
import { effect, NAMES, parse, type Ability, type Step, type Who, type Window } from './text'
import type { Area, Ctx, Game, Inst, Intent, Job, Player, Prompt, Zone } from './types'

export * from './types'

// ───────── names for the text reader ─────────
for (const c of CARDS) {
	if (c.t === 'villain' || c.t === 'leader') NAMES.villains.add(c.n.toLowerCase())
	if (c.t === 'hero' || c.t === 'alter_ego') NAMES.identities.add(c.n.toLowerCase())
	if (c.n.length > 3) NAMES.cards.add(c.n.toLowerCase())
}

// ───────── random numbers (deterministic) ─────────
function rand(g: Game): number {
	let t = (g.rng = (g.rng + 0x6d2b79f5) | 0)
	t = Math.imul(t ^ (t >>> 15), t | 1)
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function shuffle<T>(g: Game, a: T[]): T[] {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand(g) * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

// ───────── helpers ─────────
export const I = (g: Game, uid: number): Inst => {
	const i = g.insts[uid]
	if (!i) throw new Error(`no card ${uid}`)
	return i
}
export const C = (g: Game, uid: number): CardData => card(I(g, uid).code)
export const P = (g: Game, uid: number) => parse(C(g, uid), altName(g, uid))
const altName = (g: Game, uid: number) => {
	const i = g.insts[uid]
	if (!i || i.owner < 0) return undefined
	const p = g.players[i.owner]
	return p ? card(p.alter).n : undefined
}
export const nameOf = (g: Game, uid: number) => C(g, uid).n
const log = (g: Game, t: string, p?: number) => {
	g.log.push({ t, p })
	if (g.log.length > 300) g.log.splice(0, g.log.length - 300)
}
const perHero = (g: Game, area: number) => g.areas[area].players.filter((p) => !g.players[p].out).length || 1
type NumV = number | 'X' | { per: number } | { mul: number; count: string } | { expr: string; mul?: number }
const nval = (g: Game, n: NumV, area: number, x = 0, p = -1, src = -1, that?: number): number =>
	typeof n === 'number'
		? n
		: n === 'X'
			? x
			: 'per' in n
				? n.per * perHero(g, area)
				: 'expr' in n
					? (n.mul ?? 1) * evalExpr(g, area, p, src, that, n.expr)
					: n.mul * countOf(g, area, p, n.count, src)

/** "your hero's ATK", "that card's printed cost", "the number of boost icons on that card", "the amount of threat on Bomb Scare" */
export function evalExpr(g: Game, area: number, p: number, src: number, that: number | undefined, expr: string): number {
	let e = expr.toLowerCase().replace(/\s*\(\[\w+\]\)/g, '').replace(/\.$/, '').trim()
	let mul = 1
	if (e.startsWith('double ')) {
		mul = 2
		e = e.slice(7)
	}
	if (e.startsWith('half ')) e = e.slice(5)
	const pl = p >= 0 ? g.players[p] : undefined
	const ident = pl?.ident
	const statOf = (u: number | undefined, st: string) => (u !== undefined && g.insts[u] ? stat(g, u, st as 'atk') : 0)
	let m: RegExpMatchArray | null
	const r = ((): number => {
		if ((m = e.match(/^(?:your|your hero's|your identity's|your alter-ego's) (atk|thw|def|rec)(?: for that attack)?$/))) return statOf(ident, m[1])
		if ((m = e.match(/^(?:that|the attacking|the defending|the chosen|the attacked) (?:enemy|minion|character|ally|villain)'s (atk|thw|def|sch|rec)$/))) return statOf(that, m[1])
		if ((m = e.match(/^(?:the )?(?:printed )?(?:resource )?cost of (?:that|the discarded|this) card$/)) || (m = e.match(/^(?:that|its|the discarded|this) (?:card|event|ally|upgrade|support|minion)?'?s? ?(?:printed )?(?:resource )?cost$/)))
			return that !== undefined && g.insts[that] ? (C(g, that).cost ?? 0) : 0
		if (/^the number of boost icons (?:on (?:that|the discarded|this) card|discarded this way)$/.test(e)) return that !== undefined && g.insts[that] ? (C(g, that).boost ?? 0) : 0
		if (/^the number of (?:printed )?resources on (?:it|that card|the discarded card)$/.test(e)) return that !== undefined && g.insts[that] ? resourcesOf(g, that).length : 0
		if (/^the number of cards in your hand$/.test(e)) return pl?.hand.length ?? 0
		if (/^the (?:amount|number) of damage (?:on|dealt to) your (?:hero|identity)$/.test(e) || /^the amount of damage you have sustained$/.test(e)) return ident !== undefined ? g.insts[ident].dmg : 0
		if ((m = e.match(/^the (?:amount|number) of threat on (.+)$/))) {
			const t = m[1].replace(/^the /, '')
			const us = /^(this scheme|this card|here|it)$/.test(t) ? [src] : t === 'main scheme' ? [g.areas[area].main] : named(g, area, t)
			return us.reduce((a, u) => a + (g.insts[u]?.thr ?? 0), 0)
		}
		if ((m = e.match(/^(.+?)'s? (atk|thw|def|sch)$/))) {
			const t = m[1].replace(/^the /, '')
			const us = t === 'villain' ? [g.areas[area].villain] : named(g, area, t)
			return statOf(us[0], m[2])
		}
		if ((m = e.match(/^the number of (.+)$/))) return countOf(g, area, p, m[1].replace(/ in play$/, ''), src)
		if (e === "the villain's stage number") return countOf(g, area, p, 'villain stage', src)
		return 0
	})()
	return r * mul
}

/** "for each Drone minion engaged with you", "for each upgrade you control", "for each Hydra enemy in play"… */
export function countOf(g: Game, area: number, p: number, what: string, src = -1): number {
	const w = what.toLowerCase().replace(/^(a|an) /, '')
	if (w === 'villain stage') return ({ I: 1, II: 2, III: 3, IV: 4 } as Record<string, number>)[String(card(I(g, g.areas[area].villain).code).stage ?? 'I').replace(/[AB]$/, '')] ?? (Number.parseInt(String(card(I(g, g.areas[area].villain).code).stage)) || 1)
	const cm = w.match(/^(?:\w+ )?counters? (?:on|here)\s*(.*)$/)
	if (cm) {
		const t = cm[1].replace(/^the /, '')
		const host = !t || /^(him|her|it|this card|here)$/.test(t) ? [src] : named(g, area, t)
		return host.reduce((a, u) => a + (g.insts[u]?.ctr ?? 0), 0)
	}
	if (/^boost icons? on (?:the discarded card|that card)$/.test(w)) return 0
	const mine = /engaged with you|you control|in your/i.test(w)
	const m = w.match(/^(?:(.+?) )?(minion|enemy|enemies|villain|ally|allies|upgrade|support|character|side scheme|scheme|player|hero|card)s?\b/)
	if (!m) return 0
	const trait = m[1]?.replace(/^(different|other|facedown)\s*/, '')
	const kind = m[2]
	let list = Object.values(g.insts).filter((x) => x.area === area && IN_PLAY.includes(x.zone))
	if (kind === 'player' || kind === 'hero') return g.areas[area].players.filter((q) => !g.players[q].out).length
	if (kind === 'minion') list = list.filter((x) => x.zone === 'engaged')
	if (kind === 'enemy' || kind === 'enemies') list = list.filter((x) => x.zone === 'engaged' || x.zone === 'villain')
	if (kind === 'ally' || kind === 'allies') list = list.filter((x) => x.zone === 'play' && card(x.code).t === 'ally')
	if (kind === 'upgrade' || kind === 'support') list = list.filter((x) => x.zone === 'play' && card(x.code).t === kind)
	if (kind === 'side scheme') list = list.filter((x) => x.zone === 'side')
	if (kind === 'scheme') list = list.filter((x) => x.zone === 'side' || x.zone === 'main')
	if (mine) list = list.filter((x) => x.ctrl === p)
	if (trait) list = list.filter((x) => (trait === 'drone' && x.facedown) || (card(x.code).tr ?? '').toLowerCase().includes(trait) || card(x.code).n.toLowerCase() === trait)
	return list.length
}

function make(g: Game, code: string, owner: number, area: number, zone: Zone): number {
	const uid = g.next++
	g.insts[uid] = { uid, code, owner, ctrl: owner, area, zone, dmg: 0, thr: 0, ctr: 0, ex: false, stun: 0, conf: 0, tough: 0 }
	return uid
}

export const inZone = (g: Game, area: number, zone: Zone) => Object.values(g.insts).filter((i) => i.area === area && i.zone === zone)
export const attachments = (g: Game, host: number) => Object.values(g.insts).filter((i) => i.host === host && (i.zone === 'attached' || i.zone === 'play'))
export const engaged = (g: Game, p: number) => Object.values(g.insts).filter((i) => i.zone === 'engaged' && i.ctrl === p)
export const minions = (g: Game, area: number) => inZone(g, area, 'engaged')
export const sides = (g: Game, area: number) => inZone(g, area, 'side')
export const playArea = (g: Game, p: number) => Object.values(g.insts).filter((i) => i.zone === 'play' && i.ctrl === p && i.host === undefined)
export const allies = (g: Game, p: number) => playArea(g, p).filter((i) => card(i.code).t === 'ally')
export const kw = (g: Game, uid: number, k: string): number => {
	const v = P(g, uid).keywords[k]
	let n = v === undefined ? 0 : v === true ? 1 : v < 0 ? -v * perHero(g, I(g, uid).area) : v
	for (const a of attachments(g, uid)) {
		const t = (card(a.code).x ?? '').toLowerCase()
		const m = t.match(new RegExp(`(?:gains|has) ${k}(?: (\\d+))?`))
		if (m) n = Math.max(n, m[1] ? Number(m[1]) : 1)
	}
	return n
}

/** Printed stat plus modifiers from attached cards, upgrades and phase bonuses. */
export function stat(g: Game, uid: number, s: 'atk' | 'thw' | 'def' | 'sch' | 'rec' | 'hp' | 'hand'): number {
	const i = I(g, uid)
	if (i.facedown) {
		// a facedown Drone minion: 1 ATK, 1 SCH, 1 hit point (Ultron and his cards add to it)
		let n = s === 'atk' || s === 'sch' || s === 'hp' ? 1 : 0
		for (const x of [I(g, g.areas[i.area].villain), ...inZone(g, i.area, 'env'), ...inZone(g, i.area, 'attached')])
			if (/each (?:facedown )?drone minion gets \+1 atk and \+1 hit point/i.test((card(x.code).x ?? '').replace(/<[^>]+>/g, '')) && (s === 'atk' || s === 'hp')) n += 1
		return n + (i.bonus?.[s as 'atk'] ?? 0)
	}
	const c = card(i.code)
	let base = (c as unknown as Record<string, number | undefined>)[s] ?? 0
	if (s === 'hp' && has(c, 'hpH')) base *= perHero(g, i.area)
	if (s === 'hp' && i.zone === 'identity') {
		// hit points are shared by both sides: use the hero side's printed value
		const p = g.players[i.owner]
		base = card(p.hero).hp ?? base
	}
	let n = base + (i.bonus?.[s as 'atk'] ?? 0)
	for (const a of attachments(g, uid)) {
		for (const m of parse(card(a.code)).mods) if (m.stat === s && (m.who === 'attached' || m.who === 'villain')) n += m.n
		// encounter attachments print their modifier in the stat box: Charge "+3 ATK", Enhanced Ivory Horn "+1 ATK"
		const ac = card(a.code)
		if (ac.t === 'attachment' && (s === 'atk' || s === 'sch' || s === 'thw' || s === 'def') && typeof (ac as unknown as Record<string, unknown>)[s] === 'number') n += (ac as unknown as Record<string, number>)[s]
	}
	if (i.zone === 'identity') {
		for (const x of playArea(g, i.owner)) for (const m of parse(card(x.code)).mods) if (m.stat === s && m.who === 'hero') n += m.n
	}
	if (i.zone === 'villain') for (const a of [...inZone(g, i.area, 'env'), ...sides(g, i.area)]) for (const m of parse(card(a.code)).mods) if (m.stat === s && m.who === 'villain') n += m.n
	return Math.max(0, n)
}

const heroOf = (g: Game, p: number) => I(g, g.players[p].ident)
export const formCard = (g: Game, p: number) => card(g.players[p].form === 'hero' ? g.players[p].hero : g.players[p].alter)
export const handSize = (g: Game, p: number) => (formCard(g, p).hand ?? 5) + parse(formCard(g, p)).mods.filter((m) => m.stat === 'hand').reduce((a, m) => a + m.n, 0)
export const threshold = (g: Game, area: number) => {
	const m = I(g, g.areas[area].main)
	const c = card(m.code)
	return (c.thr ?? 0) * (has(c, 'thrF') ? 1 : perHero(g, area))
}
export const enemies = (g: Game, area: number) => [g.areas[area].villain, ...minions(g, area).map((m) => m.uid)].filter((u) => g.insts[u])
export const schemes = (g: Game, area: number) => [g.areas[area].main, ...sides(g, area).map((s) => s.uid)]

function draw(g: Game, p: number, n: number) {
	const pl = g.players[p]
	for (let k = 0; k < n; k++) {
		if (!pl.deck.length) {
			// empty deck: shuffle the discard pile in and take an encounter card
			if (!pl.discard.length) break
			pl.deck = shuffle(g, pl.discard.splice(0))
			for (const u of pl.deck) I(g, u).zone = 'deck'
			log(g, `${pl.name} shuffles their discard pile into a new deck and is dealt an encounter card.`, p)
			dealTo(g, p)
		}
		const u = pl.deck.shift()!
		I(g, u).zone = 'hand'
		pl.hand.push(u)
	}
}

function moveTo(g: Game, uid: number, zone: Zone, opts: { owner?: number; host?: number } = {}) {
	const i = I(g, uid)
	const pl = i.owner >= 0 ? g.players[i.owner] : null
	if (pl) {
		pl.hand = pl.hand.filter((u) => u !== uid)
		pl.deck = pl.deck.filter((u) => u !== uid)
		pl.discard = pl.discard.filter((u) => u !== uid)
	}
	const ar = g.areas[i.area]
	ar.encDeck = ar.encDeck.filter((u) => u !== uid)
	ar.encDiscard = ar.encDiscard.filter((u) => u !== uid)
	for (const a of g.areas) {
		a.encDeck = a.encDeck.filter((u) => u !== uid)
		a.encDiscard = a.encDiscard.filter((u) => u !== uid)
	}
	i.zone = zone
	i.host = opts.host
	if (zone === 'discard' || zone === 'encDiscard' || zone === 'hand' || zone === 'deck' || zone === 'removed' || zone === 'victory') {
		i.dmg = i.thr = i.ctr = i.stun = i.conf = i.tough = 0
		i.ex = false
		i.bonus = undefined
		i.used = undefined
		i.ctrl = i.owner
	}
	if (zone === 'discard' && pl) pl.discard.push(uid)
	if (zone === 'hand' && pl) pl.hand.push(uid)
	if (zone === 'deck' && pl) pl.deck.unshift(uid)
	if (zone === 'encDiscard') g.areas[i.area].encDiscard.push(uid)
	if (zone === 'encDeck') g.areas[i.area].encDeck.unshift(uid)
}

/** Discard a card from play (and everything attached to it). */
export function discard(g: Game, uid: number) {
	const i = g.insts[uid]
	if (!i) return
	for (const a of attachments(g, uid)) discard(g, a.uid)
	moveTo(g, uid, i.owner >= 0 ? 'discard' : 'encDiscard')
}

function drawEncounter(g: Game, area: number): number | null {
	const ar = g.areas[area]
	if (!ar.encDeck.length) {
		if (!ar.encDiscard.length) return null
		ar.encDeck = shuffle(g, ar.encDiscard.splice(0))
		for (const u of ar.encDeck) I(g, u).zone = 'encDeck'
		// an empty encounter deck adds acceleration (1 per reshuffle) to the main scheme
		I(g, ar.main).ctr += 1
		log(g, 'The encounter deck is reshuffled: +1 acceleration on the main scheme.')
	}
	return ar.encDeck.shift() ?? null
}

function dealTo(g: Game, p: number) {
	const area = g.players[p].area
	const u = drawEncounter(g, area)
	if (u === null) return
	const i = I(g, u)
	i.zone = 'dealt'
	i.ctrl = p
}

// ───────── setup ─────────

export interface PlayerSetup {
	name: string
	hero: string // hero set code
	deck: string[] // card codes (not the identity, not the obligation / nemesis)
	area?: number
}
export interface AreaSetup {
	scenario: string
	modular: string[]
	expert: boolean
	standard?: string
}
export interface Setup {
	mode: 'coop' | 'pvp'
	seed: number
	players: PlayerSetup[]
	areas: AreaSetup[]
}

export function newGame(s: Setup): Game {
	const g: Game = {
		mode: s.mode,
		insts: {},
		next: 1,
		players: [],
		areas: [],
		phase: 'setup',
		active: 0,
		phaseArea: 0,
		round: 1,
		queue: [],
		jobs: [],
		log: [],
		rng: s.seed | 0,
	}
	s.areas.forEach((a, ai) => {
		const sc = scenarioById(a.scenario)
		if (!sc) throw new Error(`Unknown scenario ${a.scenario}`)
		g.areas.push({
			id: ai,
			players: [],
			first: 0,
			villainSeq: a.expert ? sc.expert : sc.standard,
			vStage: 0,
			villain: 0,
			schemeSeq: sc.schemes,
			mStage: 0,
			main: 0,
			encDeck: [],
			encDiscard: [],
			expert: a.expert,
			side: sc.pvp,
			scenario: sc.id,
		})
	})
	s.players.forEach((ps, pi) => {
		const h = heroes().find((x) => x.set === ps.hero)
		if (!h) throw new Error(`Unknown hero ${ps.hero}`)
		const area = ps.area ?? 0
		const p: Player = {
			id: pi,
			name: ps.name,
			area,
			hero: h.code,
			alter: h.alter,
			set: h.set,
			form: 'alter',
			flippedThisRound: false,
			ident: 0,
			deck: [],
			hand: [],
			discard: [],
			out: false,
			pool: '',
			done: false,
			leaderCards: [],
			nemesis: [],
		}
		g.players.push(p)
		g.areas[area].players.push(pi)
		p.ident = make(g, h.alter, pi, area, 'identity')
		for (const code of ps.deck) {
			const u = make(g, code, pi, area, 'deck')
			p.deck.push(u)
		}
		shuffle(g, p.deck)
		for (const c of setCards(h.nemesis)) for (let k = 0; k < c.q; k++) p.nemesis.push(make(g, c.c, -1, area, 'setAside'))
	})
	// encounter decks
	s.areas.forEach((a, ai) => {
		const sc = scenarioById(a.scenario)!
		const ar = g.areas[ai]
		const std = a.standard ?? (g.mode === 'pvp' ? 'standard_pvp' : 'standard')
		const setsUsed = [...sc.sets, ...a.modular, std, ...(a.expert ? ['expert'] : [])]
		for (const set of setsUsed)
			for (const c of setCards(set)) {
				if (['villain', 'leader', 'main_scheme'].includes(c.t)) continue
				if (has(c, 'hid')) continue
				if (/Expert Mode Only/i.test(c.x ?? '') && !a.expert) continue
				if (/Standard Mode Only/i.test(c.x ?? '') && a.expert) continue
				for (let k = 0; k < c.q; k++) ar.encDeck.push(make(g, c.c, -1, ai, 'encDeck'))
			}
		for (const pi of ar.players) {
			const h = heroes().find((x) => x.set === g.players[pi].set)!
			if (h.obligation) ar.encDeck.push(make(g, h.obligation, -1, ai, 'encDeck'))
		}
		shuffle(g, ar.encDeck)
		ar.villain = make(g, ar.villainSeq[0], -1, ai, 'villain')
		if (kw(g, ar.villain, 'toughness')) I(g, ar.villain).tough = 1
		const main1 = card(ar.schemeSeq[0])
		ar.main = make(g, main1.back ?? main1.c, -1, ai, 'main')
		const m = I(g, ar.main)
		const mc = card(m.code)
		m.thr = (mc.bt ?? 0) * (has(mc, 'btF') ? 1 : perHero(g, ai))
		log(g, `${sc.name}: ${card(ar.villainSeq[0]).n} (${card(ar.villainSeq[0]).stage ?? ''}) and ${mc.n}.`)
	})
	for (const p of g.players) draw(g, p.id, handSize(g, p.id))
	// scenario setup text (stage 1A) and villain setup
	for (const ar of g.areas) {
		const setupText = (card(ar.schemeSeq[0]).x ?? '').split(/<b>\s*Setup\s*:?\s*<\/b>:?/i)[1]
		if (ar.side) {
			// Civil War leaders: competitive mode reveals Choosing Sides; cooperative mode the leader's own side scheme
			const sc = scenarioById(ar.scenario)!
			const want = (u: number) => (g.mode === 'pvp' ? card(I(g, u).code).n === 'Choosing Sides' : C(g, u).t === 'side_scheme' && C(g, u).st === sc.sets[0])
			const u = ar.encDeck.find(want)
			if (u !== undefined) {
				ar.encDeck = ar.encDeck.filter((x) => x !== u)
				const i = I(g, u)
				i.zone = 'side'
				i.thr = (C(g, u).bt ?? 0) * (has(C(g, u), 'btF') ? 1 : perHero(g, ar.id))
				log(g, `Setup: ${C(g, u).n} is revealed.`)
			}
		} else if (setupText) {
			const clean = setupText.replace(/<[^>]+>/g, '').replace(/Advance to stage \dB\.?/i, '').trim()
			if (clean) pushSteps(g, effect(clean, []), { area: ar.id, player: ar.players[0], src: ar.main })
		}
		const v = parse(card(ar.villainSeq[0])).abilities.filter((a) => a.timing === 'setup')
		for (const ab of v) pushSteps(g, ab.steps, { area: ar.id, player: ar.players[0], src: ar.villain })
	}
	for (const p of g.players) g.queue.push({ who: p.id, kind: 'mulligan', text: `${p.name}: choose any cards to put back (mulligan), then draw back up.` })
	run(g)
	return g
}

// ───────── jobs ─────────

function pushSteps(g: Game, steps: Step[], ctx: Ctx) {
	if (steps.length) g.jobs.push({ k: 'steps', steps, ctx, i: 0 })
}
const ask = (g: Game, p: Prompt) => g.queue.push(p)

/** Run jobs until one needs an answer or the stack is empty. */
function run(g: Game) {
	let guard = 0
	while (!g.queue.length && g.phase !== 'over') {
		if (guard++ > 5000) throw new Error('loop')
		checkState(g)
		if ((g.phase as string) === 'over' || g.queue.length) break
		const j = g.jobs[g.jobs.length - 1]
		if (!j) {
			advance(g)
			if (!g.jobs.length) break
			continue
		}
		const done = step(g, j)
		if (done) {
			const k = g.jobs.lastIndexOf(j)
			if (k >= 0) g.jobs.splice(k, 1)
		}
	}
}

/** Nothing left to resolve: move the round on (only at the end of a villain phase / at setup). */
function advance(g: Game) {
	if (g.phase === 'setup') {
		g.phase = 'player'
		g.phaseArea = 0
		startTurn(g, g.areas[0].players[g.areas[0].first])
	}
	// during the player phase, the player acts; nothing to do
}

function startTurn(g: Game, p: number) {
	g.active = p
	g.players[p].done = false
	g.banner = `${g.players[p].name}'s turn`
	log(g, `— ${g.players[p].name}'s turn (round ${g.round}) —`, p)
}

/** "an Avenger ally", "a support with a cost of 2 or less", "an identity-specific event", "a [[Tech]] upgrade" */
export function cardFilter(what: string): (c: CardData) => boolean {
	const w = what.toLowerCase().replace(/\[\[|\]\]/g, '').replace(/^(a|an|1|one|the|any) /, '').replace(/ card$/, '').trim()
	const cost = w.match(/with a (?:printed )?(?:resource )?cost of (\d+) or (less|more|lower|higher)/)
	const body = w.replace(/\s*with a (?:printed )?(?:resource )?cost of \d+ or \w+/, '').replace(/\s*(?:named|not named) .*$/, '').trim()
	const notNamed = what.match(/not named (.+)$/i)?.[1]?.toLowerCase()
	const alts = body.split(/\s+or\s+|,\s*/).map((x) => x.trim().replace(/^(a|an) /, '')).filter(Boolean)
	const TYPES = ['ally', 'event', 'upgrade', 'support', 'resource', 'player side scheme', 'minion', 'treachery', 'attachment']
	const ASP = ['aggression', 'justice', 'leadership', 'protection', 'basic', 'pool']
	const one = (a: string) => (c: CardData) => {
		const words = a.split(/\s+/)
		const type = TYPES.find((t) => a.endsWith(t)) ?? (TYPES.includes(words[words.length - 1]) ? words[words.length - 1] : undefined)
		if (type && c.t !== type.replace(/ /g, '_') && !(type === 'player side scheme' && c.t === 'player_side_scheme')) return false
		let rest = type ? a.slice(0, a.length - type.length).trim() : a
		if (!rest) return true
		if (/^identity-specific|^hero-specific/.test(rest)) {
			if (c.f !== 'hero') return false
			rest = rest.replace(/^(identity|hero)-specific\s*/, '')
		}
		const asp = ASP.find((x) => rest.startsWith(x))
		if (asp) {
			if (c.f !== asp) return false
			rest = rest.slice(asp.length).trim()
		}
		if (!rest) return true
		const tr = (c.tr ?? '').toLowerCase().replace(/\./g, ' ')
		const nm = c.n.toLowerCase()
		if (nm === rest || nm.startsWith(rest + ' ') || nm === rest.replace(/^copy of /, '')) return true
		return rest.split(/\s+and\s+/).every((t) => tr.split(/\s+/).includes(t) || tr.includes(t + ' ') || tr.endsWith(t))
	}
	const fs = alts.map(one)
	return (c) => {
		if (notNamed && c.n.toLowerCase() === notNamed) return false
		if (cost) {
			const v = c.cost ?? 0
			if (/less|lower/.test(cost[2]) ? v > Number(cost[1]) : v < Number(cost[1])) return false
		}
		return fs.some((f) => f(c))
	}
}

/** A player card goes into play under this player's control. */
function putIntoPlay(g: Game, u: number, p: number) {
	const x = I(g, u)
	moveTo(g, u, 'play')
	x.ctrl = p
	x.ex = false
	const c = card(x.code)
	if (c.t === 'upgrade' || c.t === 'support') {
		const at = parse(c).attach
		if (at) x.host = attachHost(g, x.area, at) ?? undefined
	}
}

/** run the waiting "at the end of …" effects */
function runLater(g: Game, fits: (w: 'phase' | 'round' | 'turn', ctx: Ctx) => boolean) {
	const now = (g.later ?? []).filter((l) => fits(l.when, l.ctx))
	if (!now.length) return
	g.later = (g.later ?? []).filter((l) => !now.includes(l))
	for (const l of now.reverse()) pushSteps(g, l.steps, l.ctx)
}

function nextTurn(g: Game) {
	const pl = g.players[g.active]
	pl.done = true
	runLater(g, (w, c) => w === 'turn' && c.player === pl.id)
	const ar = g.areas[pl.area]
	const order = rotate(ar.players, ar.first).filter((p) => !g.players[p].out)
	const k = order.indexOf(g.active)
	const nxt = order.slice(k + 1).find((p) => !g.players[p].done)
	if (nxt !== undefined) return startTurn(g, nxt)
	// end of this area's player phase: discard / draw / ready
	runLater(g, (w, c) => w === 'phase' && c.area === ar.id)
	endPlayerPhase(g, ar.id)
	if (g.mode === 'pvp' && ar.id === 0 && g.phaseArea === 0) {
		g.phaseArea = 1
		const a1 = g.areas[1]
		const f = rotate(a1.players, a1.first).find((p) => !g.players[p].out)
		if (f !== undefined) return startTurn(g, f)
	}
	g.phase = 'villain'
	g.phaseArea = 0
	g.banner = 'Villain phase'
	// villain phases (area 0 then area 1)
	for (let a = g.areas.length - 1; a >= 0; a--) g.jobs.push({ k: 'villainPhase', area: a, step: 0 })
	g.jobs.unshift({ k: 'endRound' })
}

const rotate = <T>(a: T[], k: number) => [...a.slice(k), ...a.slice(0, k)]

function endPlayerPhase(g: Game, area: number) {
	for (const p of g.areas[area].players) {
		const pl = g.players[p]
		if (pl.out) continue
		pl.pool = ''
		// discard down happened through the 'discardDown' prompt answered at end of turn
		draw(g, p, Math.max(0, handSize(g, p) - pl.hand.length))
		heroOf(g, p).ex = false
		for (const x of Object.values(g.insts)) if (x.ctrl === p && (x.zone === 'play' || x.zone === 'identity')) x.ex = false
		for (const x of Object.values(g.insts)) if (x.area === area) x.bonus = undefined
		for (const x of Object.values(g.insts)) if (x.ctrl === p) x.used = x.used?.filter((n) => n >= 100) // keep round limits
	}
}

function endRound(g: Game) {
	runLater(g, (w) => w === 'round' || w === 'phase')
	for (const x of Object.values(g.insts)) if (x.bonus) x.bonus = undefined
	for (const ar of g.areas) {
		// Temporary cards
		for (const x of Object.values(g.insts)) if (x.area === ar.id && (x.zone === 'play' || x.zone === 'attached') && kw(g, x.uid, 'temporary')) discard(g, x.uid)
		const live = ar.players.filter((p) => !g.players[p].out)
		if (live.length) ar.first = (ar.first + 1) % ar.players.length
		while (g.players[ar.players[ar.first]]?.out && live.length) ar.first = (ar.first + 1) % ar.players.length
	}
	for (const p of g.players) {
		p.flippedThisRound = false
		p.done = false
		for (const x of Object.values(g.insts)) if (x.ctrl === p.id) x.used = undefined
	}
	for (const x of Object.values(g.insts)) x.used = undefined
	g.round++
	g.phase = 'player'
	g.phaseArea = 0
	const a0 = g.areas[0]
	const f = rotate(a0.players, a0.first).find((p) => !g.players[p].out)
	if (f !== undefined) startTurn(g, f)
}

/** One job step. Returns true when the job is finished. */
function step(g: Game, j: Job): boolean {
	switch (j.k) {
		case 'steps':
			return stepEffect(g, j)
		case 'villainPhase':
			return stepVillainPhase(g, j)
		case 'activate':
			return stepActivate(g, j)
		case 'reveal':
			return stepReveal(g, j)
		case 'endRound':
			endRound(g)
			return true
		case 'discardDown':
			return true
		default:
			return true
	}
}

// ───────── villain phase ─────────

function stepVillainPhase(g: Game, j: Extract<Job, { k: 'villainPhase' }>): boolean {
	const ar = g.areas[j.area]
	if (ar.result || !ar.players.some((p) => !g.players[p].out)) return true
	const order = rotate(ar.players, ar.first).filter((p) => !g.players[p].out)
	if (j.step === 0) {
		// 1. place threat on the main scheme
		j.step = 1
		g.phaseArea = ar.id
		const m = I(g, ar.main)
		const mc = card(m.code)
		let n = (mc.esc ?? 0) * (has(mc, 'escF') ? 1 : perHero(g, ar.id)) + m.ctr
		for (const x of [...sides(g, ar.id), ...inZone(g, ar.id, 'env'), ...inZone(g, ar.id, 'attached'), ...minions(g, ar.id), I(g, ar.villain)])
			n += card(x.code).ic?.acc ?? 0
		placeThreat(g, ar.main, n, { area: ar.id, player: order[0], src: ar.main })
		log(g, `Villain phase: ${n} threat on ${mc.n} (${m.thr}/${threshold(g, ar.id)}).`)
		g.banner = `Villain phase: +${n} threat`
		return false
	}
	if (j.step === 1) {
		// 2. the villain activates against each player, then that player's minions
		j.step = 2
		for (const p of [...order].reverse()) {
			const mode = g.players[p].form === 'hero' ? 'attack' : 'scheme'
			for (const mi of [...engaged(g, p)].reverse()) g.jobs.push(activation(g, ar.id, mi.uid, p, mode))
			g.jobs.push(activation(g, ar.id, ar.villain, p, mode))
		}
		return false
	}
	if (j.step === 2) {
		// 3. deal encounter cards: 1 per player + 1 per hazard icon
		j.step = 3
		for (const p of order) dealTo(g, p)
		let haz = 0
		for (const x of [...sides(g, ar.id), ...inZone(g, ar.id, 'env'), I(g, ar.main), ...minions(g, ar.id)]) haz += card(x.code).ic?.haz ?? 0
		for (let k = 0; k < haz; k++) dealTo(g, order[k % order.length])
		return false
	}
	if (j.step === 3) {
		// 4. reveal them, player by player, in the order dealt
		j.step = 4
		for (const p of [...order].reverse()) {
			const dealt = Object.values(g.insts)
				.filter((x) => x.zone === 'dealt' && x.ctrl === p)
				.map((x) => x.uid)
			for (const u of [...dealt].reverse()) g.jobs.push({ k: 'reveal', area: ar.id, player: p, uid: u, step: 0, fromDeck: true })
		}
		return false
	}
	return true
}

function activation(g: Game, area: number, enemy: number, target: number, mode: 'attack' | 'scheme'): Job {
	return { k: 'activate', area, enemy, target, mode, step: 0, boosts: [], extra: 0, gains: [], prevent: null }
}

function stepActivate(g: Game, j: Extract<Job, { k: 'activate' }>): boolean {
	const e = g.insts[j.enemy]
	if (!e || !['villain', 'engaged'].includes(e.zone)) return true
	const pl = g.players[j.target]
	if (pl.out) return true
	const ename = nameOf(g, j.enemy)
	const isVillain = e.zone === 'villain'
	if (j.step === 0) {
		if (j.mode === 'attack' && e.stun) {
			e.stun--
			log(g, `${ename} is stunned: instead of attacking, the stun is removed.`)
			return true
		}
		if (j.mode === 'scheme' && e.conf) {
			e.conf--
			log(g, `${ename} is confused: instead of scheming, the confusion is removed.`)
			return true
		}
		j.step = 1
		// boost cards: the villain always; minions only with Villainous
		const nb = Math.max(0, (isVillain || kw(g, j.enemy, 'villainous') ? 1 : 0) + j.extra + (e.fdBoost ?? 0))
		e.fdBoost = 0
		for (let k = 0; k < nb; k++) {
			const b = drawEncounter(g, j.area)
			if (b !== null) {
				I(g, b).zone = 'boost'
				I(g, b).host = j.enemy
				j.boosts.push(b)
			}
		}
		// attached / enemy abilities that trigger when it attacks ("When X attacks, give him 1 additional boost card")
		const later: { steps: Step[]; src: number }[] = []
		for (const src of [j.enemy, ...attachments(g, j.enemy).map((a) => a.uid)]) {
			for (const ab of P(g, src).abilities)
				if (/^forced/.test(ab.timing) && ab.trigger && /when .*(attacks|schemes|activates)/i.test(ab.trigger) && new RegExp(j.mode === 'attack' ? 'attack' : 'scheme', 'i').test(ab.trigger)) {
					for (const st of ab.steps) {
						if (st.k === 'extraBoost') {
							for (let k = 0; k < st.n; k++) {
								const b = drawEncounter(g, j.area)
								if (b !== null) {
									I(g, b).zone = 'boost'
									I(g, b).host = j.enemy
									j.boosts.push(b)
								}
							}
						} else if (st.k === 'attackGains') j.gains.push(st.kw)
					}
					const rest = ab.steps.filter((st) => st.k !== 'extraBoost' && st.k !== 'attackGains')
					if (rest.length && !/webbed up/i.test(card(I(g, src).code).n)) later.push({ steps: rest, src })
					if (/webbed up/i.test(card(I(g, src).code).n) && j.mode === 'attack') {
						// "When attached enemy would attack, discard Webbed Up instead. Then, stun that enemy."
						discard(g, src)
						e.stun = Math.min(e.stun + 1, 1)
						for (const b of j.boosts) moveTo(g, b, 'encDiscard')
						log(g, `Webbed Up: ${ename}'s attack is cancelled and ${ename} is stunned.`)
						return true
					}
				}
		}
		// the rest of those abilities ("he gets +2 ATK for this attack", choices…) resolve now, before defenders
		for (const l of later.reverse()) pushSteps(g, l.steps, { area: j.area, player: j.target, src: l.src, that: j.enemy, attack: j.enemy })
		if (j.mode === 'attack') {
			log(g, `${ename} attacks ${heroName(g, j.target)}.`, j.target)
			g.banner = `${ename} attacks!`
			openWindow(g, j.target, 'villainAttacksYou', { area: j.area, player: j.target, src: j.enemy })
		} else {
			log(g, `${ename} schemes against ${pl.name}.`, j.target)
			g.banner = `${ename} schemes!`
		}
		return false
	}
	if (j.step === 1) {
		j.step = 2
		if (j.mode === 'attack') {
			const opts: number[] = []
			const h = heroOf(g, j.target)
			if (j.defender !== undefined) return false // already decided ("it attacks Helpful Bystander instead")
			if (pl.form === 'hero' && !h.ex) opts.push(h.uid)
			for (const a of allies(g, j.target)) if (!a.ex) opts.push(a.uid)
			const atk = stat(g, j.enemy, 'atk')
			const nb = j.boosts.length
			const def = pl.form === 'hero' && !h.ex ? stat(g, h.uid, 'def') : 0
			const hit = `${atk} damage${nb ? ` + ${nb} facedown boost card${nb > 1 ? 's' : ''}` : ''}`
			if (opts.length)
				ask(g, {
					who: j.target,
					kind: 'defend',
					attacker: j.enemy,
					options: opts,
					text: `${ename} attacks you: ${hit}.${def ? ` Defending blocks ${def} of it.` : ''} Defend?`,
				})
		}
		return false
	}
	if (j.step === 2) {
		j.step = 3
		// turn the boost cards faceup
		let boost = 0
		for (const b of j.boosts) {
			const bc = C(g, b)
			boost += bc.boost ?? 0
			let amp = 0
			for (const x of [...sides(g, j.area), ...inZone(g, j.area, 'env'), I(g, g.areas[j.area].main)]) amp += card(x.code).ic?.amp ?? 0
			if (amp) placeThreat(g, g.areas[j.area].main, amp, { area: j.area, player: j.target, src: b })
			if (has(bc, 'boostS')) {
				const ab = P(g, b).abilities.find((a) => a.timing === 'boost')
				if (ab) {
					for (const st of ab.steps) {
						if (st.k === 'attackGains') j.gains.push(st.kw)
						else if (st.k === 'extraBoost') {
							for (let k = 0; k < st.n; k++) {
								const nb = drawEncounter(g, j.area)
								if (nb !== null) {
									boost += C(g, nb).boost ?? 0
									moveTo(g, nb, 'encDiscard')
								}
							}
						} else if (st.k === 'revealThis') {
							j.boosts = j.boosts.filter((x) => x !== b)
							g.jobs.push({ k: 'reveal', area: j.area, player: j.target, uid: b, step: 0, fromDeck: false })
						} else pushSteps(g, [st], { area: j.area, player: j.target, src: b, that: j.enemy, attack: j.enemy })
					}
				}
			}
		}
		;(j as { boostTotal?: number }).boostTotal = boost
		if (j.boosts.length) log(g, `Boost: +${boost} (${j.boosts.map((b) => nameOf(g, b)).join(', ')}).`, j.target)
		return false
	}
	if (j.step === 3) {
		j.step = 4
		const boost = (j as { boostTotal?: number }).boostTotal ?? 0
		if (j.mode === 'scheme') {
			const n = Math.max(0, stat(g, j.enemy, 'sch') + boost + (j.plus ?? 0))
			placeThreat(g, g.areas[j.area].main, n, { area: j.area, player: j.target, src: j.enemy })
			log(g, `${ename} places ${n} threat on the main scheme.`, j.target)
		} else {
			let dmg = Math.max(0, stat(g, j.enemy, 'atk') + boost + (j.plus ?? 0))
			const d = j.defender
			if (d && g.insts[d]) {
				const di = I(g, d)
				if (di.zone === 'identity') {
					dmg = Math.max(0, dmg - stat(g, d, 'def'))
					log(g, `${heroName(g, j.target)} defends (DEF ${stat(g, d, 'def')}).`, j.target)
					j.ctxSrc = d
				}
			}
			const victim = d && g.insts[d] ? d : g.players[j.target].ident
			if (I(g, victim).zone === 'identity' && dmg > 0) openWindow(g, j.target, 'attackDamage', { area: j.area, player: j.target, src: j.enemy, attack: j.enemy })
			;(j as { dmg?: number; victim?: number }).dmg = dmg
			;(j as { victim?: number }).victim = victim
		}
		return false
	}
	if (j.step === 4) {
		j.step = 5
		if (j.mode === 'attack') {
			let dmg = (j as { dmg?: number }).dmg ?? 0
			const victim = (j as { victim?: number }).victim!
			const prevent = (j as { prevented?: number | 'all' }).prevented
			if (prevent === 'all') dmg = 0
			else if (typeof prevent === 'number') dmg = Math.max(0, dmg - prevent)
			const overkill = j.gains.includes('overkill') || kw(g, j.enemy, 'overkill') > 0
			const piercing = j.gains.includes('piercing') || kw(g, j.enemy, 'piercing') > 0
			const vi = g.insts[victim]
			if (vi) {
				if (piercing) vi.tough = 0
				const isAlly = vi.zone === 'play'
				const hpLeft = stat(g, victim, 'hp') - vi.dmg
				const dealt = damage(g, victim, dmg, { area: j.area, player: j.target, src: j.enemy })
				if (dealt > 0 && j.gains.includes('stunOnDamage') && g.insts[victim]) setStatus(g, victim, 'stun')
				if (isAlly && overkill && dmg > hpLeft) damage(g, g.players[j.target].ident, dmg - hpLeft, { area: j.area, player: j.target, src: j.enemy })
				log(g, `${ename} deals ${dealt} damage to ${nameOf(g, victim)}.`, j.target)
				// retaliate
				if (g.insts[victim] && vi.zone !== 'discard') {
					const r = kw(g, victim, 'retaliate')
					if (r) damage(g, j.enemy, r, { area: j.area, player: j.target, src: victim })
				}
			}
		}
		for (const b of j.boosts) if (g.insts[b]?.zone === 'boost') moveTo(g, b, 'encDiscard')
		for (const u of (j as { discardAfter?: number[] }).discardAfter ?? []) if (g.insts[u]) discard(g, u)
		return true
	}
	return true
}

const heroName = (g: Game, p: number) => formCard(g, p).n

// ───────── reveal ─────────

function stepReveal(g: Game, j: Extract<Job, { k: 'reveal' }>): boolean {
	const i = g.insts[j.uid]
	if (!i) return true
	const c = card(i.code)
	const pl = g.players[j.player]
	const ctx: Ctx = { area: j.area, player: j.player, src: j.uid }
	const pr = P(g, j.uid)
	if (j.step === 0) {
		j.step = 1
		g.spotlight = j.uid
		log(g, `${pl.name} reveals ${c.n} (${c.t.replace('_', ' ')}).`, j.player)
		g.banner = `${c.n}`
		i.ctrl = j.player
		if (pr.keywords.surge) j.surge = true
		if (c.t === 'treachery') openWindow(g, j.player, 'treachery', ctx)
		return false
	}
	if (j.step === 1) {
		j.step = 2
		if ((j as { cancelled?: boolean }).cancelled) {
			log(g, `${c.n}'s When Revealed effects are cancelled.`, j.player)
		}
		switch (c.t) {
			case 'minion':
				i.zone = 'engaged'
				i.ctrl = j.player
				if (kw(g, j.uid, 'toughness')) i.tough = 1
				break
			case 'side_scheme':
			case 'player_side_scheme':
				i.zone = 'side'
				i.thr = (c.bt ?? 0) * (has(c, 'btF') ? 1 : perHero(g, j.area))
				break
			case 'attachment': {
				const host = attachHost(g, j.area, pr.attach)
				if (host) {
					i.zone = 'attached'
					i.host = host
					if (/give (him|her|it|the villain|.+?) a tough status card/i.test(c.x ?? '') && /^attach to/i.test(c.x ?? '')) setStatus(g, host, 'tough')
				} else i.zone = 'encDiscard'
				break
			}
			case 'environment':
				i.zone = 'env'
				break
			default:
				i.zone = 'boost' // treachery / obligation: resolve, then discard
		}
		const inc = kw(g, j.uid, 'incite')
		if (inc) placeThreat(g, g.areas[j.area].main, inc, ctx)
		const hind = kw(g, j.uid, 'hinder')
		if (hind && (c.t === 'side_scheme' || c.t === 'main_scheme')) I(g, j.uid).thr += hind
		if (!(j as { cancelled?: boolean }).cancelled) {
			const form = pl.form
			const abs = pr.abilities.filter((a) => a.timing === 'whenRevealed' && (!a.revealForm || a.revealForm === form))
			const stepsAll: Step[] = []
			for (const a of abs) stepsAll.push(...a.steps)
			if (stepsAll.length) g.jobs.push({ k: 'steps', steps: stepsAll, ctx: { ...ctx, surge: false }, i: 0 })
		}
		return false
	}
	if (j.step === 2) {
		j.step = 3
		const ii = g.insts[j.uid]
		if (c.t === 'minion' && ii?.zone === 'engaged' && kw(g, j.uid, 'quickstrike') && pl.form === 'hero') g.jobs.push(activation(g, j.area, j.uid, j.player, 'attack'))
		return false
	}
	if (ii(g, j.uid)?.zone === 'boost') moveTo(g, j.uid, 'encDiscard')
	if (j.surge || (j as { surged?: boolean }).surged) {
		const nx = drawEncounter(g, j.area)
		if (nx !== null) {
			log(g, `Surge: ${pl.name} reveals another encounter card.`, j.player)
			I(g, nx).zone = 'dealt'
			I(g, nx).ctrl = j.player
			g.jobs.push({ k: 'reveal', area: j.area, player: j.player, uid: nx, step: 0, fromDeck: true })
			const k = g.jobs.indexOf(j)
			if (k >= 0) g.jobs.splice(k, 1)
			return false
		}
	}
	g.spotlight = undefined
	return true
}
const ii = (g: Game, uid: number) => g.insts[uid]

function attachHost(g: Game, area: number, what?: string): number | null {
	const ar = g.areas[area]
	if (!what) return ar.villain
	const w = what.toLowerCase()
	if (/villain/.test(w) || NAMES.villains.has(w)) return ar.villain
	if (/main scheme/.test(w)) return ar.main
	if (/minion/.test(w)) {
		const m = minions(g, area)
		return m.length ? m.sort((a, b) => stat(g, b.uid, 'hp') - stat(g, a.uid, 'hp'))[0].uid : ar.villain
	}
	return ar.villain
}

// ───────── threat, damage, statuses ─────────

export function placeThreat(g: Game, uid: number, n: number, ctx: Ctx) {
	if (n <= 0) return
	const i = g.insts[uid]
	if (!i) return
	i.thr += n
	void ctx
}

export function removeThreat(g: Game, uid: number, n: number, ctx: Ctx): number {
	const i = g.insts[uid]
	if (!i || n <= 0) return 0
	const k = Math.min(n, i.thr)
	i.thr -= k
	if (i.zone === 'side' && i.thr <= 0 && k > 0) {
		log(g, `${nameOf(g, uid)} is defeated.`, ctx.player)
		const wd = P(g, uid).abilities.filter((a) => a.timing === 'whenDefeated')
		for (const a of wd) pushSteps(g, a.steps, { ...ctx, src: uid })
		discard(g, uid)
	}
	return k
}

/** Deal damage, with tough statuses and "place it here instead" armour. Returns damage actually dealt. */
export function damage(g: Game, uid: number, n: number, ctx: Ctx): number {
	const i = g.insts[uid]
	if (!i || n <= 0) return 0
	if (i.bonus?.shield) {
		log(g, `${nameOf(g, uid)} can't take damage this phase.`)
		return 0
	}
	if (i.tough > 0) {
		i.tough--
		log(g, `${nameOf(g, uid)}'s tough status card prevents the damage.`)
		return 0
	}
	// armour: "When any amount of damage would be dealt to X, place it here instead. Then, if there is at least N damage here, discard"
	for (const a of attachments(g, uid)) {
		const t = (card(a.code).x ?? '').replace(/<[^>]+>/g, '')
		const m = t.match(/damage would be (?:dealt to|taken by) [^,]+, place it here instead\.\s*Then, if there (?:is|are) at least (\d+) damage here, discard/i) ||
			t.match(/would take any amount of damage, place it here instead\.\s*Then, if there (?:is|are) at least (\d+) damage here, discard/i)
		if (m) {
			a.dmg += n
			log(g, `${card(a.code).n} takes the ${n} damage instead.`)
			if (a.dmg >= Number(m[1])) {
				log(g, `${card(a.code).n} is discarded.`)
				discard(g, a.uid)
			}
			return n
		}
	}
	i.dmg += n
	return n
}

function setStatus(g: Game, uid: number, s: 'stun' | 'conf' | 'tough') {
	const i = g.insts[uid]
	if (!i) return
	if (s !== 'tough' && kw(g, uid, 'stalwart')) return
	const max = s !== 'tough' && kw(g, uid, 'steady') ? 2 : 1
	const k = s
	i[k] = Math.min(max, i[k] + 1)
	if (s !== 'tough' && kw(g, uid, 'vulnerable')) discard(g, uid)
}

function heal(g: Game, uid: number, n: number | 'all'): number {
	const i = g.insts[uid]
	if (!i) return 0
	const k = n === 'all' ? i.dmg : Math.min(n, i.dmg)
	i.dmg -= k
	return k
}

/** Defeats, stage changes and the end of the game. */
function checkState(g: Game) {
	for (const ar of g.areas) {
		if (ar.result) continue
		// villain defeated
		const v = g.insts[ar.villain]
		if (v && v.dmg >= stat(g, ar.villain, 'hp')) {
			ar.vStage++
			if (ar.vStage >= ar.villainSeq.length) {
				ar.result = 'win'
				log(g, `${nameOf(g, ar.villain)} is defeated!`)
				v.zone = 'victory'
			} else {
				const code = ar.villainSeq[ar.vStage]
				log(g, `${card(v.code).n} is defeated — stage ${card(code).stage} begins.`)
				v.code = code
				v.dmg = 0
				if (kw(g, v.uid, 'toughness')) v.tough = Math.max(v.tough, 1)
				for (const a of parse(card(code)).abilities.filter((x) => x.timing === 'whenRevealed')) pushSteps(g, a.steps, { area: ar.id, player: ar.players[ar.first], src: v.uid })
				g.banner = `${card(code).n} ${card(code).stage}`
			}
		}
		// main scheme completed
		const m = g.insts[ar.main]
		if (m && !ar.result && m.thr >= threshold(g, ar.id) && threshold(g, ar.id) > 0) {
			ar.mStage++
			if (ar.mStage >= ar.schemeSeq.length || /players lose the game/i.test(card(m.code).x ?? '')) {
				ar.result = 'lose'
				log(g, `${card(m.code).n} is completed: the villain wins.`)
			} else {
				const front = card(ar.schemeSeq[ar.mStage])
				m.code = front.back ?? front.c
				const mc = card(m.code)
				m.thr = (mc.bt ?? 0) * (has(mc, 'btF') ? 1 : perHero(g, ar.id))
				log(g, `The main scheme advances to ${mc.n} (${mc.stage}).`)
				for (const a of parse(mc).abilities.filter((x) => x.timing === 'whenRevealed')) pushSteps(g, a.steps, { area: ar.id, player: ar.players[ar.first], src: m.uid })
			}
		}
		// minions, allies, side schemes
		for (const x of Object.values(g.insts)) {
			if (x.area !== ar.id) continue
			if (x.zone === 'engaged' && x.dmg >= stat(g, x.uid, 'hp')) defeatMinion(g, x.uid)
			else if (x.zone === 'play' && card(x.code).t === 'ally' && x.dmg >= stat(g, x.uid, 'hp')) {
				log(g, `${card(x.code).n} is defeated.`, x.ctrl)
				discard(g, x.uid)
			} else if (x.zone === 'play' && P(g, x.uid).uses !== undefined && x.ctr <= 0 && (x.used?.length ?? 0) > 0) {
				log(g, `${card(x.code).n} has no counters left and is discarded.`, x.ctrl)
				discard(g, x.uid)
			}
		}
		// heroes
		for (const p of ar.players) {
			const pl = g.players[p]
			if (pl.out) continue
			const h = heroOf(g, p)
			if (h.dmg >= stat(g, h.uid, 'hp')) {
				pl.out = true
				log(g, `${heroName(g, p)} is defeated.`, p)
				for (const x of Object.values(g.insts)) if (x.ctrl === p && ['engaged', 'dealt'].includes(x.zone)) moveTo(g, x.uid, 'encDiscard')
				g.jobs = g.jobs.filter((jb) => !(jb.k === 'activate' && jb.target === p))
				g.queue = g.queue.filter((q) => q.who !== p)
			}
		}
		if (!ar.result && ar.players.every((p) => g.players[p].out)) ar.result = 'lose'
	}
	const done = g.areas.filter((a) => a.result)
	if (done.length && g.phase !== 'over') {
		if (g.mode === 'coop') {
			g.phase = 'over'
			g.winner = g.areas[0].result === 'win' ? 'heroes' : 'villain'
			g.banner = g.winner === 'heroes' ? 'Victory!' : 'Defeat'
		} else {
			const w = g.areas.find((a) => a.result === 'win')
			const l = g.areas.find((a) => a.result === 'lose')
			g.phase = 'over'
			// area 0 is the Registration team (it faces the Resistance leader), area 1 the Resistance team
			const team = (a: Area) => (a.id === 0 ? 'Registration' : 'Resistance')
			if (w) g.winner = team(w)
			else if (l) g.winner = team(g.areas[1 - l.id])
			g.banner = `${g.winner} wins!`
		}
		g.queue = []
		g.jobs = []
		g.spotlight = undefined
	}
}

function defeatMinion(g: Game, uid: number) {
	const x = I(g, uid)
	if (x.facedown) {
		log(g, `A Drone is defeated (its card goes back to its owner's discard pile).`, x.ctrl)
		x.facedown = false
		discard(g, uid)
		return
	}
	const ctx: Ctx = { area: x.area, player: x.ctrl, src: uid }
	log(g, `${card(x.code).n} is defeated.`, x.ctrl)
	for (const a of attachments(g, uid)) {
		const ab = P(g, a.uid).abilities.find((q) => q.window === 'attachedDefeated')
		if (ab) pushSteps(g, ab.steps, { ...ctx, src: a.uid, player: a.ctrl >= 0 ? a.ctrl : x.ctrl })
	}
	for (const a of P(g, uid).abilities.filter((q) => q.timing === 'whenDefeated')) pushSteps(g, a.steps, ctx)
	if (kw(g, uid, 'victory')) {
		for (const a of attachments(g, uid)) discard(g, a.uid)
		moveTo(g, uid, 'victory')
	} else discard(g, uid)
}

// ───────── trigger windows ─────────

/** Offer the player's cards that fit a moment ("When the villain attacks you", "prevent damage"…). */
function openWindow(g: Game, p: number, w: Window, ctx: Ctx) {
	const pl = g.players[p]
	if (pl.out) return
	// "When the villain initiates an attack" is only the villain; "an enemy" is any enemy
	const fits = (ab: Ability) =>
		!(w === 'villainAttacksYou' && /the villain|a villain/i.test(ab.trigger ?? ab.text) && !/an enemy/i.test(ab.trigger ?? ab.text) && I(g, ctx.src).zone !== 'villain')
	const offers: { uid: number; ab: number; label: string }[] = []
	const sources = [pl.ident, ...playArea(g, p).map((x) => x.uid), ...Object.values(g.insts).filter((x) => x.ctrl === p && x.zone === 'play' && x.host !== undefined).map((x) => x.uid)]
	for (const u of sources) {
		const abs = abilitiesOf(g, u)
		abs.forEach((ab, k) => {
			if (ab.window !== w || (ab.form && ab.form !== pl.form) || usedUp(g, u, k, ab) || !fits(ab)) return
			if (ab.cost.length === 0 && ab.timing === 'interrupt' && I(g, u).zone === 'identity') {
				// free identity abilities (Spider-Sense) just happen
				markUsed(g, u, k, ab)
				log(g, `${nameOf(g, u)}: ${ab.text.replace(/^[^:]*:\s*/, '')}`, p)
				pushSteps(g, ab.steps, { ...ctx, src: u })
				return
			}
			if (/^forced/.test(ab.timing)) {
				pushSteps(g, ab.steps, { ...ctx, src: u })
				return
			}
			if (canPayCost(g, p, u, ab)) offers.push({ uid: u, ab: k, label: `${nameOf(g, u)}: ${ab.text.replace(/^[^:]*:\s*/, '')}` })
		})
	}
	for (const u of pl.hand) {
		const c = C(g, u)
		if (c.t !== 'event') continue
		const abs = parse(c, card(pl.alter).n).abilities
		abs.forEach((ab, k) => {
			if (ab.window !== w || (ab.form && ab.form !== pl.form) || !fits(ab)) return
			if (affordable(g, p, c.cost ?? 0, [u])) offers.push({ uid: u, ab: k, label: `Play ${c.n} (cost ${c.cost ?? 0}): ${ab.text.replace(/^[^:]*:\s*/, '')}` })
		})
	}
	if (offers.length) {
		const text: Record<Window, string> = {
			villainAttacksYou: 'You are being attacked. Use a card?',
			attackDamage: 'You are about to take damage. Use a card?',
			treachery: 'A treachery is being revealed. Use a card?',
			threatPlaced: 'Threat is being placed. Use a card?',
			played: 'Use a card?',
			attachedDefeated: 'Use a card?',
			endRound: 'Use a card?',
		}
		;(g as Game & { windowCtx?: Ctx }).windowCtx = ctx
		ask(g, { who: p, kind: 'window', options: offers, text: text[w] })
	}
}

function abilitiesOf(g: Game, uid: number): Ability[] {
	const i = I(g, uid)
	if (i.zone === 'identity') {
		const pl = g.players[i.owner]
		return parse(formCard(g, pl.id), card(pl.alter).n).abilities
	}
	return P(g, uid).abilities
}
const limKey = (k: number, ab: Ability) => (ab.limit === 'round' ? 100 + k : k)
function usedUp(g: Game, uid: number, k: number, ab: Ability) {
	const i = I(g, uid)
	if (!ab.limit && !ab.cost.some((c) => c.k === 'exhaust')) return false
	if (ab.cost.some((c) => c.k === 'exhaust') && i.ex) return true
	return !!ab.limit && !!i.used?.includes(limKey(k, ab))
}
function markUsed(g: Game, uid: number, k: number, ab: Ability) {
	const i = I(g, uid)
	if (ab.limit) i.used = [...(i.used ?? []), limKey(k, ab)]
}
function canPayCost(g: Game, p: number, uid: number, ab: Ability) {
	const i = I(g, uid)
	for (const c of ab.cost) {
		if (c.k === 'exhaust' && i.ex) return false
		if (c.k === 'counter' && i.ctr < c.n) return false
		if (c.k === 'res' && !affordable(g, p, c.n, [])) return false
	}
	return true
}

// ───────── paying ─────────

export function resourcesOf(g: Game, uid: number): string {
	return C(g, uid).res ?? ''
}
/** Can the player pay `cost` from hand (without the `exclude` cards) and their resource pool? */
export function affordable(g: Game, p: number, cost: number, exclude: number[]) {
	const pl = g.players[p]
	let n = pl.pool.length
	for (const u of pl.hand) if (!exclude.includes(u)) n += resourcesOf(g, u).length
	return n >= cost
}
/** A cheap way to pay: resource cards first, then the cards with the most resources. */
export function autoPay(g: Game, p: number, cost: number, exclude: number[]): number[] | null {
	const pl = g.players[p]
	let need = cost - pl.pool.length
	if (need <= 0) return []
	const cands = pl.hand.filter((u) => !exclude.includes(u) && resourcesOf(g, u).length > 0)
	cands.sort((a, b) => {
		const ra = C(g, a).t === 'resource' ? 0 : 1
		const rb = C(g, b).t === 'resource' ? 0 : 1
		return ra - rb || resourcesOf(g, b).length - resourcesOf(g, a).length
	})
	const out: number[] = []
	// prefer an exact payment
	for (const u of cands) {
		if (need <= 0) break
		out.push(u)
		need -= resourcesOf(g, u).length
	}
	return need <= 0 ? out : null
}
function spend(g: Game, p: number, cost: number, pay: number[]): boolean {
	const pl = g.players[p]
	let have = pl.pool.length
	for (const u of pay) if (pl.hand.includes(u)) have += resourcesOf(g, u).length
	if (have < cost) return false
	let fromPool = Math.min(cost, pl.pool.length)
	pl.pool = pl.pool.slice(fromPool)
	for (const u of pay) if (pl.hand.includes(u)) moveTo(g, u, 'discard')
	return true
}

// ───────── targets for effect steps ─────────

function targetsFor(g: Game, who: Who, ctx: Ctx, attackTag = false): number[] {
	const ar = g.areas[ctx.area]
	const p = ctx.player
	switch (who) {
		case 'enemy': {
			const es = enemies(g, ctx.area)
			if (attackTag && engaged(g, p).some((m) => kw(g, m.uid, 'guard'))) return es.filter((u) => u !== ar.villain)
			return es
		}
		case 'minion':
			return minions(g, ctx.area).map((m) => m.uid)
		case 'villain':
			return [ar.villain]
		case 'scheme':
			return schemes(g, ctx.area).filter((u) => !(u === ar.main && crisis(g, ctx.area)))
		case 'main':
			return crisis(g, ctx.area) ? [] : [ar.main]
		case 'side':
			return sides(g, ctx.area).map((s) => s.uid)
		case 'character':
			return [g.players[p].ident, ...allies(g, p).map((a) => a.uid)]
		case 'ally':
			return allies(g, p).map((a) => a.uid)
		default:
			return []
	}
}
const crisis = (g: Game, area: number) => sides(g, area).some((s) => (card(s.code).ic?.cri ?? 0) > 0)

/** The cards a "each X" / fixed reference means. */
const IN_PLAY: Zone[] = ['villain', 'engaged', 'side', 'main', 'env', 'attached', 'play', 'identity']
/** Cards in play in this game area with this name (case-insensitive). */
export function named(g: Game, area: number, name: string): number[] {
	const n = name.toLowerCase().replace(/^the /, '')
	return Object.values(g.insts)
		.filter((x) => x.area === area && IN_PLAY.includes(x.zone) && !x.facedown && card(x.code).n.toLowerCase().replace(/^the /, '') === n)
		.map((x) => x.uid)
}

function fixedTargets(g: Game, who: Who, ctx: Ctx): number[] | null {
	const ar = g.areas[ctx.area]
	const p = ctx.player
	if (who.startsWith('named:')) return named(g, ctx.area, who.slice(6))
	switch (who) {
		case 'villain':
			return [ar.villain]
		case 'eachEnemy':
			return enemies(g, ctx.area)
		case 'eachMinion':
			return minions(g, ctx.area).map((m) => m.uid)
		case 'main':
			return [ar.main]
		case 'eachScheme':
			return schemes(g, ctx.area)
		case 'eachSide':
			return sides(g, ctx.area).map((s) => s.uid)
		case 'thisCard':
			return [ctx.src]
		case 'hero':
			return [g.players[p].ident]
		case 'eachHero':
			return ar.players.filter((q) => !g.players[q].out).map((q) => g.players[q].ident)
		case 'eachAlly':
			return allies(g, p).map((a) => a.uid)
		case 'eachFriendly':
			return [g.players[p].ident, ...allies(g, p).map((a) => a.uid)]
		case 'attached': {
			const h = g.insts[ctx.src]?.host
			return h ? [h] : []
		}
		case 'that':
			return ctx.that ? [ctx.that] : ctx.attack ? [ctx.attack] : []
		default:
			return null
	}
}

const WHO_TEXT: Partial<Record<Who, string>> = {
	enemy: 'an enemy',
	minion: 'a minion',
	scheme: 'a scheme',
	side: 'a side scheme',
	character: 'a friendly character',
	ally: 'an ally',
}

function stepEffect(g: Game, j: Extract<Job, { k: 'steps' }>): boolean {
	if (j.i >= j.steps.length) return true
	const s = j.steps[j.i]
	const ctx = j.ctx
	const area = ctx.area
	const p = ctx.player
	const src = ctx.src
	const srcName = g.insts[src] ? nameOf(g, src) : ''
	const attackTag = !!(j as { attack?: boolean }).attack
	const next = () => {
		j.i++
		j.pick = undefined
		return j.i >= j.steps.length
	}
	/** resolve a reference to one or more cards, asking when it's "a/an …" */
	const refs = (who: Who): number[] | null => {
		const f = fixedTargets(g, who, ctx)
		if (f) return f.filter((u) => g.insts[u])
		const opts = targetsFor(g, who, ctx, attackTag)
		if (j.pick !== undefined && opts.includes(j.pick)) return [j.pick]
		if (opts.length === 0) return []
		if (opts.length === 1) return opts
		ask(g, { who: p, kind: 'target', options: opts, text: `${srcName}: choose ${WHO_TEXT[who] ?? who}.`, why: describe(s), card: src })
		return null
	}
	switch (s.k) {
		case 'dmg': {
			const t = refs(s.to)
			if (!t) return false
			const n = nval(g, s.n, area, stat(g, g.players[p].ident, 'atk'), p, src, ctx.that)
			let any = 0
			for (const u of t) {
				any += damage(g, u, n, ctx)
				if (s.stun) setStatus(g, u, 'stun')
			}
			if (t.length) log(g, `${srcName}: ${n} damage to ${t.map((u) => nameOf(g, u)).join(', ')}.`, p)
			ctx.did = any > 0
			return next()
		}
		case 'thwart': {
			const t = refs(s.from)
			if (!t) return false
			const n = nval(g, s.n, area, stat(g, g.players[p].ident, 'thw'), p, src, ctx.that)
			let any = 0
			for (const u of t) any += removeThreat(g, u, n, ctx)
			if (t.length) log(g, `${srcName}: removes ${n} threat from ${t.map((u) => (g.insts[u] ? nameOf(g, u) : 'a scheme')).join(', ')}.`, p)
			ctx.did = any > 0
			return next()
		}
		case 'threat': {
			const t = refs(s.on)
			if (!t) return false
			const n = nval(g, s.n, area, 0, p, src, ctx.that)
			for (const u of t) placeThreat(g, u, n, ctx)
			ctx.did = t.length > 0
			return next()
		}
		case 'draw': {
			const n = nval(g, s.n, area, 0, p, src, ctx.that)
			const who = s.each ? g.areas[area].players.filter((q) => !g.players[q].out) : [p]
			for (const q of who) draw(g, q, n)
			log(g, `${srcName}: draw ${n}.`, p)
			ctx.did = true
			return next()
		}
		case 'heal': {
			const t = refs(s.who)
			if (!t) return false
			let any = 0
			for (const u of t) any += heal(g, u, s.n === 'all' ? 'all' : nval(g, s.n, area, 0, p, src, ctx.that))
			if (t.length) log(g, `${srcName}: heals ${any} damage from ${t.map((u) => nameOf(g, u)).join(', ')}.`, p)
			ctx.did = any > 0
			return next()
		}
		case 'status': {
			const t = refs(s.who)
			if (!t) return false
			let any = false
			for (const u of t) {
				const before = I(g, u)[s.s]
				setStatus(g, u, s.s)
				if (g.insts[u] && I(g, u)[s.s] > before) any = true
			}
			const word = { stun: 'stunned', conf: 'confused', tough: 'gains a tough status' }[s.s]
			if (t.length) log(g, `${srcName}: ${t.map((u) => nameOf(g, u)).join(', ')} ${word}.`, p)
			ctx.did = any
			return next()
		}
		case 'ready':
		case 'exhaust': {
			const t = refs(s.who)
			if (!t) return false
			let any = false
			for (const u of t) {
				const x = I(g, u)
				if (x.ex !== (s.k === 'exhaust')) any = true
				x.ex = s.k === 'exhaust'
			}
			ctx.did = any
			return next()
		}
		case 'surge':
			markSurge(g, src)
			return next()
		case 'surgeIfNot':
			if (!ctx.did) markSurge(g, src)
			return next()
		case 'activate': {
			const mode = s.mode === 'activate' ? (g.players[p].form === 'hero' ? 'attack' : 'scheme') : s.mode
			const jobs: Job[] = [activation(g, area, g.areas[area].villain, p, mode)]
			if (s.minions) for (const m of engaged(g, p)) jobs.push(activation(g, area, m.uid, p, mode))
			j.i++
			for (const jb of jobs.reverse()) g.jobs.push(jb)
			return false
		}
		case 'resource':
			g.players[p].pool += s.r
			log(g, `${srcName}: +${s.r.length} resource.`, p)
			return next()
		case 'discardRandom': {
			const who = s.each ? g.areas[area].players : [p]
			let any = false
			for (const q of who) {
				for (let k = 0; k < s.n; k++) {
					const h = g.players[q].hand
					if (!h.length) break
					const u = h[Math.floor(rand(g) * h.length)]
					moveTo(g, u, 'discard')
					log(g, `${g.players[q].name} discards ${nameOf(g, u)} at random.`, q)
					any = true
				}
			}
			ctx.did = any
			return next()
		}
		case 'discardControl': {
			const opts = playArea(g, p)
				.concat(Object.values(g.insts).filter((x) => x.ctrl === p && x.zone === 'play' && x.host !== undefined))
				.filter((x) => s.kinds.includes(card(x.code).t) && !kw(g, x.uid, 'permanent'))
				.map((x) => x.uid)
			if (!opts.length) {
				ctx.did = false
				return next()
			}
			if (j.pick === undefined || !opts.includes(j.pick)) {
				if (opts.length === 1) j.pick = opts[0]
				else {
					ask(g, { who: p, kind: 'target', options: opts, text: `${srcName}: choose a card you control to discard.`, why: 'discard', card: src })
					return false
				}
			}
			log(g, `${g.players[p].name} discards ${nameOf(g, j.pick)}.`, p)
			discard(g, j.pick)
			ctx.did = true
			return next()
		}
		case 'nemesis': {
			const pl = g.players[p]
			const nem = pl.nemesis.filter((u) => g.insts[u]?.zone === 'setAside')
			const minion = nem.find((u) => C(g, u).t === 'minion')
			const side = nem.find((u) => C(g, u).t === 'side_scheme')
			ctx.did = minion !== undefined
			if (minion !== undefined) {
				log(g, `${pl.name}'s nemesis appears: ${nameOf(g, minion)}!`, p)
				I(g, minion).zone = 'dealt'
				I(g, minion).ctrl = p
			}
			const rest = nem.filter((u) => u !== minion && u !== side)
			for (const u of rest) {
				I(g, u).zone = 'encDeck'
				g.areas[area].encDeck.push(u)
			}
			shuffle(g, g.areas[area].encDeck)
			pl.nemesis = []
			j.i++
			if (side !== undefined) {
				I(g, side).zone = 'dealt'
				g.jobs.push({ k: 'reveal', area, player: p, uid: side, step: 0, fromDeck: false })
			}
			if (minion !== undefined) g.jobs.push({ k: 'reveal', area, player: p, uid: minion, step: 0, fromDeck: false })
			return false
		}
		case 'dealEncounter': {
			const who = s.each ? g.areas[area].players.filter((q) => !g.players[q].out) : [p]
			for (const q of who) dealTo(g, q)
			log(g, `${srcName}: ${s.each ? 'each player is' : 'you are'} dealt an encounter card.`, p)
			return next()
		}
		case 'bonus': {
			const t = fixedTargets(g, s.who, ctx) ?? [g.players[p].ident]
			for (const u of t) {
				const x = I(g, u)
				x.bonus = { ...(x.bonus ?? {}), [s.stat]: (x.bonus?.[s.stat] ?? 0) + s.n }
			}
			return next()
		}
		case 'choose': {
			if (j.pick === undefined) {
				ask(g, { who: p, kind: 'choose', options: s.options.map((o) => o.label), text: `${srcName}: choose one.`, card: src })
				return false
			}
			const opt = s.options[j.pick]
			j.steps = [...j.steps.slice(0, j.i), ...(opt?.steps ?? []), ...j.steps.slice(j.i + 1)]
			j.pick = undefined
			return j.i >= j.steps.length
		}
		case 'counter': {
			const t = s.who ? (fixedTargets(g, s.who, ctx) ?? []) : [src]
			for (const u of t) {
				const x = g.insts[u]
				if (x) x.ctr = Math.max(0, x.ctr + s.n)
			}
			ctx.did = t.length > 0
			return next()
		}
		case 'choosePlayer': {
			const ps = g.areas[area].players.filter((q) => !g.players[q].out)
			if (ps.length <= 1) return next()
			if (j.pick === undefined) {
				ask(g, { who: p, kind: 'choose', options: ps.map((q) => g.players[q].name), text: `${srcName}: choose a player.`, card: src })
				return false
			}
			// later steps ("that player …") act for the chosen player
			j.ctx = { ...ctx, player: ps[j.pick] ?? p }
			return next()
		}
		case 'noop':
			return next()
		case 'attackPlus': {
			const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as Extract<Job, { k: 'activate' }> | undefined
			const n = nval(g, s.n, area, 0, p, src, ctx.that)
			if (aj) {
				aj.plus = (aj.plus ?? 0) + n
				if (n) log(g, `${srcName}: ${nameOf(g, aj.enemy)} gets +${n} ${s.stat.toUpperCase()} for this ${s.stat === 'atk' ? 'attack' : 'scheme'}.`, p)
			}
			return next()
		}
		case 'ifCounters': {
			j.i++
			if ((g.insts[src]?.ctr ?? 0) >= s.n) pushSteps(g, s.steps, ctx)
			return false
		}
		case 'ifHero': {
			j.i++
			if (g.players[p].form === 'hero') pushSteps(g, s.steps, ctx)
			return false
		}
		case 'minionsActivate': {
			j.i++
			const ms = Object.values(g.insts).filter((x) => x.area === area && x.zone === 'engaged' && !g.players[x.ctrl]?.out)
			for (const m of ms.reverse()) g.jobs.push(activation(g, area, m.uid, m.ctrl, g.players[m.ctrl].form === 'hero' ? 'attack' : 'scheme'))
			return false
		}
		case 'engageSelf': {
			const x = g.insts[src]
			if (x) {
				x.zone = 'engaged'
				x.ctrl = p
				if (kw(g, src, 'toughness')) x.tough = 1
			}
			return next()
		}
		case 'shuffleOwnDeck': {
			const x = g.insts[src]
			if (x && x.owner >= 0) {
				moveTo(g, src, 'deck')
				shuffle(g, g.players[x.owner].deck)
			}
			return next()
		}
		case 'spendRes': {
			const pl = g.players[p]
			let need = s.n
			const fits = (r: string) => r === s.r || r === 'w'
			const paid: string[] = []
			for (let k = 0; k < pl.pool.length && need > 0; ) {
				if (fits(pl.pool[k])) {
					paid.push(pl.pool[k])
					pl.pool = pl.pool.slice(0, k) + pl.pool.slice(k + 1)
					need--
				} else k++
			}
			const cands = pl.hand
				.filter((u) => [...resourcesOf(g, u)].some(fits))
				.sort((a, b) => (C(g, a).t === 'resource' ? 0 : 1) - (C(g, b).t === 'resource' ? 0 : 1) || resourcesOf(g, a).length - resourcesOf(g, b).length)
			for (const u of cands) {
				if (need <= 0) break
				need -= [...resourcesOf(g, u)].filter(fits).length
				moveTo(g, u, 'discard')
				log(g, `${pl.name} spends ${nameOf(g, u)}.`, p)
			}
			ctx.did = need <= 0
			if (need > 0) {
				log(g, `${srcName}: not enough [${s.r}] resources, so the rest doesn't happen.`, p)
				j.i = j.steps.length
				return false
			}
			return next()
		}
		case 'redirectAttack': {
			const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as Extract<Job, { k: 'activate' }> | undefined
			if (aj && g.insts[src]?.zone === 'play') {
				aj.defender = src
				log(g, `${nameOf(g, aj.enemy)} attacks ${nameOf(g, src)} instead.`, p)
			}
			return next()
		}
		case 'statusOr': {
			const h = g.players[p].ident
			j.i++
			if ((g.insts[h]?.[s.s] ?? 0) > 0) pushSteps(g, s.alt, ctx)
			else setStatus(g, h, s.s)
			return false
		}
		case 'special': {
			const on = s.on.toLowerCase().replace(/^(the|each|1|a|an) /, '').replace(/ (?:you control|in play)$/, '')
			let cards: number[]
			if (/^(this card|it|its)$/.test(on)) cards = [src]
			else {
				const byName = named(g, area, on)
				if (byName.length) cards = byName
				else {
					// "Setting environment", "Black Panther upgrade"
					const m = on.match(/^(.+?) (environment|upgrade|support|attachment|side scheme|minion|card)s?$/)
					const trait = (m?.[1] ?? on).toLowerCase()
					const kind = m?.[2]?.replace(' ', '_')
					cards = Object.values(g.insts)
						.filter((x) => x.area === area && IN_PLAY.includes(x.zone) && (!s.mine || x.ctrl === p) && (!kind || kind === 'card' || card(x.code).t === kind) && ((card(x.code).tr ?? '').toLowerCase().includes(trait) || card(x.code).n.toLowerCase() === trait))
						.map((x) => x.uid)
				}
			}
			if (s.one) cards = cards.slice(0, 1)
			j.i++
			const label = s.label?.toLowerCase()
			for (const u of [...cards].reverse()) {
				const ab = P(g, u).abilities.filter((a) => a.timing === 'special' && (!label || a.label?.toLowerCase() === label))
				for (const a of [...ab].reverse()) pushSteps(g, a.steps, { ...ctx, src: u })
			}
			if (!cards.length) log(g, `${srcName}: nothing to resolve.`, p)
			return false
		}
		case 'dealThatUnlessSet': {
			const u = ctx.that
			const want = s.set.toLowerCase().replace(/^the /, '')
			if (u !== undefined && g.insts[u]) {
				const set = (C(g, u).st ?? '').toLowerCase().replace(/^the /, '').replace(/_/g, ' ')
				if (!set.includes(want.replace(/^the /, ''))) {
					const x = I(g, u)
					moveTo(g, u, 'encDiscard')
					g.areas[area].encDiscard = g.areas[area].encDiscard.filter((v) => v !== u)
					x.zone = 'dealt'
					x.ctrl = p
					log(g, `${srcName}: ${nameOf(g, u)} is dealt to ${g.players[p].name} facedown.`, p)
				}
			}
			return next()
		}
		case 'branch': {
			j.i++
			let rows: number[] = []
			if (s.mode === 'res') {
				const u = ctx.that
				const res = u !== undefined && g.insts[u] ? resourcesOf(g, u) : ''
				const names: Record<string, string> = { physical: 'p', energy: 'e', mental: 'm', wild: 'w' }
				if (res.includes('w')) rows = s.rows.map((_, k) => k)
				else rows = s.rows.map((r, k) => (res.includes(names[r.cond] ?? '?') ? k : -1)).filter((k) => k >= 0)
			} else if (s.mode === 'form') {
				const f = g.players[p].form === 'hero' ? 'hero' : 'alter-ego'
				rows = s.rows.map((r, k) => (r.cond.toLowerCase().startsWith(f) ? k : -1)).filter((k) => k >= 0)
			} else {
				// the player says which line applies
				pushSteps(g, [{ k: 'choose', options: [...s.rows.map((r) => ({ label: r.cond, steps: r.steps })), { label: 'None of these', steps: [] }] }], ctx)
				return false
			}
			for (const k of rows.reverse()) pushSteps(g, s.rows[k].steps, ctx)
			return false
		}
		case 'fdBoost': {
			const t = s.who === 'thisEnemy' ? [src] : (refs(s.who) ?? [])
			for (const u of t) if (g.insts[u]) g.insts[u].fdBoost = (g.insts[u].fdBoost ?? 0) + s.n
			if (s.discardSelf && g.insts[src]) discard(g, src)
			if (t.length) log(g, `${srcName}: ${t.map((u) => nameOf(g, u)).join(', ')} get${t.length > 1 ? '' : 's'} ${s.n} facedown boost card${s.n > 1 ? 's' : ''} for the next activation.`, p)
			return next()
		}
		case 'pick': {
			const t = refs(s.who)
			if (!t) return false
			ctx.that = t[0]
			return next()
		}
		case 'putThat': {
			const u = ctx.that
			if (u !== undefined && g.insts[u] && g.insts[u].owner >= 0) putIntoPlay(g, u, p)
			return next()
		}
		case 'clearStatus': {
			const t = refs(s.who)
			if (!t) return false
			for (const u of t) {
				const x = g.insts[u]
				if (!x) continue
				const which = s.s ?? (x.stun ? 'stun' : x.conf ? 'conf' : 'tough')
				if (x[which] > 0) x[which]--
			}
			return next()
		}
		case 'discardEnvTrait': {
			const tr = s.trait.toLowerCase()
			for (const x of inZone(g, area, 'env')) if (x.uid !== src && (card(x.code).tr ?? '').toLowerCase().includes(tr)) discard(g, x.uid)
			return next()
		}
		case 'later':
			g.later = [...(g.later ?? []), { when: s.when === 'phase' && g.phase !== 'player' ? 'round' : s.when, steps: s.steps, ctx: { ...ctx } }]
			return next()
		case 'ifPvp':
			j.i++
			if (g.mode === 'pvp') pushSteps(g, s.steps, ctx)
			return false
		case 'deckUntil': {
			const pl = g.players[p]
			const ok = cardFilter(s.what)
			let found: number | undefined
			while (pl.deck.length) {
				const u = pl.deck[0]
				moveTo(g, u, 'discard')
				if (ok(C(g, u))) {
					found = u
					break
				}
			}
			ctx.that = found
			ctx.did = found !== undefined
			if (found !== undefined) {
				log(g, `${srcName}: ${pl.name} discards down to ${nameOf(g, found)}.`, p)
				if (s.then === 'hand') moveTo(g, found, 'hand')
				if (s.then === 'play') putIntoPlay(g, found, p)
			}
			return next()
		}
		case 'win':
			g.areas[area].result = 'win'
			log(g, `${srcName}: the players win!`)
			return next()
		case 'encReshuffle': {
			const ar = g.areas[area]
			ar.encDeck = shuffle(g, [...ar.encDeck, ...ar.encDiscard.splice(0)])
			for (const u of ar.encDeck) I(g, u).zone = 'encDeck'
			return next()
		}
		case 'accel':
			I(g, g.areas[area].main).ctr += s.n
			log(g, `${srcName}: +${s.n} acceleration on the main scheme.`)
			return next()
		case 'defeat': {
			const t = refs(s.who)
			if (!t) return false
			for (const u of t) if (g.insts[u]?.zone === 'engaged' && !/\belite\b/i.test(C(g, u).tr ?? '')) defeatMinion(g, u)
			return next()
		}
		case 'shield': {
			const v = I(g, g.areas[area].villain)
			v.bonus = { ...(v.bonus ?? {}), shield: 1 }
			return next()
		}
		case 'otherwise': {
			j.i++
			if (!ctx.did) pushSteps(g, s.steps, ctx)
			return false
		}
		case 'ifInPlay': {
			const here = named(g, area, s.name).length > 0
			j.i++
			if (here !== s.not) pushSteps(g, s.steps, ctx)
			else ctx.did = false
			return false
		}
		case 'ifStatus': {
			const t = fixedTargets(g, s.who, ctx) ?? []
			const has = t.some((u) => (g.insts[u]?.[s.s] ?? 0) > 0)
			j.i++
			if (has) pushSteps(g, s.steps, ctx)
			return false
		}
		case 'forEachPlayer': {
			j.i++
			const ps = rotate(g.areas[area].players, g.areas[area].first).filter((q) => !g.players[q].out)
			for (const q of [...ps].reverse()) pushSteps(g, s.steps, { ...ctx, player: q })
			return false
		}
		case 'drone': {
			const ps = s.each ? g.areas[area].players.filter((q) => !g.players[q].out) : [s.first ? g.areas[area].players[g.areas[area].first] : p]
			for (const q of ps) {
				const pl = g.players[q]
				for (let k = 0; k < s.n; k++) {
					if (!pl.deck.length) break
					const u = pl.deck.shift()!
					const x = I(g, u)
					x.zone = 'engaged'
					x.ctrl = q
					x.facedown = true
					log(g, `${pl.name} gets a Drone (the top card of their deck, facedown).`, q)
				}
			}
			ctx.did = true
			return next()
		}
		case 'revealTop': {
			const u = drawEncounter(g, area)
			j.i++
			if (u !== null) {
				I(g, u).zone = 'dealt'
				I(g, u).ctrl = p
				g.jobs.push({ k: 'reveal', area, player: p, uid: u, step: 0, fromDeck: true })
			}
			return false
		}
		case 'enemyAttacks': {
			const t = fixedTargets(g, s.who, ctx) ?? []
			j.i++
			for (const u of t) if (g.insts[u]?.zone === 'engaged' || g.insts[u]?.zone === 'villain') g.jobs.push(activation(g, area, u, p, 'attack'))
			return false
		}
		case 'discardAfterAttack': {
			const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as (Job & { discardAfter?: number[] }) | undefined
			if (aj) aj.discardAfter = [...(aj.discardAfter ?? []), src]
			return next()
		}
		case 'thatCard':
		case 'manualLook':
			return next()
		case 'lookTop': {
			const pl = g.players[p]
			const top = pl.deck.slice(0, s.n)
			if (!top.length) return next()
			if (j.pick === undefined || !top.includes(j.pick)) {
				if (top.length === 1) j.pick = top[0]
				else {
					ask(g, { who: p, kind: 'searchPick', options: top, text: `${srcName}: pick a card for your hand (the others are discarded).`, card: src })
					return false
				}
			}
			moveTo(g, j.pick, 'hand')
			for (const u of top) if (u !== j.pick && pl.deck.includes(u)) moveTo(g, u, 'discard')
			return next()
		}
		case 'traitAttack': {
			const trait = s.trait.toLowerCase()
			const list = Object.values(g.insts).filter(
				(x) => x.area === area && x.zone === 'engaged' && (!s.mine || x.ctrl === p) && ((trait === 'drone' && x.facedown) || (card(x.code).tr ?? '').toLowerCase().includes(trait)),
			)
			ctx.did = list.length > 0
			j.i++
			for (const x of [...list].reverse()) if (g.players[x.ctrl]?.form === 'hero') g.jobs.push(activation(g, area, x.uid, x.ctrl, 'attack'))
			return false
		}
		case 'encSearch': {
			const ar = g.areas[area]
			const what = s.what.toLowerCase().replace(/^(the|a|an) /, '').replace(/[.]$/, '')
			const kind = what.match(/\b(minion|side scheme|treachery|attachment|environment)$/)?.[1]?.replace(' ', '_')
			const core = what.replace(/\s*\b(minion|side scheme|treachery|attachment|environment|card)$/, '').trim()
			const pool = [...ar.encDeck, ...(s.discard ? ar.encDiscard : []), ...Object.values(g.insts).filter((x) => x.area === area && x.zone === 'setAside').map((x) => x.uid)]
			const fits = (u: number) => {
				const c = C(g, u)
				if (kind && c.t !== kind) return false
				if (!core) return true
				const tr = (c.tr ?? '').toLowerCase()
				return c.n.toLowerCase() === core || tr.split(/\.\s*/).includes(core) || (core.split(' ').length > 1 && c.n.toLowerCase().startsWith(core))
			}
			const found = pool.find(fits)
			ctx.did = found !== undefined
			j.i++
			if (found === undefined) {
				log(g, `${srcName}: no “${s.what}” found.`, p)
				return false
			}
			ar.encDeck = ar.encDeck.filter((u) => u !== found)
			ar.encDiscard = ar.encDiscard.filter((u) => u !== found)
			shuffle(g, ar.encDeck)
			const x = I(g, found)
			x.ctrl = p
			log(g, `${srcName}: ${nameOf(g, found)} is found.`, p)
			if (s.then === 'hand') {
				moveTo(g, found, 'encDiscard')
			} else if (s.then === 'reveal') {
				x.zone = 'dealt'
				g.jobs.push({ k: 'reveal', area, player: p, uid: found, step: 0, fromDeck: false })
			} else {
				// put into play: no "When Revealed"
				const c = card(x.code)
				if (c.t === 'minion') {
					x.zone = 'engaged'
					if (kw(g, found, 'toughness')) x.tough = 1
				} else if (c.t === 'side_scheme') {
					x.zone = 'side'
					x.thr = (c.bt ?? 0) * (has(c, 'btF') ? 1 : perHero(g, area))
				} else if (c.t === 'attachment') {
					x.zone = 'attached'
					const h = s.host ? (fixedTargets(g, s.host, ctx) ?? [])[0] : undefined
					x.host = h ?? attachHost(g, area, parse(c).attach) ?? ar.villain
				} else if (c.t === 'environment') x.zone = 'env'
				else {
					x.zone = 'dealt'
					g.jobs.push({ k: 'reveal', area, player: p, uid: found, step: 0, fromDeck: false })
				}
			}
			return false
		}
		case 'encMill': {
			const ar = g.areas[area]
			let k = 0
			let last: number | undefined
			while (k < s.n) {
				const u = drawEncounter(g, area)
				if (u === null) break
				moveTo(g, u, 'encDiscard')
				last = u
				k++
				if (s.until && (C(g, u).t === s.until.toLowerCase().replace(' ', '_') || (C(g, u).tr ?? '').toLowerCase().includes(s.until.toLowerCase()))) break
			}
			ctx.that = last
			ctx.did = k > 0
			if (k) log(g, `${srcName}: ${k} encounter card${k > 1 ? 's' : ''} discarded${last !== undefined ? ` (last: ${nameOf(g, last)})` : ''}.`, p)
			void ar
			return next()
		}
		case 'deckMill': {
			const ps = s.each ? g.areas[area].players.filter((q) => !g.players[q].out) : [p]
			for (const q of ps) for (let k = 0; k < s.n && g.players[q].deck.length; k++) moveTo(g, g.players[q].deck[0], 'discard')
			ctx.did = true
			return next()
		}
		case 'discardHand': {
			// "Choose and discard 1 card from your hand": you pick
			if (!s.random && !s.each) {
				const pl = g.players[p]
				j.picks ??= []
				if (j.pick !== undefined && pl.hand.includes(j.pick)) {
					moveTo(g, j.pick, 'discard')
					log(g, `${pl.name} discards ${nameOf(g, j.pick)}.`, p)
					j.picks.push(j.pick)
					j.pick = undefined
				}
				if (j.picks.length < s.n && pl.hand.length) {
					ask(g, { who: p, kind: 'searchPick', options: [...pl.hand], text: `${srcName}: choose a card to discard from your hand.`, card: src })
					return false
				}
				ctx.did = j.picks.length > 0
				j.picks = undefined
				return next()
			}
			const ps = s.each ? g.areas[area].players.filter((q) => !g.players[q].out) : [p]
			let any = false
			for (const q of ps) {
				for (let k = 0; k < s.n; k++) {
					const h = g.players[q].hand
					if (!h.length) break
					// a player's own choice where the card says so would be nicer; at random keeps the game moving
					const u = h[Math.floor(rand(g) * h.length)]
					moveTo(g, u, 'discard')
					log(g, `${g.players[q].name} discards ${nameOf(g, u)}.`, q)
					any = true
				}
			}
			ctx.did = any
			return next()
		}
		case 'shuffleIn': {
			const x = g.insts[src]
			if (x) {
				moveTo(g, src, 'encDeck')
				shuffle(g, g.areas[area].encDeck)
			}
			return next()
		}
		case 'attachSelf': {
			const t = fixedTargets(g, s.who, ctx) ?? targetsFor(g, s.who, ctx)
			const x = g.insts[src]
			if (x && t.length) {
				x.zone = x.owner >= 0 ? 'play' : 'attached'
				x.host = t[0]
			}
			return next()
		}
		case 'exhaustHeroCost': {
			heroOf(g, p).ex = true
			return next()
		}
		case 'search': {
			const pl = g.players[p]
			const ok = cardFilter(s.what)
			const pool = s.zone === 'discard' ? [...pl.discard] : [...(s.top ? pl.deck.slice(0, s.top) : pl.deck), ...(s.zone === 'deckDiscard' ? pl.discard : [])]
			const match = [...new Set(pool.filter((u) => ok(C(g, u))))]
			if (!match.length) {
				log(g, `${srcName}: nothing found for “${s.what}”.`, p)
				ctx.did = false
				if (s.zone !== 'discard') pl.deck = shuffle(g, pl.deck)
				return next()
			}
			if (j.pick === undefined || !match.includes(j.pick)) {
				if (match.length === 1) j.pick = match[0]
				else {
					const verb = s.then === 'play' ? 'put into play' : s.then === 'top' ? 'put on top of your deck' : s.then === 'shuffle' ? 'shuffle into your deck' : 'add to your hand'
					ask(g, { who: p, kind: 'searchPick', options: match, text: `${srcName}: choose a card to ${verb}.`, card: src })
					return false
				}
			}
			const u = j.pick
			ctx.that = u
			if (s.then === 'play') putIntoPlay(g, u, p)
			else if (s.then === 'top') {
				moveTo(g, u, 'deck')
			} else if (s.then === 'shuffle') {
				moveTo(g, u, 'deck')
				pl.deck = shuffle(g, pl.deck)
			} else moveTo(g, u, 'hand')
			if (s.zone !== 'discard' && s.then !== 'top') pl.deck = shuffle(g, pl.deck)
			log(g, `${pl.name}: ${nameOf(g, u)} ${s.then === 'play' ? 'enters play' : s.then === 'top' ? 'goes on top of the deck' : s.then === 'shuffle' ? 'is shuffled into the deck' : 'goes to their hand'}.`, p)
			ctx.did = true
			return next()
		}
		case 'flip':
			flip(g, p, true)
			return next()
		case 'returnHand':
			if (g.insts[src] && g.insts[src].owner >= 0) moveTo(g, src, 'hand')
			return next()
		case 'discardSelf':
			if (g.insts[src] && !['discard', 'encDiscard', 'hand'].includes(g.insts[src].zone)) discard(g, src)
			return next()
		case 'removeSelf':
			if (g.insts[src]) moveTo(g, src, 'removed')
			return next()
		case 'prevent': {
			const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as (Job & { prevented?: number | 'all' }) | undefined
			if (aj) aj.prevented = s.n === 'all' ? 'all' : ((typeof aj.prevented === 'number' ? aj.prevented : 0) + s.n)
			return next()
		}
		case 'cancel': {
			const rj = [...g.jobs].reverse().find((x) => x.k === 'reveal') as (Job & { cancelled?: boolean }) | undefined
			if (rj) rj.cancelled = true
			return next()
		}
		case 'mill': {
			const pl = g.players[p]
			for (let k = 0; k < s.n && pl.deck.length; k++) {
				const u = pl.deck[0]
				moveTo(g, u, 'discard')
				ctx.that = u
				log(g, `${srcName}: ${pl.name} discards ${nameOf(g, u)} from the top of their deck.`, p)
			}
			return next()
		}
		case 'attackGains':
		case 'extraBoost': {
			const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as Extract<Job, { k: 'activate' }> | undefined
			if (aj && s.k === 'attackGains') aj.gains.push(s.kw)
			if (aj && s.k === 'extraBoost') aj.extra += s.n
			return next()
		}
		case 'revealThis':
		case 'resolveRevealed': {
			const ab = P(g, src).abilities.filter((a) => a.timing === 'whenRevealed')
			j.i++
			for (const a of ab) pushSteps(g, a.steps, ctx)
			return false
		}
		case 'manual': {
			// collect consecutive manual lines into one prompt
			const lines: string[] = []
			let k = j.i
			while (k < j.steps.length && j.steps[k].k === 'manual') {
				lines.push((j.steps[k] as { text: string }).text)
				k++
			}
			if (j.pick === undefined) {
				ask(g, { who: p, kind: 'manual', lines, card: src, text: `${srcName}: do this with the table tools, then tap Done.` })
				return false
			}
			j.i = k
			j.pick = undefined
			return j.i >= j.steps.length
		}
	}
	return next()
}

function markSurge(g: Game, src: number) {
	const rj = [...g.jobs].reverse().find((x) => x.k === 'reveal' && x.uid === src) as (Job & { surged?: boolean }) | undefined
	if (rj) rj.surged = true
	else {
		// surge from a card that isn't being revealed (e.g. a boost): nothing to do
	}
}

/** Resolve these steps as if card `src` did them (for tests and the table tools). */
export function resolveSteps(g0: Game, steps: Step[], ctx: Ctx): Game {
	const g = structuredClone(g0)
	pushSteps(g, steps, ctx)
	run(g)
	return g
}

export function describe(s: Step): string {
	switch (s.k) {
		case 'dmg':
			return `deal ${typeof s.n === 'number' ? s.n : 'X'} damage`
		case 'thwart':
			return `remove ${typeof s.n === 'number' ? s.n : 'X'} threat`
		case 'heal':
			return `heal ${s.n === 'all' ? 'all' : typeof s.n === 'number' ? s.n : 'X'} damage`
		case 'status':
			return { stun: 'stun', conf: 'confuse', tough: 'give a tough status' }[s.s]
		case 'ready':
			return 'ready'
		case 'exhaust':
			return 'exhaust'
		default:
			return s.k
	}
}

// ───────── player actions ─────────

function flip(g: Game, p: number, free = false) {
	const pl = g.players[p]
	if (!free) pl.flippedThisRound = true
	pl.form = pl.form === 'hero' ? 'alter' : 'hero'
	const h = heroOf(g, p)
	h.code = pl.form === 'hero' ? pl.hero : pl.alter
	log(g, `${pl.name} flips to ${formCard(g, p).n}.`, p)
}

/** Why a card can't be played right now (null = it can). */
export function playProblem(g: Game, p: number, uid: number): string | null {
	const pl = g.players[p]
	const i = g.insts[uid]
	if (!i || !pl.hand.includes(uid)) return 'not in your hand'
	const c = card(i.code)
	if (c.t === 'resource') return 'resource cards are only used to pay for other cards'
	const pr = parse(c, card(pl.alter).n)
	if (pr.formOnly && pr.formOnly !== pl.form) return `${pr.formOnly === 'hero' ? 'Hero' : 'Alter-ego'} form only`
	if (c.t === 'event') {
		const ab = pr.abilities[0]
		if (ab?.form && ab.form !== pl.form) return `${ab.form === 'hero' ? 'Hero' : 'Alter-Ego'} only`
		if (ab?.window && (ab.timing === 'interrupt' || ab.timing === 'response')) return `play it ${ab.trigger?.replace(/^when/i, 'when').replace(/^after/i, 'after') ?? 'at its moment'} — the game will offer it then`
	}
	if (c.u && Object.values(g.insts).some((x) => x.ctrl === p && ['play', 'identity'].includes(x.zone) && card(x.code).n === c.n)) return 'unique: one is already in play'
	if (!affordable(g, p, c.cost ?? 0, [uid])) return `costs ${c.cost ?? 0}: not enough resources`
	return null
}

export function canAct(g: Game, p: number) {
	return g.phase === 'player' && g.active === p && !g.queue.length && !g.jobs.length
}

export function apply(g0: Game, it: Intent): Game {
	const g: Game = structuredClone(g0)
	g.banner = undefined
	const p = it.player
	const pl = g.players[p]
	const ctx = (src: number): Ctx => ({ area: pl.area, player: p, src })
	const head = g.queue[0]
	switch (it.t) {
		case 'mulligan': {
			if (!head || head.kind !== 'mulligan' || head.who !== p) throw new Error('not now')
			for (const u of it.cards) if (pl.hand.includes(u)) moveTo(g, u, 'discard')
			draw(g, p, Math.max(0, handSize(g, p) - pl.hand.length))
			if (it.cards.length) log(g, `${pl.name} mulligans ${it.cards.length} card(s).`, p)
			g.queue.shift()
			break
		}
		case 'answer': {
			if (!head || (head.who !== p && it.player !== -1)) throw new Error('not your decision')
			g.queue.shift()
			const job = g.jobs[g.jobs.length - 1]
			if (head.kind === 'defend') {
				const aj = [...g.jobs].reverse().find((x) => x.k === 'activate') as Extract<Job, { k: 'activate' }> | undefined
				const v = typeof it.value === 'number' ? it.value : null
				if (aj && v !== null && head.options.includes(v)) {
					aj.defender = v
					const d = I(g, v)
					d.ex = true
					if (d.zone !== 'identity') {
						// an ally defends: it takes the whole attack
						log(g, `${nameOf(g, v)} defends.`, p)
						aj.defender = v
					}
				}
			} else if (head.kind === 'window') {
				const v = typeof it.value === 'number' ? it.value : null
				const o = v !== null ? head.options[v] : undefined
				const wctx = (g as Game & { windowCtx?: Ctx }).windowCtx ?? ctx(pl.ident)
				if (o) {
					const x = I(g, o.uid)
					if (x.zone === 'hand') {
						const c = card(x.code)
						const pay = autoPay(g, p, c.cost ?? 0, [o.uid]) ?? []
						spend(g, p, c.cost ?? 0, pay)
						moveTo(g, o.uid, 'discard')
						log(g, `${pl.name} plays ${c.n}.`, p)
						const ab = parse(c, card(pl.alter).n).abilities[o.ab]
						pushSteps(g, ab.steps, { ...wctx, player: p, src: o.uid })
					} else {
						const ab = abilitiesOf(g, o.uid)[o.ab]
						payAbility(g, p, o.uid, o.ab, ab, [])
						pushSteps(g, ab.steps, { ...wctx, player: p, src: o.uid })
					}
				}
			} else if (head.kind === 'manual') {
				if (job?.k === 'steps') job.pick = 1
			} else if (head.kind === 'discardDown') {
				const v = Array.isArray(it.value) ? it.value : []
				for (const u of v) if (pl.hand.includes(u)) moveTo(g, u, 'discard')
			} else if ((head.kind === 'target' && head.why === 'attach') || head.kind === 'allyLimit') {
				// handled below
			} else if (job?.k === 'steps') {
				const v = typeof it.value === 'number' ? it.value : null
				if (v === null && head.kind === 'target' && head.skip) job.i++
				else if (v === null) job.i++ // declined: skip this step
				else job.pick = v
			}
			break
		}
		case 'flip': {
			if (!canAct(g, p)) throw new Error('not your turn')
			if (pl.flippedThisRound) throw new Error('you already changed form this round')
			flip(g, p)
			break
		}
		case 'basic': {
			if (!canAct(g, p)) throw new Error('not your turn')
			const h = heroOf(g, p)
			if (h.ex) throw new Error('your identity is exhausted')
			if (it.power === 'recover') {
				if (pl.form !== 'alter') throw new Error('recover is an alter-ego power')
				h.ex = true
				const n = heal(g, h.uid, stat(g, h.uid, 'rec'))
				log(g, `${pl.name} recovers ${n} damage.`, p)
				break
			}
			if (pl.form !== 'hero') throw new Error(`${it.power} is a hero power`)
			h.ex = true
			if (it.power === 'attack') {
				if (h.stun) {
					h.stun--
					log(g, `${heroName(g, p)} is stunned: the stun is removed instead of attacking.`, p)
					break
				}
				const t = it.target ?? null
				const opts = targetsFor(g, 'enemy', ctx(h.uid), true)
				if (t === null || !opts.includes(t)) throw new Error('choose an enemy you can attack')
				const n = stat(g, h.uid, 'atk')
				damage(g, t, n, ctx(h.uid))
				log(g, `${heroName(g, p)} attacks ${nameOf(g, t)} for ${n}.`, p)
				const r = kw(g, t, 'retaliate')
				if (r && g.insts[t]) {
					damage(g, h.uid, r, ctx(t))
					log(g, `${nameOf(g, t)} retaliates for ${r}.`, p)
				}
				afterAttack(g, p, h.uid)
			} else {
				if (h.conf) {
					h.conf--
					log(g, `${heroName(g, p)} is confused: the confusion is removed instead of thwarting.`, p)
					break
				}
				const t = it.target ?? null
				const opts = thwartTargets(g, p)
				if (t === null || !opts.includes(t)) throw new Error('choose a scheme you can thwart')
				const n = kw(g, t, 'assault') ? stat(g, h.uid, 'atk') : stat(g, h.uid, 'thw')
				const k = removeThreat(g, t, n, ctx(h.uid))
				log(g, `${heroName(g, p)} thwarts ${k} threat.`, p)
			}
			break
		}
		case 'ally': {
			if (!canAct(g, p)) throw new Error('not your turn')
			const a = I(g, it.uid)
			if (a.ctrl !== p || a.zone !== 'play' || card(a.code).t !== 'ally') throw new Error('not your ally')
			if (a.ex) throw new Error('that ally is exhausted')
			a.ex = true
			const c = card(a.code)
			if (it.power === 'attack') {
				if (a.stun) {
					a.stun--
					break
				}
				const opts = targetsFor(g, 'enemy', ctx(a.uid), true)
				const t = it.target ?? null
				if (t === null || !opts.includes(t)) throw new Error('choose an enemy you can attack')
				damage(g, t, stat(g, a.uid, 'atk'), ctx(a.uid))
				log(g, `${c.n} attacks ${nameOf(g, t)} for ${stat(g, a.uid, 'atk')}.`, p)
				const r = kw(g, t, 'retaliate')
				if (r && g.insts[t]) damage(g, a.uid, r, ctx(t))
				if (c.ac) damage(g, a.uid, c.ac, ctx(a.uid))
			} else {
				if (a.conf) {
					a.conf--
					break
				}
				const opts = thwartTargets(g, p)
				const t = it.target ?? null
				if (t === null || !opts.includes(t)) throw new Error('choose a scheme you can thwart')
				const k = removeThreat(g, t, stat(g, a.uid, 'thw'), ctx(a.uid))
				log(g, `${c.n} thwarts ${k} threat.`, p)
				if (c.tc) damage(g, a.uid, c.tc, ctx(a.uid))
			}
			break
		}
		case 'play': {
			if (!canAct(g, p)) throw new Error('not your turn')
			const why = playProblem(g, p, it.uid)
			if (why) throw new Error(why)
			const c = C(g, it.uid)
			const pay = it.pay.length || (c.cost ?? 0) <= pl.pool.length ? it.pay : (autoPay(g, p, c.cost ?? 0, [it.uid]) ?? [])
			if (!spend(g, p, c.cost ?? 0, pay.filter((u) => u !== it.uid))) throw new Error('not enough resources')
			const pr = parse(c, card(pl.alter).n)
			log(g, `${pl.name} plays ${c.n}${c.cost ? ` (pays ${c.cost})` : ''}.`, p)
			if (c.t === 'event') {
				moveTo(g, it.uid, 'discard')
				const ab = pr.abilities.find((a) => a.timing === 'action' || a.timing === 'response' || a.timing === 'interrupt') ?? pr.abilities[0]
				if (ab) {
					const job: Job & { attack?: boolean } = { k: 'steps', steps: ab.steps, ctx: ctx(it.uid), i: 0, pick: it.target }
					if (ab.tag === 'attack') job.attack = true
					g.jobs.push(job)
					if (ab.tag === 'attack') afterAttack(g, p, pl.ident)
				}
			} else {
				const i = I(g, it.uid)
				moveTo(g, it.uid, 'play')
				i.ctrl = p
				if (pr.uses) i.ctr = pr.uses
				if (pr.attach) {
					const opts = attachTargets(g, p, pr.attach)
					const host = it.target !== undefined && opts.includes(it.target) ? it.target : opts.length === 1 ? opts[0] : undefined
					if (host !== undefined) i.host = host
					else if (opts.length) ask(g, { who: p, kind: 'target', options: opts, text: `Attach ${c.n} to…`, why: 'attach', card: it.uid })
				}
				if (c.t === 'ally' && allies(g, p).length > 3) ask(g, { who: p, kind: 'allyLimit', text: 'You can have 3 allies: choose one to discard.' })
				for (const ab of pr.abilities) if (ab.window === 'played') pushSteps(g, ab.steps, ctx(it.uid))
				if (kw(g, it.uid, 'toughness')) i.tough = 1
			}
			break
		}
		case 'ability': {
			const x = I(g, it.uid)
			const abs = abilitiesOf(g, it.uid)
			const ab = abs[it.ab]
			if (!ab) throw new Error('no such ability')
			if (ab.timing === 'resource') {
				// resource abilities can be used any time you could pay
			} else if (!canAct(g, p)) throw new Error('not your turn')
			if (ab.form && ab.form !== pl.form) throw new Error(`${ab.form === 'hero' ? 'Hero' : 'Alter-Ego'} form only`)
			if (usedUp(g, it.uid, it.ab, ab)) throw new Error('already used')
			if (!canPayCost(g, p, it.uid, ab)) throw new Error("you can't pay that cost")
			payAbility(g, p, it.uid, it.ab, ab, it.pay ?? [])
			log(g, `${pl.name} uses ${nameOf(g, it.uid)}.`, p)
			const job: Job & { attack?: boolean } = { k: 'steps', steps: ab.steps, ctx: ctx(it.uid), i: 0, pick: it.target }
			if (ab.tag === 'attack') job.attack = true
			g.jobs.push(job)
			void x
			break
		}
		case 'endTurn': {
			if (!canAct(g, p)) throw new Error('not your turn')
			for (const u of it.discard ?? []) if (pl.hand.includes(u)) moveTo(g, u, 'discard')
			nextTurn(g)
			break
		}
		case 'tool': {
			tool(g, p, it.uid, it.op)
			break
		}
		case 'draw': {
			draw(g, p, 1)
			log(g, `${pl.name} draws a card (table tool).`, p)
			break
		}
		case 'concede': {
			for (const ar of g.areas) if (ar.players.includes(p)) ar.result = 'lose'
			break
		}
	}
	// ally limit prompt answered
	if (it.t === 'answer' && head?.kind === 'allyLimit' && typeof it.value === 'number') discard(g, it.value)
	// attach target answered
	if (it.t === 'answer' && head?.kind === 'target' && head.why === 'attach' && typeof it.value === 'number' && head.card) I(g, head.card).host = it.value
	run(g)
	return g
}

function afterAttack(g: Game, p: number, attacker: number) {
	void g
	void p
	void attacker
}

function payAbility(g: Game, p: number, uid: number, k: number, ab: Ability, pay: number[]) {
	const x = I(g, uid)
	for (const c of ab.cost) {
		if (c.k === 'exhaust') x.ex = true
		if (c.k === 'counter') {
			x.ctr -= c.n
			x.used = [...(x.used ?? []), -1]
		}
		if (c.k === 'res') spend(g, p, c.n, pay.length ? pay : (autoPay(g, p, c.n, []) ?? []))
		if (c.k === 'discardThis') discard(g, uid)
	}
	markUsed(g, uid, k, ab)
}

export function thwartTargets(g: Game, p: number): number[] {
	const area = g.players[p].area
	const ar = g.areas[area]
	const patrol = engaged(g, p).some((m) => kw(g, m.uid, 'patrol'))
	return schemes(g, area).filter((u) => !(u === ar.main && (crisis(g, area) || patrol)))
}
export function attackTargets(g: Game, p: number): number[] {
	return targetsFor(g, 'enemy', { area: g.players[p].area, player: p, src: g.players[p].ident }, true)
}
export function attachTargets(g: Game, p: number, what: string): number[] {
	const area = g.players[p].area
	const w = what.toLowerCase()
	if (/minion/.test(w)) return minions(g, area).map((m) => m.uid)
	if (/enemy/.test(w)) return enemies(g, area)
	if (/villain/.test(w)) return [g.areas[area].villain]
	if (/ally/.test(w)) return allies(g, p).map((a) => a.uid)
	if (/character/.test(w)) return [g.players[p].ident, ...allies(g, p).map((a) => a.uid)]
	if (/scheme/.test(w)) return schemes(g, area)
	return [g.players[p].ident]
}

/** Table tools: fix anything by hand (like moving tokens on a real table). */
function tool(g: Game, p: number, uid: number, op: string) {
	const x = g.insts[uid]
	if (!x) return
	const n = nameOf(g, uid)
	switch (op) {
		case 'dmg+':
			x.dmg++
			break
		case 'dmg-':
			x.dmg = Math.max(0, x.dmg - 1)
			break
		case 'thr+':
			x.thr++
			break
		case 'thr-':
			if (x.zone === 'side' && x.thr === 1) removeThreat(g, uid, 1, { area: x.area, player: p, src: uid })
			else x.thr = Math.max(0, x.thr - 1)
			break
		case 'ctr+':
			x.ctr++
			break
		case 'ctr-':
			x.ctr = Math.max(0, x.ctr - 1)
			break
		case 'exhaust':
			x.ex = true
			break
		case 'ready':
			x.ex = false
			break
		case 'stun':
			x.stun = x.stun ? 0 : 1
			break
		case 'conf':
			x.conf = x.conf ? 0 : 1
			break
		case 'tough':
			x.tough = x.tough ? 0 : 1
			break
		case 'discard':
			if (x.zone === 'engaged') defeatMinion(g, uid)
			else discard(g, uid)
			break
		case 'defeat':
			if (x.zone === 'engaged') defeatMinion(g, uid)
			break
		case 'hand':
			if (x.owner >= 0) moveTo(g, uid, 'hand')
			break
		case 'reveal':
			if (x.zone === 'dealt') g.jobs.push({ k: 'reveal', area: x.area, player: x.ctrl, uid, step: 0, fromDeck: false })
			break
	}
	log(g, `(table) ${n}: ${op}`, p)
}

/** For the UI: what a card in play can do now. */
export function actionsFor(g: Game, p: number, uid: number): { label: string; intent: Intent; why?: string }[] {
	const out: { label: string; intent: Intent; why?: string }[] = []
	const x = g.insts[uid]
	if (!x) return out
	const pl = g.players[p]
	const my = canAct(g, p)
	if (x.zone === 'identity' && x.owner === p) {
		if (pl.form === 'hero') {
			out.push({ label: `Attack (${stat(g, uid, 'atk')})`, intent: { t: 'basic', player: p, power: 'attack' }, why: !my ? 'not your turn' : x.ex ? 'exhausted' : undefined })
			out.push({ label: `Thwart (${stat(g, uid, 'thw')})`, intent: { t: 'basic', player: p, power: 'thwart' }, why: !my ? 'not your turn' : x.ex ? 'exhausted' : undefined })
		} else out.push({ label: `Recover (${stat(g, uid, 'rec')})`, intent: { t: 'basic', player: p, power: 'recover' }, why: !my ? 'not your turn' : x.ex ? 'exhausted' : undefined })
		out.push({ label: pl.form === 'hero' ? `Flip to ${card(pl.alter).n}` : `Flip to ${card(pl.hero).n}`, intent: { t: 'flip', player: p }, why: !my ? 'not your turn' : pl.flippedThisRound ? 'already flipped this round' : undefined })
	}
	if (x.zone === 'play' && x.ctrl === p && card(x.code).t === 'ally') {
		out.push({ label: `Attack (${stat(g, uid, 'atk')})${card(x.code).ac ? ` · takes ${card(x.code).ac}` : ''}`, intent: { t: 'ally', player: p, uid, power: 'attack' }, why: !my ? 'not your turn' : x.ex ? 'exhausted' : undefined })
		out.push({ label: `Thwart (${stat(g, uid, 'thw')})${card(x.code).tc ? ` · takes ${card(x.code).tc}` : ''}`, intent: { t: 'ally', player: p, uid, power: 'thwart' }, why: !my ? 'not your turn' : x.ex ? 'exhausted' : undefined })
	}
	if ((x.zone === 'play' || x.zone === 'identity') && x.ctrl === p) {
		abilitiesOf(g, uid).forEach((ab, k) => {
			if (!['action', 'resource', 'response', 'interrupt'].includes(ab.timing)) return
			const why =
				ab.form && ab.form !== pl.form
					? `${ab.form === 'hero' ? 'hero' : 'alter-ego'} form only`
					: usedUp(g, uid, k, ab)
						? 'used'
						: !canPayCost(g, p, uid, ab)
							? "can't pay"
							: ab.timing !== 'resource' && !my
								? 'not your turn'
								: undefined
			const label = ab.text.replace(/^([^:]*):\s*/, (_, h) => `${h.replace(/ \(.+\)/, '')}: `)
			out.push({ label, intent: { t: 'ability', player: p, uid, ab: k }, why })
		})
	}
	return out
}

export const isOver = (g: Game) => g.phase === 'over'
