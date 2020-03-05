<template>
  <div class="hello">
    Home {{ res1 }}, {{ res2 }}
  </div>
</template>

<script>
import fetch from '../../fetch'
export default {
  name: 'Home',
  data () {
    return {
      res1: {},
      res2: {}
    }
  },
  needSerialize: true,
  async created () {
    console.log(this.$browser.isChrome())
    const res1 = await fetch()
    const res2 = await fetch()

    this.res1 = res1

    this.res2 = res2
  },
  mounted () {
    console.log(this.$browser)
  }
}
</script>
