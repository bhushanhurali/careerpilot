import { spawnSync } from 'node:child_process';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'careerpilot-production-smoke-'));
const override = join(scratch, 'compose.json');
const envFile = join(scratch, 'empty.env');
const project = `careerpilot-smoke-${randomBytes(5).toString('hex')}`;
const prefix = `172.${randomInt(19, 32)}.${randomInt(1, 255)}`;
const password = randomBytes(24).toString('hex');
const storageId = randomUUID();
const key = randomUUID();
const accessSecret = randomBytes(32).toString('hex');
const refreshSecret = randomBytes(32).toString('hex');

writeFileSync(envFile, '');
writeFileSync(
  override,
  JSON.stringify({
    services: {
      backend: { volumes: ['smoke_resumes:/var/lib/careerpilot/resumes'] },
    },
    volumes: { smoke_resumes: {} },
  }),
);

function compose(args, expectedStatus = 0, input) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '--env-file',
      envFile,
      '-f',
      'docker-compose.prod.yml',
      '-f',
      override,
      ...args,
    ],
    {
      cwd: root,
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
      input,
      timeout: 300_000,
      env: {
        ...process.env,
        POSTGRES_DB: 'careerpilot_smoke',
        POSTGRES_USER: 'careerpilot',
        POSTGRES_PASSWORD: password,
        DATABASE_URL: `postgres://careerpilot:${password}@postgres/careerpilot_smoke`,
        JWT_ACCESS_SECRET: accessSecret,
        JWT_REFRESH_SECRET: refreshSecret,
        TRUSTED_PROXY_IP: `${prefix}.10`,
        PROXY_SUBNET: `${prefix}.0/24`,
        RESUME_HOST_DIR: scratch,
        RESUME_STORAGE_ID: storageId,
        REGISTRATION_ENABLED: 'false',
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== expectedStatus)
    throw new Error(
      `${args.slice(0, 2).join(' ')} exited with ${result.status}, expected ${expectedStatus}`,
    );
}

try {
  compose(['config', '--quiet']);
  compose(['build', 'backend']);
  compose([
    'run',
    '--rm',
    '--no-deps',
    'caddy',
    'caddy',
    'validate',
    '--config',
    '/etc/caddy/Caddyfile',
  ]);
  compose(['up', '-d', '--wait', 'postgres']);
  compose([
    'run',
    '--rm',
    '--no-deps',
    '--user',
    '0',
    'backend',
    'sh',
    '-ec',
    'cd "$RESUME_STORAGE_DIR"; umask 077; printf "%s\\n" "$RESUME_STORAGE_ID" > .storage-id; chown 1000:1000 . .storage-id; chmod 0700 .',
  ]);
  compose(['run', '--rm', '--no-deps', 'backend'], 1);
  compose(['run', '--rm', '--no-deps', 'backend', 'node', 'dist/db/migrate.js', 'up']);
  const ledger = (from, to) =>
    compose([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'careerpilot',
      '-d',
      'careerpilot_smoke',
      '-c',
      `UPDATE "SequelizeMeta" SET name = replace(name, '.${from}', '.${to}');`,
    ]);
  ledger('js', 'ts');
  compose(['run', '--rm', '--no-deps', 'backend', 'node', 'dist/db/migrate.js', 'up'], 1);
  ledger('ts', 'js');
  compose(['run', '--rm', '--no-deps', 'backend', 'node', 'dist/db/migrate.js', 'up']);
  compose(['run', '--rm', '--no-deps', '-e', `RESUME_STORAGE_ID=${randomUUID()}`, 'backend'], 1);
  compose(['up', '-d', '--wait', 'backend']);
  const accountPassword = randomBytes(24).toString('hex');
  const accountArgs = [
    'run',
    '--rm',
    '--no-deps',
    '-T',
    'backend',
    'node',
    'dist/modules/auth/create-account.js',
    'smoke@example.com',
    'Smoke',
    'Test',
  ];
  compose(accountArgs, 0, accountPassword);
  compose(accountArgs, 1, accountPassword);
  compose(
    [
      'exec',
      '-T',
      'backend',
      'node',
      '--input-type=module',
      '-e',
      `
    import { readFileSync } from 'node:fs';
    const auth = 'http://127.0.0.1:3000/api/v1/auth';
    const post = (route, body) => fetch(auth + route, { method: 'POST', headers: { Origin: 'https://jobthreader.com', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const policy = await (await fetch(auth + '/registration')).json();
    if (policy.data?.registrationEnabled !== false) throw Error('Expected disabled registration');
    const signup = await post('/register', {});
    if (signup.status !== 403 || (await signup.json()).error?.code !== 'REGISTRATION_DISABLED') throw Error('Public signup was not denied');
    const login = await post('/login', { email: 'smoke@example.com', password: readFileSync(0, 'utf8') });
    if (!login.ok) throw Error('Provisioned account could not sign in');
  `,
    ],
    0,
    accountPassword,
  );
  compose([
    'exec',
    '-T',
    'backend',
    'sh',
    '-ec',
    'cd "$RESUME_STORAGE_DIR"; mv .storage-id .storage-id.bak; trap "mv .storage-id.bak .storage-id" EXIT; node -e \'fetch("http://127.0.0.1:3000/ready").then(r => { if (r.status !== 503) process.exitCode = 1 })\'',
  ]);
  const storageImport = `import { LocalResumeStorage } from './dist/modules/resumes/resume.storage.js'; const storage = new LocalResumeStorage(); const key = '${key}';`;
  compose([
    'exec',
    '-T',
    'backend',
    'node',
    '--input-type=module',
    '-e',
    `${storageImport} if (process.getuid() !== 1000) throw Error('Unexpected runtime UID'); await storage.put(key, new TextEncoder().encode('persistent'));`,
  ]);
  compose(['up', '-d', '--wait', '--force-recreate', '--no-deps', 'backend']);
  compose([
    'exec',
    '-T',
    'backend',
    'node',
    '--input-type=module',
    '-e',
    `${storageImport} import { text } from 'node:stream/consumers'; if (await text(await storage.open(key)) !== 'persistent') throw Error('Storage did not persist'); await storage.remove(key); await storage.remove(key);`,
  ]);
  console.log('Production runtime smoke checks passed.');
} finally {
  try {
    compose(['down', '--volumes', '--remove-orphans']);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
