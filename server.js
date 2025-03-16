const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // Кэш на 1 час
const path = require('path');
const { spawn } = require('cross-spawn');
const fs = require('fs');

const app = express();

const configPath = path.join(__dirname, 'tileserver', 'config.json');
console.log(`Путь к config.json: ${configPath}`);


if (!fs.existsSync(configPath)) {
    console.error(`Файл config.json не найден по пути: ${configPath}`);
    process.exit(1);
}

const mbtilesPath = path.join(__dirname, 'tileserver', 'localized_with_temps.mbtiles');
if (!fs.existsSync(mbtilesPath)) {
    console.error(`Файл localized_with_temps.mbtiles не найден по пути: ${mbtilesPath}`);
    process.exit(1);
}

// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.url}`);
//     next();
// });
const tileserverProcess = spawn(
    'npx',
    [
        'tileserver-gl',
        '--config',
        path.join(__dirname, 'tileserver', 'config.json')
    ],
    { stdio: 'inherit' }
);
tileserverProcess.on('spawn', () => {
    console.log('tileserver-gl запущен');
})
tileserverProcess.stdout?.on('data', (data) => {
    console.log(`tileserver-gl: ${data}`);
});

tileserverProcess.stderr?.on('data', (data) => {
    console.error(`tileserver-gl error: ${data}`);
});

tileserverProcess.on('close', (code) => {
    console.log(`tileserver-gl завершил работу с кодом ${code}`);
});

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

app.listen(3000, () => {
    console.log('Прокси-сервер запущен на http://localhost:3000');
});

process.on('SIGINT', () => {
    console.log('Завершение работы...');
    tileserverProcess.kill(); // Завершить tileserver-gl
    process.exit();
});