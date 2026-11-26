// Home and the new-game wizard:
//   1. How to play  (solo · two-handed solo · co-op · 1v1)
//   2. Heroes       (hero, then deck: box deck / starter deck / MarvelCDB)
//   3. Villain      (by expansion or all villains; 1v1: the two leaders)
//   4. Ready        (difficulty, modular sets, summary → start)
import { useMemo, useState } from 'react'
import { ASPECT_NAME, ASPECTS, card, heroes, modularSets, PACKS, packInfo, scenarios, setInfo, type Scenario } from '../data/data'
import { deckCodes, deckSize, fromMarvelCdb, packAspect, PRECONS, preconDeck, type DeckList } from '../engine/decks'
import type { PlayerSetup, Setup } from '../engine/engine'
import { CardImg } from './Card'
import { RULES } from './rules'

export type Mode = 'solo' | 'two' | 'coop' | 'pvp'

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

export function Home({ onNew, onResume, resumeLabel, onJoin }: { onNew: () => void; onResume?: () => void; resumeLabel?: string; onJoin: () => void }) {
	return (
		<div className="screen home">
			<div className="logo">
				<span className="logo-a">MARVEL</span>
				<span className="logo-b">CHAMPIONS</span>
				<small>an unofficial table for Marvel Champions: The Card Game</small>
			</div>
			<div className="home-buttons">
				{onResume && (
					<button className="mode-card resume" onClick={onResume}>
						<b>▶ {resumeLabel ?? 'Continue'}</b>
						<span>Pick up where you left off.</span>
					</button>
				)}
				<button className="mode-card solo" onClick={onNew}>
					<b>New game</b>
					<span>Solo, two-handed, co-op against the villain — or 1 v 1.</span>
				</button>
				<button className="mode-card join" onClick={onJoin}>
					<b>Join a friend</b>
					<span>Enter the code your friend sent you.</span>
				</button>
			</div>
			<p className="fine">Card data and pictures from MarvelCDB. Fan project — not affiliated with Fantasy Flight Games or Marvel.</p>
		</div>
	)
}

// ───────── the wizard ─────────

type DeckKind = 'pre' | 'cdb'
interface Seat {
	name: string
	hero: string
	kind: DeckKind
	aspect: string
	cdb: DeckList | null
	cdbText: string
	cdbMsg?: string
}

const DEF_HEROES = ['spider_man', 'captain_marvel', 'she_hulk', 'iron_man']

export interface SetupResult {
	setup: Setup
	online?: 'host'
}

const MODES: { id: Mode; title: string; text: string; icon: string }[] = [
	{ id: 'solo', title: 'Solo', text: 'One hero against the villain.', icon: '🦸' },
	{ id: 'two', title: 'Two-handed solo', text: 'You play two heroes side by side.', icon: '🦸🦸' },
	{ id: 'coop', title: 'Co-op', text: '2–4 players: pass this device around, or play online with a friend.', icon: '🤝' },
	{ id: 'pvp', title: '1 v 1', text: 'Civil War competitive: Registration vs Resistance, each racing to beat the other’s leader.', icon: '⚔️' },
]

export function NewGame({ onStart, onBack, guestMode, onGuest }: { onStart: (r: SetupResult) => void; onBack: () => void; guestMode?: Mode; onGuest?: (p: PlayerSetup) => void }) {
	const guest = !!onGuest
	const [step, setStep] = useState(guest ? 1 : 0)
	const [mode, setMode] = useState<Mode>(guestMode ?? 'solo')
	const [online, setOnline] = useState(false)
	const [count, setCount] = useState(2)
	const [coll, setColl] = useState<Set<string> | null>(() => loadCollection())
	const [showColl, setShowColl] = useState(false)
	const [seats, setSeats] = useState<Seat[]>(() =>
		[0, 1, 2, 3].map((k) => {
			const hero = DEF_HEROES[(k + (onGuest ? 1 : 0)) % 4]
			return { name: `Player ${k + 1}`, hero, kind: 'pre' as DeckKind, aspect: packAspect(hero), cdb: null, cdbText: '' }
		}),
	)
	const [editing, setEditing] = useState(0)
	const allScs = useMemo(() => scenarios(), [])
	const [scenario, setScenario] = useState('rhino')
	const [regLeader, setRegLeader] = useState('iron_man_leader')
	const [resLeader, setResLeader] = useState('captain_america_leader')
	const [modular, setModular] = useState<string[] | null>(null)
	const [expert, setExpert] = useState(false)
	const owned = (pack: string) => !coll || coll.has(pack)

	const nSeats = guest ? 1 : mode === 'solo' ? 1 : mode === 'two' ? 2 : mode === 'pvp' ? (online ? 1 : 2) : online ? 1 : count
	const shown = seats.slice(0, nSeats)
	const upd = (k: number, f: Partial<Seat>) => setSeats((s) => s.map((x, i) => (i === k ? { ...x, ...f } : x)))
	const deckOf = (s: Seat): DeckList => (s.kind === 'cdb' && s.cdb ? s.cdb : preconDeck(s.hero))
	const sc: Scenario = allScs.find((s) => s.id === scenario) ?? allScs[0]
	const mods = modular ?? sc.modular.slice(0, Math.max(1, sc.modularCount))

	const steps = guest ? ['Your deck'] : ['How to play', 'Decks', mode === 'pvp' ? 'Leaders' : 'Villain', 'Ready']
	const seatName = (k: number) => (mode === 'pvp' ? (k === 0 ? 'Registration' : 'Resistance') : mode === 'two' ? `Hero ${k + 1}` : seats[k].name)

	const start = () => {
		const players: PlayerSetup[] = shown.map((s, i) => ({ name: mode === 'pvp' ? seatName(i) : mode === 'two' ? card(heroes().find((h) => h.set === s.hero)!.code).n : s.name || `Player ${i + 1}`, hero: s.hero, deck: deckCodes(deckOf(s)), area: mode === 'pvp' ? i : 0 }))
		if (onGuest) return onGuest(players[0])
		const seed = (Date.now() ^ (Math.random() * 1e9)) | 0
		if (mode === 'pvp') {
			const sReg = allScs.find((s) => s.id === regLeader)!
			const sRes = allScs.find((s) => s.id === resLeader)!
			return onStart({
				setup: {
					mode: 'pvp',
					seed,
					players,
					areas: [
						{ scenario: sRes.id, modular: sRes.modular.slice(0, 2), expert },
						{ scenario: sReg.id, modular: sReg.modular.slice(0, 2), expert },
					],
				},
				online: online ? 'host' : undefined,
			})
		}
		onStart({ setup: { mode: 'coop', seed, players, areas: [{ scenario: sc.id, modular: mods, expert }] }, online: online ? 'host' : undefined })
	}

	const last = steps.length - 1
	const next = () => (step >= last ? start() : setStep(step + 1))
	const back = () => (step === 0 || (guest && step === 1) ? onBack() : setStep(step - 1))

	return (
		<div className="screen wizard">
			<div className="wiz-head">
				<button onClick={back}>← {step === 0 || guest ? 'Home' : 'Back'}</button>
				<div className="wiz-steps">
					{steps.map((s, k) => {
						const idx = guest ? 1 : k
						return (
							<button key={s} className={`wiz-step ${idx === step ? 'on' : ''} ${idx < step ? 'done' : ''}`} disabled={idx > step} onClick={() => setStep(idx)}>
								<span>{k + 1}</span> {s}
							</button>
						)
					})}
				</div>
				<button className="coll-btn" onClick={() => setShowColl(true)}>
					📦 {coll ? `${coll.size} packs` : 'All packs'}
				</button>
			</div>

			<div className="wiz-body">
				{step === 0 && (
					<>
						<h2>How do you want to play?</h2>
						<div className="mode-grid">
							{MODES.map((m) => (
								<button key={m.id} className={`mode-card m-${m.id} ${mode === m.id ? 'picked' : ''}`} onClick={() => setMode(m.id)}>
									<i>{m.icon}</i>
									<b>{m.title}</b>
									<span>{m.text}</span>
								</button>
							))}
						</div>
						{(mode === 'coop' || mode === 'pvp') && (
							<div className="panel opts-row">
								<div className="seg">
									<button className={!online ? 'on' : ''} onClick={() => setOnline(false)}>
										On this device
									</button>
									<button className={online ? 'on' : ''} onClick={() => setOnline(true)}>
										Online with a friend
									</button>
								</div>
								{mode === 'coop' && !online && (
									<div className="seg">
										Players:
										{[2, 3, 4].map((n) => (
											<button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>
												{n}
											</button>
										))}
									</div>
								)}
								{online && <small>You pick your own hero and {mode === 'pvp' ? 'the leaders' : 'the villain'}; your friend picks their hero when they join.</small>}
							</div>
						)}
						<details className="manual-guide">
							<summary>📖 New to Marvel Champions? How a game goes</summary>
							{(mode === 'pvp' ? ['pvp', 'round', 'turn', 'villainPhase'] : ['round', 'turn', 'pay', 'forms', 'villainPhase', 'stage']).map((k) => (
								<div key={k} className="ref-rule">
									<b>{RULES[k].title}</b>
									<p>{RULES[k].text}</p>
								</div>
							))}
						</details>
					</>
				)}

				{step === 1 && (
					<>
						<h2>{guest ? 'Choose your deck' : nSeats > 1 ? 'Choose a deck for each hero' : 'Choose your deck'}</h2>
						{nSeats > 1 && (
							<div className="seat-tabs">
								{shown.map((s, k) => (
									<button key={k} className={editing === k ? 'on' : ''} onClick={() => setEditing(k)}>
										<CardImg code={heroes().find((h) => h.set === s.hero)!.code} className="tab-img" />
										<span>
											<small>{seatName(k)}</small>
											<b>{heroes().find((h) => h.set === s.hero)!.name}</b>
										</span>
									</button>
								))}
							</div>
						)}
						{(() => {
							const k = Math.min(editing, nSeats - 1)
							const s = seats[k]
							return (
								<div className="seat-editor2">
									{mode === 'coop' && !online && (
										<div className="row">
											<label>
												Name <input className="seat-name" value={s.name} onChange={(e) => upd(k, { name: e.target.value })} aria-label="Player name" />
											</label>
										</div>
									)}
									<div className="seg wide">
										<button className={s.kind === 'pre' ? 'on' : ''} onClick={() => upd(k, { kind: 'pre' })}>
											Premade decks
										</button>
										<button className={s.kind === 'cdb' ? 'on' : ''} onClick={() => upd(k, { kind: 'cdb' })}>
											Upload from MarvelCDB
										</button>
									</div>
									{s.kind === 'pre' ? (
										<DeckGallery value={s.hero} owned={owned} onPick={(set) => upd(k, { hero: set, aspect: packAspect(set), cdb: null })} />
									) : (
										<CdbImport seat={s} onChange={(f) => upd(k, f)} onLoaded={(dl) => upd(k, { cdb: dl, hero: dl.hero, aspect: dl.aspect })} />
									)}
									<div className="chosen">
										<CardImg code={heroes().find((x) => x.set === s.hero)!.code} className="sum-img" />
										<span>
											<b>{deckOf(s).name}</b>
											<br />
											<small>{deckSize(deckOf(s))} cards</small>
										</span>
										<DeckPeek d={deckOf(s)} />
									</div>
								</div>
							)
						})()}
					</>
				)}

				{step === 2 && mode !== 'pvp' && (
					<VillainPicker
						scs={allScs}
						value={scenario}
						owned={owned}
						onPick={(id) => {
							setScenario(id)
							setModular(null)
						}}
					/>
				)}
				{step === 2 && mode === 'pvp' && (
					<>
						<h2>Choose the leaders</h2>
						<p className="sub">Each team picks its leader. You play against the other team’s leader, its main schemes and its encounter deck — first team to beat the enemy leader wins.</p>
						<div className="leaders">
							{(['registration', 'resistance'] as const).map((side) => (
								<div key={side} className={`panel leader-col ${side}`}>
									<h3>{side === 'registration' ? 'Registration' : 'Resistance'} leader</h3>
									<div className="leader-grid">
										{allScs
											.filter((s) => s.pvp === side)
											.map((s) => {
												const on = (side === 'registration' ? regLeader : resLeader) === s.id
												return (
													<button key={s.id} className={`villain-tile ${on ? 'picked' : ''}`} onClick={() => (side === 'registration' ? setRegLeader(s.id) : setResLeader(s.id))}>
														<CardImg code={s.standard[0]} />
														<b>{s.villainName}</b>
													</button>
												)
											})}
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{step === 3 && (
					<>
						<h2>Ready?</h2>
						<div className="ready-grid">
							<div className="panel">
								<h3>{mode === 'pvp' ? 'Teams' : 'Heroes'}</h3>
								{shown.map((s, k) => {
									const h = heroes().find((x) => x.set === s.hero)!
									return (
										<div key={k} className="sum-row">
											<CardImg code={h.code} className="sum-img" />
											<span>
												<b>{h.name}</b> <small>{seatName(k)}</small>
												<br />
												<small>
													{deckOf(s).name} · {deckSize(deckOf(s))} cards
												</small>
											</span>
										</div>
									)
								})}
								{online && <p className="sub">+ your friend’s hero (they choose it when they join)</p>}
							</div>
							<div className="panel">
								<h3>Difficulty</h3>
								<div className="seg">
									<button className={!expert ? 'on' : ''} onClick={() => setExpert(false)}>
										Standard
									</button>
									<button className={expert ? 'on' : ''} onClick={() => setExpert(true)}>
										Expert
									</button>
								</div>
								{mode !== 'pvp' && (
									<>
										<div className="sum-row">
											<CardImg code={sc.standard[0]} className="sum-img" />
											<span>
												<b>{sc.villainName}</b> — {sc.name}
												<br />
												<small>{packInfo(sc.pack)?.name}</small>
											</span>
										</div>
										{sc.special && <p className="warn">{sc.special}</p>}
										<h3>Modular sets</h3>
										<div className="chips">
											{mods.map((m) => (
												<span className="chip" key={m}>
													{setInfo(m)?.name}
													<button className="x" aria-label="remove" onClick={() => setModular(mods.filter((x) => x !== m))}>
														×
													</button>
												</span>
											))}
										</div>
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
									</>
								)}
							</div>
						</div>
					</>
				)}
			</div>

			<div className="wiz-foot">
				<button onClick={back}>Back</button>
				<span className="grow" />
				<button className="primary big" onClick={next}>
					{guest ? 'Join the game' : step < last ? 'Next →' : online ? 'Invite my friend' : 'Start the game'}
				</button>
			</div>

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

function CdbImport({ seat, onChange, onLoaded }: { seat: Seat; onChange: (f: Partial<Seat>) => void; onLoaded: (d: DeckList) => void }) {
	const load = async () => {
		const t = seat.cdbText.trim()
		const m = t.match(/(decklist|deck)\/(?:view\/)?(\d+)/) ?? t.match(/^(\d+)$/)
		if (!m) return onChange({ cdbMsg: 'Paste a MarvelCDB deck link (marvelcdb.com/decklist/view/…) or just its number.' })
		const id = m[2] ?? m[1]
		const first = /\/deck\//.test(t) ? 'deck' : 'decklist'
		onChange({ cdbMsg: 'Loading…' })
		for (const kind of [first, first === 'deck' ? 'decklist' : 'deck']) {
			try {
				const r = await fetch(`https://marvelcdb.com/api/public/${kind}/${id}`)
				if (!r.ok) continue
				const d = fromMarvelCdb(await r.json())
				if (d) {
					onLoaded(d)
					return onChange({ cdbMsg: `Loaded “${d.name}” — ${deckSize(d)} cards.` })
				}
			} catch {
				/* try the other kind */
			}
		}
		onChange({ cdbMsg: 'Couldn’t load that deck. On MarvelCDB a deck must be published, or set to public sharing, to load here.' })
	}
	return (
		<div className="cdb">
			<p className="sub">Paste the link of any public deck on marvelcdb.com — the hero comes with it.</p>
			<div className="row">
				<input placeholder="marvelcdb.com/decklist/view/12345" value={seat.cdbText} onChange={(e) => onChange({ cdbText: e.target.value })} />
				<button className="primary" onClick={load}>
					Load
				</button>
			</div>
			{seat.cdbMsg && <small>{seat.cdbMsg}</small>}
		</div>
	)
}

function VillainPicker({ scs, value, onPick, owned }: { scs: Scenario[]; value: string; onPick: (id: string) => void; owned: (p: string) => boolean }) {
	const packs = PACKS.filter((p) => scs.some((s) => s.pack === p.code))
	const [pack, setPack] = useState<string | null>(null)
	const [q, setQ] = useState('')
	const found = q ? scs.filter((s) => (s.villainName + ' ' + s.name).toLowerCase().includes(q.toLowerCase())) : null
	if (pack === null && !found)
		return (
			<>
				<h2>Choose an expansion</h2>
				<div className="filters">
					<input className="search" placeholder="…or search for a villain" value={q} onChange={(e) => setQ(e.target.value)} />
				</div>
				<div className="exp-grid">
					{packs.map((p) => {
						const list = scs.filter((s) => s.pack === p.code)
						const cur = list.some((s) => s.id === value)
						return (
							<button key={p.code} className={`exp-tile ${cur ? 'picked' : ''} ${owned(p.code) ? '' : 'unowned'}`} onClick={() => setPack(p.code)}>
								<CardImg code={list[0].standard[0]} />
								<b>{p.name}</b>
								<small className="count">
									{list.length} scenario{list.length > 1 ? 's' : ''}
									{p.date ? ` · ${p.date.slice(0, 4)}` : ''}
								</small>
							</button>
						)
					})}
				</div>
			</>
		)
	const list = found ?? scs.filter((s) => s.pack === pack)
	return (
		<>
			<div className="crumb">
				<button onClick={() => (setPack(null), setQ(''))}>← All expansions</button>
				<h2 className="grow">{found ? `Villains matching “${q}”` : packInfo(pack!)?.name}</h2>
			</div>
			<div className="villain-grid">
				{list.map((s) => (
					<button key={s.id} className={`villain-tile ${value === s.id ? 'picked' : ''} ${owned(s.pack) ? '' : 'unowned'}`} onClick={() => onPick(s.id)}>
						<CardImg code={s.standard[0]} />
						<b>{s.villainName}</b>
						<small>{s.name}</small>
						{s.special && <em className="partial">partly automatic</em>}
					</button>
				))}
			</div>
		</>
	)
}

function DeckGallery({ value, owned, onPick }: { value: string; owned: (p: string) => boolean; onPick: (heroSet: string) => void }) {
	const [q, setQ] = useState('')
	const [asp, setAsp] = useState<string | null>(null)
	const [onlyOwned, setOnlyOwned] = useState(false)
	const list = PRECONS.map((p) => ({ p, h: heroes().find((x) => x.set === p.set), d: preconDeck(p.set) }))
		.filter(({ h }) => !!h)
		.filter(({ p, h, d }) => (!q || (p.name + ' ' + card(h!.alter).n + ' ' + (packInfo(h!.pack)?.name ?? '')).toLowerCase().includes(q.toLowerCase())) && (!asp || d.aspect === asp) && (!onlyOwned || owned(h!.pack)))
	return (
		<>
			<div className="filters">
				<input placeholder="Search heroes" value={q} onChange={(e) => setQ(e.target.value)} />
				{ASPECTS.map((a) => (
					<button key={a} className={`asp asp-${a} ${asp === a ? 'on' : ''}`} onClick={() => setAsp(asp === a ? null : a)}>
						{ASPECT_NAME[a]}
					</button>
				))}
				<label className="nowrap">
					<input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> Owned only
				</label>
			</div>
			<div className="deck-grid">
				{list.map(({ p, h, d }) => (
					<button key={p.set} className={`deck-tile ${value === p.set ? 'picked' : ''} ${owned(h!.pack) ? '' : 'unowned'}`} onClick={() => onPick(p.set)}>
						<span className={`asp-band ${d.aspect}`} />
						<CardImg code={h!.code} />
						<b>{h!.name}</b>
						<small>
							{ASPECT_NAME[d.aspect] ?? d.aspect} · {packInfo(h!.pack)?.name}
						</small>
					</button>
				))}
			</div>
		</>
	)
}

function DeckPeek({ d }: { d: DeckList }) {
	const [open, setOpen] = useState(false)
	const codes = deckCodes(d)
	const counts = new Map<string, number>()
	for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1)
	const byType = new Map<string, [string, number][]>()
	for (const [c, n] of counts) {
		const t = card(c).t
		byType.set(t, [...(byType.get(t) ?? []), [c, n]])
	}
	return (
		<div className="deck-peek">
			<button className="link" onClick={() => setOpen(!open)}>
				{open ? 'Hide the deck list' : `See the deck list (${codes.length} cards)`}
			</button>
			{open && (
				<div className="decklist">
					{[...byType].map(([t, list]) => (
						<div key={t}>
							<h4>
								{t.replace(/_/g, ' ')} ({list.reduce((a, [, n]) => a + n, 0)})
							</h4>
							{list.map(([c, n]) => (
								<div key={c}>
									{n}× {card(c).n}
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function Collection({ coll, onChange, onClose }: { coll: Set<string> | null; onChange: (c: Set<string> | null) => void; onClose: () => void }) {
	const has = (p: string) => !coll || coll.has(p)
	const toggle = (p: string) => {
		const s = new Set(coll ?? PACKS.map((x) => x.code))
		if (s.has(p)) s.delete(p)
		else s.add(p)
		onChange(s.size === PACKS.length ? null : s)
	}
	const groups: [string, string][] = [
		['core', 'Core'],
		['story', 'Campaign boxes'],
		['hero', 'Hero packs'],
		['scenario', 'Scenario packs'],
		['encounter', 'Other'],
	]
	return (
		<div className="modal sheet" onClick={onClose}>
			<div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
				<div className="row sticky">
					<h3 className="grow">My collection</h3>
					<button onClick={() => onChange(null)}>Everything</button>
					<button onClick={() => onChange(new Set(['core']))}>Core only</button>
					<button className="primary" onClick={onClose}>
						Done
					</button>
				</div>
				<p className="sub">Box decks and aspect decks only use cards from packs you own, and unowned heroes and villains are dimmed. Saved on this device.</p>
				{groups.map(([t, label]) => {
					const ps = PACKS.filter((p) => p.type === t)
					if (!ps.length) return null
					return (
						<div key={t}>
							<h4>{label}</h4>
							<div className="pack-grid">
								{ps.map((p) => (
									<label key={p.code} className={has(p.code) ? 'on' : ''}>
										<input type="checkbox" checked={has(p.code)} onChange={() => toggle(p.code)} /> {p.name}
									</label>
								))}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export function JoinScreen({ onJoin, onBack, initial }: { onJoin: (code: string) => void; onBack: () => void; initial?: string }) {
	const [code, setCode] = useState(initial ?? '')
	return (
		<div className="screen wizard">
			<div className="wiz-head">
				<button onClick={onBack}>← Home</button>
			</div>
			<div className="wiz-body">
				<h2>Join a friend</h2>
				<div className="panel">
					<p>Type the game code your friend sees on their screen (or open the link they sent).</p>
					<div className="row">
						<input value={code} onChange={(e) => setCode(e.target.value.trim().toLowerCase())} placeholder="game code" autoCapitalize="none" autoCorrect="off" />
						<button className="primary" disabled={code.length < 4} onClick={() => onJoin(code)}>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
