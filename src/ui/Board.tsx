// The table. Two layouts from the same pieces:
//  • 'table' (solo / team-up): villain and schemes across the top, your minions, your hero mat and
//    your fanned hand at the bottom. Prompts float in a tray; tap a card for its actions.
//  • 'console' (Civil War, hero vs hero): the same table on the left with the other team's game area
//    across the top, and a side column (status, prompt, card viewer, log) on the right.
// Drag a hand card onto the table to play it, drag your hero or an ally onto an enemy to attack or
// onto a scheme to thwart. Everything also works by tapping.
import type * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { card, has } from '../data/data'
import {
	actionsFor,
	allies,
	attachments,
	attackTargets,
	autoPay,
	canAct,
	engaged,
	formCard,
	handSize,
	inZone,
	minions,
	nameOf,
	playArea,
	playProblem,
	sides,
	stat,
	thwartTargets,
	threshold,
	type Game,
	type Inst,
	type Intent,
	type Prompt,
} from '../engine/engine'
import { parse } from '../engine/text'
import { CardImg, isLandscape, RulesText, cardTitle } from './Card'
import { RULES, ruleForPrompt, rulesForText, setTips, tipForLog, tipsOn, type Rule } from './rules'

export type Layout = 'table' | 'console'
type Dispatch = (it: Intent) => string | null

interface Aim {
	label: string
	options: number[]
	make: (t: number) => Intent
}

export function Board({
	g,
	viewer,
	setViewer,
	layout,
	dispatch,
	onMenu,
	onUndo,
	canControl,
	netBadge,
	pocket = false,
	tall = false,
	portrait = false,
}: {
	g: Game
	viewer: number
	setViewer: (p: number) => void
	layout: Layout
	dispatch: Dispatch
	onMenu: () => void
	onUndo?: () => void
	canControl: (p: number) => boolean
	netBadge?: React.ReactNode
	pocket?: boolean
	tall?: boolean
	portrait?: boolean
}) {
	const [sel, setSel] = useState<number | null>(null)
	const [aim, setAim] = useState<Aim | null>(null)
	const [err, setErr] = useState<string | null>(null)
	const [showLog, setShowLog] = useState(false)
	const [showRef, setShowRef] = useState(false)
	const [ending, setEnding] = useState(false)
	const [marked, setMarked] = useState<number[]>([])
	const [hidePrompt, setHidePrompt] = useState(false)
	const [tips, setTipsState] = useState(tipsOn)
	const [tip, setTip] = useState<Rule | null>(null)
	const seenTips = useRef<Set<string>>(new Set())
	const logSeen = useRef(0)
	useEffect(() => {
		const start = logSeen.current
		logSeen.current = g.log.length
		if (!tips || start > g.log.length) return
		for (const l of g.log.slice(start)) {
			const k = tipForLog(l.t)
			if (k && !seenTips.current.has(k) && RULES[k]) {
				seenTips.current.add(k)
				setTip(RULES[k])
				break
			}
		}
	}, [g.log.length, tips])
	const me = viewer
	const pl = g.players[me]
	const area = pl.area
	const ar = g.areas[area]
	const head: Prompt | undefined = g.queue[0]
	const myPrompt = head && head.who === me && canControl(me) ? head : undefined
	const myTurn = canAct(g, me) && canControl(me)

	useEffect(() => {
		if (!err) return
		const t = setTimeout(() => setErr(null), 3200)
		return () => clearTimeout(t)
	}, [err])
	useEffect(() => {
		setMarked([])
		setHidePrompt(false)
	}, [head?.kind, head?.who, g.queue.length])
	useEffect(() => {
		if (!myTurn) setEnding(false)
	}, [myTurn])

	const send = (it: Intent) => {
		const e = dispatch(it)
		if (e) setErr(e)
		else {
			setAim(null)
			setSel(null)
		}
		return e
	}

	// cards that glow: prompt options or aim options
	const glow = new Set<number>()
	if (myPrompt && (myPrompt.kind === 'target' || myPrompt.kind === 'defend' || myPrompt.kind === 'searchPick')) myPrompt.options.forEach((u) => glow.add(u))
	if (myPrompt?.kind === 'allyLimit') allies(g, me).forEach((a) => glow.add(a.uid))
	if (aim) aim.options.forEach((u) => glow.add(u))

	const tapCard = (uid: number) => {
		if (myPrompt && (myPrompt.kind === 'target' || myPrompt.kind === 'defend') && myPrompt.options.includes(uid)) {
			send({ t: 'answer', player: me, value: uid })
			return
		}
		if (myPrompt?.kind === 'allyLimit' && allies(g, me).some((a) => a.uid === uid)) {
			send({ t: 'answer', player: me, value: uid })
			return
		}
		if (aim && aim.options.includes(uid)) {
			send(aim.make(uid))
			return
		}
		if (myPrompt?.kind === 'mulligan' && pl.hand.includes(uid)) {
			setMarked((m) => (m.includes(uid) ? m.filter((x) => x !== uid) : [...m, uid]))
			return
		}
		if (ending && pl.hand.includes(uid)) {
			setMarked((m) => (m.includes(uid) ? m.filter((x) => x !== uid) : [...m, uid]))
			return
		}
		setAim(null)
		setSel(uid === sel ? null : uid)
	}

	// ── what an action needs: pick a target first
	const startAim = (it: Intent) => {
		if (it.t === 'basic' && it.power !== 'recover') {
			const opts = it.power === 'attack' ? attackTargets(g, me) : thwartTargets(g, me)
			if (!opts.length) return setErr(it.power === 'attack' ? 'No enemy you can attack.' : 'No scheme you can thwart.')
			if (opts.length === 1) return send({ ...it, target: opts[0] })
			setSel(null)
			return setAim({ label: it.power === 'attack' ? 'Attack: tap an enemy' : 'Thwart: tap a scheme', options: opts, make: (t) => ({ ...it, target: t }) })
		}
		if (it.t === 'ally') {
			const opts = it.power === 'attack' ? attackTargets(g, me) : thwartTargets(g, me)
			if (!opts.length) return setErr('Nothing to target.')
			if (opts.length === 1) return send({ ...it, target: opts[0] })
			setSel(null)
			return setAim({ label: `${nameOf(g, it.uid)}: tap a target`, options: opts, make: (t) => ({ ...it, target: t }) })
		}
		send(it)
	}

	// ── drag and drop
	const drag = useRef<{ uid: number; x: number; y: number; ghost?: HTMLElement; moved: boolean } | null>(null)
	const onDown = (uid: number, e: React.PointerEvent) => {
		if (e.button !== 0) return
		drag.current = { uid, x: e.clientX, y: e.clientY, moved: false }
		;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
	}
	const onMove = (e: React.PointerEvent) => {
		const d = drag.current
		if (!d) return
		const dx = e.clientX - d.x
		const dy = e.clientY - d.y
		if (!d.moved && Math.hypot(dx, dy) > 12) {
			d.moved = true
			const src = (e.currentTarget as HTMLElement).querySelector('img,.textcard') as HTMLElement | null
			const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
			const ghost = document.createElement('div')
			ghost.className = 'drag-ghost'
			ghost.style.width = `${r.width}px`
			ghost.style.height = `${r.height}px`
			if (src) ghost.appendChild(src.cloneNode(true))
			document.body.appendChild(ghost)
			d.ghost = ghost
		}
		if (d.ghost) {
			d.ghost.style.left = `${e.clientX - d.ghost.offsetWidth / 2}px`
			d.ghost.style.top = `${e.clientY - d.ghost.offsetHeight / 2}px`
		}
	}
	const onUp = (e: React.PointerEvent) => {
		const d = drag.current
		drag.current = null
		if (!d) return
		d.ghost?.remove()
		if (!d.moved) return tapCard(d.uid)
		const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
		const tEl = el?.closest('[data-uid]') as HTMLElement | null
		const target = tEl ? Number(tEl.dataset.uid) : undefined
		const onTable = !!el?.closest('.felt') && !el?.closest('.hand')
		const x = g.insts[d.uid]
		if (!x) return
		if (pl.hand.includes(d.uid)) {
			if (!onTable) return
			return send({ t: 'play', player: me, uid: d.uid, pay: [], target })
		}
		if (target === undefined) return
		const isEnemy = attackTargets(g, me).includes(target)
		const isScheme = thwartTargets(g, me).includes(target)
		if (x.zone === 'identity') {
			if (isEnemy) return send({ t: 'basic', player: me, power: 'attack', target })
			if (isScheme) return send({ t: 'basic', player: me, power: 'thwart', target })
		}
		if (x.zone === 'play' && card(x.code).t === 'ally') {
			if (isEnemy) return send({ t: 'ally', player: me, uid: d.uid, power: 'attack', target })
			if (isScheme) return send({ t: 'ally', player: me, uid: d.uid, power: 'thwart', target })
		}
	}
	const dragProps = (uid: number, mine: boolean) =>
		mine && canControl(me)
			? { onPointerDown: (e: React.PointerEvent) => onDown(uid, e), onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => (drag.current?.ghost?.remove(), (drag.current = null)) }
			: { onClick: () => tapCard(uid) }

	const tile = (x: Inst, opts: { size?: 'v' | 'm' | 's' | 'land' | 'land-s'; mine?: boolean; showHp?: boolean; label?: boolean } = {}) => (
		<Tile key={x.uid} g={g} x={x} size={opts.size ?? 'm'} label={opts.label} glow={glow.has(x.uid)} selected={sel === x.uid} marked={marked.includes(x.uid)} {...dragProps(x.uid, !!opts.mine)} />
	)

	const villain = g.insts[ar.villain]
	const main = g.insts[ar.main]
	const enc = ar.encDeck.length
	const encTop = ar.encDiscard[ar.encDiscard.length - 1]
	const others = ar.players.filter((p) => p !== me)
	const boostCards = Object.values(g.insts).filter((x) => x.zone === 'boost' && x.area === area && x.host !== undefined)

	const playable = (u: number) => myTurn && !playProblem(g, me, u)

	const dealt = Object.values(g.insts).filter((x) => x.zone === 'dealt' && x.ctrl === me)
	const attachedElsewhere = Object.values(g.insts).filter((x) => x.zone === 'play' && x.ctrl === me && x.host !== undefined && g.insts[x.host] && g.insts[x.host].zone !== 'play')
	const villainCard = villain ? card(villain.code) : null
	const table = (
		<div className={`felt page ${layout} ${others.length ? 'with-team' : ''}`}>
			{g.mode === 'pvp' && (
				<section className="cpanel p-enemy">
					<EnemyStrip g={g} area={1 - area} />
				</section>
			)}
			<section className="cpanel p-villain">
				<Caption>{villainCard ? `${villainCard.n}${villainCard.stage ? ` · ${villainCard.stage}` : ''}` : 'The villain'}</Caption>
				<div className="villain-slot">
					{villain && (
						<>
							{tile(villain, { size: 'v' })}
							<div className="attach-row">{attachments(g, villain.uid).map((a) => tile(a, { size: 's' }))}</div>
							{boostCards.length > 0 && (
								<div className="boosts">
									{boostCards.map((b) => (
										<div key={b.uid} className="facedown small" title="Boost card">
											✹
										</div>
									))}
								</div>
							)}
						</>
					)}
				</div>
			</section>
			<section className="cpanel p-scheme">
				<Caption>The scheme</Caption>
				<div className="scheme-slot">
					{main && tile(main, { size: 'land' })}
					<div className="side-row">{sides(g, area).map((s) => tile(s, { size: 'land-s' }))}</div>
				</div>
			</section>
			<section className="cpanel p-enc">
				<Caption>Encounter</Caption>
				<div className="env-slot">
					{inZone(g, area, 'env').map((x) => tile(x, { size: 's' }))}
					<div className="piles">
						<Pile label="Deck" n={enc} back />
						<Pile label="Discard" n={ar.encDiscard.length} code={encTop !== undefined ? g.insts[encTop]?.code : undefined} />
					</div>
				</div>
			</section>
			<section className="cpanel p-minions">
				<Caption>Engaged with {formCard(g, me).n}</Caption>
				<div className="minion-row">
					{engaged(g, me).map((m) => (
						<div className="with-attach" key={m.uid}>
							{tile(m, { size: 'm' })}
							{attachments(g, m.uid).map((a) => tile(a, { size: 's' }))}
						</div>
					))}
					{dealt.map((x) => (
						<div key={x.uid} className="facedown" title="Encounter card dealt to you">
							?
						</div>
					))}
					{!engaged(g, me).length && !dealt.length && <div className="empty">No minions — all clear!</div>}
				</div>
			</section>
			{others.length > 0 && (
				<section className="cpanel p-team">
					<Caption>The team</Caption>
					<div className="others">
						{others.map((p) => (
							<OtherHero key={p} g={g} p={p} onView={() => setViewer(p)} active={g.active === p} />
						))}
					</div>
				</section>
			)}
			<section className={`cpanel p-hero ${pl.form}`}>
				<Caption>{pl.form === 'hero' ? 'Hero form' : 'Alter-ego form'}</Caption>
				<div className="ident-slot">
					{tile(g.insts[pl.ident], { size: 'v', mine: true })}
					<div className="ident-info">
						<b>{formCard(g, me).n}</b>
						<span>{pl.name}</span>
						{pl.pool && <span className="pool">Resources ready: {pl.pool.length}</span>}
					</div>
				</div>
			</section>
			<section className="cpanel p-play">
				<Caption>In play</Caption>
				<div className="play-row">
					{playArea(g, me).map((x) => (
						<div className="with-attach" key={x.uid}>
							{tile(x, { size: 'm', mine: true })}
							{attachments(g, x.uid).map((a) => tile(a, { size: 's' }))}
						</div>
					))}
					{attachedElsewhere.map((x) => (
						<div className="attached-note" key={x.uid}>
							{tile(x, { size: 's', mine: true })}
							<small>on {nameOf(g, x.host!)}</small>
						</div>
					))}
					{!playArea(g, me).length && !attachedElsewhere.length && <div className="empty">Drag cards from your hand up here</div>}
				</div>
			</section>
			<section className="cpanel p-deck">
				<Caption>Your deck</Caption>
				<div className="piles mine">
					<Pile label="Deck" n={pl.deck.length} back />
					<Pile label="Discard" n={pl.discard.length} code={pl.discard.length ? g.insts[pl.discard[pl.discard.length - 1]].code : undefined} />
				</div>
			</section>
			<section className="cpanel p-hand">
				<Caption>
					Your hand · {pl.hand.length}
					{myTurn ? ' · glowing cards can be played' : ''}
				</Caption>
				<div className="hand" data-anchor="hand" style={{ ['--n' as string]: Math.max(1, pl.hand.length) }}>
					{pl.hand.map((u, k) => {
						const n = pl.hand.length
						const mid = (n - 1) / 2
						const rot = (k - mid) * Math.min(portrait ? 2.5 : 4, 22 / Math.max(1, n))
						const lift = Math.abs(k - mid) * Math.abs(k - mid) * 1.2
						return (
							<div
								key={u}
								data-uid={u}
								className={`hand-card ${playable(u) ? 'playable' : ''} ${sel === u ? 'selected' : ''} ${marked.includes(u) ? 'marked' : ''} ${glow.has(u) ? 'glow' : ''}`}
								style={{ transform: `translateY(${lift}px) rotate(${rot}deg)`, zIndex: sel === u ? 50 : k }}
								{...dragProps(u, true)}
							>
								<CardImg code={g.insts[u].code} />
								{(card(g.insts[u].code).res?.length ?? 0) > 0 && <span className="res-count">{card(g.insts[u].code).res!.length}</span>}
							</div>
						)
					})}
					{!pl.hand.length && <div className="empty">No cards in hand</div>}
				</div>
			</section>
		</div>
	)

	const statusBar = (
		<div className="topbar">
			<button onClick={onMenu} title="Menu">
				☰<span className="wide-only"> Menu</span>
			</button>
			{onUndo && (
				<button onClick={onUndo} title="Undo">
					↶<span className="wide-only"> Undo</span>
				</button>
			)}
			<span className="phase">
				Round {g.round} · {g.phase === 'player' ? `${g.players[g.active].name}'s turn` : g.phase === 'villain' ? 'Villain phase' : g.phase === 'over' ? 'Game over' : 'Setting up'}
			</span>
			{g.mode === 'coop' && ar.players.length > 1 && (
				<span className="tabs">
					{ar.players.map((p) => (
						<button key={p} className={p === me ? 'on' : ''} onClick={() => setViewer(p)}>
							{g.players[p].name}
							{g.active === p && g.phase === 'player' ? ' ●' : ''}
						</button>
					))}
				</span>
			)}
			{netBadge}
			<span className="grow" />
			<button className={showRef ? 'on' : ''} onClick={() => setShowRef(!showRef)}>
				Rules
			</button>
			<button className={showLog ? 'on' : ''} onClick={() => setShowLog(!showLog)}>
				Log
			</button>
		</div>
	)

	const actionBar = myTurn && !aim && (
		<div className="action-bar">
			{ending ? (
				<>
					<span>Tap any cards to discard before you draw back up ({handSize(g, me)}), then:</span>
					<button className="primary" onClick={() => (send({ t: 'endTurn', player: me, discard: marked }), setEnding(false), setMarked([]))}>
						End turn{marked.length ? ` (discard ${marked.length})` : ''}
					</button>
					<button onClick={() => (setEnding(false), setMarked([]))}>Back</button>
				</>
			) : (
				<button className="primary" onClick={() => setEnding(true)}>
					End turn
				</button>
			)}
		</div>
	)

	const prompt = myPrompt && !hidePrompt && <PromptBox g={g} p={myPrompt} me={me} marked={marked} send={send} onHide={() => setHidePrompt(true)} />
	const waiting = head && !myPrompt && <div className="tray waiting">Waiting for {g.players[head.who]?.name}…</div>
	const aimBox = aim && (
		<div className="tray aim">
			<b>{aim.label}</b>
			<button onClick={() => setAim(null)}>Cancel</button>
		</div>
	)
	const viewerBox = sel !== null && g.insts[sel] && (
		<Viewer
			g={g}
			uid={sel}
			me={me}
			canControl={canControl(me)}
			onClose={() => setSel(null)}
			act={(it) => (it.t === 'basic' || it.t === 'ally' ? startAim(it) : send(it))}
			play={(it) => send(it)}
			startAim={(a) => (setSel(null), setAim(a))}
		/>
	)
	const over = g.phase === 'over' && (
		<div className="modal">
			<div className="modal-box over">
				<h2>{g.banner}</h2>
				<p>
					{g.mode === 'coop'
						? g.winner === 'heroes'
							? `${card(ar.villainSeq[ar.villainSeq.length - 1]).n} is defeated in round ${g.round}.`
							: 'The villain got away with it this time.'
						: `${g.winner} take the day.`}
				</p>
				<button className="primary" onClick={onMenu}>
					Back to the menu
				</button>
			</div>
		</div>
	)

	if (layout === 'console')
		return (
			<div className={`board console ${tall ? 'tall' : ''}`}>
				{statusBar}
				<div className="console-main">
					{table}
					<div className="side-col">
						<StatusPanel g={g} area={area} />
						{prompt}
						{waiting}
						{aimBox}
						{actionBar}
						{viewerBox ?? <div className="viewer empty">Tap a card to see it here.</div>}
						<LogPanel g={g} />
					</div>
				</div>
				{showRef && <Reference onClose={() => setShowRef(false)} tips={tips} setTips={(v) => (setTips(v), setTipsState(v))} />}
				{err && <div className="toast">{err}</div>}
				{tip && (
					<div className="tip-box">
						<b>{tip.title}</b>
						<p>{tip.text}</p>
						<div className="row">
							<button className="primary" onClick={() => setTip(null)}>
								Got it
							</button>
							<button
								onClick={() => {
									setTips(false)
									setTipsState(false)
									setTip(null)
								}}
							>
								No more tips
							</button>
						</div>
					</div>
				)}
				{g.banner && <Banner key={g.log.length} text={g.banner} />}
				{over}
			</div>
		)
	const idAct = canControl(me) ? actionsFor(g, me, pl.ident) : []
	const hpMax = stat(g, pl.ident, 'hp')
	const ident = g.insts[pl.ident]
	const tabletop = (
		<main
			className="felt2"
			onClick={(e) => {
				if (e.target === e.currentTarget) setSel(null)
			}}
		>
			{g.mode === 'pvp' && <EnemyStrip g={g} area={1 - area} />}
			<section className="sky">
				<div className="group villain-group">
					{villain && tile(villain, { size: 'v', label: true })}
					{villain && attachments(g, villain.uid).length > 0 && <div className="attach-col">{attachments(g, villain.uid).map((a) => tile(a, { size: 's' }))}</div>}
					{boostCards.length > 0 && (
						<div className="boosts">
							{boostCards.map((b) => (
								<div key={b.uid} className="facedown small" title="Boost card">
									✹
								</div>
							))}
						</div>
					)}
				</div>
				<div className="group scheme-group">
					{main && tile(main, { size: 'land', label: true })}
					{sides(g, area).map((x) => tile(x, { size: 'land-s', label: true }))}
				</div>
				{inZone(g, area, 'env').length > 0 && <div className="group">{inZone(g, area, 'env').map((x) => tile(x, { size: 's', label: true }))}</div>}
			</section>
			<section className="piles-row">
				<Pile label="Encounter" n={enc} back />
				<Pile label="Discard" n={ar.encDiscard.length} code={encTop !== undefined ? g.insts[encTop]?.code : undefined} />
			</section>
			<section className="along">
				<span className="zone-label">Engaged with {formCard(g, me).n}</span>
				<div className="row center">
					{engaged(g, me).map((m) => (
						<div className="with-attach" key={m.uid}>
							{tile(m, { size: 'm', label: true })}
							{attachments(g, m.uid).map((a) => tile(a, { size: 's' }))}
						</div>
					))}
					{dealt.map((x) => (
						<div key={x.uid} className="facedown" title="Encounter card dealt to you">
							?
						</div>
					))}
					{!engaged(g, me).length && !dealt.length && <span className="quiet">no minions — the coast is clear</span>}
				</div>
			</section>
			<section className="mats">
				<div className={`mat me ${pl.form}`}>
					<div className="mat-head">
						<span className="chip name">{pl.name}</span>
						<span className="chip form">{pl.form === 'hero' ? formCard(g, me).n : `${formCard(g, me).n} (alter ego)`}</span>
						<span className="stat hp">
							{Math.max(0, hpMax - ident.dmg)}
							<small>HP</small>
						</span>
						{pl.form === 'hero' ? (
							<>
								<span className="stat thw">
									{stat(g, pl.ident, 'thw')}
									<small>THW</small>
								</span>
								<span className="stat atk">
									{stat(g, pl.ident, 'atk')}
									<small>ATK</small>
								</span>
								<span className="stat def">
									{stat(g, pl.ident, 'def')}
									<small>DEF</small>
								</span>
							</>
						) : (
							<span className="stat rec">
								{stat(g, pl.ident, 'rec')}
								<small>REC</small>
							</span>
						)}
						{pl.pool && <span className="chip pool">+{pl.pool.length} resources</span>}
					</div>
					<div className="mat-body">
						<div className="ident">{tile(ident, { size: 'v', mine: true })}</div>
						<div className="reach">
							{playArea(g, me).map((x) => (
								<div className="with-attach" key={x.uid}>
									{tile(x, { size: 'm', mine: true, label: true })}
									{attachments(g, x.uid).map((a) => tile(a, { size: 's' }))}
								</div>
							))}
							{attachedElsewhere.map((x) => (
								<div className="attached-note" key={x.uid}>
									{tile(x, { size: 's', mine: true })}
									<small>on {nameOf(g, x.host!)}</small>
								</div>
							))}
							{!playArea(g, me).length && !attachedElsewhere.length && <span className="zone-label">in play — drag cards up here</span>}
						</div>
						<div className="piles small">
							<Pile label="Deck" n={pl.deck.length} back mine />
							<Pile label="Discard" n={pl.discard.length} code={pl.discard.length ? g.insts[pl.discard[pl.discard.length - 1]].code : undefined} />
						</div>
					</div>
				</div>
				{others.map((p) => (
					<OtherHero key={p} g={g} p={p} onView={() => setViewer(p)} active={g.active === p} />
				))}
			</section>
		</main>
	)
	const handbar = (
		<section className="handbar">
			<div className="dock">
				{myTurn && !aim && !ending && (
					<span className="acts">
						{idAct.map((a, k) => (
							<button key={k} className={`act act-${k}`} disabled={!!a.why} title={a.why ? `${a.label} — ${a.why}` : a.label} onClick={() => startAim(a.intent)}>
								{a.intent.t === 'ability' ? `${a.label.split(':')[0]} ability` : a.label}
							</button>
						))}
						<button className="primary end" onClick={() => setEnding(true)}>
							End turn
						</button>
					</span>
				)}
				{myTurn && ending && (
					<span className="acts">
						<span className="hint">Tap cards to discard before drawing up to {handSize(g, me)}</span>
						<button className="primary end" onClick={() => (send({ t: 'endTurn', player: me, discard: marked }), setEnding(false), setMarked([]))}>
							End turn{marked.length ? ` (discard ${marked.length})` : ''}
						</button>
						<button onClick={() => (setEnding(false), setMarked([]))}>Back</button>
					</span>
				)}
				{!myTurn && !head && g.phase === 'player' && <span className="hint">{g.players[g.active].name} is taking their turn…</span>}
			</div>
			<div className="hand fan" data-anchor="hand">
				{pl.hand.map((u, k) => {
					const n = pl.hand.length
					const mid = (n - 1) / 2
					return (
						<div
							key={u}
							data-uid={u}
							className={`hcard ${playable(u) ? 'playable' : ''} ${sel === u ? 'selected' : ''} ${marked.includes(u) ? 'marked' : ''} ${glow.has(u) ? 'glow' : ''}`}
							style={{ ['--r' as string]: `${(k - mid) * Math.min(4, 24 / n)}deg`, ['--y' as string]: `${Math.abs(k - mid) ** 1.6 * 2}px`, zIndex: sel === u ? 50 : k }}
							{...dragProps(u, true)}
						>
							<CardImg code={g.insts[u].code} />
							{(card(g.insts[u].code).res?.length ?? 0) > 0 && <span className="res-count">{card(g.insts[u].code).res!.length}</span>}
						</div>
					)
				})}
				{!pl.hand.length && <span className="quiet">no cards in hand</span>}
			</div>
		</section>
	)
	return (
		<div className="board tabletop">
			{statusBar}
			{tabletop}
			{handbar}
			<div className="trays">
				{prompt}
				{waiting}
				{aimBox}
			</div>
			{myPrompt && hidePrompt && (
				<button className="show-prompt" onClick={() => setHidePrompt(false)}>
					Show the question
				</button>
			)}
			{viewerBox}
			{showLog && <LogPanel g={g} floating onClose={() => setShowLog(false)} />}
			{showRef && <Reference onClose={() => setShowRef(false)} tips={tips} setTips={(v) => (setTips(v), setTipsState(v))} />}
			{err && <div className="toast">{err}</div>}
			{tip && (
				<div className="tip-box">
					<b>{tip.title}</b>
					<p>{tip.text}</p>
					<div className="row">
						<button className="primary" onClick={() => setTip(null)}>
							Got it
						</button>
						<button
							onClick={() => {
								setTips(false)
								setTipsState(false)
								setTip(null)
							}}
						>
							No more tips
						</button>
					</div>
				</div>
			)}
			{g.banner && <Banner key={g.log.length} text={g.banner} />}
			{g.spotlight !== undefined && g.insts[g.spotlight] && <Spotlight code={g.insts[g.spotlight].code} />}
			{over}
		</div>
	)
}

/** A comic caption box: the label in the corner of each panel. */
function Caption({ children }: { children: React.ReactNode }) {
	return <div className="caption">{children}</div>
}

function Banner({ text }: { text: string }) {
	const [on, setOn] = useState(true)
	useEffect(() => {
		const t = setTimeout(() => setOn(false), 1400)
		return () => clearTimeout(t)
	}, [])
	return on ? <div className="banner">{text}</div> : null
}

function Spotlight({ code }: { code: string }) {
	return (
		<div className={`spotlight ${isLandscape(code) ? 'land' : ''}`}>
			<CardImg code={code} />
		</div>
	)
}

function Tile({ g, x, size, glow, selected, marked, label, ...rest }: { g: Game; x: Inst; size: string; glow: boolean; selected: boolean; marked: boolean; label?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
	const c = card(x.code)
	const hp = c.hp !== undefined || x.zone === 'identity' ? stat(g, x.uid, 'hp') : undefined
	const isScheme = x.zone === 'main' || x.zone === 'side'
	const thrMax = x.zone === 'main' ? threshold(g, x.area) : undefined
	const land = isLandscape(x.code) && x.zone !== 'play'
	const pr = parse(c)
	return (
		<div
			data-uid={x.uid}
			className={`tile size-${size} ${land ? 'land' : ''} ${x.ex ? 'exhausted' : ''} ${glow ? 'glow' : ''} ${selected ? 'selected' : ''} ${marked ? 'marked' : ''} zone-${x.zone}`}
			title={cardTitle(x.code)}
			style={{ ['--tilt' as string]: `${((x.uid * 37) % 7) - 3}deg` }}
			{...rest}
		>
			{x.facedown ? <div className="drone-back">DRONE</div> : <CardImg code={x.code} />}
			{label && <span className="tile-name">{x.facedown ? 'Drone' : c.n}</span>}
			<div className="badges">
				{hp !== undefined && !isScheme && (
					<span className="badge hp" title="Hit points left">
						♥ {Math.max(0, hp - x.dmg)}
						<small>/{hp}</small>
					</span>
				)}
				{x.dmg > 0 && hp === undefined && <span className="badge dmg">✖ {x.dmg}</span>}
				{(isScheme || x.thr > 0) && (
					<span className="badge thr" title="Threat">
						⚠ {x.thr}
						{thrMax ? <small>/{thrMax}</small> : null}
					</span>
				)}
				{x.ctr > 0 && <span className="badge ctr">● {x.ctr}</span>}
				{x.zone === 'main' && x.ctr > 0 && <span className="badge acc">» {x.ctr}</span>}
				{x.stun > 0 && <span className="badge st stun">STUN{x.stun > 1 ? ` ×${x.stun}` : ''}</span>}
				{x.conf > 0 && <span className="badge st conf">CONF{x.conf > 1 ? ` ×${x.conf}` : ''}</span>}
				{x.tough > 0 && <span className="badge st tough">TOUGH</span>}
				{(pr.keywords.guard || (x.zone === 'engaged' && /\bguard\b/i.test(c.x ?? ''))) && <span className="badge kw">GUARD</span>}
				{pr.keywords.patrol && <span className="badge kw">PATROL</span>}
				{(c.ic?.cri ?? 0) > 0 && <span className="badge kw crisis">CRISIS</span>}
				{(c.ic?.haz ?? 0) > 0 && <span className="badge kw">HAZARD</span>}
				{(c.ic?.acc ?? 0) > 0 && <span className="badge kw">ACCEL</span>}
				{has(c, 'perm') && null}
			</div>
		</div>
	)
}

function Pile({ label, n, back, code, mine }: { label: string; n: number; back?: boolean; code?: string; mine?: boolean }) {
	return (
		<div className="pile">
			{back || !code ? <div className={`pile-back ${mine ? 'mine' : ''} ${n ? '' : 'none'}`}>{n}</div> : <CardImg code={code} />}
			<small>
				{label} {code ? `(${n})` : ''}
			</small>
		</div>
	)
}

function OtherHero({ g, p, onView, active }: { g: Game; p: number; onView: () => void; active: boolean }) {
	const pl = g.players[p]
	const h = g.insts[pl.ident]
	const hp = stat(g, pl.ident, 'hp')
	return (
		<button className={`other ${active ? 'active' : ''} ${pl.out ? 'out' : ''}`} onClick={onView}>
			<CardImg code={h.code} />
			<span>
				<b>{pl.name}</b> {formCard(g, p).n}
				<br />♥ {Math.max(0, hp - h.dmg)}/{hp} · {pl.hand.length} cards · {engaged(g, p).length} minions · {allies(g, p).length} allies
			</span>
		</button>
	)
}

function EnemyStrip({ g, area }: { g: Game; area: number }) {
	const ar = g.areas[area]
	if (!ar) return null
	const v = g.insts[ar.villain]
	const m = g.insts[ar.main]
	return (
		<div className="enemy-strip">
			<b>{area === 0 ? 'Registration' : 'Resistance'}</b>
			{ar.players.map((p) => {
				const pl = g.players[p]
				const h = g.insts[pl.ident]
				const hp = stat(g, pl.ident, 'hp')
				return (
					<span key={p} className="es-item">
						<CardImg code={h.code} className="es-img" /> {pl.name} ({formCard(g, p).n}) ♥ {Math.max(0, hp - h.dmg)}/{hp} · ✋ {pl.hand.length}
					</span>
				)
			})}
			{v && (
				<span className="es-item">
					vs <CardImg code={v.code} className="es-img" /> {nameOf(g, v.uid)} {card(v.code).stage} ♥ {Math.max(0, stat(g, v.uid, 'hp') - v.dmg)}
				</span>
			)}
			{m && (
				<span className="es-item">
					⚠ {m.thr}/{threshold(g, area)} on {nameOf(g, m.uid)}
				</span>
			)}
			<span className="es-item">
				{minions(g, area).length} minions · {sides(g, area).length} side schemes
			</span>
		</div>
	)
}

function StatusPanel({ g, area, floating }: { g: Game; area: number; floating?: boolean }) {
	const ar = g.areas[area]
	const v = g.insts[ar.villain]
	const m = g.insts[ar.main]
	if (floating) return null
	return (
		<div className="status-panel">
			<div>
				Round {g.round} · {g.phase === 'player' ? `${g.players[g.active].name}'s turn` : g.phase}
			</div>
			{v && (
				<div>
					{nameOf(g, v.uid)} ({card(v.code).stage}) ♥ {Math.max(0, stat(g, v.uid, 'hp') - v.dmg)}/{stat(g, v.uid, 'hp')}
				</div>
			)}
			{m && (
				<div>
					Main scheme ⚠ {m.thr}/{threshold(g, area)}
				</div>
			)}
		</div>
	)
}

function LogPanel({ g, floating, onClose }: { g: Game; floating?: boolean; onClose?: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		ref.current?.scrollTo(0, 1e9)
	}, [g.log.length])
	return (
		<div className={`log ${floating ? 'floating' : ''}`}>
			{onClose && (
				<button className="close" onClick={onClose}>
					×
				</button>
			)}
			<div className="log-lines" ref={ref}>
				{g.log.slice(-120).map((l, k) => (
					<div key={k} className={l.t.startsWith('—') ? 'turn' : ''}>
						{l.t}
					</div>
				))}
			</div>
		</div>
	)
}

function PromptBox({ g, p, me, marked, send, onHide }: { g: Game; p: Prompt; me: number; marked: number[]; send: Dispatch; onHide: () => void }) {
	const nm = (u: number) => (g.insts[u] ? nameOf(g, u) : '?')
	const body = (() => {
		switch (p.kind) {
			case 'mulligan':
				return (
					<>
						<p>Tap any cards in your hand you want to put back, then draw back up to {handSize(g, me)}.</p>
						<button className="primary" onClick={() => send({ t: 'mulligan', player: me, cards: marked })}>
							{marked.length ? `Mulligan ${marked.length}` : 'Keep this hand'}
						</button>
					</>
				)
			case 'target':
				return (
					<>
						<p>Tap a glowing card, or pick:</p>
						<div className="opts">
							{p.options.map((u) => (
								<button key={u} onClick={() => send({ t: 'answer', player: me, value: u })}>
									{nm(u)}
								</button>
							))}
							<button className="link" onClick={() => send({ t: 'answer', player: me, value: null })}>
								Skip
							</button>
						</div>
					</>
				)
			case 'defend':
				return (
					<div className="opts">
						{p.options.map((u) => (
							<button key={u} className="primary" onClick={() => send({ t: 'answer', player: me, value: u })}>
								{g.insts[u].zone === 'identity' ? `Defend with ${nm(u)} (DEF ${stat(g, u, 'def')})` : `${nm(u)} defends (takes the hit)`}
							</button>
						))}
						<button onClick={() => send({ t: 'answer', player: me, value: null })}>Don't defend</button>
					</div>
				)
			case 'choose':
				return (
					<div className="opts col">
						{p.options.map((o, k) => (
							<button key={k} onClick={() => send({ t: 'answer', player: me, value: k })}>
								{o}
							</button>
						))}
					</div>
				)
			case 'window':
				return (
					<div className="opts col">
						{p.options.map((o, k) => (
							<button key={k} className="primary" onClick={() => send({ t: 'answer', player: me, value: k })}>
								{o.label}
							</button>
						))}
						<button onClick={() => send({ t: 'answer', player: me, value: null })}>No</button>
					</div>
				)
			case 'manual':
				return (
					<>
						<div className="manual-lines">
							{p.lines.map((l, k) => (
								<div key={k}>• {l}</div>
							))}
						</div>
						<p className="sub">Tap any card on the table to change its damage, threat, status or zone. Then tap Done.</p>
						<div className="opts">
							<button className="primary" onClick={() => send({ t: 'answer', player: me, value: 1 })}>
								Done
							</button>
							<button onClick={onHide}>Hide to use the table</button>
						</div>
					</>
				)
			case 'searchPick':
				return (
					<div className="pick-cards">
						{p.options.map((u) => (
							<button key={u} onClick={() => send({ t: 'answer', player: me, value: u })}>
								<CardImg code={g.insts[u].code} />
							</button>
						))}
					</div>
				)
			case 'allyLimit':
				return <p>Tap one of your allies to discard it.</p>
			case 'discardDown':
				return null
		}
	})()
	const rule = ruleForPrompt(p.kind, p.text)
	return (
		<div className={`tray prompt k-${p.kind}`}>
			<div className="tray-head">
				{p.card !== undefined && g.insts[p.card] && <CardImg code={g.insts[p.card].code} className="tray-card" />}
				<b>{p.text}</b>
				{p.kind !== 'manual' && (
					<button className="link hide" onClick={onHide}>
						hide
					</button>
				)}
			</div>
			{body}
			{rule && <RuleNote r={rule} />}
		</div>
	)
}

function RuleNote({ r }: { r: Rule }) {
	return (
		<details className="rule-note">
			<summary>{r.title}</summary>
			<p>{r.text}</p>
		</details>
	)
}

function Viewer({
	g,
	uid,
	me,
	canControl,
	onClose,
	act,
	play,
	startAim,
}: {
	g: Game
	uid: number
	me: number
	canControl: boolean
	onClose: () => void
	act: (it: Intent) => void
	play: (it: Intent) => void
	startAim: (a: Aim) => void
}) {
	const x = g.insts[uid]
	const c = card(x.code)
	const pl = g.players[me]
	const [tools, setTools] = useState(false)
	const inHand = pl.hand.includes(uid)
	const why = inHand ? playProblem(g, me, uid) : null
	const acts = useMemo(() => (canControl ? actionsFor(g, me, uid) : []), [g, me, uid, canControl])
	const pr = parse(c)
	const needsTarget = inHand && (pr.attach || pr.abilities[0]?.steps.some((s) => 'to' in s || 'from' in s))
	const backCode = c.back
	const [flip, setFlip] = useState(false)
	const shown = flip && backCode ? backCode : x.code
	const payInfo = inHand ? autoPay(g, me, c.cost ?? 0, [uid]) : null
	return (
		<div className="viewer">
			<button className="close" onClick={onClose}>
				×
			</button>
			<div className={`viewer-img ${isLandscape(shown) ? 'land' : ''}`}>
				<CardImg code={shown} />
			</div>
			<div className="viewer-body">
				<h3>{cardTitle(shown)}</h3>
				<small>
					{card(shown).t.replace(/_/g, ' ')}
					{card(shown).tr ? ` · ${card(shown).tr}` : ''}
				</small>
				<RulesText text={card(shown).x} />
				{rulesForText(card(shown).x, card(shown).t).map((r) => (
					<RuleNote key={r.title} r={r} />
				))}
				{backCode && (
					<button className="link" onClick={() => setFlip(!flip)}>
						{flip ? 'Show the front' : 'Show the other side'}
					</button>
				)}
				{inHand && canControl && (
					<div className="acts">
						<button className="primary" disabled={!!why} onClick={() => play({ t: 'play', player: me, uid, pay: [] })}>
							Play {c.cost ? `(cost ${c.cost})` : ''}
						</button>
						{why && <small className="why">{why}</small>}
						{!why && payInfo && payInfo.length > 0 && <small>Pays with: {payInfo.map((u) => nameOf(g, u)).join(', ')}</small>}
						{needsTarget && !why && <small>Tip: drag it onto the card you want it to hit.</small>}
					</div>
				)}
				{acts.length > 0 && (
					<div className="acts">
						{acts.map((a, k) => (
							<button key={k} disabled={!!a.why} title={a.why} onClick={() => act(a.intent)}>
								{a.label}
								{a.why ? <small> — {a.why}</small> : null}
							</button>
						))}
					</div>
				)}
				{canControl && (
					<details open={tools} onToggle={(e) => setTools((e.target as HTMLDetailsElement).open)}>
						<summary>Table tools (fix by hand)</summary>
						<div className="tools">
							{(
								[
									['dmg+', '+1 damage'],
									['dmg-', '−1 damage'],
									['thr+', '+1 threat'],
									['thr-', '−1 threat'],
									['ctr+', '+1 counter'],
									['ctr-', '−1 counter'],
									[x.ex ? 'ready' : 'exhaust', x.ex ? 'Ready' : 'Exhaust'],
									['stun', x.stun ? 'Remove stun' : 'Stun'],
									['conf', x.conf ? 'Remove confused' : 'Confuse'],
									['tough', x.tough ? 'Remove tough' : 'Tough'],
									...(x.zone === 'engaged' ? [['defeat', 'Defeat']] : []),
									...(x.zone !== 'identity' && x.zone !== 'villain' && x.zone !== 'main' ? [['discard', 'Discard']] : []),
									...(x.owner >= 0 && x.zone !== 'hand' && x.zone !== 'identity' ? [['hand', 'To hand']] : []),
								] as [string, string][]
							).map(([op, l]) => (
								<button key={op} onClick={() => play({ t: 'tool', player: me, uid, op: op as never })}>
									{l}
								</button>
							))}
							<button onClick={() => play({ t: 'draw', player: me })}>Draw a card</button>
						</div>
					</details>
				)}
				{void startAim}
			</div>
		</div>
	)
}

function Reference({ onClose, tips, setTips }: { onClose: () => void; tips: boolean; setTips: (v: boolean) => void }) {
	const [q, setQ] = useState('')
	const order = ['round', 'turn', 'pay', 'forms', 'handsize', 'villainPhase', 'activation', 'defend', 'boost', 'encounter', 'threat', 'stage']
	const rest = Object.keys(RULES).filter((k) => !order.includes(k))
	const list = [...order, ...rest].map((k) => RULES[k]).filter((r) => !q || (r.title + ' ' + r.text).toLowerCase().includes(q.toLowerCase()))
	return (
		<div className="reference">
			<button className="close" onClick={onClose}>
				×
			</button>
			<h3>How to play</h3>
			<div className="row">
				<input placeholder="Search the rules" value={q} onChange={(e) => setQ(e.target.value)} />
				<label className="nowrap">
					<input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} /> Tips during play
				</label>
			</div>
			{list.map((r) => (
				<div key={r.title} className="ref-rule">
					<b>{r.title}</b>
					<p>{r.text}</p>
				</div>
			))}
			<p className="sub">Rules explained in our own words, following the official Marvel Champions Rules Reference.</p>
		</div>
	)
}

export const _unused = { inZone }
