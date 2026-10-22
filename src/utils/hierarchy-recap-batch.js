const parseRecap = require('./hierarchy-recap');
const validateInput = require('../steps/00-validate-input');
const units = require('../config/unit-registry');
const { checkFiles, loadSource, fingerprint, inputError } = require('./rkk-metadata');

async function inspectSource(file) {
  const loaded = await loadSource(file);
  const validation = await validateInput(file.buffer);
  const nodes = await parseRecap(null, { worksheet: loaded.ws, canonical: true });
  const records = nodes.get('ROOT').records;
  if (!records.length || records.some(r => !r.c322 || !r.d4 || !r.c43 || !r.c433 || !r.d3 || !r.alpha || !r.d6 || !Number.isFinite(r.val)))
    throw inputError('Detail RKK kosong atau mempunyai hirarki tidak lengkap: ' + file.originalname);
  const audit=require('./rkk-detail-normalizer').normalize(loaded.ws);
  const mismatches = audit.reconciliation;
  return { nodes, metadata: { ...loaded.metadata, validation, reconciliation: mismatches, normalizationFindings:audit.findings, auditWarnings:audit.warnings, structuralIssues:audit.issues, validationComplete:audit.validationComplete, valid: validation.valid && !mismatches.length && !audit.issues.length,
    totalVal: records.reduce((s, r) => s + r.val, 0), recordCount: records.length } };
}
async function inspectFiles(files) {
  checkFiles(files);
  const deadline = Date.now() + 60000;
  const sources = [], seen = new Set();
  for (const file of files) {
    if (Date.now() > deadline) throw inputError('Pemeriksaan melewati 60 detik. Kurangi jumlah file.', 413);
    const sourceId = fingerprint(file.buffer);
    try {
      if (seen.has(sourceId)) throw inputError('File identik sudah ada pada batch. Hapus salah satu salinannya.');
      seen.add(sourceId);
      const source = await inspectSource(file);
      sources.push(source.metadata);
    } catch (error) {
      if (!error.status) throw error;
      sources.push({ sourceId, originalName: file.originalname, valid: false, error: error.message });
    }
  }
  return { sources, unitOptions: units.map(({ id, name }) => ({ id, name })) };
}
function resolveUnits(customUnits = []) {
  if (!Array.isArray(customUnits) || customUnits.length > 50) throw inputError('Daftar unit tambahan tidak valid.', 400);
  const registry = new Map(units.map(u => [u.id, { id: u.id, name: u.name }]));
  const names = new Set(units.map(u => u.name.toLowerCase()));
  for (const unit of customUnits) {
    if (!unit || typeof unit.id !== 'string' || !/^custom-[a-z0-9-]{1,64}$/.test(unit.id) ||
        typeof unit.name !== 'string' || !unit.name.trim() || unit.name.length > 150 || /[\u0000-\u001f]/.test(unit.name) ||
        registry.has(unit.id) || names.has(unit.name.trim().toLowerCase()))
      throw inputError('Unit tambahan tidak valid atau nama/id duplikat.', 400);
    const name = unit.name.trim();
    registry.set(unit.id, { id: unit.id, name });
    names.add(name.toLowerCase());
  }
  return registry;
}
function projectSources(parsed, registry, year, filters = {}) {
  const nodes = new Map();
  nodes.set('ROOT', { key: 'ROOT', code: 'SATKER', name: 'Total file terpilih', level: 0, levelName: 'Total file terpilih', parentKey: '', fullPath: 'Total file terpilih', records: [], sourceIds: [], unitIds: [] });
  const tupleKey = values => 'B_' + Buffer.from(JSON.stringify(values)).toString('base64url');
  for (const source of parsed) {
    const owner = registry.get(source.assignment.ownerId);
    if (filters.ownerId && filters.ownerId !== owner.id) continue;
    const localKeys = new Map([['ROOT', 'ROOT']]);
    for (const node of source.nodes.values()) {
      if (!node.level) continue;
      const parts = node.fullPath.split(' > ');
      const activity = parts[1];
      const responsibleId = source.assignment.activityAssignments.find(a => a.programCode === parts[0] && a.activityCode === activity)?.responsibleUnitId || owner.id;
      if (node.level >= 2 && filters.responsibleUnitId && filters.responsibleUnitId !== responsibleId) continue;
      const responsible = registry.get(responsibleId);
      const key = node.level === 1 ? tupleKey([year, parts[0]]) : tupleKey([year, owner.id, responsible.id, ...parts]);
      localKeys.set(node.key, key);
      if (!nodes.has(key)) {
        const unitLabel = owner.name + (responsible.id !== owner.id ? ' / PJ: ' + responsible.name : '');
        nodes.set(key, { ...node, key, name: node.level === 2 ? node.name + ' — ' + unitLabel : node.name,
          parentKey: localKeys.get(node.parentKey) || 'ROOT',
          fullPath: node.level >= 2 ? unitLabel + ' > ' + node.fullPath : node.fullPath,
          records: [], sourceIds: [], unitIds: [],
          ...(node.level >= 2 ? { ownerId: owner.id, ownerName: owner.name, responsibleUnitId: responsible.id, responsibleUnitName: responsible.name } : {}) });
      }
    }
    const recordCache = new Map();
    const decorate = r => {
      if (!recordCache.has(r.rowNum)) {
        const responsibleId = source.assignment.activityAssignments.find(a => a.programCode === r.c322 && a.activityCode === r.d4)?.responsibleUnitId || owner.id;
        recordCache.set(r.rowNum, { ...r, sourceId: source.metadata.sourceId, originalName: source.metadata.originalName, sheetName: source.metadata.sheetName,
          ownerId: owner.id, ownerName: owner.name, responsibleUnitId: responsibleId, responsibleUnitName: registry.get(responsibleId).name,
          recordId: source.metadata.sourceId + ':' + source.metadata.sheetName + ':' + r.rowNum,
          fullPath: [r.c322, r.d4, r.c43, r.c433, r.d3, r.alpha, r.d6].join(' > ') });
      }
      return recordCache.get(r.rowNum);
    };
    for (const node of source.nodes.values()) {
      const target = nodes.get(localKeys.get(node.key));
      if (!target) continue;
      const records = node.records.map(decorate).filter(r => !filters.responsibleUnitId || r.responsibleUnitId === filters.responsibleUnitId);
      target.records.push(...records);
      if (records.length) {
        if (!target.sourceIds.includes(source.metadata.sourceId)) target.sourceIds.push(source.metadata.sourceId);
        if (!target.unitIds.includes(owner.id)) target.unitIds.push(owner.id);
      }
    }
  }
  // Empty program nodes should not remain after filtering by responsibility.
  for (const [key, node] of nodes) if (node.level && !node.records.length) nodes.delete(key);
  const data = parseRecap.buildRecap(nodes);
  data.levelOptions[0].label = 'Total file terpilih';
  const activeRecords = nodes.get('ROOT').records;
  return { ...data, schemaVersion: 2, fiscalYear: year, filters,
    activityCodeCount: new Set(activeRecords.map(r => r.d4)).size,
    activityBranchCount: Object.values(data.nodeSummaries).filter(n => n.level === 2).length,
    unitOptions: [...registry.values()],
    sources: parsed.map(s => ({ ...s.metadata, ownerId: s.assignment.ownerId, ownerName: registry.get(s.assignment.ownerId).name,
      included: data.rootSummary.sourceIds.includes(s.metadata.sourceId) })),
    assignments: parsed.map(s => s.assignment), perFileValidation: parsed.map(s => ({ sourceId: s.metadata.sourceId, validation: s.metadata.validation })) };
}
async function buildBatch(files, manifest) {
  checkFiles(files);
  const deadline = Date.now() + 60000;
  if (!manifest || (manifest.fiscalYear != null && (!Number.isInteger(manifest.fiscalYear) || manifest.fiscalYear < 2000 || manifest.fiscalYear > 2100)) ||
      !Array.isArray(manifest.sources) || manifest.sources.length !== files.length)
    throw inputError('Manifest harus memuat pilihan pemilik untuk setiap file; tahun anggaran opsional harus berupa integer 2000–2100.', 400);
  const registry = resolveUnits(manifest.customUnits);
  const ids = new Set(), owners = new Set(), assignments = new Map();
  for (const a of manifest.sources) {
    if (!a || typeof a.sourceId !== 'string' || assignments.has(a.sourceId) || !registry.has(a.ownerId) || a.confirmed !== true)
      throw inputError('Pemilik setiap sumber wajib dipilih dan dikonfirmasi; sourceId tidak boleh duplikat.');
    if (owners.has(a.ownerId)) throw inputError('Ada beberapa file untuk unit/tahun yang sama. Pilih satu versi aktif atau hapus salinannya.');
    owners.add(a.ownerId);
    if (a.activityAssignments !== undefined && !Array.isArray(a.activityAssignments)) throw inputError('Mapping kegiatan tidak valid.', 400);
    assignments.set(a.sourceId, { sourceId: a.sourceId, ownerId: a.ownerId, confirmed: true, activityAssignments: a.activityAssignments || [] });
  }
  const parsed = [];
  for (const file of files) {
    if (Date.now() > deadline) throw inputError('Pemrosesan melewati 60 detik. Kurangi jumlah file.', 413);
    const id = fingerprint(file.buffer);
    if (ids.has(id)) throw inputError('File identik tidak boleh dimuat dua kali.');
    ids.add(id);
    const assignment = assignments.get(id);
    if (!assignment) throw inputError('Isi file tidak sesuai manifest. Periksa ulang file yang dipilih.');
    const source = await inspectSource(file);
    if (!source.metadata.valid) {
      const error = inputError('Validasi/rekonsiliasi gagal: ' + file.originalname);
      error.issues = source.metadata;
      throw error;
    }
    if (manifest.fiscalYear != null && source.metadata.fiscalYears.some(y => y !== manifest.fiscalYear)) throw inputError('Tahun anggaran file tidak sesuai tahun batch: ' + file.originalname);
    const mapped = new Set();
    for (const a of assignment.activityAssignments) {
      if (!a || !registry.has(a.responsibleUnitId) || !source.metadata.activities.some(v => v.programCode === a.programCode && v.code === a.activityCode) ||
          mapped.has(a.programCode + '/' + a.activityCode)) throw inputError('Mapping penanggung jawab kegiatan tidak valid atau duplikat.');
      mapped.add(a.programCode + '/' + a.activityCode);
    }
    parsed.push({ ...source, assignment });
  }
  const detectedYears = [...new Set(parsed.flatMap(s => s.metadata.fiscalYears))];
  if (detectedYears.length > 1) throw inputError('Tahun anggaran yang terdeteksi berbeda; file dari tahun berbeda tidak dapat digabung.');
  const year = manifest.fiscalYear ?? detectedYears[0] ?? null;
  if (Date.now() > deadline) throw inputError('Pemrosesan melewati 60 detik. Kurangi jumlah file.', 413);
  const filters = manifest.filters || {};
  if (typeof filters !== 'object' || (filters.ownerId && !registry.has(filters.ownerId)) || (filters.responsibleUnitId && !registry.has(filters.responsibleUnitId)))
    throw inputError('Filter unit tidak dikenal.', 400);
  return projectSources(parsed, registry, year, { ownerId: filters.ownerId || '', responsibleUnitId: filters.responsibleUnitId || '' });
}
module.exports = { inspectFiles, inspectSource, buildBatch, projectSources };

// Node keys are opaque UI references. Short wire IDs avoid repeating complete
// owner UUIDs and hierarchy paths in every key, parent and child reference.
function packRecap(data) {
  const detailRecords = [], detailIndexes = new Map(), keys = new Map([['ROOT', 'ROOT']]);
  const register = key => {
    if (key && !keys.has(key)) keys.set(key, 'N' + keys.size);
  };
  Object.keys(data.nodeSummaries).forEach(register);
  function registerTree(node) {
    if (!node) return;
    register(node.key);
    (node.children || []).forEach(registerTree);
  }
  registerTree(data.hierarchyTree);
  const wireKey = key => keys.get(key) || key;
  const packSummary = summary => ({
    ...summary,
    key: wireKey(summary.key),
    parentKey: wireKey(summary.parentKey),
    childrenKeys: (summary.childrenKeys || []).map(wireKey),
    digit6List: summary.digit6List.map(account => {
      const { details, ...packedAccount } = account;
      return { ...packedAccount, detailIndexes: details.map(detail => {
        if (!detailIndexes.has(detail.recordId)) {
          detailIndexes.set(detail.recordId, detailRecords.length);
          detailRecords.push(detail);
        }
        return detailIndexes.get(detail.recordId);
      }) };
    })
  });
  const nodeSummaries = Object.fromEntries(Object.values(data.nodeSummaries).map(summary => [wireKey(summary.key), packSummary(summary)]));
  function packTree(node) {
    if (!node) return null;
    return { ...node, key: wireKey(node.key), parentKey: wireKey(node.parentKey), children: (node.children || []).map(packTree) };
  }
  return {
    ...data,
    rootSummary: nodeSummaries.ROOT,
    nodeSummaries,
    nodesByLevel: Object.fromEntries(Object.entries(data.nodesByLevel).map(([level, nodes]) => [level, nodes.map(node => ({ ...node, key: wireKey(node.key) }))])),
    childrenMap: Object.fromEntries(Object.entries(data.childrenMap).map(([key, children]) => [wireKey(key), children.map(wireKey)])),
    hierarchyTree: packTree(data.hierarchyTree),
    compactDetails: true,
    detailRecords
  };
}
module.exports.packRecap = packRecap;
