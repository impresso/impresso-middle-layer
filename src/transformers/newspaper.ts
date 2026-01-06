import { Newspaper as NewspaperInternal } from '@/models/generated/schemas.js'
import { Newspaper as NewspaperPublic } from '@/models/generated/schemasPublic.js'

export const transformNewspaper = (input: NewspaperInternal): NewspaperPublic => {
  return {
    uid: input.uid,
    title: input.name,
    startYear: input.startYear ?? undefined,
    endYear: input.endYear ?? undefined,
    languageCodes: input.languages,
    totalArticles: input.countArticles >= 0 ? input.countArticles : 0,
    totalIssues: input.countIssues >= 0 ? input.countIssues : 0,
    totalPages: input.countPages >= 0 ? input.countPages : 0,
  }
}
