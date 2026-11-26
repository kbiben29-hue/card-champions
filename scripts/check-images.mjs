// Checks which card pictures MarvelCDB has: writes src/data/images.json
//   { missing: codes with no picture, jpg: codes whose picture is only a .jpg }
// so the game asks for the right file straight away and shows a text card for the rest.
//   node scripts/check-images.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const cards = JSON.parse(fs.readFileSync(path.join(root, 'src/data/cards.json'), 'utf8'))
const codes = [...new Set(cards.map((c) => c.img ?? c.c))]
const base = 'https://marvelcdb.com/bundles/cards/'
const ok = async (url) => {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const r = await fetch(url, { method: 'HEAD' })
			if (r.status === 200) return true
			if (r.status === 404) return false
		} catch {
			/* retry */
		}
		await new Promise((res) => setTimeout(res, 500 * (attempt + 1)))
	}
	return false
}
const missing = []
const jpg = []
let i = 0
async function worker() {
	while (i < codes.length) {
		const code = codes[i++]
		if (await ok(`${base}${code}.png`)) continue
		if (await ok(`${base}${code}.jpg`)) jpg.push(code)
		else missing.push(code)
	}
}
await Promise.all(Array.from({ length: 24 }, worker))
missing.sort()
jpg.sort()
fs.writeFileSync(path.join(root, 'src/data/images.json'), JSON.stringify({ missing, jpg }))
console.log(`${codes.length} cards: ${missing.length} without a picture, ${jpg.length} jpg only`)
