// Character effects: how a card lands on the table and how a hero's hits look, matched to the hero.
// Hulk smashes the ground, Cyclops fires a red optic blast, Spider-Man casts webs, fliers swoop in,
// Doctor Strange draws a sigil, Wolverine slashes, Nightcrawler BAMFs… Everything is SVG/CSS, drawn
// in one fixed layer above the table and gone after about a second.
import type * as React from 'react'

export type FxKind = 'slam' | 'web' | 'beam' | 'lightning' | 'sigil' | 'claws' | 'shield' | 'smoke' | 'frost' | 'fire' | 'sparks' | 'speed' | 'arrows' | 'rings' | 'symbiote'
/** How the card itself arrives: drop (default), swoop in from your deck, grow, shrink in from tiny, phase in, pop in after smoke. */
export type Arrive = 'drop' | 'swoop' | 'grow' | 'shrink' | 'phase' | 'pop'

export interface HeroFx {
	land: FxKind
	hit: FxKind
	arrive: Arrive
	color: string
	color2?: string
	word: string
}

const H = (land: FxKind, hit: FxKind, arrive: Arrive, color: string, word: string, color2?: string): HeroFx => ({ land, hit, arrive, color, color2, word })

/** By hero set code (MarvelCDB). Powers after the comics: beams, webs, flight, magic, claws… */
export const HERO_FX: Record<string, HeroFx> = {
	// webs
	spider_man: H('web', 'web', 'drop', '#ffffff', 'THWIP!', '#e23636'),
	spider_man_morales: H('web', 'lightning', 'phase', '#ffffff', 'THWIP!', '#5ad1ff'),
	ghost_spider: H('web', 'web', 'drop', '#ffffff', 'THWIP!', '#ff7ac8'),
	spiderham: H('web', 'slam', 'drop', '#ffffff', 'OINK!', '#e23636'),
	spdr: H('web', 'beam', 'drop', '#ffffff', 'THWIP!', '#ff3b5c'),
	silk: H('web', 'web', 'drop', '#ffffff', 'THWIP!', '#ffffff'),
	spider_woman: H('web', 'beam', 'swoop', '#ffffff', 'ZZAP!', '#ff4fa3'),
	vnm: H('symbiote', 'symbiote', 'drop', '#111111', 'SKREEE!', '#ffffff'),
	// smashers
	hulk: H('slam', 'slam', 'drop', '#3cbf4a', 'SMASH!'),
	she_hulk: H('slam', 'slam', 'drop', '#3cbf4a', 'WHAM!'),
	hulkling: H('slam', 'slam', 'swoop', '#3cbf4a', 'KRAK!'),
	colossus: H('slam', 'slam', 'drop', '#c0c8d4', 'KLANG!'),
	groot: H('slam', 'slam', 'grow', '#8a5a2b', 'KRAK!'),
	drax: H('slam', 'claws', 'drop', '#3a7d9c', 'THOOM!'),
	hercules: H('slam', 'slam', 'drop', '#ffd23f', 'THOOM!'),
	luke_cage: H('slam', 'slam', 'drop', '#ffd23f', 'SWEET!'),
	jessica_jones: H('slam', 'slam', 'drop', '#6b4bb8', 'WHUMP!'),
	wonder_man: H('beam', 'slam', 'swoop', '#ff3b5c', 'WHOOM!'),
	// beams
	cyclops: H('beam', 'beam', 'drop', '#ff2020', 'ZZRAK!'),
	iron_man: H('beam', 'beam', 'swoop', '#7fe7ff', 'PEW!'),
	war_machine: H('beam', 'beam', 'swoop', '#ffb02e', 'BRRAKA!'),
	ironheart: H('beam', 'beam', 'swoop', '#4ff2ff', 'WHOOM!'),
	captain_marvel: H('beam', 'beam', 'swoop', '#ffd23f', 'FWOOM!', '#e23636'),
	spectrum: H('beam', 'beam', 'phase', '#ffffff', 'FLASH!', '#ffd23f'),
	nova: H('beam', 'beam', 'swoop', '#4f8bff', 'FWOOSH!', '#ffd23f'),
	vision: H('beam', 'beam', 'phase', '#ffd23f', 'ZRAAK!', '#3cbf4a'),
	bishop: H('beam', 'beam', 'drop', '#ff3b5c', 'BLAM!'),
	cable: H('beam', 'beam', 'drop', '#5ad1ff', 'BLAM!'),
	rocket: H('sparks', 'beam', 'drop', '#ff7a1a', 'BLAM!'),
	stld: H('beam', 'beam', 'swoop', '#ff3b5c', 'PEW PEW!'),
	// fliers and lightning
	thor: H('lightning', 'lightning', 'swoop', '#9fe3ff', 'KRA-KOOM!'),
	storm: H('lightning', 'lightning', 'swoop', '#d6f4ff', 'KRAKOW!'),
	falcon: H('speed', 'arrows', 'swoop', '#e23636', 'FWOOSH!'),
	angel: H('speed', 'arrows', 'swoop', '#7fa8ff', 'FWOOSH!'),
	valk: H('speed', 'claws', 'swoop', '#ffffff', 'SHRAK!'),
	warlock: H('sigil', 'beam', 'swoop', '#ffd23f', 'FWOOM!'),
	// magic
	doctor_strange: H('sigil', 'sigil', 'phase', '#ff9a1a', 'FWASH!'),
	scw: H('sigil', 'sigil', 'phase', '#ff2b6a', 'HEX!'),
	magik: H('sigil', 'claws', 'pop', '#ff9a1a', 'SHIMMM!', '#ffd23f'),
	phoenix: H('fire', 'fire', 'swoop', '#ff6a1a', 'FWOOM!', '#ffd23f'),
	psylocke: H('claws', 'claws', 'phase', '#ff4fd8', 'SHING!'),
	magneto: H('rings', 'rings', 'swoop', '#b85cff', 'KZZZT!'),
	jubilee: H('sparks', 'sparks', 'drop', '#ffd23f', 'PAF!', '#ff4fa3'),
	// claws and blades
	wolverine: H('claws', 'claws', 'drop', '#d8dde6', 'SNIKT!'),
	x23: H('claws', 'claws', 'drop', '#d8dde6', 'SNIKT!'),
	black_panther: H('claws', 'claws', 'drop', '#b85cff', 'SHRAK!'),
	black_panther_shuri: H('claws', 'claws', 'drop', '#b85cff', 'SHRAK!'),
	tigra: H('claws', 'claws', 'drop', '#ff9a1a', 'RAWR!'),
	gam: H('claws', 'claws', 'drop', '#3cbf4a', 'SHING!'),
	nebu: H('claws', 'claws', 'drop', '#6b8cff', 'SHING!'),
	elektra: H('claws', 'claws', 'phase', '#e23636', 'SHING!'),
	deadpool: H('claws', 'claws', 'pop', '#e23636', 'CHIMICHANGA!'),
	// the rest
	captain_america: H('shield', 'shield', 'drop', '#e23636', 'KLANG!', '#1f4fd8'),
	winter_soldier: H('speed', 'slam', 'drop', '#c0c8d4', 'KRAK!'),
	black_widow: H('speed', 'lightning', 'phase', '#5ad1ff', 'ZZZT!'),
	hawkeye: H('arrows', 'arrows', 'drop', '#b85cff', 'THOK!'),
	echo: H('rings', 'arrows', 'phase', '#e23636', 'THOK!'),
	daredevil: H('rings', 'slam', 'drop', '#e23636', 'THWAK!'),
	iron_fist: H('fire', 'slam', 'drop', '#ffd23f', 'HIYAH!', '#3cbf4a'),
	nick_fury: H('speed', 'beam', 'drop', '#c0c8d4', 'BLAM!'),
	maria_hill: H('speed', 'beam', 'drop', '#5ad1ff', 'BLAM!'),
	qsv: H('speed', 'speed', 'swoop', '#7fe7ff', 'ZOOM!'),
	ant: H('rings', 'slam', 'shrink', '#e23636', 'ZZZT!'),
	wsp: H('sparks', 'lightning', 'shrink', '#ffd23f', 'BZZT!'),
	ms_marvel: H('slam', 'slam', 'grow', '#ffd23f', 'EMBIGGEN!', '#1f4fd8'),
	shadowcat: H('rings', 'claws', 'phase', '#b85cff', 'FZZT!'),
	nightcrawler: H('smoke', 'claws', 'pop', '#6b3fb8', 'BAMF!'),
	iceman: H('frost', 'frost', 'swoop', '#bfeeff', 'SKREEK!'),
	gambit: H('sparks', 'sparks', 'drop', '#ff4fd8', 'KA-BOOM!'),
	rogue: H('slam', 'slam', 'swoop', '#3cbf4a', 'WHAM!'),
	domino: H('sparks', 'beam', 'drop', '#ffffff', 'BLAM!'),
}

/** Settings: effects on or off (localStorage 'champions.fx'). */
export const effectsOn = () => {
	try {
		return localStorage.getItem('champions.fx') !== 'off'
	} catch {
		return true
	}
}
export const setEffects = (on: boolean) => {
	try {
		localStorage.setItem('champions.fx', on ? 'on' : 'off')
	} catch {
		/* private mode */
	}
}

const DEFAULT_FX = H('slam', 'slam', 'drop', '#ffd23f', 'WHAM!')
const ENEMY_FX = H('slam', 'slam', 'drop', '#e23636', 'THOOM!')

/** The effect for a hero set (or a plain slam). Enemies land with a heavier red thud. */
export function heroFx(set: string | undefined, enemy = false): HeroFx {
	if (enemy) return ENEMY_FX
	return (set && HERO_FX[set]) || DEFAULT_FX
}

export interface Fx {
	key: string
	kind: FxKind
	/** centre of the target card on screen */
	x: number
	y: number
	w: number
	h: number
	color: string
	color2?: string
	/** where a beam starts (the attacker); otherwise from the top of the screen */
	fx?: number
	fy?: number
	word?: string
	big: boolean
	seed: number
}

/** A small seeded random so each effect has its own shape. */
function rng(seed: number) {
	let r = (seed * 9301 + 49297) % 233280
	return () => (r = (r * 9301 + 49297) % 233280) / 233280
}

/** Play a card's arrival on its own element (Web Animations): swoop from the deck, grow, shrink in… */
export function animateArrival(el: HTMLElement, arrive: Arrive, from: DOMRect | null) {
	const tilt = getComputedStyle(el).getPropertyValue('--tilt') || '0deg'
	const r = el.getBoundingClientRect()
	const end = `translate(0,0) scale(1) rotate(${tilt})`
	let frames: Keyframe[]
	let ms = 480
	switch (arrive) {
		case 'swoop': {
			const sx = from ? from.left + from.width / 2 - (r.left + r.width / 2) : -r.width * 3
			const sy = from ? from.top + from.height / 2 - (r.top + r.height / 2) : -window.innerHeight * 0.5
			// up and over: out of the deck, a high arc, then down onto the table
			frames = [
				{ transform: `translate(${sx}px, ${sy}px) scale(0.5) rotate(-25deg)`, opacity: 0.4, offset: 0 },
				{ transform: `translate(${sx * 0.45}px, ${Math.min(sy, 0) - r.height * 1.6}px) scale(1.25) rotate(14deg)`, opacity: 1, offset: 0.45 },
				{ transform: `translate(0, -18px) scale(1.08) rotate(-4deg)`, offset: 0.8 },
				{ transform: end, offset: 1 },
			]
			ms = 760
			break
		}
		case 'grow':
			frames = [
				{ transform: `scale(0.3) rotate(${tilt})`, opacity: 0.6 },
				{ transform: `scale(1.35) rotate(${tilt})`, opacity: 1, offset: 0.6 },
				{ transform: end },
			]
			ms = 620
			break
		case 'shrink':
			frames = [
				{ transform: `scale(0.02) rotate(200deg)`, opacity: 0 },
				{ transform: `scale(0.15) rotate(90deg)`, opacity: 1, offset: 0.35 },
				{ transform: `scale(1.1) rotate(${tilt})`, offset: 0.85 },
				{ transform: end },
			]
			ms = 700
			break
		case 'phase':
			frames = [
				{ opacity: 0, filter: 'blur(6px) brightness(2)', transform: `scale(1.08) rotate(${tilt})` },
				{ opacity: 0.6, filter: 'blur(2px) brightness(1.5)', offset: 0.4 },
				{ opacity: 0.2, offset: 0.55 },
				{ opacity: 1, filter: 'blur(0) brightness(1)', transform: end },
			]
			ms = 650
			break
		case 'pop':
			frames = [
				{ opacity: 0, transform: `scale(0.6) rotate(${tilt})`, offset: 0 },
				{ opacity: 0, transform: `scale(0.6) rotate(${tilt})`, offset: 0.35 },
				{ opacity: 1, transform: `scale(1.15) rotate(${tilt})`, offset: 0.7 },
				{ transform: end },
			]
			ms = 620
			break
		default:
			frames = [
				{ transform: `translateY(-40px) scale(1.45) rotate(-6deg)`, filter: 'drop-shadow(0 30px 18px rgba(0,0,0,.5))' },
				{ transform: `translateY(0) scale(0.96) rotate(${tilt})`, offset: 0.7 },
				{ transform: `scale(1.03) rotate(${tilt})`, offset: 0.85 },
				{ transform: end, filter: 'none' },
			]
			ms = 420
	}
	el.animate(frames, { duration: ms, easing: arrive === 'drop' ? 'cubic-bezier(.5,0,.75,0)' : 'cubic-bezier(.3,.7,.3,1)' })
	return ms
}

/** All effects in one fixed layer. */
export function FxLayer({ items }: { items: Fx[] }) {
	if (!items.length) return null
	return (
		<div className="fx-layer" aria-hidden>
			<svg className="fx-svg" width="100%" height="100%">
				<defs>
					<filter id="fx-glow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="4" result="b" />
						<feMerge>
							<feMergeNode in="b" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				{items.map((z) => (
					<g key={z.key} className={`fx fx-${z.kind}`}>
						{draw(z)}
					</g>
				))}
			</svg>
			{items
				.filter((z) => z.word)
				.map((z) => (
					<b key={z.key + 'w'} className="fx-word" style={{ left: Math.min(Math.max(z.x, 90), window.innerWidth - 90), top: z.y - z.h * 0.7 < 70 ? z.y + z.h * 0.75 : z.y - z.h * 0.7, ['--c' as string]: z.color === '#ffffff' || z.color === '#111111' ? (z.color2 ?? '#ffd23f') : z.color }}>
						{z.word}
					</b>
				))}
		</div>
	)
}

function draw(z: Fx): React.ReactNode {
	const r = rng(z.seed)
	const { x, y, w, h, color } = z
	const R = Math.max(w, h) * (z.big ? 1.5 : 1.15)
	switch (z.kind) {
		case 'beam': {
			const sx = z.fx ?? x + (r() - 0.5) * w * 2
			const sy = z.fy ?? -20
			const len = Math.hypot(x - sx, y - sy)
			const style = { ['--len' as string]: `${len}` } as React.CSSProperties
			return (
				<>
					<line className="beam-glow" x1={sx} y1={sy} x2={x} y2={y} stroke={color} strokeWidth={w * 0.32} strokeLinecap="round" style={style} filter="url(#fx-glow)" />
					<line className="beam-core" x1={sx} y1={sy} x2={x} y2={y} stroke="#fff" strokeWidth={w * 0.1} strokeLinecap="round" style={style} />
					<circle className="beam-hit" cx={x} cy={y} r={w * 0.45} fill={color} filter="url(#fx-glow)" />
				</>
			)
		}
		case 'web': {
			const n = 9
			const spokes = Array.from({ length: n }, (_, i) => {
				const a = (i / n) * Math.PI * 2 + r() * 0.3
				return { a, d: R * (0.9 + r() * 0.5) }
			})
			const ring = (k: number) =>
				spokes
					.map((s, i) => {
						const d = s.d * k
						const px = x + Math.cos(s.a) * d
						const py = y + Math.sin(s.a) * d
						return `${i ? 'Q' + (x + Math.cos(s.a - 0.35) * d * 0.88).toFixed(1) + ' ' + (y + Math.sin(s.a - 0.35) * d * 0.88).toFixed(1) + ' ' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`
					})
					.join(' ') + ' Z'
			return (
				<>
					{spokes.map((s, i) => (
						<line key={i} className="web-strand" x1={x} y1={y} x2={x + Math.cos(s.a) * s.d} y2={y + Math.sin(s.a) * s.d} stroke={color} style={{ animationDelay: `${i * 18}ms` }} />
					))}
					{[0.35, 0.62, 0.88].map((k, i) => (
						<path key={k} className="web-ring" d={ring(k)} stroke={color} style={{ animationDelay: `${160 + i * 70}ms` }} />
					))}
				</>
			)
		}
		case 'symbiote': {
			return Array.from({ length: 8 }, (_, i) => {
				const a = (i / 8) * Math.PI * 2 + r()
				const d = R * (0.8 + r() * 0.6)
				const cx = x + Math.cos(a + 0.8) * d * 0.5
				const cy = y + Math.sin(a + 0.8) * d * 0.5
				return (
					<path
						key={i}
						className="tendril"
						d={`M${x} ${y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`}
						stroke="#0b0b10"
						strokeWidth={w * (0.08 + r() * 0.06)}
						style={{ animationDelay: `${i * 25}ms` }}
					/>
				)
			})
		}
		case 'lightning': {
			const pts: string[] = []
			let px = x + (r() - 0.5) * w * 1.5
			const steps = 9
			for (let k = 0; k <= steps; k++) {
				const py = (y * k) / steps
				px = k === steps ? x : px + (r() - 0.5) * w * 0.9
				pts.push(`${px.toFixed(1)},${py.toFixed(1)}`)
			}
			return (
				<>
					<rect className="flash" x={0} y={0} width="100%" height="100%" fill={color} />
					<polyline className="bolt-glow" points={pts.join(' ')} stroke={color} strokeWidth={w * 0.18} filter="url(#fx-glow)" />
					<polyline className="bolt" points={pts.join(' ')} stroke="#fff" strokeWidth={w * 0.06} />
					<circle className="beam-hit" cx={x} cy={y} r={w * 0.5} fill={color} filter="url(#fx-glow)" />
				</>
			)
		}
		case 'sigil': {
			const ticks = Array.from({ length: 16 }, (_, i) => {
				const a = (i / 16) * Math.PI * 2
				const r1 = R * 0.78
				const r2 = R * (i % 2 ? 0.86 : 0.92)
				return <line key={i} x1={x + Math.cos(a) * r1} y1={y + Math.sin(a) * r1} x2={x + Math.cos(a) * r2} y2={y + Math.sin(a) * r2} />
			})
			const star = Array.from({ length: 6 }, (_, i) => {
				const a = (i / 6) * Math.PI * 2 - Math.PI / 2
				return `${(x + Math.cos(a) * R * 0.62).toFixed(1)},${(y + Math.sin(a) * R * 0.62).toFixed(1)}`
			})
			return (
				<g className="sigil" stroke={color} fill="none" filter="url(#fx-glow)" style={{ transformOrigin: `${x}px ${y}px` }}>
					<circle cx={x} cy={y} r={R * 0.95} strokeWidth={3} />
					<circle cx={x} cy={y} r={R * 0.74} strokeWidth={2} />
					{ticks}
					<polygon points={[star[0], star[2], star[4]].join(' ')} strokeWidth={2} />
					<polygon points={[star[1], star[3], star[5]].join(' ')} strokeWidth={2} />
				</g>
			)
		}
		case 'claws': {
			return [0, 1, 2].map((i) => {
				const off = (i - 1) * w * 0.22
				return (
					<line
						key={i}
						className="claw"
						x1={x - w * 0.7 + off}
						y1={y - h * 0.6}
						x2={x + w * 0.5 + off}
						y2={y + h * 0.55}
						stroke={color}
						strokeWidth={w * 0.06}
						filter="url(#fx-glow)"
						style={{ animationDelay: `${i * 40}ms` }}
					/>
				)
			})
		}
		case 'shield': {
			const star = Array.from({ length: 10 }, (_, i) => {
				const a = (i / 10) * Math.PI * 2 - Math.PI / 2
				const rr = (i % 2 ? 0.16 : 0.38) * R
				return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`
			})
			return (
				<g className="shield-fx" style={{ transformOrigin: `${x}px ${y}px` }}>
					<circle cx={x} cy={y} r={R} fill={color} stroke="#000" strokeWidth={3} />
					<circle cx={x} cy={y} r={R * 0.78} fill="#fff" />
					<circle cx={x} cy={y} r={R * 0.58} fill={color} />
					<circle cx={x} cy={y} r={R * 0.42} fill={z.color2 ?? '#1f4fd8'} />
					<polygon points={star.join(' ')} fill="#fff" />
				</g>
			)
		}
		case 'smoke': {
			return Array.from({ length: 9 }, (_, i) => {
				const a = r() * Math.PI * 2
				const d = R * r() * 0.6
				return <circle key={i} className="puff" cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d} r={w * (0.3 + r() * 0.3)} fill={i % 3 ? color : '#2a173f'} style={{ animationDelay: `${i * 20}ms` }} />
			})
		}
		case 'frost': {
			return Array.from({ length: 10 }, (_, i) => {
				const a = (i / 10) * Math.PI * 2 + r() * 0.3
				const d = R * (0.7 + r() * 0.5)
				const b = 0.09
				const p = [`${x + Math.cos(a - b) * w * 0.35},${y + Math.sin(a - b) * w * 0.35}`, `${x + Math.cos(a) * d},${y + Math.sin(a) * d}`, `${x + Math.cos(a + b) * w * 0.35},${y + Math.sin(a + b) * w * 0.35}`]
				return <polygon key={i} className="shard" points={p.join(' ')} fill={color} stroke="#fff" strokeWidth={1.5} style={{ animationDelay: `${i * 15}ms` }} />
			})
		}
		case 'fire': {
			return Array.from({ length: 11 }, (_, i) => {
				const fx = x + (r() - 0.5) * w * 1.6
				const fh = h * (0.4 + r() * 0.6)
				const fw = w * (0.18 + r() * 0.16)
				const by = y + h * 0.35
				return (
					<path
						key={i}
						className="flame"
						d={`M${fx - fw} ${by} Q${fx - fw} ${by - fh * 0.6} ${fx} ${by - fh} Q${fx + fw} ${by - fh * 0.6} ${fx + fw} ${by} Z`}
						fill={i % 3 ? color : (z.color2 ?? '#ffd23f')}
						style={{ animationDelay: `${i * 25}ms`, transformOrigin: `${fx}px ${by}px` }}
					/>
				)
			})
		}
		case 'sparks': {
			const cols = [color, z.color2 ?? '#ffd23f', '#5ad1ff', '#ffffff']
			return Array.from({ length: 22 }, (_, i) => {
				const a = r() * Math.PI * 2
				const d = R * (0.6 + r() * 0.8)
				return (
					<circle
						key={i}
						className="spark"
						cx={x}
						cy={y}
						r={w * 0.05 + r() * 3}
						fill={cols[i % cols.length]}
						style={{ ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px`, animationDelay: `${(i % 5) * 30}ms` }}
					/>
				)
			})
		}
		case 'speed': {
			return Array.from({ length: 12 }, (_, i) => {
				const yy = y - h * 0.6 + (h * 1.2 * i) / 11
				const len = w * (1.5 + r() * 2.5)
				return <line key={i} className="streak" x1={x - len - w} y1={yy} x2={x - w * 0.6} y2={yy} stroke={color} strokeWidth={2 + r() * 3} style={{ animationDelay: `${i * 15}ms` }} />
			})
		}
		case 'arrows': {
			return [-1, 0, 1].map((k) => {
				const a = -Math.PI / 2 + k * 0.5 - 0.7
				const d = R * 2.2
				const sx = x + Math.cos(a) * d
				const sy = y + Math.sin(a) * d
				return (
					<g key={k} className="arrow" style={{ animationDelay: `${(k + 1) * 60}ms` }}>
						<line x1={sx} y1={sy} x2={x} y2={y} stroke={color} strokeWidth={3} />
						<circle cx={x} cy={y} r={5} fill="#fff" />
					</g>
				)
			})
		}
		case 'rings': {
			return [0, 1, 2].map((i) => <circle key={i} className="ring" cx={x} cy={y} r={R * 0.9} stroke={color} strokeWidth={4} fill="none" style={{ animationDelay: `${i * 140}ms`, transformOrigin: `${x}px ${y}px` }} />)
		}
		default: {
			// slam: cracks in the ground and dust
			const n = z.big ? 9 : 6
			const cracks: string[] = []
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + r() * 0.5
				let px = x
				let py = y + h * 0.32
				const pts = [`${px},${py}`]
				const len = w * (0.6 + r() * (z.big ? 0.9 : 0.5))
				for (let k = 1; k <= 4; k++) {
					const d = (len * k) / 4
					const j = (r() - 0.5) * 0.6
					px = x + Math.cos(a + j) * d
					py = y + h * 0.32 + Math.sin(a + j) * d * 0.5
					pts.push(`${px.toFixed(1)},${py.toFixed(1)}`)
				}
				cracks.push(pts.join(' '))
			}
			return (
				<>
					<ellipse className="slam-ring2" cx={x} cy={y + h * 0.32} rx={w * 0.9} ry={w * 0.4} fill="rgba(30,20,10,.35)" style={{ transformOrigin: `${x}px ${y + h * 0.32}px` }} />
					{cracks.map((p, i) => (
						<polyline key={i} className="crack" points={p} style={{ animationDelay: `${i * 12}ms` }} />
					))}
					{Array.from({ length: z.big ? 10 : 6 }, (_, i) => {
						const a = r() * Math.PI * 2
						return (
							<circle
								key={'d' + i}
								className="dust"
								cx={x}
								cy={y + h * 0.32}
								r={w * 0.07}
								style={{ ['--dx' as string]: `${Math.cos(a) * w * 1.2}px`, ['--dy' as string]: `${Math.sin(a) * w * 0.5}px` }}
							/>
						)
					})}
				</>
			)
		}
	}
}

/** ?fxdemo — every hero's landing effect and hit, for checking how they look. */
export function FxDemo() {
	const sets = Object.keys(HERO_FX)
	const params = new URLSearchParams(location.search)
	const hit = params.get('fxdemo') === 'hit'
	const W = 70
	const H2 = 98
	const cols = Math.max(1, Math.floor((window.innerWidth - 20) / 150))
	const items: Fx[] = sets.map((s, i) => {
		const f = HERO_FX[s]
		const cx = 20 + (i % cols) * 150 + 75
		const cy = 60 + Math.floor(i / cols) * 190 + 80
		return { key: s, kind: hit ? f.hit : f.land, x: cx, y: cy, w: W, h: H2, color: f.color, color2: f.color2, word: f.word, big: true, seed: i + 1, fx: hit ? cx - 60 : undefined, fy: hit ? cy + 70 : undefined }
	})
	return (
		<div style={{ position: 'relative', minHeight: '100vh', background: '#1b2340' }}>
			{sets.map((s, i) => (
				<div key={s} style={{ position: 'absolute', left: 20 + (i % cols) * 150 + 75 - W / 2, top: 60 + Math.floor(i / cols) * 190 + 80 - H2 / 2, width: W, height: H2, background: '#556', border: '2px solid #000', borderRadius: 6, color: '#fff', fontSize: 10, textAlign: 'center' }}>
					{s}
				</div>
			))}
			<FxLayer items={items} />
		</div>
	)
}
