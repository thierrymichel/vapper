const webpack = require('webpack')
const MemoryFS = require('memory-fs')
const FS = require('fs')
const webpackDevMiddleware = require('webpack-dev-middleware')
const webpackHotMiddleware = require('webpack-hot-middleware')
const VueCliConfiger = require('@vapper/configer-vue-cli')
const Vapper = require('../lib/index')

jest.mock('webpack')
jest.mock('webpack-dev-middleware')
jest.mock('webpack-hot-middleware')
jest.mock('@vapper/configer-vue-cli')
jest.mock('memory-fs')
jest.mock('fs')

// mock fs
const mockMemoryFSReadFileSync = jest.fn()
mockMemoryFSReadFileSync.mockReturnValue('{}')
MemoryFS.mockImplementation(() => {
  return { readFileSync: mockMemoryFSReadFileSync }
})
FS.readFileSync.mockReturnValue('{}')
FS.statSync.mockReturnValue({ isFile: false })

// mock webpack
const mockWebpackRun = jest.fn()
const mockWebpackWatch = jest.fn()
const mockTap = jest.fn((name, cb) => {
  cb()
})
const compiler = {
  run: mockWebpackRun,
  watch: mockWebpackWatch,
  hooks: { done: { tap: mockTap } }
}
webpack.mockImplementation(() => {
  return compiler
})

// mock middlewares
webpackDevMiddleware.mockReturnValue({
  fileSystem: new MemoryFS()
})
webpackHotMiddleware.mockReturnValue('webpack-hot-middleware')

// mock @vapper/configer-vue-cli
const mockGetServerConfig = jest.fn()
const mockServerConfig = { serverConfig: true }
mockGetServerConfig.mockReturnValue(mockServerConfig)

const mockGetClientConfig = jest.fn()
const mockClientConfig = {
  serverConfig: true,
  output: { path: '/', publicPath: 'publicPath' }
}
mockGetClientConfig.mockReturnValue(mockClientConfig)

VueCliConfiger.mockImplementation(() => {
  return {
    getServerConfig: mockGetServerConfig,
    getClientConfig: mockGetClientConfig
  }
})

beforeEach(() => {
  webpack.mockClear()
  mockWebpackRun.mockClear()
  mockWebpackWatch.mockClear()
  mockTap.mockClear()
  webpackDevMiddleware.mockClear()
  webpackHotMiddleware.mockClear()
  mockGetClientConfig.mockClear()
  mockGetClientConfig.mockClear()
  mockMemoryFSReadFileSync.mockClear()
  FS.readFileSync.mockClear()
})

describe('Dev mode: ', () => {
  test('Should be instantiated correctly', () => {
    const vapper = new Vapper({ mode: 'development' })
    const builder = vapper.builder

    expect(mockGetServerConfig).toHaveBeenCalledTimes(1)
    expect(mockGetClientConfig).toHaveBeenCalledTimes(1)
    expect(builder.serverWebpackConfig).toEqual(mockServerConfig)
    expect(builder.clientWebpackConfig).toEqual(mockClientConfig)
  })

  test('Webpack should be run correctly', async () => {
    const vapper = new Vapper({ mode: 'development' })
    const builder = vapper.builder
    const mockEmitEvent = jest.fn()
    builder.on('change', mockEmitEvent)
    await builder.run()

    expect(webpack).toHaveBeenCalledTimes(2)
    expect(mockWebpackWatch).toHaveBeenNthCalledWith(1, {}, expect.any(Function))
    expect(mockTap).toHaveBeenNthCalledWith(1, '@vapper', expect.any(Function))

    expect(webpackDevMiddleware).toHaveBeenCalledWith(compiler, {
      publicPath: 'publicPath',
      logLevel: 'silent',
      noInfo: true,
      index: false
    })
    expect(webpackHotMiddleware).toHaveBeenCalledWith(compiler, { log: false })
    expect(mockTap).toHaveBeenNthCalledWith(2, '@vapper', expect.any(Function))

    expect(mockEmitEvent).toHaveBeenCalledWith({
      serverBundle: builder.serverBundle,
      clientManifest: builder.clientManifest
    })
  })
})

describe('Prod mode: ', () => {
  test('Webpack should be run correctly', async () => {
    const vapper = new Vapper({ mode: 'production' })
    const builder = vapper.builder
    const mockEmitEvent = jest.fn()
    builder.on('change', mockEmitEvent)
    await builder.run()

    expect(webpack).toHaveBeenCalledTimes(2)
    expect(mockWebpackWatch).not.toHaveBeenCalled()
    expect(mockWebpackRun).toHaveBeenCalledTimes(2)
    expect(mockTap).toHaveBeenNthCalledWith(1, '@vapper', expect.any(Function))
    expect(mockTap).toHaveBeenNthCalledWith(2, '@vapper', expect.any(Function))

    expect(mockEmitEvent).toHaveBeenCalledWith({
      serverBundle: builder.serverBundle,
      clientManifest: builder.clientManifest
    })
  })
})
