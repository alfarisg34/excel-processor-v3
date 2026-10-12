(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const review = $('recapBatchReview'), list = $('recapBatchFiles'), yearInput = $('recapFiscalYear');
  const ownerFilter = $('recapOwnerFilter'), responsibleFilter = $('recapResponsibleFilter');
  let entries = [], unitOptions = [], customUnits = [], busy = false, generation = 0, controller;
  let busyPhase = '', busyStartedAt = 0, loadingTimer = null;
  const escape = value => escapeHtml(String(value ?? ''));
  const options = (selected, placeholder) => '<option value="">' + escape(placeholder) + '</option>' +
    [...unitOptions, ...customUnits].map(u => '<option value="' + escape(u.id) + '"' + (u.id === selected ? ' selected' : '') + '>' + escape(u.name) + '</option>').join('');
  function invalidate() {
    currentRecapData = null;
    recapResultPanel.style.display = 'none';
    ownerFilter.value = '';
    responsibleFilter.value = '';
  }
  function readiness() {
    const year = Number(yearInput.value);
    const owners = entries.map(e => e.ownerId).filter(Boolean);
    const duplicateOwner = new Set(owners).size !== owners.length;
    const ready = entries.length > 0 && Number.isInteger(year) && year >= 2000 && year <= 2100 &&
      !duplicateOwner && entries.every(e => e.metadata?.valid && e.ownerId && e.confirmed &&
        (!e.metadata.fiscalYears?.length || e.metadata.fiscalYears.every(y => y === year)));
    btnProcessRecap.disabled = busy || !ready;
    btnProcessRecap.title = busy ? 'Proses sedang berjalan. Tunggu atau klik Batalkan.' : ready ? 'Buat rekap dari file yang dikonfirmasi' : 'Periksa file, pilih tahun anggaran, dan konfirmasi pemilik setiap file terlebih dahulu.';
    if (!busy && duplicateOwner) showStatus(statusRecap, 'Ada beberapa file untuk unit/tahun yang sama. Hapus salah satu dan pilih versi aktif.', 'error');
    return ready;
  }
  function updateElapsed() {
    $('recapLoadingElapsed').textContent = Math.floor((Date.now() - busyStartedAt) / 1000) + ' detik berlalu';
  }
  function setBusy(value, phase = busyPhase || 'inspect') {
    const wasBusy = busy;
    busy = value;
    if (value) {
      busyPhase = phase;
      if (!wasBusy) {
        busyStartedAt = Date.now();
        loadingTimer = setInterval(updateElapsed, 1000);
      }
      const inspect = phase === 'inspect';
      $('recapLoadingTitle').textContent = inspect ? 'Memeriksa ' + entries.length + ' file XLSX…'
        : phase === 'filter' ? 'Menerapkan filter unit…' : 'Membuat rekap gabungan…';
      $('recapLoadingHelp').textContent = inspect
        ? 'Isi file sedang dibaca dan divalidasi. Pemilihan unit, tahun, dan tombol rekap aktif kembali setelah selesai.'
        : 'Data sedang dihitung. Kontrol sementara nonaktif agar proses tidak dikirim dua kali.';
      updateElapsed();
    } else {
      clearInterval(loadingTimer);
      loadingTimer = null;
      busyPhase = '';
    }
    $('recapLoading').hidden = !value;
    review.setAttribute('aria-busy', String(value));
    list.setAttribute('aria-busy', String(value));
    dropZoneRecap.classList.toggle('is-busy', value);
    dropZoneRecap.setAttribute('aria-busy', String(value));
    dropZoneRecap.setAttribute('aria-disabled', String(value));
    fileInputRecap.disabled = value;
    review.querySelectorAll('input, select, button').forEach(el => { el.disabled = value; });
    ownerFilter.disabled = value;
    responsibleFilter.disabled = value;
    btnProcessRecap.innerHTML = value
      ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ' + (busyPhase === 'inspect' ? 'Memeriksa file…' : 'Menghitung rekap…')
      : '<i class="fa-solid fa-chart-bar" aria-hidden="true"></i> Buat Rekap Gabungan';
    readiness();
  }
  function renderReview() {
    review.hidden = !entries.length;
    fileStatusRecap.textContent = entries.length ? entries.length + ' file dipilih' : '';
    list.innerHTML = entries.map((entry, index) => {
      const meta = entry.metadata;
      const problem = entry.error || meta?.error ||
        (meta && !meta.valid ? 'Validasi hirarki atau subtotal gagal. ' +
          (meta.validation?.violations || []).map(v => v.ruleTitle).join('; ') +
          (meta.reconciliation || []).map(r => r.cell + ': subtotal ' + r.expected + ', detail ' + r.actual).join('; ') + ' ' + (meta.structuralIssues || []).map(r => 'Baris ' + r.sourceRows.join(', ') + ': ' + r.message).join('; ') : '');
      const evidence = (meta?.evidence || []).filter(e => !['kppn', 'location'].includes(e.type)).slice(0, 8);
      return '<section class="recap-source-card">' +
        '<div class="recap-source-heading"><strong>' + escape(entry.file.name) + '</strong><button type="button" class="btn btn-sm" data-action="remove" data-index="' + index + '">Hapus</button></div>' +
        ((meta?.normalizationFindings || []).length ? '<p class="recap-batch-help">'+meta.normalizationFindings.map(f=>'Uraian digabung: baris '+escape(f.sourceRows.join(', '))+' · '+escape(f.uraian)).join('<br>')+'</p>' : '') +
        ((meta?.auditWarnings || []).length ? '<p class="recap-batch-help">'+meta.auditWarnings.map(f=>'Perlu ditinjau: baris '+escape(f.sourceRows.join(', '))+' · '+escape(f.message)).join('<br>')+'</p>' : '') +
        '<p>' + (entry.file.size / 1024).toFixed(1) + ' KiB' + (meta?.totalVal !== undefined ? ' · ' + escape(formatRp(meta.totalVal)) : '') + '</p>' +
        (busy && busyPhase === 'inspect' ? '<p class="recap-source-loading"><span class="recap-loading-spinner" aria-hidden="true"></span>Menunggu hasil pemeriksaan…</p>' : problem ? '<p class="recap-source-error">' + escape(problem) + '</p>' : !meta ? '<p>Belum diperiksa. Klik Periksa ulang file.</p>' :
          '<div class="recap-batch-controls"><label>Unit pemilik file (Satker/Direktorat)<select data-action="owner" data-index="' + index + '">' + options(entry.ownerId, 'Pilih unit pemilik') + '</select></label>' +
          '<label class="recap-confirm"><input type="checkbox" data-action="confirm" data-index="' + index + '"' + (entry.confirmed ? ' checked' : '') + '> Saya mengonfirmasi pemilik file</label></div>' +
          '<p class="recap-batch-help">' + (meta.ownerSuggestion ? 'Saran dari isi: ' + escape(meta.ownerSuggestion.name) : 'Pemilik belum dapat dipastikan dari isi. Pilih atau tambahkan unit.') +
          ' · Lokasi: ' + escape((meta.locations || []).join(', ') || 'tidak tersedia') + ' · KPPN: ' + escape((meta.kppnCodes || []).join(', ') || 'tidak tersedia') + '</p>' +
          '<details><summary>Bukti dari workbook dan penanggung jawab kegiatan</summary>' +
          '<ul>' + evidence.map(e => '<li>' + escape(e.sheetName + '!' + e.cell + ': ' + e.text) + '</li>').join('') + '</ul>' +
          '<p class="recap-batch-help">Default penanggung jawab mengikuti pemilik sumber. Kegiatan 6621 tetap milik sumber; pembagian antar direktorat memerlukan mapping yang lebih rinci.</p>' +
          (meta.activities || []).map(a => '<label class="recap-activity-mapping">' + escape(a.programCode + ' / ' + a.code + ' — ' + a.name) +
            '<select data-action="activity" data-index="' + index + '" data-program="' + escape(a.programCode) + '" data-activity="' + escape(a.code) + '">' +
            options(entry.activityAssignments[a.programCode + '/' + a.code] || '', 'Mengikuti pemilik sumber') + '</select></label>').join('') + '</details>') + '</section>';
    }).join('');
    setBusy(busy);
  }
  async function request(url, body) {
    const response = await fetch(url, { method: 'POST', body, signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('Server tidak mengembalikan hasil JSON. Periksa batas upload atau koneksi.'); }
    if (!response.ok) throw new Error(data.detail || data.error || 'Gagal memproses file.');
    return data;
  }
  async function inspectSelected() {
    const version = ++generation;
    controller?.abort();
    controller = new AbortController();
    invalidate();
    if (!entries.length) { setBusy(false); renderReview(); return; }
    entries.forEach(entry => { entry.error = ''; });
    setBusy(true, 'inspect');
    renderReview();
    showStatus(statusRecap, 'Memeriksa metadata dan hirarki setiap file…', 'info');
    const body = new FormData();
    entries.forEach(e => body.append('files', e.file));
    try {
      const data = await request('/api/recap-hierarchy/inspect', body);
      if (version !== generation) return;
      unitOptions = data.unitOptions;
      entries.forEach((entry, i) => {
        entry.metadata = data.sources[i];
        entry.error = '';
        if (!entry.ownerId) {
          entry.ownerId = entry.metadata.ownerSuggestion?.id || '';
          if (!entry.ownerId && entry.metadata.satkerName) {
            const name = entry.metadata.satkerName.trim().replace(/\s+/g, ' ');
            let unit = [...unitOptions, ...customUnits].find(u => u.name.toLowerCase() === name.toLowerCase());
            if (!unit) { unit = { id: 'custom-' + crypto.randomUUID(), name }; customUnits.push(unit); }
            entry.ownerId = unit.id;
          }
        }
      });
      const years = [...new Set(data.sources.flatMap(s => s.fiscalYears || []))];
      if (years.length === 1 && !yearInput.value) yearInput.value = years[0];
      showStatus(statusRecap, data.sources.every(s => s.valid) ? 'Pemeriksaan selesai. Pilih tahun dan konfirmasi pemilik setiap file.' : 'Ada file bermasalah. Hapus atau perbaiki file tersebut sebelum membuat rekap.', data.sources.every(s => s.valid) ? 'info' : 'error');
    } catch (error) {
      if (version !== generation || error.name === 'AbortError') return;
      entries.forEach(e => { e.error = error.message; e.metadata = null; });
      showStatus(statusRecap, error.message, 'error');
    } finally {
      if (version === generation) { setBusy(false); renderReview(); }
    }
  }
  function addFiles(files) {
    if (busy) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    if (entries.length + selected.length > 10) { showStatus(statusRecap, 'Maksimal 10 file. Hapus beberapa file terlebih dahulu.', 'error'); return; }
    if (selected.some(f => !/\.xlsx$/i.test(f.name) || !f.size || f.size > 5 * 1024 * 1024)) { showStatus(statusRecap, 'Pilih file XLSX yang tidak kosong, maksimal 5 MiB per file.', 'error'); return; }
    if ([...entries.map(e => e.file), ...selected].reduce((s, f) => s + f.size, 0) > 20 * 1024 * 1024) { showStatus(statusRecap, 'Total upload maksimal 20 MiB.', 'error'); return; }
    entries.push(...selected.map(file => ({ file, ownerId: '', confirmed: false, activityAssignments: {} })));
    inspectSelected();
  }
  dropZoneRecap.addEventListener('click', () => { if (!busy) fileInputRecap.click(); });
  dropZoneRecap.addEventListener('dragover', e => { e.preventDefault(); dropZoneRecap.classList.add('dragover'); });
  dropZoneRecap.addEventListener('dragleave', () => dropZoneRecap.classList.remove('dragover'));
  dropZoneRecap.addEventListener('drop', e => { e.preventDefault(); dropZoneRecap.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
  fileInputRecap.addEventListener('click', e => e.stopPropagation());
  fileInputRecap.addEventListener('change', e => { addFiles(e.target.files); fileInputRecap.value = ''; });
  list.addEventListener('click', e => {
    const button = e.target.closest('[data-action="remove"]');
    if (!button || busy) return;
    entries.splice(Number(button.dataset.index), 1);
    inspectSelected();
  });
  list.addEventListener('change', e => {
    const el = e.target, entry = entries[Number(el.dataset.index)];
    if (!entry || busy) return;
    if (el.dataset.action === 'owner') { entry.ownerId = el.value; entry.confirmed = false; renderReview(); }
    else if (el.dataset.action === 'confirm') entry.confirmed = el.checked;
    else if (el.dataset.action === 'activity') entry.activityAssignments[el.dataset.program + '/' + el.dataset.activity] = el.value;
    invalidate(); readiness();
  });
  $('recapCancelRequest').addEventListener('click', () => {
    if (!busy) return;
    const inspection = busyPhase === 'inspect';
    ++generation;
    controller?.abort();
    if (inspection) entries.forEach(entry => {
      if (!entry.metadata) entry.error = 'Pemeriksaan dibatalkan. Klik Periksa ulang file untuk melanjutkan.';
    });
    setBusy(false);
    renderReview();
    showStatus(statusRecap, 'Permintaan dibatalkan. Anda dapat memeriksa ulang file atau membuat rekap kembali.', 'info');
  });
  $('recapInspectFiles').addEventListener('click', () => { if (!busy) inspectSelected(); });

  $('recapClearFiles').addEventListener('click', () => {
    if (busy) return;
    entries = []; yearInput.value = ''; inspectSelected();
  });
  yearInput.addEventListener('input', () => { invalidate(); readiness(); });
  $('recapAddUnit').addEventListener('click', () => {
    const input = $('recapNewUnitName'), name = input.value.trim();
    if (!name || [...unitOptions, ...customUnits].some(u => u.name.toLowerCase() === name.toLowerCase())) {
      showStatus(statusRecap, 'Masukkan nama unit baru yang belum terdaftar.', 'error'); return;
    }
    customUnits.push({ id: 'custom-' + crypto.randomUUID(), name });
    input.value = ''; invalidate(); renderReview();
  });
  async function processBatch(filterChange = false) {
    if (busy || !readiness()) return;
    const version = ++generation;
    controller?.abort(); controller = new AbortController();
    const filters = { ownerId: ownerFilter.value, responsibleUnitId: responsibleFilter.value };
    currentRecapData = null; recapResultPanel.style.display = 'none';
    setBusy(true, filterChange ? 'filter' : 'batch'); showStatus(statusRecap, 'Membuat rekap gabungan…', 'info');
    const manifest = { fiscalYear: Number(yearInput.value), customUnits, filters,
      sources: entries.map(e => ({ sourceId: e.metadata.sourceId, ownerId: e.ownerId, confirmed: e.confirmed,
        activityAssignments: Object.entries(e.activityAssignments).filter(([, id]) => id).map(([key, responsibleUnitId]) => {
          const [programCode, activityCode] = key.split('/'); return { programCode, activityCode, responsibleUnitId };
        }) })) };
    const body = new FormData();
    entries.forEach(e => body.append('files', e.file));
    body.append('manifest', JSON.stringify(manifest));
    try {
      const data = await request('/api/recap-hierarchy/batch', body);
      if (version !== generation) return;
      applyBatchRecap(data);
      ownerFilter.innerHTML = options(filters.ownerId, 'Semua unit');
      responsibleFilter.innerHTML = options(filters.responsibleUnitId, 'Semua penanggung jawab');
      $('recapBatchSummary').textContent = 'TA ' + data.fiscalYear + ' · ' + data.sources.filter(s => s.included).length + ' sumber · ' + data.activityCodeCount + ' kode kegiatan / ' + data.activityBranchCount + ' cabang unit · ' + formatRp(data.rootSummary.totalVal);
      showStatus(statusRecap, 'Rekap selesai. Kegiatan yang sama tetap dipisahkan per unit.', 'success');
    } catch (error) {
      if (version === generation && error.name !== 'AbortError') showStatus(statusRecap, error.message, 'error');
    } finally { if (version === generation) setBusy(false); }
  }
  btnProcessRecap.addEventListener('click', () => processBatch());
  ownerFilter.addEventListener('change', () => processBatch(true));
  responsibleFilter.addEventListener('change', () => processBatch(true));
})();
