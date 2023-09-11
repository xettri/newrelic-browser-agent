const { URL } = require('url')

/**
 * Resolves the path of a file and provides a URL that can be used to load that
 * file.
 * @param {string} relativePath base path, typically the root of the repository
 * @param {object} query an object of query parameters to append to the URL
 * @param {TestServer} testServer test server instance
 * @return {string}
 * @todo Need to remove the use of querystring in this method.
 */
module.exports.urlFor = function urlFor (relativePath, query, testServer) {
  if (relativePath.indexOf('%') > -1) {
    // Double-encode the file path part that contains a percent symbol
    // to allow files like tests/assets/symbols%20in&referrer.html to
    // be properly served from fastify
    relativePath = relativePath
      .split('/')
      .map((part) => encodeURIComponent(encodeURIComponent(part)))
      .join('/')
  }

  if (Object.prototype.hasOwnProperty.call(query || {}, 'config') && typeof query.config !== 'string') {
    query.config = Buffer.from(JSON.stringify(query.config)).toString('base64')
  }

  if (Object.prototype.hasOwnProperty.call(query || {}, 'init') && typeof query.init !== 'string') {
    query.init = Buffer.from(
      JSON.stringify(query.init, (k, v) => {
        if (typeof v === 'object' && v instanceof RegExp) {
          let m = v.toString().match(/\/(.*)\/(\w*)/)
          return `new RegExp('${m[1]}','${m[2] || ''}')` // serialize regex in a way our test server can receive it
        }
        return v
      })
    ).toString('base64')
  }

  if (
    Object.prototype.hasOwnProperty.call(query || {}, 'workerCommands') &&
    typeof query.workerCommands !== 'string'
  ) {
    query.workerCommands = Buffer.from(
      JSON.stringify(query.workerCommands)
    ).toString('base64')
  }

  return new URL(
    `${relativePath}?${new URLSearchParams(query).toString()}`,
    new URL(
      `http://${testServer.assetServer.host}:${testServer.assetServer.port}`,
      'resolve://'
    )
  ).toString()
}
