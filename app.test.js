// ─── Pure logic extracted from app.js for unit testing ───────────────────────

// ─── applyEditsToAoa ─────────────────────────────────────────────────────────
function applyEditsToAoa(aoa, sheetRows, testColName) {
  if (!aoa || !aoa.length) return aoa;
  var headerRow = aoa[0];
  var EDIT_COL_NAMES = ['Kök Neden', 'Alınacak Aksiyon', 'Çözüm Ekibi'];
  var colIdx = {};
  EDIT_COL_NAMES.forEach(function(name) {
    var idx = -1;
    for (var i = 0; i < headerRow.length; i++) {
      if (String(headerRow[i]).replace(/\n/g, ' ').trim() === name) { idx = i; break; }
    }
    if (idx === -1) { idx = headerRow.length; headerRow.push(name); }
    colIdx[name] = idx;
  });
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
    var aoaIdx = row._sheetRowIdx + 1;
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

// ─── efektifTest ─────────────────────────────────────────────────────────────
function efektifTest(row) {
  var e = row._edits;
  if (e && e.testKaynakli !== undefined) return e.testKaynakli;
  return row.testKaynakli;
}

// ─── editsSatirEksikMi ───────────────────────────────────────────────────────
function editsSatirEksikMi(row) {
  var e = row._edits || {};
  if (efektifTest(row) === null) return true;
  if (!e.kokNeden)               return true;
  if (!e.alınacakAksiyon)       return true;
  if (!e.cozumEkibi)            return true;
  return false;
}

// ─── KOK_NEDEN_OPTIONS ───────────────────────────────────────────────────────
const KOK_NEDEN_OPTIONS = [
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

const TIP_ORDER = ['PR', 'KR', 'HOTFIX', 'ROLLBACK'];
const AY_ORDER = ['OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN',
                  'TEMMUZ', 'AGUSTOS', 'EYLUL', 'EKIM', 'KASIM', 'ARALIK'];

function normStr(s) {
  return String(s)
    .toUpperCase()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'I')
    .replace(/\u015e/g, 'S')
    .replace(/\u015f/g, 'S')
    .replace(/\u00dc/g, 'U')
    .replace(/\u00fc/g, 'U')
    .replace(/\u00d6/g, 'O')
    .replace(/\u00f6/g, 'O')
    .replace(/\u00c7/g, 'C')
    .replace(/\u00e7/g, 'C')
    .replace(/\u011e/g, 'G')
    .replace(/\u011f/g, 'G');
}

function findCol(cols, keywords) {
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

function resolveColumns(cols) {
  var colMap = { tip: null, ay: null, test: null };
  colMap.tip  = findCol(cols, ['TIP', 'TYPE', 'ISSUETYPE', 'ISSUE TYPE']);
  colMap.ay   = findCol(cols, ['AY', 'MONTH', 'AYLAR', 'AY ']);
  colMap.test = findCol(cols, ['TEST KAYNAKLI', 'TEST', 'CAUSED BY TEST', 'KAYNAK']);
  return colMap;
}

function oranRenk(p) {
  if (p >= 30) return '#C00000';
  if (p >= 15) return '#c07000';
  return '#15692a';
}

function ayGoster(ay) {
  var MAP = {
    'OCAK':'Ocak','SUBAT':'Sub','\u015EUBAT':'\u015Eub','MART':'Mar',
    'NISAN':'Nis','N\u0130SAN':'Nis','MAYIS':'May','MAY\u0131S':'May',
    'HAZIRAN':'Haz','HAZ\u0130RAN':'Haz','TEMMUZ':'Tem',
    'AGUSTOS':'Agu','A\u011EUSTOS':'A\u011fu',
    'EYLUL':'Eyl','EYL\u00DCL':'Eyl',
    'EKIM':'Eki','EK\u0130M':'Eki','KASIM':'Kas','ARALIK':'Ara'
  };
  return MAP[ay] || ay;
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
  rows.forEach(function(r) { if (r.tip) set.add(r.tip); });
  return TIP_ORDER.filter(function(t) { return set.has(t); })
    .concat(Array.from(set).filter(function(t) { return TIP_ORDER.indexOf(t) === -1; }).sort());
}

function filtrele(allRows, selAy, selSayfa, selTip, extraFilters) {
  return allRows.filter(function(r) {
    if (selAy.size    > 0 && !selAy.has(r.ay))        return false;
    if (selSayfa.size > 0 && !selSayfa.has(r._sayfa))  return false;
    if (selTip.size   > 0 && !selTip.has(r.tip))       return false;
    var keys = Object.keys(extraFilters);
    for (var i = 0; i < keys.length; i++) {
      var col = keys[i];
      var raw = r._raw || {};
      if ((raw[col] || '') !== extraFilters[col]) return false;
    }
    return true;
  });
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_ROWS = [
  { _sayfa: 'Q1', tip: 'PR',         ay: 'OCAK',        testKaynakli: true,  _raw: { MUDurluk: 'A' } },
  { _sayfa: 'Q1', tip: 'KR',         ay: 'OCAK',        testKaynakli: false, _raw: { MUDURLUK: 'B' } },
  { _sayfa: 'Q1', tip: 'HOTFIX',     ay: 'SUBAT',       testKaynakli: true,  _raw: { MUDRLUK: 'A' } },
  { _sayfa: 'Q2', tip: 'PR',         ay: 'MART',        testKaynakli: false, _raw: { MUDRLUK: 'C' } },
  { _sayfa: 'Q2', tip: 'ROLLBACK',   ay: 'MART',        testKaynakli: true,  _raw: { MUDRLUK: 'A' } },
  { _sayfa: 'Q2', tip: '(Belirsiz)', ay: '(Belirsiz)',  testKaynakli: null,  _raw: { MUDRLUK: '' } },
];

// ─── normStr ──────────────────────────────────────────────────────────────────

// ─── escHtml ──────────────────────────────────────────────────────────────────

describe('escHtml', () => {
  test('escapes < and >', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });
  test('escapes & ', () => {
    expect(escHtml('Q&A')).toBe('Q&amp;A');
  });
  test('escapes double quotes', () => {
    expect(escHtml('"value"')).toBe('&quot;value&quot;');
  });
  test('escapes single quotes', () => {
    expect(escHtml("it's")).toBe('it&#39;s');
  });
  test('leaves safe strings untouched', () => {
    expect(escHtml('PR')).toBe('PR');
  });
});

// ─── csvVal ───────────────────────────────────────────────────────────────────

describe('csvVal', () => {
  test('leaves simple values untouched', () => {
    expect(csvVal('PR')).toBe('PR');
  });
  test('wraps values containing comma in quotes', () => {
    expect(csvVal('Q1, Sprint')).toBe('"Q1, Sprint"');
  });
  test('escapes existing double quotes', () => {
    expect(csvVal('say "hello"')).toBe('"say ""hello"""');
  });
  test('wraps values containing newline', () => {
    expect(csvVal('line1\nline2')).toBe('"line1\nline2"');
  });
});

// ─── normStr ──────────────────────────────────────────────────────────────────

describe('normStr', () => {
  test('uppercases ASCII', () => {
    expect(normStr('hello')).toBe('HELLO');
  });

  test('normalizes Turkish İ → I', () => {
    expect(normStr('İstanbul')).toBe('ISTANBUL');
  });

  test('normalizes Turkish ı → I', () => {
    expect(normStr('kırık')).toBe('KIRIK');
  });

  test('normalizes Ş and ş → S', () => {
    expect(normStr('Şubat')).toBe('SUBAT');
  });

  test('normalizes Ü and ü → U', () => {
    expect(normStr('üzüm')).toBe('UZUM');
  });

  test('normalizes Ö and ö → O', () => {
    expect(normStr('Özel')).toBe('OZEL');
  });

  test('normalizes Ç and ç → C', () => {
    expect(normStr('Çarşamba')).toBe('CARSAMBA');
  });

  test('normalizes Ğ and ğ → G', () => {
    expect(normStr('Ağustos')).toBe('AGUSTOS');
  });

  test('collapses multiple spaces', () => {
    expect(normStr('TEST   KAYNAKLI')).toBe('TEST KAYNAKLI');
  });

  test('replaces newlines with space', () => {
    expect(normStr('TEST\nKAYNAKLI')).toBe('TEST KAYNAKLI');
  });

  test('trims leading/trailing whitespace', () => {
    expect(normStr('  AY  ')).toBe('AY');
  });

  test('handles non-string input (number)', () => {
    expect(normStr(42)).toBe('42');
  });
});

// ─── findCol ──────────────────────────────────────────────────────────────────

describe('findCol', () => {
  const cols = ['İssue Type', 'Ay', 'Test Kaynaklı', 'Müdürlük'];

  test('finds column by exact normalized keyword', () => {
    expect(findCol(cols, ['AY'])).toBe('Ay');
  });

  test('finds column by partial match', () => {
    expect(findCol(cols, ['TEST KAYNAKLI'])).toBe('Test Kaynaklı');
  });

  test('matches despite Turkish characters in column name', () => {
    expect(findCol(cols, ['ISSUE TYPE'])).toBe('İssue Type');
  });

  test('returns first column match when multiple keywords provided', () => {
    // findCol scans columns left-to-right; 'Ay' appears before 'Müdürlük' in cols,
    // and 'AY' matches 'Ay', so 'Ay' is returned even though 'MUDÜRLÜK' is listed first.
    expect(findCol(cols, ['NOTEXIST', 'MUDÜRLÜK', 'AY'])).toBe('Ay');
  });

  test('matches a later column when only its keyword is provided', () => {
    expect(findCol(cols, ['NOTEXIST', 'MUDÜRLÜK'])).toBe('Müdürlük');
  });

  test('returns null when no match found', () => {
    expect(findCol(cols, ['SPRINT', 'ASSIGNEE'])).toBeNull();
  });

  test('returns null for empty columns array', () => {
    expect(findCol([], ['AY'])).toBeNull();
  });
});

// ─── resolveColumns ───────────────────────────────────────────────────────────

describe('resolveColumns', () => {
  test('resolves all three columns from typical headers', () => {
    const cols = ['Issue Type', 'Ay', 'Test Kaynaklı'];
    const result = resolveColumns(cols);
    expect(result.tip).toBe('Issue Type');
    expect(result.ay).toBe('Ay');
    expect(result.test).toBe('Test Kaynaklı');
  });

  test('resolves English column names', () => {
    const cols = ['Type', 'Month', 'Caused By Test'];
    const result = resolveColumns(cols);
    expect(result.tip).toBe('Type');
    expect(result.ay).toBe('Month');
    expect(result.test).toBe('Caused By Test');
  });

  test('returns null for missing columns', () => {
    const result = resolveColumns(['Sprint', 'Assignee']);
    expect(result.tip).toBeNull();
    expect(result.ay).toBeNull();
    expect(result.test).toBeNull();
  });
});

describe('collectRawColumns', () => {
  test('merges columns across rows and keeps preferred columns first', () => {
    const rows = [
      { 'TİP': 'PR', 'AY': 'OCAK', '_sayfa': 'Q1' },
      { 'Sorumlu QA': 'Aylin', 'Müdürlük': 'Digital', '_sheetRowIdx': 1 },
      { 'AY': 'SUBAT', 'Sorumlu QA': 'Mert' }
    ];
    expect(collectRawColumns(rows, ['TİP', 'AY'])).toEqual(['TİP', 'AY', 'Sorumlu QA', 'Müdürlük']);
  });
});

describe('isPreferredEditFilterColumn', () => {
  test('matches Sorumlu QA style columns', () => {
    expect(isPreferredEditFilterColumn('Sorumlu QA')).toBe(true);
    expect(isPreferredEditFilterColumn('Sorumlu Qa Adı')).toBe(true);
    expect(isPreferredEditFilterColumn('QA Owner')).toBe(true);
  });

  test('does not match unrelated columns', () => {
    expect(isPreferredEditFilterColumn('Müdürlük')).toBe(false);
  });
});

// ─── oranRenk ─────────────────────────────────────────────────────────────────

describe('oranRenk', () => {
  test('returns red for >= 30%', () => {
    expect(oranRenk(30)).toBe('#C00000');
    expect(oranRenk(100)).toBe('#C00000');
  });

  test('returns orange for >= 15% and < 30%', () => {
    expect(oranRenk(15)).toBe('#c07000');
    expect(oranRenk(29.9)).toBe('#c07000');
  });

  test('returns green for < 15%', () => {
    expect(oranRenk(0)).toBe('#15692a');
    expect(oranRenk(14.9)).toBe('#15692a');
  });
});

// ─── ayGoster ─────────────────────────────────────────────────────────────────

describe('ayGoster', () => {
  test('maps known months', () => {
    expect(ayGoster('OCAK')).toBe('Ocak');
    expect(ayGoster('ARALIK')).toBe('Ara');
    expect(ayGoster('TEMMUZ')).toBe('Tem');
  });

  test('returns original value for unknown input', () => {
    expect(ayGoster('BILINMEYEN')).toBe('BILINMEYEN');
  });

  test('maps Turkish variant of ŞUBAT', () => {
    expect(ayGoster('\u015EUBAT')).toBe('\u015Eub');
  });
});

// ─── tumDegerler ──────────────────────────────────────────────────────────────

describe('tumDegerler', () => {
  test('returns unique values for a top-level field', () => {
    const result = tumDegerler('tip', SAMPLE_ROWS);
    expect(result.sort()).toEqual(['(Belirsiz)', 'HOTFIX', 'KR', 'PR', 'ROLLBACK']);
  });

  test('returns unique values for ay field', () => {
    const result = tumDegerler('ay', SAMPLE_ROWS);
    expect(result.sort()).toEqual(['(Belirsiz)', 'MART', 'OCAK', 'SUBAT']);
  });

  test('returns unique values from _raw nested field', () => {
    const rows = [
      { _raw: { MUDRLUK: 'A' } },
      { _raw: { MUDRLUK: 'B' } },
      { _raw: { MUDRLUK: 'A' } },
    ];
    const result = tumDegerler('_raw.MUDRLUK', rows);
    expect(result.sort()).toEqual(['A', 'B']);
  });

  test('excludes empty/falsy values', () => {
    const rows = [
      { tip: 'PR' }, { tip: '' }, { tip: null }, { tip: undefined }
    ];
    expect(tumDegerler('tip', rows)).toEqual(['PR']);
  });

  test('returns empty array for empty rows', () => {
    expect(tumDegerler('tip', [])).toEqual([]);
  });
});

// ─── mevcutTipler ─────────────────────────────────────────────────────────────

describe('mevcutTipler', () => {
  test('returns types in TIP_ORDER first, Belirsiz appended last', () => {
    const result = mevcutTipler(SAMPLE_ROWS);
    expect(result).toEqual(['PR', 'KR', 'HOTFIX', 'ROLLBACK', '(Belirsiz)']);
  });

  test('appends unknown types alphabetically after ordered ones', () => {
    const rows = [
      { tip: 'CUSTOM' }, { tip: 'PR' }, { tip: 'ALPHA' }
    ];
    const result = mevcutTipler(rows);
    expect(result).toEqual(['PR', 'ALPHA', 'CUSTOM']);
  });

  test('returns empty array for empty rows', () => {
    expect(mevcutTipler([])).toEqual([]);
  });

  test('ignores rows with no tip', () => {
    const rows = [{ tip: '' }, { tip: null }, { tip: 'PR' }];
    expect(mevcutTipler(rows)).toEqual(['PR']);
  });
});

// ─── filtrele ─────────────────────────────────────────────────────────────────

describe('filtrele', () => {
  const noFilter = { selAy: new Set(), selSayfa: new Set(), selTip: new Set(), extra: {} };

  test('returns all rows when no filters active', () => {
    const result = filtrele(SAMPLE_ROWS, noFilter.selAy, noFilter.selSayfa, noFilter.selTip, noFilter.extra);
    expect(result).toHaveLength(6);
  });

  test('filters by ay', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(['OCAK']), new Set(), new Set(), {});
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.ay).toBe('OCAK'));
  });

  test('filters by sayfa', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(), new Set(['Q2']), new Set(), {});
    expect(result).toHaveLength(3); // PR, ROLLBACK, and the Belirsiz row — all in Q2
    result.forEach(r => expect(r._sayfa).toBe('Q2'));
  });

  test('filters by tip', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(), new Set(), new Set(['PR']), {});
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.tip).toBe('PR'));
  });

  test('combines multiple filters (AND logic)', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(['OCAK']), new Set(), new Set(['PR']), {});
    expect(result).toHaveLength(1);
    expect(result[0].tip).toBe('PR');
    expect(result[0].ay).toBe('OCAK');
  });

  test('returns empty when no rows match', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(['ARALIK']), new Set(), new Set(), {});
    expect(result).toHaveLength(0);
  });

  test('includes Belirsiz rows in unfiltered results', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(), new Set(), new Set(), {});
    const belirsiz = result.filter(r => r.testKaynakli === null);
    expect(belirsiz).toHaveLength(1);
  });

  test('Belirsiz rows do not count as EVET or HAYIR', () => {
    const result = filtrele(SAMPLE_ROWS, new Set(), new Set(), new Set(), {});
    const evet  = result.filter(r => r.testKaynakli === true).length;
    const hayir = result.filter(r => r.testKaynakli === false).length;
    const bel   = result.filter(r => r.testKaynakli === null).length;
    expect(evet + hayir + bel).toBe(result.length);
    // Oran hesabı: belirsiz hariç
    const valid = evet + hayir;
    const oran = valid ? (evet / valid) * 100 : 0;
    expect(oran).toBeCloseTo(60, 0); // 3 evet / 5 valid = 60%
  });

  test('filters by extraFilters (_raw field)', () => {
    const rows = [
      { _sayfa: 'Q1', tip: 'PR', ay: 'OCAK', testKaynakli: true,  _raw: { MUDRLUK: 'A' } },
      { _sayfa: 'Q1', tip: 'KR', ay: 'OCAK', testKaynakli: false, _raw: { MUDRLUK: 'B' } },
    ];
    const result = filtrele(rows, new Set(), new Set(), new Set(), { MUDRLUK: 'A' });
    expect(result).toHaveLength(1);
    expect(result[0].tip).toBe('PR');
  });
});

// ─── efektifTest ─────────────────────────────────────────────────────────────
describe('efektifTest', () => {
  test('_edits yoksa row.testKaynakli döner', () => {
    expect(efektifTest({ testKaynakli: true })).toBe(true);
    expect(efektifTest({ testKaynakli: false })).toBe(false);
    expect(efektifTest({ testKaynakli: null })).toBe(null);
  });
  test('_edits boş obje ise row.testKaynakli döner', () => {
    expect(efektifTest({ testKaynakli: true, _edits: {} })).toBe(true);
  });
  test('_edits.testKaynakli === undefined ise row.testKaynakli döner', () => {
    expect(efektifTest({ testKaynakli: false, _edits: { kokNeden: 'X' } })).toBe(false);
  });
  test('_edits.testKaynakli true override eder', () => {
    expect(efektifTest({ testKaynakli: false, _edits: { testKaynakli: true } })).toBe(true);
  });
  test('_edits.testKaynakli false override eder', () => {
    expect(efektifTest({ testKaynakli: true, _edits: { testKaynakli: false } })).toBe(false);
  });
  test('_edits.testKaynakli null "Belirsiz" override eder', () => {
    expect(efektifTest({ testKaynakli: true, _edits: { testKaynakli: null } })).toBe(null);
  });
});

// ─── editsSatirEksikMi ───────────────────────────────────────────────────────
describe('editsSatirEksikMi', () => {
  const tamRow = {
    testKaynakli: true,
    _edits: { kokNeden: 'Configuration Issue', alınacakAksiyon: 'Fix', cozumEkibi: 'DevOps' }
  };
  test('tüm alanlar doluysa false döner', () => {
    expect(editsSatirEksikMi(tamRow)).toBe(false);
  });
  test('efektifTest null ise true döner', () => {
    expect(editsSatirEksikMi({ testKaynakli: null, _edits: {} })).toBe(true);
  });
  test('kokNeden eksikse true döner', () => {
    expect(editsSatirEksikMi({ testKaynakli: true, _edits: { alınacakAksiyon: 'X', cozumEkibi: 'Y' } })).toBe(true);
  });
  test('alınacakAksiyon eksikse true döner', () => {
    expect(editsSatirEksikMi({ testKaynakli: true, _edits: { kokNeden: 'X', cozumEkibi: 'Y' } })).toBe(true);
  });
  test('cozumEkibi eksikse true döner', () => {
    expect(editsSatirEksikMi({ testKaynakli: true, _edits: { kokNeden: 'X', alınacakAksiyon: 'Y' } })).toBe(true);
  });
  test('_edits.testKaynakli override ile null olmayan değer + tüm alanlar dolu → false', () => {
    const row = { testKaynakli: null, _edits: { testKaynakli: false, kokNeden: 'X', alınacakAksiyon: 'Y', cozumEkibi: 'Z' } };
    expect(editsSatirEksikMi(row)).toBe(false);
  });
});

// ─── KOK_NEDEN_OPTIONS ───────────────────────────────────────────────────────
describe('KOK_NEDEN_OPTIONS', () => {
  test('12 eleman içerir (boş + 11 seçenek)', () => {
    expect(KOK_NEDEN_OPTIONS).toHaveLength(12);
  });
  test('ilk eleman boş string', () => {
    expect(KOK_NEDEN_OPTIONS[0]).toBe('');
  });
  test('son eleman Integration', () => {
    expect(KOK_NEDEN_OPTIONS[KOK_NEDEN_OPTIONS.length - 1]).toBe('Integration');
  });
  test('Quality Gate Bypass (Known Issue) içerir', () => {
    expect(KOK_NEDEN_OPTIONS).toContain('Quality Gate Bypass (Known Issue)');
  });
});

// ─── applyEditsToAoa ─────────────────────────────────────────────────────────
describe('applyEditsToAoa', () => {
  function makeAoa() {
    return [
      ['TİP', 'AY', 'Test Kaynaklı'],
      ['PR', 'OCAK', ''],
      ['KR', 'SUBAT', 'EVET'],
      ['HOTFIX', 'MART', ''],
    ];
  }

  test('düzenleme olmayan satır değişmez', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [{ _sheetRowIdx: 0, _edits: {} }], 'Test Kaynaklı');
    // _edits boş → satır padding almaz, orijinal haliyle kalır
    expect(aoa[1]).toEqual(['PR', 'OCAK', '']);
  });

  test('_sheetRowIdx=0 → aoa[1] satırına yazılır', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { kokNeden: 'Configuration Issue' } }
    ], 'Test Kaynaklı');
    expect(aoa[1][aoa[0].indexOf('Kök Neden')]).toBe('Configuration Issue');
    // Düzenlenmemiş satırlar padding almaz → yeni sütun indeksi undefined
    expect(aoa[2][aoa[0].indexOf('Kök Neden')]).toBeUndefined();
  });

  test('_sheetRowIdx=2 → aoa[3] satırına yazılır (off-by-one kontrolü)', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 2, _edits: { kokNeden: 'User Error' } }
    ], 'Test Kaynaklı');
    expect(aoa[3][aoa[0].indexOf('Kök Neden')]).toBe('User Error');
    // Düzenlenmemiş satırlar padding almaz
    expect(aoa[1][aoa[0].indexOf('Kök Neden')]).toBeUndefined();
    expect(aoa[2][aoa[0].indexOf('Kök Neden')]).toBeUndefined();
  });

  test('testKaynakli true → EVET yazılır', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { testKaynakli: true } }
    ], 'Test Kaynaklı');
    expect(aoa[1][2]).toBe('EVET');
  });

  test('testKaynakli false → HAYIR yazılır', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 1, _edits: { testKaynakli: false } }
    ], 'Test Kaynaklı');
    expect(aoa[2][2]).toBe('HAYIR');
  });

  test('Excel başlığında \\n olan sütun adı normalize edilir — testColIdx doğru bulunur', () => {
    // Excel ham başlık "Test Kaynaklı\n" içeriyor; colMap.test ise trim edilmiş
    const aoa = [
      ['TİP', 'AY', 'Test Kaynaklı\n'],
      ['PR', 'OCAK', ''],
    ];
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { testKaynakli: true } }
    ], 'Test Kaynaklı');  // colMap.test trimlenmiş hali
    expect(aoa[1][2]).toBe('EVET');  // BUG: indexOf ile -1 dönüyor, normalize ile 2 döner
  });

  test('Excel başlığında boşluk olan sütun adı normalize edilir', () => {
    const aoa = [
      ['TİP', 'AY', '  Test Kaynaklı  '],
      ['KR', 'MART', ''],
    ];
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { testKaynakli: false } }
    ], 'Test Kaynaklı');
    expect(aoa[1][2]).toBe('HAYIR');
  });

  test('düzenleme sütunları başlıkta yoksa sona eklenir', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { kokNeden: 'X' } }
    ], 'Test Kaynaklı');
    expect(aoa[0]).toContain('Kök Neden');
    expect(aoa[0]).toContain('Alınacak Aksiyon');
    expect(aoa[0]).toContain('Çözüm Ekibi');
  });

  test('düzenleme sütunları başlıkta varsa tekrar eklenmez', () => {
    const aoa = [
      ['TİP', 'Kök Neden', 'Alınacak Aksiyon', 'Çözüm Ekibi'],
      ['PR', '', '', ''],
    ];
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { kokNeden: 'Config' } }
    ], null);
    const kokNedCount = aoa[0].filter(function(v){ return v === 'Kök Neden'; }).length;
    expect(kokNedCount).toBe(1);
  });

  test('tüm düzenleme alanları aynı anda yazılır', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      {
        _sheetRowIdx: 0,
        _edits: {
          testKaynakli: true,
          kokNeden: 'Configuration Issue',
          alınacakAksiyon: 'Çözümü uygula',
          cozumEkibi: 'DevOps'
        }
      }
    ], 'Test Kaynaklı');
    const h = aoa[0];
    expect(aoa[1][2]).toBe('EVET');
    expect(aoa[1][h.indexOf('Kök Neden')]).toBe('Configuration Issue');
    expect(aoa[1][h.indexOf('Alınacak Aksiyon')]).toBe('Çözümü uygula');
    expect(aoa[1][h.indexOf('Çözüm Ekibi')]).toBe('DevOps');
  });

  test('_sheetRowIdx sınır dışıysa satır güvenle atlanır', () => {
    const aoa = makeAoa();
    expect(() => applyEditsToAoa(aoa, [
      { _sheetRowIdx: 99, _edits: { kokNeden: 'X' } }
    ], 'Test Kaynaklı')).not.toThrow();
  });

  test('testColName null ise testKaynakli yazılmaz', () => {
    const aoa = makeAoa();
    applyEditsToAoa(aoa, [
      { _sheetRowIdx: 0, _edits: { testKaynakli: true } }
    ], null);
    // Test Kaynaklı sütunu orijinal değeri korunmalı
    expect(aoa[1][2]).toBe('');
  });
});

// ─── editsBadgeGuncelle sayım mantığı ────────────────────────────────────────
// editsBadgeGuncelle DOM'a bağlı olduğundan içindeki saf sayım mantığını test ediyoruz:
// allRows.filter(r => efektifTest(r) === null).length
function belirsizSayisi(rows) {
  return rows.filter(function(r) { return efektifTest(r) === null; }).length;
}

describe('editsBadgeGuncelle sayım mantığı', () => {
  test('testKaynakli null olan satırlar sayılır', () => {
    const rows = [
      { testKaynakli: null },
      { testKaynakli: true },
      { testKaynakli: false },
    ];
    expect(belirsizSayisi(rows)).toBe(1);
  });

  test('tüm satırlar belirsiz ise tümü sayılır', () => {
    const rows = [
      { testKaynakli: null },
      { testKaynakli: null },
    ];
    expect(belirsizSayisi(rows)).toBe(2);
  });

  test('hiç belirsiz yoksa 0 döner', () => {
    const rows = [
      { testKaynakli: true },
      { testKaynakli: false },
    ];
    expect(belirsizSayisi(rows)).toBe(0);
  });

  test('_edits.testKaynakli null override belirsiz olarak sayılır', () => {
    const rows = [
      { testKaynakli: true, _edits: { testKaynakli: null } },
    ];
    expect(belirsizSayisi(rows)).toBe(1);
  });

  test('_edits.testKaynakli true override belirsiz sayılmaz', () => {
    const rows = [
      { testKaynakli: null, _edits: { testKaynakli: true } },
    ];
    expect(belirsizSayisi(rows)).toBe(0);
  });

  test('boş satır listesi → 0', () => {
    expect(belirsizSayisi([])).toBe(0);
  });

  test('kokNeden eksik ama testKaynakli dolu → badge sayımına girmez', () => {
    // Badge artık sadece TK\'ya bakıyor; kokNeden/alınacakAksiyon eksikliği badge\'i etkilemez
    const rows = [
      { testKaynakli: true, _edits: {} },
    ];
    expect(belirsizSayisi(rows)).toBe(0);
  });
});

// ─── exportUpdatedFilename mantığı ────────────────────────────────────────────
function exportUpdatedFilename(originalName) {
  var base = originalName.replace(/\.[^.]+$/, '');
  if (base === originalName) base = originalName;
  return base + ' - Guncellenmis.xlsx';
}

describe('exportUpdatedFilename', () => {
  test('.xlsx uzantılı dosyada uzantı korunur ve son ek eklenir', () => {
    expect(exportUpdatedFilename('rapor.xlsx')).toBe('rapor - Guncellenmis.xlsx');
  });

  test('.xls uzantısı yeni .xlsx adıyla indirilir', () => {
    expect(exportUpdatedFilename('rapor.xls')).toBe('rapor - Guncellenmis.xlsx');
  });

  test('.xlsm uzantısı yeni .xlsx adıyla indirilir', () => {
    expect(exportUpdatedFilename('rapor.xlsm')).toBe('rapor - Guncellenmis.xlsx');
  });

  test('çok noktalı dosya adında sadece son uzantı atılır', () => {
    expect(exportUpdatedFilename('rapor.q1.2025.xlsx')).toBe('rapor.q1.2025 - Guncellenmis.xlsx');
  });

  test('uzantısız dosyada ad korunur', () => {
    expect(exportUpdatedFilename('rapor')).toBe('rapor - Guncellenmis.xlsx');
  });

  test('büyük harf uzantısında da son ek doğru eklenir', () => {
    expect(exportUpdatedFilename('rapor.XLSX')).toBe('rapor - Guncellenmis.xlsx');
  });

  test('Türkçe karakterli dosya adı korunur', () => {
    expect(exportUpdatedFilename('Q1_Özet_Rapor.xlsx')).toBe('Q1_Özet_Rapor - Guncellenmis.xlsx');
  });

  test('boşluk içeren dosya adı korunur', () => {
    expect(exportUpdatedFilename('Q1 Issue Raporu.xlsx')).toBe('Q1 Issue Raporu - Guncellenmis.xlsx');
  });
});

// ─── worksheet güncelleme helpers ────────────────────────────────────────────
const XLSX = {
  utils: {
    encode_cell: function(addr) {
      var col = '';
      var c = addr.c;
      do {
        col = String.fromCharCode(65 + (c % 26)) + col;
        c = Math.floor(c / 26) - 1;
      } while (c >= 0);
      return col + String(addr.r + 1);
    },
    decode_range: function(ref) {
      function decodeCell(cellRef) {
        var m = /^([A-Z]+)(\d+)$/.exec(cellRef);
        var letters = m[1];
        var row = parseInt(m[2], 10) - 1;
        var col = 0;
        for (var i = 0; i < letters.length; i++) {
          col = col * 26 + (letters.charCodeAt(i) - 64);
        }
        return { r: row, c: col - 1 };
      }
      var parts = ref.split(':');
      return {
        s: decodeCell(parts[0]),
        e: decodeCell(parts[1] || parts[0])
      };
    },
    encode_range: function(range) {
      return this.encode_cell(range.s) + ':' + this.encode_cell(range.e);
    }
  },
  write: function(wb) {
    return JSON.stringify(wb);
  },
  read: function(bytes) {
    return JSON.parse(bytes);
  }
};

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

function saveCurrentEditsDeps(currentFile, deps) {
  if (!currentFile) {
    deps.toast('Önce bir dosya yükleyin', 'warn');
    return false;
  }
  deps.editsKaydet();
  deps.document.getElementById('expDrop').classList.remove('open');
  deps.toast('Değişiklikler kaydedildi', 'ok');
  return true;
}

function makeWorksheet() {
  return {
    '!ref': 'A1:C3',
    A1: { t: 's', v: 'TİP', w: 'TİP' },
    B1: { t: 's', v: 'AY', w: 'AY' },
    C1: { t: 's', v: 'Test Kaynaklı\n', w: 'Test Kaynaklı\n' },
    A2: { t: 's', v: 'PR', w: 'PR' },
    B2: { t: 's', v: 'OCAK', w: 'OCAK' },
    C2: { t: 's', v: '', w: '' },
    A3: { t: 's', v: 'KR', w: 'KR' },
    B3: { t: 's', v: 'SUBAT', w: 'SUBAT' },
    C3: { t: 's', v: 'EVET', w: 'EVET', s: { font: { bold: true } } }
  };
}

describe('worksheet export helpers', () => {
  test('wsNormHeader trims and normalizes newlines', () => {
    expect(wsNormHeader(' Test Kaynaklı\n')).toBe('Test Kaynaklı');
  });

  test('wsFindHeaderCol finds normalized header cell', () => {
    var ws = makeWorksheet();
    var range = wsGetRange(ws);
    expect(wsFindHeaderCol(ws, range, 'Test Kaynaklı')).toBe(2);
  });

  test('wsEnsureHeaderCol appends a new header and expands range', () => {
    var ws = makeWorksheet();
    var range = wsGetRange(ws);
    var idx = wsEnsureHeaderCol(ws, range, 'Kök Neden');
    expect(idx).toBe(3);
    expect(ws.D1.v).toBe('Kök Neden');
    expect(ws['!ref']).toBe('A1:D3');
  });

  test('wsSetTextCell preserves existing style metadata', () => {
    var ws = makeWorksheet();
    wsSetTextCell(ws, 2, 2, 'HAYIR');
    expect(ws.C3.v).toBe('HAYIR');
    expect(ws.C3.s).toEqual({ font: { bold: true } });
  });

  test('applyEditsToWorksheet writes edits into existing row cells', () => {
    var ws = makeWorksheet();
    applyEditsToWorksheet(ws, [
      {
        _sheetRowIdx: 0,
        _edits: {
          testKaynakli: true,
          kokNeden: 'Configuration Issue',
          alınacakAksiyon: 'Düzelt',
          cozumEkibi: 'DevOps'
        }
      }
    ], 'Test Kaynaklı');
    expect(ws.C2.v).toBe('EVET');
    expect(ws.D2.v).toBe('Configuration Issue');
    expect(ws.E2.v).toBe('Düzelt');
    expect(ws.F2.v).toBe('DevOps');
  });

  test('applyEditsToWorksheet writes blank string for null testKaynakli', () => {
    var ws = makeWorksheet();
    applyEditsToWorksheet(ws, [
      { _sheetRowIdx: 1, _edits: { testKaynakli: null } }
    ], 'Test Kaynaklı');
    expect(ws.C3.v).toBe('');
  });

  test('applyEditsToWorksheet does not change test column when header is missing', () => {
    var ws = makeWorksheet();
    applyEditsToWorksheet(ws, [
      { _sheetRowIdx: 0, _edits: { testKaynakli: false, kokNeden: 'User Error' } }
    ], 'Olmayan Kolon');
    expect(ws.C2.v).toBe('');
    expect(ws.D2.v).toBe('User Error');
  });

  test('applyEditsToWorksheet skips out-of-range row indexes safely', () => {
    var ws = makeWorksheet();
    expect(function() {
      applyEditsToWorksheet(ws, [
        { _sheetRowIdx: 99, _edits: { kokNeden: 'X' } }
      ], 'Test Kaynaklı');
    }).not.toThrow();
    expect(ws.D100).toBeUndefined();
  });

  test('cloneWorkbookForDownload returns a detached copy', () => {
    var wb = { SheetNames: ['Q1'], Sheets: { Q1: makeWorksheet() } };
    var cloned = cloneWorkbookForDownload(wb);
    cloned.Sheets.Q1.C2.v = 'HAYIR';
    expect(wb.Sheets.Q1.C2.v).toBe('');
    expect(cloned).not.toBe(wb);
  });
});

describe('saveCurrentEdits behavior', () => {
  test('warns and does not save when no file is loaded', () => {
    var calls = [];
    var deps = {
      editsKaydet: function() { calls.push('save'); },
      toast: function(msg, type) { calls.push(['toast', msg, type]); },
      document: {
        getElementById: function() {
          return {
            classList: {
              remove: function() { calls.push('remove'); }
            }
          };
        }
      }
    };
    expect(saveCurrentEditsDeps(null, deps)).toBe(false);
    expect(calls).toEqual([
      ['toast', 'Önce bir dosya yükleyin', 'warn']
    ]);
  });

  test('saves edits, closes dropdown, and shows success toast when file exists', () => {
    var calls = [];
    var deps = {
      editsKaydet: function() { calls.push('save'); },
      toast: function(msg, type) { calls.push(['toast', msg, type]); },
      document: {
        getElementById: function(id) {
          expect(id).toBe('expDrop');
          return {
            classList: {
              remove: function(name) { calls.push(['remove', name]); }
            }
          };
        }
      }
    };
    expect(saveCurrentEditsDeps({ name: 'rapor.xlsx' }, deps)).toBe(true);
    expect(calls).toEqual([
      'save',
      ['remove', 'open'],
      ['toast', 'Değişiklikler kaydedildi', 'ok']
    ]);
  });
});

describe('export action wiring contract', () => {
  test('new export action ids are present in index markup', () => {
    var fs = require('fs');
    var html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain('id="expSave"');
    expect(html).toContain('id="expUpdated"');
    expect(html).toContain('id="edtsSaveBtn"');
    expect(html).toContain('id="edtsDownloadBtn"');
  });

  test('new export buttons are wired to the expected handlers in index script', () => {
    var fs = require('fs');
    var html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain("document.getElementById('expSave').addEventListener('click', saveCurrentEdits);");
    expect(html).toContain("document.getElementById('expUpdated').addEventListener('click', downloadUpdatedExcel);");
    expect(html).toContain("document.getElementById('edtsSaveBtn').addEventListener('click', saveCurrentEdits);");
    expect(html).toContain("document.getElementById('edtsDownloadBtn').addEventListener('click', downloadUpdatedExcel);");
  });
});

// ─── editsGorunurSatirlar mantığı ────────────────────────────────────────────
// editsGorunurSatirlar: onlyMissing=true ise sadece efektifTest(r)===null olanlar
function editsGorunurHelper(rows, onlyMissing) {
  return onlyMissing
    ? rows.filter(function(r) { return efektifTest(r) === null; })
    : rows.slice();
}

describe('editsGorunurSatirlar mantığı', () => {
  const rows = [
    { testKaynakli: null },                                          // belirsiz
    { testKaynakli: true },                                          // dolu
    { testKaynakli: false },                                         // dolu
    { testKaynakli: null,  _edits: { testKaynakli: true } },         // override ile çözüldü
    { testKaynakli: true,  _edits: { testKaynakli: null } },         // override ile belirsizleşti
  ];

  test('onlyMissing=true → sadece efektifTest null satırlar döner', () => {
    const result = editsGorunurHelper(rows, true);
    expect(result).toHaveLength(2);
    result.forEach(r => expect(efektifTest(r)).toBeNull());
  });

  test('onlyMissing=false → tüm satırlar döner', () => {
    const result = editsGorunurHelper(rows, false);
    expect(result).toHaveLength(5);
  });

  test('_edits override ile çözülen satır onlyMissing=true listesinde görünmez', () => {
    const result = editsGorunurHelper(rows, true);
    // rows[3]: testKaynakli=null ama _edits.testKaynakli=true → görünmemeli
    expect(result).not.toContain(rows[3]);
  });

  test('_edits override ile belirsizleşen satır onlyMissing=true listesinde görünür', () => {
    const result = editsGorunurHelper(rows, true);
    // rows[4]: testKaynakli=true ama _edits.testKaynakli=null → görünmeli
    expect(result).toContain(rows[4]);
  });

  test('tüm satırlar çözülünce onlyMissing=true boş liste döner', () => {
    const allResolved = [
      { testKaynakli: true },
      { testKaynakli: false },
    ];
    expect(editsGorunurHelper(allResolved, true)).toHaveLength(0);
  });
});
