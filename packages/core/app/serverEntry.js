import Vue from 'vue'
import { serverPlugin } from './prefetcher'
import createApp from './createApp'
import { createServerRedirect } from './redirect'
import VapperError from './VapperError'

// Dynamically generated by vapper
import enhanceApp, { enhanceInstance } from './.vapper/enhanceServer'

// Avoid multiple installations in development mode
const alreadyInstalled = Vue._installedPlugins && Vue._installedPlugins.some(p => {
  return typeof p === 'function' && p.__name === 'vapperServerPlugin'
})
if (!alreadyInstalled) Vue.use(serverPlugin)

const TYPE = 'server'

export default async context => {
  const isFake = context.fake

  const ctx = {
    Vue,
    pluginRuntimeOptions: createApp.pluginRuntimeOptions,
    req: context.req,
    res: context.res,
    type: TYPE,
    isFake,
    replaceState () {} // do nothing
  }
  let fns = []
  if (!isFake) {
    fns = enhanceApp(ctx)
  }

  const { app, router, store, apolloProvider } = createApp(ctx)

  // This is a fake rendering in the `setup` to get the router instance
  if (isFake) {
    throw new VapperError({
      code: 'FAKE',
      router
    })
  }

  // Add helpers
  app.$$redirect = createServerRedirect(context.res)
  app.$$type = TYPE
  router.$$redirect = app.$$redirect
  router.$$type = TYPE

  router.onError((err) => {
    app.error = err
  })

  enhanceInstance(fns, { app, router, store })

  router.push(context.url)

  // Waiting for the route to be ready
  await routerReady(router)

  const matchedComponents = router.getMatchedComponents()
  // no matched routes, reject with 404
  if (!matchedComponents.length) {
    // Add error data - 404
    app.error = app.error || new VapperError({
      url: context.url,
      code: 404,
      message: 'Page Not Found'
    })
    throw app.error
  }
  context.rendered = () => {
    // The data will be serialized
    context.state = {
      $$stroe: store ? store.state : undefined,
      // vue-ssr-prefetcher
      $$selfStore: app.$$selfStore
    }
    if (apolloProvider) {
      // Also inject the apollo cache state
      context.state.$$apolloState = getApolloStates(apolloProvider)
    }
  }
  // vue-meta
  context.meta = app.$meta()
  return app
}

async function routerReady (router) {
  return new Promise((resolve, reject) => {
    router.onReady(resolve, reject)
  })
}

function getApolloStates (apolloProvider, options = {}) {
  const finalOptions = Object.assign({}, {
    exportNamespace: ''
  }, options)
  const states = {}
  for (const key in apolloProvider.clients) {
    const client = apolloProvider.clients[key]
    const state = client.cache.extract()
    states[`${finalOptions.exportNamespace}${key}`] = state
  }
  return states
}
