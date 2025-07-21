import { NotFound, NotImplemented } from '@feathersjs/errors'
import { ClientService } from '@feathersjs/feathers'
import debug from 'debug'
import { protobuf } from 'impresso-jscommons'
import { Sequelize } from 'sequelize'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import Collection from '../../models/collections.model'
import { FindResponse } from '../../models/common'
import { ContentItem } from '../../models/generated/schemas/contentItem'
import Job from '../../models/jobs.model'
import { ImpressoApplication } from '../../types'
import { FindOptions } from '../content-items/content-items.class'

const debugLog = debug('impresso/services:search')

type SearchService = Pick<ClientService<ContentItem, unknown, unknown, FindResponse<ContentItem>>, 'find'>

class Service implements SearchService {
  solr: SimpleSolrClient
  sequelize: Sequelize

  constructor(private readonly app: ImpressoApplication) {
    this.app = app
    this.solr = app.service('simpleSolrClient')
    this.sequelize = app.get('sequelizeClient')!
  }

  /**
   * Proxy for `content-items.find()`.
   * Used in the public API.
   */
  async find(params: FindOptions) {
    return await this.app.service('content-items').find(params)
  }

  /**
   * @todo Move this method to a dedicated service. This method is not typed after conversion from JS.
   *
   * Save current search and return the corrseponding searchQuery
   */
  async create(data: any, params: any) {
    const client = this.app.get('celeryClient')
    if (!client) {
      return {}
    }

    // quickly save the data!
    const q = data.sanitized.sq
    const taskname = data.sanitized.taskname
    const sq = protobuf.searchQuery.serialize({
      filters: data.sanitized.filters,
    })
    // create new search query :TODO
    debugLog(
      `[create] taskname ${taskname} from solr query: ${q} from user:${params.user.uid} collection_uid: ${data.sanitized.collection_uid}`
    )
    // check if the user has jobs running
    const jobKlass = Job.sequelize(this.sequelize)
    const runningJobs = await jobKlass.count({
      where: {
        creatorId: params.user.id,
        status: 'RUN',
      },
    })
    if (runningJobs > 0) {
      throw new NotImplemented(`too many jobs running: ${runningJobs}`)
    }
    const collectionKlass = Collection.sequelize(this.sequelize)
    // check if the collection exists
    const collection = await collectionKlass.findOne({
      where: {
        uid: data.sanitized.collection_uid,
        creatorId: params.user.id,
      },
    })
    if (!collection) {
      throw new NotFound()
    }

    // Celery task:
    // def add_to_collection_from_query(
    //     self, collection_id, user_id, query, content_type,
    //     fq=None, serialized_query=None
    // ):
    return client
      .run({
        task: `impresso.tasks.${taskname}`,
        args: [
          // collection_uid
          data.sanitized.collection_uid,
          // user id
          params.user.id,
          // query
          q,
          // content_type, A for article
          'A',
          // fq
          '',
          // serialized query, for future use
          sq,
        ],
      })
      .catch(err => {
        if (err.result.exc_type === 'DoesNotExist') {
          // probably collection does not exist
          debugLog('[create] impresso.tasks.add_to_collection_from_query DoesNotExist.', err)
          throw new NotFound(err.result.exc_message)
        } else if (err.result.exc_type === 'OperationalError') {
          // probably db is not available
          debugLog('[create] impresso.tasks.add_to_collection_from_query OperationalError.', err)
          throw new NotImplemented()
        }
        debugLog('[create] impresso.tasks.add_to_collection_from_query ERROR.', err)
        throw new NotImplemented()
      })
      .then(res => {
        debugLog('[create] impresso.tasks.add_to_collection_from_query SUCCESS.', res)
        return {}
      })
  }
}

export { Service }
