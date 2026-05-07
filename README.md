# QA Issue Dashboard

✈️ Turkish Airlines IT Quality ekibi için hazırlanmış, Excel tabanlı QA issue verilerini tarayıcı içinde analiz etmeyi kolaylaştıran hafif bir araçtır.

## 🎯 Ne Yapar?

- `.xlsx`, `.xls` ve `.csv` dosyalarını açar
- `TİP`, `AY` ve `TEST KAYNAKLI` kolonlarını otomatik eşleştirmeye çalışır
- Filtrelenebilir bir dashboard ile özet metrikler sunar
- Kök neden dağılımını grafik, liste ve eksik veri uyarısıyla gösterir
- Belirsiz kayıtları `Veri Düzenleme` ekranında tamamlamayı sağlar
- Güncellenmiş Excel, özet Excel, CSV ve yazdırma/PDF çıktısı üretir

## 🧭 Temel Akış

1. `index.html` dosyasını tarayıcıda açın
2. Excel veya CSV dosyanızı yükleyin
3. Gerekirse kolon eşleşmelerini manuel seçin
4. Filtreleri uygulayıp analizi görüntüleyin
5. `Veri Düzenleme` sekmesinde eksik kayıtları tamamlayın
6. İhtiyaca göre çıktıyı dışa aktarın

## 🛠️ Teknoloji

- Saf `HTML`, `CSS`, `JavaScript`
- Excel okuma/yazma: `SheetJS`
- Grafikler: `Chart.js`
- Testler: `Jest`

## Son Güncellemeler

- Uygulama mantığı `index.html` içinden çıkarılıp tek kaynak olarak `app.js` dosyasına taşındı.
- Dashboard'a `Kök Neden Dağılımı` kartı eklendi.
- Kök nedeni girilmemiş kayıtlar grafik dilimine dahil edilmek yerine ayrı bir uyarı bandında gösteriliyor.
- Uyarı bandındaki `Veri Düzenleme` aksiyonu kullanıcıyı doğrudan düzenleme sekmesine yönlendiriyor.
- Kök neden dağılımı için dış etiketli pasta grafik ve detaylı legend/list görünümü eklendi.
- Yeni grafik veri hazırlama ve entegrasyon kontratı için Jest testleri genişletildi.

## Önerilen Sonraki Özellik

Makul bir sonraki geliştirme olarak `Kök Neden` filtresi eklenebilir. Bu filtre dashboard, ham liste ve dışa aktarma akışında aynı kök neden grubuna odaklanmayı sağlar; özellikle belirli problem türlerinin hangi ay, tip veya sayfada yoğunlaştığını hızlıca incelemek için faydalı olur.

## ▶️ Çalıştırma

Kurulum gerektirmez. Doğrudan `index.html` dosyasını açmanız yeterlidir.

Test çalıştırmak için:

```bash
npm install
npm test
```

## 📁 Dosya Yapısı

```text
issue-analyzer-for-excel/
├── index.html
├── style.css
├── app.js
├── app.test.js
├── package.json
└── README.md
```

## 🔒 Not

Uygulama istemci tarafında çalışır. Düzenlemeler tarayıcıdaki `localStorage` üzerinde tutulur; varsayılan akışta ayrı bir sunucuya veri gönderilmez.
