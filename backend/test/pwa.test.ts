import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const asset = (name: string) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
test('worker mantém APIs e administração na rede, com fallback somente para navegação pública', async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const cached: string[] = [];
  const deleted: string[] = [];
  const fallback = new Response('offline');
  const cache = { addAll: async (urls: string[]) => cached.push(...urls), match: async () => fallback };
  vm.runInNewContext(await asset('sw.js'), {
    self: { location: { origin: 'https://app.test' }, addEventListener: (type: string, handler: any) => { handlers[type] = handler; } },
    caches: { open: async () => cache, keys: async () => ['em-pauta-offline-old', 'other-app'], delete: async (key: string) => deleted.push(key) },
    fetch: async () => { throw new Error('offline'); }, URL, Response,
  });
  let pending: Promise<unknown> | undefined;
  handlers.install({ waitUntil: (work: Promise<unknown>) => { pending = work; } }); await pending;
  assert.deepEqual(cached, ['/offline.html', '/offline.css', '/icons/icon-192.png']);
  handlers.activate({ waitUntil: (work: Promise<unknown>) => { pending = work; } }); await pending;
  assert.deepEqual(deleted, ['em-pauta-offline-old']);
  for (const [path, method, mode] of [['/api/me','GET','cors'], ['/api/campaigns','POST','cors'], ['/admin.html','GET','navigate'], ['/client.js','GET','cors'], ['https://external.test/','GET','navigate']]) {
    let intercepted = false;
    handlers.fetch({ request: { url: new URL(path, 'https://app.test').href, method, mode }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
  let response: Promise<Response> | undefined;
  handlers.fetch({ request: { url: 'https://app.test/', method: 'GET', mode: 'navigate' }, respondWith: (work: Promise<Response>) => { response = work; } });
  assert.equal(await response, fallback);
});
test('manifest inicia no painel e ícones PNG estão disponíveis nas dimensões declaradas', async () => {
  const manifest = JSON.parse(await asset('manifest.webmanifest'));
  assert.equal(manifest.start_url, '/'); assert.equal(manifest.display, 'standalone');
  for (const [name, size] of [['apple-touch-icon.png',180], ['icon-192.png',192], ['icon-512.png',512]] as const) {
    const png = await readFile(new URL(`../public/icons/${name}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
