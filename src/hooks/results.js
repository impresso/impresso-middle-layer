const debug = require('debug')('impresso/hooks:results')

const asParamsWithUidFilter = (uids, extra) => {
  return {
    query: {
      filters: [
        {
          type: 'uid',
          q: uids,
        },
      ],
      uids,
      limit: uids.length,
    },
    ...extra,
  }
}

/**
 * If a service is given, context.result.toBeResolved
 * will be filtered for serivce
 * @param  {[type]} service optional;
 * @return {[type]}         [description]
 */
const resolve = service => async context => {
  if (context.result.toBeResolved && context.result.toBeResolved.length) {
    if (service) {
      context.result.toBeResolved = context.result.toBeResolved.filter(d => d.service === service)
    }
    debug(`resolve: ${context.result.toBeResolved.length} services to resolve`, context.result.toBeResolved)

    // context.result.resolved = await Promise.all(context.result.toBeResolved.map(d => context.app.service(d.service).get(d.uids.join(','), {
    context.result.resolved = await Promise.all(
      context.result.toBeResolved.map(d =>
        context.app
          .service(d.service)
          // using `findInternal` to avoid hooks
          .findInternal(
            asParamsWithUidFilter(d.uids, {
              authenticated: context.params.authenticated,
              user: context.params.user,
              findAll: true,
              query: {
                limit: d.uids.length,
              },
            })
          )
          .then(results => {
            return {
              service: d.service,
              data: results.data,
            }
          })
      )
    )
    // delete context.result.toBeResolved;
  } else {
    debug('resolve: result.toBeResolved, nothing to resolve.')
  }
}

module.exports = {
  resolve,
}
