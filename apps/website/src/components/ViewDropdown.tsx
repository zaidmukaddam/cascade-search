import { VIEWS, type ViewId } from '@/lib/views'
import { GlassSelect } from './GlassSelect.tsx'

const OPTIONS = VIEWS.map(view => ({ value: view.id, label: view.name }))

interface ViewDropdownProps {
  view: ViewId
  onChange: (view: ViewId) => void
}

export function ViewDropdown({ view, onChange }: ViewDropdownProps) {
  return <GlassSelect label="Detail view" value={view} options={OPTIONS} onChange={onChange} />
}
