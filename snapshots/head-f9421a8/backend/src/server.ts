import express from 'express';
import app from './app.js';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(__dirname, '../../frontend'),
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
    });
  }

  app.listen(PORT, 'localhost', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
