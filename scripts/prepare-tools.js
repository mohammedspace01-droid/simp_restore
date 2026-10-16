/* Downloads the official, portable Exoprobe release and stages FFmpeg for offline use.
 * This preparation step needs internet once. The packaged application does not.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const os = require('os');

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor');
const exoDir = path.join(vendor, 'exoprobe');
const archive = path.join(os.tmpdir(), 'exoprobe-v0.2.0-windows-x64.zip');
const url = 'https://github.com/abrignoni/exoprobe/releases/download/v0.2.0/exoprobe-v0.2.0-windows-x64.zip';

function download(urlToGet, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlToGet, { headers: { 'User-Agent': 'SimpRestore-build' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); return resolve(download(res.headers.location, dest, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Download failed: HTTP ${res.statusCode}`)); }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

function findFile(dir, regex) {
  if (!fs.existsSync(dir)) return null;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isFile() && regex.test(ent.name)) return p;
    if (ent.isDirectory()) { const got = findFile(p, regex); if (got) return got; }
  }
  return null;
}

(async () => {
  fs.mkdirSync(vendor, { recursive: true });
  if (!findFile(exoDir, /^exoprobe\.exe$/i)) {
    console.log('Downloading official Exoprobe v0.2.0 for Windows x64…');
    await download(url, archive);
    fs.rmSync(exoDir, { recursive: true, force: true });
    fs.mkdirSync(exoDir, { recursive: true });
    const ps = `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${exoDir.replace(/'/g, "''")}' -Force`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Could not extract Exoprobe. Try extracting its official ZIP into vendor/exoprobe manually.');
  } else console.log('Using existing Exoprobe tool.');

  const exo = findFile(exoDir, /^exoprobe\.exe$/i);
  if (!exo) throw new Error('exoprobe.exe was not found in the official release archive.');
  if (path.resolve(exo) !== path.resolve(path.join(exoDir, 'exoprobe.exe'))) fs.copyFileSync(exo, path.join(exoDir, 'exoprobe.exe'));
  console.log('Exoprobe ready:', path.join(exoDir, 'exoprobe.exe'));

  if (process.platform !== 'win32') throw new Error('Prepare the Windows app on Windows, or use the included Windows GitHub Actions workflow.');
  let ffmpeg;
  try { ffmpeg = require('ffmpeg-static'); } catch { /* clearer message below */ }
  if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('ffmpeg-static is missing. Run npm install first.');
  if (process.platform !== 'win32' && !ffmpeg.toLowerCase().endsWith('.exe')) {
    console.warn('Build this project on Windows to prepare a Windows FFmpeg executable.');
  }
  const stagedFfmpeg = path.join(vendor, 'ffmpeg.exe');
  fs.copyFileSync(ffmpeg, stagedFfmpeg);
  const ffmpegPackageDir = path.dirname(require.resolve('ffmpeg-static/package.json'));
  const ffmpegLicense = path.join(ffmpegPackageDir, 'LICENSE');
  if (fs.existsSync(ffmpegLicense)) {
    fs.copyFileSync(ffmpegLicense, path.join(vendor, 'FFMPEG-LICENSE.txt'));
    console.log('Copied ffmpeg-static license to vendor/FFMPEG-LICENSE.txt');
  } else {
    throw new Error('ffmpeg-static package LICENSE was not found. Refusing to build a distributable package without the binary license.');
  }
  const audit = [];
  for (const args of [['-version'], ['-buildconf'], ['-L']]) {
    const result = spawnSync(stagedFfmpeg, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    audit.push(`$ ffmpeg.exe ${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}`);
    if (result.error) audit.push(`Command warning: ${result.error.message}`);
  }
  audit.push('\nSimpRestore does not modify this executable. Verify the exact binary source, build options, and applicable redistribution obligations before publishing release binaries.');
  fs.writeFileSync(path.join(vendor, 'FFMPEG-BUILD-INFO.txt'), audit.join('\n\n'), 'utf8');
  console.log('Recorded FFmpeg version, build configuration, and license summary.');
  console.log('FFmpeg ready. Runtime processing will work offline.');
})().catch(err => { console.error('\nPrepare tools failed:', err.message); process.exit(1); });
