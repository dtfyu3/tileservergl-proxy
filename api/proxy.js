const { createProxyMiddleware } = require('http-proxy-middleware');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 });
require('dotenv').config();

const proxyUrl = process.env.PROXY_URL;

module.exports = (req, res) => {
  // Прокси запросы к tileserver-gl
  if (req.url.startsWith('/tiles')) {
    const cacheKey = req.url;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      res.set(cachedResponse.headers);
      res.send(cachedResponse.body);
    } else {
      createProxyMiddleware({
        target: proxyUrl,
        changeOrigin: true,
        pathRewrite: { '^/tiles': '' },
        onProxyRes: (proxyRes, req, res) => {
          const body = [];
          proxyRes.on('data', (chunk) => body.push(chunk));
          proxyRes.on('end', () => {
            const response = {
              headers: proxyRes.headers,
              body: Buffer.concat(body),
            };
            cache.set(cacheKey, response);
          });
        },
      })(req, res);
    }
  } else if (req.url === '/') {
    res.status(200).send('Hello from the proxy server!');
  } else {
    res.status(404).send('Not Found');
  }
};
