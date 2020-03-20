const serveStatic = require('serve-static')
const finalhandler = require('finalhandler')

module.exports = (api) => {
  // Exposing the fallback function gives the user more choices
  api.fallbackSPA = (req, res) => {
    req._forceFallback = true
    api.handler(req, res)
  }

  const preHandler = (req, res, next) => {
    const meta = api.getRouteMeta(req.url)
    const needFallback = api.options.ssr
      ? (meta && meta.ssr === false)
      : (!meta || meta.ssr !== true)

    if (needFallback || req._forceFallback) {
      api.logger.debug(`${req._forceFallback ? 'Force' : ''} Fall back SPA mode, url is: ${req.url}`)
      fallBack(req, res)
      return
    }

    next()
  }
  preHandler.__name = 'fallback_spa_pre'

  const afterHandler = (err, req, res, next) => {
    if (api.options.fallBackSpa && err && err.isVapper) {
      delete err.isVapper

      api.logger.error(`Server rendering encountered an error:`)
      api.logger.error(`
      \u001b[31m=============== Error Start ===============\u001b[39m
      `,
      err,
      `
      \u001b[31m=============== Error End =================\u001b[39m`)
      api.logger.debug(`Will fall back SPA mode, url is: ${req.url}`)
      fallBack(req, res)
      return
    }
    next(err)
  }
  afterHandler.__name = 'fallback_spa_after'

  api.use(preHandler)
  api.use('after:render', afterHandler)

  function fallBack (req, res) {
    // Prioritize user-defined
    if (api.options.fallbackSpaHandler) {
      api.options.fallbackSpaHandler(req, res, api)
      return
    }
    if (api.isProd) {
      req.url = '/index.html'
      serveStatic('dist', api.options.static)(req, res, finalhandler(req, res))
    } else {
      req.url = `/${api.publicPath}/index.html`
      const html = api.devMiddleware.fileSystem.readFileSync(
        api.devMiddleware.getFilenameFromUrl(req.url),
        'utf-8'
      )
      res.setHeader('Content-Type', 'text/html; charset=UTF-8')
      res.end(html)
    }
  }
}
