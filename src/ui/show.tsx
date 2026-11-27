// The show: a comic-cover intro for each game, big phase banners, floating damage/threat numbers,
// the villain lunging at you, hero flips, stage changes and a proper victory / defeat splash.
// Pure presentation: everything here reads the game state, nothing changes it.
import type * as React from 'react'
import { useEffect, useState } from 'react'
import { card } from '../data/data'
import type { Game } from '../engine/engine'
import { CardImg } from './Card'

// ───────── intro: the villain's splash page ─────────

export function Intro({ g, me, onDone }: { g: Game; me: number; onDone: () => void }) {
	const ar = g.areas[g.players[me]?.area ?? 0]
	const v = g.insts[ar.villain]
	const main = g.insts[ar.main]
	const heroes = ar.players.map((p) => g.players[p])
	useEffect(() => {
		const t = setTimeout(onDone, 4200)
		return () => clearTimeout(t)
	}, [onDone])
	if (!v) return null
	const vc = card(v.code)
	return (
		<div className="intro" onClick={onDone} role="dialog" aria-label="Game start">
			<div className="intro-rays" />
			<div className="intro-villain">
				<CardImg code={v.code} />
			</div>
			<div className="intro-title">
				<small>{g.mode === 'pvp' ? 'CIVIL WAR' : 'THIS ISSUE'}</small>
				<b>{vc.n.toUpperCase()}</b>
				{main && <em>{card(main.code).n}</em>}
			</div>
			<div className="intro-vs">VS</div>
			<div className="intro-heroes">
				{heroes.map((p) => (
					<div key={p.id} className="intro-hero">
						<CardImg code={p.hero} />
						<b>{card(p.hero).n}</b>
					</div>
				))}
			</div>
			<div className="intro-tap">tap to start</div>
		</div>
	)
}

// ───────── banners ─────────

/** Which banner style a line like "Rhino attacks!" or "Villain phase" gets. */
function bannerKind(text: string): string {
	if (/victory/i.test(text)) return 'win'
	if (/defeat/i.test(text)) return 'lose'
	if (/attacks!$/i.test(text)) return 'attack'
	if (/schemes!$/i.test(text)) return 'scheme'
	if (/^villain phase/i.test(text)) return 'villain'
	if (/'s turn$/i.test(text)) return 'turn'
	if (/\b(I|II|III|IV)\b|stage/i.test(text)) return 'stage'
	return 'plain'
}

export function BigBanner({ text }: { text: string }) {
	const [on, setOn] = useState(true)
	useEffect(() => {
		const t = setTimeout(() => setOn(false), 1500)
		return () => clearTimeout(t)
	}, [])
	if (!on) return null
	const kind = bannerKind(text)
	const [head, ...rest] = text.split(': ')
	return (
		<div className={`bigbanner bb-${kind}`} aria-live="polite">
			<div className="bb-lines" />
			<div className="bb-box">
				<b>{head}</b>
				{rest.length > 0 && <small>{rest.join(': ')}</small>}
			</div>
		</div>
	)
}

// ───────── floating numbers ─────────

export interface Floater {
	key: string
	x: number
	y: number
	text: string
	kind: 'dmg' | 'heal' | 'thr' | 'thw' | 'ko' | 'word'
	big?: boolean
}

export function Floaters({ items }: { items: Floater[] }) {
	if (!items.length) return null
	return (
		<div className="floaters" aria-hidden>
			{items.map((f, i) => (
				<b key={f.key} className={`floater fl-${f.kind} ${f.big ? 'big' : ''}`} style={{ left: f.x, top: f.y, ['--d' as string]: `${(i % 3) * 40}ms` } as React.CSSProperties}>
					{f.text}
				</b>
			))}
		</div>
	)
}

// ───────── game over ─────────

export function GameOver({ g, me, onMenu }: { g: Game; me: number; onMenu: () => void }) {
	const ar = g.areas[g.players[me]?.area ?? 0]
	const won = g.mode === 'coop' ? g.winner === 'heroes' : ar.result === 'win'
	const vCode = ar.villainSeq?.[ar.villainSeq.length - 1] ?? g.insts[ar.villain]?.code
	const hero = g.players[me]?.hero
	return (
		<div className={`gameover ${won ? 'won' : 'lost'}`} role="dialog" aria-label={won ? 'Victory' : 'Defeat'}>
			{won && (
				<div className="confetti">
					{Array.from({ length: 40 }, (_, i) => (
						<i key={i} style={{ left: `${(i * 37) % 100}%`, ['--d' as string]: `${(i % 10) * 90}ms`, ['--c' as string]: ['#e23636', '#ffd23f', '#1f4fd8', '#22b45a', '#ff4fa3'][i % 5] } as React.CSSProperties} />
					))}
				</div>
			)}
			<div className="go-card">
				<div className="go-art">
					{won ? hero && <CardImg code={hero} /> : vCode && <CardImg code={vCode} />}
				</div>
				<h2 className="go-word">{won ? 'VICTORY!' : 'DEFEAT'}</h2>
				<p>
					{g.mode === 'coop'
						? won
							? `${vCode ? card(vCode).n : 'The villain'} is beaten in round ${g.round}. The city is safe — for now.`
							: `${vCode ? card(vCode).n : 'The villain'} got away with it this time.`
						: `${g.winner} take the day in round ${g.round}.`}
				</p>
				<button className="primary" onClick={onMenu}>
					Back to the menu
				</button>
			</div>
		</div>
	)
}

// ───────── one-off motions on table elements (Web Animations) ─────────

/** The attacker lunges at the target, and the screen edges flash red. */
export function lunge(from: HTMLElement | null, to: HTMLElement | null) {
	if (!from) return
	const a = from.getBoundingClientRect()
	const b = to?.getBoundingClientRect()
	const dx = b ? (b.left + b.width / 2 - (a.left + a.width / 2)) * 0.35 : 0
	const dy = b ? (b.top + b.height / 2 - (a.top + a.height / 2)) * 0.35 : 60
	from.animate(
		[
			{ transform: 'translate(0,0) scale(1)' },
			{ transform: `translate(${-dx * 0.15}px, ${-dy * 0.15}px) scale(1.05) rotate(-3deg)`, offset: 0.3 },
			{ transform: `translate(${dx}px, ${dy}px) scale(1.2) rotate(4deg)`, offset: 0.55 },
			{ transform: 'translate(0,0) scale(1)' },
		],
		{ duration: 650, easing: 'cubic-bezier(.3,.7,.3,1)' },
	)
	flashScreen('red')
}

export function flashScreen(kind: 'red' | 'white' | 'gold') {
	const d = document.createElement('div')
	d.className = `screen-flash sf-${kind}`
	document.body.appendChild(d)
	setTimeout(() => d.remove(), 700)
}

/** A 3D flip for the identity card when a hero changes form. */
export function flipCard(el: HTMLElement | null) {
	el?.animate(
		[
			{ transform: 'perspective(700px) rotateY(0deg) scale(1)' },
			{ transform: 'perspective(700px) rotateY(90deg) scale(1.15)', offset: 0.45 },
			{ transform: 'perspective(700px) rotateY(0deg) scale(1.08)', offset: 0.8 },
			{ transform: 'perspective(700px) rotateY(0deg) scale(1)' },
		],
		{ duration: 620, easing: 'ease-in-out' },
	)
}

/** Shake one element (a villain taking a big hit, a new stage). */
export function jolt(el: HTMLElement | null, strength = 8) {
	el?.animate(
		[0, 1, 2, 3, 4, 5].map((k) => ({ transform: k === 5 ? 'translate(0,0)' : `translate(${(k % 2 ? -1 : 1) * strength * (1 - k / 5)}px, ${(k % 3) - 1}px)` })),
		{ duration: 360 },
	)
}
