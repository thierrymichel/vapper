const path = require('path')
const p = path.resolve(__dirname, './platform.ejs')

module.exports = (api, options = { browsers: [], checkers: {} }) => {
  api.addEnhanceFile({
    needCompile: true,
    client: p,
    server: p,
    clientOptions: options,
    serverOptions: options
  })

  api.chainWebpack(config => {
    const isServer = process.env.VAPPER_TARGET === 'server'
    config.resolve.alias
      .set('vapper-plugin-platform', path.resolve(__dirname, isServer ? './.vapper_server.js' : './.vapper_client.js'))
  })
}
