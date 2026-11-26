// Downloads the card pictures MarvelCDB doesn't have (src/data/images.json → missing) from a second
// source into public/cards/<code>.jpg, so the game serves them itself; records them in images.json → local.
//   node scripts/fetch-missing-images.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const file = path.join(root, 'src/data/images.json')
const info = JSON.parse(fs.readFileSync(file, 'utf8'))
const dir = path.join(root, 'public/cards')
fs.mkdirSync(dir, { recursive: true })

// 1. Fantasy Flight's own card CDN (older packs): MC<product>en_<number><side>.jpg. MarvelCDB code prefix → FFG product.
const FFG = { '01': 1, '04': 10 }
// 2. Hall of Heroes pack pages, whose card scans are named by MarvelCDB code (e.g. 60205a.jpg).
const HOH = {
	40: 'next-evolution', 41: 'psylocke', 45: 'age-of-apocalypse', 47: 'jubilee', 50: 'agents-of-s-h-i-e-l-d',
	55: 'trickster-takeover', 56: 'civil-war', 57: 'synthezoid-smackdown', 60: 'fear-no-evil', 61: 'jessica-jones',
	63: 'elektra', 64: 'iron-fist',
}
const pages = {}
async function hohPage(prefix) {
	if (!(prefix in HOH)) return {}
	if (pages[prefix]) return pages[prefix]
	const names = {}
	try {
		const r = await fetch(`https://hallofheroeslcg.com/${HOH[prefix]}/`)
		const t = r.ok ? await r.text() : ''
		for (const u of new Set(t.match(/https:\/\/hallofheroeslcg\.com\/wp-content\/uploads\/[^"' ]+?\.(?:jpg|jpeg|png|webp)/g) ?? [])) {
			const f = u.split('/').pop()
			const full = !/-\d+x\d+\./.test(f)
			const k = f.replace(/-\d+x\d+(?=\.)/, '').replace(/\.[a-z]+$/, '').toLowerCase()
			if (!names[k] || full) names[k] = u
		}
	} catch {
		/* page unavailable */
	}
	return (pages[prefix] = names)
}
const sources = async (code) => {
	const m = code.match(/^(\d\d)(\d{3})([a-z]?)$/)
	if (!m) return []
	const list = []
	if (FFG[m[1]]) {
		const base = `https://lcgcdn.s3.amazonaws.com/mc/MC${String(FFG[m[1]]).padStart(2, '0')}en_${Number(m[2])}`
		list.push(base + m[3].toUpperCase() + '.jpg')
	}
	const hoh = (await hohPage(m[1]))[code]
	if (hoh) list.push(hoh)
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
		for (const url of await sources(code)) {
			const buf = await get(url)
			if (buf) {
				const out = path.join(dir, `${code}.jpg`)
				fs.writeFileSync(out, buf)
				// shrink big scans to a 560px short side, as JPEG (ImageMagick is on GitHub's runners)
				spawnSync('convert', [out, '-resize', '560x560^>', '-quality', '82', `jpg:${out}`])
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
