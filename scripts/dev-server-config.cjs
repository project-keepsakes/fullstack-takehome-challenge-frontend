function adaptDevServerConfig(legacy) {
  const { https, onBeforeSetupMiddleware, onAfterSetupMiddleware, ...config } = legacy;
  const publicPath = config.devMiddleware?.publicPath || '/';
  return {
    ...config,
    host: '127.0.0.1',
    allowedHosts: ['127.0.0.1', 'localhost'],
    headers: Object.fromEntries(Object.entries(config.headers || {})
      .filter(([name]) => !name.toLowerCase().startsWith('access-control-'))),
    proxy: config.proxy || [],
    server: https ? { type: 'https', options: https === true ? {} : https } : 'http',
    devMiddleware: {
      ...config.devMiddleware,
      publicPath: publicPath.endsWith('/') ? publicPath : `${publicPath}/`,
    },
    setupMiddlewares(middlewares, server) {
      // CRA's source-overlay hook runs before the built-in host validation.
      server.app.use((request, response, next) => {
        let sameOrigin = true;
        if (request.headers.origin) {
          try {
            const protocol = https ? 'https' : 'http';
            sameOrigin = new URL(request.headers.origin).origin ===
              new URL(`${protocol}://${request.headers.host}`).origin;
          } catch {
            sameOrigin = false;
          }
        }
        const site = request.headers['sec-fetch-site'];
        if (!server.isValidHost(request.headers, 'host') || !sameOrigin ||
            (site && site !== 'same-origin' && site !== 'none')) {
          response.status(403).end('Invalid Host/Origin header');
          return;
        }
        next();
      });
      const overlayServer = Object.create(server);
      Object.defineProperty(overlayServer, '_stats', { get: () => server.stats });
      onBeforeSetupMiddleware?.(overlayServer);
      const trailing = [];
      // CRA's two after-hooks must remain after the dev server's own middleware.
      onAfterSetupMiddleware?.({ app: { use(middleware) {
        trailing.push({ name: 'cra-after', middleware });
      } } });
      return [...middlewares, ...trailing];
    },
  };
}

module.exports = { adaptDevServerConfig };
