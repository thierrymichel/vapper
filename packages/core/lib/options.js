const Joi = require('@hapi/joi')

exports.options = {
  mode: 'production',
  vueCliMode: null,
  entry: 'src/main',
  clientEntry: 'src/client.js',
  serverEntry: 'src/server.js',
  ssr: true,
  enableCustomErrorPage: false,
  template: null,
  templatePath: null,
  port: 4000,
  host: '0.0.0.0',
  https: {},
  logger: undefined,
  logLevel: 5,
  static: {
    dotfiles: 'allow',
    index: false,
    maxAge: '1d'
  },
  plugins: [],
  htmlMinifier: false,
  fallBackSpa: true,
  fallbackSpaHandler: null,
  serverBundleFileName: 'vue-ssr-server-bundle.json',
  clientManifestFileName: 'vue-ssr-client-manifest.json',
  pageCache: {},
  rendererOptions: {},
  nodeExternalsWhitelist: [/\.css$/, /\?vue&type=style/],
  needResolveRouteMeta: true,
  env: '',
  runtimeCompiler: false,
  enhanceFileImportsOption: {}
}

exports.optionsSchema = Joi.object({
  mode: Joi.string().allow('production', 'development'),
  vueCliMode: Joi.alternatives().try(Joi.string(), null),
  entry: Joi.string(),
  clientEntry: Joi.string(),
  serverEntry: Joi.string(),
  ssr: Joi.boolean(),
  enableCustomErrorPage: Joi.boolean(),
  template: Joi.alternatives().try(Joi.string(), null),
  templatePath: Joi.alternatives().try(Joi.string(), null),
  port: Joi.number(),
  p: Joi.number(),
  host: Joi.alternatives().try(Joi.string().ip(), Joi.string().allow('localhost')),
  h: Joi.string().ip(),
  logger: Joi.alternatives().try(Joi.func()),
  logLevel: Joi.number().min(1).max(5),
  static: Joi.object(),
  plugins: Joi.array().items(
    Joi.array().items(
      Joi.string(),
      Joi.func(),
      Joi.object()
    ),
    Joi.string(),
    Joi.func()
  ),
  htmlMinifier: Joi.alternatives().try(Joi.object(), Joi.boolean()),
  fallBackSpa: Joi.boolean(),
  fallbackSpaHandler: Joi.alternatives().try(Joi.func(), null),
  serverBundleFileName: Joi.string().regex(/^.+\.json$/),
  clientManifestFileName: Joi.string().regex(/^.+\.json$/),
  pageCache: Joi.object({
    cacheOptions: Joi.object(),
    cacheable: Joi.func(),
    getCacheKey: Joi.func()
  }),
  rendererOptions: Joi.object(),
  nodeExternalsWhitelist: Joi.array(),
  needResolveRouteMeta: Joi.boolean(),
  env: Joi.alternatives().try(Joi.string(), ''),
  runtimeCompiler: Joi.boolean(),
  enhanceFileImportsOption: Joi.object(),
  https: Joi.object()
})
