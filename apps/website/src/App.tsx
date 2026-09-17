import { Field } from './components/Field.tsx'
import { Window } from './components/Window.tsx'
import { REPO_URL } from './lib/links.ts'

export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center md:px-4 md:pb-10 md:pt-[12vh]">
      <Field />
      <p className="mb-6 text-sm text-muted-foreground max-md:hidden">
        <span className="text-foreground">cascade-search</span> · a search bar that knows when it
        doesn't know
      </p>
      <Window />
      <p className="mt-auto pt-10 text-xs text-muted-foreground max-md:hidden">
        MIT ·{' '}
        <a href={REPO_URL} className="underline-offset-4 hover:text-foreground hover:underline">
          source
        </a>
      </p>
    </main>
  )
}
