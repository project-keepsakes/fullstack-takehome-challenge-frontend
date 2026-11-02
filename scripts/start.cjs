process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
require('react-scripts/config/env');

const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const createWebpackConfig = require('react-scripts/config/webpack.config');
const createDevServerConfig = require('react-scripts/config/webpackDevServer.config');
const { prepareProxy } = require('react-dev-utils/WebpackDevServerUtils');
const paths = require('react-scripts/config/paths');
const { adaptDevServerConfig } = require('./dev-server-config.cjs');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const proxy = prepareProxy(require('../package.json').proxy, paths.appPublic, paths.publicUrlOrPath);
const config = adaptDevServerConfig(createDevServerConfig(proxy, '127.0.0.1'));
const server = new WebpackDevServer({ ...config, port }, webpack(createWebpackConfig('development')));

async function stop() {
  await server.stop();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
server.start().then(() => {
  const protocol = config.server === 'http' ? 'http' : 'https';
  const url = `${protocol}://127.0.0.1:${port}`;
  console.log(`Raffle development server: ${url}`);
  require('react-dev-utils/openBrowser')(url);
}).catch(async error => {
  console.error(error.message);
  await server.stop();
  process.exitCode = 1;
});
