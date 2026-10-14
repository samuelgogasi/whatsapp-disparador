import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const migration = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
const exitCode = await new Promise((resolve, reject) => { migration.once('error', reject); migration.once('exit', resolve); });
if (exitCode !== 0) process.exit(typeof exitCode === 'number' ? exitCode : 1);
const server = spawn(process.execPath, [fileURLToPath(new URL('../dist/server.js', import.meta.url))], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.once('error', () => process.exit(1));
server.once('exit', (code) => process.exit(code ?? 1));
