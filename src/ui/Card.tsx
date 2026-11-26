import { useState } from 'react'
import { card, imageUrls, maybeCard, type CardData } from '../data/data'

const ok = new Map<string, string>() // code → picture that loaded
const bad = new Set<string>() // pictures that failed

export const LANDSCAPE = new Set(['main_scheme', 'side_scheme', 'player_side_scheme'])
export const isLandscape = (code: string) => LANDSCAPE.has(maybeCard(code)?.t ?? '')

/** A card picture from MarvelCDB; if no picture loads, a readable text card instead. */
export function CardImg({ code, className = '', alt }: { code: string; className?: string; alt?: string }) {
	const c = maybeCard(code)
	const urls = c ? imageUrls(c).filter((u) => !bad.has(u)) : []
	const [k, setK] = useState(0)
	const known = ok.get(code)
	const src = known ?? urls[k]
	if (!c) return <div className={`textcard ${className}`}>?</div>
	if (!src) return <TextCard c={c} className={className} />
	return (
		<img
			className={`cimg ${className}`}
			src={src}
			alt={alt ?? c.n}
			draggable={false}
			loading="lazy"
			onLoad={() => ok.set(code, src)}
			onError={() => {
				bad.add(src)
				ok.delete(code)
				setK((x) => x + 1)
			}}
		/>
	)
}

const ASPECT_CLASS: Record<string, string> = {
	aggression: 'f-agg',
	justice: 'f-jus',
	leadership: 'f-lea',
	protection: 'f-pro',
	basic: 'f-bas',
	hero: 'f-hero',
	encounter: 'f-enc',
	pool: 'f-pool',
	campaign: 'f-enc',
}

export function TextCard({ c, className = '' }: { c: CardData; className?: string }) {
	const stats: string[] = []
	if (c.cost !== undefined) stats.push(`Cost ${c.cost}`)
	if (c.thw !== undefined) stats.push(`THW ${c.thw}`)
	if (c.atk !== undefined) stats.push(`ATK ${c.atk}`)
	if (c.def !== undefined) stats.push(`DEF ${c.def}`)
	if (c.rec !== undefined) stats.push(`REC ${c.rec}`)
	if (c.sch !== undefined) stats.push(`SCH ${c.sch}`)
	if (c.hp !== undefined) stats.push(`HP ${c.hp}`)
	if (c.thr !== undefined) stats.push(`Threat ${c.thr}`)
	return (
		<div className={`textcard ${ASPECT_CLASS[c.f] ?? ''} ${LANDSCAPE.has(c.t) ? 'land' : ''} ${className}`}>
			<div className="tc-name">
				{c.u ? '◆ ' : ''}
				{c.n}
			</div>
			<div className="tc-type">
				{c.t.replace(/_/g, ' ')}
				{c.stage ? ` · ${c.stage}` : ''}
			</div>
			{stats.length > 0 && <div className="tc-stats">{stats.join(' · ')}</div>}
			<div className="tc-text">
				<RulesText text={c.x} />
			</div>
			{c.res && <div className="tc-res">{c.res.split('').map((r, i) => <Res key={i} r={r} />)}</div>}
		</div>
	)
}

export function Res({ r }: { r: string }) {
	return <span className={`res res-${r}`}>{{ m: '🧠', e: '⚡', p: '✊', w: '✱' }[r] ?? r}</span>
}

const ICONS: Record<string, string> = {
	mental: '<span class="res res-m">🧠</span>',
	energy: '<span class="res res-e">⚡</span>',
	physical: '<span class="res res-p">✊</span>',
	wild: '<span class="res res-w">✱</span>',
	per_hero: '<span class="ic-per">👤</span>',
	star: '★',
	boost: '<span class="ic-boost">✹</span>',
	crisis: '<span class="ic-crisis">⚠</span>',
	acceleration: '<span class="ic-acc">»</span>',
	hazard: '<span class="ic-haz">☢</span>',
	amplify: '<span class="ic-amp">⧉</span>',
	cost: '◎',
	unique: '◆',
}

export function RulesText({ text }: { text?: string }) {
	if (!text) return null
	const html = text
		.replace(/&/g, '&amp;')
		.replace(/<(\/?)(b|i|em|strong|u)>/g, '\u0001$1$2\u0002')
		.replace(/<hr\s*\/?>/g, '\u0003')
		.replace(/<[^>]*>/g, '')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\u0001(\/?)(\w+)\u0002/g, '<$1$2>')
		.replace(/\u0003/g, '<hr/>')
		.replace(/\[\[([^\]]+)\]\]/g, '<em class="trait">$1</em>')
		.replace(/\[(\w+)\]/g, (m, k) => ICONS[k] ?? m)
		.replace(/\n/g, '<br/>')
	return <div className="rules" dangerouslySetInnerHTML={{ __html: html }} />
}

export const cardTitle = (code: string) => {
	const c = card(code)
	return c.s ? `${c.n} — ${c.s}` : c.n
}
