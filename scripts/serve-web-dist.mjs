import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const host = process.env.HOST ?? '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function sendFile(response, filePath) {
  response.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=300',
  });

  createReadStream(filePath).pipe(response);
}

async function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalizedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.resolve(distDir, `.${normalizedPath}`);

  if (!filePath.startsWith(distDir)) {
    return null;
  }

  if (existsSync(filePath)) {
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      return filePath;
    }
  }

  return indexPath;
}

if (!existsSync(indexPath)) {
  console.error('Missing dist/index.html. Run `npm run build:web` first.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveRequestPath(request.url ?? '/');

    if (!filePath) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    sendFile(response, filePath);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(
      error instanceof Error ? error.message : 'Unexpected local preview server error.',
    );
  }
});

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}`);
});
