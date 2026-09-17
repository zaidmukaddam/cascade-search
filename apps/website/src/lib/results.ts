import endToEnd from '../../../../eval/results/e2e.json'
import calibration from '../../../../eval/results/m2.json'
import sweep from '../../../../eval/results/threshold-live.json'

export type SignalName = keyof typeof calibration.transfer.methods

export const shippedSignal = calibration.chosen as SignalName

export { calibration, endToEnd, sweep }
