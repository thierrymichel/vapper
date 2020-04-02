const prerender = require('@vapper/plugin-prerender')
const platform = require('../../packages/vapper-plugin-platform')

module.exports = {
  plugins: [
    [
      prerender,
      {
        routes: ['/foo/bar']
      }
    ],
    '@vapper/plugin-cookie',
    [platform, {
      checkers: {
        isChrome () {
          return this.name === 'Chrome'
        }
      }
    }]
  ],
  htmlMinifier: true
}