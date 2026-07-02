import { strict as assert } from 'assert'
import {
  fetchPartnerInstitutionsDirectory,
  getPartnerInstitutionsDirectory,
  PartnerInstitutionsDirectoryUrl,
} from '@/internalServices/partnerInstitutionsDirectory.js'
import type { ImpressoApplication } from '@/types.js'

const validDirectory = [
  {
    partner_institution_id: 'BNL',
    partner_institution_names: [{ lang: 'en', name: 'National Library of Luxembourg' }],
    partner_bitmap_index: 2,
  },
]

describe('partner institutions directory', () => {
  it('fetches the upstream master file and parses the directory', async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      assert.equal(String(url), PartnerInstitutionsDirectoryUrl)
      return new Response(JSON.stringify(validDirectory), { status: 200 })
    }

    const result = await fetchPartnerInstitutionsDirectory(fetchImpl as typeof fetch)

    assert.deepStrictEqual(result, validDirectory)
  })

  it('rejects unsuccessful upstream responses', async () => {
    const fetchImpl = async () => new Response('Not found', { status: 404 })

    await assert.rejects(
      fetchPartnerInstitutionsDirectory(fetchImpl as typeof fetch),
      /Failed to fetch partner institutions directory: HTTP 404/
    )
  })

  it('rejects unexpected upstream JSON', async () => {
    const fetchImpl = async () => new Response(JSON.stringify([{ partner_institution_id: 'BNL' }]), { status: 200 })

    await assert.rejects(
      fetchPartnerInstitutionsDirectory(fetchImpl as typeof fetch),
      /Unexpected partner institutions directory format/
    )
  })

  it('reads the cached directory from the app', () => {
    const app = {
      get: (key: string) => (key === 'partnerInstitutionsDirectory' ? validDirectory : undefined),
    } as ImpressoApplication

    assert.deepStrictEqual(getPartnerInstitutionsDirectory(app), validDirectory)
  })
})
