# 🧠 Cortex Browser

**Multi-AI Orchestration Browser**

Cortex; **ChatGPT, Gemini, DeepSeek ve Claude** yapay zeka modellerini tek bir pencerede birleştirerek, hepsini aynı anda yönetmenizi, yanıtlarını karşılaştırmanızı ve birbirleri arasında veri akışı (zincirleme) sağlamanızı mümkün kılan yeni nesil bir çalışma alanıdır.

<img width="2559" height="1390" alt="image" src="https://github.com/user-attachments/assets/ef4e79ea-b2b0-4751-926a-0290f121dcc2" />

## 🚀 Özellikler

### ⚡ Çoklu Model Desteği (Multi-Model)
ChatGPT, Gemini, DeepSeek ve Claude'u aynı anda, bölünmüş ekranlarda (Split View) kullanın. İhtiyacınız olmayanı tek tıkla kapatın.

### 🎹 Yapay Zeka Orkestrasyonu
Tek bir prompt yazın, **"Gönder"** diyerek aktif olan tüm yapay zekalara aynı anda iletin. Hangi modelin hangi soruya daha iyi cevap verdiğini saniyeler içinde görün.

### 🔗 Neural Link (Zincirleme Sorgu)
Bir yapay zekanın ürettiği çıktıyı, başka bir yapay zekaya **girdi** olarak verin.
*Örnek: "DeepSeek ile araştır, Claude ile özetle, ChatGPT ile formatla."*

### ⚡ Hızlı Komutlar (Slash Commands)
`/` tuşuna basarak hızlı aksiyon menüsünü açın:
- `/fix`: Koddaki hataları bul ve düzelt.
- `/refactor`: Kodu Clean Code prensiplerine göre yeniden yaz.
- `/explain`: Karmaşık kodları basitçe açıkla.
- `/unit-test`: Kod için test senaryoları yaz.

### 📊 Yanıt Karşılaştırma
Seçilen modellerin verdiği yanıtları özel bir pencerede yan yana getirerek doğruluk, hız ve üslup açısından analiz edin.

### 💾 Yerel Geçmiş & Gizlilik
Tüm sohbet geçmişiniz **sadece kendi bilgisayarınızda** (Local Storage) saklanır. Harici bir sunucuya veri gönderilmez.

---

## 🛠️ Kurulum (Geliştirici Modu)

Projeyi bilgisayarınızda geliştirmek veya kaynak koddan çalıştırmak için:

1. **Repoyu Klonlayın**
   ```bash
   git clone [https://github.com/yusufdalmis/cortex-browser.git](https://github.com/yusufdalmis/cortex-browser.git)
   cd cortex-browser
Bağımlılıkları Yükleyin

Bash
npm install
Uygulamayı Başlatın

Bash
npm run dev
(Bu komut hem React sunucusunu hem de Electron penceresini açacaktır.)

📦 Build (EXE Oluşturma)
Kendi .exe dosyanızı oluşturmak isterseniz:

Önceki derlemeleri temizleyin (Opsiyonel)

Bash
rm -rf dist dist-electron release
React ve Electron'u Derleyin

Bash
npm run build
npx tsc -p electron/tsconfig.json
Paketleyin (Windows için)

Bash
npx electron-builder --win
Çıktı dosyası release klasöründe oluşacaktır.

📥 İndir (Releases)
Kurulumla uğraşmak istemiyorsanız, hazır .exe dosyasını Releases sayfasından indirebilirsiniz.

🤝 Katkıda Bulunma
Bu repoyu "Fork"layın.

Yeni bir dal (branch) oluşturun (git checkout -b ozellik/YeniOzellik).

Değişikliklerinizi yapın ve commit'leyin (git commit -m 'Yeni özellik eklendi').

Dalınızı gönderin (git push origin ozellik/YeniOzellik).

Bir "Pull Request" oluşturun.

📄 Lisans
Bu proje MIT License altında lisanslanmıştır.

Yusuf Dalmış tarafından geliştirilmiştir.
