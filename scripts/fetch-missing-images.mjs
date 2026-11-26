// Downloads the card pictures MarvelCDB doesn't have (src/data/images.json → missing) from a second
// source into public/cards/<code>.jpg, so the game serves them itself; records them in images.json → local.
//   node scripts/fetch-missing-images.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const file = path.join(root, 'src/data/images.json')
const info = JSON.parse(fs.readFileSync(file, 'utf8'))
const dir = path.join(root, 'public/cards')
fs.mkdirSync(dir, { recursive: true })

// The community card-image store used by the Cerebro Discord bot (codes in upper case).
const sources = (code) => {
	const up = code.toUpperCase()
	const list = [`https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${up}.jpg`]
	if (!/[A-Z]$/.test(up)) list.push(`https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${up}A.jpg`)
	return list
}

const get = async (url) => {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const r = await fetch(url)
			if (r.status === 404) return null
			if (r.ok) {
				const type = r.headers.get('content-type') ?? ''
				const buf = Buffer.from(await r.arrayBuffer())
				if (type.startsWith('image/') && buf.length > 2000) return buf
				return null
			}
		} catch {
			/* retry */
		}
		await new Promise((res) => setTimeout(res, 600 * (attempt + 1)))
	}
	return null
}

const local = new Set(info.local ?? [])
let got = 0
let i = 0
const todo = info.missing.filter((c) => !fs.existsSync(path.join(dir, `${c}.jpg`)))
for (const c of info.missing) if (fs.existsSync(path.join(dir, `${c}.jpg`))) local.add(c)
async function worker() {
	while (i < todo.length) {
		const code = todo[i++]
		for (const url of sources(code)) {
			const buf = await get(url)
			if (buf) {
				fs.writeFileSync(path.join(dir, `${code}.jpg`), buf)
				local.add(code)
				got++
				break
			}
		}
	}
}
await Promise.all(Array.from({ length: 12 }, worker))
info.local = [...local].sort()
fs.writeFileSync(file, JSON.stringify(info))
console.log(`${info.missing.length} missing on MarvelCDB: ${got} downloaded now, ${info.local.length} served from this repo`)
