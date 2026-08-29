import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');
const scriptPath = path.join(projectRoot, 'mac', 'package-dmg.sh');
const installScriptPath = path.join(projectRoot, 'mac', 'install.sh');
const backgroundSvgPath = path.join(projectRoot, 'mac', 'dmg-background.svg');
const backgroundFileName = 'dmg-background.png';
const macOnly = process.platform === 'darwin' ? {} : { skip: 'DMG packaging requires macOS' };
const expectedPublicFiles = [
  'dokke.apk',
  'icon-192-dark.png',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'version.json'
];

let fixturePromise;
let fixture;

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 240_000,
    ...options
  });
}

function attach(imagePath) {
  const result = run('hdiutil', ['attach', imagePath, '-nobrowse', '-noautoopen']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const line = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.includes('/Volumes/'));
  assert.ok(line, `mount point not found in hdiutil output: ${result.stdout}`);
  return line.slice(line.indexOf('/Volumes/')).trim();
}

function detach(mountPoint) {
  if (!mountPoint) return;
  run('hdiutil', ['detach', mountPoint, '-force']);
}

function hasPosition(dsStore, x, y) {
  const needle = Buffer.alloc(8);
  needle.writeUInt32BE(x, 0);
  needle.writeUInt32BE(y, 4);
  return dsStore.includes(needle);
}

async function getFixture() {
  if (fixturePromise) return fixturePromise;

  fixturePromise = Promise.resolve().then(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dokke-dmg-layout-'));
    const imagePath = path.join(tempDir, 'Dokke-layout-test.dmg');
    const result = run('bash', [scriptPath, imagePath], { cwd: projectRoot });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    fixture = {
      imagePath,
      tempDir,
      mountPoint: attach(imagePath)
    };
    return fixture;
  });

  return fixturePromise;
}

function rootEntries(mountPoint) {
  return fs.readdirSync(mountPoint, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

function dsStore(mountPoint) {
  return fs.readFileSync(path.join(mountPoint, '.DS_Store'));
}

test.after(() => {
  if (fixture) {
    detach(fixture.mountPoint);
    fs.rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('@spec:AC-001 DMG monta normalmente', macOnly, async () => {
  const current = await getFixture();
  assert.ok(fs.existsSync(current.mountPoint));
});

test('@spec:AC-002 raiz contém apenas app e Applications visíveis', macOnly, async () => {
  const current = await getFixture();
  assert.deepEqual(rootEntries(current.mountPoint), ['Applications', 'Dokke.app']);
});

test('@spec:AC-003 Applications é symlink nativo para /Applications', macOnly, async () => {
  const current = await getFixture();
  const applications = path.join(current.mountPoint, 'Applications');
  assert.equal(fs.lstatSync(applications).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(applications), '/Applications');
});

test('@spec:AC-004 seta fica no fundo e não na raiz', macOnly, async () => {
  const current = await getFixture();
  const background = path.join(current.mountPoint, '.background', backgroundFileName);
  const backgroundSpec = fs.readFileSync(backgroundSvgPath, 'utf8');
  assert.ok(fs.existsSync(background));
  assert.match(backgroundSpec, /#f5f5f7/);
  assert.match(backgroundSpec, /M300 210 H420/);
  assert.ok(dsStore(current.mountPoint).includes(Buffer.from('.background')));
});

test('@spec:AC-005 posições persistem à esquerda e à direita', macOnly, async () => {
  const current = await getFixture();
  const store = dsStore(current.mountPoint);
  assert.equal(hasPosition(store, 170, 210), true);
  assert.equal(hasPosition(store, 570, 210), true);
});

test('@spec:AC-006 layout não depende de ordenação global', macOnly, async () => {
  const current = await getFixture();
  const store = dsStore(current.mountPoint).toString('latin1');
  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.match(store, /arrangeBy/);
  assert.match(store, /none/);
  assert.doesNotMatch(script, /set arrangement|Sort By|Ordenar por/);
});

test('@spec:AC-007 fundo e posições sobrevivem à remontagem', macOnly, async () => {
  const current = await getFixture();
  detach(current.mountPoint);
  current.mountPoint = attach(current.imagePath);
  assert.ok(fs.existsSync(path.join(current.mountPoint, '.background', backgroundFileName)));
  assert.equal(hasPosition(dsStore(current.mountPoint), 170, 210), true);
  assert.equal(hasPosition(dsStore(current.mountPoint), 570, 210), true);
});

test('@spec:AC-008 janela persiste composição compacta', macOnly, async () => {
  const current = await getFixture();
  assert.match(dsStore(current.mountPoint).toString('latin1'), /\{\{120, 120\}, \{640, 400\}\}/);
});

test('@spec:AC-009 app mantém servidor embutido e executável', macOnly, async () => {
  const current = await getFixture();
  const app = path.join(current.mountPoint, 'Dokke.app');
  assert.equal(fs.statSync(path.join(app, 'Contents', 'MacOS', 'Dokke')).mode & 0o111, 0o111);
  assert.ok(fs.existsSync(path.join(app, 'Contents', 'Resources', 'Dokke', 'server.js')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(app, 'Contents', 'Resources', 'Dokke', 'config.json'), 'utf8')), { pinned: [] });
});

test('@spec:AC-010 bash -n passa', async () => {
  execFileSync('bash', ['-n', scriptPath], { stdio: 'pipe' });
});

test('@spec:AC-011 não existe Arraste para instalar.png visível', macOnly, async () => {
  const current = await getFixture();
  assert.equal(fs.existsSync(path.join(current.mountPoint, 'Arraste para instalar.png')), false);
  assert.equal(rootEntries(current.mountPoint).some((name) => name.endsWith('.png')), false);
});

test('@spec:AC-012 bundle e DMG não carregam backups, logs ou arquivos ignorados de public', macOnly, async () => {
  const current = await getFixture();
  const appPaths = [
    path.join(projectRoot, 'mac', 'dist', 'Dokke.app'),
    path.join(current.mountPoint, 'Dokke.app')
  ];

  for (const app of appPaths) {
    const publicDir = path.join(app, 'Contents', 'Resources', 'Dokke', 'public');
    assert.deepEqual(fs.readdirSync(publicDir).sort(), expectedPublicFiles);
    assert.equal(fs.existsSync(path.join(publicDir, 'index.html.bak')), false);
    assert.equal(fs.readdirSync(publicDir).some((name) => /(?:\.bak|\.log)$/i.test(name)), false);
  }
});

test('@spec:AC-013 install.sh usa allowlist pública explícita', () => {
  const script = fs.readFileSync(installScriptPath, 'utf8');
  assert.match(script, /PUBLIC_FILES=\(/);
  assert.match(script, /public_file/);
  assert.doesNotMatch(script, /cp -R [^\n]*public/);
});

test('@spec:AC-343 install.sh verifica orçamento e runtime único no bundle Release', () => {
  const script = fs.readFileSync(installScriptPath, 'utf8');
  assert.match(script, /MAX_BUNDLE_SIZE_MB=121/);
  assert.match(script, /find .*node-bin\/node/);
  assert.match(script, /node_count.*-ne 1/);
  assert.match(script, /bundle_kib.*MAX_BUNDLE_SIZE_MB/);
});

test('builder do DMG não usa appdmg nem image-size vulneráveis', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotMatch(script, /appdmg|image-size/);
  assert.match(script, /hdiutil create/);
  assert.match(script, /write-dmg-ds-store\.mjs/);
});
