# Üniversite Tahliye Sistemi

[English](README.md) · **Türkçe**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/three.js-r169-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![Lisans: AGPL v3](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Sürüm](https://img.shields.io/badge/version-1.0.0-informational.svg)](CHANGELOG.md)

Üniversiteler için gerçek zamanlı iç mekân tahliye yönlendirmesi: 3B kat planı görüntüleyici, canlı rota hesaplama ve gömülebilir widget.

> **Demo** — _Canlı demo GIF / ekran görüntüsü eklenecek:_
> ![Demo placeholder](docs/demo.gif)
> _(`docs/demo.gif` dosyasını tahliye akışının ekran kaydıyla değiştirin.)_

## Öne Çıkanlar

- Three.js / react-three-fiber ile etkileşimli 3B kat planları
- Kapatılmış koridor/kapı desteğiyle A* tahliye rota hesaplaması
- WebSocket (Socket.IO) üzerinden canlı konum ve rota güncellemeleri
- Kat planı yükleyici, waypoint ve çıkış düzenleyicili yönetim paneli
- Üniversitelerin kendi sitelerine canlı harita gömebilmesi için widget
- Çevrimdışı yetenekli service worker ile PWA
- JWT kimlik doğrulama, hız sınırlama, Redis önbellek, HTTP sıkıştırma
- Çoklu dil desteği (paketlenmiş TR + EN)

## Özellik Durumu

| Alan                          | Durum |
|-------------------------------|-------|
| 3B Three.js görüntüleyici     | ✅ |
| 2B yedek harita               | ✅ |
| A* rota servisi               | ✅ |
| Gerçek zamanlı kullanıcı konumu | ✅ |
| Tahliye rota güncellemeleri   | ✅ |
| WebSocket yayınları           | ✅ |
| Yönetim plan yükleyici        | ✅ |
| Waypoint / çıkış düzenleyici  | ✅ |
| Gömülebilir widget            | ✅ |
| PWA + service worker          | ✅ |
| Güvenlik sıkılaştırmaları     | ✅ |
| CI / CD iş akışları           | ✅ |
| Sunucu test süiti (Jest)      | ✅ |
| İstemci test süiti (Vitest)   | ✅ |
| Redis önbellek (5 dk TTL)     | ✅ |
| Yanıt sıkıştırma              | ✅ |
| Tembel yüklenen 3B paketi     | ✅ |
| Uzaklığa dayalı LOD           | ✅ |
| i18n (TR + EN)                | ✅ |

## Hızlı Başlangıç

Docker kuruluysa üç komut yeterli:

```bash
git clone https://github.com/beratyoruk/university-evacuation-system.git
cd university-evacuation-system
docker-compose up -d
```

Bu kadar.

- Arayüz → http://localhost:5173
- API → http://localhost:3001/api
- Sağlık kontrolü → http://localhost:3001/api/health

### Docker olmadan yerel geliştirme

```bash
# Sunucu
cd server && npm install && npm run dev

# İstemci (ayrı terminal)
cd client && npm install && npm run dev
```

### Test süitlerini çalıştırma

```bash
# Sunucu (Jest + Supertest)
cd server && npm test

# İstemci (Vitest + Testing Library)
cd client && npm test
```

### Örnek kat planı üretme

```bash
cd server && npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  ../scripts/generate-sample-plan.ts ../sample-plan.json
```

Hazır bir örnek de projeye dâhildir: **`scripts/sample-floor-plan.json`** — orta
ölçekli bir üniversite katı (6 derslik dahil 10 oda, öğretmen odası, WC'ler, iki
acil çıkış, iki merdiven) ve koridor waypoint grafı. İstemci dev sunucusu bunu
**`/sample-plan.json`** adresinde sunar; doğrudan Kat Planı düzenleyiciye
(Yönetim → Kat Planları) sürükleyip bırakabilirsiniz.

### Yük testi

```bash
# k6 gerekir — https://k6.io
BASE_URL=http://localhost:3001 ./scripts/load-test.sh
```

## Teknoloji Yığını

| Katman     | Teknoloji                                     |
|------------|-----------------------------------------------|
| Ön uç      | React 18, Vite 5, Three.js, @react-three/fiber |
| Durum      | Zustand                                        |
| Stil       | Tailwind CSS                                   |
| Arka uç    | Node.js, Express, TypeScript                   |
| Gerçek zamanlı | Socket.IO                                  |
| Veritabanı | PostgreSQL 15                                  |
| Önbellek   | Redis 7                                        |
| Kimlik doğrulama | JWT + bcrypt                             |
| Test       | Jest, Supertest, Vitest, Testing Library       |
| Konteyner  | Docker & Docker Compose                        |

## Mimari

```
┌──────────────────────────────────────────────────────────────┐
│  İSTEMCİLER                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Web App    │  │ Gömülü Widget│  │  Yönetim Paneli     │  │
│  │  (R3F/PWA)  │  │  (iframe)    │  │  (Plan Düzenleyici) │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼─────────────┘
          ▼                ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│  API GEÇİDİ (Express + Socket.IO :3001)                     │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  REST API  │  │  WebSocket  │  │  Auth / Rate Limit   │  │
│  └──────┬─────┘  └──────┬──────┘  └──────────────────────┘  │
│         ▼               ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Rota Bulma • Konum • Binalar • Waypoint'ler        │   │
│  └──────────────────────────────────────────────────────┘   │
└───────┬────────────────────────────────┬───────────────────┘
        ▼                                ▼
┌──────────────────┐              ┌──────────────────┐
│   PostgreSQL     │              │     Redis        │
│  (kanonik veri   │              │  (önbellek, 5 dk │
│   kaynağı)       │              │   TTL)           │
└──────────────────┘              └──────────────────┘
```

## Dizin Yapısı

```
university-evacuation-system/
├── client/           # React + Vite ön uç (PWA)
│   └── src/
│       ├── components/    # FloorViewer (3B), UI, PlanEditor
│       ├── pages/         # kullanıcı + yönetim ekranları
│       ├── services/      # konum + rota servisleri
│       ├── i18n/          # tr.json, en.json, useTranslation hook
│       ├── store/         # Zustand store'ları
│       └── __tests__/     # Vitest süitleri
├── server/           # Node + Express arka uç
│   └── src/
│       ├── routes/        # REST uç noktaları
│       ├── services/      # rota bulma, konum
│       ├── middleware/    # auth, rate limit, güvenlik
│       ├── db/            # pg pool + Redis önbellek
│       └── __tests__/     # Jest süitleri
├── shared/types/     # İstemci & sunucu arası paylaşılan tipler
├── embed/            # Gömülebilir widget (iframe + widget.js)
├── scripts/          # örnek-plan üreticisi, k6 yük testi
├── docs/             # API.md, DEPLOYMENT.md, INTEGRATION.md
├── docker-compose.yml
└── README.md
```

## API Öne Çıkanları

| Yöntem | Uç Nokta                         | Açıklama                     |
|--------|----------------------------------|------------------------------|
| POST   | `/api/auth/register`             | Yeni kullanıcı kaydı         |
| POST   | `/api/auth/login`                | Giriş yap ve JWT al          |
| GET    | `/api/buildings`                 | Binaları listele             |
| GET    | `/api/floors/:buildingId`        | Bir binadaki katlar          |
| GET    | `/api/floors/detail/:id`         | Kat + çıkışlar + waypoint'ler|
| POST   | `/api/floors/:id/upload-plan`    | Plan yükle (yönetici)        |
| POST   | `/api/location/update`           | Konum güncellemesi gönder    |
| GET    | `/api/location/route`            | Tahliye rotası hesapla       |
| GET    | `/api/embed/*`                   | Widget için herkese açık uçlar|

Tam referans için [docs/API.md](docs/API.md).

## WebSocket Olayları

| Olay                   | Yön             | Açıklama                         |
|------------------------|-----------------|----------------------------------|
| `user:location-update` | İstemci → Sunucu| Kullanıcı konum güncellemesi     |
| `server:route-update`  | Sunucu → İstemci| Rota yeniden hesaplama yayını    |
| `emergency:start`      | Sunucu → İstemci| Acil durum tetiklendi            |
| `emergency:end`        | Sunucu → İstemci| Acil durum sona erdi             |
| `join:building`        | İstemci → Sunucu| Bina yayın odasına katıl         |

## Katkıda Bulunma

Yardım almak isteriz. Kısa kontrol listesi:

1. Depoyu çatallayın ve `main` üzerinden bir dal açın.
2. Bağımlılıkları kurun: hem `server/` hem `client/` içinde `npm install`.
3. Dokunduğunuz dizinde testleri çalıştırın — `npm test` yeşil olmalı.
4. PR'leri odaklı tutun; tek bir özellik/fix başına bir PR.
5. Conventional Commits kullanın (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
6. Herkese açık API değişikliklerinde [docs/API.md](docs/API.md) ve CHANGELOG güncellensin.
7. Neleri test ettiğinizi yazın (mutlu yol + en az bir sınır durumu).

Güvenlik sorunları → lütfen açık issue yerine e-posta gönderin.

## Lisans

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)
