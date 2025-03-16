const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // Кэш на 1 час

const app = express();

app.use('/tiles', (req, res, next) => {
    const cacheKey = req.originalUrl;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
        res.set(cachedResponse.headers);
        res.send(cachedResponse.body);
    } else {
        createProxyMiddleware({
            target: 'http://localhost:8080',
            changeOrigin: true,
            pathRewrite: { '^/tiles': '' },
            onProxyRes: (proxyRes, req, res) => {
                const body = [];
                proxyRes.on('data', (chunk) => body.push(chunk));
                proxyRes.on('end', () => {
                    const response = {
                        headers: proxyRes.headers,
                        body: Buffer.concat(body)
                    };
                    cache.set(cacheKey, response);
                });
            }
        })(req, res, next);
    }
});
app.get('/', (req, res) => {
    res.send('Прокси-сервер работает!');
});
app.listen(3000, () => {
    console.log('Прокси-сервер запущен на http://localhost:3000');
});
export default app;
