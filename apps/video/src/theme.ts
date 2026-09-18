import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'

const inter = loadInter('normal', { weights: ['400', '500', '600'], subsets: ['latin'] })
const mono = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] })

export const FONT = inter.fontFamily
export const MONO = mono.fontFamily

export const PAGE = '#07070a'
export const TEXT = 'rgb(255 255 255 / 0.95)'
export const DIM = 'rgb(255 255 255 / 0.55)'
export const FAINT = 'rgb(255 255 255 / 0.35)'
export const LINE = 'rgb(255 255 255 / 0.08)'
export const TRACK = 'rgb(255 255 255 / 0.08)'
export const WINDOW = 'rgb(32 32 35 / 0.92)'
export const EDGE = 'rgb(255 255 255 / 0.12)'
export const ACCENT = '#ff9f43'
export const GREEN = '#59d499'

export const ROLE_COLOR: Record<string, string> = {
  O: DIM,
  FIELD: '#56c2ff',
  OP: DIM,
  NEG: '#ff6363',
  VAL_ENUM: GREEN,
  VAL_PERSON: '#ffd60a',
  VAL_DATE: '#cf8eff',
  VAL_NUM: '#56c2ff',
  VAL_TEXT: '#ff8ad8',
  SORT: DIM,
  DIR: DIM,
  LIMIT: DIM,
  OR: DIM,
}

export const ROLE_NAME: Record<string, string> = {
  O: 'noise',
  FIELD: 'field',
  OP: 'operator',
  NEG: 'negation',
  VAL_ENUM: 'category',
  VAL_PERSON: 'person',
  VAL_DATE: 'date',
  VAL_NUM: 'number',
  VAL_TEXT: 'topic',
  SORT: 'sort',
  DIR: 'direction',
  LIMIT: 'limit',
  OR: 'or',
}
