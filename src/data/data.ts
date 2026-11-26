// Typed access to the MarvelCDB card data (src/data/cards.json, built by scripts/build-data.mjs).
import cardsJson from './cards.json'
import metaJson from './meta.json'
import imagesJson from './images.json'

export type CardType =
	| 'hero'
	| 'alter_ego'
	| 'ally'
	| 'event'
	| 'upgrade'
	| 'support'
	| 'resource'
	| 'player_side_scheme'
	| 'villain'
	| 'leader'
	| 'main_scheme'
	| 'side_scheme'
	| 'minion'
	| 'treachery'
	| 'attachment'
	| 'obligation'
	| 'environment'
	| 'evidence_means'
	| 'evidence_motive'
	| 'evidence_opportunity'

export interface CardData {
	c: string
	n: string
	t: CardType
	f: string
	p: string
	q: number
	img?: string
	s?: string
	st?: string
	x?: string
	tr?: string
	u?: number
	cost?: number
	atk?: number
	thw?: number
	def?: number
	rec?: number
	hp?: number
	hand?: number
	sch?: number
	stage?: string
	thr?: number
	bt?: number
	esc?: number
	boost?: number
	ac?: number
	tc?: number
	back?: string
	dl?: number
	pos?: number
	/** printed resources: m mental, e energy, p physical, w wild */
	res?: string
	fl?: string[]
	ic?: { acc?: number; haz?: number; cri?: number; amp?: number }
}

export interface PackInfo {
	code: string
	name: string
	date: string
	type: string
}
export interface SetInfo {
	code: string
	name: string
	type: string
	parent?: string
}

export const CARDS: CardData[] = cardsJson as CardData[]
export const PACKS: PackInfo[] = (metaJson as { packs: PackInfo[] }).packs
export const SETS: SetInfo[] = (metaJson as { sets: SetInfo[] }).sets
const BY = new Map(CARDS.map((c) => [c.c, c]))
const SET_BY = new Map(SETS.map((s) => [s.code, s]))
const PACK_BY = new Map(PACKS.map((p) => [p.code, p]))

export const card = (code: string): CardData => {
	const c = BY.get(code)
	if (!c) throw new Error(`Unknown card ${code}`)
	return c
}
export const maybeCard = (code: string) => BY.get(code)
export const setInfo = (code: string) => SET_BY.get(code)
export const packInfo = (code: string) => PACK_BY.get(code)
export const has = (c: CardData, flag: string) => !!c.fl?.includes(flag)
export const setCards = (set: string) => CARDS.filter((c) => c.st === set)

const IMG = imagesJson as { missing: string[]; jpg: string[]; local?: string[] }
/** pictures hosted with the game itself (public/cards/), for cards MarvelCDB lacks */
const LOCAL = new Set(IMG.local ?? [])
const NO_PIC = new Set(IMG.missing.filter((c) => !LOCAL.has(c)))
const JPG = new Set(IMG.jpg)
/** Does MarvelCDB have a picture of this card? (src/data/images.json, checked weekly) */
export const hasPicture = (code: string) => {
	const c = BY.get(code)
	return !!c && !NO_PIC.has(c.img ?? c.c)
}
/** Card picture on MarvelCDB (reprints use the original's picture): the file that exists, first. */
export function imageUrls(c: CardData): string[] {
	const code = c.img ?? c.c
	const b = 'https://marvelcdb.com/bundles/cards/'
	if (LOCAL.has(code)) return [`./cards/${code}.jpg`]
	if (NO_PIC.has(code)) return []
	return JPG.has(code) ? [`${b}${code}.jpg`, `${b}${code}.png`] : [`${b}${code}.png`, `${b}${code}.jpg`]
}
/** The first of these cards that has a picture (for menus). */
export const pictureOf = (...codes: string[]) => codes.find((c) => hasPicture(c)) ?? codes[0]

export const ASPECTS = ['aggression', 'justice', 'leadership', 'protection'] as const
export type Aspect = (typeof ASPECTS)[number]
export const ASPECT_NAME: Record<string, string> = {
	aggression: 'Aggression',
	justice: 'Justice',
	leadership: 'Leadership',
	protection: 'Protection',
	pool: "'Pool",
	basic: 'Basic',
}

// ───────── heroes ─────────

export interface HeroInfo {
	/** hero side code, e.g. 01001a */
	code: string
	alter: string
	name: string
	alterName: string
	set: string
	pack: string
	/** kit cards (code, copies), signature cards that come with the hero */
	kit: [string, number][]
	obligation?: string
	nemesis: string
}

let heroCache: HeroInfo[] | null = null
export function heroes(): HeroInfo[] {
	if (heroCache) return heroCache
	const list: HeroInfo[] = []
	const seen = new Set<string>()
	for (const h of CARDS) {
		if (h.t !== 'hero' || !h.st || !h.back || seen.has(h.st)) continue
		const a = maybeCard(h.back)
		if (!a) continue
		seen.add(h.st)
		const kit: [string, number][] = []
		for (const c of CARDS)
			if (c.st === h.st && c.f === 'hero' && !['hero', 'alter_ego'].includes(c.t) && !c.fl?.includes('hid')) kit.push([c.c, c.q])
		const obligation = CARDS.find((c) => c.st === h.st && c.t === 'obligation')?.c
		list.push({ code: h.c, alter: a.c, name: h.n, alterName: a.n, set: h.st, pack: h.p, kit, obligation, nemesis: `${h.st}_nemesis` })
	}
	heroCache = list
	return list
}
export const heroBySet = (set: string) => heroes().find((h) => h.set === set)

// ───────── scenarios ─────────

export interface Scenario {
	/** the villain encounter set code */
	id: string
	name: string
	pack: string
	villainName: string
	/** villain cards for standard and expert */
	standard: string[]
	expert: string[]
	/** main scheme fronts (stage xA) in order; backs via card.back */
	schemes: string[]
	/** encounter sets always used (villain set + named story sets), not standard/expert */
	sets: string[]
	/** recommended modular sets */
	modular: string[]
	/** number of modular sets to use by default */
	modularCount: number
	/** setups the game doesn't do automatically */
	special?: string
	pvp?: 'registration' | 'resistance'
}

const norm = (s: string) =>
	s
		.toLowerCase()
		.replace(/<[^>]+>/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()

function setsNamed(text: string): string[] {
	const t = ' ' + norm(text) + ' '
	const out: string[] = []
	for (const s of SETS) {
		if (['hero', 'nemesis', 'hero_special', 'standard', 'expert'].includes(s.type)) continue
		const n = norm(s.name)
		if (n.length < 3) continue
		if (t.includes(' ' + n + ' ')) out.push(s.code)
	}
	// "Brotherhood" inside "Brotherhood of Badoon" is not its own set
	const name = (c: string) => norm(setInfo(c)!.name)
	return out.filter((c) => !out.some((o) => o !== c && name(o).length > name(c).length && name(o).includes(name(c))))
}

const ROMAN = ['I', 'II', 'III', 'IV']
let scenarioCache: Scenario[] | null = null
export function scenarios(): Scenario[] {
	if (scenarioCache) return scenarioCache
	const list: Scenario[] = []
	const firsts = CARDS.filter((c) => c.t === 'main_scheme' && c.stage === '1A' && c.st)
	const usedSets = new Set<string>()
	for (const ms of firsts) {
		const set = ms.st!
		if (set === 'registration' || set === 'resistance' || set.startsWith('synthezoid_')) continue
		if (usedSets.has(set)) continue
		usedSets.add(set)
		const text = ms.x ?? ''
		const contents = (text.match(/Contents<\/b>:?([\s\S]*?)(?:<b>\s*Setup|$)/i)?.[1] ?? text.split('Setup')[0]).replace(/<[^>]+>/g, '')
		const named = setsNamed(contents)
		const recMatch = contents.match(/modular[^(]*\(([^)]*)\)/i)
		const modular = recMatch ? setsNamed(recMatch[1]).filter((s) => setInfo(s)?.type === 'modular') : []
		const nMod = contents.match(/(One|Two|Three|Four|\d) modular/i)?.[1]?.toLowerCase()
		const modularCount = nMod ? ({ one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[nMod] ?? Number(nMod) : modular.length
		const sets = [set, ...named.filter((s) => s !== set && !modular.includes(s))]
		const villains = CARDS.filter((c) => (c.t === 'villain' || c.t === 'leader') && c.st && sets.includes(c.st))
		const names = [...new Set(villains.map((v) => v.n))]
		const vname = names[0] ?? ms.n
		const mine = villains.filter((v) => v.n === vname)
		const byStage = (st: string) => mine.find((v) => v.stage === st)?.c
		let standard: string[] = []
		let expert: string[] = []
		if (byStage('I')) {
			standard = ['I', 'II'].map(byStage).filter(Boolean) as string[]
			expert = ['II', 'III'].map(byStage).filter(Boolean) as string[]
			if (!byStage('III')) expert = standard
		} else if (byStage('A') || byStage('A1')) {
			standard = (byStage('A1') ? ['A1', 'A2'] : ['A']).map(byStage).filter(Boolean) as string[]
			expert = (byStage('B1') ? ['B1', 'B2'] : ['B']).map(byStage).filter(Boolean) as string[]
			if (!expert.length) expert = standard
		} else if (byStage('II')) {
			standard = ['II', 'III'].map(byStage).filter(Boolean) as string[]
			expert = ['III'].map(byStage).filter(Boolean) as string[]
		} else if (mine.length) {
			standard = expert = [mine[0].c]
		}
		const schemes = CARDS.filter((c) => c.t === 'main_scheme' && c.st === set && /A$/.test(c.stage ?? '')).map((c) => c.c)
		let special: string | undefined
		if (names.length > 1) special = `Several villains (${names.join(', ')}): only ${vname} is put into play automatically.`
		if (/Underling/i.test(contents)) special = 'Uses a chosen Underling villain: pick it on the setup screen.'
		list.push({ id: set, name: ms.n, pack: ms.p, villainName: vname, standard, expert, schemes, sets, modular, modularCount: modularCount || (/modular/i.test(contents) ? 1 : 0), special })
	}
	// Civil War / Synthezoid Smackdown leaders (cooperative and competitive)
	const LEADERS: [string, 'registration' | 'resistance', string[], string[]][] = [
		['iron_man_leader', 'registration', ['56063a', '56064a'], ['mighty_avengers', 'the_initiative', 'maria_hill_modular', 'dangerous_recruits']],
		['captain_marvel_leader', 'registration', ['56096a', '56097a'], ['cape_killer', 'martial_law', 'heroes_for_hire', 'paladin']],
		['captain_america_leader', 'resistance', ['56141a', '56142a'], ['new_avengers', 'secret_avengers', 'namor_modular', 'atlanteans']],
		['spider_woman_leader', 'resistance', ['56172a', '56173a'], ['spider_man_modular', 'defenders', 'hells_kitchen', 'cloak_and_dagger_modular']],
	]
	for (const [set, side, schemes, modular] of LEADERS) {
		const ls = CARDS.filter((c) => c.t === 'leader' && c.st === set)
		if (!ls.length) continue
		const st = (s: string) => ls.find((l) => l.stage === s)?.c
		list.push({
			id: set,
			name: `${ls[0].n} (${side === 'registration' ? 'Registration' : 'Resistance'})`,
			pack: ls[0].p,
			villainName: ls[0].n,
			standard: [st('I'), st('II')].filter(Boolean) as string[],
			expert: [st('III'), st('IV')].filter(Boolean) as string[],
			schemes: schemes.filter((s) => maybeCard(s)),
			sets: [set],
			modular: modular.filter((m) => setInfo(m)),
			modularCount: 4,
			pvp: side,
		})
	}
	// Synthezoid Smackdown leaders: their own scheme set
	for (const [set, side, sch] of [
		['she_hulk_leader', 'registration', 'synthezoid_registration'],
		['vision_leader', 'resistance', 'synthezoid_resistance'],
	] as const) {
		const ls = CARDS.filter((c) => c.t === 'leader' && c.st === set)
		if (!ls.length) continue
		const st = (s: string) => ls.find((l) => l.stage === s)?.c
		const schemes = CARDS.filter((c) => c.t === 'main_scheme' && c.st === sch && /A$/.test(c.stage ?? '')).map((c) => c.c)
		const modular = SETS.filter((s) => s.type === 'modular' && CARDS.some((c) => c.st === s.code && c.p === ls[0].p)).map((s) => s.code)
		list.push({
			id: set,
			name: `${ls[0].n} (${side === 'registration' ? 'Registration' : 'Resistance'})`,
			pack: ls[0].p,
			villainName: ls[0].n,
			standard: [st('I'), st('II')].filter(Boolean) as string[],
			expert: [st('III'), st('IV')].filter(Boolean) as string[],
			schemes,
			sets: [set],
			modular,
			modularCount: Math.min(4, modular.length),
			pvp: side,
		})
	}
	scenarioCache = list.filter((s) => s.standard.length && s.schemes.length)
	return scenarioCache
}
export const scenarioById = (id: string) => scenarios().find((s) => s.id === id)

export const modularSets = () => SETS.filter((s) => s.type === 'modular' && CARDS.some((c) => c.st === s.code))

/** "[mental]" → icon text used in the UI */
export const RES_NAME: Record<string, string> = { m: 'mental', e: 'energy', p: 'physical', w: 'wild' }

/** A picture for a scenario in menus: its villains first, then any card from its sets that has one. */
export function scenarioPicture(s: Scenario): string {
	const villains = CARDS.filter((c) => (c.t === 'villain' || c.t === 'leader') && c.st && s.sets.includes(c.st)).map((c) => c.c)
	const inSets = CARDS.filter((c) => c.st && s.sets.includes(c.st))
	const rest = [...inSets.filter((c) => c.t === 'minion'), ...inSets.filter((c) => !['main_scheme', 'side_scheme', 'minion'].includes(c.t))].map((c) => c.c)
	return pictureOf(...s.standard, ...s.expert, ...villains, ...rest)
}
