const api = window.simprestore;
const $ = id => document.getElementById(id);
const state = {
  backupPath: '', libraryDirectory: '', tracks: [], currentTrack: null,
  shuffle: false, repeat: 'off', isProcessing: false, isLocalScanning: false,
  sort: 'added', search: '', queueOrder: [], queueIndex: -1
};
const audio = $('audio-player');
const pageTitles = { home: 'Overview', restore: 'Restore backup', library: 'Music library', player: 'Player', help: 'Quick guide & ethics' };
const fmtTime = value => { const n = Math.max(0, Math.floor(Number(value) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function safeDate(value) {
  try { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}
function toast(message, type = '') {
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
  $('toast-region').appendChild(el); setTimeout(() => el.remove(), 4600);
}
function log(message, type = '') {
  const line = document.createElement('div'); line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-dot"></span><span>${esc(message)}</span><time>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time>`;
  $('process-log').appendChild(line);
  while ($('process-log').children.length > 80) $('process-log').firstElementChild.remove();
  $('process-log').scrollTop = $('process-log').scrollHeight;
}
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('page-heading').textContent = pageTitles[page] || 'SimpRestore';
  if (page === 'library' || page === 'player') renderLibrary();
  if (page === 'player') renderQueue();
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));
function syncBackupLabels() {
  const name = state.backupPath ? state.backupPath.split(/[\\/]/).pop() : 'Choose your .backup file';
  $('home-backup-name').textContent = name; $('restore-backup-name').textContent = name;
}
function syncStorageNotice() {
  const folder = state.libraryDirectory;
  let message = 'Choose a library folder on a drive with enough free space. Temporary extraction and Exoprobe output are stored beside this library, not in Windows Temp on C:.';
  if (folder) {
    const match = folder.match(/^([A-Za-z]):[\\/]/);
    const drive = match ? `${match[1].toUpperCase()}:` : 'the selected';
    message = `Temporary extraction and Exoprobe output use ${drive} beside your library, not Windows Temp on C:. Large backups may need several times their compressed size in free space.`;
  }
  if ($('home-storage-note')) $('home-storage-note').textContent = message;
  if ($('restore-storage-note')) $('restore-storage-note').textContent = message;
}
function syncLibraryLabels() {
  const display = state.libraryDirectory || 'Choose where your collection should live';
  $('home-library-path').textContent = display; $('restore-library-path').textContent = display;
  syncStorageNotice();
  const enabled = !!state.backupPath && !!state.libraryDirectory && !state.isProcessing;
  ['home-process', 'restore-start'].forEach(id => { $(id).disabled = !enabled; });
  ['home-choose-library', 'restore-choose-library', 'add-local-folder', 'player-add-folder'].forEach(id => { if ($(id)) $(id).disabled = state.isLocalScanning || state.isProcessing; });
}
async function chooseBackup() {
  const file = await api.selectBackup();
  if (!file) return;
  state.backupPath = file; syncBackupLabels(); syncLibraryLabels(); navigate('restore');
  log(`Backup selected: ${file.split(/[\\/]/).pop()}`); toast('Backup selected.', 'success');
}
async function chooseLibrary() {
  const directory = await api.selectLibrary();
  if (!directory) return;
  state.libraryDirectory = directory; syncLibraryLabels();
  const data = await api.loadLibrary(directory); state.tracks = data.tracks || []; rebuildQueue(); updateDashboard(); renderLibrary(); renderQueue();
  toast('Library destination saved.', 'success');
}
['hero-start'].forEach(id => $(id).addEventListener('click', chooseBackup));
$('home-drop-zone').addEventListener('click', chooseBackup); $('restore-drop-zone').addEventListener('click', chooseBackup);
$('hero-library').addEventListener('click', () => navigate('library'));
$('home-choose-library').addEventListener('click', chooseLibrary); $('restore-choose-library').addEventListener('click', chooseLibrary);
$('open-library-folder').addEventListener('click', () => state.libraryDirectory ? api.revealFolder(state.libraryDirectory) : chooseLibrary());
$('library-open-folder').addEventListener('click', () => state.libraryDirectory ? api.revealFolder(state.libraryDirectory) : chooseLibrary());
$('open-exoprobe').addEventListener('click', e => { e.preventDefault(); api.openExternal('https://github.com/abrignoni/exoprobe'); });
$('open-ffmpeg').addEventListener('click', e => { e.preventDefault(); api.openExternal('https://ffmpeg.org/'); });
$('open-noctis').addEventListener('click', e => { e.preventDefault(); api.openExternal('https://github.com/heartached/Noctis'); });
const creatorLinks = {
  'open-linkedin': 'https://www.linkedin.com/in/mohammed-hamed-2007-space/',
  'sidebar-linkedin': 'https://www.linkedin.com/in/mohammed-hamed-2007-space/',
  'welcome-linkedin': 'https://www.linkedin.com/in/mohammed-hamed-2007-space/',
  'open-kofi': 'https://ko-fi.com/mohammed_hamed01',
  'sidebar-kofi': 'https://ko-fi.com/mohammed_hamed01',
  'welcome-kofi': 'https://ko-fi.com/mohammed_hamed01'
};
for (const [id, url] of Object.entries(creatorLinks)) {
  const link = $(id);
  if (link) link.addEventListener('click', event => { event.preventDefault(); api.openExternal(url); });
}
$('convert-mp3').addEventListener('change', () => {}); $('keep-originals').addEventListener('change', () => {});

for (const id of ['home-drop-zone', 'restore-drop-zone']) {
  const el = $(id);
  ['dragenter', 'dragover'].forEach(eventName => el.addEventListener(eventName, e => { e.preventDefault(); el.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(eventName => el.addEventListener(eventName, e => { e.preventDefault(); el.classList.remove('dragover'); }));
  el.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file?.path) { state.backupPath = file.path; syncBackupLabels(); syncLibraryLabels(); navigate('restore'); log(`Backup selected: ${file.name}`); }
    else chooseBackup();
  });
}

let lastProgressLogKey = '';
function onProgress(progress) {
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  $('progress-number').innerHTML = `${Math.round(percent)}<span>%</span>`;
  $('progress-fill').style.width = `${percent}%`;
  $('progress-title').textContent = progress.message || 'Working…';
  $('progress-subtitle').textContent = progress.detail || 'Processing stays on this computer.';
  $('process-status').innerHTML = percent >= 100 ? '<i></i> Complete' : '<i></i> Working';
  $('process-status').classList.toggle('working', percent < 100 && progress.stage !== 'done');
  $('progress-fill').parentElement.classList.toggle('busy', ['extract', 'rejoin'].includes(progress.stage) && percent < 100);
  const order = ['extract', 'scan', 'rejoin', 'export', 'done'];
  const target = order.indexOf(progress.stage);
  document.querySelectorAll('.stage').forEach(stage => {
    const current = ['extract', 'scan', 'rejoin', 'export'].indexOf(stage.dataset.stage);
    stage.classList.toggle('active', current === target);
    stage.classList.toggle('done', target > current || progress.stage === 'done');
  });
  const key = `${progress.stage}|${Math.floor(percent / 3)}|${progress.message || ''}`;
  if (key !== lastProgressLogKey) {
    lastProgressLogKey = key;
    if (progress.message) log(`${progress.message}${progress.detail ? ` — ${progress.detail}` : ''}`, progress.stage === 'done' ? 'success' : '');
  }
}
api.onProgress(onProgress);
api.onLocalScanProgress(data => {
  state.isLocalScanning = data.done < data.total; syncLibraryLabels();
  const current = data.done.toLocaleString('en-US'), total = data.total.toLocaleString('en-US');
  $('library-subtitle').textContent = data.done < data.total ? `Indexing local audio: ${current} of ${total} files…` : 'Browse restored songs and local audio folders.';
});

async function processBackup() {
  if (state.isProcessing) return;
  if (!state.backupPath) return toast('Choose a backup file first.', 'error');
  if (!state.libraryDirectory) return toast('Choose a library destination first.', 'error');
  const convertToMp3 = $('convert-mp3').checked;
  const keepOriginals = $('keep-originals').checked;
  const ok = confirm(`Recover from:\n${state.backupPath.split(/[\\/]/).pop()}\n\nAdd the results to:\n${state.libraryDirectory}\n\n${convertToMp3 ? 'Convert recoverable audio to MP3 when possible.' : 'Keep the recovered source format.'}\n${keepOriginals ? 'Also keep the original recovered media.' : ''}\n\nExisting library tracks will not be overwritten. Continue?`);
  if (!ok) return;
  state.isProcessing = true; syncLibraryLabels(); navigate('restore');
  $('result-summary').hidden = true; $('process-log').innerHTML = ''; $('progress-fill').style.width = '0%'; $('progress-number').innerHTML = '0<span>%</span>';
  $('progress-title').textContent = 'Starting recovery…'; $('progress-subtitle').textContent = 'The original backup is read-only.'; $('process-status').innerHTML = '<i></i> Working'; $('process-status').classList.remove('failed');
  $('progress-fill').parentElement.classList.add('busy'); lastProgressLogKey = ''; log('Recovery started. The backup will not be modified.');
  try {
    const result = await api.processBackup({ backupPath: state.backupPath, libraryDirectory: state.libraryDirectory, convertToMp3, keepOriginals });
    $('process-status').innerHTML = '<i></i> Complete'; $('process-status').classList.remove('working', 'failed'); $('progress-fill').parentElement.classList.remove('busy');
    $('result-summary').hidden = false;
    $('result-summary').innerHTML = `<h4>Recovery complete</h4><p><b>${Number(result.added).toLocaleString('en-US')}</b> new tracks added · <b>${Number(result.duplicates).toLocaleString('en-US')}</b> already present · <b>${Number(result.incomplete).toLocaleString('en-US')}</b> incomplete · <b>${Number(result.noMetadata).toLocaleString('en-US')}</b> without matched metadata.</p>`;
    if (result.errors?.length) {
      log(`${result.errors.length} item(s) need attention. The first few are listed below.`, 'error');
      result.errors.slice(0, 12).forEach(error => log(error, 'error'));
    }
    const data = await api.loadLibrary(state.libraryDirectory); state.tracks = data.tracks || []; rebuildQueue(); updateDashboard(); renderLibrary(); renderQueue();
    $('stat-added').textContent = Number(result.added).toLocaleString('en-US'); $('stat-duplicates').textContent = Number(result.duplicates).toLocaleString('en-US');
    $('last-updated').textContent = `Last restore: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    toast(`Recovery complete — ${result.added} new track(s) added.`, 'success'); navigate('library');
  } catch (error) {
    const message = error?.message || String(error);
    $('process-status').innerHTML = '<i></i> Failed'; $('process-status').classList.remove('working'); $('process-status').classList.add('failed'); $('progress-fill').parentElement.classList.remove('busy');
    log(message, 'error'); $('progress-title').textContent = /space|ENOSPC|disk is full/i.test(message) ? 'Not enough disk space' : 'Recovery stopped';
    $('progress-subtitle').textContent = /space|ENOSPC|disk is full/i.test(message) ? 'Choose a library folder on a drive with more free space, then retry. The original backup was not modified.' : 'Read the activity log for details. Your source backup was not modified.';
    toast(/space|ENOSPC|disk is full/i.test(message) ? 'Not enough free space on the library drive. See the activity log.' : message, 'error');
  } finally { state.isProcessing = false; syncLibraryLabels(); }
}
$('home-process').addEventListener('click', processBackup); $('restore-start').addEventListener('click', processBackup);

async function addLocalFolder() {
  if (state.isLocalScanning || state.isProcessing) return;
  if (!state.libraryDirectory) {
    toast('Choose a library destination first.', 'error');
    await chooseLibrary();
    if (!state.libraryDirectory) return;
  }
  state.isLocalScanning = true; syncLibraryLabels(); navigate('library'); $('library-subtitle').textContent = 'Choose a local music folder to index…';
  toast('Choose a folder containing your local audio files.');
  try {
    const result = await api.addLocalFolder();
    if (result.canceled) return;
    if (result.message) toast(result.message, 'error');
    else toast(`Added ${result.added} local track(s). Skipped ${result.duplicates} already indexed.`, 'success');
    if (result.tracks) { state.tracks = result.tracks; rebuildQueue(); updateDashboard(); renderLibrary(); renderQueue(); }
  } catch (error) { toast(error?.message || 'Could not index that folder.', 'error'); }
  finally { state.isLocalScanning = false; syncLibraryLabels(); $('library-subtitle').textContent = state.libraryDirectory || 'Browse restored songs and local audio folders.'; }
}
$('add-local-folder').addEventListener('click', addLocalFolder); $('player-add-folder').addEventListener('click', addLocalFolder);

function updateDashboard() {
  const count = state.tracks.length;
  $('stat-tracks').textContent = count.toLocaleString('en-US');
  $('nav-count').textContent = count.toLocaleString('en-US');
  $('library-count-label').textContent = `${count.toLocaleString('en-US')} tracks`;
  $('library-title-count').textContent = `${count.toLocaleString('en-US')} track${count === 1 ? '' : 's'} indexed`;
  $('player-track-count').textContent = `${count.toLocaleString('en-US')} tracks`;
  if (state.libraryDirectory) $('library-subtitle').textContent = state.libraryDirectory;
  renderRecent();
}
function coverHtml(track, index = 0) {
  const hues = [258, 194, 326, 225, 153, 30, 281]; const hue = hues[index % hues.length];
  const initial = esc(String(track.title || '♫').trim().slice(0, 1).toUpperCase());
  return `<div class="track-cover" style="background:linear-gradient(145deg,hsl(${hue},34%,37%),hsl(${(hue + 28) % 360},35%,15%));border-color:hsl(${hue},25%,39%)"><span>${initial}</span></div>`;
}
function renderRecent() {
  const box = $('recent-tracks'); const tracks = [...state.tracks].reverse().slice(0, 5);
  if (!tracks.length) { box.innerHTML = '<div class="empty-state compact-empty"><span class="empty-note">♫</span><b>Your library is waiting</b><small>Restore a backup or add an existing local music folder.</small></div>'; return; }
  box.innerHTML = tracks.map((track, i) => `<div class="recent-track" data-track="${esc(track.videoId)}">${coverHtml(track, i)}<div class="track-summary"><b>${esc(track.title)}</b><small>${esc(track.artists)}</small></div><span class="format-pill">${esc((track.extension || '').replace('.', '') || 'media')}</span><span class="recent-date">${safeDate(track.addedAt)}</span></div>`).join('');
  box.querySelectorAll('[data-track]').forEach(el => el.addEventListener('click', () => playTrackById(el.dataset.track)));
}
function filteredTracks() {
  let tracks = [...state.tracks];
  if (state.search) { const needle = state.search.toLocaleLowerCase(); tracks = tracks.filter(track => `${track.title} ${track.artists} ${track.album}`.toLocaleLowerCase().includes(needle)); }
  if (state.sort === 'title') tracks.sort((a, b) => a.title.localeCompare(b.title));
  else if (state.sort === 'artist') tracks.sort((a, b) => a.artists.localeCompare(b.artists));
  else tracks.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  return tracks;
}
function renderLibrary() {
  const tracks = filteredTracks(); $('library-count-label').textContent = `${tracks.length.toLocaleString('en-US')} track${tracks.length === 1 ? '' : 's'}`;
  const list = $('track-list');
  if (!tracks.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-disc">♫</div><h3>${state.search ? 'No matching tracks' : 'No tracks yet'}</h3><p>${state.search ? 'Try another title, artist or album.' : 'Restore a SimpMusic backup or add any existing local music folder.'}</p>${state.search ? '' : '<button class="button-primary" data-page="restore">Restore backup</button>'}</div>`;
    list.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate('restore'))); renderQueue(); return;
  }
  list.innerHTML = tracks.map((track, index) => `<div class="track-row ${state.currentTrack?.videoId === track.videoId ? 'active' : ''}"><span class="track-index">${String(index + 1).padStart(2, '0')}</span><div class="track-main" data-track="${esc(track.videoId)}">${coverHtml(track, index)}<div class="track-text"><strong>${esc(track.title)}</strong><small>${esc(track.artists)}${track.album ? ` · ${esc(track.album)}` : ''}</small></div></div><span class="format-pill">${esc((track.extension || '').replace('.', '') || 'media')}</span><span class="track-date">${safeDate(track.addedAt)}</span><button class="track-play" data-play="${esc(track.videoId)}" title="Play track">▶</button></div>`).join('');
  list.querySelectorAll('[data-track],[data-play]').forEach(el => el.addEventListener('click', () => playTrackById(el.dataset.track || el.dataset.play)));
  renderQueue();
}
$('search-tracks').addEventListener('input', event => { state.search = event.target.value.trim(); renderLibrary(); });
$('sort-tracks').addEventListener('change', event => { state.sort = event.target.value; renderLibrary(); });
function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function rebuildQueue() {
  const ids = state.tracks.map(track => track.videoId);
  state.queueOrder = state.shuffle ? shuffled(ids) : ids;
  if (state.currentTrack && state.queueOrder.includes(state.currentTrack.videoId)) state.queueIndex = state.queueOrder.indexOf(state.currentTrack.videoId);
  else if (state.queueOrder.length) state.queueIndex = 0;
  else state.queueIndex = -1;
}
function renderQueue() {
  const box = $('queue-list'); const map = new Map(state.tracks.map(track => [track.videoId, track]));
  const tracks = state.queueOrder.map(id => map.get(id)).filter(Boolean);
  if (!tracks.length) { box.innerHTML = '<div class="empty-state compact-empty"><span class="empty-note">♫</span><b>Your queue is empty</b><small>Add music or restore a backup.</small></div>'; return; }
  box.innerHTML = tracks.map((track, index) => `<div class="queue-track ${state.currentTrack?.videoId === track.videoId ? 'active' : ''}" data-queue="${esc(track.videoId)}"><span class="queue-num">${String(index + 1).padStart(2, '0')}</span>${coverHtml(track, index)}<div class="queue-meta"><span class="queue-title">${esc(track.title)}</span><span class="queue-artist">${esc(track.artists)}</span></div><span class="queue-duration">${fmtTime(track.durationSeconds)}</span></div>`).join('');
  box.querySelectorAll('[data-queue]').forEach(el => el.addEventListener('click', () => playTrackById(el.dataset.queue)));
}
function playTrackById(id) {
  const track = state.tracks.find(item => item.videoId === id);
  if (!track) return;
  if (!state.queueOrder.includes(id)) state.queueOrder.push(id);
  state.queueIndex = state.queueOrder.indexOf(id);
  state.currentTrack = track;
  $('playback-notice').hidden = true;
  audio.src = track.url; audio.load();
  audio.play().catch(() => { $('playback-notice').hidden = false; $('playback-notice').textContent = 'Playback did not start. This file format may not be supported by the built-in player.'; });
  updateNowPlaying(); renderQueue(); renderLibrary(); navigate('player');
}
function updateNowPlaying() {
  const track = state.currentTrack;
  if (!track) return;
  $('big-title').textContent = track.title;
  $('big-artist').textContent = track.artists || 'Unknown artist';
  $('big-album').textContent = (track.album || 'SIMPRESTORE LOCAL PLAYER').toUpperCase();
  $('play-button').textContent = audio.paused ? '▶' : 'Ⅱ';
  $('player-add-folder').disabled = state.isLocalScanning || state.isProcessing;
  $('page-player').querySelector('.player-panel').classList.toggle('playing', !audio.paused);
}
$('play-button').addEventListener('click', () => {
  if (!state.currentTrack) return state.tracks.length ? playTrackById(state.tracks[0].videoId) : toast('Add a local folder or restore a backup first.', 'error');
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  updateNowPlaying();
});
$('next-button').addEventListener('click', nextTrack);
$('previous-button').addEventListener('click', () => {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (state.queueOrder.length) playTrackById(state.queueOrder[(state.queueIndex - 1 + state.queueOrder.length) % state.queueOrder.length]);
});
function nextTrack() {
  if (!state.queueOrder.length) return;
  if (state.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  let next = state.queueIndex + 1;
  if (next >= state.queueOrder.length) {
    if (state.repeat === 'all') next = 0;
    else { audio.pause(); audio.currentTime = 0; updateNowPlaying(); return; }
  }
  playTrackById(state.queueOrder[next]);
}
$('shuffle-button').addEventListener('click', () => {
  state.shuffle = !state.shuffle; $('shuffle-button').classList.toggle('selected', state.shuffle);
  const currentId = state.currentTrack?.videoId;
  state.queueOrder = state.shuffle ? shuffled(state.tracks.map(track => track.videoId)) : state.tracks.map(track => track.videoId);
  if (currentId && state.queueOrder.includes(currentId)) { state.queueOrder = [currentId, ...state.queueOrder.filter(id => id !== currentId)]; state.queueIndex = 0; }
  else state.queueIndex = state.queueOrder.length ? 0 : -1;
  renderQueue(); toast(state.shuffle ? 'Shuffle is on.' : 'Shuffle is off.');
});
$('queue-shuffle').addEventListener('click', () => { if (!state.shuffle) $('shuffle-button').click(); else { state.queueOrder = shuffled(state.queueOrder); state.queueIndex = state.currentTrack ? state.queueOrder.indexOf(state.currentTrack.videoId) : 0; renderQueue(); toast('Queue reshuffled.'); } });
$('repeat-button').addEventListener('click', () => {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  $('repeat-button').classList.toggle('selected', state.repeat !== 'off');
  $('repeat-button').textContent = state.repeat === 'one' ? '↻¹' : '↻';
  toast(state.repeat === 'off' ? 'Repeat is off.' : state.repeat === 'all' ? 'Repeating the queue.' : 'Repeating this track.');
});
$('volume-bar').addEventListener('input', event => { audio.volume = Number(event.target.value) / 100; }); audio.volume = .8;
$('seek-bar').addEventListener('input', event => { if (audio.duration) audio.currentTime = Number(event.target.value) / 1000 * audio.duration; });
audio.addEventListener('timeupdate', () => { if (audio.duration) { $('seek-bar').value = String(Math.round(audio.currentTime / audio.duration * 1000)); $('elapsed').textContent = fmtTime(audio.currentTime); $('duration').textContent = fmtTime(audio.duration); } });
audio.addEventListener('loadedmetadata', () => { $('duration').textContent = fmtTime(audio.duration); });
audio.addEventListener('play', updateNowPlaying); audio.addEventListener('pause', updateNowPlaying); audio.addEventListener('ended', nextTrack);
audio.addEventListener('error', () => { if (state.currentTrack) { $('playback-notice').hidden = false; $('playback-notice').textContent = 'This format could not be played by the built-in player. Try an MP3 copy or a different player.'; } });

const ETHICS_ACK_KEY = 'simprestore-ethics-accepted-v2';
$('welcome-ethics-check').addEventListener('change', event => { $('welcome-continue').disabled = !event.target.checked; });
$('welcome-continue').addEventListener('click', () => { localStorage.setItem(ETHICS_ACK_KEY, 'yes'); $('welcome-modal').hidden = true; });
$('ethics-inline-check').addEventListener('change', event => { if (event.target.checked) localStorage.setItem(ETHICS_ACK_KEY, 'yes'); });

(async function boot() {
  $('footer-year').textContent = String(new Date().getFullYear());
  try {
    const saved = await api.getState(); $('version-label').textContent = `v${saved.version || '0.2.2'}`;
    state.libraryDirectory = saved.settings?.libraryDirectory || '';
    $('convert-mp3').checked = saved.settings?.convertToMp3 !== false;
    $('keep-originals').checked = !!saved.settings?.keepOriginals;
    const library = await api.loadLibrary(state.libraryDirectory); state.tracks = library.tracks || [];
    syncBackupLabels(); syncLibraryLabels(); rebuildQueue(); updateDashboard(); renderLibrary(); renderQueue();
    if (!saved.ready) toast('Recovery engine is missing. Use a complete official build of SimpRestore.', 'error');
    if (localStorage.getItem(ETHICS_ACK_KEY) !== 'yes') $('welcome-modal').hidden = false;
  } catch (error) { toast(error?.message || 'SimpRestore could not finish startup.', 'error'); }
})();
