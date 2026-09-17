import { DetailBody, DetailText, DetailTitle, Metadata, MetadataRow } from '@/components/Detail'
import { Tag, type TagColor } from '@/components/Tag'
import type { Issue } from '@/lib/issues'
import { closeIssue } from '@/lib/store'

const STATUS_COLOR: Record<string, TagColor> = { open: 'green', closed: 'gray', blocked: 'orange' }
const TYPE_COLOR: Record<string, TagColor> = { bug: 'red', feature: 'blue', chore: 'gray' }
const PRIORITY_COLOR: Record<string, TagColor> = { urgent: 'red', high: 'orange', low: 'gray' }

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function IssueView({ issue }: { issue: Issue }) {
  return (
    <>
      <DetailBody>
        <p className="font-mono text-xs text-ray-dim">#{issue.id}</p>
        <DetailTitle>{issue.title}</DetailTitle>
        <DetailText>
          Sample data.{' '}
          <button
            type="button"
            onClick={closeIssue}
            className="text-ray-text underline underline-offset-4"
          >
            Back to how your query was read
          </button>{' '}
          <span className="max-md:hidden">(Esc)</span>
        </DetailText>
      </DetailBody>
      <Metadata>
        <MetadataRow label="Status">
          <Tag color={STATUS_COLOR[issue.status]}>{issue.status}</Tag>
        </MetadataRow>
        <MetadataRow label="Type">
          <Tag color={TYPE_COLOR[issue.type]}>{issue.type}</Tag>
        </MetadataRow>
        <MetadataRow label="Priority">
          <Tag color={PRIORITY_COLOR[issue.priority]}>{issue.priority}</Tag>
        </MetadataRow>
        <MetadataRow label="Author">{issue.author}</MetadataRow>
        <MetadataRow label="Assignee">{issue.assignee}</MetadataRow>
        <MetadataRow label="Created">{DATE_FORMAT.format(issue.created)}</MetadataRow>
        <MetadataRow label="Updated">{DATE_FORMAT.format(issue.updated)}</MetadataRow>
        <MetadataRow label="Comments">{issue.comments}</MetadataRow>
        <MetadataRow label="Points">{issue.points}</MetadataRow>
      </Metadata>
    </>
  )
}
