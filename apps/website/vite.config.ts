import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

const ESCALATE_ROUTE = '/api/escalate'

function fromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

const repoRoot = fromHere('../..')
const gatewayKey = loadEnv('development', repoRoot, 'AI_GATEWAY').AI_GATEWAY_API_KEY
if (gatewayKey) process.env.AI_GATEWAY_API_KEY ??= gatewayKey

async function readBody(request: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined
}

async function serveEscalate(
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const { handle } = await server.ssrLoadModule('/api/escalate.ts')
  const webRequest = new Request(`http://dev${ESCALATE_ROUTE}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: await readBody(request),
  })
  const webResponse: Response = await handle(webRequest)

  response.statusCode = webResponse.status
  for (const [name, value] of webResponse.headers) response.setHeader(name, value)
  response.end(await webResponse.text())
}

const devApi: Plugin = {
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(ESCALATE_ROUTE, (request, response) =>
      serveEscalate(server, request, response),
    )
  },
}

export default defineConfig({
  plugins: [react(), tailwind(), devApi],
  resolve: {
    alias: {
      '@': fromHere('./src'),
      'cascade-search-jev': fromHere('../../packages/jev/src/index.ts'),
      'cascade-search': fromHere('../../packages/core/src/index.ts'),
    },
  },
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
