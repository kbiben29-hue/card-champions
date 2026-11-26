// Online play protocol. The host's browser is the referee: it owns the Game, applies every intent
// (its own and the guest's) with the normal engine, and sends the new state to the guest.
import type { Game, Intent } from '../engine/types'
import type { PlayerSetup } from '../engine/engine'

export type GuestMsg = { type: 'hello'; player: PlayerSetup } | { type: 'intent'; intent: Intent }
export type HostMsg = { type: 'start'; state: Game; seat: number } | { type: 'state'; state: Game } | { type: 'error'; message: string }

/** Where invite links point when the game runs inside the desktop app (which has no web address). */
export const PLAY_URL = 'https://kbiben29-hue.github.io/card-champions/'

export function joinLink(code: string): string {
	const inApp = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__ || !/^https?:$/.test(window.location.protocol)
	const u = new URL(inApp ? PLAY_URL : window.location.href)
	u.search = ''
	u.hash = ''
	u.searchParams.set('join', code)
	const net = new URLSearchParams(window.location.search).get('net')
	if (net) u.searchParams.set('net', net)
	return u.toString()
}

export function joinCodeFromUrl(): string | null {
	const c = new URLSearchParams(window.location.search).get('join')
	return c && /^[a-z0-9]{4,16}$/.test(c) ? c : null
}

export function clearJoinFromUrl() {
	const u = new URL(window.location.href)
	u.searchParams.delete('join')
	window.history.replaceState(null, '', u.toString())
}

export const isGuestMsg = (m: unknown): m is GuestMsg => !!m && typeof m === 'object' && ['hello', 'intent'].includes((m as { type?: string }).type ?? '')
export const isHostMsg = (m: unknown): m is HostMsg => !!m && typeof m === 'object' && ['start', 'state', 'error'].includes((m as { type?: string }).type ?? '')
