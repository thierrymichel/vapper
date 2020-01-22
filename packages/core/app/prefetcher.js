function serverPlugin (Vue) {
  const beforeCreateHook = function () {
    this.__promiser = new Promise((resolve, reject) => {
      this.__resolveData = resolve
      this.__reject = reject
    })

    // The component's own `created` hook
    const selfCreatedHook = this.$options.created[this.$options.created.length - 1]
    if (selfCreatedHook.__async) return

    // Rewrite created hook
    const asyncHook = async function (...args) {
      let pro
      try {
        pro = selfCreatedHook.apply(this, args)
        await pro
      } catch (e) {
        this.__reject && this.__reject(e)
        throw e
      }

      this.__resolveData && this.__resolveData()

      return pro
    }
    asyncHook.__async = true // mark
    this.$options.created[this.$options.created.length - 1] = asyncHook
  }

  const createdHook = function () {
    const keyMap = this.$root.$$keyMap || (this.$root.$$keyMap = {})

    const $$selfStore = this.$root.$$selfStore || (this.$root.$$selfStore = {})

    const key = getKey(keyMap, this)

    if (!this.$options.needSerialize) return
    $$selfStore[key] = this.$data
  }

  const prefetchHook = function () {
    return this.__promiser
  }

  Vue.mixin({
    serverPrefetch: prefetchHook,
    beforeCreate: beforeCreateHook,
    created: createdHook
  })
}
serverPlugin.__name = 'vapperServerPlugin'

const clientPlugin = function (Vue) {
  const keyMap = {}

  Vue.mixin({
    beforeCreate: function () {
      if (!this.$options.needSerialize && !this.$options.needPrefetch) return

      // The component's own `created` hook
      let selfCreatedHook = this.$options.created[this.$options.created.length - 1]
      // vue-meta will push a new `created` hook function in the `beforeCreate` hook,
      // so the component's own `created` hook function is the penultimate.
      // https://github.com/nuxt/vue-meta/blob/master/src/shared/mixin.js#L75-L89
      if (typeof this.$options.head === 'function') {
        selfCreatedHook = this.$options.created.splice(this.$options.created.length - 2, 1)[0]
        this.$options.created[this.$options.created.length] = selfCreatedHook
      }

      // Rewrite created hook
      this.$options.created[this.$options.created.length - 1] = async function (...args) {
        if (!clientPlugin.$$resolved) {
          // TODO: VapperError
          const err = new Error('vapper-ssr-prefetcher: custom error')
          err.isVapperSsrPrefetcher = true
          throw err
        }
        return selfCreatedHook.apply(this, args)
      }
    },
    created: function () {
      const $$selfStore = this.$root.$$selfStore
      if (clientPlugin.$$resolved || !$$selfStore) { return }

      const key = getKey(keyMap, this)

      try {
        Object.assign(this, $$selfStore[key] || {})
      } catch (err) {}
    },
    errorCaptured: function (err) {
      if (err.isVapperSsrPrefetcher) { return false }
      return true
    }
  })
}
clientPlugin.$$resolved = false

function getKey (keyMap, vm) {
  let current = vm
  let key = ''
  while (current) {
    key += current.$options.name || '$'
    current = current.$parent
  }

  if (keyMap[key]) {
    key = `${key}--${keyMap[key]++}`
    keyMap[key] = 1
  } else {
    keyMap[key] = 1
  }

  return key
}

export { clientPlugin, serverPlugin }
