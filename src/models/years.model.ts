export interface IWeights {
  c?: number
  a?: number
  p?: number
  i?: number
  m?: number
}

export interface IYear {
  y: number
  values?: IWeights
  refs?: IWeights
}

interface WeightsOptions {
  c?: string
  a?: string
  p?: string
  i?: string
  m?: string
}

class Weights implements IWeights {
  c?: number
  a?: number
  p?: number
  i?: number
  m?: number

  constructor({
    // number of content items
    c,
    // number of articles
    a,
    // number of pages
    p,
    // number of issues
    i,
    // number of images (with or without vectors),
    m,
  }: WeightsOptions | IWeights = {}) {
    if (typeof c !== 'undefined') {
      this.c = typeof c === 'number' ? c : parseFloat(c)
    }
    if (typeof a !== 'undefined') {
      this.a = typeof a === 'number' ? a : parseFloat(a)
    }
    if (typeof p !== 'undefined') {
      this.p = typeof p === 'number' ? p : parseFloat(p)
    }
    if (typeof i !== 'undefined') {
      this.i = typeof i === 'number' ? i : parseFloat(i)
    }
    if (typeof m !== 'undefined') {
      this.m = typeof m === 'number' ? m : parseFloat(m)
    }
  }
}

interface YearOptions {
  y: string
  values?: Weights | IWeights | WeightsOptions
  refs?: Weights | IWeights
}

export default class Year implements IYear {
  y: number
  values?: Weights
  refs?: Weights
  norm?: Weights

  constructor({ y, values = undefined, refs = undefined }: YearOptions = { y: String(0) }) {
    this.y = parseInt(y, 10)
    // values
    if (values) {
      this.values = values instanceof Weights ? values : new Weights(values)
    }
    // reference values to calculate percentage
    if (refs) {
      this.refs = refs instanceof Weights ? refs : new Weights(refs)
    }

    if (refs && values) {
      this.norm = this.normalize()
    }
  }

  /**
   * Normalize values against a specific weight
   * @return {Weights} new Weights instances with normalized values
   */
  normalize(): Weights {
    const normalized: IWeights = {}
    const availableKeys = Object.keys(this.values ?? {}) as (keyof IWeights)[]
    availableKeys.forEach(k => {
      if (typeof this.refs?.[k] === 'undefined' || this.refs?.[k] === 0) {
        normalized[k] = 0
      } else {
        normalized[k] = (this.values?.[k] ?? 0) / this.refs[k]
      }
    })
    return new Weights(normalized)
  }
}
