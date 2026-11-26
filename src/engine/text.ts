// Reads a card's printed text into keywords, constant modifiers and abilities with effect steps.
// Anything the reader doesn't understand becomes a `manual` step showing that sentence, so the
// player can resolve it with the table tools (the game never silently skips text).
import type { CardData } from '../data/data'

export type Num = number | 'X' | { per: number } | { mul: number; count: string } // per: n per player; mul: n for each <count>

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
	| `named:${string}` // a card in play called this

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
	| { k: 'counter'; n: number; who?: Who }
	| { k: 'encSearch'; what: string; then: 'reveal' | 'play' | 'engage' | 'hand'; discard: boolean }
	| { k: 'encMill'; n: number; until?: string }
	| { k: 'deckMill'; n: number; each: boolean }
	| { k: 'discardHand'; n: number; random: boolean; each: boolean }
	| { k: 'shield' }
	| { k: 'otherwise'; steps: Step[] }
	| { k: 'shuffleIn' }
	| { k: 'attachSelf'; who: Who }
	| { k: 'noop' }
	| { k: 'drone'; n: number; each: boolean; first?: boolean }
	| { k: 'ifInPlay'; name: string; not: boolean; steps: Step[] }
	| { k: 'ifStatus'; s: 'stun' | 'conf' | 'tough'; who: Who; steps: Step[] }
	| { k: 'forEachPlayer'; steps: Step[] }
	| { k: 'revealTop' }
	| { k: 'enemyAttacks'; who: Who }
	| { k: 'thatCard'; then: 'reveal' | 'play' | 'engage' | 'engageFirst' | 'hand' }
	| { k: 'discardAfterAttack' }
	| { k: 'lookTop'; n: number }
	| { k: 'manualLook'; n: number }
	| { k: 'traitAttack'; trait: string; mine: boolean }
	| { k: 'choosePlayer' }
	| { k: 'win' }
	| { k: 'dealThatUnlessSet'; set: string }
	| { k: 'special'; on: string; label?: string; mine: boolean; one: boolean }
	| { k: 'redirectAttack' }
	| { k: 'statusOr'; s: 'stun' | 'conf'; alt: Step[] }
	| { k: 'spendRes'; r: string; n: number }
	| { k: 'attackPlus'; n: Num; stat: 'atk' | 'sch' }
	| { k: 'ifCounters'; n: number; steps: Step[] }
	| { k: 'ifHero'; steps: Step[] }
	| { k: 'minionsActivate' }
	| { k: 'engageSelf' }
	| { k: 'shuffleOwnDeck' }
	| { k: 'encReshuffle' }
	| { k: 'accel'; n: number }
	| { k: 'defeat'; who: Who }
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
	/** "Foul Play" in "<i>Foul Play</i> — <b>Special</b>: …" */
	label?: string
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
export const NAMES = { villains: new Set<string>(), identities: new Set<string>(), cards: new Set<string>() }
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
	if (/^each (friendly )?character( you control)?$/.test(s)) return 'eachFriendly'
	if (/^(any character|a hero|any hero)$/.test(s)) return 'character'
	if (/^(the attacked enemy|the attacked character|the defending character)$/.test(s)) return 'that'
	if (/^attached (minion|villain|enemy|character|ally|scheme)$/.test(s)) return 'attached'
	if (/^(that enemy|that minion|that character|that scheme|the attacking enemy|that ally)$/.test(s)) return 'that'
	if (nm.includes(s)) return nm.indexOf(s) < 2 ? 'hero' : 'thisCard'
	if (NAMES.identities.has(s)) return 'hero'
	if (isVillain(s)) return 'villain'
	if (/^(the enemy leader|your leader)$/.test(s)) return 'villain'
	// a card named on the card: "Criminal Enterprise", "the Red House side scheme"
	const bare = s.replace(/^the /, '').replace(/ (side scheme|environment|main scheme|minion|attachment|support|upgrade|ally|villain)$/, '')
	if (NAMES.cards.has(bare)) return `named:${bare}`
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
	// "(8 damage instead if you have the Aerial trait)": ask whether the condition holds
	if ((m = s.match(/^(.*?)\s*\((\d+)\s*([^)]*?) instead if ([^)]*)\)(.*)$/i))) {
		const base = sentence(m[1] + m[5], names, villainNames)
		const alt = sentence((m[1] + m[5]).replace(/\d+/, m[2]), names, villainNames)
		if (base && alt) return [{ k: 'choose', options: [{ label: `Yes: ${m[4]} (${m[2]} ${m[3]})`.trim(), steps: alt }, { label: 'No', steps: base }] }]
	}
	if ((m = s.match(/^(.*?)\s*\((?:draw|deal|remove|heal) (\d+) [^)]*? instead if ([^)]*)\)(.*)$/i))) {
		const base = sentence(m[1] + m[4], names, villainNames)
		const alt = sentence((m[1] + m[4]).replace(/\d+/, m[2]), names, villainNames)
		if (base && alt) return [{ k: 'choose', options: [{ label: `Yes: ${m[3]} (${m[2]})`, steps: alt }, { label: 'No', steps: base }] }]
	}
	// "… for each Drone minion engaged with you": the number is counted when it happens
	if ((m = s.match(/^(.*?\b)(\d+)( .*?) for each (.+?)(?: (?:discarded|placed|dealt) this way)?$/i)) && !/this way$/i.test(s)) {
		const st = sentence(m[1] + m[2] + m[3], names, villainNames)
		if (st && st.length === 1 && 'n' in st[0] && typeof (st[0] as { n: unknown }).n === 'number') {
			;(st[0] as { n: Num }).n = { mul: Number(m[2]), count: m[4] }
			return st
		}
	}
	// "Choose one: remove 2 threat from a scheme, draw 3 cards, or deal 4 damage to an enemy."
	if ((m = s.match(/^choose one:\s*(.+)$/i)) && !/•/.test(s)) {
		const opts = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map((o) => o.trim()).filter(Boolean)
		const steps = opts.map((o) => ({ label: o, steps: sentence(o, names, villainNames) }))
		if (steps.every((o) => o.steps)) return [{ k: 'choose', options: steps.map((o) => ({ label: o.label, steps: o.steps! })) }]
	}
	if ((m = s.match(/^choose a player to draw (\d+|a) cards?$/i))) return [{ k: 'choosePlayer' }, { k: 'draw', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 }]
	if ((m = s.match(/^look at the top (\d+) cards of your deck\. add (\d+|one) (?:of them )?to your hand and discard the (?:others|rest)$/i)))
		return [{ k: 'lookTop', n: Number(m[1]) }]
	if ((m = s.match(/^deal damage to (.+?) equal to your hero's (ATK|THW)$/i))) {
		const w = whoOf(m[1], names)
		return w ? [{ k: 'dmg', n: 'X', to: w }] : null
	}
	if ((m = s.match(/^(each|every) (.+?) minion (engaged with (?:you|your hero)|in play) attacks(?: you| your hero| the hero it is engaged with)?$/i)))
		return [{ k: 'traitAttack', trait: m[2], mine: /engaged/i.test(m[3]) }]
	if ((m = s.match(/^each character (?:that player|you) controls? gets \+(\d+) (THW|ATK|DEF) and \+(\d+) (THW|ATK|DEF) until the end of the phase$/i)))
		return [{ k: 'bonus', stat: m[2].toLowerCase() as 'atk', n: Number(m[1]), who: 'eachFriendly' }, { k: 'bonus', stat: m[4].toLowerCase() as 'atk', n: Number(m[3]), who: 'eachFriendly' }]
	if (/^the players win the game$/i.test(s)) return [{ k: 'win' }]
	if ((m = s.match(/^give (?:him|her|it|the villain|this enemy|that enemy) (\d+|an) additional boost cards? for (?:that|this) (?:activation|attack)$/i))) return [{ k: 'extraBoost', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 }]
	if ((m = s.match(/^the villain and each minion engaged with you get -(\d+) (ATK|SCH) while (?:attacking|scheming against) you this (?:phase|round)$/i)))
		return [{ k: 'bonus', stat: m[2].toLowerCase() as 'atk', n: -Number(m[1]), who: 'villain' }, { k: 'bonus', stat: m[2].toLowerCase() as 'atk', n: -Number(m[1]), who: 'eachMinion' }]
	if (/^\(?shuffle\.?\)?$/i.test(s)) return [{ k: 'noop' }]
	// "Resolve the "Special" ability on the Setting environment", "Resolve The Hood's "Foul Play" ability"
	if ((m = s.match(/^(?:then, )?resolve (?:the|its|their) ["“]special["”] abilit(?:y|ies)(?: on (.+?))?(?: in any order)?$/i)))
		return [{ k: 'special', on: m[1] ?? 'this card', mine: /you control/i.test(m[1] ?? ''), one: /^1 /.test(m[1] ?? '') }]
	if ((m = s.match(/^(?:each player must )?resolve (.+?)['’]s? ["“](.+?)["”] ability(?: in player order)?$/i)))
		return [{ k: 'special', on: m[1], label: m[2], mine: false, one: true }]
	if (/^(?:it|that enemy|the enemy) attacks (?:this card|.+?) instead$/i.test(s) && /this card|instead$/i.test(s)) return [{ k: 'redirectAttack' }]
	if ((m = s.match(/^(.+?) \((shuffle the encounter deck|without looking)\)$/i))) {
		const st = sentence(m[1], names, villainNames)
		if (st) return st
	}
	if ((m = s.match(/^each (.+?) minions? attacks? the hero (?:it is|they are) engaged with$/i)) || (m = s.match(/^each (.+?) minion engaged with a hero attacks that hero$/i)))
		return [{ k: 'traitAttack', trait: m[1], mine: false }]
	if ((m = s.match(/^put an? (.+?) minion into play engaged with each player$/i)))
		return [{ k: 'forEachPlayer', steps: [{ k: 'encSearch', what: m[1] + ' minion', then: 'engage', discard: true }] }]
	if ((m = s.match(/^each player searches the encounter deck(?: and discard pile)? for (?:a copy of |an? )?(.+?) and puts it into play engaged with them$/i)))
		return [{ k: 'forEachPlayer', steps: [{ k: 'encSearch', what: m[1], then: 'engage', discard: /discard pile/i.test(s) }] }]
	if (/^change your form$/i.test(s)) return [{ k: 'flip' }]
	{
		const sp = spendOf(s)
		if (sp) return [sp]
	}
	// ── during an enemy's attack or scheme: "he gets +2 ATK for this attack"
	if ((m = s.match(/^(?!(?:choose to )?either )(?:he|she|it|they|the villain|this enemy|that enemy|the attacking enemy|.+?) gets \+(\d+|X) (ATK|SCH) (for each .+? )?for this (?:attack|activation|scheme)$/i))) {
		const n: Num = m[3] ? { mul: m[1] === 'X' ? 1 : Number(m[1]), count: m[3].replace(/^for each /i, '').trim() } : m[1] === 'X' ? 'X' : Number(m[1])
		return [{ k: 'attackPlus', n, stat: m[2].toLowerCase() as 'atk' }]
	}
	if ((m = s.match(/^(?!(?:choose to )?either )(?:he|she|it|.+?) gets \+(\d+) (ATK|SCH) for each (.+?) for this (?:attack|activation|scheme)$/i)))
		return [{ k: 'attackPlus', n: { mul: Number(m[1]), count: m[3] }, stat: m[2].toLowerCase() as 'atk' }]
	if (/^(?:discard this card after this attack|after this attack, discard this card)$/i.test(s)) return [{ k: 'discardAfterAttack' }]
	if (/^do not deal any boost cards for (?:that|this) (?:attack|activation)$/i.test(s)) return [{ k: 'extraBoost', n: -9 }]
	if ((m = s.match(/^(?:choose to )?either (.+?),? or (.+)$/i)) && !/^each player/i.test(s)) {
		const a = sentence(m[1], names, villainNames)
		const b = sentence(m[2], names, villainNames)
		if (a && b) return [{ k: 'choose', options: [{ label: m[1], steps: a }, { label: m[2], steps: b }] }]
	}
	if ((m = s.match(/^remove (\d+) threat from each scheme(?: in play)?$/i))) return [{ k: 'thwart', n: Number(m[1]), from: 'eachScheme' }]
	if ((m = s.match(/^remove (?:each|all) (?:\w+ )?counters? from (.+)$/i))) {
		const w = whoOf(m[1], names)
		if (w) return [{ k: 'counter', n: -99, who: w }]
	}
	if ((m = s.match(/^if there are (\d+)(?: or more)? (?:\w+ )?counters here, (.+)$/i))) {
		const rest = m[2].replace(/^discard this card to (.+)$/i, 'discard this card. $1').replace(/ and (remove|discard|place|deal) /i, '. $1 ')
		const st = rest.split(/\.\s+/).map((x) => sentence(x, names, villainNames))
		if (st.every(Boolean)) return [{ k: 'ifCounters', n: Number(m[1]), steps: st.flat() as Step[] }]
	}
	if ((m = s.match(/^if that card does not belong to (?:the )?(.+?) encounter set, deal it to yourself as a facedown encounter card$/i))) return [{ k: 'dealThatUnlessSet', set: m[1] }]
	if ((m = s.match(/^if you are in hero form, (.+)$/i))) {
		const st = sentence(m[1].replace(/ after this activation$/i, ''), names, villainNames)
		if (st) return [{ k: 'ifHero', steps: st }]
	}
	if (/^each minion activates against the player it is engaged with$/i.test(s)) return [{ k: 'minionsActivate' }]
	if (/^put this (?:minion|card) into play engaged with you$/i.test(s)) return [{ k: 'engageSelf' }]
	if (/^shuffle this card into your deck$/i.test(s)) return [{ k: 'shuffleOwnDeck' }]
	if ((m = s.match(/^(?:after this activation ends, )?shuffle (.+?) into the encounter deck$/i)) && (/^this card$/i.test(m[1]) || names.includes(m[1]))) return [{ k: 'shuffleIn' }]
	if ((m = s.match(/^make the following \d+ attacks in order:\s*(.+)$/i))) {
		const parts = m[1].split(/\s*•\s*/).filter(Boolean).map((x) => sentence(x.replace(/\.$/, ''), names, villainNames))
		if (parts.length && parts.every(Boolean)) return parts.flat() as Step[]
	}
	if ((m = s.match(/^choose one:\s*•\s*(.+)$/i))) {
		const opts = m[1].split(/\s*•\s*/).map((o) => o.trim().replace(/\.$/, '')).filter(Boolean)
		const st = opts.map((o) => sentence(o, names, villainNames))
		if (st.every(Boolean)) return [{ k: 'choose', options: opts.map((o, i) => ({ label: o, steps: st[i]! })) }]
	}
	if ((m = s.match(/^(.+?), where X is equal to (double )?the villain's stage number$/i))) {
		const st = sentence(m[1].replace(/\s*\(to a maximum of \w+\)/i, ''), names, villainNames)
		if (st && st.length === 1 && 'n' in st[0]) {
			;(st[0] as { n: Num }).n = { mul: m[2] ? 2 : 1, count: 'villain stage' }
			return st
		}
	}
	if ((m = s.match(/^(.+?) gets \+(\d+) (ATK|THW|DEF) until the end of the phase$/i))) {
		const w = whoOf(m[1], names)
		if (w) return [{ k: 'bonus', stat: m[3].toLowerCase() as 'atk', n: Number(m[2]), who: w }]
	}
	if (/^shuffle the encounter discard pile into the encounter deck$/i.test(s)) return [{ k: 'encReshuffle' }]
	if ((m = s.match(/^place (\d+) acceleration tokens? on the main scheme$/i))) return [{ k: 'accel', n: Number(m[1]) }]
	if ((m = s.match(/^defeat (a|an|that|target) (non-elite )?minion$/i))) return [{ k: 'defeat', who: m[1] === 'that' ? 'that' : 'minion' }]
	if ((m = s.match(/^give (that villain|this enemy|that enemy|the villain|him|her|this minion) (?:a|another) tough status card$/i)))
		return [{ k: 'status', s: 'tough', who: /villain/i.test(m[1]) ? 'villain' : /that/i.test(m[1]) ? 'that' : 'thisCard' }]
	if ((m = s.match(/^deal (\d+) damage to that (hero|character|enemy|minion|ally)$/i))) return [{ k: 'dmg', n: Number(m[1]), to: 'that' }]
	if (/^you may flip to your alter-ego form$/i.test(s)) return [{ k: 'choose', options: [{ label: 'Flip to alter-ego', steps: [{ k: 'flip' }] }, { label: 'No', steps: [] }] }]
	if (/^(?:that attack does not get a boost card|do not give it a boost card for this activation)$/i.test(s)) return [{ k: 'extraBoost', n: -1 }]
	if (/^give (?:this enemy|him|her|it) another boost card$/i.test(s)) return [{ k: 'extraBoost', n: 1 }]
	if ((m = s.match(/^deal yourself (\d+|an?) facedown encounter cards?$/i)))
		return Array.from({ length: /^\d+$/.test(m[1]) ? Number(m[1]) : 1 }, () => ({ k: 'dealEncounter', each: false }) as Step)
	if ((m = s.match(/^deal damage to an enemy equal to your (ATK|THW)$/i))) return [{ k: 'dmg', n: 'X', to: 'enemy' }]
	if ((m = s.match(/^remove (\d+) threat from among schemes in play$/i))) return [{ k: 'thwart', n: Number(m[1]), from: 'scheme' }]
	if ((m = s.match(/^choose and discard (\d+|a) cards? from your hand$/i))) return [{ k: 'discardHand', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1, random: false, each: false }]
	if (/^(?:put this card into play|any player can do this|\(limit once per round per player\.?\))$/i.test(s)) return [{ k: 'noop' }]
	// ── Ultron's drones: the top card of a deck, facedown, as a 1/1/1 minion
	if ((m = s.match(/^(each player|the first player|you|the engaged player|that player) puts? the top (\d+ )?cards? of (?:their|your|the) deck into play facedown, engaged with (?:them|you) as (?:a )?drone minions?$/i)))
		return [{ k: 'drone', n: m[2] ? Number(m[2]) : 1, each: /each/i.test(m[1]), first: /first/i.test(m[1]) }]
	if ((m = s.match(/^put the top card of (?:your|the) deck into play facedown, engaged with you as a drone minion$/i))) return [{ k: 'drone', n: 1, each: false }]
	// ── searches continue in the next sentence: "Put that minion into play engaged with you."
	if ((m = s.match(/^(put|reveal) (?:that|the chosen) (minion|side scheme|card|attachment|environment)(?: into play)?(?: engaged with (you|the first player))?$/i)))
		return [{ k: 'thatCard', then: m[1].toLowerCase() === 'reveal' ? 'reveal' : m[3]?.toLowerCase() === 'the first player' ? 'engageFirst' : m[2].toLowerCase() === 'minion' ? 'engage' : 'play' }]
	if ((m = s.match(/^search the encounter deck(?: and discard pile)? for (?:an? |the |1 )?(.+?)$/i)) && !/ and | then /i.test(m[1]))
		return [{ k: 'encSearch', what: m[1], then: 'reveal', discard: /discard pile/i.test(s) }]
	if (/^reveal the top card of the encounter deck$/i.test(s) || /^reveal another card from the encounter deck$/i.test(s)) return [{ k: 'revealTop' }]
	if ((m = s.match(/^look at the top (\d+) cards of your deck$/i))) return [{ k: 'manualLook', n: Number(m[1]) }]
	if ((m = s.match(/^if (.+?) is (not )?in play, (.+)$/i)) && NAMES.cards.has(m[1].toLowerCase().replace(/^the /, ''))) {
		const st = sentence(m[3], names, villainNames)
		if (st) return [{ k: 'ifInPlay', name: m[1].toLowerCase().replace(/^the /, ''), not: !!m[2], steps: st }]
	}
	if ((m = s.match(/^if (you are|your hero is|(.+?) is) already (stunned|confused)(?:, (.+))?$/i)) && m[4]) {
		const st = sentence(m[4], names, villainNames)
		if (st) return [{ k: 'ifStatus', s: m[3].toLowerCase() === 'stunned' ? 'stun' : 'conf', who: m[2] ? (whoOf(m[2], names) ?? 'hero') : 'hero', steps: st }]
	}
	if ((m = s.match(/^if (.+?) already has a tough status card, (.+)$/i))) {
		const st = sentence(m[2], names, villainNames)
		const w = whoOf(m[1], names)
		if (st && w) return [{ k: 'ifStatus', s: 'tough', who: w, steps: st }]
	}
	if ((m = s.match(/^each player (?:chooses to either|must choose to either) (.+?) or (.+)$/i))) {
		const a = sentence(m[1].replace(/\btheir\b/g, 'your'), names, villainNames)
		const b = sentence(m[2].replace(/\btheir\b/g, 'your'), names, villainNames)
		if (a && b) return [{ k: 'forEachPlayer', steps: [{ k: 'choose', options: [{ label: m[1], steps: a }, { label: m[2], steps: b }] }] }]
	}
	if ((m = s.match(/^(.+?) attacks (?:your hero|you)$/i))) {
		const w = whoOf(m[1], names)
		if (w && w.startsWith('named:')) return [{ k: 'enemyAttacks', who: w }]
	}
	if (/^exhaust your identity( card)?$/i.test(s)) return [{ k: 'exhaust', who: 'hero' }]
	if ((m = s.match(/^give (the villain|.+?) and each minion engaged with you a tough status card$/i))) return [{ k: 'status', s: 'tough', who: 'villain' }, { k: 'status', s: 'tough', who: 'eachMinion' }]
	if ((m = s.match(/^(?:then, )?at the end of this attack, discard (.+)$/i))) return [{ k: 'discardAfterAttack' }]
	if (/^(?:place it here instead|then, if there is at least \d+ damage here, discard .+)$/i.test(s)) return [{ k: 'noop' }] // armour: handled by the damage rules
	// ── things that need no action from the game
	if (/^(this effect cannot be canceled|any player may trigger this ability|any player whose .* may trigger this ability|advanced? to stage \d+b|shuffle the encounter deck( if it was searched)?|\(?without looking\)?|support)$/i.test(s)) return [{ k: 'noop' }]
	if (/^remove this card from the game( and the campaign pool)?$/i.test(s)) return [{ k: 'removeSelf' }]
	if ((m = s.match(/^otherwise,?\s+(.+)$/i))) {
		const st = sentence(m[1], names, villainNames)
		return st ? [{ k: 'otherwise', steps: st }] : null
	}
	if ((m = s.match(/^search the encounter deck(?: and discard pile)? for (?:an? |the |1 )?(.+?)(?:,| and)\s*(reveal (?:it|him|her)|put (?:it|him|her) into play(?: engaged with you)?|add (?:it|him|her) to your hand)(?:,? then shuffle the encounter deck)?$/i)))
		return [{ k: 'encSearch', what: m[1].replace(/\s+(side scheme|minion|environment|attachment|card|treachery)$/i, (x) => x), then: /reveal/i.test(m[2]) ? 'reveal' : /engaged/i.test(m[2]) ? 'engage' : /hand/i.test(m[2]) ? 'hand' : 'play', discard: /discard pile/i.test(s) }]
	if ((m = s.match(/^(?:put|reveal) (?:the |your set-aside |each )?(.+?) (?:into play|side scheme)(?: engaged with you)?$/i)) && NAMES.cards.has(m[1].toLowerCase()))
		return [{ k: 'encSearch', what: m[1], then: /engaged/i.test(s) ? 'engage' : /^reveal/i.test(s) ? 'reveal' : 'play', discard: true }]
	if ((m = s.match(/^(?:put|reveal) (?:the )?(.+?) (side scheme|environment|minion)(?: into play)?(?: engaged with you)?$/i)) && NAMES.cards.has(m[1].toLowerCase()))
		return [{ k: 'encSearch', what: m[1], then: /engaged/i.test(s) || m[2] === 'minion' ? 'engage' : /^reveal/i.test(s) ? 'reveal' : 'play', discard: true }]
	if ((m = s.match(/^discard the top (\d+|) ?cards? (?:of|from) the encounter deck$/i)) || (m = s.match(/^discard (\d+) cards? from the encounter deck$/i)))
		return [{ k: 'encMill', n: m[1] ? Number(m[1]) : 1 }]
	if ((m = s.match(/^discard cards from the (?:top of the )?encounter deck until an? (.+?) is discarded$/i))) return [{ k: 'encMill', n: 99, until: m[1] }]
	if ((m = s.match(/^each player discards the top (\d+|) ?cards? of their deck$/i))) return [{ k: 'deckMill', n: m[1] ? Number(m[1]) : 1, each: true }]
	if ((m = s.match(/^(each player )?discards? (\d+|a|an) (random )?cards? (?:at random )?from (?:your|their) hand$/i)))
		return [{ k: 'discardHand', n: /^\d+$/.test(m[2]) ? Number(m[2]) : 1, random: !!m[3] || /at random/i.test(s), each: !!m[1] }]
	if ((m = s.match(/^deal (\d+) indirect damage to (each player|you|each hero)$/i))) return [{ k: 'dmg', n: Number(m[1]), to: /you/i.test(m[2]) ? 'hero' : 'eachHero' }]
	if ((m = s.match(/^deal (\d+) damage to the villain and each minion engaged with (?:you|that player)$/i))) return [{ k: 'dmg', n: Number(m[1]), to: 'villain' }, { k: 'dmg', n: Number(m[1]), to: 'eachMinion' }]
	if ((m = s.match(/^(.+?) (?:cannot|can't) take (?:any )?damage (?:this phase|until the end of the phase)$/i))) {
		const w = whoOf(m[1], names)
		return w ? [{ k: 'shield' }] : null
	}
	if ((m = s.match(/^(?:it|your hero|that character|you) gets? \+(\d+) (ATK|THW|DEF) for (?:that|this) (?:attack|defense|thwart)$/i))) return [{ k: 'bonus', stat: m[2].toLowerCase() as 'atk', n: Number(m[1]), who: 'hero' }]
	if ((m = s.match(/^place (\d+|a|an) [\w'-]+ counters? on (.+)$/i))) {
		const w = whoOf(m[2], names)
		if (w) return [{ k: 'counter', n: /^\d+$/.test(m[1]) ? Number(m[1]) : 1, who: w }]
	}
	if ((m = s.match(/^remove (\d+|a|an|all) [\w'-]+ counters? from (.+)$/i))) {
		const w = whoOf(m[2], names)
		if (w) return [{ k: 'counter', n: m[1] === 'all' ? -99 : -(/^\d+$/.test(m[1]) ? Number(m[1]) : 1), who: w }]
	}
	if ((m = s.match(/^place (\d+(?:\s*\[per_hero\])?) (?:additional )?threat on each scheme(?: in play)?$/i))) return [{ k: 'threat', n: num(m[1]), on: 'eachScheme' }]
	if (/^deal each player a facedown encounter card$/i.test(s)) return [{ k: 'dealEncounter', each: true }]
	if (/^deal (?:the engaged player|that player) an encounter card$/i.test(s)) return [{ k: 'dealEncounter', each: false }]
	if (/^shuffle (this card|.+) into the encounter deck$/i.test(s) && /^shuffle (this card|it)/i.test(s)) return [{ k: 'shuffleIn' }]
	if ((m = s.match(/^attach this card to (your hero|your identity|the villain|.+)$/i))) {
		const w = whoOf(m[1], names)
		return w ? [{ k: 'attachSelf', who: w }] : null
	}
	if ((m = s.match(/^(?:he|she|it|they|the villain|the enemy leader) (attacks|schemes) (?:you )?instead$/i))) return [{ k: 'activate', mode: m[1].toLowerCase() === 'attacks' ? 'attack' : 'scheme' }]
	if ((m = s.match(/^if this activation is an attack, it gains (piercing|overkill|ranged)$/i)) || (m = s.match(/^the attack gains (piercing|overkill|ranged)$/i)))
		return [{ k: 'attackGains', kw: m[1].toLowerCase() as 'piercing' }]
	if ((m = s.match(/^give (?:the activating enemy|that enemy|the enemy leader) a tough status card$/i))) return [{ k: 'status', s: 'tough', who: 'villain' }]
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
	const vn = ['the villain', 'the enemy leader', 'your leader', ...villainNames.map((v) => v.toLowerCase())]
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
const RES: Record<string, string> = { energy: 'e', mental: 'm', physical: 'p', wild: 'w' }
/** "Spend a [energy] resource", "Spend [physical][physical] resources" */
function spendOf(cost: string): Step | null {
	const m = cost.match(/^spend (?:an? |\d+ )?((?:\[(?:energy|mental|physical|wild)\]\s*)+) resources?\.?$/i)
	if (!m) return null
	const rs = [...m[1].matchAll(/\[(\w+)\]/g)].map((x) => RES[x[1].toLowerCase()])
	return { k: 'spendRes', r: rs[0], n: rs.length }
}

export function effect(text: string, names: string[], villainNames: string[] = []): Step[] {
	// "- Exhaust the Milano." lines are bullets too; a text that starts with bullets is a choice
	let t = text.trim().replace(/^\s*-\s?(?=[A-Z])/gm, '• ')
	const seq = t.match(/^make the following \d+ attacks in order:\s*([\s\S]*)$/i)
	if (seq) t = seq[1].replace(/•\s*/g, '')
	if (/^•/.test(t)) t = 'Choose one:\n' + t
	const choose = t.match(/^([\s\S]*?)choose(?: one)?:\s*\n?([\s\S]*)$/i)
	if (choose && /•/.test(choose[2])) {
		const before = effect(choose[1], names, villainNames)
		const options = choose[2]
			.split('•')
			.map((o) => o.trim())
			.filter(Boolean)
			.map((o) => {
				const ar = o.split('→')
				if (ar.length > 1) {
					const cost = ar[0].trim()
					const sp = spendOf(cost)
					const pre: Step[] = /^exhaust /i.test(cost) ? [{ k: 'exhaustHeroCost' }] : sp ? [sp] : [{ k: 'manual', text: cost }]
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
		// "If X, Y. Otherwise, Z." → Z is the "No" answer of the question about X
		const prev = out[out.length - 1]
		const already = p.match(/^if you (?:were|are) already (stunned|confused), (.+?) instead\.?$/i)
		if (already && prev?.k === 'status' && prev.who === 'hero') {
			const alt = sentence(already[2], names, villainNames)
			if (alt) {
				out[out.length - 1] = { k: 'statusOr', s: already[1].toLowerCase() === 'stunned' ? 'stun' : 'conf', alt }
				continue
			}
		}
		if (st && st.length === 1 && st[0].k === 'otherwise' && prev?.k === 'choose' && prev.options.length === 2 && prev.options[1].label === 'No' && !prev.options[1].steps.length) {
			prev.options[1] = { label: 'No', steps: st[0].steps }
			continue
		}
		if (!st && /^add (\d+|one|1) (?:of them )?to your hand and discard the (?:others|rest)/i.test(p) && prev?.k === 'manualLook') {
			out[out.length - 1] = { k: 'lookTop', n: (prev as { n: number }).n }
			continue
		}
		if (st && st.length === 1 && st[0].k === 'thatCard' && prev?.k === 'encSearch') {
			const t = st[0].then
			prev.then = t === 'engageFirst' ? 'engage' : t === 'hand' ? 'hand' : t
			continue
		}
		if (st) out.push(...st.filter((x) => x.k !== 'noop'))
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
	// identities answer to their own names as "you"; any other card's own name means this card
	const ident = c.t === 'hero' || c.t === 'alter_ego'
	const names = ident ? [c.n, alterName ?? c.n, c.s ?? '\u0000'] : ['\u0000', '\u0000', c.n]
	const villainNames = [...NAMES.villains]
	const out: Parsed = { keywords: {}, mods: [], abilities: [], notes: [] }
	const lines: string[] = []
	// "Surge.<b>When Revealed</b>: …" — a new ability starts at a bold timing word, even on the same line
	const raw = (c.x ?? '')
		.replace(/<i>([^<]{2,40})<\/i>\s*[—–-]\s*(<b>Special<\/b>)\s*:/g, '$2: ⟦$1⟧ ').replace(/([.)])\s*(?=<b>[^<]*?(?:When Revealed|When Defeated|When Completed|Forced|Response|Interrupt|Action|Resource|Setup|Special|Boost)[^<]*<\/b>)/g, '$1\n')
	for (const l of strip(raw)
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)) {
		// bullet options belong to the line that says "Choose:"
		if (/^(•|-\s?[A-Z])/.test(l) && lines.length) lines[lines.length - 1] += '\n' + l
		else lines.push(l)
	}
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
			const ab: Ability = { timing, form: tm[2], tag: tag?.trim(), cost: [], steps: [], text: (star ? '★ ' : '') + line.replace(/⟦(.+?)⟧\s*/, '') }
			const lb = body.match(/^⟦(.+?)⟧\s*/)
			if (lb) {
				ab.label = lb[1]
				body = body.slice(lb[0].length)
			}
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
			// an arrow inside a bullet is that option's cost, not the ability's
			if (arrow.length > 1 && !/•|\n\s*-\s?[A-Z]/.test(arrow[0])) {
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
