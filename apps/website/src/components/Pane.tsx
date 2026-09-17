import { lazy, Suspense } from 'react'
import type { State } from '@/lib/store'
import { IssueView } from '@/views/IssueView'
import { ParseView } from '@/views/ParseView'

const SchemaView = lazy(() => import('@/views/SchemaView').then(m => ({ default: m.SchemaView })))
const ModelView = lazy(() => import('@/views/ModelView').then(m => ({ default: m.ModelView })))
const BackendsView = lazy(() =>
  import('@/views/BackendsView').then(m => ({ default: m.BackendsView })),
)
const CurveView = lazy(() => import('@/views/CurveView').then(m => ({ default: m.CurveView })))
const CostView = lazy(() => import('@/views/CostView').then(m => ({ default: m.CostView })))
const AccuracyView = lazy(() =>
  import('@/views/AccuracyView').then(m => ({ default: m.AccuracyView })),
)
const InstallView = lazy(() =>
  import('@/views/InstallView').then(m => ({ default: m.InstallView })),
)

function CurrentView({ state }: { state: State }) {
  if (state.openIssue) return <IssueView issue={state.openIssue} />
  switch (state.view) {
    case 'schema':
      return <SchemaView state={state} />
    case 'model':
      return <ModelView state={state} />
    case 'backends':
      return <BackendsView />
    case 'curve':
      return <CurveView />
    case 'cost':
      return <CostView state={state} />
    case 'accuracy':
      return <AccuracyView />
    case 'install':
      return <InstallView />
    default:
      return <ParseView state={state} />
  }
}

export function Pane({ state }: { state: State }) {
  return (
    <div className="h-full overflow-y-auto md:border-l md:border-ray-line">
      <Suspense fallback={null}>
        <CurrentView state={state} />
      </Suspense>
    </div>
  )
}
