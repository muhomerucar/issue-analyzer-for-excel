// ─── Pure logic extracted from app.js for unit testing ───────────────────────

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
