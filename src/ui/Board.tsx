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
}) {
	const [sel, setSel] = useState<number | null>(null)
	const [aim, setAim] = useState<Aim | null>(null)
	const [err, setErr] = useState<string | null>(null)
	const [showLog, setShowLog] = useState(false)
	const [showRef, setShowRef] = useState(false)
	const [ending, setEnding] = useState(false)
	const [marked, setMarked] = useState<number[]>([])
	const [hidePrompt, setHidePrompt] = useState(false)
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

	const tile = (x: Inst, opts: { size?: 'v' | 'm' | 's' | 'land' | 'land-s'; mine?: boolean; showHp?: boolean } = {}) => (
		<Tile key={x.uid} g={g} x={x} size={opts.size ?? 'm'} glow={glow.has(x.uid)} selected={sel === x.uid} marked={marked.includes(x.uid)} {...dragProps(x.uid, !!opts.mine)} />
	)

	const villain = g.insts[ar.villain]
	const main = g.insts[ar.main]
	const enc = ar.encDeck.length
	const encTop = ar.encDiscard[ar.encDiscard.length - 1]
	const others = ar.players.filter((p) => p !== me)
	const boostCards = Object.values(g.insts).filter((x) => x.zone === 'boost' && x.area === area && x.host !== undefined)

	const playable = (u: number) => myTurn && !playProblem(g, me, u)

	const table = (
		<div className={`felt ${layout}`}>
			{g.mode === 'pvp' && <EnemyStrip g={g} area={1 - area} />}
			<div className="band villain-band">
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
				<div className="scheme-slot">
					{main && tile(main, { size: 'land' })}
					<div className="side-row">{sides(g, area).map((s) => tile(s, { size: 'land-s' }))}</div>
				</div>
				<div className="env-slot">
					{inZone(g, area, 'env').map((x) => tile(x, { size: 's' }))}
					<div className="piles">
						<Pile label="Encounter" n={enc} back />
						<Pile label="Discard" n={ar.encDiscard.length} code={encTop !== undefined ? g.insts[encTop]?.code : undefined} />
					</div>
				</div>
			</div>
			<div className="band minion-band">
				<div className="band-label">Engaged with {pl.name}</div>
				<div className="minion-row">
					{engaged(g, me).map((m) => (
						<div className="with-attach" key={m.uid}>
							{tile(m, { size: 'm' })}
							{attachments(g, m.uid).map((a) => tile(a, { size: 's' }))}
						</div>
					))}
					{Object.values(g.insts)
						.filter((x) => x.zone === 'dealt' && x.ctrl === me)
						.map((x) => (
							<div key={x.uid} className="facedown" title="Encounter card dealt to you">
								?
							</div>
						))}
					{!engaged(g, me).length && <div className="empty">No minions</div>}
				</div>
				{others.length > 0 && (
					<div className="others">
						{others.map((p) => (
							<OtherHero key={p} g={g} p={p} onView={() => setViewer(p)} active={g.active === p} />
						))}
					</div>
				)}
			</div>
			<div className="band mat-band">
				<div className="ident-slot">
					{tile(g.insts[pl.ident], { size: 'v', mine: true })}
					<div className="ident-info">
						<b>{formCard(g, me).n}</b>
						<span>{pl.form === 'hero' ? 'Hero form' : 'Alter-ego form'}</span>
						{pl.pool && <span className="pool">Resources ready: {pl.pool.length}</span>}
					</div>
				</div>
				<div className="play-row">
					{playArea(g, me).map((x) => (
						<div className="with-attach" key={x.uid}>
							{tile(x, { size: 'm', mine: true })}
							{attachments(g, x.uid).map((a) => tile(a, { size: 's' }))}
						</div>
					))}
					{Object.values(g.insts)
						.filter((x) => x.zone === 'play' && x.ctrl === me && x.host !== undefined && g.insts[x.host] && g.insts[x.host].zone !== 'play')
						.map((x) => (
							<div className="attached-note" key={x.uid}>
								{tile(x, { size: 's', mine: true })}
								<small>on {nameOf(g, x.host!)}</small>
							</div>
						))}
					{!playArea(g, me).length && <div className="empty">Drag cards from your hand here</div>}
				</div>
				<div className="piles mine">
					<Pile label="Deck" n={pl.deck.length} back />
					<Pile label="Discard" n={pl.discard.length} code={pl.discard.length ? g.insts[pl.discard[pl.discard.length - 1]].code : undefined} />
				</div>
			</div>
			<div className="hand" data-anchor="hand">
				{pl.hand.map((u, k) => {
					const n = pl.hand.length
					const mid = (n - 1) / 2
					const rot = (k - mid) * Math.min(5, 26 / Math.max(1, n))
					const lift = Math.abs(k - mid) * Math.abs(k - mid) * 1.6
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
		</div>
	)

	const statusBar = (
		<div className="topbar">
			<button onClick={onMenu}>☰{pocket ? '' : ' Menu'}</button>
			{onUndo && <button onClick={onUndo}>↶{pocket ? '' : ' Undo'}</button>}
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
				{showRef && <Reference onClose={() => setShowRef(false)} />}
				{err && <div className="toast">{err}</div>}
				{g.banner && <Banner key={g.log.length} text={g.banner} />}
				{over}
			</div>
		)
	return (
		<div className={`board ${pocket ? 'pocket' : ''} ${tall ? 'tall' : ''}`}>
			{statusBar}
			{table}
			<div className="float-trays">
				{prompt}
				{waiting}
				{aimBox}
				{actionBar}
			</div>
			{myPrompt && hidePrompt && (
				<button className="show-prompt" onClick={() => setHidePrompt(false)}>
					Show the question
				</button>
			)}
			{viewerBox}
			<StatusPanel g={g} area={area} floating />
			{showLog && <LogPanel g={g} floating onClose={() => setShowLog(false)} />}
			{showRef && <Reference onClose={() => setShowRef(false)} />}
			{err && <div className="toast">{err}</div>}
			{g.banner && <Banner key={g.log.length} text={g.banner} />}
			{g.spotlight !== undefined && g.insts[g.spotlight] && <Spotlight code={g.insts[g.spotlight].code} />}
			{over}
		</div>
	)
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

function Tile({ g, x, size, glow, selected, marked, ...rest }: { g: Game; x: Inst; size: string; glow: boolean; selected: boolean; marked: boolean } & React.HTMLAttributes<HTMLDivElement>) {
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
			{...rest}
		>
			<CardImg code={x.code} />
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

function Pile({ label, n, back, code }: { label: string; n: number; back?: boolean; code?: string }) {
	return (
		<div className="pile">
			{back || !code ? <div className={`pile-back ${n ? '' : 'none'}`}>{n}</div> : <CardImg code={code} />}
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
		</div>
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

function Reference({ onClose }: { onClose: () => void }) {
	return (
		<div className="reference">
			<button className="close" onClick={onClose}>
				×
			</button>
			<h3>Round</h3>
			<ol>
				<li>
					<b>Player phase</b> — each player takes a turn: play cards (pay by discarding cards from hand for their resources), use your hero's basic powers (Attack, Thwart, or
					Defend later) or your alter-ego's Recover, use allies and card abilities, and change form once.
				</li>
				<li>Then everyone may discard cards, draws back up to their hand size, and readies everything.</li>
				<li>
					<b>Villain phase</b> — threat goes on the main scheme (acceleration adds more). The villain then activates against each player: it attacks heroes and schemes against alter
					egos, with a facedown boost card. Each player's minions do the same.
				</li>
				<li>Each player is dealt an encounter card (+1 per hazard icon) and reveals it. The first-player token moves on.</li>
			</ol>
			<h3>Words on cards</h3>
			<dl>
				<dt>Guard</dt>
				<dd>While it's engaged with you, you can't attack the villain.</dd>
				<dt>Patrol</dt>
				<dd>While it's engaged with you, you can't thwart the main scheme.</dd>
				<dt>Crisis</dt>
				<dd>While that side scheme is in play, no one can remove threat from the main scheme.</dd>
				<dt>Toughness / tough</dt>
				<dd>A tough status card stops the next damage, then is removed.</dd>
				<dt>Stunned / confused</dt>
				<dd>The next attack (stunned) or thwart/scheme (confused) doesn't happen — the status is removed instead.</dd>
				<dt>Quickstrike</dt>
				<dd>Attacks as soon as it engages your hero.</dd>
				<dt>Surge</dt>
				<dd>Reveal one more encounter card afterwards.</dd>
				<dt>Retaliate X</dt>
				<dd>Whoever attacks it takes X damage.</dd>
				<dt>Piercing / Overkill / Ranged</dt>
				<dd>Piercing removes tough first; overkill passes excess damage from a defending ally to its hero; ranged ignores retaliate.</dd>
				<dt>Steady / Stalwart</dt>
				<dd>Steady can hold two stuns or confusions; stalwart can't be stunned or confused.</dd>
				<dt>Villainous</dt>
				<dd>This minion also gets a boost card when it activates.</dd>
				<dt>Incite X / Hinder X</dt>
				<dd>When revealed, X threat goes on the main scheme (incite) or on this scheme (hinder).</dd>
				<dt>Consequential damage</dt>
				<dd>The number under an ally's ATK/THW is the damage it takes for using it.</dd>
			</dl>
			<p className="sub">
				Cards the game can't read yet ask you to do that part with the table tools (tap a card → Table tools). Competitive mode: in each round the Registration team plays, then the
				Resistance team, then both villain phases.
			</p>
		</div>
	)
}

export const _unused = { inZone }
