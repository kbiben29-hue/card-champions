// A QR code for the join link, so a friend at the same table can join by pointing their camera at it.
// The QR encoder (qrcode-generator) is loaded from a CDN on demand, like PeerJS for online play.
import { useEffect, useState } from 'react'

const QR_URL = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
type QrFactory = (type: number, level: 'L' | 'M' | 'Q' | 'H') => { addData(s: string): void; make(): void; createSvgTag(o: { cellSize: number; margin: number; scalable?: boolean }): string }

let loading: Promise<QrFactory | null> | null = null
function loadQr(): Promise<QrFactory | null> {
	const w = window as unknown as { qrcode?: QrFactory }
	if (w.qrcode) return Promise.resolve(w.qrcode)
	loading ??= new Promise((res) => {
		const s = document.createElement('script')
		s.src = QR_URL
		s.async = true
		s.onload = () => res(w.qrcode ?? null)
		s.onerror = () => {
			loading = null
			res(null)
		}
		document.head.appendChild(s)
	})
	return loading
}

export function JoinQr({ text }: { text: string }) {
	const [svg, setSvg] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	useEffect(() => {
		let live = true
		void loadQr().then((qr) => {
			if (!live) return
			if (!qr) return setFailed(true)
			const q = qr(0, 'M')
			q.addData(text)
			q.make()
			setSvg(q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }))
		})
		return () => {
			live = false
		}
	}, [text])
	if (failed) return null
	return svg ? <div className="qr" aria-label="QR code with the join link" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="qr loading">making a QR code…</div>
}
