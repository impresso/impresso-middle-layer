const debug = require('debug')('impresso/channels')

export default function (app) {
  debug('preparing channels...')
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    debug('no real-time functionality has been configured!')
    return
  }
  debug('channels ready')

  app.service('logs').publish((payload) => {
    // console.log('MESSAGG', payload);
    debug('log to')
    return app.channel(`logs/${payload.to}`)
  })

  app.on('connection', (connection) => {
    // On a new real-time connection, add it to the anonymous channel
    debug('new realtime connection!', connection)
    app.channel('anonymous').join(connection)
  })

  app.on('login', (authResult, { connection }) => {
    // connection can be undefined if there is no
    // real-time connection, e.g. when logging in via REST
    if (connection && connection.user) {
      // Obtain the logged in user from the connection
      const user = connection.user
      debug('@login', user.uid)

      // The connection is no longer anonymous, remove it
      app.channel('anonymous').leave(connection)

      // Add it to the authenticated user channel
      app.channel('authenticated').join(connection)

      // join a nice channel
      app.channel(`logs/${user.uid}`).join(connection)

      // Channels can be named anything and joined on any condition
      app.service('logs').create({
        msg: 'welcome to your channel. Here you will receive your notifications',
        to: user.uid,
        from: 'logs',
      })

      // Easily organize users by email and userid for things like messaging
      // app.channel(`userIds/${user._id}`).join(connection)
    }
  })

  app.on('logout', (payload, socket) => {
    // }, { socket: { _feathers: connection } }) => {
    if (payload.user) {
      debug('@logout received for user:', payload.user.username)
    } else {
      debug('@logout received, no payload?', payload, socket)
    }

    if (socket.connection) {
      // When logging out, leave all channels before joining anonymous channel
      if (socket.connection.user && socket.connection.user.uid) {
        debug(
          '@logout (leaving private logs) for user:',
          socket.connection.user.username
        )
        app
          .channel(`logs/${socket.connection.user.uid}`)
          .leave(socket.connection)
      }
      app.channel('authenticated').leave(socket.connection)
      // debug('@logout (reconnecting with anonymous channel) for anonymous user.')
      app.channel('anonymous').join(socket.connection)
    }
  })
}
