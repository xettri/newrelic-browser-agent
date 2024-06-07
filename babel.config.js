const process = require('process')
const pkg = require('./package.json')

module.exports = function (api, ...args) {
  api.cache(true)

  if (!process.env.BUILD_VERSION) {
    process.env.BUILD_VERSION = process.env.VERSION_OVERRIDE || pkg.version
  }
  if (!process.env.BUILD_ENV) {
    process.env.BUILD_ENV = 'CDN'
  }

  process.env.RRWEB_VERSION = pkg.dependencies.rrweb

  const ignore = [
    '**/__mocks__/*.js'
  ]
  const presets = [
    '@babel/preset-env'
  ]
  const plugins = [
    // Replaces template literals with concatenated strings. Some customers enclose snippet in backticks when
    // assigning to a variable, which conflicts with template literals.
    '@babel/plugin-transform-template-literals',
    // Replaces `process.env.*` environment variables with actual values.
    [
      'transform-inline-environment-variables',
      {
        include: ['BUILD_VERSION', 'BUILD_ENV', 'RRWEB_VERSION']
      }
    ],
    '@babel/plugin-syntax-import-assertions'
  ]
  const env = {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: 'commonjs'
          }
        ]
      ]
    },
    webpack: {
      ignore
    },
    'webpack-ie11': {
      ignore,
      assumptions: {
        iterableIsArray: false
      },
      presets: [
        [
          '@babel/preset-env', {
            useBuiltIns: 'entry',
            corejs: { version: 3.23, proposals: true },
            loose: true,
            targets: {
              browsers: [
                'ie >= 11' // Does not affect webpack's own runtime output; see `target` webpack config property.
              ]
            }
          }
        ]
      ]
    },
    'npm-cjs': {
      ignore,
      presets: [
        [
          '@babel/preset-env', {
            modules: 'commonjs'
          }
        ]
      ],
      plugins: [
        [
          './tools/babel/plugins/transform-import',
          {
            '(/constants/|^\\./)env$': '$1env.npm'
          }
        ]
      ]
    },
    'npm-esm': {
      ignore,
      presets: [
        [
          '@babel/preset-env', {
            modules: false
          }
        ]
      ],
      plugins: [
        [
          './tools/babel/plugins/transform-import',
          {
            '(/constants/|^\\./)env$': '$1env.npm'
          }
        ]
      ]
    }
  }

  return {
    presets,
    plugins,
    env
  }
}
