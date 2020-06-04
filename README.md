# vapper

<p align="center"><a href="https://vapperjs.org/" target="_blank" rel="noopener noreferrer"><img width="100" src="https://vapperjs.org/vapper.png" alt="Vapper logo"></a></p>

<p align="center">
  <a href="https://circleci.com/gh/shuidi-fed/vapper"><img src="https://circleci.com/gh/shuidi-fed/vapper.svg?style=svg" alt="Build Status"/></a>
  <a href="https://lerna.js.org/"><img src="https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg" alt="Maintained With lerna"></a>
  <a href="https://www.npmjs.com/package/@vapper/core"><img src="https://img.shields.io/npm/v/@vapper/core.svg" alt="Version"></a>
  <a href="https://www.npmjs.com/package/@vapper/core"><img src="https://img.shields.io/npm/l/@vapper/core.svg" alt="License"></a>
</p>

<p align="center"><a href="https://vapperjs.org/">Documentation</a></p>

## Developed and maintained by

<p align="center"><a href="https://zhuanlan.zhihu.com/shuidi-fed"><img src="./assets/sd.png" width="100" /></a></p>

<p align="center"><a href="https://zhuanlan.zhihu.com/shuidi-fed">Front-end team of water drop</a></p>

## Setup Project

```sh
git clone https://github.com/vapperjs/vapper.git
cd vapper
yarn install
```

## Run unit test

```sh
yarn test:unit
```

## Run E2E test

### 1. link

```sh
cd packages/core
yarn link
```

This makes the `vapper` command globally available.

### 2. run

Projects in the `examples` directory as test fixtures.

Test specified project:

```sh
yarn test:e2e [...projectName]
# E.g
yarn test:e2e poi vue-cli3
```

Test all project:

```sh
yarn test:e2e
```

## Run stress test

**This stress test is mainly used to troubleshoot memory leaks in vapper itself.**

Projects in the `examples` directory as test fixtures.

Test specified project:

```sh
yarn test:stress [...projectName]
# E.g
yarn test:stress poi vue-cli3
```

Test all project:

```sh
yarn test:stress
```

## Core Author

**Vapper** © [水滴FED](https://github.com/shuidi-fed), Released under the [MIT](./LICENSE) License.<br>
Authored and maintained by [Front-end team of water drop](https://zhuanlan.zhihu.com/shuidi-fed).
