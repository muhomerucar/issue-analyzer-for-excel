# ✈️ QA Issue Dashboard

Turkish Airlines IT Quality ekibi için hazırlanmış bu uygulama, aylık QA defect Excel dosyalarını hızlıca analiz etmek, belirsiz kayıtları tamamlamak ve güncellenmiş çıktıları üretmek için geliştirilmiş tarayıcı tabanlı bir araçtır.

Kurulum gerektirmez. Sunucu gerektirmez. Excel dosyasını açar, analiz eder, düzenleme akışını yönetir.

---

## 🎯 Amaç

Bu uygulamanın temel amacı:

- QA issue / defect verilerini Excel üzerinden merkezi biçimde incelemek
- `Test Kaynaklı` alanı belirsiz olan kayıtları hızlıca tespit etmek
- Bu kayıtları tek tek veya toplu şekilde tamamlamak
- Analiz sonuçlarını dashboard üzerinde özetlemek
- Güncel veriyi Excel / CSV / özet çıktılar olarak dışa aktarmak

Özellikle düzenli raporlama yapan QA ekipleri için manuel Excel filtreleme yükünü azaltır ve veri tamamlama sürecini hızlandırır.

---

## 🧩 Neler Yapabilir?

### 1. Excel dosyası yükleme

- `.xlsx`, `.xls` ve `.csv` dosyalarını kabul eder
- Sürükle-bırak veya dosya seçme ile çalışır
- Çok sayfalı Excel dosyalarını okuyabilir
- Uygun olmayan dosya türlerini kullanıcıya açık hata mesajıyla bildirir

### 2. Otomatik kolon eşleme

Uygulama aşağıdaki temel alanları otomatik bulmaya çalışır:

- `TİP`
- `AY`
- `TEST KAYNAKLI`

Kolon isimleri birebir aynı olmak zorunda değildir. Türkçe karakter, boşluk ve yazım farkları normalize edilerek eşleştirme yapılır.

Eğer otomatik eşleşme başarısız olursa:

- kullanıcıya kolon eşleme ekranı gösterilir
- gerekli kolonlar manuel seçilebilir
- seçim hafızaya alınır

### 3. Dashboard analizi

Yüklenen veriler için aşağıdaki analizler sunulur:

- toplam kayıt
- test kaynaklı kayıt sayısı
- test kaynaklı olmayan kayıt sayısı
- belirsiz kayıt sayısı
- test kaynaklı oranı
- tip bazlı özet tablo
- aylık trend grafiği
- sayfa bazlı detay kartları

### 4. Filtreleme

Dashboard üzerinde filtreleme yapılabilir:

- ay
- sayfa
- tip
- dosyada bulunan ek kolonlar

Örnek ek filtre alanları:

- müdürlük
- sorumlu QA
- benzeri özel iş alanları

### 5. Veri düzenleme akışı

`Veri Düzenleme` sekmesi, eksik veya tamamlanması gereken kayıtları yönetmek için kullanılır.

Bu alanda kullanıcı:

- yalnızca eksik kayıtları görebilir
- tüm kayıtları açabilir
- `Sorumlu QA` gibi ek filtreler uygulayabilir
- tek kayıt üzerinde detaylı düzenleme yapabilir
- çoklu seçim ile toplu güncelleme yapabilir

Güncellenebilen alanlar:

- `Test Kaynaklı`
- `Kök Neden`
- `Alınacak Aksiyon`
- `Çözüm Ekibi`

### 6. Değişiklikleri kaydetme

Uygulama içinde yapılan düzenlemeler tarayıcı tarafında saklanır.

Bu sayede:

- kullanıcı sayfayı kapatıp tekrar açsa da kaldığı yerden devam edebilir
- aynı dosya tekrar yüklendiğinde önceki düzenlemeler geri yüklenebilir

### 7. Güncel çıktı üretme

Kullanıcı aşağıdaki çıktıları alabilir:

- tarayıcı içinde değişiklikleri kaydetme
- güncel Excel dosyasını indirme
- özet Excel üretme
- CSV dışa aktarma
- yazdır / PDF çıktısı alma

---

## 👤 Kimler İçin?

Bu araç özellikle aşağıdaki kullanıcılar için uygundur:

- QA uzmanları
- test yöneticileri
- kalite güvence ekipleri
- operasyon / raporlama ekipleri
- düzenli aylık defect analizi yapan ekipler

---

## 🚀 Kullanım Akışı

## 1. Uygulamayı aç

`index.html` dosyasını tarayıcıda aç.

Not:

- İlk açılışta internet bağlantısı gerekebilir
- Harici font ve kütüphaneler CDN üzerinden yüklenir

## 2. Excel dosyasını yükle

Dosyayı:

- sürükleyip bırak
- veya yükleme alanına tıklayıp seç

Desteklenen formatlar:

- `.xlsx`
- `.xls`
- `.csv`

## 3. Kolon eşleşmesini kontrol et

Uygulama kolonları otomatik çözmeye çalışır.

Eğer eşleştirme başarısız olursa:

- `TİP`
- `AY`
- `TEST KAYNAKLI`

alanlarını manuel olarak seç ve devam et.

## 4. Filtrele ve analiz et

İstersen filtre uygula:

- ay
- sayfa
- tip
- ek kolonlar

Ardından `Analiz Et` butonuna bas.

## 5. Dashboard’u incele

Bu aşamada:

- KPI kartları
- tip bazlı özet tablo
- aylık trend grafiği
- sayfa bazlı detaylar

görüntülenir.

## 6. Veri Düzenleme sekmesine geç

Bu sekmede:

- belirsiz kayıtları görebilir
- düzenleme durumunu takip edebilir
- toplu veya tekil veri girişleri yapabilirsin

## 7. Kayıtları tamamla

Eksik satırlar için aşağıdaki alanları doldur:

- Test Kaynaklı
- Kök Neden
- Alınacak Aksiyon
- Çözüm Ekibi

## 8. Çıktıyı al

İhtiyacına göre:

- değişiklikleri kaydet
- güncel Excel’i indir
- özet Excel oluştur
- CSV indir
- yazdır / PDF al

---

## 🧠 Veri Düzenleme Mantığı

### Belirsiz kayıt nedir?

`Test Kaynaklı` alanı boş olan kayıtlar belirsiz kabul edilir.

Bu kayıtlar:

- dashboard üzerinde ayrı gösterilir
- oran hesaplarında ayrı değerlendirilir
- veri düzenleme sekmesinde öncelikli olarak işlenir

### Tekil düzenleme

Bir satıra tıklanarak detay modalı açılır. Burada kayıt bazında düzenleme yapılır.

### Toplu düzenleme

Birden fazla satır seçilip aynı değerler topluca uygulanabilir.

Bu özellikle aşağıdaki durumlar için faydalıdır:

- aynı `Kök Neden`
- aynı `Çözüm Ekibi`
- aynı `Test Kaynaklı` kararı

### Klavye desteği

Tablo girişlerinde `Enter` ile aynı kolonda bir sonraki satıra geçiş yapılabilir.

---

## 🗂️ Dışa Aktarma Seçenekleri

### Değişiklikleri Kaydet

- tarayıcı içindeki düzenlemeleri saklar
- dosya indirme yapmaz
- çalışmaya kaldığın yerden devam etmeni sağlar

### Güncel Excel'i İndir

- orijinal dosyayı ezmeden yeni bir `.xlsx` üretir
- dosya adı sonuna güncel sürüm eki eklenir
- yalnızca ilgili alanlar güncellenmiş şekilde dışa aktarılır

### Özet Excel

- filtrelenmiş veri seti için özet çalışma kitabı üretir

### CSV İndir

- filtrelenmiş kayıtları düz metin formatında verir

### Yazdır / PDF

- tarayıcının yazdırma penceresini açar

---

## 📋 Beklenen Veri Yapısı

Dosyada ideal olarak aşağıdaki mantıksal alanlar bulunmalıdır:

| Alan | Örnek |
|---|---|
| TİP / Issue Type | PR, KR, HOTFIX, ROLLBACK |
| AY / Month | OCAK, ŞUBAT, MART |
| TEST KAYNAKLI | EVET, HAYIR, boş |

Ek kolonlar varsa uygulama bunları filtre alanı olarak değerlendirebilir.

Örnek:

- Müdürlük
- Sorumlu QA
- Takım
- Proje

---

## 🔒 Veri Saklama ve Güvenlik Notu

Bu sürüm istemci tarafında çalışır.

Yani:

- veri tarayıcı içinde işlenir
- düzenlemeler localStorage üzerinden saklanır
- harici bir sunucuya otomatik veri gönderilmez

Harici ağ erişimi yalnızca kullanılan kütüphaneler ve fontlar için gerekebilir.

---

## 🛠️ Teknik Özellikler

- saf HTML / CSS / JavaScript tabanlı yapı
- Excel okuma / yazma: `SheetJS`
- grafikler: `Chart.js`
- test altyapısı: `Jest`

---

## 🧪 Testler

Testleri çalıştırmak için:

```bash
npm test
```

Test kapsamı içinde şunlar bulunur:

- string normalize etme
- kolon bulma
- kolon çözümleme
- filtreleme
- badge mantığı
- export dosya adı üretimi
- worksheet bazlı güncelleme yardımcıları
- kaydetme davranışı
- export wiring kontrolleri

---

## 📁 Proje Yapısı

```text
issue-analyzer-for-excel/
├── index.html
├── style.css
├── app.js
├── app.test.js
├── package.json
└── README.md
```

### Dosya rolleri

- `index.html`: arayüz yapısı ve uygulamanın çalıştığı ana giriş
- `style.css`: görsel tasarım
- `app.js`: uygulama mantığı
- `app.test.js`: test dosyaları
- `README.md`: kullanım ve proje dokümantasyonu

---

## 🔭 Yol Haritası

Gelecek sürüm için değerlendirilen başlıklar:

- OneDrive / SharePoint entegrasyonu
- online Excel yönetimi
- Microsoft Graph üzerinden hücre bazlı kayıt
- kullanıcı girişi
- audit / değişiklik geçmişi

---

## 🤝 Katkı ve Notlar

Bu proje ekip içi verimlilik odaklıdır. Yeni iş kuralları, yeni filtre alanları veya yeni export ihtiyaçları oldukça kolay genişletilebilir şekilde düşünülmüştür.

Eğer projeyi geliştireceksen:

- önce örnek Excel yapısını incele
- kolon eşleme mantığını koru
- veri düzenleme akışındaki state yönetimine dikkat et
- export tarafında workbook bütünlüğünü koruyan yaklaşımı bozma

