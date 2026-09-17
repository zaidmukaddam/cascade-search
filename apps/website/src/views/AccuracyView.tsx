import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { percent } from '@/lib/format'
import { calibration, endToEnd, shippedSignal } from '@/lib/results'

const SPLITS = [
  {
    name: 'Held out',
    measured: endToEnd.heldout,
    ece: calibration.heldout.methods[shippedSignal].ece,
  },
  {
    name: 'Transfer',
    measured: endToEnd.transfer,
    ece: calibration.transfer.methods[shippedSignal].ece,
  },
]

export function AccuracyView() {
  return (
    <>
      <DetailBody>
        <DetailTitle>Accuracy</DetailTitle>
        <DetailText>
          The local tier alone, with the 6-bit weights that ship. Held out means new queries from
          the domains it trained on. Transfer means four domains whose words it has never seen.
        </DetailText>
        <DetailText>
          The corpus is synthetic. We wrote the generator, so this shows the model learned our
          grammar and carries it to unseen schemas. It does not establish accuracy on how people
          really phrase things. The escalation log is the intended fix.
        </DetailText>
      </DetailBody>
      <Metadata>
        {SPLITS.map(split => (
          <MetadataRow key={split.name} label={`${split.name} · exact filter`}>
            {percent(split.measured.filterExact)}
          </MetadataRow>
        ))}
        {SPLITS.map(split => (
          <MetadataRow key={split.name} label={`${split.name} · word roles`}>
            {percent(split.measured.tokenAccuracy)}
          </MetadataRow>
        ))}
        {SPLITS.map(split => (
          <MetadataRow key={split.name} label={`${split.name} · ECE`}>
            {split.ece.toFixed(4)}
          </MetadataRow>
        ))}
        <MetadataRow label="Latency p50 / p99">
          {endToEnd.transfer.latencyMs.p50.toFixed(2)} /{' '}
          {endToEnd.transfer.latencyMs.p99.toFixed(2)} ms
        </MetadataRow>
        <MetadataRow label="Measured">{endToEnd.date} · Node, author's laptop</MetadataRow>
      </Metadata>
    </>
  )
}
