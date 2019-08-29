const webpackConfig = require('@vapper/webpack-config')
const Service = require('@vue/cli-service')

module.exports = class Configer {
  constructor (api) {
    const { options } = api

    this.api = api
    this.mode = options.mode
    this.service = new Service(process.cwd())
    this.service.init(this.mode)
    this.service.webpackChainFns.push(this.baseChainFn.bind(this))

    this.serverChainFn = this.serverChainFn.bind(this)
    this.clientChainFn = this.clientChainFn.bind(this)
  }

  getServerConfig () {
    this.addFn(this.serverChainFn)
    const config = this.service.resolveWebpackConfig()
    this.removeFn(this.serverChainFn)
    return config
  }

  getClientConfig () {
    this.addFn(this.clientChainFn)
    const config = this.service.resolveWebpackConfig()
    this.removeFn(this.clientChainFn)
    return config
  }

  addFn (fn) {
    this.service.webpackChainFns.push(fn)
  }

  removeFn (fn) {
    this.service.webpackChainFns.splice(
      this.service.webpackChainFns.indexOf(fn),
      1
    )
  }

  baseChainFn (config) {
    webpackConfig.base(this.api, config)

    config
      .plugin('PrintStatusPlugin')
      .use(require('./PrintStatusPlugin'), [
        {
          printFileStats: true,
          logger: this.api.logger
        }
      ])

    config
      .plugin('friendly-errors')
      .init((Plugin, args) => new Plugin({ ...args, clearConsole: false }))

    config
      .entryPoints
      .delete('index')
  }

  serverChainFn (config) {
    webpackConfig.server(this.api, config)

    config
      .entry('app')
      .clear()
      .add(this.api.resolveCore('app/serverEntry.js'))
  }

  clientChainFn (config) {
    webpackConfig.client(this.api, config)
    config
      .entry('app')
      .clear()
      .when(!this.api.isProd, entry => entry.add(require.resolve('webpack-hot-middleware/client')))
      .add(this.api.resolveCore('app/clientEntry.js'))
  }
}
