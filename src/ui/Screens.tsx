import { useMemo, useState } from 'react'
import { ASPECT_NAME, ASPECTS, card, heroes, modularSets, PACKS, packInfo, scenarios, setInfo, type HeroInfo } from '../data/data'
import { deckCodes, deckSize, fromMarvelCdb, starterDeck, type DeckList } from '../engine/decks'
import type { PlayerSetup, Setup } from '../engine/engine'
import { CardImg } from './Card'

export type Mode = 'solo' | 'coop' | 'pvp'

const COLL = 'champions.collection'
export function loadCollection(): Set<string> | null {
	try {
		const v = localStorage.getItem(COLL)
		return v ? new Set(JSON.parse(v) as string[]) : null
	} catch {
		return null
	}
}
function saveCollection(s: Set<string> | null) {
	try {
		if (s) localStorage.setItem(COLL, JSON.stringify([...s]))
		else localStorage.removeItem(COLL)
	} catch {}
}

export function Home({ onNew, onResume, resumeLabel, onJoin }: { onNew: (m: Mode) => void; onResume?: () => void; resumeLabel?: string; onJoin: () => void }) {
	return (
		<div className="screen home">
			<div className="logo">
				<span className="logo-a">CARD</span>
				<span className="logo-b">CHAMPIONS</span>
				<small>an unofficial table for Marvel Champions: The Card Game</small>
			</div>
			<div className="home-grid">
				{onResume && (
					<button className="mode-card resume" onClick={onResume}>
						<b>▶ {resumeLabel ?? 'Continue'}</b>
						<span>Pick up where you left off.</span>
					</button>
				)}
				<button className="mode-card solo" onClick={() => onNew('solo')}>
					<b>Solo</b>
					<span>One hero against a villain. The table you lay your cards down on.</span>
				</button>
				<button className="mode-card coop" onClick={() => onNew('coop')}>
					<b>Team up</b>
					<span>2–4 heroes on this device, side by side against the villain.</span>
				</button>
				<button className="mode-card pvp" onClick={() => onNew('pvp')}>
					<b>Civil War — hero vs hero</b>
					<span>Competitive mode: Registration against Resistance. Race to take down the enemy leader — on one device or online.</span>
				</button>
				<button className="mode-card join" onClick={onJoin}>
					<b>Join a friend</b>
					<span>Enter the game code your friend sent you.</span>
				</button>
			</div>
			<p className="fine">
				Card data and pictures from MarvelCDB. Fan project — not affiliated with Fantasy Flight Games or Marvel. Every hero, villain and pack MarvelCDB lists is in; cards the game can't read yet ask you to do that bit with the table tools.
			</p>
		</div>
	)
}

interface Seat {
	name: string
	hero: string
	aspect: string
	deck: DeckList | null
	importText: string
	importMsg?: string
}

const DEF_HEROES = ['spider_man', 'captain_marvel', 'she_hulk', 'iron_man']
const DEF_ASPECT = ['justice', 'leadership', 'aggression', 'protection']

export interface SetupResult {
	setup: Setup
	online?: 'host'
}

export function NewGame({ mode, onStart, onBack, guest }: { mode: Mode; onStart: (r: SetupResult) => void; onBack: () => void; guest?: (p: PlayerSetup) => void }) {
	const [coll, setColl] = useState<Set<string> | null>(() => loadCollection())
	const [showColl, setShowColl] = useState(false)
	const [count, setCount] = useState(mode === 'coop' ? 2 : mode === 'pvp' ? 2 : 1)
	const [seats, setSeats] = useState<Seat[]>(() =>
		[0, 1, 2, 3].map((k) => ({ name: mode === 'pvp' ? (k === 0 ? 'Registration' : 'Resistance') : `Player ${k + 1}`, hero: DEF_HEROES[k], aspect: DEF_ASPECT[k], deck: null, importText: '' })),
	)
	const [pick, setPick] = useState<number | null>(null)
	const scs = useMemo(() => scenarios().filter((s) => (mode === 'pvp' ? !!s.pvp : true)), [mode])
	const owned = (pack: string) => !coll || coll.has(pack)
	const [scenario, setScenario] = useState(() => (mode === 'pvp' ? 'captain_america_leader' : 'rhino'))
	const [scenario2, setScenario2] = useState('iron_man_leader')
	const sc = scs.find((s) => s.id === scenario) ?? scs[0]
	const [modular, setModular] = useState<string[] | null>(null)
	const mods = modular ?? sc.modular.slice(0, Math.max(1, sc.modularCount))
	const [expert, setExpert] = useState(false)
	const [online, setOnline] = useState(false)
	const shown = seats.slice(0, guest ? 1 : count)
	const upd = (k: number, f: Partial<Seat>) => setSeats((s) => s.map((x, i) => (i === k ? { ...x, ...f } : x)))
	const deckOf = (s: Seat) => s.deck ?? starterDeck(s.hero, s.aspect, coll, 7)

	const importDeck = async (k: number) => {
		const t = seats[k].importText.trim()
		const m = t.match(/(decklist|deck)\/(?:view\/)?(\d+)/) ?? t.match(/^(\d+)$/)
		if (!m) return upd(k, { importMsg: 'Paste a MarvelCDB deck link (marvelcdb.com/decklist/view/…) or its number.' })
		const id = m[2] ?? m[1]
		const kind = /decklist/.test(t) || /^\d+$/.test(t) ? 'decklist' : 'deck'
		upd(k, { importMsg: 'Loading…' })
		for (const k2 of [kind, kind === 'decklist' ? 'deck' : 'decklist']) {
			try {
				const r = await fetch(`https://marvelcdb.com/api/public/${k2}/${id}`)
				if (!r.ok) continue
				const j = await r.json()
				const d = fromMarvelCdb(j)
				if (d) return upd(k, { deck: d, hero: d.hero, aspect: d.aspect, importMsg: `Loaded “${d.name}” (${deckSize(d)} cards).` })
			} catch {
				/* try the other kind */
			}
		}
		upd(k, { importMsg: 'Couldn’t load that deck. Private decks must be published (or shared) on MarvelCDB first.' })
	}

	const start = () => {
		const players: PlayerSetup[] = shown.map((s, i) => ({ name: s.name || `Player ${i + 1}`, hero: s.hero, deck: deckCodes(deckOf(s)), area: mode === 'pvp' ? i : 0 }))
		if (guest) return guest(players[0])
		const seed = (Date.now() ^ (Math.random() * 1e9)) | 0
		if (mode === 'pvp') {
			// each team plays against the other team's leader scenario
			const sA = scs.find((s) => s.id === scenario2)!
			const sB = scs.find((s) => s.id === scenario)!
			const mA = sA.modular.slice(0, 2)
			const mB = sB.modular.slice(0, 2)
			onStart({
				setup: {
					mode: 'pvp',
					seed,
					players: online ? players.slice(0, 1) : players,
					areas: [
						{ scenario: sB.id, modular: mB, expert },
						{ scenario: sA.id, modular: mA, expert },
					],
				},
				online: online ? 'host' : undefined,
			})
			return
		}
		onStart({ setup: { mode: 'coop', seed, players, areas: [{ scenario: sc.id, modular: mods, expert }] } })
	}

	const regs = scs.filter((s) => s.pvp === 'registration')
	const ress = scs.filter((s) => s.pvp === 'resistance')

	return (
		<div className="screen setup">
			<div className="setup-head">
				<button onClick={onBack}>← Back</button>
				<h2>{guest ? 'Join: choose your hero' : mode === 'solo' ? 'Solo game' : mode === 'coop' ? 'Team up' : 'Civil War: hero vs hero'}</h2>
				<button onClick={() => setShowColl(true)}>My collection{coll ? ` (${coll.size} packs)` : ' (everything)'}</button>
			</div>
			{mode === 'coop' && !guest && (
				<div className="row">
					Heroes:{' '}
					{[2, 3, 4].map((n) => (
						<button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>
							{n}
						</button>
					))}
				</div>
			)}
			<div className="seats">
				{shown.map((s, k) => {
					const d = deckOf(s)
					const h = heroes().find((x) => x.set === s.hero)
					return (
						<div className="seat panel" key={k}>
							<input className="seat-name" value={s.name} onChange={(e) => upd(k, { name: e.target.value })} />
							<button className="hero-pick" onClick={() => setPick(k)}>
								{h && <CardImg code={h.code} className="hero-thumb" />}
								<span>
									<b>{h?.name}</b>
									<small>{h ? card(h.alter).n : ''} · tap to change</small>
								</span>
							</button>
							<div className="aspects">
								{ASPECTS.map((a) => (
									<button key={a} className={`asp asp-${a} ${s.aspect === a ? 'on' : ''}`} onClick={() => upd(k, { aspect: a, deck: null })}>
										{ASPECT_NAME[a]}
									</button>
								))}
							</div>
							<div className="deckline">
								{s.deck ? `Imported: ${s.deck.name}` : `Starter deck: hero kit + ${ASPECT_NAME[s.aspect]} + Basic`} · {deckSize(d)} cards
								{s.deck && (
									<button className="link" onClick={() => upd(k, { deck: null, importMsg: undefined })}>
										use the starter deck
									</button>
								)}
							</div>
							<details>
								<summary>Import a MarvelCDB deck</summary>
								<div className="row">
									<input placeholder="marvelcdb.com/decklist/view/…" value={s.importText} onChange={(e) => upd(k, { importText: e.target.value })} />
									<button onClick={() => importDeck(k)}>Load</button>
								</div>
								{s.importMsg && <small>{s.importMsg}</small>}
							</details>
							<DeckPeek d={d} />
						</div>
					)
				})}
			</div>

			{!guest && mode !== 'pvp' && (
				<div className="panel">
					<h3>Villain</h3>
					<select value={sc.id} onChange={(e) => (setScenario(e.target.value), setModular(null))}>
						{PACKS.filter((p) => scs.some((s) => s.pack === p.code)).map((p) => (
							<optgroup key={p.code} label={`${p.name}${owned(p.code) ? '' : ' (not owned)'}`}>
								{scs
									.filter((s) => s.pack === p.code)
									.map((s) => (
										<option key={s.id} value={s.id}>
											{s.villainName} — {s.name}
										</option>
									))}
							</optgroup>
						))}
					</select>
					<div className="villain-peek">
						<CardImg code={sc.standard[0]} className="v-thumb" />
						<CardImg code={sc.schemes[0]} className="s-thumb" />
						<div>
							<div>
								<b>{sc.villainName}</b> · {packInfo(sc.pack)?.name}
							</div>
							{sc.special && <small className="warn">{sc.special}</small>}
							<div className="row wrap">
								<label>
									<input type="checkbox" checked={expert} onChange={(e) => setExpert(e.target.checked)} /> Expert
								</label>
							</div>
							<div>
								Modular sets:{' '}
								{mods.map((m) => (
									<span className="chip" key={m}>
										{setInfo(m)?.name}{' '}
										<button className="x" onClick={() => setModular(mods.filter((x) => x !== m))}>
											×
										</button>
									</span>
								))}
								<select value="" onChange={(e) => e.target.value && setModular([...mods, e.target.value])}>
									<option value="">+ add a modular set</option>
									{modularSets()
										.filter((m) => !mods.includes(m.code))
										.map((m) => (
											<option key={m.code} value={m.code}>
												{m.name}
											</option>
										))}
								</select>
							</div>
						</div>
					</div>
				</div>
			)}
			{!guest && mode === 'pvp' && (
				<div className="panel">
					<h3>Leaders</h3>
					<p className="sub">Each team picks its leader. You play against the other team's leader, its main schemes and encounter deck.</p>
					<div className="row wrap">
						<label>
							Registration leader{' '}
							<select value={scenario2} onChange={(e) => setScenario2(e.target.value)}>
								{regs.map((s) => (
									<option key={s.id} value={s.id}>
										{s.villainName}
									</option>
								))}
							</select>
						</label>
						<label>
							Resistance leader{' '}
							<select value={scenario} onChange={(e) => setScenario(e.target.value)}>
								{ress.map((s) => (
									<option key={s.id} value={s.id}>
										{s.villainName}
									</option>
								))}
							</select>
						</label>
						<label>
							<input type="checkbox" checked={expert} onChange={(e) => setExpert(e.target.checked)} /> Expert (leader III / IV)
						</label>
						<label>
							<input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Play online with a friend (you are Registration)
						</label>
					</div>
				</div>
			)}
			<div className="row end">
				<button className="primary big" onClick={start}>
					{guest ? 'Join the game' : online ? 'Open the game for my friend' : 'Start'}
				</button>
			</div>

			{pick !== null && (
				<HeroPicker
					owned={owned}
					onPick={(h) => {
						upd(pick, { hero: h.set, deck: null })
						setPick(null)
					}}
					onClose={() => setPick(null)}
				/>
			)}
			{showColl && (
				<Collection
					coll={coll}
					onChange={(c) => {
						setColl(c)
						saveCollection(c)
					}}
					onClose={() => setShowColl(false)}
				/>
			)}
		</div>
	)
}

function DeckPeek({ d }: { d: DeckList }) {
	const [open, setOpen] = useState(false)
	const codes = deckCodes(d)
	const counts = new Map<string, number>()
	for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1)
	return (
		<div>
			<button className="link" onClick={() => setOpen(!open)}>
				{open ? 'Hide the deck' : 'Show the deck'}
			</button>
			{open && (
				<ul className="decklist">
					{[...counts].map(([c, n]) => (
						<li key={c}>
							{n}× {card(c).n} <small>({card(c).t})</small>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function HeroPicker({ onPick, onClose, owned }: { onPick: (h: HeroInfo) => void; onClose: () => void; owned: (p: string) => boolean }) {
	const [q, setQ] = useState('')
	const list = heroes().filter((h) => !q || (h.name + ' ' + card(h.alter).n).toLowerCase().includes(q.toLowerCase()))
	return (
		<div className="modal" onClick={onClose}>
			<div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
				<div className="row">
					<h3>Choose a hero</h3>
					<input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
					<button onClick={onClose}>Close</button>
				</div>
				<div className="hero-grid">
					{list.map((h) => (
						<button key={h.set} className={`hero-tile ${owned(h.pack) ? '' : 'unowned'}`} onClick={() => onPick(h)}>
							<CardImg code={h.code} />
							<b>{h.name}</b>
							<small>{card(h.alter).n}</small>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}

function Collection({ coll, onChange, onClose }: { coll: Set<string> | null; onChange: (c: Set<string> | null) => void; onClose: () => void }) {
	const all = PACKS
	const has = (p: string) => !coll || coll.has(p)
	const toggle = (p: string) => {
		const s = new Set(coll ?? all.map((x) => x.code))
		if (s.has(p)) s.delete(p)
		else s.add(p)
		onChange(s.size === all.length ? null : s)
	}
	return (
		<div className="modal" onClick={onClose}>
			<div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
				<div className="row">
					<h3>My collection</h3>
					<button onClick={() => onChange(null)}>Everything</button>
					<button onClick={() => onChange(new Set(['core']))}>Core Set only</button>
					<button className="primary" onClick={onClose}>
						Done
					</button>
				</div>
				<p className="sub">Starter decks only use cards from the packs you own. Remembered on this device.</p>
				<div className="pack-grid">
					{all.map((p) => (
						<label key={p.code} className={has(p.code) ? 'on' : ''}>
							<input type="checkbox" checked={has(p.code)} onChange={() => toggle(p.code)} /> {p.name} <small>{p.type}</small>
						</label>
					))}
				</div>
			</div>
		</div>
	)
}

export function JoinScreen({ onJoin, onBack, initial }: { onJoin: (code: string) => void; onBack: () => void; initial?: string }) {
	const [code, setCode] = useState(initial ?? '')
	return (
		<div className="screen setup">
			<div className="setup-head">
				<button onClick={onBack}>← Back</button>
				<h2>Join a friend</h2>
			</div>
			<div className="panel">
				<p>Type the game code your friend sees on their screen (or open the link they sent).</p>
				<div className="row">
					<input value={code} onChange={(e) => setCode(e.target.value.trim().toLowerCase())} placeholder="game code" />
					<button className="primary" disabled={code.length < 4} onClick={() => onJoin(code)}>
						Next
					</button>
				</div>
			</div>
		</div>
	)
}
