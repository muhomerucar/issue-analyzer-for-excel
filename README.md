# QA Issue Dashboard — Turkish Airlines IT

Her ay güncellenen QA defect raporlarını analiz eden, tarayıcı tabanlı dashboard uygulaması.

---

## Nasıl çalışır?

1. `index.html` dosyasını tarayıcıda aç
2. Excel dosyasını yükle (sürükle-bırak veya tıkla)
3. Ay, Sayfa, TİP filtrelerini seç
4. **Analiz Et** butonuna bas
5. Sonuçları görüntüle veya dışa aktar

---

## Özellikler

| Özellik | Açıklama |
|---|---|
| Otomatik sütun eşleştirme | TİP, AY, TEST KAYNAKLI sütunları otomatik bulunur |
| Çoklu sayfa desteği | Birden fazla Excel sayfası birlikte analiz edilir |
| TİP × Test Kaynaklı tablosu | PR / KR / Hotfix / Rollback bazında EVET / HAYIR / Belirsiz dağılımı |
| Belirsiz kayıt desteği | Boş TİP, AY veya TEST KAYNAKLI hücreleri `(Belirsiz)` olarak işaretlenir; test oranı hesaplarını etkilemez |
| Aylık trend grafiği | Stacked bar (EVET / HAYIR / Belirsiz), TİP filtresiyle kırılabilir |
| Sayfa bazlı detay | Her direktörlük ayrı kart olarak gösterilir |
| Dışa aktarım | Excel (.xlsx), CSV, PDF/Yazdır |

---

## Proje yapısı

```
qa-issue-dashboard/
├── index.html      → HTML iskelet ve sayfa yapısı
├── style.css       → Tüm stiller (Turkish Airlines kırmızı/beyaz tema)
├── app.js          → Uygulama mantığı (veri yükleme, filtreleme, analiz)
├── app.test.js     → Birim testler (Jest)
├── package.json    → Test bağımlılıkları
└── README.md       → Bu dosya
```

---

## Kullanılan teknolojiler

| Kütüphane | Sürüm | Kullanım |
|---|---|---|
| [XLSX.js](https://github.com/SheetJS/sheetjs) | 0.18.5 | Excel okuma ve yazma |
| [Chart.js](https://www.chartjs.org) | 4.4.1 | Trend grafiği |
| IBM Plex Sans/Mono | — | Yazı tipi (Google Fonts) |

> İnternet bağlantısı gerektirir (CDN ve Google Fonts için).

---

## Testleri çalıştırma

```bash
npm install
npm test
```

Saf mantık fonksiyonları test edilir (`normStr`, `findCol`, `filtrele`, `mevcutTipler` vb.). DOM veya Excel bağımlılığı yoktur.

---

## Her ay nasıl güncellenir?

Yeni ay verisini içeren Excel dosyasını uygulamaya yükle — başka bir şey yapmana gerek yok.

---

## Geliştiren

Turkish Airlines IT Quality Team
