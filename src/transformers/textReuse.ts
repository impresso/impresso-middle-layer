import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '../models/authorization'
import { TextReusePassage as TextReusePassageInternal, TextReuseClusterCompound } from '../models/generated/schemas'
import { TextReusePassage as TextReusePassagePublic, TextReuseCluster } from '../models/generated/schemasPublic'

export const transformTextReusePassage = (input: TextReusePassageInternal): TextReusePassagePublic => {
  return {
    uid: input.id,
    content: input.content,
    contentItemId: input.article.id,
    offset: {
      start: input.offsetStart ?? 0,
      end: input.offsetEnd ?? 0,
    },
    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt(input.bitmapExplore ?? 0),
      getTranscript: BigInt(input.bitmapGetTranscript ?? 0),
    } satisfies AuthorizationBitmapsDTO,
  }
}

export const transformTextReuseCluster = (input: TextReuseClusterCompound): TextReuseCluster => {
  return {
    uid: input.cluster?.id!,
    clusterSize: input.cluster?.clusterSize!,
    lexicalOverlap: input.cluster?.lexicalOverlap!,
    textSample: input.textSample,
    timeCoverage: {
      startDate: input.cluster?.timeCoverage?.from!,
      endDate: input.cluster?.timeCoverage?.to!,
    },
    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt(input.bitmapExplore ?? 0),
      getTranscript: BigInt(input.bitmapGetTranscript ?? 0),
    } satisfies AuthorizationBitmapsDTO,
  }
}
