import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAuthRequest } from './server/authStore.js';
import { handleWorkspaceRequest } from './server/workspaceStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

app.all('/api/*', (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.url.split('?')[1] || '');
    const result =
      handleAuthRequest(req.method, req.path, req.body, req.headers.authorization) ||
      handleWorkspaceRequest(req.method, req.path, queryParams, req.body, req.headers.authorization);
    if (!result) {
      return res.status(404).json({ message: 'Endpoint not found.' });
    }
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[FormFlow Server Error]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FormFlow server running on http://0.0.0.0:${PORT}`);
});
