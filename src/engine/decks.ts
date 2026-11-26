// Starter decks: the hero's own cards + aspect cards + basic cards, 40 cards in all,
// built from the packs the player owns. Also reads MarvelCDB deck lists.
import { ASPECTS, CARDS, card, heroes, maybeCard, type CardData } from '../data/data'

export interface DeckList {
	name: string
	hero: string // hero set
	aspect: string
	cards: Record<string, number> // non-kit cards (code → copies)
}

/** Simple score: allies, cheap events and upgrades first. */
function score(c: CardData): number {
	let s = 0
	if (c.t === 'ally') s += 4
	if (c.t === 'upgrade' || c.t === 'support') s += 3
	if (c.t === 'event') s += 2
	if (c.t === 'resource') s += 1
	const cost = c.cost ?? 0
	s -= Math.max(0, cost - 2) * 0.6
	const t = c.x ?? ''
	if (/Deal \d+ damage|Remove \d+ threat|Draw \d+/i.test(t)) s += 1
	if (/campaign|Setup|Permanent/i.test(t)) s -= 3
	return s
}

/** Cards a hero may take: aspect cards of one aspect + basic (no other heroes' cards, no campaign cards). */
export function eligible(aspect: string, packs: Set<string> | null): CardData[] {
	const seen = new Set<string>()
	const out: CardData[] = []
	for (const c of CARDS) {
		if (c.f !== aspect && c.f !== 'basic') continue
		if (packs && !packs.has(c.p)) continue
		if (!['ally', 'event', 'upgrade', 'support', 'resource'].includes(c.t)) continue
		if (c.st && !/^$/.test(c.st) && c.f === 'basic' && /_leader$/.test(c.st)) continue
		if (seen.has(c.n + '|' + c.t)) continue // reprints
		seen.add(c.n + '|' + c.t)
		out.push(c)
	}
	return out
}

export function starterDeck(heroSet: string, aspect: string, packs: Set<string> | null, seed = 1): DeckList {
	const h = heroes().find((x) => x.set === heroSet)!
	const kitCount = h.kit.reduce((a, [, n]) => a + n, 0)
	const need = Math.max(25, 40 - kitCount)
	const pool = eligible(aspect, packs)
	let r = seed >>> 0 || 1
	const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296)
	const ranked = pool.map((c) => ({ c, s: score(c) + (c.f === aspect ? 1 : 0) + rnd() * 1.5 })).sort((a, b) => b.s - a.s)
	const cards: Record<string, number> = {}
	let n = 0
	let allies = 0
	let basics = 0
	for (const { c } of ranked) {
		if (n >= need) break
		const max = Math.min(c.dl ?? 3, 3)
		let k = c.t === 'ally' && c.u ? 1 : c.t === 'resource' ? Math.min(max, 1) : Math.min(max, 2)
		if (c.t === 'ally' && allies >= 7) continue
		if (c.f === 'basic' && basics >= 9) continue
		k = Math.min(k, need - n)
		if (k <= 0) continue
		cards[c.c] = k
		n += k
		if (c.t === 'ally') allies += k
		if (c.f === 'basic') basics += k
	}
	return { name: `${h.name} — ${aspect[0].toUpperCase()}${aspect.slice(1)}`, hero: heroSet, aspect, cards }
}

/** All the card codes for newGame: kit + list. */
export function deckCodes(d: DeckList): string[] {
	const h = heroes().find((x) => x.set === d.hero)!
	const out: string[] = []
	for (const [c, n] of h.kit) for (let k = 0; k < n; k++) out.push(c)
	for (const [c, n] of Object.entries(d.cards)) if (maybeCard(c)) for (let k = 0; k < n; k++) out.push(c)
	return out
}

/** A MarvelCDB deck (public API JSON) → DeckList. */
export function fromMarvelCdb(j: { name?: string; investigator_code?: string; hero_code?: string; slots: Record<string, number>; meta?: string }): DeckList | null {
	const heroCode = j.investigator_code ?? j.hero_code
	if (!heroCode) return null
	const hc = maybeCard(heroCode) ?? maybeCard(heroCode + 'a')
	const h = heroes().find((x) => x.code === hc?.c || x.set === hc?.st)
	if (!h) return null
	const kit = new Set(h.kit.map(([c]) => c))
	const cards: Record<string, number> = {}
	let aspect = 'basic'
	for (const [code, n] of Object.entries(j.slots)) {
		const c = maybeCard(code)
		if (!c || kit.has(code) || c.st === h.set) continue
		cards[code] = n
		if ((ASPECTS as readonly string[]).includes(c.f)) aspect = c.f
	}
	try {
		const m = j.meta ? JSON.parse(j.meta) : null
		if (m?.aspect) aspect = m.aspect
	} catch {}
	return { name: j.name ?? `${h.name} (MarvelCDB)`, hero: h.set, aspect, cards }
}

export const deckSize = (d: DeckList) => deckCodes(d).length
export const cardName = (code: string) => card(code).n
