// Builds src/data/cards.json and src/data/meta.json from a checkout of
// github.com/zzorba/marvelsdb-json-data (the MarvelCDB card data).
//   node scripts/build-data.mjs /path/to/marvelsdb-json-data
// Reprints ("duplicate_of") get the original card's fields; their picture stays the original's.
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2] || '/tmp/marvelsdb-json-data'
const read = (f) => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'))
const packs = read('packs.json')
const sets = read('sets.json')
const raw = []
for (const f of fs.readdirSync(path.join(src, 'pack')).sort()) {
	if (!f.endsWith('.json')) continue
	for (const c of read(path.join('pack', f))) raw.push(c)
}
const byCode = new Map(raw.map((c) => [c.code, c]))

const RES = { resource_mental: 'm', resource_energy: 'e', resource_physical: 'p', resource_wild: 'w' }
function compact(c) {
	let base = c
	let img = c.code
	if (c.duplicate_of) {
		const o = byCode.get(c.duplicate_of)
		if (!o) return null
		base = { ...o, ...c, set_code: c.set_code ?? o.set_code }
		img = o.code
	}
	if (!base.type_code) return null
	const o = { c: c.code, n: base.name, t: base.type_code, f: base.faction_code, p: c.pack_code, q: c.quantity ?? 1 }
	if (img !== c.code) o.img = img
	const put = (k, v) => {
		if (v !== undefined && v !== null && v !== '' && v !== false) o[k] = v
	}
	put('s', base.subname)
	put('st', base.set_code ?? base.card_set_code)
	put('x', base.text)
	put('tr', base.traits)
	put('u', base.is_unique ? 1 : 0)
	put('cost', base.cost)
	put('atk', base.attack)
	put('thw', base.thwart)
	put('def', base.defense)
	put('rec', base.recover)
	put('hp', base.health)
	put('hand', base.hand_size)
	put('sch', base.scheme)
	put('stage', base.stage)
	put('thr', base.threat)
	put('bt', base.base_threat)
	put('esc', base.escalation_threat)
	put('boost', base.boost)
	put('ac', base.attack_cost)
	put('tc', base.thwart_cost)
	put('back', base.back_link)
	put('dl', base.deck_limit)
	put('pos', base.set_position)
	let res = ''
	for (const [k, ch] of Object.entries(RES)) res += ch.repeat(base[k] ?? 0)
	put('res', res)
	const flags = []
	if (base.health_per_hero) flags.push('hpH')
	if (base.threat_fixed) flags.push('thrF')
	if (base.base_threat_fixed) flags.push('btF')
	if (base.escalation_threat_fixed) flags.push('escF')
	if (base.boost_star) flags.push('boostS')
	if (base.attack_star) flags.push('atkS')
	if (base.scheme_star) flags.push('schS')
	if (base.thwart_star) flags.push('thwS')
	if (base.health_star) flags.push('hpS')
	if (base.permanent) flags.push('perm')
	if (base.hidden) flags.push('hid')
	if (base.threat_star) flags.push('thrS')
	if (flags.length) o.fl = flags
	const icons = {}
	for (const [k, v] of [['scheme_acceleration', 'acc'], ['scheme_hazard', 'haz'], ['scheme_crisis', 'cri'], ['scheme_amplify', 'amp']])
		if (base[k]) icons[v] = base[k]
	if (Object.keys(icons).length) o.ic = icons
	return o
}

const cards = raw.map(compact).filter(Boolean)
const packOrder = new Map(packs.map((p, i) => [p.code, i]))
cards.sort((a, b) => (packOrder.get(a.p) ?? 999) - (packOrder.get(b.p) ?? 999) || a.c.localeCompare(b.c))

// ───────── precon decks: the 40-card deck in each hero's box ─────────
// Hero packs print the deck right after the hero: the hero's cards, then its aspect and basic cards,
// numbered in one run (extra cards for other decks come after a gap). Big boxes print two such runs.
// The core set's five decks are the MarvelCDB starter decklists (data/core-precons.json).
const num = (code) => Number(code.replace(/\D+$/, '').slice(2))
const precons = {}
const corePre = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'core-precons.json'), 'utf8'))
for (const h of cards.filter((c) => c.t === 'hero' && c.back && c.c.endsWith('a'))) {
	if (precons[h.st]) continue
	const core = corePre[h.c]
	if (core) {
		precons[h.st] = { name: core.name.replace(/ - /g, ' — '), hero: h.c, cards: core.slots }
		continue
	}
	const pack = cards
		.filter((c) => c.p === h.p && c.f !== 'encounter' && c.f !== 'campaign' && !(c.fl ?? []).includes('hid'))
		.sort((a, b) => a.c.localeCompare(b.c))
	const start = num(h.c)
	const slots = {}
	let last = start
	let n = 0
	for (const c of pack) {
		const k = num(c.c)
		if (k <= start) continue
		if (k - last > 2) break // gap: the rest are extras
		if ((c.t === 'hero' || c.t === 'alter_ego') && c.st !== h.st) break // the next hero in a big box
		last = k
		if (c.t === 'hero' || c.t === 'alter_ego') continue
		if (sets.find((x) => x.code === c.st)?.card_set_type_code === 'hero_special') continue // Invocation, Weather… decks
		if (c.c.length > 5 && !/[a]$/.test(c.c) && slots[c.c.slice(0, 5) + 'a'] !== undefined) {
			// card b/c/d sides of a multi-part card count with the a side
		}
		slots[c.c] = c.q
		n += c.q
	}
	const asp = Object.entries(
		Object.keys(slots).reduce((m, code) => {
			const f = byCode.get(code)?.faction_code
			if (f && !['hero', 'basic'].includes(f)) m[f] = (m[f] ?? 0) + slots[code]
			return m
		}, {}),
	).sort((a, b) => b[1] - a[1])[0]?.[0]
	const aname = asp ? asp[0].toUpperCase() + asp.slice(1) : ''
	precons[h.st] = { name: `${h.n}${aname ? ' — ' + aname : ''} — Precon`, hero: h.c, cards: slots, size: n }
}

const meta = {
	packs: packs.map((p) => ({ code: p.code, name: p.name, date: p.date_release, type: p.pack_type_code })),
	sets: sets.map((s) => ({ code: s.code, name: s.name, type: s.card_set_type_code, parent: s.parent_code })),
	updated: new Date().toISOString().slice(0, 10),
}
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'data')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'cards.json'), JSON.stringify(cards))
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1))
fs.writeFileSync(path.join(out, 'precons.json'), JSON.stringify(precons))
console.log(`${cards.length} cards, ${packs.length} packs, ${sets.length} sets`)
