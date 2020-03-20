const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const dotenv = require('dotenv')
const notifier = require('node-notifier')

class PluginApi extends EventEmitter {
  constructor () {
    super()
    // path
    this.cwd = process.cwd()
    this.corePath = path.resolve(__dirname, '../')

    // server middlewares
    this.middlewares = {
      'before:setup': new Set(),
      'before:render': new Set(),
      'after:render': new Set(),
      'after:setup': new Set()
    }
    this.allowMiddlewareTypes = [
      'before:render',
      'after:render',
      'before:setup',
      'after:setup'
    ]

    // Enhance
    this.enhanceFiles = new Set()
    this.enhanceTemplate = fs.readFileSync(this.resolveCore('app/enhance.template.ejs'), 'utf-8')
    this.enhanceClientOutput = this.resolveCore('app/.vapper/enhanceClient.js')
    this.enhanceServerOutput = this.resolveCore('app/.vapper/enhanceServer.js')

    this.webpackChainFns = []

    // ENV_OBJECT
    this.ENV_OBJECT = {}

    this.hooks = new Map()
  }

  chainWebpack (fn) {
    this.webpackChainFns.push(fn)
  }

  addEnhanceFile (enhance) {
    // TODO: Check the validity of the enhance parameter
    /**
     * interface enhanceObj {
     *    client: string
     *    clientOptions: object
     *    server: string
     *    serverOptions: object
     *    needCompile: boolean
     * }
     */
    this.enhanceFiles.add(enhance)
  }

  /**
   * Resolve the directory from the `packages/core`
   * @param  {...any} args - paths
   */
  resolveCore (...args) {
    return path.resolve(this.corePath, ...args)
  }

  /**
   * Resolve the directory from CWD
   * @param  {...any} args - paths
   */
  resolveCWD (...args) {
    return path.resolve(this.cwd, ...args)
  }

  /**
   * Pick out the dependencies that match a given rule from all dependencies
   * @param {RegExp} re
   */
  pickDependencies (re) {
    const pkg = require(this.resolveCWD('package.json'))

    return Object.keys(pkg.devDependencies || {})
      .concat(Object.keys(pkg.dependencies || {}))
      .filter(id => re.test(id))
  }

  loadConfig () {
    const p = this.resolveCWD('vapper.config.js')

    try {
      const configFileStat = fs.statSync(p)
      if (configFileStat.isFile) {
        return require(p)
      }
      return null
    } catch (e) {
      process.env.NODE_ENV !== 'unittest' && console.error(e)
      return null
    }
  }

  loadEnvFile (key) {
    const envFilePath = this.resolveCWD(`./.vapper-env${key ? '.' : ''}${key}`)
    try {
      const fileStat = fs.statSync(envFilePath)
      if (fileStat.isFile) {
        const envContent = fs.readFileSync(envFilePath, 'utf-8')
        this.ENV_OBJECT = dotenv.parse(envContent)
      }
    } catch (e) {
      if (/no such file or directory/.test(String(e))) return
      console.error(e)
    }
  }

  validateOptions (schema, options) {
    return schema.validate(options)
  }

  use (type, fn) {
    if (typeof type === 'function') {
      fn = type
      type = this.allowMiddlewareTypes[0]
    }

    if (!this.allowMiddlewareTypes.includes(type)) {
      console.error(
        `The type of middleware must be \`allowMiddlewareTypes\`(${this.allowMiddlewareTypes}). \n` +
        `The type of error you provide is: ${type}`
      )
      return
    }
    this.middlewares[type].add(fn)
  }

  getRouteInfo (location) {
    if (!this.router) return {}
    const res = this.router.resolve({ path: location })
    if (!res.resolved.matched.length) return {}
    return res.resolved
  }

  getRouteMeta (location) {
    const routeInfo = this.getRouteInfo(location)

    return routeInfo.meta || null
  }

  hookInto (name, fn) {
    const has = this.hooks.has(name)
    if (!has) this.hooks.set(name, new Set())
    const hooks = this.hooks.get(name)
    hooks.add(fn)
  }

  invokeHook (name, ...args) {
    const has = this.hooks.has(name)
    if (!has) return
    const hooks = this.hooks.get(name)
    for (const h of hooks) {
      h(...args)
    }
  }

  notify (options = {}, fn = () => {}) {
    // disable in prod-env
    if (this.isProd) return
    const defaults = {
      sound: true,
      icon: this.resolveCore('lib/vapper.png')
    }
    notifier.notify({
      ...defaults,
      ...options
    }, fn)
  }
}

module.exports = PluginApi
