import { Composition } from 'remotion'
import { LAUNCH_FRAMES, Launch } from './Launch.tsx'

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
