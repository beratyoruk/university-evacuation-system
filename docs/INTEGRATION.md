# Integration Guide — University Evacuation System

> **English** version below. / Türkçe sürüm aşağıdadır.

---

## 🇹🇷 Türkçe — Entegrasyon Kılavuzu

Bu kılavuz, üniversite web sitenize **University Evacuation System** embed widget'ını adım adım entegre etmenizi anlatır.

### 1. Ön Hazırlık

Entegrasyonu tamamlamadan önce sistem yöneticinizden aşağıdaki bilgileri edinmelisiniz:

| Alan | Açıklama | Örnek |
|------|----------|-------|
| Sunucu URL'i | Evacuation server'ın adresi | `https://evac.itu.edu.tr` |
| Üniversite slug | Üniversitenizin sistem kimliği | `itu` |
| Bina kimliği | (Opsiyonel) varsayılan bina | `main` |

### 2. Hızlı Entegrasyon (5 dakika)

**Adım 1.** Yönetici panelinden widget builder'ı açın:

```
https://evac.<sizin-domain>/admin/widget
```

**Adım 2.** Formu doldurun: üniversite, bina, renk, buton metni.

**Adım 3.** “Kodu Kopyala” butonuna tıklayın. Kopyalanan satır şuna benzer:

```html
<script src="https://evac.itu.edu.tr/widget.js"
        data-host="https://evac.itu.edu.tr"
        data-university="itu"
        data-building="main"
        data-color="#16a34a"
        data-label="🚪 Tahliye"
        data-position="bottom-right"></script>
```

**Adım 4.** Kopyaladığınız satırı, sitenizin her sayfasında `</body>` etiketinden hemen önce yapıştırın. WordPress, Drupal veya başka bir CMS kullanıyorsanız genellikle “özel script” / “footer script” alanı vardır.

**Adım 5.** Siteyi yeniden yükleyin. Sağ alt köşede **🚪 Tahliye** butonu görünecektir.

### 3. Parametreler

| `data-*` özniteliği | Gerekli | Varsayılan | Açıklama |
|---|:---:|---|---|
| `university` | ✔ | — | Üniversite slug'ı |
| `building` | — | — | Varsayılan bina |
| `host` | — | script kaynağı | Sunucu origin URL'i |
| `color` | — | `#16a34a` | Buton arka plan rengi |
| `text-color` | — | `#ffffff` | Buton yazı rengi |
| `label` | — | `🚪 Tahliye` | Buton metni |
| `position` | — | `bottom-right` | `bottom-left` / `top-right` / `top-left` |

### 4. CORS İzni Talep Etme

Sistem yöneticisinin, üniversitenizin domain'ini `CORS_ALLOWED_ORIGINS` listesine eklemesi gerekir. Talebi iletirken tüm alt domain'leri belirtin:

```
https://itu.edu.tr
https://www.itu.edu.tr
https://obs.itu.edu.tr
```

### 5. Programatik Kullanım

Widget yüklendikten sonra sayfanızdan JavaScript ile kontrol edebilirsiniz:

```js
UEWidget.open();      // modalı aç
UEWidget.close();     // modalı kapat
UEWidget.config();    // yapılandırmayı oku

window.addEventListener("ue:emergency", (e) => {
  // Acil durum eventi (örn. kampüs-çapı alarm)
  console.log("ALARM!", e.detail);
});
```

### 6. Test Listesi

- [ ] Buton, anasayfada sağ alt köşede görünüyor
- [ ] Mobil cihazda tam ekran açılıyor
- [ ] Konum izni istendiğinde cevap tarayıcıda alınıyor
- [ ] `ESC` tuşu modalı kapatıyor
- [ ] HTTPS sertifikası geçerli (mixed content hatası yok)

### 7. Sorun Giderme

| Sorun | Olası Sebep | Çözüm |
|---|---|---|
| Buton görünmüyor | Script yüklenmedi | DevTools → Network'te `widget.js` 200 mü kontrol edin |
| Modal boş açılıyor | CORS bloke | Yönetici panelinden domain'i whitelist'e ekletin |
| Konum alınmıyor | HTTPS değil | Site HTTPS üzerinden sunulmalıdır |
| 429 hatası | Rate limit | 1 dakika bekleyin, gerekirse ölçeklendirme isteyin |

---

## 🇬🇧 English — Integration Guide

This guide walks you through integrating the **University Evacuation System** embed widget into your university's website.

### 1. Prerequisites

Before you start, obtain these details from your system administrator:

| Field | Description | Example |
|------|-------------|---------|
| Server URL | Evacuation server host | `https://evac.itu.edu.tr` |
| University slug | System identifier for your university | `itu` |
| Building ID | (Optional) default building | `main` |

### 2. Quick Integration (5 min)

**Step 1.** Open the widget builder from the admin panel:

```
https://evac.<your-domain>/admin/widget
```

**Step 2.** Fill in the form: university, building, color, label.

**Step 3.** Click "Copy Code". The copied snippet looks like:

```html
<script src="https://evac.itu.edu.tr/widget.js"
        data-host="https://evac.itu.edu.tr"
        data-university="itu"
        data-building="main"
        data-color="#16a34a"
        data-label="🚪 Tahliye"
        data-position="bottom-right"></script>
```

**Step 4.** Paste the snippet **just before `</body>`** on every page of your site (most CMSes have a "custom script" / "footer script" field).

**Step 5.** Reload the site — a **🚪 Tahliye** button appears in the bottom-right.

### 3. Parameters

| `data-*` attribute | Required | Default | Description |
|---|:---:|---|---|
| `university` | ✔ | — | University slug |
| `building` | — | — | Default building |
| `host` | — | script origin | Server origin URL |
| `color` | — | `#16a34a` | Button background |
| `text-color` | — | `#ffffff` | Button text color |
| `label` | — | `🚪 Tahliye` | Button text |
| `position` | — | `bottom-right` | `bottom-left` / `top-right` / `top-left` |

### 4. Requesting CORS Access

Ask the system administrator to add your domains to the `CORS_ALLOWED_ORIGINS` list:

```
https://itu.edu.tr
https://www.itu.edu.tr
https://obs.itu.edu.tr
```

### 5. Programmatic API

Once loaded, control the widget from your page:

```js
UEWidget.open();      // open modal
UEWidget.close();     // close modal
UEWidget.config();    // read config

window.addEventListener("ue:emergency", (e) => {
  console.log("ALERT!", e.detail);
});
```

### 6. Test Checklist

- [ ] Button renders in the bottom-right on home page
- [ ] Modal goes full-screen on mobile
- [ ] Geolocation prompt appears (HTTPS required)
- [ ] `ESC` closes the modal
- [ ] No mixed-content / TLS warnings

### 7. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Button missing | Script didn't load | DevTools → Network: check `widget.js` is 200 |
| Empty modal | CORS blocked | Add your domain to the server whitelist |
| Geolocation fails | Site not HTTPS | Serve via HTTPS |
| 429 errors | Rate limit | Wait 1 min; request higher quota if needed |

---

📎 See also: [`API.md`](./API.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md).
