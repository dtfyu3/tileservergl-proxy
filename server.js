const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // Кэш на 1 час
const path = require('path');
const { spawn } = require('cross-spawn');
const fs = require('fs');
require('dotenv').config();

const app = express();

const proxyUrl = process.env.PROXY_URL
app.use('/tiles', (req, res, next) => {
    const cacheKey = req.originalUrl;
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
                        body: Buffer.concat(body)
                    };
                    cache.set(cacheKey, response);
                });
            }
        })(req, res, next);
    }
});

app.listen(3000, () => {
    console.log('Прокси-сервер запущен на http://localhost:3000');
});

process.on('SIGINT', () => {
    console.log('Завершение работы...');
    tileserverProcess.kill(); // Завершить tileserver-gl
    process.exit();
});
