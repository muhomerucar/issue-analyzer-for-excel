// ─── STATE ──────────────────────────────────────────────────────────────────
var allRows = [];       // {_sayfa, tip, ay, testKaynakli}
var allCols = [];       // Ham sütun isimleri (ilk sayfadan)
var dataSheets = [];
var colMap = {tip: null, ay: null, test: null};  // Çözümlenen sütun adları

// Filtre state
var selAy = new Set();      // boş = tümü
var selSayfa = new Set();   // boş = tümü
var selTip = new Set();     // boş = tümü
var extraFilters = {};      // {colName: value}  ek filtreler

var filteredRows = [];
var trendChart = null;
var trendTip = 'ALL';
var SKIP_SHEETS = ['OVERALL Q1', 'DATA'];
var TIP_ORDER = ['PR', 'KR', 'HOTFIX', 'ROLLBACK'];
var AY_ORDER = ['OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN',
                'TEMMUZ', 'AGUSTOS', 'EYLUL', 'EKIM', 'KASIM', 'ARALIK'];

// ─── VERİ DÜZENLEME STATE ────────────────────────────────────────────────────
var currentFile      = null;   // Yüklenen File objesi (localStorage anahtarı için)
var currentWb        = null;   // Parsed XLSX workbook (orijinal export için)
var editsOnlyMissing = true;   // "Sadece Belirsiz Test Kaynaklı" filtre toggle
var editsPage        = 0;      // Mevcut sayfa (0 tabanlı)
var EDITS_PAGE_SIZE  = 50;
var selectedRows     = new Set(); // Toplu düzenleme için seçili rowIdx'ler
var editsExtraFilter = {};        // {colName: value} — düzenleme paneli ek filtreleri
var LS_EDITS_PREFIX  = 'qa_edits_';

var KOK_NEDEN_OPTIONS = [
  '',
  'Requirement Gap (Analysis / Design)',
  'Configuration Issue',
  'Environment / Infrastructure',
  'Test Coverage Gap',
  'User Error',
  '3rd Party / Vendor Dependency',
  'Change Request (New Requirement)',
  'Non-Reproducible',
  'Out of Test Scope',
  'Quality Gate Bypass (Known Issue)',
  'Integration'
];

// ─── VERİ DÜZENLEME — ÇÖZÜM NOKTASI ─────────────────────────────────────────
// Kullanıcı düzenlemesi varsa override değeri, yoksa orijinal parse değerini döndürür.
// KPI, grafik, tablo ve export hesaplamalarında r.testKaynakli yerine bu kullanılır.
function efektifTest(row) {
  var e = row._edits;
  if (e && e.testKaynakli !== undefined) return e.testKaynakli;
  return row.testKaynakli;
}

// ─── SÜTUN ARAMA ─────────────────────────────────────────────────────────────
// Türkçe karakterleri normalize ederek kıyasla
function normStr(s) {
  return String(s)
    .toUpperCase()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\u0130/g, 'I')   // İ
    .replace(/\u0131/g, 'I')   // ı
    .replace(/\u015e/g, 'S')   // Ş
    .replace(/\u015f/g, 'S')   // ş
    .replace(/\u00dc/g, 'U')   // Ü
    .replace(/\u00fc/g, 'U')   // ü
    .replace(/\u00d6/g, 'O')   // Ö
    .replace(/\u00f6/g, 'O')   // ö
    .replace(/\u00c7/g, 'C')   // Ç
    .replace(/\u00e7/g, 'C')   // ç
    .replace(/\u011e/g, 'G')   // Ğ
    .replace(/\u011f/g, 'G');  // ğ
}

function findCol(cols, keywords) {
  // keywords: dizi, her birini normalize ederek ara
  for (var i = 0; i < cols.length; i++) {
    var n = normStr(cols[i]);
    for (var j = 0; j < keywords.length; j++) {
      if (n.indexOf(normStr(keywords[j])) !== -1) return cols[i];
    }
  }
  return null;
}

function collectRawColumns(rows, preferredOrder) {
  var seen = new Set();
  var ordered = [];

  function pushCol(col) {
    if (!col || col.charAt(0) === '_' || seen.has(col)) return;
    seen.add(col);
    ordered.push(col);
  }

  (preferredOrder || []).forEach(pushCol);
  rows.forEach(function(row) {
    Object.keys(row || {}).forEach(pushCol);
  });
  return ordered;
}

function isPreferredEditFilterColumn(col) {
  var n = normStr(col);
  return n.indexOf('SORUMLU QA') !== -1 || n === 'QA' || n.indexOf('QA ') !== -1 || n.indexOf(' QA') !== -1;
}

// ─── SÜTUN HARİTASI HAFIZASI ─────────────────────────────────────────────────
var LS_COL_KEY = 'qa_col_map';

function colMapKaydet() {
  try { localStorage.setItem(LS_COL_KEY, JSON.stringify({tip: colMap.tip, ay: colMap.ay, test: colMap.test})); } catch(e) {}
}

function colMapYukle() {
  try { var s = localStorage.getItem(LS_COL_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
}

// ─── FİLTRE DURUMU HAFIZASI ──────────────────────────────────────────────────
var LS_FILTER_KEY  = 'qa_filter_state';

function filtreKaydet() {
  try {
    localStorage.setItem(LS_FILTER_KEY, JSON.stringify({
      ay:       Array.from(selAy),
      sayfa:    Array.from(selSayfa),
      tip:      Array.from(selTip),
      extra:    extraFilters,
      trendTip: trendTip
    }));
  } catch(e) {}
}

function filtreYukle() {
  try { var s = localStorage.getItem(LS_FILTER_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
}

// ─── VERİ DÜZENLEME — LOCALSTORAGE ───────────────────────────────────────────
function editsLsKey() {
  if (!currentFile) return null;
  return LS_EDITS_PREFIX + currentFile.name + '_' + currentFile.size;
}

function editsKaydet() {
  var key = editsLsKey();
  if (!key) return;
  var map = {};
  allRows.forEach(function(row, i) {
    if (row._edits && Object.keys(row._edits).length > 0) map[i] = row._edits;
  });
  try { localStorage.setItem(key, JSON.stringify(map)); } catch(e) {}
}

function editsYukle() {
  var key = editsLsKey();
  if (!key) return 0;
  try {
    var s = localStorage.getItem(key);
    if (!s) return 0;
    var map = JSON.parse(s);
    var count = 0;
    Object.keys(map).forEach(function(i) {
      var idx = parseInt(i, 10);
      if (allRows[idx]) { allRows[idx]._edits = map[i]; count++; }
    });
    return count;
  } catch(e) { return 0; }
}

function editsVarMi() {
  return allRows.some(function(r){ return r._edits && Object.keys(r._edits).length > 0; });
}

// ─── VERİ DÜZENLEME — YARDIMCILAR ────────────────────────────────────────────
function editsSatirEksikMi(row) {
  var e = row._edits || {};
  if (efektifTest(row) === null)  return true;
  if (!e.kokNeden)                return true;
  if (!e.alınacakAksiyon)        return true;
  if (!e.cozumEkibi)             return true;
  return false;
}

function editsGorunurSatirlar() {
  var rows = editsOnlyMissing
    ? allRows.filter(function(r){ return efektifTest(r) === null; })
    : allRows;
  var keys = Object.keys(editsExtraFilter);
  if (keys.length === 0) return rows;
  return rows.filter(function(r) {
    var raw = r._raw || {};
    for (var i = 0; i < keys.length; i++) {
      if ((raw[keys[i]] || '') !== editsExtraFilter[keys[i]]) return false;
    }
    return true;
  });
}

function editsFiltrelerKur() {
  var cont = document.getElementById('editsExtraFilters');
  if (!cont) return;
  cont.innerHTML = '';
  var EDIT_COLS_NORM = ['KOK NEDEN', 'ALINACAK AKSIYON', 'COZUM EKIBI'];
  var skipKeys = [colMap.tip, colMap.ay, colMap.test, '_sayfa', '_raw'];
  var ekKollar = allCols.filter(function(c) {
    if (skipKeys.indexOf(c) !== -1) return false;
    if (c.indexOf('KAYIT') !== -1 || c.indexOf('AKSIYON') !== -1) return false;
    if (EDIT_COLS_NORM.indexOf(normStr(c)) !== -1) return false;
    return true;
  });
  ekKollar.forEach(function(col) {
    var vals = tumDegerler('_raw.' + col, allRows);
    if (vals.length < 2) return;
    if (vals.length > 60 && !isPreferredEditFilterColumn(col)) return;
    var sel = document.createElement('select');
    sel.className = 'ef-select';
    sel.dataset.col = col;
    sel.title = col;
    sel.innerHTML = '<option value="">' + col + '…</option>';
    vals.sort().forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    if (editsExtraFilter[col]) {
      sel.value = editsExtraFilter[col];
      sel.classList.add('active');
    }
    sel.addEventListener('change', function() {
      if (sel.value) {
        editsExtraFilter[col] = sel.value;
        sel.classList.add('active');
      } else {
        delete editsExtraFilter[col];
        sel.classList.remove('active');
      }
      editsPage = 0;
      editsPanelGuncelle();
    });
    cont.appendChild(sel);
  });
}

function editsBadgeGuncelle() {
  var belirsiz = allRows.filter(function(r) { return efektifTest(r) === null; }).length;
  var badge = document.getElementById('editsBadge');
  if (badge) {
    badge.textContent = belirsiz > 0
      ? 'Düzenleme bekleyen ' + belirsiz + ' kayıt'
      : (allRows.length > 0 ? 'Tüm kayıtlar tamamlandı' : 'Analiz sonrası durum burada gösterilecek');
  }
  var badgeTab = document.getElementById('editsBadgeTab');
  if (badgeTab) {
    badgeTab.textContent = belirsiz > 0
      ? belirsiz + ' adet belirsiz kayıt mevcut'
      : (allRows.length > 0 ? 'Belirsiz kayıt bulunmuyor' : 'Analiz edilmesi bekleniyor');
  }
}

function tabGoster(name) {
  var dashboard = document.getElementById('tabDashboard');
  var edits     = document.getElementById('tabEdits');
  var btnD      = document.getElementById('tabBtnDashboard');
  var btnE      = document.getElementById('tabBtnEdits');
  if (!dashboard || !edits) return;
  if (name === 'edits') {
    dashboard.style.display = 'none';
    edits.style.display = '';
    if (btnD) btnD.classList.remove('active');
    if (btnE) btnE.classList.add('active');
    editsFiltrelerKur();
    editsPanelGuncelle();
  } else {
    edits.style.display = 'none';
    dashboard.style.display = '';
    if (btnE) btnE.classList.remove('active');
    if (btnD) btnD.classList.add('active');
  }
}

// ─── VERİ DÜZENLEME — HÜCRE GÜNCELLEME ───────────────────────────────────────
function editHucreGuncelle(rowIdx, field, value) {
  if (!allRows[rowIdx]._edits) allRows[rowIdx]._edits = {};
  if (value === '' || value === undefined) {
    delete allRows[rowIdx]._edits[field];
  } else if (field === 'testKaynakli') {
    allRows[rowIdx]._edits.testKaynakli = (value === 'EVET') ? true : false;
  } else {
    allRows[rowIdx]._edits[field] = value;
  }
  editsKaydet();
  editsBadgeGuncelle();
  // Satır highlight'ını tam yeniden render yapmadan güncelle
  var tr = document.querySelector('tr[data-row-idx="' + rowIdx + '"]');
  if (tr) {
    var eksik = editsSatirEksikMi(allRows[rowIdx]);
    var edited = allRows[rowIdx]._edits && Object.keys(allRows[rowIdx]._edits).length > 0;
    tr.classList.toggle('edt-row-missing', eksik);
    tr.classList.toggle('edt-row-edited', edited && !eksik);
  }
}

// ─── VERİ DÜZENLEME — PANEL RENDER ───────────────────────────────────────────
function editsPanelGuncelle() {
  var satirlar = editsGorunurSatirlar();
  var total    = satirlar.length;
  var pageCount = Math.max(1, Math.ceil(total / EDITS_PAGE_SIZE));
  if (editsPage >= pageCount) editsPage = pageCount - 1;

  var start = editsPage * EDITS_PAGE_SIZE;
  var slice = satirlar.slice(start, start + EDITS_PAGE_SIZE);

  // Satır sayısı bilgisi
  var rc = document.getElementById('editsRowCount');
  if (rc) {
    rc.textContent = total + ' satır' + (editsOnlyMissing ? ' (Belirsiz Test Kaynaklı)' : '') +
      (total > EDITS_PAGE_SIZE ? ' — ' + (start+1) + '–' + Math.min(start+EDITS_PAGE_SIZE, total) + ' gösteriliyor' : '');
  }

  // Tablo body render
  var tbody = document.getElementById('editsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  slice.forEach(function(row) {
    var rowIdx = allRows.indexOf(row);
    var e = row._edits || {};
    var eksik  = editsSatirEksikMi(row);
    var edited  = row._edits && Object.keys(row._edits).length > 0;
    var tk = efektifTest(row);

    var tr = document.createElement('tr');
    tr.dataset.rowIdx = rowIdx;
    if (eksik)         tr.classList.add('edt-row-missing');
    else if (edited)   tr.classList.add('edt-row-edited');

    // Checkbox sütunu
    var tdCb = document.createElement('td');
    tdCb.className = 'edt-cell-cb';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedRows.has(rowIdx);
    cb.addEventListener('change', function() {
      if (cb.checked) selectedRows.add(rowIdx); else selectedRows.delete(rowIdx);
      bulkBarGuncelle();
    });
    tdCb.appendChild(cb);
    tr.appendChild(tdCb);

    // Read-only bilgi hücreleri — tıklayınca detay modal
    ['_sayfa','tip','ay'].forEach(function(f) {
      var td = document.createElement('td');
      td.className = 'edt-cell-info';
      td.textContent = row[f] || '—';
      td.title = 'Tüm sütunları görüntüle';
      td.addEventListener('click', function(){ satirDetayGoster(rowIdx); });
      tr.appendChild(td);
    });

    // Kök Neden (dropdown)
    var tdKok = document.createElement('td');
    tdKok.className = 'edt-cell-edit';
    var selKok = document.createElement('select');
    selKok.className = 'edt-select' + (e.kokNeden ? ' filled' : '');
    KOK_NEDEN_OPTIONS.forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt; o.textContent = opt || '— Seçiniz —';
      if (e.kokNeden === opt) o.selected = true;
      selKok.appendChild(o);
    });
    selKok.addEventListener('change', function() {
      selKok.className = 'edt-select' + (selKok.value ? ' filled' : '');
      editHucreGuncelle(rowIdx, 'kokNeden', selKok.value);
    });
    tdKok.appendChild(selKok); tr.appendChild(tdKok);

    // Alınacak Aksiyon (text)
    var tdAks = document.createElement('td');
    tdAks.className = 'edt-cell-edit';
    var inpAks = document.createElement('input');
    inpAks.type = 'text'; inpAks.className = 'edt-input' + (e.alınacakAksiyon ? ' filled' : '');
    inpAks.value = e.alınacakAksiyon || '';
    inpAks.placeholder = 'Aksiyon girin…';
    inpAks.addEventListener('change', function() {
      inpAks.className = 'edt-input' + (inpAks.value ? ' filled' : '');
      editHucreGuncelle(rowIdx, 'alınacakAksiyon', inpAks.value.trim());
    });
    tdAks.appendChild(inpAks); tr.appendChild(tdAks);

    // Çözüm Ekibi (text)
    var tdEkip = document.createElement('td');
    tdEkip.className = 'edt-cell-edit';
    var inpEkip = document.createElement('input');
    inpEkip.type = 'text'; inpEkip.className = 'edt-input' + (e.cozumEkibi ? ' filled' : '');
    inpEkip.value = e.cozumEkibi || '';
    inpEkip.placeholder = 'Ekip adı…';
    inpEkip.addEventListener('change', function() {
      inpEkip.className = 'edt-input' + (inpEkip.value ? ' filled' : '');
      editHucreGuncelle(rowIdx, 'cozumEkibi', inpEkip.value.trim());
    });
    tdEkip.appendChild(inpEkip); tr.appendChild(tdEkip);

    // Test Kaynaklı (dropdown)
    var tdTk = document.createElement('td');
    var selTk = document.createElement('select');
    var tkClass = tk === true ? ' tk-evet' : tk === false ? ' tk-hayir' : '';
    selTk.className = 'edt-select' + tkClass;
    [['', 'Belirsiz'], ['EVET', 'EVET'], ['HAYIR', 'HAYIR']].forEach(function(pair) {
      var o = document.createElement('option');
      o.value = pair[0]; o.textContent = pair[1];
      if ((pair[0] === 'EVET' && tk === true) ||
          (pair[0] === 'HAYIR' && tk === false) ||
          (pair[0] === '' && tk === null)) o.selected = true;
      selTk.appendChild(o);
    });
    selTk.addEventListener('change', function() {
      var tkClass = selTk.value === 'EVET' ? ' tk-evet' : selTk.value === 'HAYIR' ? ' tk-hayir' : '';
      selTk.className = 'edt-select' + tkClass;
      editHucreGuncelle(rowIdx, 'testKaynakli', selTk.value);
    });
    tdTk.appendChild(selTk); tr.appendChild(tdTk);

    tbody.appendChild(tr);
  });

  // Pagination
  var pg = document.getElementById('editsPagination');
  if (!pg) return;
  pg.innerHTML = '';
  if (pageCount <= 1) return;

  var prevBtn = document.createElement('button');
  prevBtn.className = 'edt-pg-btn'; prevBtn.textContent = '‹ Önceki';
  prevBtn.disabled = editsPage === 0;
  prevBtn.addEventListener('click', function(){ editsPage--; editsPanelGuncelle(); });
  pg.appendChild(prevBtn);

  for (var p = 0; p < pageCount; p++) {
    (function(pi) {
      var btn = document.createElement('button');
      btn.className = 'edt-pg-btn' + (pi === editsPage ? ' active' : '');
      btn.textContent = pi + 1;
      btn.addEventListener('click', function(){ editsPage = pi; editsPanelGuncelle(); });
      pg.appendChild(btn);
    })(p);
  }

  var nextBtn = document.createElement('button');
  nextBtn.className = 'edt-pg-btn'; nextBtn.textContent = 'Sonraki ›';
  nextBtn.disabled = editsPage >= pageCount - 1;
  nextBtn.addEventListener('click', function(){ editsPage++; editsPanelGuncelle(); });
  pg.appendChild(nextBtn);

  var info = document.createElement('span');
  info.className = 'edt-pg-info';
  info.textContent = (editsPage + 1) + ' / ' + pageCount + ' sayfa';
  pg.appendChild(info);

  editsBadgeGuncelle();
}

// ─── SATIR DETAY MODAL ───────────────────────────────────────────────────────
function satirDetayGoster(rowIdx) {
  var row = allRows[rowIdx];
  if (!row) return;
  var modal = document.getElementById('rowDetailModal');
  var title = document.getElementById('rdmTitle');
  var body  = document.getElementById('rdmBody');
  if (!modal || !body) return;

  var excelRow = (row._sheetRowIdx !== undefined) ? ' · Satır ' + (row._sheetRowIdx + 2) : '';
  title.textContent = [row._sayfa, row.tip, row.ay].filter(Boolean).join(' · ') + excelRow;

  // Ham veri tablosu
  var html = '<p class="rdm-section">Ham Veri</p><table class="rdm-table">';
  var raw = row._raw || {};
  Object.keys(raw).forEach(function(k) {
    if (k.charAt(0) === '_') return;
    var v = raw[k];
    if (v === null || v === undefined || v === '') return;
    html += '<tr><td>' + escHtml(String(k)) + '</td><td>' + escHtml(String(v)) + '</td></tr>';
  });
  html += '</table>';

  // Inline düzenleme formu
  var e = row._edits || {};
  var tk = efektifTest(row);
  var tkClass = tk === true ? ' tk-evet' : tk === false ? ' tk-hayir' : '';
  html += '<p class="rdm-section">Düzenle</p><div class="rdm-edit-form">';

  // Test Kaynaklı
  html += '<div class="rdm-field"><label>Test Kaynaklı</label>';
  html += '<select class="edt-select' + tkClass + '" id="rdmSelTk">';
  [['', 'Belirsiz'], ['EVET', 'EVET'], ['HAYIR', 'HAYIR']].forEach(function(p) {
    var sel = (p[0] === 'EVET' && tk === true) || (p[0] === 'HAYIR' && tk === false) || (p[0] === '' && tk === null) ? ' selected' : '';
    html += '<option value="' + p[0] + '"' + sel + '>' + p[1] + '</option>';
  });
  html += '</select></div>';

  // Kök Neden
  html += '<div class="rdm-field"><label>Kök Neden</label>';
  html += '<select class="edt-select' + (e.kokNeden ? ' filled' : '') + '" id="rdmSelKok">';
  KOK_NEDEN_OPTIONS.forEach(function(opt) {
    var sel = e.kokNeden === opt ? ' selected' : '';
    html += '<option value="' + escHtml(opt) + '"' + sel + '>' + escHtml(opt || '— Seçiniz —') + '</option>';
  });
  html += '</select></div>';

  // Alınacak Aksiyon
  html += '<div class="rdm-field"><label>Alınacak Aksiyon</label>';
  html += '<input type="text" class="edt-input' + (e.alınacakAksiyon ? ' filled' : '') + '" id="rdmInpAks" value="' + escHtml(e.alınacakAksiyon || '') + '" placeholder="Aksiyon girin…"></div>';

  // Çözüm Ekibi
  html += '<div class="rdm-field"><label>Çözüm Ekibi</label>';
  html += '<input type="text" class="edt-input' + (e.cozumEkibi ? ' filled' : '') + '" id="rdmInpEkip" value="' + escHtml(e.cozumEkibi || '') + '" placeholder="Ekip adı…"></div>';

  html += '</div>';
  body.innerHTML = html;

  // Event listener'lar (innerHTML sonrası DOM'da var)
  var selTk = document.getElementById('rdmSelTk');
  selTk.addEventListener('change', function() {
    var cls = selTk.value === 'EVET' ? ' tk-evet' : selTk.value === 'HAYIR' ? ' tk-hayir' : '';
    selTk.className = 'edt-select' + cls;
    editHucreGuncelle(rowIdx, 'testKaynakli', selTk.value);
    editsPanelGuncelle();
  });

  var selKok = document.getElementById('rdmSelKok');
  selKok.addEventListener('change', function() {
    selKok.className = 'edt-select' + (selKok.value ? ' filled' : '');
    editHucreGuncelle(rowIdx, 'kokNeden', selKok.value);
    editsPanelGuncelle();
  });

  var inpAks = document.getElementById('rdmInpAks');
  inpAks.addEventListener('change', function() {
    inpAks.className = 'edt-input' + (inpAks.value ? ' filled' : '');
    editHucreGuncelle(rowIdx, 'alınacakAksiyon', inpAks.value.trim());
    editsPanelGuncelle();
  });

  var inpEkip = document.getElementById('rdmInpEkip');
  inpEkip.addEventListener('change', function() {
    inpEkip.className = 'edt-input' + (inpEkip.value ? ' filled' : '');
    editHucreGuncelle(rowIdx, 'cozumEkibi', inpEkip.value.trim());
    editsPanelGuncelle();
  });

  modal.style.display = 'flex';
}

function satirDetayGizle() {
  var modal = document.getElementById('rowDetailModal');
  if (modal) modal.style.display = 'none';
}

// ─── TOPLU DÜZENLEME ─────────────────────────────────────────────────────────
function bulkBarGuncelle() {
  var bar = document.getElementById('bulkBar');
  var info = document.getElementById('bulkInfo');
  if (!bar) return;
  if (selectedRows.size === 0) {
    bar.style.display = 'none';
    var chkAll = document.getElementById('chkAll');
    if (chkAll) chkAll.checked = false;
  } else {
    bar.style.display = 'flex';
    if (info) info.textContent = selectedRows.size + ' satır seçili';
  }
}

function bulkUygula() {
  var tk   = document.getElementById('bulkSelTk').value;
  var kok  = document.getElementById('bulkSelKok').value;
  var ekip = document.getElementById('bulkInpEkip').value.trim();
  if (!tk && !kok && !ekip) { toast('En az bir alan doldurun', 'warn'); return; }
  selectedRows.forEach(function(rowIdx) {
    if (tk)   editHucreGuncelle(rowIdx, 'testKaynakli', tk);
    if (kok)  editHucreGuncelle(rowIdx, 'kokNeden', kok);
    if (ekip) editHucreGuncelle(rowIdx, 'cozumEkibi', ekip);
  });
  toast(selectedRows.size + ' satıra uygulandı', 'ok');
  selectedRows.clear();
  bulkBarGuncelle();
  editsPanelGuncelle();
}

function editsPanelGoster() {
  editsOnlyMissing = true;
  editsPage = 0;
  selectedRows.clear();
  editsExtraFilter = {};
  var cb = document.getElementById('edtsOnlyMissing');
  if (cb) cb.checked = true;
  editsFiltrelerKur();
  editsBadgeGuncelle();
}


function resolveColumns(cols) {
  colMap.tip  = findCol(cols, ['TIP', 'TYPE', 'ISSUETYPE', 'ISSUE TYPE']);
  colMap.ay   = findCol(cols, ['AY', 'MONTH', 'AYLAR']);
  colMap.test = findCol(cols, ['TEST KAYNAKLI', 'TEST', 'CAUSED BY TEST', 'KAYNAK']);
  return colMap.tip && colMap.ay && colMap.test;
}

// ─── OLAYLAR ────────────────────────────────────────────────────────────────
var dz = document.getElementById('dropZone');
dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', function(){ dz.classList.remove('drag'); });
dz.addEventListener('drop', function(e){
  e.preventDefault(); dz.classList.remove('drag');
  if (e.dataTransfer.files[0]) yukle(e.dataTransfer.files[0]);
});
document.getElementById('fileInput').addEventListener('change', function(e){
  if (e.target.files[0]) yukle(e.target.files[0]);
});
document.getElementById('btnReset').addEventListener('click', sifirla);
document.getElementById('btnClear').addEventListener('click', filtreTemizle);
document.getElementById('btnAnalyze').addEventListener('click', analiz);
document.getElementById('btnWarnClear').addEventListener('click', function(){
  filtreTemizle();
  document.getElementById('noMatch').classList.remove('show');
});
document.getElementById('btnApplyMap').addEventListener('click', sutunHaritasiUygula);
document.getElementById('btnExport').addEventListener('click', function(e){
  e.stopPropagation();
  document.getElementById('expDrop').classList.toggle('open');
});
document.addEventListener('click', function(){ document.getElementById('expDrop').classList.remove('open'); });
document.getElementById('expDrop').addEventListener('click', function(e){ e.stopPropagation(); });
document.getElementById('expXlsx').addEventListener('click', exportExcel);
document.getElementById('expCsv').addEventListener('click', exportCsv);
document.getElementById('expSave').addEventListener('click', saveCurrentEdits);
document.getElementById('expUpdated').addEventListener('click', downloadUpdatedExcel);
document.getElementById('expPrint').addEventListener('click', function(){
  document.getElementById('expDrop').classList.remove('open');
  window.print();
});
document.querySelectorAll('.copt').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.copt').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
    trendTip = b.dataset.tip;
    filtreKaydet();
    trendCiz();
  });
});
document.getElementById('edtsToggle').addEventListener('click', function(){
  var body = document.getElementById('edtsBody');
  var btn  = document.getElementById('edtsToggle');
  body.classList.toggle('collapsed');
  btn.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
  btn.setAttribute('aria-expanded', !body.classList.contains('collapsed'));
});
document.getElementById('edtsOnlyMissing').addEventListener('change', function(){
  editsOnlyMissing = this.checked;
  editsPage = 0;
  editsPanelGuncelle();
});
document.getElementById('edtsSaveBtn').addEventListener('click', saveCurrentEdits);
document.getElementById('edtsDownloadBtn').addEventListener('click', downloadUpdatedExcel);
document.getElementById('tabBtnDashboard').addEventListener('click', function(){ tabGoster('dashboard'); });
document.getElementById('tabBtnEdits').addEventListener('click', function(){ tabGoster('edits'); });

// Toplu düzenleme — bulk bar
(function() {
  var sel = document.getElementById('bulkSelKok');
  KOK_NEDEN_OPTIONS.forEach(function(opt) {
    if (!opt) return;
    var o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o);
  });
})();
document.getElementById('chkAll').addEventListener('change', function() {
  var visible = editsGorunurSatirlar();
  var start = editsPage * EDITS_PAGE_SIZE;
  var slice = visible.slice(start, start + EDITS_PAGE_SIZE);
  slice.forEach(function(row) {
    var idx = allRows.indexOf(row);
    if (this.checked) selectedRows.add(idx); else selectedRows.delete(idx);
  }.bind(this));
  bulkBarGuncelle();
  editsPanelGuncelle();
});
document.getElementById('bulkUygula').addEventListener('click', bulkUygula);
document.getElementById('bulkIptal').addEventListener('click', function() {
  selectedRows.clear(); bulkBarGuncelle(); editsPanelGuncelle();
});
document.getElementById('rowDetailModal').addEventListener('click', function(e){
  if (e.target === this) satirDetayGizle();
});
document.getElementById('rdmClose').addEventListener('click', satirDetayGizle);
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') satirDetayGizle(); });

// Enter tuşu ile bir sonraki satıra geç (edit paneli)
document.getElementById('edtsBody').addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var el = e.target;
  if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return;
  e.preventDefault();
  var tr = el.closest('tr');
  if (!tr) return;
  var nextTr = tr.nextElementSibling;
  if (!nextTr) return;
  var sameColIndex = Array.from(tr.cells).indexOf(el.closest('td'));
  var nextTd = nextTr.cells[sameColIndex];
  if (!nextTd) return;
  var nextEl = nextTd.querySelector('input, select');
  if (nextEl) nextEl.focus();
});

// ─── DOSYA YÜKLEME ──────────────────────────────────────────────────────────
var ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];

function dosyaHatasi(msg) {
  document.getElementById('loadingState').classList.remove('show');
  document.getElementById('dropZone').style.display = '';
  toast(msg, 'err');
}

function yukleHataMsg(err) {
  var m = (err && err.message) ? err.message.toLowerCase() : '';
  if (m.indexOf('password') !== -1 || m.indexOf('encrypted') !== -1)
    return 'Dosya şifre korumalı — şifresiz bir kopya yükleyin';
  if (m.indexOf('zip') !== -1 || m.indexOf('cfb') !== -1 || m.indexOf('signature') !== -1)
    return 'Dosya bozuk veya desteklenmiyor — geçerli bir .xlsx / .xls / .csv seçin';
  return 'Dosya okunamadı — geçerli bir Excel veya CSV dosyası seçin';
}

function yukle(file) {
  // Uzantı kontrolü — sürükle-bırak accept attribute'u atladığından burada yapılır
  var ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ALLOWED_EXT.indexOf(ext) === -1) {
    toast('"' + file.name + '" desteklenmiyor — yalnızca .xlsx, .xls veya .csv yükleyin', 'err');
    return;
  }

  // Mevcut düzenlemeler varsa yeni dosya yüklenmeden önce kullanıcıyı uyar
  if (editsVarMi()) {
    if (!confirm('Kaydedilmemiş düzenlemeler var — dışa aktarmadan devam etmek istediğinizden emin misiniz?')) {
      return;
    }
  }

  // Yükleme göstergesini aç
  document.getElementById('dropZone').style.display = 'none';
  document.getElementById('loadingMsg').textContent = 'Dosya okunuyor…';
  document.getElementById('loadingState').classList.add('show');

  var reader = new FileReader();
  reader.onload = function(e) {
    // setTimeout(0): UI'nin yükleme göstergesini render etmesi için bir tick bekle
    setTimeout(function() {
      try {
        document.getElementById('loadingMsg').textContent = 'Veriler işleniyor…';
        var wb = XLSX.read(e.target.result, {type: 'array'});
        dataSheets = wb.SheetNames.filter(function(n){
          return SKIP_SHEETS.indexOf(n) === -1;
        });
        if (!dataSheets.length) {
          dosyaHatasi('Geçerli veri sayfası bulunamadı — dosyayı kontrol edin');
          return;
        }

        // Ham satırları oku
        var rawRows = [];
        var firstSheetCols = null;
        dataSheets.forEach(function(sheetName) {
          var ws = wb.Sheets[sheetName];
          var raw = XLSX.utils.sheet_to_json(ws, {defval: ''});
          if (!firstSheetCols && raw.length) {
            firstSheetCols = Object.keys(raw[0]).map(function(k){
              return k.replace(/\n/g, ' ').trim();
            });
          }
          raw.forEach(function(row, rowIdx) {
            var norm = {};
            Object.keys(row).forEach(function(k) {
              var nk = k.replace(/\n/g, ' ').trim();
              norm[nk] = String(row[k]).trim();
            });
            norm._sayfa = sheetName;
            norm._sheetRowIdx = rowIdx;  // 0-tabanlı, başlık satırı hariç
            rawRows.push(norm);
          });
        });

        allCols = collectRawColumns(rawRows, firstSheetCols || []);

        // Sütunları çöz — önce otomatik, sonra kaydedilmiş, yoksa manuel UI
        var ok = resolveColumns(allCols);
        if (!ok) {
          var saved = colMapYukle();
          if (saved && allCols.indexOf(saved.tip) !== -1 &&
              allCols.indexOf(saved.ay) !== -1 &&
              allCols.indexOf(saved.test) !== -1) {
            colMap.tip = saved.tip; colMap.ay = saved.ay; colMap.test = saved.test;
            ok = true;
            toast('Sütun eşleştirmesi hafızadan yüklendi', 'ok');
          }
        }

        document.getElementById('loadingState').classList.remove('show');

        if (!ok) {
          // Manuel eşleştirme göster
          sutunHaritasiGoster(allCols);
          // Geçici olarak ham satırları sakla
          window._pendingRawRows = rawRows;
          document.getElementById('fileName').textContent = file.name;
          document.getElementById('fileMeta').textContent = dataSheets.length + ' sayfa';
          document.getElementById('fileBar').classList.add('show');
          return;
        }

        satırlariIsle(rawRows);

        if (allRows.length === 0) {
          dosyaHatasi('Dosyada işlenebilir kayıt bulunamadı — boş veya yalnızca başlık satırı var');
          return;
        }

        // Dosyayı kaydet ve önceki düzenlemeleri geri yükle
        currentFile = file;
        currentWb   = wb;
        var restored = editsYukle();
        if (restored > 0) toast(restored + ' düzenleme geri yüklendi', 'ok');

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileMeta').textContent = dataSheets.length + ' sayfa, ' + allRows.length + ' kayit';
        document.getElementById('fileBar').classList.add('show');
        document.getElementById('btnExport').disabled = false;
        var tabBar = document.getElementById('tabBar');
        if (tabBar) { tabBar.style.display = ''; tabGoster('dashboard'); }
        filtreUIKur();
        matchCountGuncelle();
        toast(allRows.length + ' kayıt yüklendi', 'ok');
      } catch (err) {
        console.error(err);
        dosyaHatasi(yukleHataMsg(err));
      }
    }, 0);
  };
  reader.readAsArrayBuffer(file);
}

function satırlariIsle(rawRows) {
  allRows = [];
  rawRows.forEach(function(row) {
    var tip  = row[colMap.tip]  || '';
    var ay   = row[colMap.ay]   || '';
    var test = row[colMap.test] || '';
    tip = tip.toUpperCase().trim();
    ay  = ay.toUpperCase().trim();
    if (!tip) tip = '(Belirsiz)';
    if (!ay)  ay  = '(Belirsiz)';
    // Test kaynaklı mı? Boş değer null (Belirsiz) olarak işaretlenir — istatistikleri etkilemez
    var testNorm = normStr(test);
    var testKaynakli;
    if (testNorm === 'EVET' || testNorm === 'E' ||
        testNorm === 'YES'  || testNorm === 'TRUE' || testNorm === '1') {
      testKaynakli = true;
    } else if (!testNorm) {
      testKaynakli = null;
    } else {
      testKaynakli = false;
    }
    allRows.push({
      _sayfa: row._sayfa,
      _sheetRowIdx: row._sheetRowIdx,
      tip: tip,
      ay: ay,
      testKaynakli: testKaynakli,
      _raw: row
    });
  });
}

// ─── SÜTUN HARITALAMA ────────────────────────────────────────────────────────
function sutunHaritasiGoster(cols) {
  var grid = document.getElementById('colMapGrid');
  grid.innerHTML = '';
  var fields = [
    {key: 'tip',  label: 'TİP sütunu',  hint: 'PR/KR/Hotfix değerleri olan sütun'},
    {key: 'ay',   label: 'AY sütunu',   hint: 'OCAK/ŞUBAT gibi ay değerleri'},
    {key: 'test', label: 'TEST KAYNAKLI', hint: 'EVET/HAYIR değerleri olan sütun'}
  ];
  fields.forEach(function(f) {
    var row = document.createElement('div');
    row.className = 'col-map-row';
    var lbl = document.createElement('label');
    lbl.textContent = f.label;
    lbl.title = f.hint;
    var sel = document.createElement('select');
    sel.id = 'colmap_' + f.key;
    sel.innerHTML = '<option value="">-- Secin --</option>';
    cols.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      // Otomatik tahmin: önce mevcut colMap, yoksa kaydedilmiş
      var saved = colMapYukle();
      if (colMap[f.key] === c || (saved && saved[f.key] === c)) opt.selected = true;
      sel.appendChild(opt);
    });
    row.appendChild(lbl);
    row.appendChild(sel);
    grid.appendChild(row);
  });
  document.getElementById('colWarn').classList.add('show');
}

function sutunHaritasiUygula() {
  colMap.tip  = document.getElementById('colmap_tip').value;
  colMap.ay   = document.getElementById('colmap_ay').value;
  colMap.test = document.getElementById('colmap_test').value;
  if (!colMap.tip || !colMap.ay || !colMap.test) {
    toast('Lütfen tüm sütunları seçin', 'warn'); return;
  }
  colMapKaydet();
  document.getElementById('colWarn').classList.remove('show');
  satırlariIsle(window._pendingRawRows || []);
  document.getElementById('fileMeta').textContent = dataSheets.length + ' sayfa, ' + allRows.length + ' kayit';
  document.getElementById('btnExport').disabled = false;
  filtreUIKur();
  matchCountGuncelle();
  toast(allRows.length + ' kayıt işlendi', 'ok');
}

// ─── FİLTRE UI KURULUMU ──────────────────────────────────────────────────────
function filtreUIKur() {
  selAy = new Set(); selSayfa = new Set(); selTip = new Set(); extraFilters = {};

  // Kaydedilmiş filtre durumunu yükle
  var savedFiltre = filtreYukle();
  if (savedFiltre) {
    var validAy    = new Set(tumDegerler('ay',     allRows));
    var validSayfa = new Set(dataSheets);
    var validTip   = new Set(tumDegerler('tip',    allRows));
    if (savedFiltre.ay)    savedFiltre.ay.forEach(function(v)    { if (validAy.has(v))    selAy.add(v); });
    if (savedFiltre.sayfa) savedFiltre.sayfa.forEach(function(v) { if (validSayfa.has(v)) selSayfa.add(v); });
    if (savedFiltre.tip)   savedFiltre.tip.forEach(function(v)   { if (validTip.has(v))   selTip.add(v); });
    if (savedFiltre.extra) {
      Object.keys(savedFiltre.extra).forEach(function(col) { extraFilters[col] = savedFiltre.extra[col]; });
    }
    if (savedFiltre.trendTip) {
      trendTip = savedFiltre.trendTip;
      document.querySelectorAll('.copt').forEach(function(b) {
        b.classList.toggle('on', b.dataset.tip === trendTip);
      });
    }
  }

  // AY chipleri
  var aylar = tumDegerler('ay', allRows).sort(function(a, b) {
    var ai = AY_ORDER.indexOf(normStr(a));
    var bi = AY_ORDER.indexOf(normStr(b));
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1; if (bi >= 0) return 1;
    return a.localeCompare(b, 'tr');
  });
  chipGrubuKur('ayChips', aylar, selAy, 'ay', true);

  // SAYFA chipleri
  chipGrubuKur('sayfaChips', dataSheets, selSayfa, 'sayfa', true);

  // TİP chipleri
  var tipler = tumDegerler('tip', allRows);
  var tipSirali = TIP_ORDER.filter(function(t){ return tipler.indexOf(t) !== -1; })
    .concat(tipler.filter(function(t){ return TIP_ORDER.indexOf(t) === -1; }).sort());
  chipGrubuKur('tipChips', tipSirali, selTip, 'tip', true);

  // Ek filtreler (MÜDÜRLÜK, SORUMLU QA vb.)
  var skipKeys = [colMap.tip, colMap.ay, colMap.test, '_sayfa', '_raw'];
  var ekKollar = allCols.filter(function(c) {
    return skipKeys.indexOf(c) === -1 && c.indexOf('KAYIT') === -1 && c.indexOf('AKSIYON') === -1;
  });
  var ekDiv = document.getElementById('extraFilters');
  ekDiv.innerHTML = '';
  if (ekKollar.length) {
    ekKollar.forEach(function(col) {
      var vals = tumDegerler('_raw.' + col, allRows);
      if (vals.length < 2 || vals.length > 60) return;
      var item = document.createElement('div');
      item.className = 'ef-item';
      var lbl = document.createElement('div');
      lbl.className = 'ef-label';
      lbl.textContent = col;
      var sel = document.createElement('select');
      sel.className = 'ef-select';
      sel.dataset.col = col;
      sel.innerHTML = '<option value="">Tümü</option>';
      vals.sort().forEach(function(v) {
        if (!v) return;
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        sel.appendChild(o);
      });
      // Kaydedilmiş değeri geri yükle
      if (extraFilters[col]) {
        sel.value = extraFilters[col];
        sel.classList.add('active');
      }
      sel.addEventListener('change', function() {
        if (sel.value) {
          extraFilters[col] = sel.value;
          sel.classList.add('active');
        } else {
          delete extraFilters[col];
          sel.classList.remove('active');
        }
        matchCountGuncelle();
        etiketleriGuncelle();
      });
      item.appendChild(lbl);
      item.appendChild(sel);
      ekDiv.appendChild(item);
    });
  }

  document.getElementById('filterPanel').classList.add('show');
  filteredRows = allRows.slice();
  matchCountGuncelle();
  etiketleriGuncelle();
}

function chipGrubuKur(containerId, values, selSet, type, withAll) {
  var wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  if (withAll) {
    var allBtn = document.createElement('button');
    allBtn.className = 'chip all-on';
    allBtn.textContent = 'Tümü';
    allBtn.dataset.type = type;
    allBtn.dataset.val = '__ALL__';
    allBtn.addEventListener('click', function() {
      selSet.clear();
      chipStateGuncelle(containerId, selSet);
      matchCountGuncelle();
      etiketleriGuncelle();
    });
    wrap.appendChild(allBtn);
  }
  values.forEach(function(v) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.textContent = type === 'ay' ? ayGoster(v) : (v.length > 22 ? v.slice(0,20)+'...' : v);
    b.title = v;
    b.dataset.val = v;
    b.dataset.type = type;
    b.addEventListener('click', function() {
      if (selSet.has(v)) selSet.delete(v);
      else selSet.add(v);
      chipStateGuncelle(containerId, selSet);
      matchCountGuncelle();
      etiketleriGuncelle();
    });
    wrap.appendChild(b);
  });
  chipStateGuncelle(containerId, selSet);
}

function chipStateGuncelle(containerId, selSet) {
  var wrap = document.getElementById(containerId);
  var allBtn = wrap.querySelector('[data-val="__ALL__"]');
  var chips = wrap.querySelectorAll('[data-val]:not([data-val="__ALL__"])');
  chips.forEach(function(b) {
    b.classList.toggle('on', selSet.has(b.dataset.val));
    b.classList.remove('all-on');
  });
  if (allBtn) {
    allBtn.classList.toggle('all-on', selSet.size === 0);
    allBtn.classList.remove('on');
  }
}

// ─── FİLTRELEME ──────────────────────────────────────────────────────────────
function filtrele() {
  return allRows.filter(function(r) {
    if (selAy.size    > 0 && !selAy.has(r.ay))       return false;
    if (selSayfa.size > 0 && !selSayfa.has(r._sayfa)) return false;
    if (selTip.size   > 0 && !selTip.has(r.tip))      return false;
    var keys = Object.keys(extraFilters);
    for (var i = 0; i < keys.length; i++) {
      var col = keys[i];
      var raw = r._raw || {};
      if ((raw[col] || '') !== extraFilters[col]) return false;
    }
    return true;
  });
}

function matchCountGuncelle() {
  filteredRows = filtrele();
  var n = filteredRows.length;
  var tot = allRows.length;
  var el = document.getElementById('matchCount');
  if (n === 0) {
    el.innerHTML = '<strong class="zero">0</strong> eşleşen kayıt — filtreleri genişletin';
  } else if (selAy.size === 0 && selSayfa.size === 0 && selTip.size === 0 && Object.keys(extraFilters).length === 0) {
    el.innerHTML = '<strong>' + tot + '</strong> kayıt (filtre uygulanmadı)';
  } else {
    el.innerHTML = '<strong>' + n + '</strong> / ' + tot + ' kayıt eşleşiyor';
  }
  filtreKaydet();
}

function filtreTemizle() {
  selAy.clear(); selSayfa.clear(); selTip.clear(); extraFilters = {};
  try { localStorage.removeItem(LS_FILTER_KEY); } catch(e) {}
  ['ayChips','sayfaChips','tipChips'].forEach(function(id) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    var type = wrap.querySelector('[data-type]');
    var t = type ? type.dataset.type : '';
    var set = t === 'ay' ? selAy : t === 'sayfa' ? selSayfa : selTip;
    chipStateGuncelle(id, set);
  });
  document.querySelectorAll('.ef-select').forEach(function(s) {
    s.value = ''; s.classList.remove('active');
  });
  matchCountGuncelle();
  etiketleriGuncelle();
}

function etiketleriGuncelle() {
  var container = document.getElementById('activeTags');
  container.innerHTML = '';
  var count = selAy.size + selSayfa.size + selTip.size + Object.keys(extraFilters).length;
  if (count === 0) {
    container.innerHTML = '<span class="no-filter-text">Filtre uygulanmadı — tüm kayıtlar görünüyor</span>';
    document.getElementById('fpCount').textContent = 'Filtre seçilmedi';
    return;
  }
  document.getElementById('fpCount').textContent = count + ' filtre aktif';
  function ekleTag(label, val, kaldirFn) {
    var tag = document.createElement('span');
    tag.className = 'atag';
    var lbl = document.createElement('span'); lbl.textContent = label + ':';
    var v = document.createTextNode(' ' + val);
    var x = document.createElement('button'); x.textContent = 'x';
    x.addEventListener('click', kaldirFn);
    tag.appendChild(lbl); tag.appendChild(v); tag.appendChild(x);
    container.appendChild(tag);
  }
  selAy.forEach(function(v) {
    ekleTag('Ay', ayGoster(v), function(){
      selAy.delete(v); chipStateGuncelle('ayChips', selAy);
      matchCountGuncelle(); etiketleriGuncelle();
    });
  });
  selSayfa.forEach(function(v) {
    ekleTag('Sayfa', v.length > 20 ? v.slice(0,18)+'...' : v, function(){
      selSayfa.delete(v); chipStateGuncelle('sayfaChips', selSayfa);
      matchCountGuncelle(); etiketleriGuncelle();
    });
  });
  selTip.forEach(function(v) {
    ekleTag('Tip', v, function(){
      selTip.delete(v); chipStateGuncelle('tipChips', selTip);
      matchCountGuncelle(); etiketleriGuncelle();
    });
  });
  Object.keys(extraFilters).forEach(function(col) {
    var val = extraFilters[col];
    ekleTag(col, val, function(){
      delete extraFilters[col];
      document.querySelectorAll('.ef-select[data-col="'+col+'"]').forEach(function(s){
        s.value = ''; s.classList.remove('active');
      });
      matchCountGuncelle(); etiketleriGuncelle();
    });
  });
}

// ─── ANALİZ ──────────────────────────────────────────────────────────────────
function analiz() {
  filteredRows = filtrele();
  var noMatch = document.getElementById('noMatch');
  if (filteredRows.length === 0) {
    noMatch.classList.add('show');
    document.getElementById('noMatchMsg').textContent = 'Seçili filtreler hiçbir kayıtla eşleşmedi.';
    document.getElementById('kpiRow').style.display = 'none';
    document.getElementById('mainCard').style.display = 'none';
    document.getElementById('chartCard').style.display = 'none';
    document.getElementById('sayfaDetayWrap').style.display = 'none';
    toast('Eşleşen kayıt yok', 'warn'); return;
  }
  noMatch.classList.remove('show');
  kpiGuncelle(filteredRows);
  anaTabloGuncelle(filteredRows);
  trendCiz();
  sayfaDetayGuncelle(filteredRows);
  document.getElementById('btnExport').disabled = false;
  editsPanelGoster();
  toast(filteredRows.length + ' kayıt analiz edildi', 'ok');
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
function kpiGuncelle(rows) {
  var bel   = rows.filter(function(r){ return efektifTest(r) === null; }).length;
  var valid = rows.filter(function(r){ return efektifTest(r) !== null; });
  var evet  = valid.filter(function(r){ return efektifTest(r); }).length;
  var hayir = valid.length - evet;
  var oran  = valid.length ? ((evet / valid.length) * 100).toFixed(1) : '0';
  var etiket = filtreEtiketi();
  document.getElementById('kpiEvet').textContent = evet;
  document.getElementById('kpiHayir').textContent = hayir;
  document.getElementById('kpiBel').textContent = bel;
  document.getElementById('kpiToplam').textContent = rows.length;
  document.getElementById('kpiOran').textContent = '%' + oran;
  document.getElementById('kpiEvetSub').textContent = etiket;
  document.getElementById('kpiHayirSub').textContent = etiket;
  document.getElementById('kpiBelSub').textContent = etiket;
  document.getElementById('kpiToplamSub').textContent = etiket;
  document.getElementById('kpiRow').style.display = 'grid';
}

function filtreEtiketi() {
  var parts = [];
  if (selAy.size > 0) parts.push(Array.from(selAy).map(ayGoster).join(', '));
  if (selSayfa.size > 0) parts.push(selSayfa.size + ' sayfa');
  if (selTip.size > 0) parts.push(Array.from(selTip).join(', '));
  return parts.length ? parts.join(' | ') : 'Tüm kayıtlar';
}

// ─── ANA TABLO ───────────────────────────────────────────────────────────────
function anaTabloGuncelle(rows) {
  var tipler = mevcutTipler(rows);
  if (!tipler.length) { document.getElementById('mainCard').style.display = 'none'; return; }

  var matrix = {};
  tipler.forEach(function(t){ matrix[t] = {evet:0, hayir:0, bel:0}; });
  rows.forEach(function(r){
    if (!matrix[r.tip]) return;
    if (efektifTest(r) === null) matrix[r.tip].bel++;
    else if (efektifTest(r)) matrix[r.tip].evet++;
    else matrix[r.tip].hayir++;
  });

  var topEvet   = rows.filter(function(r){ return efektifTest(r) === true; }).length;
  var topHayir  = rows.filter(function(r){ return efektifTest(r) === false; }).length;
  var topBel    = rows.filter(function(r){ return efektifTest(r) === null; }).length;
  var topToplam = rows.length;
  var topValid  = topEvet + topHayir;

  document.getElementById('mainTitle').textContent = 'TİP Bazlı Özet';
  document.getElementById('mainSub').textContent = filtreEtiketi() + ' | ' + rows.length + ' kayit';
  document.getElementById('mainCard').style.display = 'block';

  document.getElementById('mainThead').innerHTML =
    '<tr>' +
    '<th>TIP</th>' +
    '<th class="r h-evet">Test Kaynaklı (EVET)</th>' +
    '<th class="c h-evet">%</th>' +
    '<th class="r h-hayir">Test Dışı (HAYIR)</th>' +
    '<th class="c h-hayir">%</th>' +
    '<th class="r" style="color:var(--text3)">Belirsiz</th>' +
    '<th class="r h-top">Toplam</th>' +
    '<th class="c h-top">Test Oranı</th>' +
    '<th class="r h-top">Dağılım</th>' +
    '</tr>';

  var tbody = document.getElementById('mainTbody');
  tbody.innerHTML = '';
  tipler.forEach(function(tip) {
    var d = matrix[tip];
    var valid = d.evet + d.hayir;
    var ep = valid ? ((d.evet/valid)*100).toFixed(1) : '0';
    var hp = valid ? ((d.hayir/valid)*100).toFixed(1) : '0';
    var to = valid ? ((d.evet/valid)*100).toFixed(1) : '0';
    var bw = topValid ? Math.round((valid/topValid)*100) : 0;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><strong>' + escHtml(tip) + '</strong></td>' +
      '<td class="r" style="color:' + (d.evet>0?'var(--red)':'var(--text3)') + ';font-weight:' + (d.evet>0?'700':'400') + '">' + d.evet + '</td>' +
      '<td class="c"><small style="color:var(--text3)">%' + ep + '</small></td>' +
      '<td class="r" style="color:' + (d.hayir>0?'var(--green)':'var(--text3)') + ';font-weight:' + (d.hayir>0?'700':'400') + '">' + d.hayir + '</td>' +
      '<td class="c"><small style="color:var(--text3)">%' + hp + '</small></td>' +
      '<td class="r" style="color:' + (d.bel>0?'var(--text2)':'var(--text3)') + ';font-weight:' + (d.bel>0?'700':'400') + '">' + (d.bel||'—') + '</td>' +
      '<td class="r" style="font-weight:700">' + (d.evet+d.hayir+d.bel) + '</td>' +
      '<td class="c"><span class="oran-badge" style="background:' + oranRenk(parseFloat(to)) + '">%' + to + '</span></td>' +
      '<td class="r"><div class="mini-bar"><div class="mbt"><div class="mbf" style="width:' + bw + '%"></div></div><span style="font-size:11px;color:var(--text3)">' + bw + '%</span></div></td>';
    tbody.appendChild(tr);
  });

  var to2 = topValid ? ((topEvet/topValid)*100).toFixed(1) : '0';
  var trTot = document.createElement('tr');
  trTot.className = 'trow-total';
  trTot.innerHTML =
    '<td>TOPLAM</td>' +
    '<td class="r" style="color:var(--red)">' + topEvet + '</td>' +
    '<td class="c"><small style="color:var(--text3)">%' + (topValid?((topEvet/topValid)*100).toFixed(1):0) + '</small></td>' +
    '<td class="r" style="color:var(--green)">' + topHayir + '</td>' +
    '<td class="c"><small style="color:var(--text3)">%' + (topValid?((topHayir/topValid)*100).toFixed(1):0) + '</small></td>' +
    '<td class="r" style="color:var(--text3)">' + topBel + '</td>' +
    '<td class="r">' + topToplam + '</td>' +
    '<td class="c"><span class="oran-badge" style="background:' + oranRenk(parseFloat(to2)) + '">%' + to2 + '</span></td>' +
    '<td></td>';
  tbody.appendChild(trTot);
}

function oranRenk(p) {
  if (p >= 30) return '#C00000';
  if (p >= 15) return '#c07000';
  return '#15692a';
}

// ─── TREND ────────────────────────────────────────────────────────────────────
function trendCiz() {
  var aylar = tumDegerler('ay', filteredRows.length ? filteredRows : allRows).sort(function(a,b){
    var ai = AY_ORDER.indexOf(normStr(a)), bi = AY_ORDER.indexOf(normStr(b));
    if (ai>=0&&bi>=0) return ai-bi; if (ai>=0) return -1; if (bi>=0) return 1;
    return a.localeCompare(b,'tr');
  });
  if (aylar.length < 2) { document.getElementById('chartCard').style.display = 'none'; return; }
  document.getElementById('chartCard').style.display = 'block';
  document.getElementById('chartSub').textContent = aylar.map(ayGoster).join(' | ');

  var src = filteredRows.length ? filteredRows : allRows;
  var evetData = [], hayirData = [], belData = [];
  aylar.forEach(function(ay) {
    var r = src.filter(function(row) {
      if (row.ay !== ay) return false;
      if (trendTip !== 'ALL' && row.tip !== trendTip) return false;
      return true;
    });
    evetData.push(r.filter(function(x){ return efektifTest(x) === true; }).length);
    hayirData.push(r.filter(function(x){ return efektifTest(x) === false; }).length);
    belData.push(r.filter(function(x){ return efektifTest(x) === null; }).length);
  });

  if (trendChart) { trendChart.destroy(); trendChart = null; }
  trendChart = new Chart(document.getElementById('trendCanvas'), {
    type: 'bar',
    data: {
      labels: aylar.map(ayGoster),
      datasets: [
        { label: 'Test Kaynaklı (EVET)', data: evetData,
          backgroundColor: 'rgba(192,0,0,0.75)', borderColor: '#C00000',
          borderWidth: 1, borderRadius: 3, stack: 'main' },
        { label: 'Test Dışı (HAYIR)', data: hayirData,
          backgroundColor: 'rgba(21,105,42,0.65)', borderColor: '#15692a',
          borderWidth: 1, borderRadius: 3, stack: 'main' },
        { label: 'Belirsiz', data: belData,
          backgroundColor: 'rgba(150,150,150,0.35)', borderColor: '#aaa',
          borderWidth: 1, borderRadius: 3, stack: 'main' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#444', font: { family: 'IBM Plex Sans', size: 11 }, padding: 16, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            footer: function(items) {
              var ai = items[0].dataIndex;
              var valid = evetData[ai] + hayirData[ai];
              var bel = belData[ai];
              return 'Toplam: ' + (valid + bel) +
                (valid > 0 ? '  (%' + ((evetData[ai]/valid)*100).toFixed(1) + ' test kaynaklı)' : '') +
                (bel > 0 ? '  [' + bel + ' belirsiz]' : '');
            }
          },
          backgroundColor: '#111', titleColor: '#fff', bodyColor: '#ddd',
          footerColor: '#ffaaaa', padding: 10,
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont:  { family: 'IBM Plex Mono', size: 11 }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#888', font: { family: 'IBM Plex Sans', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { stacked: true, beginAtZero: true, ticks: { color: '#888', font: { family: 'IBM Plex Sans', size: 11 }, stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } }
      }
    }
  });
}

// ─── SAYFA DETAY ──────────────────────────────────────────────────────────────
function sayfaDetayGuncelle(rows) {
  var sayfalar = selSayfa.size > 0 ? Array.from(selSayfa) : dataSheets;
  if (sayfalar.length <= 1) { document.getElementById('sayfaDetayWrap').style.display = 'none'; return; }
  document.getElementById('sayfaDetayWrap').style.display = 'block';
  var grid = document.getElementById('sayfaDetayGrid');
  grid.innerHTML = '';
  sayfalar.forEach(function(sayfa) {
    var sr = rows.filter(function(r){ return r._sayfa === sayfa; });
    if (!sr.length) return;
    var evet  = sr.filter(function(r){ return efektifTest(r) === true; }).length;
    var hayir = sr.filter(function(r){ return efektifTest(r) === false; }).length;
    var bel   = sr.filter(function(r){ return efektifTest(r) === null; }).length;
    var valid = evet + hayir;
    var oran  = valid ? ((evet/valid)*100).toFixed(1) : '0';
    var tipler = mevcutTipler(sr);
    var tipRows = tipler.map(function(t) {
      var te = sr.filter(function(r){ return r.tip===t&&efektifTest(r)===true; }).length;
      var th = sr.filter(function(r){ return r.tip===t&&efektifTest(r)===false; }).length;
      var tb = sr.filter(function(r){ return r.tip===t&&efektifTest(r)===null; }).length;
      return '<tr>' +
        '<td class="sdt-name">' + escHtml(t) + '</td>' +
        '<td class="sdt-num red">' + te + '</td>' +
        '<td class="sdt-num green">' + th + '</td>' +
        '<td class="sdt-num' + (tb>0?'':' muted') + '">' + (tb||'—') + '</td>' +
        '<td class="sdt-num">' + (te+th+tb) + '</td>' +
        '</tr>';
    }).join('');
    var card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML =
      '<div class="tc-hdr" style="padding:10px 14px">' +
        '<div><div style="font-size:12px;font-weight:700">' + escHtml(sayfa.length>28?sayfa.slice(0,26)+'...':sayfa) + '</div>' +
        '<div style="font-size:10px;color:var(--text3);margin-top:1px" title="'+escHtml(sayfa)+'">' + escHtml(sayfa) + '</div></div>' +
        '<div style="text-align:right">' +
          '<div style="font-family:var(--fm);font-size:20px;font-weight:700;color:var(--red)">' + sr.length + '</div>' +
          '<div style="font-size:10px;color:var(--text3)">%'+oran+' test kaynaklı' + (bel>0?' · '+bel+' belirsiz':'') + '</div>' +
        '</div>' +
      '</div>' +
      '<table class="sdt">' +
        '<thead><tr>' +
          '<th class="sdt-name">TIP</th>' +
          '<th class="sdt-evet">EVET</th>' +
          '<th class="sdt-hayir">HAYIR</th>' +
          '<th class="sdt-bel">BELİRSİZ</th>' +
          '<th class="sdt-top">TOPLAM</th>' +
        '</tr></thead>' +
        '<tbody>' + tipRows + '</tbody>' +
        '<tfoot><tr>' +
          '<td class="sdt-name red">TOPLAM</td>' +
          '<td class="sdt-num red">' + evet + '</td>' +
          '<td class="sdt-num green">' + hayir + '</td>' +
          '<td class="sdt-num muted">' + bel + '</td>' +
          '<td class="sdt-num">' + sr.length + '</td>' +
        '</tr></tfoot>' +
      '</table>';
    grid.appendChild(card);
  });
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────
function exportExcel() {
  var rows = filteredRows.length ? filteredRows : allRows;
  var wb2 = XLSX.utils.book_new();
  var tipler = mevcutTipler(rows);
  var ozet = [['TIP','Test Kaynaklı (EVET)','% (EVET)','Test Dışı (HAYIR)','% (HAYIR)','Belirsiz','Toplam','Test Oranı %']];
  tipler.forEach(function(t) {
    var te=rows.filter(function(r){return r.tip===t&&efektifTest(r)===true;}).length;
    var th=rows.filter(function(r){return r.tip===t&&efektifTest(r)===false;}).length;
    var tb=rows.filter(function(r){return r.tip===t&&efektifTest(r)===null;}).length;
    var valid=te+th;
    ozet.push([t, te, valid?+(te/valid*100).toFixed(1):0, th, valid?+(th/valid*100).toFixed(1):0, tb, te+th+tb, valid?+(te/valid*100).toFixed(1):0]);
  });
  var e=rows.filter(function(r){return efektifTest(r)===true;}).length;
  var h=rows.filter(function(r){return efektifTest(r)===false;}).length;
  var b=rows.filter(function(r){return efektifTest(r)===null;}).length;
  var valid=e+h;
  ozet.push(['TOPLAM',e,valid?+(e/valid*100).toFixed(1):0,h,valid?+(h/valid*100).toFixed(1):0,b,rows.length,valid?+(e/valid*100).toFixed(1):0]);
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(ozet), 'Özet');

  var aylar = tumDegerler('ay', rows).sort(function(a,b){
    var ai=AY_ORDER.indexOf(normStr(a)),bi=AY_ORDER.indexOf(normStr(b));
    if(ai>=0&&bi>=0)return ai-bi;if(ai>=0)return-1;if(bi>=0)return 1;return a.localeCompare(b,'tr');
  });
  var ayOzet = [['AY','Test Kaynaklı','Test Dışı','Belirsiz','Toplam','Test Oranı %']];
  aylar.forEach(function(ay) {
    var r=rows.filter(function(x){return x.ay===ay;});
    var ev=r.filter(function(x){return efektifTest(x)===true;}).length;
    var hy=r.filter(function(x){return efektifTest(x)===false;}).length;
    var bl=r.filter(function(x){return efektifTest(x)===null;}).length;
    var v=ev+hy;
    ayOzet.push([ay, ev, hy, bl, r.length, v?+(ev/v*100).toFixed(1):0]);
  });
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(ayOzet), 'Ay Bazlı');

  var ham = [['Sayfa','TIP','AY','Test Kaynaklı','Kök Neden','Alınacak Aksiyon','Çözüm Ekibi']].concat(
    rows.map(function(r){
      var e = r._edits || {};
      return [r._sayfa, r.tip, r.ay,
        efektifTest(r)===null?'BELİRSİZ':efektifTest(r)?'EVET':'HAYIR',
        e.kokNeden||'', e.alınacakAksiyon||'', e.cozumEkibi||''];
    })
  );
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(ham), 'Ham Veri');
  XLSX.writeFile(wb2, 'qa-issue-dashboard.xlsx');
  document.getElementById('expDrop').classList.remove('open');
  toast('Excel indirildi', 'ok');
}

// ─── PURE: AOA düzenleme uygulama (test edilebilir) ─────────────────────────
function applyEditsToAoa(aoa, sheetRows, testColName) {
  if (!aoa || !aoa.length) return aoa;
  var headerRow = aoa[0];
  var EDIT_COL_NAMES = ['Kök Neden', 'Alınacak Aksiyon', 'Çözüm Ekibi'];

  // Düzenleme sütunlarının index'lerini bul veya sona ekle
  var colIdx = {};
  EDIT_COL_NAMES.forEach(function(name) {
    var idx = -1;
    for (var i = 0; i < headerRow.length; i++) {
      if (String(headerRow[i]).replace(/\n/g, ' ').trim() === name) { idx = i; break; }
    }
    if (idx === -1) { idx = headerRow.length; headerRow.push(name); }
    colIdx[name] = idx;
  });

  // Test Kaynaklı sütununu normalize ederek bul — colMap.test trimlenmiş olabilir
  var testColIdx = -1;
  if (testColName) {
    for (var ti = 0; ti < headerRow.length; ti++) {
      if (String(headerRow[ti]).replace(/\n/g, ' ').trim() === testColName) {
        testColIdx = ti; break;
      }
    }
  }

  var maxIdx = 0;
  EDIT_COL_NAMES.forEach(function(n) { if (colIdx[n] > maxIdx) maxIdx = colIdx[n]; });

  sheetRows.forEach(function(row) {
    var edts = row._edits;
    if (!edts || Object.keys(edts).length === 0) return;
    var aoaIdx = row._sheetRowIdx + 1;  // +1 başlık satırı için
    if (!aoa[aoaIdx]) return;
    while (aoa[aoaIdx].length <= maxIdx) aoa[aoaIdx].push('');
    if (edts.kokNeden        !== undefined) aoa[aoaIdx][colIdx['Kök Neden']]        = edts.kokNeden;
    if (edts.alınacakAksiyon !== undefined) aoa[aoaIdx][colIdx['Alınacak Aksiyon']] = edts.alınacakAksiyon;
    if (edts.cozumEkibi      !== undefined) aoa[aoaIdx][colIdx['Çözüm Ekibi']]      = edts.cozumEkibi;
    if (edts.testKaynakli !== undefined && testColIdx !== -1) {
      aoa[aoaIdx][testColIdx] = edts.testKaynakli === true ? 'EVET' : 'HAYIR';
    }
  });
  return aoa;
}

function saveCurrentEdits() {
  if (!currentFile) { toast('Önce bir dosya yükleyin', 'warn'); return; }
  editsKaydet();
  document.getElementById('expDrop').classList.remove('open');
  toast('Değişiklikler kaydedildi', 'ok');
}

function exportUpdatedFilename(originalName) {
  var base = originalName.replace(/\.[^.]+$/, '');
  if (base === originalName) base = originalName;
  return base + ' - Guncellenmis.xlsx';
}

function wsNormHeader(v) {
  return String(v || '').replace(/\n/g, ' ').trim();
}

function wsGetRange(ws) {
  return XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
}

function wsSetRange(ws, range) {
  ws['!ref'] = XLSX.utils.encode_range(range);
}

function wsSetTextCell(ws, rowIdx, colIdx, value) {
  var ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  var prev = ws[ref] || {};
  ws[ref] = {
    t: 's',
    v: value,
    w: value
  };
  if (prev.s) ws[ref].s = prev.s;
  if (prev.z) ws[ref].z = prev.z;
}

function wsFindHeaderCol(ws, range, headerName) {
  for (var c = range.s.c; c <= range.e.c; c++) {
    var cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: c })];
    if (wsNormHeader(cell ? cell.v : '') === headerName) return c;
  }
  return -1;
}

function wsEnsureHeaderCol(ws, range, headerName) {
  var idx = wsFindHeaderCol(ws, range, headerName);
  if (idx !== -1) return idx;
  idx = range.e.c + 1;
  range.e.c = idx;
  wsSetRange(ws, range);
  wsSetTextCell(ws, range.s.r, idx, headerName);
  return idx;
}

function applyEditsToWorksheet(ws, sheetRows, testColName) {
  if (!ws || !sheetRows || !sheetRows.length) return ws;
  var range = wsGetRange(ws);
  var headerRowIdx = range.s.r;
  var testColIdx = testColName ? wsFindHeaderCol(ws, range, testColName) : -1;
  var editCols = {
    kokNeden: wsEnsureHeaderCol(ws, range, 'Kök Neden'),
    alınacakAksiyon: wsEnsureHeaderCol(ws, range, 'Alınacak Aksiyon'),
    cozumEkibi: wsEnsureHeaderCol(ws, range, 'Çözüm Ekibi')
  };
  wsSetRange(ws, range);

  sheetRows.forEach(function(row) {
    var edts = row._edits;
    if (!edts || Object.keys(edts).length === 0) return;
    var wsRowIdx = headerRowIdx + 1 + row._sheetRowIdx;
    if (wsRowIdx > range.e.r) return;
    if (edts.kokNeden !== undefined) {
      wsSetTextCell(ws, wsRowIdx, editCols.kokNeden, edts.kokNeden);
    }
    if (edts.alınacakAksiyon !== undefined) {
      wsSetTextCell(ws, wsRowIdx, editCols.alınacakAksiyon, edts.alınacakAksiyon);
    }
    if (edts.cozumEkibi !== undefined) {
      wsSetTextCell(ws, wsRowIdx, editCols.cozumEkibi, edts.cozumEkibi);
    }
    if (edts.testKaynakli !== undefined && testColIdx !== -1) {
      wsSetTextCell(ws, wsRowIdx, testColIdx, edts.testKaynakli === true ? 'EVET' : edts.testKaynakli === false ? 'HAYIR' : '');
    }
  });

  return ws;
}

function cloneWorkbookForDownload(wb) {
  var bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return XLSX.read(bytes, { type: 'array' });
}

function downloadUpdatedExcel() {
  if (!currentWb || !currentFile) { toast('Önce bir dosya yükleyin', 'warn'); return; }
  var wbForDownload = cloneWorkbookForDownload(currentWb);

  dataSheets.forEach(function(sheetName) {
    var ws = wbForDownload.Sheets[sheetName];
    if (!ws) return;
    var sheetRows = allRows.filter(function(r) { return r._sayfa === sheetName; });
    applyEditsToWorksheet(ws, sheetRows, colMap.test || null);
  });

  var filename = exportUpdatedFilename(currentFile.name);
  XLSX.writeFile(wbForDownload, filename);
  document.getElementById('expDrop').classList.remove('open');
  toast(filename + ' indirildi', 'ok');
}

function exportCsv() {
  var rows = filteredRows.length ? filteredRows : allRows;
  var lines = ['Sayfa,TİP,AY,Test Kaynaklı,Kök Neden,Alınacak Aksiyon,Çözüm Ekibi'].concat(
    rows.map(function(r){
      var e = r._edits || {};
      return [r._sayfa,r.tip,r.ay,
        efektifTest(r)===null?'BELİRSİZ':efektifTest(r)?'EVET':'HAYIR',
        e.kokNeden||'', e.alınacakAksiyon||'', e.cozumEkibi||''].map(csvVal).join(',');
    })
  );
  var blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='qa-issue-dashboard.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  document.getElementById('expDrop').classList.remove('open');
  toast('CSV indirildi', 'ok');
}

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
function sifirla() {
  allRows=[]; allCols=[]; dataSheets=[]; filteredRows=[];
  selAy=new Set(); selSayfa=new Set(); selTip=new Set(); extraFilters={};
  currentFile = null; currentWb = null; editsOnlyMissing = true; editsPage = 0; selectedRows.clear(); editsExtraFilter = {};
  var tabBar = document.getElementById('tabBar');
  if (tabBar) tabBar.style.display = 'none';
  tabGoster('dashboard');
  document.getElementById('loadingState').classList.remove('show');
  document.getElementById('dropZone').style.display='';
  document.getElementById('fileBar').classList.remove('show');
  document.getElementById('filterPanel').classList.remove('show');
  document.getElementById('colWarn').classList.remove('show');
  document.getElementById('kpiRow').style.display='none';
  document.getElementById('mainCard').style.display='none';
  document.getElementById('chartCard').style.display='none';
  document.getElementById('sayfaDetayWrap').style.display='none';
  document.getElementById('noMatch').classList.remove('show');
  document.getElementById('fileInput').value='';
  document.getElementById('btnExport').disabled=true;
  if(trendChart){trendChart.destroy();trendChart=null;}
}

function tumDegerler(field, rows) {
  var set = new Set();
  rows.forEach(function(r) {
    var v;
    if (field.indexOf('_raw.') === 0) {
      v = (r._raw || {})[field.slice(5)] || '';
    } else {
      v = r[field] || '';
    }
    if (v) set.add(v);
  });
  return Array.from(set);
}

function mevcutTipler(rows) {
  var set = new Set();
  rows.forEach(function(r){ if(r.tip) set.add(r.tip); });
  return TIP_ORDER.filter(function(t){ return set.has(t); })
    .concat(Array.from(set).filter(function(t){ return TIP_ORDER.indexOf(t)===-1; }).sort());
}

var AY_LABEL = {
  'OCAK':'Ocak','SUBAT':'Sub','\u015EUBAT':'\u015Eub','MART':'Mar',
  'NISAN':'Nis','N\u0130SAN':'Nis','MAYIS':'May','MAY\u0131S':'May',
  'HAZIRAN':'Haz','HAZ\u0130RAN':'Haz','TEMMUZ':'Tem',
  'AGUSTOS':'Agu','A\u011EUSTOS':'A\u011fu',
  'EYLUL':'Eyl','EYL\u00DCL':'Eyl',
  'EKIM':'Eki','EK\u0130M':'Eki','KASIM':'Kas','ARALIK':'Ara'
};

function ayGoster(ay) {
  return AY_LABEL[ay] || ay;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvVal(v) {
  var s = String(v);
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

var toastTimer = null;
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.className = 'toast ' + (type||'ok');
  document.getElementById('toastMsg').textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  var dur = (type === 'err') ? 7000 : 3000;
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, dur);
}
