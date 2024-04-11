interface StatusResponse {
  description: string
  content?: string | object
}

const jsonSchemaRef = (ref: string) => {
  return {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/${ref}`,
      },
    },
  }
}

const defaultErrorSchema = jsonSchemaRef('defaultErrorResponse')

interface GetStandardResponsesParams {
  method: 'create' | 'update' | 'patch' | 'remove' | 'find' | 'get'
  schema: string
  authEnabled?: boolean
  isRateLimited?: boolean
}

export const getStandardResponses = ({
  method,
  schema,
  authEnabled = true,
  isRateLimited = false,
}: GetStandardResponsesParams) => {
  const defaultResponses: Record<number, StatusResponse> = {
    500: {
      description: 'general error',
    },
  }
  if (method === 'create') {
    defaultResponses[201] = {
      description: 'Created',
      content: typeof schema === 'string' ? jsonSchemaRef(schema) : schema,
    }
  } else {
    defaultResponses[200] = {
      description: 'Success',
      content: typeof schema === 'string' ? jsonSchemaRef(schema) : schema,
    }
    defaultResponses[404] = {
      description: 'Not Found',
      content: defaultErrorSchema,
    }
  }

  if (authEnabled) {
    defaultResponses[401] = {
      description: 'Not Authenticated',
      content: defaultErrorSchema,
    }
    defaultResponses[403] = {
      description: 'Unauthorized',
      content: defaultErrorSchema,
    }
  }

  if (isRateLimited) {
    defaultResponses[429] = {
      description: 'Rate limit exceeded',
      content: defaultErrorSchema,
    }
  }

  return defaultResponses
}
