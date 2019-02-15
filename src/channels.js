const debug = require('debug')('impresso/channels');

module.exports = function (app) {
  debug('preparing channels...');
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    debug('no real-time functionality has been configured!');
    return;
  }
  debug('channels ready');

  app.service('logs').publish((payload, context) => {
    console.log('MESSAGG', payload);
    debug('log to');
    return app.channel(`logs/${payload.to}`);
  });

  app.on('connection', (connection) => {
    // On a new real-time connection, add it to the anonymous channel
    debug('new realtime connection!', connection);
    app.channel('anonymous').join(connection);
  });

  app.on('login', (authResult, { connection }) => {
    // connection can be undefined if there is no
    // real-time connection, e.g. when logging in via REST
    if (connection && connection.user) {
      // Obtain the logged in user from the connection
      const user = connection.user;
      debug('@login', user.uid);

      // The connection is no longer anonymous, remove it
      app.channel('anonymous').leave(connection);

      // Add it to the authenticated user channel
      app.channel('authenticated').join(connection);

      // join a nice channel
      app.channel(`logs/${user.uid}`).join(connection);

      // Channels can be named anything and joined on any condition
      app.service('logs').create({
        msg: 'welcome to your channel. Here you will receive your notifications',
        to: user.uid,
        from: 'logs',
      });

      // Easily organize users by email and userid for things like messaging
      // app.channel(`userIds/${user._id}`).join(connection)
    }
  });


  app.on('logout', (payload, { socket: { _feathers: connection }}) => {
    // We currently use the soultion found at: https://github.com/feathersjs/feathers/issues/941
    if (connection) {
      const user = connection.user;
      debug('@logout', connection.payload);
      // When logging out, leave all channels before joining anonymous channel
      if(user && user.uid) {
        app.channel(`logs/${user.uid}`).leave(connection);
      }
      app.channel('authenticated').leave(connection);
      app.channel('anonymous').join(connection);
    }
  });
};
