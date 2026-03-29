# QA Issue Dashboard

✈️ Turkish Airlines IT Quality ekibi için hazırlanmış, Excel tabanlı QA issue verilerini tarayıcı içinde analiz etmeyi kolaylaştıran hafif bir araçtır.

## 🎯 Ne Yapar?

- `.xlsx`, `.xls` ve `.csv` dosyalarını açar
- `TİP`, `AY` ve `TEST KAYNAKLI` kolonlarını otomatik eşleştirmeye çalışır
- Filtrelenebilir bir dashboard ile özet metrikler sunar
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
