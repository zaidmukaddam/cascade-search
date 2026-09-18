import { Composition } from 'remotion'
import { Launch, LAUNCH_FRAMES } from './Launch.tsx'

export function Root() {
  return (
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={LAUNCH_FRAMES}
      fps={30}
      width={1280}
      height={720}
    />
  )
}
