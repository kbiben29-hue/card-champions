// Reads a card's printed text into keywords, constant modifiers and abilities with effect steps.
// Anything the reader doesn't understand becomes a `manual` step showing that sentence, so the
// player can resolve it with the table tools (the game never silently skips text).
import type { CardData } from '../data/data'

export type Num = number | 'X' | { per: number } // {per:n}: n per player in the game area

export type Who =
	| 'enemy'
	| 'minion'
	| 'villain'
	| 'eachEnemy'
	| 'eachMinion'
	| 'scheme'
	| 'main'
	| 'side'
	| 'eachScheme'
	| 'eachSide'
	| 'thisCard'
	| 'hero' // your hero / your identity / you
	| 'eachHero'
	| 'character' // a friendly character
	| 'ally'
	| 'eachAlly'
	| 'eachFriendly' // each character you control
	| 'attached' // the card this is attached to
	| 'that' // the card the trigger refers to

export type Step =
	| { k: 'dmg'; n: Num; to: Who; stun?: boolean }
	| { k: 'thwart'; n: Num; from: Who }
	| { k: 'threat'; n: Num; on: Who }
	| { k: 'draw'; n: Num; each?: boolean }
	| { k: 'heal'; n: Num | 'all'; who: Who }
	| { k: 'status'; s: 'stun' | 'conf' | 'tough'; who: Who }
	| { k: 'ready'; who: Who }
	| { k: 'exhaust'; who: Who }
	| { k: 'surge' }
	| { k: 'surgeIfNot' }
	| { k: 'activate'; mode: 'attack' | 'scheme' | 'activate'; minions?: boolean }
	| { k: 'resource'; r: string }
	| { k: 'discardRandom'; n: number; each?: boolean }
	| { k: 'discardControl'; kinds: string[] }
	| { k: 'nemesis' }
	| { k: 'dealEncounter'; each: boolean }
	| { k: 'bonus'; stat: 'atk' | 'thw' | 'def' | 'sch'; n: number; who: Who }
	| { k: 'choose'; options: { label: string; steps: Step[] }[] }
	| { k: 'search'; what: string; zone: 'deck' | 'deckDiscard' | 'encounter' }
	| { k: 'flip' }
	| { k: 'returnHand' }
	| { k: 'discardSelf' }
	| { k: 'prevent'; n: number | 'all' }
	| { k: 'cancel' }
	| { k: 'mill'; n: number }
	| { k: 'attackGains'; kw: 'ranged' | 'overkill' | 'piercing' | 'stunOnDamage' }
	| { k: 'extraBoost'; n: number }
	| { k: 'revealThis' }
	| { k: 'resolveRevealed' }
	| { k: 'removeSelf' }
	| { k: 'exhaustHeroCost' }
	| { k: 'counter'; n: number }
	| { k: 'choosePlayer' }
	| { k: 'manual'; text: string }

export type Timing =
	| 'action'
	| 'resource'
	| 'response'
	| 'interrupt'
	| 'forcedResponse'
	| 'forcedInterrupt'
	| 'whenRevealed'
	| 'whenDefeated'
	| 'setup'
	| 'special'
	| 'boost'

export type Cost = { k: 'exhaust' } | { k: 'counter'; n: number } | { k: 'res'; n: number } | { k: 'discardThis' } | { k: 'other'; text: string }

export interface Ability {
	timing: Timing
	/** Hero / Alter-Ego restriction */
	form?: 'hero' | 'alter'
	/** "(attack)", "(thwart)", "(defense)" */
	tag?: string
	/** the When/After clause of a triggered ability */
	trigger?: string
	/** what the trigger window is, when we know it */
	window?: Window
	cost: Cost[]
	steps: Step[]
	text: string
	limit?: 'round' | 'phase'
	/** for When Revealed (Hero) / (Alter-Ego) */
	revealForm?: 'hero' | 'alter'
}

export type Window =
	| 'villainAttacksYou' // when the villain (or an enemy) initiates an attack against you
	| 'attackDamage' // when you would take damage from an attack
	| 'treachery' // when a treachery is revealed
	| 'threatPlaced' // when threat would be placed on a scheme
	| 'played' // after you play this card / enters play
	| 'attachedDefeated'
	| 'endRound'

export interface Mod {
	stat: 'atk' | 'thw' | 'def' | 'hp' | 'sch' | 'hand' | 'rec'
	n: number
	who: 'hero' | 'attached' | 'villain' | 'self'
}

export interface Parsed {
	keywords: Record<string, number | true>
	mods: Mod[]
	abilities: Ability[]
	/** "Attach to ..." */
	attach?: string
	/** Uses (N counters) */
	uses?: number
	/** lines we kept as plain notes (rules that just apply, e.g. Hero form only) */
	notes: string[]
	formOnly?: 'hero' | 'alter'
}

const strip = (s: string) =>
	s
		.replace(/<i>\s*\(((?:attack|thwart|defense|defence|alliance)(?:,\s*\w+)*)\)\s*<\/i>/gi, '($1)') // ability tags stay
		.replace(/<i>\s*\([^)]*\)\s*<\/i>/g, '') // reminder text
		.replace(/<\/?(b|i|em|strong|u)>|<b\/>/g, '')
		.replace(/<hr\s*\/?>/g, '\n')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/ /g, ' ')
		.trim()

const KEYWORDS = [
	'Guard',
	'Toughness',
	'Quickstrike',
	'Surge',
	'Piercing',
	'Overkill',
	'Ranged',
	'Steady',
	'Stalwart',
	'Villainous',
	'Peril',
	'Patrol',
	'Assault',
	'Permanent',
	'Restricted',
	'Vulnerable',
	'Temporary',
	'Teamwork',
	'Alliance',
]
const NUM_KEYWORDS = ['Retaliate', 'Incite', 'Hinder', 'Victory', 'Acceleration']

function num(s: string): Num {
	const m = s.match(/(\d+)\s*\[per_hero\]/)
	if (m) return { per: Number(m[1]) }
	if (/^(a|an|one)$/i.test(s)) return 1
	if (/^X$/i.test(s)) return 'X'
	const n = Number(s)
	return Number.isFinite(n) ? n : 1
}

/** Every villain / leader name in the data and every hero's two names (set by the engine at load). */
export const NAMES = { villains: new Set<string>(), identities: new Set<string>() }
const isVillain = (s: string) => /^(the villain|him|her|the enemy leader)$/i.test(s) || NAMES.villains.has(s.toLowerCase())

const N = String.raw`(\d+(?:\s*\[per_hero\])?|X|a|an)`

function whoOf(s: string, names: string[]): Who | null {
	s = s
		.trim()
		.toLowerCase()
		.replace(/^(a|an|each) (confused|stunned|exhausted|damaged|ready|engaged|undamaged|friendly) (?=(enemy|minion|character|ally|hero))/, (_, a) => (a === 'an' ? 'a' : a) + ' ')
		.replace(/^a (enemy|ally)/, 'an $1')
	const nm = names.map((n) => n.toLowerCase())
	if (/^(an enemy|1 enemy|target enemy)$/.test(s)) return 'enemy'
	if (/^(a minion|1 minion)$/.test(s)) return 'minion'
	if (/^(the villain|each villain)$/.test(s)) return 'villain'
	if (/^each enemy$/.test(s)) return 'eachEnemy'
	if (/^each minion( engaged with you)?$/.test(s)) return 'eachMinion'
	if (/^(a scheme|1 scheme|any scheme)$/.test(s)) return 'scheme'
	if (/^the main scheme$/.test(s)) return 'main'
	if (/^(a side scheme)$/.test(s)) return 'side'
	if (/^each scheme$/.test(s)) return 'eachScheme'
	if (/^each side scheme$/.test(s)) return 'eachSide'
	if (/^(this scheme|here|this card|it)$/.test(s)) return 'thisCard'
	if (/^(your hero|your identity|you|yourself|your alter-ego|your character)$/.test(s)) return 'hero'
	if (/^each (hero|player|identity)$/.test(s)) return 'eachHero'
	if (/^(a character|a friendly character|a character you control|1 character|target character)$/.test(s)) return 'character'
	if (/^(an ally|an ally you control|a friendly ally|1 ally)$/.test(s)) return 'ally'
	if (/^each ally( you control)?$/.test(s)) return 'eachAlly'
	if (/^each (friendly )?character you control$/.test(s)) return 'eachFriendly'
	if (/^attached (minion|villain|enemy|character|ally|scheme)$/.test(s)) return 'attached'
	if (/^(that enemy|that minion|that character|that scheme|the attacking enemy|that ally)$/.test(s)) return 'that'
	if (nm.includes(s)) return nm.indexOf(s) < 2 ? 'hero' : 'thisCard'
	if (NAMES.identities.has(s)) return 'hero'
	if (isVillain(s)) return 'villain'
	return null
}

/** One sentence → steps (null = not understood). */
function sentence(raw: string, names: string[], villainNames: string[]): Step[] | null {
	let s = raw
		.trim()
		.replace(/^then,?\s*/i, '')
		.replace(/\.$/, '')
		.trim()
	if (!s) return []
	let m: RegExpMatchArray | null
	const W = String.raw`(.+?)`
	if ((m = s.match(/^choose to either (.+?) or (.+)$/i))) {
		const a = sentence(m[1].replace(/^take/i, 'take'), names, villainNames)
		const b = sentence(m[2], names, villainNames)
		if (a && b) return [{ k: 'choose', options: [{ label: m[1], steps: a }, { label: m[2], steps: b }] }]
	}
	if (/^this card gains surge$/i.test(s) || /^surge$/i.test(s)) return [{ k: 'surge' }]
	if ((m = s.match(/^if (no|you cannot|there (?:is|are) no)\b.*(?:this card gains surge)$/i))) return [{ k: 'surgeIfNot' }]
	if (/^otherwise,? this card gains surge$/i.test(s)) return [{ k: 'surgeIfNot' }]
	if ((m = s.match(new RegExp(String.raw`^deal ${N} damage to ${W}(?: and ${N} damage to ${W})?$`, 'i')))) {
		const a = whoOf(m[2], names)
		if (!a) return null
		const out: Step[] = [{ k: 'dmg', n: num(m[1]), to: a }]
		if (m[3]) {
			const b = whoOf(m[4], names)
			if (!b) return null
			out.push({ k: 'dmg', n: num(m[3]), to: b })
		}
		return out
	}
	if ((m = s.match(new RegExp(String.raw`^remove ${N} threat from ${W}$`, 'i')))) {
		const w = whoOf(m[2], names)
		return w ? [{ k: 'thwart', n: num(m[1]), from: w }] : null
	}
	if ((m = s.match(new RegExp(String.raw`^place (?:an additional )?${N} (?:additional )?threat (?:on|here)(?: ${W})?$`, 'i')))) {
		const w = m[2] ? whoOf(m[2], names) : 'thisCard'
		return w ? [{ k: 'threat', n: num(m[1]), on: w }] : null
	}
	if ((m = s.match(new RegExp(String.raw`^place an additional ${N} threat here$`, 'i')))) return [{ k: 'threat', n: num(m[1]), on: 'thisCard' }]
	if ((m = s.match(new RegExp(String.raw`^(each player )?draws? ${N} cards?$`, 'i')))) return [{ k: 'draw', n: num(m[2]), each: !!m[1] }]
	if ((m = s.match(/^draw a card$/i))) return [{ k: 'draw', n: 1 }]
	if ((m = s.match(new RegExp(String.raw`^heal (${N}|all) damage from ${W}$`, 'i')))) {
		const w = whoOf(m[3], names)
		return w ? [{ k: 'heal', n: m[1].toLowerCase() === 'all' ? 'all' : num(m[1]), who: w }] : null
	}
	if ((m = s.match(new RegExp(String.raw`^${W} heals ${N} damage$`, 'i')))) {
		const t = m[1].toLowerCase()
		if (t === 'the villain' || villainNames.some((v) => v.toLowerCase() === t)) return [{ k: 'heal', n: num(m[2]), who: 'villain' }]
		const w = whoOf(m[1], names)
		return w ? [{ k: 'heal', n: num(m[2]), who: w }] : null
	}
	if ((m = s.match(/^(stun|confuse) (.+)$/i))) {
		const t = m[2].toLowerCase()
		const w = villainNames.some((v) => v.toLowerCase() === t) ? 'villain' : whoOf(m[2], names)
		return w ? [{ k: 'status', s: m[1].toLowerCase() === 'stun' ? 'stun' : 'conf', who: w }] : null
	}
	if ((m = s.match(/^you are (stunned|confused)$/i))) return [{ k: 'status', s: m[1].toLowerCase() === 'stunned' ? 'stun' : 'conf', who: 'hero' }]
	if ((m = s.match(/^give (.+?) a tough status card$/i))) {
		const t = m[1].toLowerCase()
		const w = villainNames.some((v) => v.toLowerCase() === t) || t === 'the villain' || t === 'him' || t === 'her' ? 'villain' : whoOf(m[1], names)
		return w ? [{ k: 'status', s: 'tough', who: w }] : null
	}
	if ((m = s.match(/^(ready|exhaust) (.+)$/i))) {
		const w = whoOf(m[2], names)
		return w ? [{ k: m[1].toLowerCase() === 'ready' ? 'ready' : 'exhaust', who: w }] : null
	}
	if ((m = s.match(/^generate (a|an|\d+) \[(\w+)\] resources?$/i)) || (m = s.match(/^generate (a|an|\d+) resources? of any type$/i))) {
		const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1
		const r = (m[2] ?? 'wild').toLowerCase()
		const ch = { mental: 'm', energy: 'e', physical: 'p', wild: 'w' }[r] ?? 'w'
		return [{ k: 'resource', r: ch.repeat(n) }]
	}
	const vn = ['the villain', ...villainNames.map((v) => v.toLowerCase())]
	if ((m = s.match(/^(.+?) (attacks|schemes|activates)(?: against)?(?: you)?$/i)) && vn.includes(m[1].toLowerCase()))
		return [{ k: 'activate', mode: m[2].toLowerCase() === 'attacks' ? 'attack' : m[2].toLowerCase() === 'schemes' ? 'scheme' : 'activate' }]
	if (/^the villain and each minion engaged with you attacks? you$/i.test(s)) return [{ k: 'activate', mode: 'attack', minions: true }]
	if ((m = s.match(/^discard (\d+|a) cards? at random from (your|each player's) hand$/i)))
		return [{ k: 'discardRandom', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1, each: m[2].toLowerCase() !== 'your' }]
	if ((m = s.match(/^discard an? (upgrade|support|ally)(?: or (upgrade|support|ally))? you control$/i)))
		return [{ k: 'discardControl', kinds: [m[1], m[2]].filter(Boolean).map((x) => x.toLowerCase()) }]
	if (/^deal each player an encounter card$/i.test(s)) return [{ k: 'dealEncounter', each: true }]
	if (/^deal (yourself|you) an encounter card$/i.test(s)) return [{ k: 'dealEncounter', each: false }]
	if (/^reveal your set-aside nemesis minion/i.test(s)) return [{ k: 'nemesis' }]
	if (/^(reveal your set-aside nemesis side scheme|shuffle the rest of your set-aside nemesis)/i.test(s)) return []
	if (/^if your nemesis minion does not enter/i.test(s)) return [{ k: 'surgeIfNot' }]
	if ((m = s.match(/^(?:your hero|you|attached character|your identity) gets? \+(\d+) (ATK|THW|DEF)(?: (?:until the end of the phase|for this attack|this phase))?$/i)))
		return [{ k: 'bonus', stat: m[2].toLowerCase() as 'atk', n: Number(m[1]), who: 'hero' }]
	if ((m = s.match(/^search your deck(?: and discard pile)? for (.+?) and add it to your hand$/i)))
		return [{ k: 'search', what: m[1].replace(/^(a|an|1)\s+/i, ''), zone: /discard pile/i.test(s) ? 'deckDiscard' : 'deck' }]
	if ((m = s.match(/^prevent (all|\d+) of (?:that|the) damage$/i))) return [{ k: 'prevent', n: m[1].toLowerCase() === 'all' ? 'all' : Number(m[1]) }]
	if (/^cancel (its|that card's|the) "?when revealed"? (effects?|ability)/i.test(s) || /^cancel the effects of that card/i.test(s)) return [{ k: 'cancel' }]
	if ((m = s.match(/^(?:you )?take (\d+) (?:indirect )?damage$/i))) return [{ k: 'dmg', n: Number(m[1]), to: 'hero' }]
	if ((m = s.match(/^discard the top (\d+|) ?cards? of your deck$/i))) return [{ k: 'mill', n: m[1] ? Number(m[1]) : 1 }]
	if ((m = s.match(/^(?:this|that) attack gains (ranged|overkill|piercing)$/i))) return [{ k: 'attackGains', kw: m[1].toLowerCase() as 'ranged' }]
	if (/^if a character is damaged by this attack, (that character is stunned|stun that character)$/i.test(s)) return [{ k: 'attackGains', kw: 'stunOnDamage' }]
	if ((m = s.match(/^give (?:the villain|the activating enemy|him|her|that enemy) (\d+|an|a) additional boost cards?(?: for this activation)?$/i)))
		return [{ k: 'extraBoost', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 }]
	if (/^reveal this card$/i.test(s)) return [{ k: 'revealThis' }]
	if (/^resolve this card's "?when revealed"? ability$/i.test(s)) return [{ k: 'resolveRevealed' }]
	if (/^discard this (obligation|card|upgrade|support|attachment)$/i.test(s)) return [{ k: 'discardSelf' }]
	if ((m = s.match(/^remove (.+?) from the game$/i)) && (/^this card$/i.test(m[1]) || whoOf(m[1], names) === 'thisCard')) return [{ k: 'removeSelf' }]
	if (/^you may flip to alter-ego form$/i.test(s)) return []
	if (/^shuffle your deck$/i.test(s) || /^shuffle the encounter deck$/i.test(s)) return []
	if ((m = s.match(/^return (.+?) to your hand$/i)) && whoOf(m[1], names) === 'thisCard') return [{ k: 'returnHand' }]
	if ((m = s.match(/^discard (.+)$/i)) && (whoOf(m[1], names) === 'thisCard' || /^(this card|this upgrade|this support)$/i.test(m[1]))) return [{ k: 'discardSelf' }]
	if (/^flip (this card|your identity)/i.test(s) || /^change (forms?|to (hero|alter-ego) form)$/i.test(s)) return [{ k: 'flip' }]
	if ((m = s.match(/^change forms? and ready (?:your identity|your hero)$/i))) return [{ k: 'flip' }, { k: 'ready', who: 'hero' }]
	if ((m = s.match(/^place (\d+|a|an) [\w-]+ counters? (?:here|on this card|on (.+))$/i)) && (!m[2] || whoOf(m[2], names) === 'thisCard' || whoOf(m[2], names) === 'hero'))
		return [{ k: 'counter', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 }]
	if ((m = s.match(/^remove (\d+|a|an) [\w-]+ counters? from (?:here|this card|(.+))$/i)) && (!m[2] || whoOf(m[2], names) === 'thisCard'))
		return [{ k: 'counter', n: -(/^\d+$/.test(m[1]) ? Number(m[1]) : 1) }]
	if (/^choose a player$/i.test(s)) return [{ k: 'choosePlayer' }]
	if ((m = s.match(/^that player draws (\d+|a) cards?$/i))) return [{ k: 'draw', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1, each: false }]
	if ((m = s.match(/^until the end of the (?:phase|round),? (your hero|you|attached character) gets? \+(\d+) (ATK|THW|DEF)$/i)))
		return [{ k: 'bonus', stat: m[3].toLowerCase() as 'atk', n: Number(m[2]), who: 'hero' }]
	// "(5 damage instead if …)": ask whether the condition holds
	if ((m = s.match(/^(.*?)\s*\((\d+)\s*([^)]*?) instead if ([^)]*)\)(.*)$/i))) {
		const base = sentence(m[1] + m[5], names, villainNames)
		const alt = sentence((m[1] + m[5]).replace(/\d+/, m[2]), names, villainNames)
		if (base && alt) return [{ k: 'choose', options: [{ label: `Yes: ${m[4]} (${m[2]} ${m[3]})`.trim(), steps: alt }, { label: 'No', steps: base }] }]
	}
	// "If X, Y" / "You may X": a quick yes/no question when the rest is understood
	if ((m = s.match(/^if (.+?), (.+)$/i)) && !/surge/i.test(m[2])) {
		const y = sentence(m[2], names, villainNames)
		if (y && y.length) return [{ k: 'choose', options: [{ label: `Yes — ${m[1]}`, steps: y }, { label: 'No', steps: [] }] }]
	}
	if ((m = s.match(/^you may (.+)$/i))) {
		const y = sentence(m[1], names, villainNames)
		if (y && y.length) return [{ k: 'choose', options: [{ label: `Yes — ${m[1]}`, steps: y }, { label: 'No', steps: [] }] }]
	}
	return null
}

/** Effect text (several sentences, "Choose:" bullets) → steps. Unread sentences become manual steps. */
export function effect(text: string, names: string[], villainNames: string[] = []): Step[] {
	const t = text.trim()
	const choose = t.match(/^(.*?)choose(?: one)?:\s*\n?([\s\S]*)$/i)
	if (choose && /•/.test(choose[2])) {
		const before = effect(choose[1], names, villainNames)
		const options = choose[2]
			.split('•')
			.map((o) => o.trim())
			.filter(Boolean)
			.map((o) => {
				const ar = o.split('→')
				if (ar.length > 1) {
					const pre: Step[] = /^exhaust /i.test(ar[0].trim()) ? [{ k: 'exhaustHeroCost' }] : [{ k: 'manual', text: ar[0].trim() }]
					return { label: o.replace(/\.$/, ''), steps: [...pre, ...effect(ar.slice(1).join('→'), names, villainNames)] }
				}
				return { label: o.replace(/\.$/, ''), steps: effect(o, names, villainNames) }
			})
		return [...before, { k: 'choose', options }]
	}
	const out: Step[] = []
	// split into sentences (keep "e.g." safe enough) and also on " and " joins handled per sentence
	const parts = t
		.split(/(?<=[.!])\s+|\n+/)
		.map((p) => p.trim())
		.filter(Boolean)
	for (const p of parts) {
		const st = sentence(p, names, villainNames)
		if (st) out.push(...st)
		else {
			// "X and Y" with two simple halves: try each
			const halves = p.replace(/\.$/, '').split(/,? and (?=(?:deal|draw|heal|remove|place|stun|confuse|ready|exhaust|give|discard)\b)/i)
			if (halves.length > 1) {
				const hs = halves.map((h) => sentence(h, names, villainNames))
				if (hs.every(Boolean)) {
					for (const h of hs) out.push(...h!)
					continue
				}
			}
			out.push({ k: 'manual', text: p })
		}
	}
	return out
}

const TIMING: [RegExp, Timing, ('hero' | 'alter')?][] = [
	[/^hero action$/i, 'action', 'hero'],
	[/^alter-ego action$/i, 'action', 'alter'],
	[/^(first player )?action$/i, 'action'],
	[/^hero resource$/i, 'resource', 'hero'],
	[/^alter-ego resource$/i, 'resource', 'alter'],
	[/^resource$/i, 'resource'],
	[/^hero re[s]?ponse$/i, 'response', 'hero'],
	[/^alter-ego response$/i, 'response', 'alter'],
	[/^response$/i, 'response'],
	[/^hero interrupt$/i, 'interrupt', 'hero'],
	[/^alter-ego interrupt$/i, 'interrupt', 'alter'],
	[/^interrupt$/i, 'interrupt'],
	[/^forced response$/i, 'forcedResponse'],
	[/^forced interrupt( \(hero\))?$/i, 'forcedInterrupt'],
	[/^when revealed( \((hero|alter-ego)\))?$/i, 'whenRevealed'],
	[/^when defeated$/i, 'whenDefeated'],
	[/^setup$/i, 'setup'],
	[/^special$/i, 'special'],
	[/^boost$/i, 'boost'],
]

function windowOf(trigger: string): Window | undefined {
	const t = trigger.toLowerCase()
	if (/when (the villain|an enemy|a villain) (initiates an attack|attacks) (against )?you/.test(t)) return 'villainAttacksYou'
	if (/when you would take (any amount of )?damage from an attack/.test(t) || /when (your hero|you) would take (any amount of )?damage/.test(t))
		return 'attackDamage'
	if (/when a treachery( card)? is revealed/.test(t)) return 'treachery'
	if (/when (any amount of )?threat would be placed on a scheme/.test(t)) return 'threatPlaced'
	if (/^after you play /.test(t) || /enters play/.test(t)) return 'played'
	if (/when attached minion is defeated/.test(t)) return 'attachedDefeated'
	if (/at the end of the round/.test(t)) return 'endRound'
	return undefined
}

function costs(s: string, names: string[]): Cost[] {
	const out: Cost[] = []
	for (const part of s.split(/,? and |, /)) {
		const p = part.trim().replace(/\.$/, '')
		let m: RegExpMatchArray | null
		if ((m = p.match(/^exhaust (.+)$/i)) && (whoOf(m[1], names) === 'thisCard' || whoOf(m[1], names) === 'hero' || /^this card$/i.test(m[1])))
			out.push({ k: 'exhaust' })
		else if ((m = p.match(/^remove (\d+|a|an) .*counters? from (.+)$/i))) out.push({ k: 'counter', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 })
		else if ((m = p.match(/^spend (\d+|a|an) (?:\[\w+\] )?resources?$/i))) out.push({ k: 'res', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 })
		else if ((m = p.match(/^spend ((?:\[\w+\]\s*)+) resources?$/i))) out.push({ k: 'res', n: (m[1].match(/\[/g) ?? []).length })
		else if (/^discard (this card|.+)$/i.test(p) && whoOf(p.replace(/^discard /i, ''), names) === 'thisCard') out.push({ k: 'discardThis' })
		else out.push({ k: 'other', text: p })
	}
	return out
}

const cache = new Map<string, Parsed>()

export function parse(c: CardData, alterName?: string): Parsed {
	const hit = cache.get(c.c)
	if (hit) return hit
	const names = [c.n, alterName ?? c.n, c.s ?? '\u0000'].filter(Boolean)
	const villainNames = [...NAMES.villains]
	const out: Parsed = { keywords: {}, mods: [], abilities: [], notes: [] }
	const lines = strip(c.x ?? '')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
	if (c.t === 'obligation' && !lines.some((l) => /^(when revealed|forced|action|hero action)/i.test(l))) {
		const body = lines.filter((l) => !/^give to the /i.test(l)).join('\n')
		out.abilities.push({ timing: 'whenRevealed', cost: [], steps: effect(body, names, villainNames), text: body })
		cache.set(c.c, out)
		return out
	}
	for (let line of lines) {
		let star = false
		if (line.startsWith('[star]')) {
			star = true
			line = line.replace(/^\[star\]\s*/, '')
		}
		// "Spider-Sense — Interrupt: ..." (identity ability names)
		line = line.replace(/^[^—:]{1,40}—\s*(?=(Hero |Alter-Ego |Forced )?(Action|Interrupt|Response|Resource))/i, '')
		// "Hero Action: (attack): …" → "Hero Action (attack): …"
		line = line.replace(/^([A-Za-z-]+(?: [A-Za-z-]+){0,2})\s*:\s*\(([a-z ,]+)\)\s*:/, '$1 ($2):')
		const head = line.match(/^([A-Za-z-]+(?: [A-Za-z-]+){0,2}(?: \((?:Hero|Alter-Ego)\))?)\s*(?:\(([a-z ,]+)\))?\s*:\s*([\s\S]*)$/)
		const tm = head && TIMING.find(([re]) => re.test(head[1].trim()))
		if (head && tm) {
			const [, label, tag, rest] = head
			let body = rest.trim()
			const timing = tm[1]
			const ab: Ability = { timing, form: tm[2], tag: tag?.trim(), cost: [], steps: [], text: (star ? '★ ' : '') + line }
			const rf = label.match(/\((hero|alter-ego)\)/i)
			if (rf) ab.revealForm = rf[1].toLowerCase() === 'hero' ? 'hero' : 'alter'
			const lim = body.match(/\(limit once per (round|phase)\.?\)/i)
			if (lim) {
				ab.limit = lim[1].toLowerCase() as 'round'
				body = body.replace(lim[0], '').trim()
			}
			body = body.replace(/\(max \d+ per [^)]*\)/i, '').trim()
			if (/^(response|interrupt|forcedResponse|forcedInterrupt)$/.test(timing)) {
				const tr = body.match(/^((?:when|after)[^,]+),\s*([\s\S]*)$/i)
				if (tr) {
					ab.trigger = tr[1]
					ab.window = windowOf(tr[1])
					body = tr[2]
				}
			}
			const arrow = body.split('→')
			if (arrow.length > 1) {
				ab.cost = costs(arrow[0], names)
				body = arrow.slice(1).join('→')
			}
			ab.steps = effect(body, names, villainNames)
			out.abilities.push(ab)
			continue
		}
		// keyword line(s): "Guard. Toughness." "Retaliate 1." "Uses (3 web counters)."
		const words = line.split(/\.\s*/).filter(Boolean)
		let allKw = words.length > 0
		for (const w of words) {
			const ww = w.trim()
			if (KEYWORDS.some((k) => k.toLowerCase() === ww.toLowerCase())) continue
			if (NUM_KEYWORDS.some((k) => new RegExp(`^${k} \\d+(\\s*\\[per_hero\\])?$`, 'i').test(ww))) continue
			if (/^uses \(\d+ [^)]*\)$/i.test(ww)) continue
			allKw = false
		}
		if (allKw) {
			for (const w of words) {
				const ww = w.trim()
				const k = KEYWORDS.find((k) => k.toLowerCase() === ww.toLowerCase())
				if (k) out.keywords[k.toLowerCase()] = true
				const nk = ww.match(/^(\w+) (\d+)(\s*\[per_hero\])?$/)
				if (nk) out.keywords[nk[1].toLowerCase()] = nk[3] ? -Number(nk[2]) : Number(nk[2]) // negative = per hero
				const u = ww.match(/^uses \((\d+)/i)
				if (u) out.uses = Number(u[1])
			}
			continue
		}
		let m: RegExpMatchArray | null
		if ((m = line.match(/^(?:uses \((\d+) [^)]*\)\.?\s*)/i))) {
			out.uses = Number(m[1])
			line = line.slice(m[0].length).trim()
			if (!line) continue
		}
		if ((m = line.match(/^attach to (an? .+?|your identity|the villain|.+?)(?:\.|$)/i))) {
			out.attach = m[1]
			const rest = line.slice(m[0].length).trim()
			if (/^hero form only/i.test(line)) out.formOnly = 'hero'
			if (!rest) continue
			line = rest
		}
		if (/^hero form only/i.test(line)) {
			out.formOnly = 'hero'
			const am = line.match(/attach to ([^.]+)\./i)
			if (am) out.attach = am[1]
			out.notes.push(line)
			continue
		}
		if (/^alter-ego form only/i.test(line)) {
			out.formOnly = 'alter'
			out.notes.push(line)
			continue
		}
		// constant modifiers
		let any = false
		for (const sent of line.split(/(?<=\.)\s+/)) {
			const mm = sent.match(/^(your hero|you|attached character|attached ally|attached minion|attached villain|attached enemy|the villain|this character|this minion|.+?) gets? \+(\d+) (ATK|THW|DEF|SCH|REC|hit points?|hand size)\.?$/i)
			if (mm) {
				const who = /your hero|^you$/i.test(mm[1]) ? 'hero' : /attached/i.test(mm[1]) ? 'attached' : /villain/i.test(mm[1]) ? 'villain' : 'self'
				const st = mm[3].toLowerCase().startsWith('hit') ? 'hp' : mm[3].toLowerCase().startsWith('hand') ? 'hand' : (mm[3].toLowerCase() as Mod['stat'])
				out.mods.push({ stat: st, n: Number(mm[2]), who })
				any = true
			} else if (any) out.notes.push(sent)
			else {
				out.notes.push(sent)
			}
		}
	}
	cache.set(c.c, out)
	return out
}

/** How many steps of a card would be resolved by hand. */
export function manualCount(p: Parsed): number {
	let n = 0
	const walk = (s: Step[]) => {
		for (const x of s) {
			if (x.k === 'manual') n++
			if (x.k === 'choose') x.options.forEach((o) => walk(o.steps))
		}
	}
	p.abilities.forEach((a) => walk(a.steps))
	return n + p.notes.length
}
