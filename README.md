# impresso-middle-layer

>

## About

This project uses [Feathers](http://feathersjs.com). An open source web framework for building modern real-time applications.
We also use: SOlR, mysql, neo4j, redis.

## Getting Started

Getting up and running is as easy as 1, 2, 3, 4, 5.

1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
1. Install your dependencies

    ```
    git clone impresso-middle-layer
    cd path/to/impresso-middle-layer && npm install
    ```

1. Check that [redis](https://redis.io) is running.
1. (optionally) configure your mysql tunnelling, e.g. in with config stored in  `~/.ssh/config`:

    ```
    Host cli-mysql-tunnel
    HostName      host_secret
    User          host_user
    Port          host_port
    IdentityFile  /path/to/private/key
    LocalForward  3307 127.0.0.1:3306
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ```

    then run the tunnelling with autossh (note the name  `cli-mysql-tunnel`)

    ```
    nohup autossh -M 0 -T -N cli-mysql-tunnel &
    ```

    ref. [SSH TUNNELLING FOR FUN AND PROFIT: AUTOSSH](https://www.everythingcli.org/ssh-tunnelling-for-fun-and-profit-autossh/)

    You can also create a **service** using system d.

1. Configure the `config/development.json` and `config/production.json` according to your system settings
1. Preload the list of Newspaper and of the Topics.
    ```
    NODE_ENV=development DEBUG=impresso* npm run update-newspapers
    NODE_ENV=development DEBUG=impresso* npm run update-topics
    ```
1. Start the app! Use the env variable `NODE_ENV` to switch between your development or production configuration file.
    ```
    NODE_ENV=development DEBUG=impresso* npm run dev
    ```

## Deployment with forever
Make sure you have correctly set and tested the file `config/production.json` (is *.gitignored*).
You should create a `/path/to/forever.production.json` file:
```
{
  "uid": "impresso-middle-layer",
  "append": true,
  "watch": false,
  "script": "src/index.js",
  "sourceDir": "/path/to/impresso-middle-layer"
}
```
Then start with:
```
NODE_ENV=production forever start /path/to/forever.production.json
```

## Deployment with PM2
Install pm2, then [generate a template](https://pm2.io/doc/en/runtime/guide/ecosystem-file)
using the command `pm2 init` then edit the `ecosystem.config.js` file:

```
module.exports = {
  apps : [{
    name: 'impresso-middle-layer',
    cwd: '/path/to/impresso/impresso-middle-layer',
    script: 'src',

    //
    // args: 'one two',
    instances: 4,
    autorestart: false,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }],
}
```
Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run.

## Scaffolding

Feathers has a powerful command line interface. Here are a few things it can do:

```
$ npm install -g feathers-cli             # Install Feathers CLI

$ feathers generate service               # Generate a new Service
$ feathers generate hook                  # Generate a new Hook
$ feathers generate model                 # Generate a new Model
$ feathers help                           # Show all commands
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).

## Changelog

__1.0.0__

- Public release

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
