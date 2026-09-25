import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import type { ServiceOptions } from '@feathersjs/feathers'
import swagger from 'feathers-swagger'
import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getDocs } from '@/services/partner-audit-logs/partner-audit-logs.schema.js'

interface SpecResponse {
  content?: Record<string, unknown>
}
interface SpecDocument {
  paths: Record<string, Record<string, { responses?: Record<string, SpecResponse> }>>
}

class StubService {
  async get() {
    return {}
  }
}

const buildAppWithSpec = (docs?: ServiceSwaggerOptions): SpecDocument => {
  const app = feathers()
  app.configure(
    swagger({
      openApiVersion: 3,
      specs: {
        info: { title: 'test', version: '1.0.0' },
        components: { schemas: {} },
      },
    })
  )
  app.use('/partner-audit-logs', new StubService(), { events: [], docs } as ServiceOptions)
  // the generator adds the specs under `docs` (default `appProperty`)
  return (app as unknown as { docs: SpecDocument }).docs
}

describe('partner-audit-logs swagger specification', () => {
  it('without docs option feathers-swagger generates a broken default entry', () => {
    // documents the pitfall: an auto-generated 200 response references a
    // non-existent `partner-audit-logs` component schema
    const spec = buildAppWithSpec()

    const getOperation = spec.paths['/partner-audit-logs/{id}']?.get
    assert.ok(getOperation != null)
    assert.deepEqual(
      getOperation.responses?.[200]?.content?.['application/json'],
      { schema: { $ref: '#/components/schemas/partner-audit-logs' } }
    )
  })

  it('with `operations: { get: false }` the service is hidden from the spec', () => {
    const spec = buildAppWithSpec({ operations: { get: false } })

    assert.equal(spec.paths['/partner-audit-logs/{id}'], undefined)
  })

  it('with the internal docs the get operation serves the zip archive', () => {
    const spec = buildAppWithSpec(createSwaggerServiceOptions({ schemas: {}, docs: getDocs() }))

    const getOperation = spec.paths['/partner-audit-logs/{id}']?.get
    assert.ok(getOperation != null)
    assert.ok(getOperation.responses?.[200]?.content?.['application/zip'] != null)
  })
})
