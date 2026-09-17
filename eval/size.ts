import { readdirSync, readFileSync } from 'node:fs'
import { brotliCompressSync } from 'node:zlib'

const LIMIT_BYTES = 40 * 1024
const dist = new URL('../packages/core/dist/', import.meta.url)

const bundles = readdirSync(dist)
  .filter(name => name.endsWith('.js'))
  .map(name => ({ name, bytes: readFileSync(new URL(name, dist)) }))

for (const bundle of bundles) console.log(bundle.name.padEnd(18), bundle.bytes.length, 'B')

const combined = Buffer.concat(bundles.map(bundle => bundle.bytes))
const compressed = brotliCompressSync(combined).length
console.log(`total ${combined.length} B raw, ${compressed} B brotli (limit ${LIMIT_BYTES})`)

if (compressed > LIMIT_BYTES) {
  console.error('bundle-size gate failed')
  process.exit(1)
}
