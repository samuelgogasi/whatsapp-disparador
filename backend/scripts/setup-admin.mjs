import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

let contents;
try { contents = await readFile('.env', 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; contents = await readFile('.env.example', 'utf8'); }
const current = contents.match(/^ADMIN_API_TOKEN=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
if (current && current.length >= 32) {
  console.log('O token administrativo já está configurado em .env. Foi preservado.');
} else {
  const entry = `ADMIN_API_TOKEN=${randomBytes(32).toString('base64url')}`;
  contents = /^ADMIN_API_TOKEN=.*$/m.test(contents) ? contents.replace(/^ADMIN_API_TOKEN=.*$/m, entry) : `${contents.trimEnd()}\n${entry}\n`;
  await writeFile('.env', contents, { mode: 0o600 });
  console.log('Token administrativo gerado e salvo em .env. Use esse valor em /admin.html. Não o compartilhe com clientes.');
}
