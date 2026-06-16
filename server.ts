import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import type { Socket } from 'node:net';
import { TLSSocket, createSecureContext } from 'node:tls';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { hostname, networkInterfaces } from 'node:os';

const projectRoot = resolve('.');
const distRoot = resolve('dist');
const root = existsSync(join(distRoot, 'index.html')) ? distRoot : projectRoot;
const port = Number.parseInt(process.env.PORT || '4173', 10);
const certPort = Number.parseInt(process.env.CERT_PORT || '4172', 10);
const useHttps = process.argv.includes('--https') || process.env.HTTPS === '1';
const useCertHelper = process.argv.includes('--cert-helper') || process.env.CERT_HELPER === '1';
const certPassphrase = process.env.LOCAL_CERT_PASSPHRASE || 'linx-local-dev';
const serverPfxPath = resolve('.cert', 'linx-local-server.pfx');
const caCerPath = resolve('.cert', 'linx-local-root-ca.cer');

const mimeTypes = new Map<string, string>([
  ['.cer', 'application/x-x509-ca-cert'],
  ['.crt', 'application/x-x509-ca-cert'],
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function resolveRequestPath(url: string): string | null {
  const parsed = new URL(url, `${useHttps ? 'https' : 'http'}://localhost:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const normalized = normalize(pathname).replace(/^([/\\])+/, '');
  const requestPath = pathname.endsWith('/') ? join(normalized, 'index.html') : normalized;
  const filePath = resolve(root, requestPath || 'index.html');
  const rel = relative(root, filePath);

  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }

  return filePath;
}

async function sendFile(filePath: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readFile(filePath);
  response.writeHead(200, {
    'content-type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  if (request.method === 'GET') {
    response.end(body);
  } else {
    response.end();
  }
}

async function handleAppRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  const filePath = resolveRequestPath(request.url || '/');
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    await sendFile(filePath, request, response);
  } catch {
    if (extname(filePath) === '') {
      try {
        await sendFile(join(root, 'index.html'), request, response);
        return;
      } catch (_fallbackError) {
        // Fall through to a normal 404.
      }
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

async function handleCertRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  const parsed = new URL(request.url || '/', `http://localhost:${certPort}`);
  if (parsed.pathname === '/certs/linx-local-ca.cer') {
    try {
      await sendFile(caCerPath, request, response);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('CA certificate not found. Run npm run cert:local first.');
    }
    return;
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(renderInstallPage());
}

async function handlePlainHttpOnHttpsPort(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const parsed = new URL(request.url || '/', `http://localhost:${port}`);
  if (parsed.pathname === '/certs/linx-local-ca.cer' || parsed.pathname === '/cert') {
    await handleCertRequest(request, response);
    return;
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(renderInstallPage());
}

function renderInstallPage(): string {
  const host = hostname();
  const localName = `${host}.local`;
  const ipAddresses = localAddresses().filter((address) => address !== '127.0.0.1');
  const primaryIp = ipAddresses[0] || '127.0.0.1';
  const links: Array<[string, string]> = [
    ['HTTPS через ThinkPad .local', `https://${localName}:${port}/`],
    ['Сертификат через ThinkPad .local', `http://${localName}:${port}/certs/linx-local-ca.cer`],
    ['HTTPS через IP', `https://${primaryIp}:${port}/`],
    ['Сертификат через IP', `http://${primaryIp}:${port}/certs/linx-local-ca.cer`],
    ['Профили iOS', 'App-Prefs:root=General&path=ManagedConfigurationList'],
    ['Full Trust iOS', 'App-Prefs:root=General&path=About/CERT_TRUST_SETTINGS'],
  ];

  const rows = links.map(([label, url]) => copyRow(label, url)).join('');

  return `<!doctype html>
<html lang="ru">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinX Local HTTPS</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 18px; color: #182326; background: #f4f7f8; line-height: 1.45; }
    main { max-width: 760px; margin: 0 auto; }
    h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.05; }
    h2 { margin: 22px 0 10px; font-size: 18px; }
    p { margin: 8px 0; }
    .card { padding: 14px; border: 1px solid #d8e2e3; border-radius: 8px; background: #fff; }
    .row { display: grid; gap: 7px; margin: 12px 0; }
    .label { font-weight: 800; color: #334246; }
    .copy-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    input { width: 100%; min-width: 0; height: 42px; padding: 0 10px; border: 1px solid #cbd8da; border-radius: 8px; font: 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    button, .button { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border: 0; border-radius: 8px; background: #007b78; color: #fff; font-weight: 800; text-decoration: none; }
    .secondary { background: #eef5f4; color: #005f5d; }
    .note { color: #607076; font-size: 14px; }
    .warn { color: #7a3b00; }
  </style>
  <body>
  <main>
    <h1>LinX Local HTTPS</h1>
    <div class="card">
      <p>Сначала установите сертификат, затем включите полное доверие, потом откройте HTTPS-ссылку.</p>
      <p class="note">Основной вариант для iPhone: <strong>ThinkPad .local</strong>, потому что iOS надежнее проверяет DNS-имя, чем IP.</p>
      ${rows}
    </div>

    <h2>Порядок на iPhone</h2>
    <div class="card">
      <p>1. Откройте ссылку сертификата и установите профиль.</p>
      <p>2. Нажмите <strong>Full Trust iOS</strong> или вручную откройте:</p>
      <p class="note">Settings -> General -> About -> Certificate Trust Settings -> LinX Local Root CA -> Enable Full Trust</p>
      <p>3. Откройте HTTPS через ThinkPad .local.</p>
      <p class="note warn">Если ссылки Settings не открываются в WebBLE-браузере, откройте настройки вручную. iOS иногда блокирует deep links из сторонних браузеров.</p>
    </div>

    <script>
      document.querySelectorAll('[data-copy]').forEach(function (button) {
        button.addEventListener('click', function () {
          var input = document.getElementById(button.getAttribute('data-copy'));
          input.focus();
          input.select();
          try { document.execCommand('copy'); } catch (_error) {}
          button.textContent = 'Скопировано';
          setTimeout(function () { button.textContent = 'Копировать'; }, 1400);
        });
      });
    </script>
  </main>
  </body>
</html>`;
}

function copyRow(label: string, url: string): string {
  const id = `copy-${Math.random().toString(36).slice(2)}`;
  const escapedUrl = escapeHtml(url);
  return `<div class="row">
    <div class="label">${escapeHtml(label)}</div>
    <div class="copy-line">
      <input id="${id}" value="${escapedUrl}" readonly>
      <button type="button" data-copy="${id}">Копировать</button>
    </div>
    <a class="button secondary" href="${escapedUrl}">Открыть</a>
  </div>`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function localAddresses(): string[] {
  const addresses = new Set(['127.0.0.1']);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) {
        addresses.add(entry.address);
      }
    }
  }
  return Array.from(addresses);
}

function localDnsNames(): string[] {
  const host = hostname();
  return ['localhost', host, `${host}.local`];
}

function logUrls(protocol: 'http' | 'https', listenPort: number, label: string): void {
  console.log(label);
  for (const address of localAddresses()) {
    console.log(`  ${protocol}://${address}:${listenPort}/`);
  }
  for (const name of localDnsNames()) {
    console.log(`  ${protocol}://${name}:${listenPort}/`);
  }
}

if (useHttps) {
  let pfx: Buffer;
  try {
    pfx = await readFile(serverPfxPath);
  } catch {
    console.error('HTTPS certificate not found. Run: npm run cert:local');
    process.exit(1);
  }

  if (useCertHelper) {
    const secureContext = createSecureContext({ pfx, passphrase: certPassphrase });
    const tlsAppServer = createHttpServer(handleAppRequest);
    const samePortHttpServer = createHttpServer(handlePlainHttpOnHttpsPort);

    createTcpServer((socket: Socket) => {
      socket.once('data', (chunk: Buffer) => {
        socket.pause();
        socket.unshift(chunk);
        if (chunk[0] === 0x16) {
          const tlsSocket = new TLSSocket(socket, { isServer: true, secureContext });
          tlsSocket.on('error', () => socket.destroy());
          tlsAppServer.emit('connection', tlsSocket);
          tlsSocket.resume();
          return;
        } else {
          samePortHttpServer.emit('connection', socket);
        }
        socket.resume();
      });
    }).listen(port, '0.0.0.0', () => {
      logUrls('https', port, 'LinX reset web app HTTPS:');
      logUrls('http', port, 'Same-port certificate installer:');
    });

    createHttpServer(handleCertRequest).listen(certPort, '0.0.0.0', () => {
      logUrls('http', certPort, 'Local CA install helper:');
    });
  } else {
    createHttpsServer({ pfx, passphrase: certPassphrase }, handleAppRequest).listen(port, '0.0.0.0', () => {
      logUrls('https', port, 'LinX reset web app HTTPS:');
    });
  }
} else {
  createHttpServer(handleAppRequest).listen(port, '0.0.0.0', () => {
    logUrls('http', port, 'LinX reset web app HTTP:');
  });
}
