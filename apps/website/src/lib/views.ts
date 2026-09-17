export const VIEWS = [
  { id: 'parse', name: 'Parse' },
  { id: 'schema', name: 'Schema' },
  { id: 'model', name: 'Inside the Model' },
  { id: 'backends', name: 'Backends' },
  { id: 'curve', name: 'Escalation Curve' },
  { id: 'cost', name: 'Cost' },
  { id: 'accuracy', name: 'Accuracy' },
  { id: 'install', name: 'Install' },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

export function viewName(id: ViewId): string {
  return VIEWS.find(view => view.id === id)?.name ?? id
}
