import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SPRING_BACKEND_URL = (process.env.SPRING_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');

app.disable('x-powered-by');
app.use('/api', express.raw({ type: '*/*', limit: '10mb' }));

app.all('/api/*', async (req, res) => {
  if (req.headers['x-formflow-proxy-hop']) {
    return res.status(503).json({
      message:
        'Unable to reach the Spring Boot backend. Ensure the Spring Boot API and MySQL server are running.',
    });
  }

  try {
    const targetUrl = new URL(req.originalUrl, `${SPRING_BACKEND_URL}/`);
    const headers = {
      'X-FormFlow-Proxy-Hop': '1',
    };
    if (req.headers['content-type']) {
      headers['Content-Type'] = String(req.headers['content-type']);
    }
    if (req.headers.accept) {
      headers['Accept'] = String(req.headers.accept);
    }
    if (req.headers.authorization) {
      headers['Authorization'] = String(req.headers.authorization);
    }

    const method = req.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0;

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: 'manual',
    });

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', contentType);
    return res.send(responseBuffer);
  } catch (err) {
    console.error('[FormFlow Proxy Error]', err?.message || err);
    return res.status(502).json({
      message:
        'Unable to reach the Spring Boot backend. Ensure the Spring Boot API and MySQL server are running.',
    });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FormFlow frontend server running on http://0.0.0.0:${PORT} (API proxy -> ${SPRING_BACKEND_URL})`);
});
