const TimeFixPlugin = require('time-fix-plugin')

function stripSlash (str) {
  return str.replace(/^(\/)?([^/]+)(\/)?/, (a, b, c) => c)
}

const isE2ETest = process.env.NODE_ENV === 'e2etest'

module.exports = (api, config) => {
  config.resolve.alias
    .set('#', api.resolveCWD('.'))
    .set('#entry$', api.resolveCWD(api.options.entry))
    .set('vue$',
      isE2ETest
        ? api.resolveCore('../../node_modules/vue/dist/vue.runtime.esm.js')
        : api.options.runtimeCompiler
          ? api.resolveCWD('node_modules/vue/dist/vue.esm.js')
          : api.resolveCWD('node_modules/vue/dist/vue.runtime.esm.js')
    )

  const publicPath = config.output.get('publicPath')
  // Set `api.publicPath` for use in plugins, E.g: plugins/fallbackSpa.js / plugins/serveStatic.js
  api.publicPath = stripSlash(publicPath)

  config.output
    .publicPath(publicPath)

  config.module
    .rule('vue')
    .use('vue-loader')
    .loader('vue-loader')
    .tap(args => {
      return {
        ...args,
        optimizeSSR: false
      }
    })

  config.module
    .rule('eslint')
    .exclude
    .add(api.resolveCore('.'))
    .add(api.resolveCore('..'))

  config.plugins
    .delete('progress')

  TimeFixPlugin.__expression = `require('time-fix-plugin')`
  config.plugin('timefix').use(TimeFixPlugin)

  config.optimization.runtimeChunk(true)
}
