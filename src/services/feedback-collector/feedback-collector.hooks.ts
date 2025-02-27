import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { validate } from '../../hooks/params'

const FeedbackOptionContentItemMetadataIssue = 'ContentItemMetadataIssue'
const FeedbackOptionLayoutSegmentationIssue = 'LayoutSegmentationIssue'
const FeedbackOptionDocumentLoadingIssue = 'DocumentLoadingIssue'
const FeedbackOptionOtherIssue = 'OtherIssue'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    create: [
      validate(
        {
          // request must contain a name - from which we will create a UID
          issue: {
            required: false,
            choices: [
              FeedbackOptionContentItemMetadataIssue,
              FeedbackOptionLayoutSegmentationIssue,
              FeedbackOptionDocumentLoadingIssue,
              FeedbackOptionOtherIssue,
            ],
            defaultValue: FeedbackOptionOtherIssue,
          },
          content: {
            max_length: 500,
          },
          route: {
            max_length: 500,
          },
        },
        'POST'
      ),
    ],
  },
}
