const https = require('https')
const fs = require('fs-extra')
const path = require('path')
const cac = require('cac')()
const chokidar = require('chokidar')
const connect = require('connect')
const compression = require('compression')
const { minify } = require('html-minifier')
const mergeWith = require('lodash.mergewith')
const { createBundleRenderer } = require('vue-server-renderer')
const template = require('lodash.template')
const serialize = require('serialize-javascript')
const { serializeFunction } = require('./serialize')
const slash = require('slash')
const PluginApi = require('./PluginApi')
const Logger = require('./Logger')
const Builder = require('./Builder')
const serveStaticPlugin = require('./plugins/serveStatic')
const separateEntryPlugin = require('./plugins/separateEntry')
const fallbackSpaPlugin = require('./plugins/fallbackSpa')
const microCachingPlugin = require('./plugins/microCaching')
const { options: defaultOptions, optionsSchema } = require('./options')

class Vapper extends PluginApi {
  constructor (options) {
    super()
    this.app = connect()
    this.cli = cac

    // Check if it is a TypeScript project
    this.isTSProject = fs.existsSync(this.resolveCWD(defaultOptions.entry + '.ts'))
    if (this.isTSProject) {
      defaultOptions.clientEntry = 'src/client.ts'
      defaultOptions.serverEntry = 'src/server.ts'
    }

    this.defaultOptions = defaultOptions
    this.optionsSchema = optionsSchema
    this.options = mergeWith(
      {},
      defaultOptions,
      this.loadConfig(),
      options,
      function (objValue, srcValue) {
        if (Array.isArray(objValue)) {
          return objValue.concat(srcValue)
        }
      }
    )

    // Load env file
    this.loadEnvFile(this.options.env)

    this.isProd = this.options.mode === defaultOptions.mode

    // Set environment variables
    process.env.VAPPER_ENV = this.options.mode

    this.logger = new Logger({ logger: this.options.logger })
    this.logger.setLogLevel(this.options.logLevel)

    const { error } = this.validateOptions(optionsSchema, this.options)
    if (error) {
      if (error.isJoi) {
        error.details.forEach(e => {
          this.logger.error(e.message)
        })
      } else {
        this.logger.error(error.toString())
      }
    }

    this.serverBundle = null
    this.clientManifest = null

    this.initTemplate()

    this.renderer = null
    this.htmlContent = ''

    // Development only
    this.devMiddleware = null
    this.hotMiddleware = null

    // When `setup` is complete, it is an instance of vue-router
    this.router = null

    this.clientEnhanceFileName = '.vapper_client.js'
    this.serverEnhanceFileName = '.vapper_server.js'

    this.initPlugins()

    this.builder = new Builder(this)
  }

  get handler () {
    return this.app
  }

  initTemplate () {
    if (this.options.template) {
      // The template option
      this.template = this.options.template
    } else if (this.options.templatePath) {
      // The templatePath option
      const templateFileStat = fs.statSync(this.options.templatePath)
      if (templateFileStat.isFile) {
        this.template = fs.readFileSync(this.options.templatePath, 'utf-8')
        // Watch the changes of this template file
        chokidar.watch(this.options.templatePath, {
          ignoreInitial: true
        }).on('all', () => {
          // we need to update the renderer
          this.template = fs.readFileSync(this.options.templatePath, 'utf-8')
          this.updateRenderer()
        })
      } else {
        this.logger.error(`Invalid template file, the path is: ${this.options.templatePath}.`)
      }
    } else {
      // Use default template
      const templatePath = this.resolveCore('app/index.template.html')
      this.template = fs.readFileSync(templatePath, 'utf-8')
    }
  }

  async setup () {
    this.invokeHook('before:setup')

    if (this.isProd) {
      const serverBundle = JSON.parse(
        fs.readFileSync(this.resolveOut(this.options.serverBundleFileName), 'utf-8')
      )
      const clientManifest = JSON.parse(
        fs.readFileSync(this.resolveOut(this.options.clientManifestFileName), 'utf-8')
      )

      this.renderer = this.createRenderer({ serverBundle, clientManifest })
    } else {
      await this.build()
    }

    // Resolve the vue-router instance
    await this.resolveRouterInstanceForFake()

    // install middleware
    // before:setup
    for (const m of this.middlewares[this.allowMiddlewareTypes[2]]) {
      this.app.use(m)
    }
    this.app.use(compression())
    if (!this.isProd) {
      this.app.use(this.devMiddleware)
      this.app.use(this.hotMiddleware)
    }
    // before:render
    for (const m of this.middlewares[this.allowMiddlewareTypes[0]]) {
      this.app.use(m)
    }
    this.app.use(this.render.bind(this))
    // after:render
    for (const m of this.middlewares[this.allowMiddlewareTypes[1]]) {
      this.app.use(m)
    }
    // after:setup
    for (const m of this.middlewares[this.allowMiddlewareTypes[3]]) {
      this.app.use(m)
    }

    this.invokeHook('after:setup')
  }

  async build () {
    await this.generateEnhanceFile()

    if (this.isProd) {
      await fs.remove(this.resolveOut('.'))
      await this.builder.run()
      return
    }

    const { serverBundle, clientManifest } = await this.builder.run()
    this.serverBundle = serverBundle
    this.clientManifest = clientManifest

    this.renderer = this.createRenderer({ serverBundle, clientManifest })

    this.builder.on('change', ({ serverBundle, clientManifest }) => {
      this.updateRenderer({ serverBundle, clientManifest })
    })

    this.devMiddleware = this.builder.devMiddleware
    this.hotMiddleware = this.builder.hotMiddleware
  }

  async render (req, res, next) {
    this.invokeHook('before:render')
    try {
      this.htmlContent = await this.renderHTML({
        url: req.url,
        enhanceFiles: this.enhanceFiles,
        req,
        res
      })

      this.invokeHook('after:render', this.htmlContent)

      res.setHeader('x-power-by', 'vapper')
      res.setHeader('Content-Type', 'text/html; charset=UTF-8')
      res.end(this.htmlContent)
      next()
    } catch (err) {
      let finallyError = err

      if (finallyError.code === 'REDIRECT') {
        return
      }

      // If the custom error page is enabled, then the "error page" is rendered
      if (this.options.enableCustomErrorPage) {
        finallyError.code = typeof finallyError.code !== 'undefined' ? finallyError.code : 500
        finallyError.message = typeof finallyError.message !== 'undefined'
          ? finallyError.message
          : 'Internal Server Error'
        try {
          this.htmlContent = await this.renderHTML({
            renderError: finallyError
          })

          this.invokeHook('after:render', this.htmlContent)

          res.statusCode = finallyError.code
          res.statusMessage = finallyError.message
          res.setHeader('x-power-by', 'vapper')
          res.setHeader('Content-Type', 'text/html; charset=UTF-8')
          res.end(this.htmlContent)

          return
        } catch (errorPageErr) {
          finallyError = errorPageErr
        }
      }
      // The `err` may not be an Error instance in some cases
      const error = typeof finallyError !== 'object' ? new Error(String(finallyError)) : finallyError
      error.isVapper = true
      next(error)
    }
  }

  renderHTML (context) {
    let htmlMinifier = this.options.htmlMinifier
    htmlMinifier =
      this.isProd
        ? htmlMinifier === true
          ? {
            collapseWhitespace: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            minifyCSS: true
          }
          : htmlMinifier
        : {}

    return new Promise(
      (resolve, reject) => {
        this.renderer.renderToString(context, (err, html) => {
          if (err) {
            reject(err)
            return
          }
          resolve(htmlMinifier ? minify(html, htmlMinifier) : html)
        })
      }
    )
  }

  async resolveRouterInstanceForFake () {
    if (!this.options.needResolveRouteMeta) return
    // Get the vue-router instance
    try {
      await this.renderHTML({ fake: true })
    } catch (err) {
      if (err.code === 'FAKE') {
        this.router = err.router
      } else {
        this.logger.error(err)
      }
    }
  }

  createRenderer ({ serverBundle, clientManifest }) {
    return createBundleRenderer(serverBundle, {
      ...this.options.rendererOptions,
      runInNewContext: false,
      template: this.template,
      clientManifest
    })
  }

  async updateRenderer ({ serverBundle, clientManifest } = {}) {
    this.serverBundle = serverBundle || this.serverBundle
    this.clientManifest = clientManifest || this.clientManifest

    this.renderer = this.createRenderer({
      serverBundle: this.serverBundle,
      clientManifest: this.clientManifest
    })
    // Update the vue-router instance
    await this.resolveRouterInstanceForFake()
    this.logger.debug('Renderer updated')
    this.emit('rendererUpdated')
  }

  initPlugins () {
    this.buildInPlugins = [
      serveStaticPlugin,
      fallbackSpaPlugin,
      [microCachingPlugin, this.options.pageCache]
    ]

    // These plugins need to be applied last
    this.appendPlugins = [separateEntryPlugin]

    this.buildInPlugins
      .concat((this.options.plugins || []))
      .concat(this.appendPlugins)
      .forEach(plugin => {
        if (typeof plugin === 'string') plugin = require(plugin)

        if (typeof plugin === 'function') {
          plugin.call(this, this)
        } else if (Array.isArray(plugin)) {
          const options = plugin[1]
          plugin = typeof plugin[0] === 'string'
            ? require(plugin[0])
            : plugin[0]

          plugin.call(this, this, options)
        } else {
          this.logger.error('The plugin must be a function or an array')
        }
      })
  }

  async compileEnhanceFile (type, templatePath, compileOptions) {
    const templateFile = fs.readFileSync(templatePath)

    const templateOptions = {
      imports: {
        serialize,
        serializeFunction,
        ...this.options.enhanceFileImportsOption
      },
      interpolate: /<%=([\s\S]+?)%>/g
    }

    const templateFunction = template(templateFile, templateOptions)

    const content = templateFunction({
      options: {
        ...compileOptions
      }
    })

    const compiledFilePath = path.resolve(
      path.dirname(templatePath),
      type === 'client' ? this.clientEnhanceFileName : this.serverEnhanceFileName
    )

    this.logger.debug(`Generate ${type} enhance file: ${compiledFilePath}`)

    await fs.remove(compiledFilePath)
    await fs.ensureFile(compiledFilePath)
    fs.writeFileSync(compiledFilePath, content, 'utf-8')
  }

  async generateEnhanceFile () {
    const compiled = template(this.enhanceTemplate)

    this.enhanceFiles.forEach(async enhanceObj => {
      const { client, clientOptions, server, serverOptions, needCompile } = enhanceObj

      // compile client and server plugin templates
      needCompile !== false && client && this.compileEnhanceFile('client', client, clientOptions)
      needCompile !== false && server && this.compileEnhanceFile('server', server, serverOptions)
    })

    const transformEnhanceFiles = (type) => {
      return Array.from(this.enhanceFiles).filter(enhanceObj => enhanceObj[type]).map(enhanceObj => {
        const serializedPath = slash(path.relative(
          path.dirname(this.enhanceClientOutput),
          path.dirname(enhanceObj[type])
        ))

        enhanceObj[type] = type === 'client'
          ? `${serializedPath}/${enhanceObj.needCompile !== false ? this.clientEnhanceFileName : path.basename(enhanceObj[type])}`
          : `${serializedPath}/${enhanceObj.needCompile !== false ? this.serverEnhanceFileName : path.basename(enhanceObj[type])}`

        return enhanceObj
      })
    }

    const clientEnhanceContent = compiled({
      type: 'client',
      enhanceFiles: transformEnhanceFiles('client')
    })
    const serverEnhanceContent = compiled({
      type: 'server',
      enhanceFiles: transformEnhanceFiles('server')
    })

    this.logger.debug('Write a enhance file: ' + this.enhanceClientOutput)
    this.logger.debug('Write a enhance file: ' + this.enhanceServerOutput)

    await fs.remove(this.enhanceClientOutput)
    await fs.remove(this.enhanceServerOutput)
    await fs.ensureFile(this.enhanceClientOutput)
    await fs.ensureFile(this.enhanceServerOutput)
    fs.writeFileSync(this.enhanceClientOutput, clientEnhanceContent, 'utf-8')
    fs.writeFileSync(this.enhanceServerOutput, serverEnhanceContent, 'utf-8')
  }

  listen (...args) {
    this.app.listen(...args)
  }

  async startServer () {
    const {
      options: {
        port,
        host,
        https: httpsConfig
      }
    } = this

    await this.setup()

    if (httpsConfig.key && httpsConfig.cert) {
      // Use https
      const server = https.createServer(httpsConfig, this.app)
      server.listen(port, host)
    } else {
      this.listen(port, host)
    }

    this.printRunningInfo()
  }

  printRunningInfo () {
    const {
      options: {
        port,
        host,
        https: httpsConfig
      }
    } = this
    const useHttps = httpsConfig.key && httpsConfig.cert
    const printHost = useHttps
      ? host === ('0.0.0.0' || '127.0.0.1')
        ? 'localhost'
        : host
      : host
    this.logger.info(`Server running at: http${useHttps ? 's' : ''}://${printHost}:${port}`)
  }

  resolveOut (...args) {
    return path.resolve(this.builder.clientWebpackConfig.output.path, ...args)
  }
}

Vapper.defaultOptions = defaultOptions
Vapper.cli = cac
Vapper.PluginApi = PluginApi

module.exports = Vapper
