(() => {
  'use strict';

  const STORAGE_KEYS = { history: 'qrmed.history', codes: 'qrmed.codes' };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
  const truncate = (value, max = 140) => { const text = String(value ?? ''); return text.length > max ? text.slice(0, max - 1) + '…' : text; };
  const formatTime = (ts) => new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const load = (key, fallback) => { try { const parsed = JSON.parse(localStorage.getItem(key) || 'null'); return parsed ?? fallback; } catch { return fallback; } };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const getHistory = () => load(STORAGE_KEYS.history, []);
  const setHistory = (items) => save(STORAGE_KEYS.history, items);
  const getCodes = () => load(STORAGE_KEYS.codes, []);
  const setCodes = (items) => save(STORAGE_KEYS.codes, items);
  const toast = (() => { let timer; return (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 2600); }; })();

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) return await navigator.clipboard.writeText(text);
      throw new Error('clipboard unavailable');
    } catch {
      const area = document.createElement('textarea');
      area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
      try { document.execCommand('copy'); } finally { area.remove(); }
    }
  }
  async function shareText(text, title = 'QRmed!') {
    try { if (navigator.share) return await navigator.share({ title, text }); } catch (error) { if (error?.name === 'AbortError') return; }
    await copyText(text); toast('Disalin ke clipboard');
  }
  const downloadBlob = (blob, fileName) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  const downloadText = (text, fileName, type = 'text/plain;charset=utf-8') => downloadBlob(new Blob([text], { type }), fileName);
  const safeFileName = (value) => String(value || 'qrmed').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'qrmed';
  const newId = () => `QRM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  function addHistory(entry) {
    const items = getHistory();
    const record = { id: crypto?.randomUUID?.() || String(Date.now()), timestamp: Date.now(), valid: null, ...entry };
    items.unshift(record);
    setHistory(items.slice(0, 250));
    renderStats();
    renderRecent();
    renderHistory();
    return record;
  }

  function renderStats() {
    const history = getHistory();
    $('#statScans').textContent = history.filter(item => item.action === 'scan').length;
    $('#statVerified').textContent = history.filter(item => item.action === 'scan' && item.valid === true).length;
    $('#statCreated').textContent = history.filter(item => item.action === 'create').length;
  }

  function historyIcon(item) {
    if (item.valid === true) return '✓';
    if (item.type === 'wifi') return '⌁';
    if (item.type === 'url') return '↗';
    if (item.type === 'contact') return '☎';
    if (item.type === 'qrmed') return '!';
    return item.action === 'create' ? '＋' : '⌁';
  }

  function renderRecent() {
    const container = $('#recentList');
    const items = getHistory().slice(0, 3);
    if (!items.length) { container.className = 'history-list empty-state'; container.innerHTML = '<p>Belum ada aktivitas. Scan atau buat QR pertama kamu.</p>'; return; }
    container.className = 'history-list';
    container.innerHTML = items.map(item => `
      <article class="history-item">
        <div class="history-icon ${item.valid === true ? 'valid' : ''}">${escapeHtml(historyIcon(item))}</div>
        <div class="history-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(formatTime(item.timestamp))}</small><p>${escapeHtml(truncate(item.summary || item.raw || '', 90))}</p></div>
      </article>`).join('');
  }

  function renderHistory() {
    const list = $('#historyList');
    const query = ($('#historySearch').value || '').trim().toLowerCase();
    const filter = $('#historyFilter').value;
    let items = getHistory();
    if (filter === 'scan') items = items.filter(item => item.action === 'scan');
    if (filter === 'create') items = items.filter(item => item.action === 'create');
    if (filter === 'valid') items = items.filter(item => item.valid === true);
    if (query) items = items.filter(item => [item.title, item.summary, item.raw, item.type].join(' ').toLowerCase().includes(query));
    if (!items.length) { list.className = 'history-list empty-state'; list.innerHTML = '<p>Tidak ada riwayat yang cocok.</p>'; return; }
    list.className = 'history-list';
    list.innerHTML = items.map(item => `
      <article class="history-item" data-id="${escapeHtml(item.id)}">
        <div class="history-icon ${item.valid === true ? 'valid' : ''}">${escapeHtml(historyIcon(item))}</div>
        <div class="history-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(formatTime(item.timestamp))} · ${item.action === 'scan' ? 'Scan' : 'Dibuat'}</small><p>${escapeHtml(truncate(item.summary || item.raw || '', 130))}</p></div>
        <div class="history-item-actions"><button class="mini-action copy" type="button" title="Salin isi QR" aria-label="Salin isi QR">⧉</button><button class="mini-action delete" type="button" title="Hapus" aria-label="Hapus">×</button></div>
      </article>`).join('');
  }

  function deleteHistoryItem(id) { setHistory(getHistory().filter(item => item.id !== id)); renderStats(); renderRecent(); renderHistory(); toast('Riwayat dihapus'); }
  function exportHistory() {
    const rows = getHistory();
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['id','action','type','title','summary','valid','timestamp'];
    const csv = [header.join(','), ...rows.map(row => header.map(key => csvCell(key === 'timestamp' ? new Date(row[key]).toISOString() : row[key])).join(','))].join('\r\n');
    downloadText(csv, 'qrmed-riwayat.csv', 'text/csv;charset=utf-8');
  }

  function parseWiFi(raw) {
    if (!/^WIFI:/i.test(raw)) return null;
    const body = raw.slice(5).replace(/;$/, '');
    const fields = {};
    for (let i = 0; i < body.length;) {
      const keyMatch = /^([A-Za-z]):/.exec(body.slice(i));
      if (!keyMatch) break;
      const key = keyMatch[1].toUpperCase();
      i += keyMatch[0].length;
      let value = '';
      while (i < body.length) {
        const char = body[i];
        if (char === '\\' && body[i + 1]) { value += body[i + 1]; i += 2; continue; }
        if (char === ';') { i += 1; break; }
        value += char; i += 1;
      }
      fields[key] = value;
    }
    return { ssid: fields.S || '', password: fields.P || '', security: fields.T || 'WPA', hidden: /^true$/i.test(fields.H || '') };
  }
  const escapeWifiField = (value) => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/:/g, '\\:');
  const wifiPayload = ({ ssid, password, security, hidden }) => {
    const type = security === 'nopass' ? 'nopass' : security;
    const passPart = type === 'nopass' ? '' : `P:${escapeWifiField(password || '')};`;
    return `WIFI:T:${type};S:${escapeWifiField(ssid)};${passPart}${hidden ? 'H:true;' : ''};`;
  };

  function parseVCard(raw) {
    if (!/BEGIN:VCARD/i.test(raw)) return null;
    const pick = (key) => (raw.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, 'im')) || [])[1]?.trim() || '';
    return { name: pick('FN') || pick('N'), phone: pick('TEL'), email: pick('EMAIL'), org: pick('ORG') };
  }
  function parseCalendar(raw) {
    if (!/BEGIN:V(EVENT|CALENDAR)/i.test(raw)) return null;
    const pick = (key) => (raw.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)$`, 'im')) || [])[1]?.trim() || '';
    return { summary: pick('SUMMARY') || 'Kalender', start: pick('DTSTART'), end: pick('DTEND'), location: pick('LOCATION') };
  }
  function normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (/^www\./i.test(trimmed)) return 'https://' + trimmed;
    return trimmed;
  }
  const isProbablyUrl = (raw) => /^(https?:\/\/|ftp:\/\/|file:\/\/|intent:\/\/|www\.)/i.test(raw.trim()) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw.trim());
  const safeUrl = (url) => { try { const parsed = new URL(url); const insecure = parsed.protocol === 'http:'; return { ok: !insecure, parsed, note: insecure ? 'Koneksi HTTP tidak terenkripsi.' : 'Koneksi aman (HTTPS).' }; } catch { return { ok: false, parsed: null, note: 'URL tidak valid.' }; } };

  function setScannerStatus(message, tone = 'info') {
    const el = $('#scannerStatus'); el.textContent = message; el.dataset.tone = tone;
  }

  let html5Qrcode = null;
  let scannerRunning = false;
  async function startCamera() {
    const startButton = $('#startCameraButton'); const stopButton = $('#stopCameraButton');
    if (!window.Html5Qrcode) { setScannerStatus('Library pemindai gagal dimuat. Muat ulang halaman.', 'error'); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus('Kamera tidak tersedia di konteks ini. Android membutuhkan HTTPS/localhost. Gunakan "Scan Gambar" untuk sementara.', 'error');
      toast('Kamera butuh HTTPS/localhost');
      return;
    }
    try {
      startButton.disabled = true; stopButton.disabled = false;
      html5Qrcode = html5Qrcode || new Html5Qrcode('reader', { verbose: false });
      await html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (viewfinder) => { const size = Math.floor(Math.min(viewfinder.width, viewfinder.height) * 0.72); return { width: size, height: size }; }, aspectRatio: 1 },
        (decodedText) => { handleScanText(decodedText); stopCamera(); },
        () => {}
      );
      scannerRunning = true;
      setScannerStatus('Kamera aktif. Arahkan ke QR.', 'ok');
    } catch (error) {
      startButton.disabled = false; stopButton.disabled = true;
      setScannerStatus(`Kamera gagal dibuka: ${error?.message || error}. Periksa izin kamera/HTTPS.`, 'error');
    }
  }
  async function stopCamera() {
    const startButton = $('#startCameraButton'); const stopButton = $('#stopCameraButton');
    if (html5Qrcode && scannerRunning) {
      try { await html5Qrcode.stop(); await html5Qrcode.clear(); } catch {}
    }
    scannerRunning = false; startButton.disabled = false; stopButton.disabled = true;
    if ($('#reader') && !$('#reader').innerHTML.trim()) setScannerStatus('Kamera dihentikan.', 'info');
  }
  async function scanImageFile(file) {
    if (!file || !window.Html5Qrcode) return toast('Pemindai belum siap');
    setScannerStatus('Membaca QR dari gambar…', 'info');
    try {
      const scanner = new Html5Qrcode('reader', { verbose: false });
      const result = await scanner.scanFile(file, true);
      await scanner.clear();
      handleScanText(result);
      setScannerStatus('QR dari gambar berhasil dibaca.', 'ok');
    } catch (error) {
      setScannerStatus(`QR tidak ditemukan di gambar: ${error?.message || error}`, 'error');
    }
  }

  function showScanResult({ title, badge, badgeTone, kind, raw, summary, details, actions }) {
    const card = $('#scanResult');
    const iconClass = badgeTone === 'good' ? 'good' : badgeTone === 'warn' ? 'warn' : 'bad';
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-head"><div class="result-icon ${iconClass}">${badgeTone === 'good' ? '✓' : badgeTone === 'warn' ? '!' : '×'}</div><div><small>${escapeHtml(kind)}</small><h3>${escapeHtml(title)}</h3><span class="badge ${iconClass}">${escapeHtml(badge)}</span></div></div>
      <div class="result-body">${details.map(([k, v]) => `<div class="meta-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>
      <div class="result-actions">${actions.map(action => `<button class="button ${action.primary ? 'button-primary' : 'button-secondary'}" type="button" data-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('')}<button class="button button-ghost" type="button" data-action="copy-raw">Salin isi</button></div>
      <div class="result-raw">${escapeHtml(raw)}</div>`;
    $$('#scanResult [data-action]').forEach(button => button.addEventListener('click', () => handleResultAction(button.dataset.action, { raw, title, actions, details })));
    card.classList.remove('is-hidden');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function handleResultAction(actionId, context) {
    const raw = context.raw;
    if (actionId === 'copy-raw' || actionId === 'copy') return copyText(raw).then(() => toast('Disalin'));
    if (actionId === 'share') return shareText(raw, context.title);
    if (actionId === 'open-url') { const url = normalizeUrl(raw); return window.open(url, '_blank', 'noopener,noreferrer') || (location.href = url); }
    if (actionId === 'open-wifi-settings') { location.href = 'intent://#Intent;action=android.settings.WIFI_SETTINGS;end'; return; }
    if (actionId === 'open-geo') { const match = raw.match(/^geo:([^,?]+),([^?]+)(?:\?(.*))?$/i); if (match) return window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match[1] + ',' + match[2])}`, '_blank', 'noopener'); }
    if (actionId === 'open-tel') location.href = `tel:${raw.replace(/^tel:/i, '')}`;
    if (actionId === 'open-sms') location.href = raw.startsWith('sms') ? raw : `sms:${raw}`;
    if (actionId === 'open-mail') location.href = raw;
    if (actionId === 'download-vcard') downloadText(raw, 'kontak-qrmed.vcf', 'text/vcard;charset=utf-8');
    if (actionId === 'download-ics') downloadText(raw, 'kalender-qrmed.ics', 'text/calendar;charset=utf-8');
    if (actionId === 'copy-password') { const wifi = parseWiFi(raw); return copyText(wifi?.password || '').then(() => toast('Password WiFi disalin')); }
    if (actionId === 'mark-used') {
      const match = raw.match(/^QRMED1:([A-Za-z0-9-]+)/); if (!match) return;
      const codes = getCodes(); const code = codes.find(item => item.id === match[1]);
      if (code) { code.status = 'used'; code.usedAt = Date.now(); setCodes(codes); toast('QRmed ditandai sudah digunakan'); handleScanText(raw, { silent: true }); }
    }
  }

  function handleScanText(raw, options = {}) {
    raw = String(raw ?? '').trim();
    if (!raw) return toast('QR kosong');
    const qrmed = raw.match(/^QRMED1:([A-Za-z0-9-]+)/);
    if (qrmed) return renderQrmedResult(raw, qrmed[1], options);
    const wifi = parseWiFi(raw);
    if (wifi) return renderWifiResult(raw, wifi, options);
    const vcard = parseVCard(raw);
    if (vcard) return renderVCardResult(raw, vcard, options);
    const calendar = parseCalendar(raw);
    if (calendar) return renderCalendarResult(raw, calendar, options);
    if (/^mailto:/i.test(raw)) return renderGenericResult(raw, 'Email', 'Email', { action: 'mailto', link: raw }, ['Alamat', raw], [['Aksi', 'Buka aplikasi email']], options, [{ id: 'open-mail', label: 'Buka Email', primary: true }, { id: 'share', label: 'Bagikan' }]);
    if (/^tel:/i.test(raw)) return renderGenericResult(raw, 'Telepon', 'Telepon', { action: 'tel' }, [['Nomor', raw.replace(/^tel:/i, '')]], [['Aksi', 'Buka aplikasi telepon']], options, [{ id: 'open-tel', label: 'Telepon', primary: true }, { id: 'share', label: 'Bagikan' }]);
    if (/^sms(to)?:/i.test(raw)) return renderGenericResult(raw, 'SMS', 'SMS', { action: 'sms' }, [['Isi SMS', raw]], [['Aksi', 'Buka aplikasi SMS']], options, [{ id: 'open-sms', label: 'Buka SMS', primary: true }, { id: 'share', label: 'Bagikan' }]);
    if (/^geo:/i.test(raw)) return renderGenericResult(raw, 'Lokasi', 'Lokasi', { action: 'geo' }, [['Koordinat', raw.replace(/^geo:/i, '')]], [['Aksi', 'Buka di Google Maps']], options, [{ id: 'open-geo', label: 'Buka Maps', primary: true }, { id: 'share', label: 'Bagikan' }]);
    if (isProbablyUrl(raw)) {
      const url = normalizeUrl(raw); const safety = safeUrl(url);
      addHistory({ action: 'scan', type: 'url', title: safety.parsed?.hostname || url, summary: truncate(url, 160), raw, valid: safety.ok });
      return showScanResult({ title: safety.parsed?.hostname || url, badge: safety.ok ? 'Link HTTPS' : 'Perlu perhatian', badgeTone: safety.ok ? 'good' : 'warn', kind: 'Link / URL', raw, summary: url, details: [['URL', url], ['Keamanan', safety.note]], actions: [{ id: 'open-url', label: 'Buka Link', primary: true }, { id: 'share', label: 'Bagikan' }, { id: 'copy-raw', label: 'Salin' }] });
    }
    addHistory({ action: 'scan', type: 'text', title: 'Teks QR', summary: truncate(raw, 160), raw, valid: true });
    showScanResult({ title: 'Teks ditemukan', badge: 'Isi QR', badgeTone: 'good', kind: 'Teks', raw, summary: raw, details: [['Isi', truncate(raw, 220)]], actions: [{ id: 'share', label: 'Bagikan', primary: true }, { id: 'copy-raw', label: 'Salin' }] });
  }

  function renderQrmedResult(raw, id, options) {
    const code = getCodes().find(item => item.id === id);
    const actionButtons = code?.oneTime && code.status === 'active' ? [{ id: 'mark-used', label: 'Tandai digunakan', primary: true }, { id: 'copy-raw', label: 'Salin ID' }] : [{ id: 'copy-raw', label: 'Salin ID', primary: true }, { id: 'share', label: 'Bagikan' }];
    if (!code) {
      addHistory({ action: 'scan', type: 'qrmed', title: 'QRmed tidak dikenal', summary: id, raw, valid: false });
      return showScanResult({ title: 'QRmed tidak cocok', badge: 'Tidak dikenal', badgeTone: 'bad', kind: 'QRmed!', raw, summary: id, details: [['ID', id], ['Status', 'Tidak ada di database lokal perangkat ini'], ['Tip', 'Buat/validasi QR di HP yang sama']], actions: actionButtons });
    }
    if (code.status === 'used') {
      addHistory({ action: 'scan', type: 'qrmed', title: code.name, summary: `Sudah digunakan · ${id}`, raw, valid: false });
      return showScanResult({ title: code.name, badge: 'Sudah digunakan', badgeTone: 'warn', kind: 'QRmed!', raw, summary: id, details: [['Nama', code.name], ['ID', id], ['Catatan', code.note || '-'], ['Digunakan', code.usedAt ? formatTime(code.usedAt) : '-']], actions: [{ id: 'copy-raw', label: 'Salin ID', primary: true }, { id: 'share', label: 'Bagikan' }] });
    }
    addHistory({ action: 'scan', type: 'qrmed', title: code.name, summary: `${code.note || 'QRmed terverifikasi'} · ${id}`, raw, valid: true });
    const card = $('#scanResult');
    card.className = 'result-card';
    card.innerHTML = `<div class="verified-hero"><svg class="check-ring" viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="46"/><path d="M30 54l15 15 30-34"/></svg><p class="verified-sub">QRmed! tervalidasi</p><h3 class="verified-name">${escapeHtml(code.name)}</h3><span class="badge good">Centang hijau · ${escapeHtml(id)}</span></div><div class="result-body"><div class="meta-row"><span>Catatan</span><strong>${escapeHtml(code.note || '-')}</strong></div><div class="meta-row"><span>Dibuat</span><strong>${escapeHtml(formatTime(code.createdAt))}</strong></div><div class="meta-row"><span>Sekali pakai</span><strong>${code.oneTime ? 'Ya' : 'Tidak'}</strong></div></div><div class="result-actions">${actionButtons.map(action => `<button class="button ${action.primary ? 'button-primary' : 'button-secondary'}" type="button" data-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('')}<button class="button button-ghost" type="button" data-action="copy-raw">Salin isi</button></div><div class="result-raw">${escapeHtml(raw)}</div>`;
    $$('#scanResult [data-action]').forEach(button => button.addEventListener('click', () => handleResultAction(button.dataset.action, { raw, title: code.name, actions: actionButtons })));
    card.classList.remove('is-hidden');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderWifiResult(raw, wifi, options) {
    const title = wifi.ssid || 'WiFi tanpa nama';
    addHistory({ action: 'scan', type: 'wifi', title, summary: `Keamanan ${wifi.security}${wifi.hidden ? ' · hidden' : ''}`, raw, valid: true });
    showScanResult({ title, badge: 'WiFi terdeteksi', badgeTone: 'good', kind: 'WiFi QR', raw, summary: raw, details: [['SSID', title], ['Keamanan', wifi.security], ['Password', wifi.password ? '••••••••  (bisa disalin)' : '(tanpa password)'], ['Hidden', wifi.hidden ? 'Ya' : 'Tidak'], ['Catatan', 'Android tetap minta konfirmasi untuk terhubung.']], actions: [{ id: 'open-wifi-settings', label: 'Buka Pengaturan WiFi', primary: true }, { id: 'copy-password', label: 'Salin Password' }, { id: 'share', label: 'Bagikan' }] });
  }

  function renderVCardResult(raw, contact, options) {
    const name = contact.name || 'Kontak QR';
    addHistory({ action: 'scan', type: 'contact', title: name, summary: [contact.phone, contact.email].filter(Boolean).join(' · ') || 'vCard', raw, valid: true });
    showScanResult({ title: name, badge: 'Kontak / vCard', badgeTone: 'good', kind: 'Kontak', raw, summary: raw, details: [['Nama', name], ['Telepon', contact.phone || '-'], ['Email', contact.email || '-'], ['Organisasi', contact.org || '-']], actions: [{ id: 'download-vcard', label: 'Simpan Kontak (.vcf)', primary: true }, { id: 'share', label: 'Bagikan' }] });
  }
  function renderCalendarResult(raw, calendar, options) {
    addHistory({ action: 'scan', type: 'calendar', title: calendar.summary, summary: [calendar.start, calendar.location].filter(Boolean).join(' · '), raw, valid: true });
    showScanResult({ title: calendar.summary, badge: 'Kalender', badgeTone: 'good', kind: 'Kalender', raw, summary: raw, details: [['Acara', calendar.summary], ['Mulai', calendar.start || '-'], ['Selesai', calendar.end || '-'], ['Lokasi', calendar.location || '-']], actions: [{ id: 'download-ics', label: 'Simpan Kalender (.ics)', primary: true }, { id: 'share', label: 'Bagikan' }] });
  }
  function renderGenericResult(raw, kind, type, meta, details, summaryDetails, options, actions) {
    addHistory({ action: 'scan', type, title: kind, summary: truncate(raw, 160), raw, valid: true });
    showScanResult({ title: kind, badge: 'Terdeteksi', badgeTone: 'good', kind, raw, summary: raw, details: summaryDetails, actions });
  }

  let currentCreateTab = 'general';
  function switchCreateTab(tab) {
    currentCreateTab = tab;
    $$('.subtab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.createTab === tab));
    $$('.create-panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab));
    // General text is required only when visible.
    $('#generalText').required = tab === 'general'; $('#qrmedName').required = tab === 'qrmed'; $('#wifiSsid').required = tab === 'wifi'; $('#contactName').required = tab === 'contact';
  }
  function resetCreateForm() { $('#createForm').reset(); $('#createPreview').classList.add('is-hidden'); $('#createPreview').innerHTML = ''; switchCreateTab(currentCreateTab); }

  function buildPayload() {
    if (currentCreateTab === 'general') { const text = $('#generalText').value.trim(); if (!text) throw new Error('Isi QR masih kosong.'); return { text, type: 'text', title: $('#generalLabel').value.trim() || 'QR Umum', summary: truncate(text, 140) }; }
    if (currentCreateTab === 'qrmed') { const name = $('#qrmedName').value.trim(); if (!name) throw new Error('Nama wajib diisi.'); const code = { id: newId(), name, note: $('#qrmedNote').value.trim(), oneTime: $('#qrmedOneTime').checked, status: 'active', createdAt: Date.now(), scannedCount: 0, usedAt: null }; return { text: `QRMED1:${code.id}`, type: 'qrmed', title: `QRmed: ${name}`, summary: `${code.note || 'QRmed terverifikasi'} · ${code.id}`, code }; }
    if (currentCreateTab === 'wifi') { const ssid = $('#wifiSsid').value.trim(); if (!ssid) throw new Error('SSID WiFi wajib diisi.'); const security = $('#wifiSecurity').value; const password = $('#wifiPassword').value; if (security !== 'nopass' && !password) throw new Error('Password wajib untuk WPA/WEP.'); return { text: wifiPayload({ ssid, password, security, hidden: $('#wifiHidden').checked }), type: 'wifi', title: `WiFi ${ssid}`, summary: `Keamanan ${security}${$('#wifiHidden').checked ? ' · hidden' : ''}` }; }
    if (currentCreateTab === 'contact') { const name = $('#contactName').value.trim(); if (!name) throw new Error('Nama kontak wajib diisi.'); const phone = $('#contactPhone').value.trim(); const email = $('#contactEmail').value.trim(); const org = $('#contactOrg').value.trim(); const vcard = ['BEGIN:VCARD','VERSION:3.0',`FN:${name}`,phone ? `TEL:${phone}` : '',email ? `EMAIL:${email}` : '',org ? `ORG:${org}` : '','END:VCARD'].filter(Boolean).join('\r\n'); return { text: vcard, type: 'contact', title: name, summary: [phone, email].filter(Boolean).join(' · ') || org || 'vCard' }; }
    throw new Error('Jenis QR tidak dikenal.');
  }

  let currentPreview = null;
  function renderQrPreview(payload) {
    if (!window.qrcode) throw new Error('Generator QR gagal dimuat.');
    try { if (window.qrcode.stringToBytesFuncs?.['UTF-8']) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8']; } catch {}
    const qr = qrcode(0, 'M'); qr.addData(payload.text); qr.make();
    const svg = qr.createSvgTag(6, 6, 'QRmed! QR code');
    const preview = $('#createPreview');
    preview.className = 'preview-card';
    preview.innerHTML = `<div class="preview-qr">${svg}</div><div><b>${escapeHtml(payload.title)}</b><div class="preview-payload">${escapeHtml(payload.text)}</div></div><div class="result-actions"><button class="button button-primary" type="button" data-preview-action="png">Download PNG</button><button class="button button-secondary" type="button" data-preview-action="svg">Download SVG</button><button class="button button-ghost" type="button" data-preview-action="print">Cetak</button></div>`;
    currentPreview = payload;
    preview.classList.remove('is-hidden');
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $$('#createPreview [data-preview-action]').forEach(button => button.addEventListener('click', () => handlePreviewAction(button.dataset.previewAction)));
  }
  function getPreviewSvg() { const svg = $('#createPreview svg'); if (!svg) return null; svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); return new XMLSerializer().serializeToString(svg); }
  function handlePreviewAction(action) {
    const file = safeFileName(currentPreview?.title || 'qrmed');
    const svg = getPreviewSvg(); if (!svg) return;
    if (action === 'svg') return downloadText(svg, `${file}.svg`, 'image/svg+xml;charset=utf-8');
    if (action === 'print') { $('#createPreview').classList.add('printable'); window.print(); setTimeout(() => $('#createPreview').classList.remove('printable'), 500); return; }
    if (action === 'png') {
      const image = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      image.onload = () => { const canvas = document.createElement('canvas'); const size = 1024; canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size); const margin = 64; ctx.drawImage(image, margin, margin, size - margin * 2, size - margin * 2); URL.revokeObjectURL(url); canvas.toBlob(blob => blob && downloadBlob(blob, `${file}.png`), 'image/png'); };
      image.onerror = () => { URL.revokeObjectURL(url); toast('Gagal membuat PNG'); }; image.src = url;
    }
  }

  function bindEvents() {
    $$('[data-go]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.go)));
    $('#startCameraButton').addEventListener('click', startCamera);
    $('#stopCameraButton').addEventListener('click', stopCamera);
    $('#scanImageInput').addEventListener('change', event => scanImageFile(event.target.files?.[0]));
    $$('.subtab').forEach(button => button.addEventListener('click', () => switchCreateTab(button.dataset.createTab)));
    $('#createForm').addEventListener('submit', event => {
      event.preventDefault();
      try {
        const payload = buildPayload();
        if (payload.code) setCodes([payload.code, ...getCodes()]);
        renderQrPreview(payload);
        addHistory({ action: 'create', type: payload.type, title: payload.title, summary: payload.summary, raw: payload.text, valid: payload.type === 'qrmed' ? true : null });
        toast('QR berhasil dibuat');
      } catch (error) { toast(error.message || 'Gagal membuat QR'); }
    });
    $('#resetCreateButton').addEventListener('click', resetCreateForm);
    $('#historySearch').addEventListener('input', renderHistory);
    $('#historyFilter').addEventListener('change', renderHistory);
    $('#exportHistoryButton').addEventListener('click', exportHistory);
    $('#clearHistoryButton').addEventListener('click', () => { if (confirm('Hapus semua riwayat QRmed? Tindakan ini tidak menghapus database QR.')) { setHistory([]); renderStats(); renderRecent(); renderHistory(); } });
    $('#historyList').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      const item = button.closest('.history-item'); const id = item?.dataset.id; const record = getHistory().find(entry => entry.id === id); if (!record) return;
      if (button.classList.contains('copy')) copyText(record.raw || record.summary || '').then(() => toast('Disalin'));
      if (button.classList.contains('delete')) deleteHistoryItem(id);
    });
    $('#helpButton').addEventListener('click', () => $('#helpDialog').showModal());
    $('#seedDemoButton').addEventListener('click', seedDemo);
    window.addEventListener('beforeunload', () => { if (scannerRunning && html5Qrcode) html5Qrcode.stop().catch(() => {}); });
  }

  function setPage(page) {
    if (page !== 'scan') stopCamera();
    $$('.page').forEach(section => section.classList.toggle('is-active', section.id === `page-${page}`));
    $$('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.go === page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function seedDemo() {
    const code = { id: 'QRM-DEMO-2026', name: 'Rafi Pratama', note: 'Contoh QRmed dari perangkat ini', oneTime: true, status: 'active', createdAt: Date.now() - 86400000, scannedCount: 0, usedAt: null };
    const codes = getCodes(); if (!codes.some(item => item.id === code.id)) setCodes([code, ...codes]);
    if (!getHistory().some(item => item.raw === `QRMED1:${code.id}`)) {
      addHistory({ action: 'create', type: 'qrmed', title: 'QRmed: Rafi Pratama', summary: `${code.note} · ${code.id}`, raw: `QRMED1:${code.id}`, valid: true, timestamp: Date.now() - 86400000 });
      addHistory({ action: 'scan', type: 'qrmed', title: code.name, summary: `Contoh tervalidasi · ${code.id}`, raw: `QRMED1:${code.id}`, valid: true, timestamp: Date.now() - 3600000 });
    }
    toast('Contoh QRmed ditambahkan');
    renderStats(); renderRecent(); renderHistory();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const secure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  bindEvents();
  switchCreateTab('general');
  renderStats();
  renderRecent();
  renderHistory();
  registerServiceWorker();
})();
