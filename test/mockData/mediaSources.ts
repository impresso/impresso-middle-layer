import { MediaSource } from '@/models/generated/canonical.js'

export const GDL: MediaSource = {
  id: 'GDL',
  type: 'newspaper',
  name: 'Gazette de Lausanne',
  languageCodes: ['fr'],
  totals: {
    articles: 12,
    issues: 4,
    pages: 48,
  },
  publishedPeriodYears: [1800, 1804],
  availableDatesRange: ['1800-01-01', '1804-12-31'],
}

export const JDG: MediaSource = {
  id: 'JDG',
  type: 'newspaper',
  name: 'Journal de Geneve',
  publishedPeriodYears: [1826, 1828],
  availableDatesRange: ['1826-01-02', '1828-11-30'],
  languageCodes: ['fr'],
  totals: {
    articles: 7,
    issues: 3,
    pages: 21,
  },
  properties: undefined,
}

export const Fronde: MediaSource = {
  id: 'Fronde',
  type: 'newspaper',
  name: 'La Fronde',
  publishedPeriodYears: [1872, 1872],
  availableDatesRange: ['1872-03-17T00:00:00.000Z', '1872-12-25T00:00:00.000Z'],
  totals: {
    articles: 211,
    issues: 28,
    pages: 220,
  },
  languageCodes: ['fr'],
  properties: [
    {
      label: 'country code',
      value: 'CH',
      id: 'countryCode',
    },
  ],
}
