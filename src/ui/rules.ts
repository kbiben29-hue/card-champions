// Short rules explanations shown in context (our own wording, following the Marvel Champions Rules
// Reference): on prompts, in the card viewer (keywords the card uses), and as one-time tips when
// something happens for the first time in a game.

export interface Rule {
	title: string
	text: string
}

export const RULES: Record<string, Rule> = {
	// ── the round ──
	round: {
		title: 'The round',
		text: 'Each round has a player phase (every player takes a turn, first player first) and then a villain phase. At the end of the player phase everyone may discard cards, draws back up to their hand size, and readies their exhausted cards.',
	},
	turn: {
		title: 'Your turn',
		text: 'On your turn you can do these in any order, as often as you can afford: play cards, use your identity’s basic power (heroes: Attack, Thwart; alter egos: Recover), use allies and card abilities, and change form once. Using a basic power exhausts your identity.',
	},
	pay: {
		title: 'Paying for cards',
		text: 'A card’s cost is paid by discarding cards from your hand: each card gives the resources printed in its bottom-left corner. Resource cards (Energy, Genius, Strength…) give more, and some cards in play can generate resources too.',
	},
	forms: {
		title: 'Hero and alter-ego',
		text: 'You start in alter-ego form. You may flip your identity once per round. Heroes attack, thwart and can defend; alter egos recover and draw more cards. In villain phase the villain attacks heroes but schemes against alter egos.',
	},
	mulligan: {
		title: 'Mulligan',
		text: 'Before the first round you may discard any cards from your opening hand and draw back up to your hand size. You only get one mulligan.',
	},
	handsize: {
		title: 'End of the player phase',
		text: 'After all players have taken their turns, each player may discard any number of cards, then draws until their hand is full (the hand size on the identity side showing). Then all exhausted player cards ready.',
	},
	// ── villain phase ──
	villainPhase: {
		title: 'Villain phase',
		text: '1. Threat goes on the main scheme (its escalation value per player, plus 1 for each acceleration icon or token). 2. The villain activates against each player in turn order, then each minion engaged with that player activates. 3. Each player is dealt an encounter card (plus 1 more per hazard icon in play). 4. Players reveal their encounter cards in turn order. 5. The first-player token moves left.',
	},
	activation: {
		title: 'Villain activations',
		text: 'Against a hero the villain attacks: it gets one facedown boost card, you choose a defender, then the boost card flips and its boost icons add to the villain’s ATK. Against an alter ego it schemes instead: the same boost, added to its SCH, as threat on the main scheme.',
	},
	defend: {
		title: 'Defending',
		text: 'Your hero can exhaust to defend: the damage is reduced by its DEF. An ally can exhaust to defend instead: it takes all of the damage itself (extra damage is lost unless the attack has overkill). Exhausted characters can’t defend, and staying ready to defend means not using that hero on your next turn.',
	},
	boost: {
		title: 'Boost cards',
		text: 'When an enemy activates it gets a facedown card from the encounter deck. After defenders are chosen it flips: each boost icon adds 1 to the attack or scheme, and a ★ boost ability resolves. Minions only get boost cards if they have villainous.',
	},
	encounter: {
		title: 'Encounter cards',
		text: 'Minions engage you, side schemes go into play with their starting threat, attachments go on the villain, treacheries resolve their “When Revealed” and are discarded, obligations are your hero’s personal troubles, and environments stay in play.',
	},
	stage: {
		title: 'Villain stages',
		text: 'When the villain has damage equal to its hit points it is defeated and the next stage replaces it (the damage is removed). Defeat the last stage to win. If the main scheme’s threat reaches its threshold, the next main scheme stage starts — after the last one the villain wins.',
	},
	threat: {
		title: 'Threat and schemes',
		text: 'Schemes hold threat. Thwarting removes it. A side scheme with no threat left is defeated. If the main scheme reaches its threat threshold the players fall behind (and on the last stage, lose).',
	},
	// ── keywords ──
	guard: { title: 'Guard', text: 'While a minion with guard is engaged with you, you can’t attack the villain. Deal with the guard first.' },
	patrol: { title: 'Patrol', text: 'While a minion with patrol is engaged with you, you can’t thwart the main scheme.' },
	toughness: { title: 'Toughness', text: 'The character enters play with a tough status card.' },
	tough: { title: 'Tough', text: 'The next time a character with a tough status card would take damage, discard the tough card instead and prevent all of that damage.' },
	stun: { title: 'Stunned', text: 'A stunned character’s next attack doesn’t happen: the stun card is removed instead. A stunned villain doesn’t attack — removing the stun is the whole activation.' },
	confuse: { title: 'Confused', text: 'A confused character’s next thwart (or a villain’s next scheme) doesn’t happen: the confused card is removed instead.' },
	quickstrike: { title: 'Quickstrike', text: 'After this minion engages your hero, it attacks you right away.' },
	surge: { title: 'Surge', text: 'After this card resolves, reveal one more encounter card.' },
	retaliate: { title: 'Retaliate X', text: 'After this character is attacked, it deals X damage to the attacker.' },
	piercing: { title: 'Piercing', text: 'This attack discards the target’s tough status card before damage, so the damage goes through.' },
	overkill: { title: 'Overkill', text: 'If an ally defends against this attack, damage beyond what the ally can take goes to its controller’s identity.' },
	ranged: { title: 'Ranged', text: 'Retaliate doesn’t trigger against this attack.' },
	steady: { title: 'Steady', text: 'This character can have two stunned and two confused status cards at once.' },
	stalwart: { title: 'Stalwart', text: 'This character can’t be stunned or confused.' },
	villainous: { title: 'Villainous', text: 'This minion gets a boost card when it activates, like the villain.' },
	incite: { title: 'Incite X', text: 'When revealed, place X threat on the main scheme.' },
	hinder: { title: 'Hinder X', text: 'When revealed, this scheme gets X extra threat.' },
	victory: { title: 'Victory X', text: 'When defeated, this card goes to the victory display instead of the discard pile.' },
	permanent: { title: 'Permanent', text: 'This card can’t leave play.' },
	uses: { title: 'Uses', text: 'The card enters play with that many counters. Its abilities spend them; when the last one is gone, the card is discarded.' },
	consequential: { title: 'Consequential damage', text: 'The number under an ally’s ATK or THW is the damage it takes for attacking or thwarting.' },
	allyLimit: { title: 'Ally limit', text: 'You can have at most three allies in play. If you play a fourth, discard one.' },
	unique: { title: 'Unique (◆)', text: 'You can’t have two copies of a unique card in play at once.' },
	crisis: { title: 'Crisis icon', text: 'While a side scheme with a crisis icon is in play, no one can remove threat from the main scheme.' },
	acceleration: { title: 'Acceleration icon', text: 'Each acceleration icon in play adds 1 threat to the main scheme in step 1 of the villain phase.' },
	hazard: { title: 'Hazard icon', text: 'Each hazard icon in play deals one more encounter card in the villain phase.' },
	amplify: { title: 'Amplify icon', text: 'Each time a boost card is turned faceup, place 1 threat on the main scheme for each amplify icon in play.' },
	obligation: { title: 'Obligations', text: 'Each hero brings an obligation into the encounter deck: a personal problem. Revealing it usually asks you to give something up — often a choice for your alter ego.' },
	nemesis: { title: 'Nemesis', text: 'Each hero’s nemesis set waits outside the game. “Shadow of the Past” brings your nemesis minion and its side scheme into play and shuffles the rest of the set into the encounter deck.' },
	assault: { title: 'Assault', text: 'Basic thwarts against this scheme use ATK instead of THW.' },
	peril: { title: 'Peril', text: 'While you resolve this card, other players can’t help you.' },
	temporary: { title: 'Temporary', text: 'Discard this card at the end of the round.' },
	vulnerable: { title: 'Vulnerable', text: 'Discard this character if it is stunned or confused.' },
	restricted: { title: 'Restricted', text: 'A player can have at most two restricted cards in play.' },
	interrupt: { title: 'Interrupts and responses', text: 'An interrupt happens just before its trigger (and can change it); a response happens just after. “Forced” ones always happen. The game offers your interrupts and responses when their moment comes.' },
	// ── competitive ──
	pvp: {
		title: 'Civil War competitive mode',
		text: 'Each team plays against the other team’s leader, schemes and encounter deck. Each round: the Registration team’s player phase, then the Resistance team’s, then both villain phases. The first team to defeat the enemy leader wins; completing your last main scheme or losing every hero means a loss.',
	},
	choosingSides: {
		title: 'Choosing Sides',
		text: 'This permanent side scheme starts in play. While it’s there the enemy leader can’t take more than 2 damage from each attack. Clear it to earn your leader’s special cards.',
	},
}

/** Keywords a card's text mentions → rules worth showing next to it. */
export function rulesForText(text: string | undefined, type: string): Rule[] {
	const t = (text ?? '').replace(/<[^>]+>/g, '').toLowerCase()
	const keys: string[] = []
	const kw: [RegExp, string][] = [
		[/\bguard\b/, 'guard'],
		[/\bpatrol\b/, 'patrol'],
		[/\btoughness\b/, 'toughness'],
		[/\btough status\b/, 'tough'],
		[/\bstun/, 'stun'],
		[/\bconfuse/, 'confuse'],
		[/\bquickstrike\b/, 'quickstrike'],
		[/\bsurge\b/, 'surge'],
		[/\bretaliate\b/, 'retaliate'],
		[/\bpiercing\b/, 'piercing'],
		[/\boverkill\b/, 'overkill'],
		[/\branged\b/, 'ranged'],
		[/\bsteady\b/, 'steady'],
		[/\bstalwart\b/, 'stalwart'],
		[/\bvillainous\b/, 'villainous'],
		[/\bincite\b/, 'incite'],
		[/\bhinder\b/, 'hinder'],
		[/\bvictory\b/, 'victory'],
		[/\bpermanent\b/, 'permanent'],
		[/\buses \(/, 'uses'],
		[/\bassault\b/, 'assault'],
		[/\bperil\b/, 'peril'],
		[/\btemporary\b/, 'temporary'],
		[/\bvulnerable\b/, 'vulnerable'],
		[/\brestricted\b/, 'restricted'],
		[/\bcrisis\b/, 'crisis'],
		[/\bacceleration\b/, 'acceleration'],
		[/\bhazard\b/, 'hazard'],
		[/\bamplify\b/, 'amplify'],
		[/\b(interrupt|response)\b/, 'interrupt'],
		[/\bboost\b/, 'boost'],
	]
	for (const [re, k] of kw) if (re.test(t) && !keys.includes(k)) keys.push(k)
	if (type === 'ally') keys.push('consequential', 'allyLimit')
	if (type === 'obligation') keys.push('obligation')
	if (type === 'hero' || type === 'alter_ego') keys.push('forms', 'turn')
	if (type === 'villain' || type === 'leader') keys.push('stage', 'activation')
	if (type === 'main_scheme' || type === 'side_scheme') keys.push('threat')
	if (type === 'resource') keys.push('pay')
	return keys.map((k) => RULES[k]).filter(Boolean)
}

/** The rule that explains a prompt. */
export function ruleForPrompt(kind: string, text: string): Rule | undefined {
	if (kind === 'mulligan') return RULES.mulligan
	if (kind === 'defend') return RULES.defend
	if (kind === 'allyLimit') return RULES.allyLimit
	if (kind === 'window') return RULES.interrupt
	if (kind === 'manual') return { title: 'Doing it by hand', text: 'The game couldn’t read this part of the card yet. Do it like on a real table: tap a card, open Table tools, and add or remove damage, threat, counters or statuses, or move the card. Then tap Done.' }
	if (/nemesis/i.test(text)) return RULES.nemesis
	return undefined
}

const TIPS_KEY = 'champions.tips'
export function tipsOn(): boolean {
	try {
		return localStorage.getItem(TIPS_KEY) !== 'off'
	} catch {
		return true
	}
}
export function setTips(on: boolean) {
	try {
		localStorage.setItem(TIPS_KEY, on ? 'on' : 'off')
	} catch {}
}

/** One-time tips: which moment in the log is worth explaining the first time it happens. */
export function tipForLog(line: string): string | undefined {
	if (/^— .*turn \(round 1\)/.test(line)) return 'turn'
	if (/^Villain phase:/.test(line)) return 'villainPhase'
	if (/attacks /.test(line)) return 'activation'
	if (/^Boost:/.test(line)) return 'boost'
	if (/reveals .*\(minion\)/.test(line) || /reveals .*\(treachery\)/.test(line)) return 'encounter'
	if (/Surge:/.test(line)) return 'surge'
	if (/stage .* begins/.test(line)) return 'stage'
	if (/tough status card prevents/.test(line)) return 'tough'
	if (/is stunned: /.test(line)) return 'stun'
	if (/nemesis appears/.test(line)) return 'nemesis'
	if (/\(obligation\)/.test(line)) return 'obligation'
	if (/Choosing Sides is revealed/.test(line)) return 'choosingSides'
	return undefined
}
