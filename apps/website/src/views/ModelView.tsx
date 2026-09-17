import { defaultWeights, FEATURE_NAMES, parameterCount, ROLES } from 'cascade-search'
import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { Heatmap } from '@/components/Heatmap'
import type { State } from '@/lib/store'

const LABEL_LENGTH = 7

function multiHot(features: number[][]): Float32Array {
  const rows = new Float32Array(features.length * FEATURE_NAMES.length)
  features.forEach((active, token) => {
    for (const feature of active) rows[token * FEATURE_NAMES.length + feature] = 1
  })
  return rows
}

export function ModelView({ state }: { state: State }) {
  const { trace, features, tokens } = state.local
  const weights = defaultWeights()

  if (!tokens.length || !trace || !features) {
    return (
      <DetailBody>
        <DetailTitle>Inside the Model</DetailTitle>
        <DetailText>Type a query to see its activations.</DetailText>
      </DetailBody>
    )
  }

  const words = tokens.map(token => token.text.slice(0, LABEL_LENGTH))
  const rows = tokens.length

  return (
    <>
      <DetailBody>
        <DetailTitle>Inside the Model</DetailTitle>
        <DetailText>
          Real activations for your query, recomputed on every keystroke. One row per word.
        </DetailText>
        <Heatmap
          data={multiHot(features)}
          rows={rows}
          columns={FEATURE_NAMES.length}
          label="Sparse features"
          rowLabels={words}
        />
        <Heatmap
          data={trace.embed}
          rows={rows}
          columns={weights.width}
          label="Embedding"
          rowLabels={words}
        />
        <Heatmap
          data={trace.conv}
          rows={rows}
          columns={weights.width}
          label="Convolution"
          rowLabels={words}
        />
        {trace.layers.map((layer, index) => (
          <div key={`layer-${index}`} className="space-y-4">
            <Heatmap
              data={layer.fwd}
              rows={rows}
              columns={weights.width}
              label={`Gated scan ${index + 1}, left to right`}
              rowLabels={words}
            />
            <Heatmap
              data={layer.bwd}
              rows={rows}
              columns={weights.width}
              label={`Gated scan ${index + 1}, right to left`}
              rowLabels={words}
            />
          </div>
        ))}
        <Heatmap
          data={trace.logits}
          rows={rows}
          columns={ROLES.length}
          label="Role scores"
          rowLabels={words}
        />
      </DetailBody>
      <Metadata>
        <MetadataRow label="Parameters">{parameterCount(weights).toLocaleString()}</MetadataRow>
        <MetadataRow label="Weights">6-bit integers</MetadataRow>
        <MetadataRow label="Confidence">
          softmax, temperature {weights.temperature.toFixed(2)}
        </MetadataRow>
      </Metadata>
    </>
  )
}
