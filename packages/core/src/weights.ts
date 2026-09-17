import { MANIFEST, WEIGHTS_B64 } from './weights.gen.ts'

export type ConfidenceSignal = 'softmax' | 'entropy' | 'head'

export interface Weights {
  width: number
  roleCount: number
  featureCount: number
  layers: number
  temperature: number
  confidence: ConfidenceSignal
  tensors: Record<string, Float32Array>
}

export interface TensorEntry {
  name: string
  shape: readonly number[]
  offset: number
}

export interface Manifest {
  d: number
  layers: number
  features: number
  roles: readonly string[]
  temperature: number
  confidence: string
  tensors: readonly TensorEntry[]
}

const BITS_PER_VALUE = 6
const VALUES_PER_GROUP = 4
const BYTES_PER_GROUP = 3
const VALUE_MASK = 63
const ZERO_POINT = 32
const BYTES_PER_FLOAT = 4

function readBias(view: DataView, entry: TensorEntry): Float32Array {
  const bias = new Float32Array(entry.shape[0])
  for (let i = 0; i < bias.length; i++) {
    bias[i] = view.getFloat32(entry.offset + BYTES_PER_FLOAT * i, true)
  }
  return bias
}

function readQuantizedMatrix(bytes: Uint8Array, view: DataView, entry: TensorEntry) {
  const [rows, columns] = entry.shape
  const packedStart = entry.offset + BYTES_PER_FLOAT * rows
  const matrix = new Float32Array(rows * columns)

  for (let i = 0; i < matrix.length; i++) {
    const group = packedStart + BYTES_PER_GROUP * Math.floor(i / VALUES_PER_GROUP)
    const packed = bytes[group] | (bytes[group + 1] << 8) | (bytes[group + 2] << 16)
    const shift = BITS_PER_VALUE * (i % VALUES_PER_GROUP)
    const quantized = ((packed >> shift) & VALUE_MASK) - ZERO_POINT
    const row = Math.floor(i / columns)
    const scale = view.getFloat32(entry.offset + BYTES_PER_FLOAT * row, true)
    matrix[i] = quantized * scale
  }
  return matrix
}

export function decode(bytes: Uint8Array, manifest: Manifest): Weights {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tensors: Record<string, Float32Array> = {}
  for (const entry of manifest.tensors) {
    const isMatrix = entry.shape.length === 2
    tensors[entry.name] = isMatrix ? readQuantizedMatrix(bytes, view, entry) : readBias(view, entry)
  }
  return {
    width: manifest.d,
    roleCount: manifest.roles.length,
    featureCount: manifest.features,
    layers: manifest.layers,
    temperature: manifest.temperature,
    confidence: manifest.confidence as ConfidenceSignal,
    tensors,
  }
}

let bundled: Weights | undefined

export function defaultWeights(): Weights {
  if (!bundled) {
    const bytes = Uint8Array.from(atob(WEIGHTS_B64), char => char.charCodeAt(0))
    bundled = decode(bytes, MANIFEST)
  }
  return bundled
}

export function parameterCount(weights: Weights): number {
  return Object.values(weights.tensors).reduce((total, tensor) => total + tensor.length, 0)
}
