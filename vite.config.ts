import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import aiHandler from './api/ai';

const readRequestBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
};

const writeResponse = async (
  source: Response,
  target: ServerResponse,
): Promise<void> => {
  target.statusCode = source.status;
  source.headers.forEach((value, key) => {
    target.setHeader(key, value);
  });

  const buffer = Buffer.from(await source.arrayBuffer());
  target.end(buffer);
};

const createApiRequest = async (req: IncomingMessage): Promise<Request> => {
  const method = req.method ?? 'GET';
  const host = req.headers.host ?? 'localhost:5173';
  const origin = req.headers.origin ?? `http://${host}`;
  const url = new URL(req.url ?? '/', origin);
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }

  const body = await readRequestBody(req);
  return new Request(url, { method, headers, body });
};

const devApiProxyPlugin = (): Plugin => {
  return {
    name: 'telepath-dev-api-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname !== '/api/ai') {
          next();
          return;
        }

        const handleApiRequest = async (
          apiReq: IncomingMessage,
          apiRes: ServerResponse,
        ) => {
          try {
            const request = await createApiRequest(apiReq);
            const response = await aiHandler(request);
            await writeResponse(response, apiRes);
          } catch (error: unknown) {
            console.error('Local /api/ai proxy failed', error);
            apiRes.statusCode = 500;
            apiRes.setHeader('content-type', 'application/json');
            apiRes.end(
              JSON.stringify({
                ok: false,
                error: 'Local API proxy failed.',
              }),
            );
          }
        };

        void handleApiRequest(req, res);
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), devApiProxyPlugin()],
});
