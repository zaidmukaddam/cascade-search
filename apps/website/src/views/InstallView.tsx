import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { NPM_URL, REPO_URL } from '@/lib/links'

const USAGE = `import { parse, escalate } from 'cascade-search'

const result = parse('open from sam since tuesday', schema)

result.ir
result.minConfidence
result.spans

parse('pie chart of open bugs by priority', schema).ir.view
// { chart: 'pie', by: 'priority', agg: 'count', of: null }

if (result.spans.length) {
  await escalate(result, schema, jev)
}`

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-ray-selected p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  )
}

function Link({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="underline decoration-ray-faint underline-offset-4 hover:decoration-ray-text"
    >
      {children}
    </a>
  )
}

export function InstallView() {
  return (
    <>
      <DetailBody>
        <DetailTitle>Install</DetailTitle>
        <Code>npm install cascade-search</Code>
        <Code>{USAGE}</Code>
        <DetailText>
          Ask for a chart or a number in the same sentence ("by status", "how many", "total points
          per assignee") and the filter carries a view: bar, pie, line or number. Drawing it is
          yours; this demo's charts are plain SVG.
        </DetailText>
        <DetailText>
          The second tier is a separate package, cascade-search-jev. It calls Jev through Vercel AI
          Gateway with a timeout, retries and a hard calls-per-minute budget.
        </DetailText>
      </DetailBody>
      <Metadata>
        <MetadataRow label="Runtime dependencies">None</MetadataRow>
        <MetadataRow label="Size with weights">35.6 KB Brotli</MetadataRow>
        <MetadataRow label="License">MIT</MetadataRow>
        <MetadataRow label="Source">
          <Link href={REPO_URL}>GitHub</Link>
        </MetadataRow>
        <MetadataRow label="Package">
          <Link href={NPM_URL}>npm</Link>
        </MetadataRow>
      </Metadata>
    </>
  )
}
