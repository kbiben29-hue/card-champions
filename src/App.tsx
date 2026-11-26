import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apply, newGame, type Game, type Intent, type PlayerSetup, type Setup } from './engine/engine'
import { Board } from './ui/Board'
import { Home, JoinScreen, NewGame, type Mode, type SetupResult } from './ui/Screens'
import { hostGame, joinGame, newGameCode, type Conn, type Host } from './net/transport'
import { clearJoinFromUrl, isGuestMsg, isHostMsg, joinCodeFromUrl, joinLink, type HostMsg } from './net/online'

const W = 1440
/** the table is 1440 wide; its height follows the screen's shape (iPad 4:3 gets a taller table) */
const heightFor = () => (typeof window === 'undefined' ? 900 : Math.round(Math.min(1080, Math.max(800, (W * window.innerHeight) / window.innerWidth))))
const SAVE = 'champions.save.v1'

interface Session {
	history: Game[]
	online?: { role: 'host' | 'guest'; code: string; seat: number }
	hotseat: boolean
}

function loadSave(): Session | null {
	try {
		const raw = localStorage.getItem(SAVE)
		return raw ? (JSON.parse(raw) as Session) : null
	} catch {
		return null
	}
}
function writeSave(s: Session | null) {
	try {
		if (!s) localStorage.removeItem(SAVE)
		else localStorage.setItem(SAVE, JSON.stringify({ ...s, history: s.history.slice(-12) }))
	} catch {
		/* storage full: keep playing */
	}
}

function useFit(active: boolean) {
	const [fit, setFit] = useState({ scale: 1, left: 0, top: 0, h: 900 })
	useLayoutEffect(() => {
		const f = () => {
			const H = heightFor()
			const scale = Math.min(window.innerWidth / W, window.innerHeight / H)
			setFit({ scale, left: (window.innerWidth - W * scale) / 2, top: (window.innerHeight - H * scale) / 2, h: H })
		}
		f()
		window.addEventListener('resize', f)
		window.addEventListener('orientationchange', f)
		return () => (window.removeEventListener('resize', f), window.removeEventListener('orientationchange', f))
	}, [active])
	return fit
}

/** Who should be looking at the device: whoever must answer, else whoever's turn it is. */
const actor = (g: Game) => (g.queue[0] ? g.queue[0].who : g.active)

export default function App() {
	const [session, setSession] = useState<Session | null>(null)
	const [screen, setScreen] = useState<{ k: 'home' } | { k: 'new'; mode: Mode } | { k: 'join'; code?: string } | { k: 'lobby' }>(() => {
		const j = joinCodeFromUrl()
		return j ? { k: 'join', code: j } : { k: 'home' }
	})
	const [viewer, setViewer] = useState(0)
	const [cover, setCover] = useState<number | null>(null)
	const [lobby, setLobby] = useState<{ code: string; status: string; role: 'host' | 'guest'; error?: string } | null>(null)
	const hostRef = useRef<Host | null>(null)
	const connRef = useRef<Conn | null>(null)
	const pendingSetup = useRef<Setup | null>(null)
	const fit = useFit(!!session)
	const g = session?.history[session.history.length - 1] ?? null

	useEffect(() => writeSave(session), [session])

	// hot-seat: follow whoever has to act; cover the screen when it changes hands in a competitive game
	const lastActor = useRef<number | null>(null)
	useEffect(() => {
		if (!g || session?.online) return
		const a = actor(g)
		if (a === lastActor.current) return
		const prev = lastActor.current
		lastActor.current = a
		setViewer(a)
		if (g.mode === 'pvp' && prev !== null && g.players[prev]?.area !== g.players[a]?.area) setCover(a)
	}, [g, session?.online])

	const dispatch = useCallback(
		(it: Intent): string | null => {
			if (!session || !g) return 'no game'
			if (session.online?.role === 'guest') {
				try {
					apply(g, it) // check locally first
				} catch (e) {
					return (e as Error).message
				}
				connRef.current?.send({ type: 'intent', intent: it })
				return null
			}
			try {
				const n = apply(g, it)
				setSession({ ...session, history: [...session.history.slice(-30), n] })
				if (session.online?.role === 'host') connRef.current?.send({ type: 'state', state: n } satisfies HostMsg)
				return null
			} catch (e) {
				return (e as Error).message
			}
		},
		[session, g],
	)

	// host: apply the guest's intents
	const sessionRef = useRef(session)
	sessionRef.current = session
	const hostApply = (it: Intent) => {
		const s = sessionRef.current
		if (!s) return
		const cur = s.history[s.history.length - 1]
		try {
			const n = apply(cur, it)
			const ns = { ...s, history: [...s.history.slice(-30), n] }
			sessionRef.current = ns
			setSession(ns)
			connRef.current?.send({ type: 'state', state: n } satisfies HostMsg)
		} catch (e) {
			connRef.current?.send({ type: 'error', message: (e as Error).message } satisfies HostMsg)
		}
	}

	const closeNet = () => {
		connRef.current?.close()
		connRef.current = null
		hostRef.current?.destroy()
		hostRef.current = null
	}

	const openHost = async (code: string, setup: Setup | null) => {
		setLobby({ code, status: 'Opening the game…', role: 'host' })
		setScreen({ k: 'lobby' })
		try {
			const h = await hostGame(code)
			hostRef.current = h
			setLobby({ code, status: 'Waiting for your friend to join…', role: 'host' })
			h.onConnection((c) => {
				connRef.current = c
				c.onMessage((m) => {
					if (!isGuestMsg(m)) return
					if (m.type === 'hello') {
						const cur = sessionRef.current
						if (cur?.online?.role === 'host') {
							c.send({ type: 'start', state: cur.history[cur.history.length - 1], seat: 1 } satisfies HostMsg)
							return
						}
						const st = setup ?? pendingSetup.current
						if (!st) return
						const guest: PlayerSetup = { ...m.player, area: 1 }
						const full: Setup = { ...st, players: [st.players[0], guest] }
						const game = newGame(full)
						const ns: Session = { history: [game], online: { role: 'host', code, seat: 0 }, hotseat: false }
						sessionRef.current = ns
						setSession(ns)
						setViewer(0)
						setLobby(null)
						c.send({ type: 'start', state: game, seat: 1 } satisfies HostMsg)
					}
					if (m.type === 'intent') hostApply(m.intent)
				})
				c.onClose(() => setLobby((l) => l))
			})
			h.onError((e) => setLobby((l) => (l ? { ...l, error: e } : l)))
		} catch (e) {
			setLobby({ code, status: '', role: 'host', error: (e as Error).message })
		}
	}

	const openGuest = async (code: string, player: PlayerSetup) => {
		setLobby({ code, status: 'Connecting…', role: 'guest' })
		setScreen({ k: 'lobby' })
		try {
			const c = await joinGame(code)
			connRef.current = c
			setLobby({ code, status: 'Connected — waiting for the game to start…', role: 'guest' })
			c.onMessage((m) => {
				if (!isHostMsg(m)) return
				if (m.type === 'start') {
					clearJoinFromUrl()
					setSession({ history: [m.state], online: { role: 'guest', code, seat: m.seat }, hotseat: false })
					setViewer(m.seat)
					setLobby(null)
				}
				if (m.type === 'state') setSession((s) => (s ? { ...s, history: [...s.history.slice(-5), m.state] } : s))
			})
			c.send({ type: 'hello', player })
		} catch (e) {
			setLobby({ code, status: '', role: 'guest', error: (e as Error).message })
		}
	}

	const start = (r: SetupResult) => {
		if (r.online === 'host') {
			pendingSetup.current = r.setup
			void openHost(newGameCode(), r.setup)
			return
		}
		const game = newGame(r.setup)
		lastActor.current = null
		setSession({ history: [game], hotseat: true })
		setViewer(0)
	}

	const saved = !session ? loadSave() : null

	if (!session || !g) {
		if (screen.k === 'lobby' && lobby)
			return (
				<div className="screen setup">
					<div className="panel lobby">
						<h2>{lobby.role === 'host' ? 'Invite a friend' : 'Joining your friend'}</h2>
						{lobby.role === 'host' && (
							<>
								<p>
									Game code: <b className="code">{lobby.code}</b>
								</p>
								<p>
									Or send this link: <input readOnly value={joinLink(lobby.code)} onFocus={(e) => e.target.select()} />
								</p>
								<button onClick={() => navigator.clipboard?.writeText(joinLink(lobby.code))}>Copy the link</button>
							</>
						)}
						<p>{lobby.status}</p>
						{lobby.error && <p className="warn">{lobby.error}</p>}
						<button onClick={() => (closeNet(), setLobby(null), setScreen({ k: 'home' }))}>Cancel</button>
					</div>
				</div>
			)
		if (screen.k === 'new') return <NewGame mode={screen.mode} onStart={start} onBack={() => setScreen({ k: 'home' })} />
		if (screen.k === 'join')
			return screen.code ? (
				<NewGame mode="pvp" onStart={() => {}} onBack={() => setScreen({ k: 'home' })} guest={(p) => openGuest(screen.code!, { ...p, area: 1 })} />
			) : (
				<JoinScreen onBack={() => setScreen({ k: 'home' })} onJoin={(code) => setScreen({ k: 'join', code })} />
			)
		return (
			<Home
				onNew={(m) => setScreen({ k: 'new', mode: m })}
				onJoin={() => setScreen({ k: 'join' })}
				onResume={
					saved
						? () => {
								if (saved.online?.role === 'host') {
									setSession(saved)
									setViewer(saved.online.seat)
									void openHost(saved.online.code, null)
									setScreen({ k: 'home' })
									return
								}
								lastActor.current = null
								setSession(saved)
							}
						: undefined
				}
				resumeLabel={saved ? `Continue (round ${saved.history[saved.history.length - 1]?.round ?? 1})` : undefined}
			/>
		)
	}

	const seat = session.online?.seat
	const canControl = (p: number) => (seat === undefined ? true : p === seat)
	return (
		<div className="stage-wrap">
			<div className="rotate-hint">Turn your phone sideways for the table.</div>
			<div className="stage" style={{ width: W, height: fit.h, transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})` }}>
				<Board
					g={g}
					viewer={seat ?? viewer}
					setViewer={(p) => (seat === undefined ? setViewer(p) : undefined)}
					layout={g.mode === 'pvp' ? 'console' : 'table'}
					dispatch={dispatch}
					canControl={canControl}
					onMenu={() => {
						if (session.online) closeNet()
						setSession(null)
						setScreen({ k: 'home' })
					}}
					onUndo={!session.online && session.history.length > 1 ? () => setSession({ ...session, history: session.history.slice(0, -1) }) : undefined}
					netBadge={session.online ? <span className="net">Online · {session.online.code}</span> : undefined}
				/>
				{cover !== null && (
					<div className="handoff" onClick={() => setCover(null)}>
						<div>
							<h2>Pass the device to {g.players[cover].name}</h2>
							<p>Tap when you're ready — your hand is hidden until then.</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
