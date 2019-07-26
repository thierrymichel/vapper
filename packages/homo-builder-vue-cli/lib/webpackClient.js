
const webpack = require('webpack')

module.exports = (api) => {
  const isProd = api.options.mode === 'production'

  return {
    id: 'vue-cli-plugin-homo-webpack-client',
    apply: (vueCliapi) => {
      vueCliapi.chainWebpack(config => {
        config
          .entry('app')
          .clear()
          .when(!isProd, entry => entry.add(require.resolve('webpack-hot-middleware/client')))
          .add(api.resolveCore('app/clientEntry.js'))

        config.output
          .publicPath('/_homo_/')

        config
          .plugin('VueSSRClientPlugin')
          .use(require('vue-server-renderer/client-plugin'), [{
            filename: api.options.clientManifestFileName
          }])

        if (!isProd) {
          config
            .plugin('hmr').use(webpack.HotModuleReplacementPlugin)
        }

        config.plugin('constants')
          .tap(args => {
            return [
              {
                ...args,
                'process.server': false,
                'process.client': true,
                __DEV__: !this.isProd
                // __PUBLIC_PATH__: JSON.stringify(publicPath)
              }
            ]
          })
      })
    }
  }
}