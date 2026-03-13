import { ContentItemFacet } from '@/data/constants.js'

export type SuggestionType =
  | Extract<ContentItemFacet, 'person' | 'location' | 'organization' | 'nag' | 'topic' | 'collection'>
  | 'mention'
  | 'newspaper'

interface ITyped<T> {
  type: T
}

export interface ISuggestion<T> extends ITyped<SuggestionType> {
  q: string
  h: string
  type: SuggestionType
  item?: T
  weight?: number
}

export class Suggestion<T> implements ISuggestion<T> {
  q: string
  h: string
  type: SuggestionType
  item?: T
  weight?: number

  constructor({
    type,
    // the text for the search query, cleaned. E.g, Suiss
    q = '',
    // the query, with the matching part highlighted with html like SOLR.
    // E.g., "<b>Suis</b>se"
    h = '',
    // a shipped item, e.g. the NamedEntity for Suisse. Can be null
    item = undefined,
    weight = -1,
  }: ISuggestion<T>) {
    this.q = String(q)
    this.h = String(h)
    if (item) {
      this.item = item
    }
    this.type = type
    if (weight !== -1) {
      this.weight = weight
    }
  }
}

export interface IDateRangeSuggestion extends ITyped<'daterange'> {
  type: 'daterange'
  context: 'include'
  daterange: string
  text?: string
}

export const isDateRangeSuggestion = (suggestion?: ITyped<any>): suggestion is IDateRangeSuggestion => {
  return suggestion?.type === 'daterange'
}

export interface IRegexSuggestion extends ITyped<'regex'> {
  type: 'regex'
  q: string
  context: 'include'
}

export const isRegexSuggestion = (suggestion?: ITyped<any>): suggestion is IRegexSuggestion => {
  return suggestion?.type === 'regex'
}

export const isDefaultSuggestion = (suggestion?: ITyped<any>): suggestion is ISuggestion<any> => {
  return (
    suggestion !== undefined &&
    !isDateRangeSuggestion(suggestion) &&
    !isRegexSuggestion(suggestion) &&
    'q' in suggestion &&
    'h' in suggestion &&
    'type' in suggestion
  )
}

export const isSuggestion = (suggestion?: ITyped<any>): suggestion is ISuggestion<any> => {
  return isDateRangeSuggestion(suggestion) || isRegexSuggestion(suggestion) || isDefaultSuggestion(suggestion)
}
