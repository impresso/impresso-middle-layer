/**
 * From deprecated `socks` module, which is no longer maintained.
 */

import stream from 'stream'
import util from 'util'
import net from 'net'
import tls from 'tls'
import ipaddr from 'ipaddr.js'

const SocksConnection = function (remoteOptions, socksOptions) {
  const that = this

  stream.Duplex.call(this)

  this.remoteOptions = defaults(remoteOptions, {
    host: 'localhost',
    ssl: false,
    rejectUnauthorized: false,
  })
  socksOptions = defaults(socksOptions, {
    localAddress: '0.0.0.0',
    allowHalfOpen: false,
    host: 'localhost',
    port: 1080,
    user: null,
    pass: null,
  })

  this._socksSetup = false

  this.socksAddress = null
  this.socksPort = null

  this.socksSocket = net.createConnection(
    {
      host: socksOptions.host,
      port: socksOptions.port,
      localAddress: socksOptions.localAddress,
      allowHalfOpen: socksOptions.allowHalfOpen,
    },
    socksConnected.bind(this, !!socksOptions.user)
  )

  this.socksSocket.on('error', function (err) {
    that.emit('error', err)
  })

  socksAuth.call(this, { user: socksOptions.user, pass: socksOptions.pass })

  this.outSocket = this.socksSocket
}

util.inherits(SocksConnection, stream.Duplex)

SocksConnection.connect = function (remoteOptions, socksOptions, connectionListener) {
  const socksConnection = new SocksConnection(remoteOptions, socksOptions)
  if (typeof connectionListener === 'function') {
    socksConnection.on('connect', connectionListener)
  }
  return socksConnection
}

SocksConnection.prototype._read = function () {
  let data
  if (this._socksSetup) {
    while ((data = this.outSocket.read()) !== null) {
      if (this.push(data) === false) {
        break
      }
    }
  } else {
    this.push('')
  }
}

SocksConnection.prototype._write = function (chunk, encoding, callback) {
  if (this._socksSetup) {
    this.outSocket.write(chunk, 'utf8', callback)
  } else {
    // eslint-disable-next-line n/no-callback-literal
    callback('Not connected')
  }
}

SocksConnection.prototype.dispose = function () {
  this.outSocket.destroy()
  this.outSocket.removeAllListeners()
  if (this.outSocket !== this.socksSocket) {
    this.socksSocket.destroy()
    this.socksSocket.removeAllListeners()
  }
  this.removeAllListeners()
}

const getData = function (socket, bytes, callback) {
  const dataReady = function () {
    const data = socket.read(bytes)
    if (data !== null) {
      socket.removeListener('readable', dataReady)
      callback(data)
    } else {
      socket.on('readable', dataReady)
    }
  }
  dataReady()
}

const socksConnected = function (auth) {
  if (auth) {
    this.socksSocket.write('\x05\x02\x02\x00') // SOCKS version 5, supporting two auth methods
    // username/password and 'no authentication'
  } else {
    this.socksSocket.write('\x05\x01\x00') // SOCKS version 5, only supporting 'no auth' scheme
  }
}

const socksAuth = function (auth) {
  const that = this
  getData(this.socksSocket, 2, function (data) {
    if (data.readUInt8(0) !== 5) {
      that.emit('error', 'Only SOCKS version 5 is supported')
      that.socksSocket.destroy()
      return
    }
    switch (data.readUInt8(1)) {
      case 255:
        that.emit('error', 'SOCKS: No acceptable authentication methods')
        that.socksSocket.destroy()
        return
      case 2:
        that.socksSocket.write(
          Buffer.concat([
            Buffer.from([1]),
            Buffer.from([Buffer.byteLength(auth.user)]),
            Buffer.from(auth.user),
            Buffer.from([Buffer.byteLength(auth.pass)]),
            Buffer.from(auth.pass),
          ])
        )
        socksAuthStatus.call(that)
        break
      default:
        socksRequest.call(that, that.remoteOptions.host, that.remoteOptions.port)
    }
  })
}

const socksAuthStatus = function (data) {
  const that = this
  getData(this.socksSocket, 2, function (data) {
    if (data.readUInt8(1) === 0) {
      socksRequest.call(that, that.remoteOptions.host, that.remoteOptions.port)
    } else {
      that.emit('error', 'SOCKS: Authentication failed')
      that.socksSocket.destroy()
    }
  })
}

const socksRequest = function (host, port) {
  let type, hostBuf
  if (net.isIP(host)) {
    if (net.isIPv4(host)) {
      type = Buffer.from([1])
    } else if (net.isIPv6(host)) {
      type = Buffer.from([4])
    }
    hostBuf = Buffer.from(ipaddr.parse(host).toByteArray())
  } else {
    type = Buffer.from([3])
    hostBuf = Buffer.from(host)
    hostBuf = Buffer.concat([Buffer.from([Buffer.byteLength(host)]), hostBuf])
  }
  const header = Buffer.from([5, 1, 0])
  const portBuf = Buffer.alloc(2)
  portBuf.writeUInt16BE(port, 0)
  this.socksSocket.write(Buffer.concat([header, type, hostBuf, portBuf]))
  socksReply.call(this)
}

const socksReply = function (data) {
  const that = this
  getData(this.socksSocket, 4, function (data) {
    let err

    const cont = function (addr, port) {
      that.socksAddress = addr
      that.socksPort = port

      if (that.remoteOptions.ssl) {
        startTLS.call(that)
      } else {
        proxyData.call(that)
        that.emit('connect')
      }
    }
    const status = data.readUInt8(1)
    if (status === 0) {
      switch (data.readUInt8(3)) {
        case 1:
          getData(that.socksSocket, 6, function (data2) {
            let addr = ''
            let i
            for (i = 0; i < 4; i++) {
              if (i !== 0) {
                addr += '.'
              }
              addr += data2.readUInt8(i).toString()
            }
            const port = data2.readUInt16BE(4)
            cont(addr, port)
          })
          break
        case 3:
          getData(that.socksSocket, 1, function (data2) {
            const length = data2.readUInt8(0)
            getData(that.socksSocket, length + 2, function (data3) {
              const addr = data3.slice(0, -2).toString()
              const port = data3.readUInt16BE(length)
              cont(addr, port)
            })
          })
          break
        case 4:
          getData(that.socksSocket, 18, function (data2) {
            let addr = ''
            let i
            for (i = 0; i < 16; i++) {
              if (i !== 0) {
                addr += ':'
              }
              addr += data2.readUInt8(i)
            }
            const port = data2.readUInt16BE(16)
            cont(addr, port)
          })
          break
        default:
          that.emit('error', 'Invalid address type')
          that.socksSocket.destroy()
          break
      }
    } else {
      switch (status) {
        case 1:
          err = 'SOCKS: general SOCKS server failure'
          break
        case 2:
          err = 'SOCKS: Connection not allowed by ruleset'
          break
        case 3:
          err = 'SOCKS: Network unreachable'
          break
        case 4:
          err = 'SOCKS: Host unreachable'
          break
        case 5:
          err = 'SOCKS: Connection refused'
          break
        case 6:
          err = 'SOCKS: TTL expired'
          break
        case 7:
          err = 'SOCKS: Command not supported'
          break
        case 8:
          err = 'SOCKS: Address type not supported'
          break
        default:
          err = 'SOCKS: Unknown error'
      }
      that.emit('error', err)
    }
  })
}

const startTLS = function () {
  const that = this
  const plaintext = tls.connect({
    socket: this.socksSocket,
    rejectUnauthorized: this.remoteOptions.rejectUnauthorized,
    key: this.remoteOptions.key,
    cert: this.remoteOptions.cert,
    requestCert: this.remoteOptions.requestCert,
  })

  plaintext.on('error', function (err) {
    that.emit('error', err)
  })

  plaintext.on('secureConnect', function () {
    that.emit('connect')
  })

  this.outSocket = plaintext
  this.getPeerCertificate = function () {
    return plaintext.getPeerCertificate()
  }

  proxyData.call(this)
}

const proxyData = function () {
  const that = this

  this.outSocket.on('readable', function () {
    let data
    while ((data = that.outSocket.read()) !== null) {
      if (that.push(data) === false) {
        break
      }
    }
  })

  this.outSocket.on('end', function () {
    that.push(null)
  })

  this.outSocket.on('close', function (hadErr) {
    that.emit('close', hadErr)
  })

  this._socksSetup = true
}

const defaults = function (obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function (source) {
    if (source) {
      for (const prop in source) {
        if (obj[prop] === null) {
          obj[prop] = source[prop]
        }
      }
    }
  })
  return obj
}

export default SocksConnection
