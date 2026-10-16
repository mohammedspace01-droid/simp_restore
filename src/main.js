const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const yauzl = require('yauzl');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const initSqlJs = require('sql.js');
const { pathToFileURL } = require('url');

const APP_VERSION = app.getVersion();
const MAX_ARCHIVE_ENTRIES = 250000;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wav', '.aiff', '.aif', '.webm', '.mp4', '.wma', '.ape', '.wv', '.mka', '.mkv', '.caf', '.alac']);
let mainWindow;
let SQL;
let parseAudioFile;
let settingsPath;
let settings = { libraryDirectory: '', language: 'en', convertToMp3: true, keepOriginals: false };

function emitProgress(stage, percent, message, detail = '') {
  mainWindow?.webContents.send('process:progress', { stage, percent, message, detail });
}
function emitLocalScan(done, total, file = '') {
  mainWindow?.webContents.send('local-scan:progress', { done, total, file });
}
function ensureWindow() {
  mainWindow = new BrowserWindow({
    width: 1450, height: 930, minWidth: 980, minHeight: 670,
    backgroundColor: '#0d0f14', title: 'SimpRestore', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.SIMPRESTORE_DEVTOOLS === '1') mainWindow.webContents.openDevTools();
}
function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch {}
    throw error;
  }
}
function cleanName(value, max = 150) {
  return String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/[. ]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || 'Untitled';
}
function parseArtists(value) {
  if (!value) return 'Unknown artist';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).join(', ') || 'Unknown artist';
  } catch {}
  return String(value).trim() || 'Unknown artist';
}
function normalizedVideoId(value) {
  if (!value) return '';
  let key = String(value).trim();
  if (key.startsWith('Video') && key.length > 11) key = key.slice(5);
  if (/^[A-Za-z0-9_-]{11}$/.test(key)) return key;
  try {
    const u = new URL(key);
    const v = u.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  } catch {}
  return key;
}
function isSqlite(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    return b.toString('ascii') === 'SQLite format 3\u0000';
  } catch { return false; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
function walk(dir, opts = {}, result = []) {
  const maxFiles = opts.maxFiles || 250000;
  if (result.length >= maxFiles) return result;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return result; }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, opts, result);
    else if (ent.isFile()) result.push(full);
    if (result.length >= maxFiles) break;
  }
  return result;
}
function trackPath(track, directory) {
  if (track?.sourcePath) return path.resolve(track.sourcePath);
  return path.join(directory, track?.fileName || '');
}
function trackExists(track, directory) {
  try { return !!track?.fileName && fs.existsSync(trackPath(track, directory)) && fs.statSync(trackPath(track, directory)).isFile(); }
  catch { return false; }
}
async function locateMusicDb(root) {
  const files = walk(root);
  const likely = files.filter(f => /music database/i.test(path.basename(f)) || /music.*\.db$/i.test(f));
  const others = files.filter(f => !likely.includes(f) && (f.toLowerCase().endsWith('.db') || isSqlite(f)));
  for (const file of [...likely, ...others]) {
    if (!isSqlite(file)) continue;
    try {
      const db = new SQL.Database(fs.readFileSync(file));
      const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='song'");
      db.close();
      if (names.length) return file;
    } catch {}
  }
  return null;
}
function loadSongIndex(dbFile) {
  const out = new Map();
  const db = new SQL.Database(fs.readFileSync(dbFile));
  try {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='song'");
    if (!tables.length) throw new Error('The Music Database does not contain the expected song table.');
    const rows = db.exec('SELECT videoId, title, artistName, albumName, durationSeconds, thumbnails FROM song');
    if (!rows.length) return out;
    for (const row of rows[0].values) {
      const [rawId, title, artists, album, duration, thumbnail] = row;
      const id = normalizedVideoId(rawId);
      if (id) out.set(id, {
        videoId: id, title: String(title || 'Untitled'), artists: parseArtists(artists),
        album: String(album || ''), durationSeconds: Number(duration || 0), thumbnail: String(thumbnail || '')
      });
    }
  } finally { db.close(); }
  return out;
}
function locateExoprobe() {
  const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  const candidates = [path.join(base, 'exoprobe', 'exoprobe.exe'), path.join(base, 'vendor', 'exoprobe', 'exoprobe.exe'), path.join(base, 'exoprobe.exe')];
  return candidates.find(p => fs.existsSync(p)) || null;
}
function locateFfmpeg() {
  const candidates = [path.join(process.resourcesPath, 'ffmpeg.exe'), path.join(path.resolve(__dirname, '..'), 'vendor', 'ffmpeg.exe')];
  return candidates.find(p => fs.existsSync(p)) || null;
}
function runChild(exe, args, cwd, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, windowsHide: true, shell: false });
    let stdout = '', stderr = '', settled = false;
    child.stdout?.on('data', d => { const s = d.toString(); stdout += s; onOutput?.(s, 'stdout'); });
    child.stderr?.on('data', d => { const s = d.toString(); stderr += s; onOutput?.(s, 'stderr'); });
    child.on('error', e => { if (!settled) { settled = true; reject(e); } });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(exe)} exited with code ${code}.\n${stderr || stdout}`));
    });
  });
}
function openZip(zipPath) {
  return yauzl.openPromise(zipPath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true });
}
function safeZipTarget(root, rawName) {
  const name = String(rawName || '').replace(/\\/g, '/');
  if (!name || name === '.' || name === './') return path.resolve(root);
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some(part => part === '..')) {
    throw new Error('This backup contains an unsafe archive path and was not extracted.');
  }
  const target = path.resolve(root, ...name.split('/').filter(Boolean));
  const relative = path.relative(path.resolve(root), target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('This backup contains an unsafe archive path and was not extracted.');
  }
  return target;
}
async function inspectArchive(zipPath, onEntry) {
  const zip = await openZip(zipPath);
  let entries = 0, bytes = 0, cacheBytes = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      entries++;
      if (entries > MAX_ARCHIVE_ENTRIES) throw new Error(`This archive contains more than ${MAX_ARCHIVE_ENTRIES.toLocaleString('en-US')} entries; refusing to continue for safety.`);
      safeZipTarget(path.dirname(path.resolve(zipPath)), entry.fileName);
      const entryBytes = Number(entry.uncompressedSize || 0);
      bytes += entryBytes;
      const parts = String(entry.fileName || '').replace(/\\/g, '/').split('/').filter(Boolean);
      if (parts.some(part => part.toLowerCase() === 'download')) cacheBytes += entryBytes;
      if (bytes > MAX_ARCHIVE_BYTES) throw new Error('This backup expands beyond the 100 GB safety limit.');
      if (entries % 500 === 0) onEntry?.(entries);
    }
  } finally { try { zip.close(); } catch {} }
  if (!entries) throw new Error('The selected backup archive is empty or unreadable.');
  return { entries, bytes, cacheBytes };
}
async function extractBackupZip(zipPath, destination, totals, onProgress) {
  const zip = await openZip(zipPath);
  let completedBytes = 0, completedEntries = 0, lastUpdate = 0;
  fs.mkdirSync(destination, { recursive: true });
  try {
    for await (const entry of zip.eachEntry()) {
      if (completedEntries >= MAX_ARCHIVE_ENTRIES) throw new Error('Archive entry limit exceeded.');
      const target = safeZipTarget(destination, entry.fileName);
      const normalized = String(entry.fileName || '').replace(/\\/g, '/');
      const isDirectory = normalized.endsWith('/');
      if (target === path.resolve(destination) && !isDirectory) { completedEntries++; continue; }
      if (isDirectory) {
        fs.mkdirSync(target, { recursive: true });
        completedEntries++;
        const now = Date.now();
        if (now - lastUpdate > 140 || completedEntries === totals.entries) {
          lastUpdate = now;
          onProgress(completedBytes, totals.bytes, completedEntries, totals.entries, normalized);
        }
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      let entryBytes = 0;
      const readStream = await zip.openReadStreamPromise(entry);
      const meter = new Transform({
        transform(chunk, _encoding, callback) {
          entryBytes += chunk.length;
          const now = Date.now();
          if (now - lastUpdate > 140) {
            lastUpdate = now;
            onProgress(completedBytes + entryBytes, totals.bytes, completedEntries, totals.entries, normalized);
          }
          callback(null, chunk);
        }
      });
      try {
        await pipeline(readStream, meter, fs.createWriteStream(target, { flags: 'w' }));
      } catch (error) {
        try { fs.unlinkSync(target); } catch {}
        throw error;
      }
      completedBytes += entryBytes;
      completedEntries++;
      onProgress(completedBytes, totals.bytes, completedEntries, totals.entries, normalized);
    }
  } finally { try { zip.close(); } catch {} }
  onProgress(totals.bytes, totals.bytes, totals.entries, totals.entries, 'Extraction complete');
}
async function findReport(outDir) {
  const report = path.join(outDir, 'report.json');
  if (fs.existsSync(report)) return report;
  return walk(outDir).find(f => path.basename(f).toLowerCase() === 'report.json') || null;
}
function resolveRecoveredFile(outDir, record) {
  if (!record.file) return null;
  const candidates = [path.join(outDir, String(record.folder || ''), record.file), path.join(outDir, record.file)];
  for (const candidate of candidates) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return walk(outDir).find(p => path.basename(p) === record.file) || null;
}
function inferExt(file) {
  const ext = path.extname(file).toLowerCase();
  return ['.mp4', '.webm', '.m4a', '.mp3', '.aac', '.ogg', '.opus', '.flac', '.wav', '.ts', '.mkv', '.wma', '.ape', '.wv'].includes(ext) ? ext : '.bin';
}
function trackMime(record) {
  try { return new URL(record.redirected_to || '').searchParams.get('mime') || ''; } catch { return ''; }
}
function chooseRecord(records) {
  const complete = records.filter(r => String(r.state || '').toLowerCase() === 'complete' && r.file);
  if (!complete.length) return null;
  complete.sort((a, b) => {
    const am = trackMime(a).startsWith('audio/') ? 1 : 0;
    const bm = trackMime(b).startsWith('audio/') ? 1 : 0;
    if (am !== bm) return bm - am;
    return Number(b.bytes || 0) - Number(a.bytes || 0);
  });
  return complete[0];
}
function uniqueFileName(dir, base, ext, used = new Set()) {
  let candidate = `${base}${ext}`;
  let n = 2;
  while (used.has(candidate.toLowerCase()) || fs.existsSync(path.join(dir, candidate))) candidate = `${base} (${n++})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
function copyFileWithCleanup(source, target) {
  const partial = `${target}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.partial`;
  try {
    fs.copyFileSync(source, partial, fs.constants.COPYFILE_EXCL);
    fs.renameSync(partial, target);
  } catch (error) {
    try { fs.unlinkSync(partial); } catch {}
    throw error;
  }
}

function convertMp3(ffmpeg, input, output) {
  return new Promise(resolve => {
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:a:0', '-vn', '-codec:a', 'libmp3lame', '-q:a', '2', '-map_metadata', '0', output], { windowsHide: true, shell: false });
    let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', e => resolve({ ok: false, error: e.message }));
    child.on('close', code => resolve(code === 0 && fs.existsSync(output) && fs.statSync(output).size > 0 ? { ok: true } : { ok: false, error: err.slice(-1000) || `FFmpeg exited with code ${code}` }));
  });
}
function getManifestPath(directory) { return path.join(directory, '.simprestore-library.json'); }
function loadManifest(directory) {
  const manifest = readJsonSafe(getManifestPath(directory), { schema: 2, tracks: [] });
  if (!Array.isArray(manifest.tracks)) manifest.tracks = [];
  return manifest;
}
function publicTrack(track, directory) {
  const fullPath = trackPath(track, directory);
  const exists = trackExists(track, directory);
  return { ...track, exists, url: exists ? pathToFileURL(fullPath).href : '', fullPath };
}
function localId(filePath) {
  return `local:${crypto.createHash('sha256').update(path.resolve(filePath).toLowerCase()).digest('hex').slice(0, 24)}`;
}
function basicFilenameTags(file) {
  const stem = path.basename(file, path.extname(file));
  const match = stem.match(/^(.+?)\s+-\s+(.+)$/);
  return match ? { artists: match[1].trim(), title: match[2].trim() } : { artists: 'Local file', title: stem.trim() || 'Untitled' };
}
async function readAudioTags(file) {
  const fallback = basicFilenameTags(file);
  if (!parseAudioFile) return fallback;
  try {
    const meta = await parseAudioFile(file, { skipCovers: true, duration: false, skipPostHeaders: true });
    const common = meta.common || {};
    return {
      title: String(common.title || fallback.title),
      artists: String(common.artist || (Array.isArray(common.artists) ? common.artists.join(', ') : '') || fallback.artists),
      album: String(common.album || ''), durationSeconds: Number(meta.format?.duration || 0)
    };
  } catch { return fallback; }
}

app.whenReady().then(async () => {
  SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
  try { ({ parseFile: parseAudioFile } = await import('music-metadata')); } catch { parseAudioFile = null; }
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  settings = { ...settings, ...readJsonSafe(settingsPath, {}) };
  ensureWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) ensureWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('dialog:backup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose SimpMusic backup', properties: ['openFile'], filters: [{ name: 'SimpMusic backup', extensions: ['backup', 'zip'] }, { name: 'All files', extensions: ['*'] }] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('dialog:library', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose music library folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled) return null;
  settings.libraryDirectory = result.filePaths[0];
  // Keep the selected path in memory even if C: is full and this tiny settings write fails.
  try { writeJsonAtomic(settingsPath, settings); }
  catch (error) { if (!isNoSpaceError(error)) throw error; }
  return settings.libraryDirectory;
});
ipcMain.handle('app:state', async () => ({ version: APP_VERSION, settings, ready: !!locateExoprobe(), ffmpegAvailable: !!locateFfmpeg() }));
ipcMain.handle('external:open', async (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) return shell.openExternal(url);
  return false;
});
ipcMain.handle('folder:reveal', async (_event, directory) => {
  if (typeof directory === 'string' && fs.existsSync(directory)) return shell.openPath(directory);
  return '';
});
ipcMain.handle('library:load', async (_event, directory) => {
  const dir = directory || settings.libraryDirectory;
  if (!dir || !fs.existsSync(dir)) return { directory: dir || '', tracks: [], count: 0 };
  const manifest = loadManifest(dir);
  const tracks = manifest.tracks.map(t => publicTrack(t, dir)).filter(t => t.exists);
  return { directory: dir, tracks, count: tracks.length };
});
ipcMain.handle('library:add-local-folder', async () => {
  if (!settings.libraryDirectory) throw new Error('Choose a library destination first.');
  const pick = await dialog.showOpenDialog(mainWindow, { title: 'Add a local music folder', properties: ['openDirectory'] });
  if (pick.canceled || !pick.filePaths[0]) return { canceled: true, added: 0, duplicates: 0, tracks: [] };
  const selected = path.resolve(pick.filePaths[0]);
  const files = walk(selected, { maxFiles: 150000 }).filter(file => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (!files.length) return { added: 0, duplicates: 0, tracks: [], message: 'No supported media files were found in that folder.' };
  const manifest = loadManifest(settings.libraryDirectory);
  manifest.tracks = manifest.tracks.filter(t => trackExists(t, settings.libraryDirectory));
  const known = new Set(manifest.tracks.filter(t => t.sourcePath).map(t => path.resolve(t.sourcePath).toLowerCase()));
  const ids = new Set(manifest.tracks.map(t => t.videoId).filter(Boolean));
  let added = 0, duplicates = 0;
  emitLocalScan(0, files.length, path.basename(selected));
  for (let index = 0; index < files.length; index++) {
    const file = path.resolve(files[index]);
    const normalized = file.toLowerCase();
    const id = localId(file);
    if (known.has(normalized) || ids.has(id)) { duplicates++; if (index % 4 === 0 || index + 1 === files.length) emitLocalScan(index + 1, files.length, path.basename(file)); continue; }
    const meta = await readAudioTags(file);
    const st = fs.statSync(file);
    manifest.tracks.push({
      videoId: id, title: cleanName(meta.title), artists: cleanName(meta.artists, 220), album: cleanName(meta.album || ''),
      durationSeconds: Number(meta.durationSeconds || 0), fileName: path.basename(file), sourcePath: file,
      extension: path.extname(file).toLowerCase(), size: st.size, localImport: true, addedAt: new Date().toISOString()
    });
    known.add(normalized); ids.add(id); added++;
    if (added % 10 === 0) writeJsonAtomic(getManifestPath(settings.libraryDirectory), { schema: 2, appVersion: APP_VERSION, updatedAt: new Date().toISOString(), tracks: manifest.tracks });
    if (index % 4 === 0 || index + 1 === files.length) emitLocalScan(index + 1, files.length, path.basename(file));
  }
  writeJsonAtomic(getManifestPath(settings.libraryDirectory), { schema: 2, appVersion: APP_VERSION, updatedAt: new Date().toISOString(), tracks: manifest.tracks });
  const tracks = manifest.tracks.map(t => publicTrack(t, settings.libraryDirectory)).filter(t => t.exists);
  return { added, duplicates, tracks, count: tracks.length, directory: selected };
});

ipcMain.handle('backup:process', async (_event, payload) => {
  const backupPath = payload?.backupPath;
  const libraryDirectory = payload?.libraryDirectory || settings.libraryDirectory;
  const convertToMp3 = payload?.convertToMp3 !== false;
  const keepOriginals = payload?.keepOriginals === true;
  if (!backupPath || !fs.existsSync(backupPath)) throw new Error('Choose a valid backup file first.');
  if (!libraryDirectory) throw new Error('Choose a library folder first.');
  const exoprobe = locateExoprobe();
  const ffmpeg = locateFfmpeg();
  if (!exoprobe) throw new Error('Exoprobe is missing. Rebuild the app with the included Windows build workflow.');
  if (convertToMp3 && !ffmpeg) throw new Error('FFmpeg is missing. Reinstall a complete SimpRestore build or disable MP3 conversion.');
  fs.mkdirSync(libraryDirectory, { recursive: true });
  settings = { ...settings, libraryDirectory, convertToMp3, keepOriginals };
  try { writeJsonAtomic(settingsPath, settings); }
  catch (error) {
    if (!isNoSpaceError(error)) throw error;
    emitProgress('extract', 0, 'Settings could not be saved — continuing', 'Your C: drive may be full. Recovery files will use the selected library drive; this folder choice may need to be saved again later.');
  }

  // Keep large extracted cache files on the library's drive. Using app.getPath('temp')
  // can silently exhaust C: even when the user selected a roomy D:/E: music library.
  let workRoot = '';
  let extracted = '';
  let recovered = '';
  const result = { added: 0, duplicates: 0, incomplete: 0, failed: 0, noMetadata: 0, recovered: 0, errors: [], tracks: [] };
  try {
    workRoot = fs.mkdtempSync(path.join(path.resolve(libraryDirectory), '.simprestore-work-'));
    extracted = path.join(workRoot, 'extracted');
    recovered = path.join(workRoot, 'recovered');
    fs.mkdirSync(extracted, { recursive: true }); fs.mkdirSync(recovered, { recursive: true });
    const backupSize = fs.statSync(backupPath).size;
    emitProgress('extract', 1, 'Inspecting backup archive…', `${path.basename(backupPath)} · ${formatBytes(backupSize)}`);
    const totals = await inspectArchive(backupPath, count => {
      emitProgress('extract', 2, 'Inspecting backup archive…', `Checked ${count.toLocaleString('en-US')} archive entries`);
    });
    const cacheEstimate = totals.cacheBytes > 0 ? totals.cacheBytes : Math.ceil(totals.bytes * 0.7);
    // Peak work includes the expanded backup, rejoined media, final exports, and safety margin.
    const finalOutputFactor = convertToMp3 ? (keepOriginals ? 1.95 : 0.95) : 1.0;
    const requiredBytes = Math.ceil(totals.bytes + cacheEstimate * (1 + finalOutputFactor) + 768 * 1024 * 1024);
    const freeBytes = availableBytesAt(libraryDirectory);
    emitProgress('extract', 3, 'Checking temporary storage…', `Work files will be stored on the library drive · Backup expands to ${formatBytes(totals.bytes)} · ${freeBytes == null ? 'Free space could not be measured' : `${formatBytes(freeBytes)} free`}`);
    if (freeBytes != null && freeBytes < requiredBytes) {
      throw new Error(storageSpaceGuidance(libraryDirectory, freeBytes, requiredBytes));
    }
    emitProgress('extract', 3, 'Extracting backup contents…', `${totals.entries.toLocaleString('en-US')} entries · ${formatBytes(totals.bytes)} uncompressed · temporary files on ${path.parse(path.resolve(libraryDirectory)).root}`);
    await extractBackupZip(backupPath, extracted, totals, (doneBytes, totalBytes, doneEntries, totalEntries, currentName) => {
      const ratio = totalBytes > 0 ? doneBytes / totalBytes : doneEntries / Math.max(1, totalEntries);
      const percent = Math.min(15, 3 + Math.floor(12 * Math.max(0, Math.min(1, ratio))));
      emitProgress('extract', percent, 'Extracting backup contents…', `${formatBytes(doneBytes)} / ${formatBytes(totalBytes)} · ${doneEntries.toLocaleString('en-US')} / ${totalEntries.toLocaleString('en-US')} entries`);
    });

    emitProgress('scan', 16, 'Inspecting SimpMusic data…', 'Looking for the ExoPlayer cache index and song database');
    const all = walk(extracted);
    const exoDb = all.find(file => path.basename(file).toLowerCase() === 'exoplayer_internal.db');
    const musicDb = await locateMusicDb(extracted);
    if (!exoDb) throw new Error('No exoplayer_internal.db was found. Re-create the SimpMusic backup and make sure downloaded/cache data is included.');
    if (!musicDb) throw new Error('No Music Database containing a song table was found. The app will not invent track names.');
    const songIndex = loadSongIndex(musicDb);
    emitProgress('rejoin', 21, 'Cache index found — rejoining media…', `Exoprobe is rebuilding cached pieces on ${path.parse(path.resolve(libraryDirectory)).root}. Large backups can take a few minutes.`);
    const rejoinStarted = Date.now();
    const heartbeat = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rejoinStarted) / 1000);
      const time = elapsed < 60 ? `${elapsed}s elapsed` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`;
      emitProgress('rejoin', 21, 'Rejoining cached media…', `${time} · Please keep the app open`);
    }, 1200);
    try {
      await runChild(exoprobe, ['rejoin', extracted, '-o', recovered], workRoot, text => {
        const clean = text.trim().split(/\r?\n/).slice(-2).join(' ');
        if (clean) emitProgress('rejoin', 22, 'Rejoining cached media…', clean.slice(-180));
      });
    } finally { clearInterval(heartbeat); }

    const reportPath = await findReport(recovered);
    if (!reportPath) throw new Error('Exoprobe finished without report.json. The original backup has not been changed.');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (!Array.isArray(report)) throw new Error('Exoprobe returned an unexpected report format.');
    const byId = new Map();
    for (const record of report) {
      const id = normalizedVideoId(record.key);
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(record);
    }
    const previous = loadManifest(libraryDirectory);
    previous.tracks = previous.tracks.filter(track => trackExists(track, libraryDirectory));
    const already = new Set(previous.tracks.filter(track => track.videoId && !String(track.videoId).startsWith('local:')).map(track => track.videoId));
    const usedNames = new Set(previous.tracks.filter(track => !track.sourcePath).map(track => String(track.fileName || '').toLowerCase()));
    const ids = [...byId.keys()];
    const total = ids.length || 1;
    let index = 0;
    for (const id of ids) {
      index++;
      const percent = 35 + Math.floor((index / total) * 60);
      emitProgress('export', percent, 'Organizing your music library…', `Track ${index.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`);
      if (already.has(id)) { result.duplicates++; continue; }
      const record = chooseRecord(byId.get(id));
      if (!record) { result.incomplete++; continue; }
      const source = resolveRecoveredFile(recovered, record);
      if (!source) { result.failed++; result.errors.push(`Missing recovered output for ${id}`); continue; }
      const meta = songIndex.get(id) || null;
      if (!meta) result.noMetadata++;
      const title = meta?.title || `Track ${id}`;
      const artists = meta?.artists || 'Unknown artist';
      const stem = cleanName(`${title} - ${artists}`);
      let filename, converted = false;
      if (convertToMp3) {
        const targetMp3 = uniqueFileName(libraryDirectory, stem, '.mp3', usedNames);
        const targetPath = path.join(libraryDirectory, targetMp3);
        const conversion = await convertMp3(ffmpeg, source, targetPath);
        if (conversion.ok) { filename = targetMp3; converted = true; }
        else {
          try { fs.unlinkSync(targetPath); } catch {}
          usedNames.delete(targetMp3.toLowerCase());
          result.errors.push(`${title}: MP3 conversion failed; preserved the recovered source format.`);
          const ext = inferExt(source);
          filename = uniqueFileName(libraryDirectory, stem, ext, usedNames);
          copyFileWithCleanup(source, path.join(libraryDirectory, filename));
        }
      } else {
        filename = uniqueFileName(libraryDirectory, stem, inferExt(source), usedNames);
        copyFileWithCleanup(source, path.join(libraryDirectory, filename));
      }
      if (keepOriginals && converted) {
        const originalExt = inferExt(source);
        const originalName = uniqueFileName(libraryDirectory, `${stem} [original]`, originalExt, usedNames);
        copyFileWithCleanup(source, path.join(libraryDirectory, originalName));
      }
      const stat = fs.statSync(path.join(libraryDirectory, filename));
      const track = {
        videoId: id, title, artists, album: meta?.album || '', durationSeconds: meta?.durationSeconds || 0,
        thumbnail: '', fileName: filename, extension: path.extname(filename).toLowerCase(), size: stat.size,
        convertedToMp3: converted, addedAt: new Date().toISOString(), sourceCacheState: record.state || 'unknown'
      };
      previous.tracks.push(track); already.add(id); result.tracks.push(track); result.added++;
      try {
        writeJsonAtomic(getManifestPath(libraryDirectory), { schema: 2, appVersion: APP_VERSION, updatedAt: new Date().toISOString(), tracks: previous.tracks });
      } catch (error) {
        previous.tracks.pop(); already.delete(id); result.tracks.pop(); result.added--;
        try { fs.unlinkSync(path.join(libraryDirectory, filename)); } catch {}
        throw error;
      }
    }
    result.recovered = report.filter(record => record.state === 'complete').length;
    writeJsonAtomic(getManifestPath(libraryDirectory), { schema: 2, appVersion: APP_VERSION, updatedAt: new Date().toISOString(), tracks: previous.tracks });
    emitProgress('done', 100, 'Recovery complete', `${result.added} added · ${result.duplicates} already in library · ${result.incomplete} incomplete`);
    return { ...result, libraryDirectory, libraryCount: previous.tracks.filter(track => trackExists(track, libraryDirectory)).length };
  } catch (error) {
    if (/^Not enough temporary disk space/i.test(String(error?.message || ''))) throw error;
    if (isNoSpaceError(error)) {
      const currentFree = availableBytesAt(libraryDirectory);
      throw new Error(storageSpaceGuidance(libraryDirectory, currentFree, null));
    }
    throw error;
  } finally {
    if (workRoot) { try { fs.rmSync(workRoot, { recursive: true, force: true }); } catch {} }
  }
});

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024, unit = units[0], index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; unit = units[++index]; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}
function availableBytesAt(folder) {
  if (process.platform === 'win32') {
    try {
      const root = path.parse(path.resolve(folder)).root.replace(/'/g, "''");
      const script = `$d = [System.IO.DriveInfo]::new('${root}'); [Console]::WriteLine($d.AvailableFreeSpace)`;
      const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 7000 }).trim();
      const value = Number(output);
      if (Number.isFinite(value) && value >= 0) return value;
    } catch {}
  }
  try {
    if (typeof fs.statfsSync === 'function') {
      const stat = fs.statfsSync(folder);
      const values = [stat.bavail, stat.bfree].map(Number).filter(n => Number.isFinite(n) && n > 0);
      const blocks = values.length ? values[0] : 0;
      const blockSize = Number(stat.bsize);
      if (Number.isFinite(blocks) && Number.isFinite(blockSize) && blocks >= 0 && blockSize > 0) return blocks * blockSize;
    }
  } catch {}
  return null;
}
function storageSpaceGuidance(folder, freeBytes, requiredBytes) {
  const root = path.parse(path.resolve(folder)).root || folder;
  const freeText = freeBytes == null ? 'Windows could not report the free-space amount.' : `${formatBytes(freeBytes)} free on ${root}`;
  const requiredText = requiredBytes == null ? '' : ` Estimated peak need: about ${formatBytes(requiredBytes)}.`;
  return `Not enough temporary disk space to restore this backup. ${freeText}.${requiredText} SimpRestore stores its temporary extraction and Exoprobe output beside your selected music library, rather than using the Windows temporary folder on C:. Choose a library folder on a drive with more space, disable “Keep recovered originals” if enabled, or free space on that drive and retry. Your original backup has not been modified.`;
}
function isNoSpaceError(error) {
  const text = `${error?.message || ''} ${error?.stack || ''}`;
  return /ENOSPC|No space left on device|There is not enough space on the disk|disk is full|not enough(?: temporary)? disk space/i.test(text);
}
