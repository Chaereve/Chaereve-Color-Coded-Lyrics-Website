# Chaereve — Color-Coded Lyrics + Line Distribution

Website xem **lyrics tô màu theo từng thành viên**, **line distribution** (số dòng & phần trăm),
**Original / Romanization / Translation** riêng biệt, tìm kiếm bài hát – nghệ sĩ – thành viên,
với **CMS dựa trên Git (Decap CMS)**, quy trình duyệt bài qua **Pull Request**, và
**Cloudflare Pages** tự động build/deploy.

> **Đây KHÔNG phải demo dở dang.** Project chạy được ngay: `npm install` → `npm run dev`,
> có dữ liệu mẫu (3 bài Demo Song + bài CRUMBS), CMS tại `/admin/`, form correction tạo
> GitHub Issue, và README hướng dẫn deploy từng bước.

---

## Mục lục

1. [Tính năng](#1-tính-năng)
2. [Tech stack](#2-tech-stack)
3. [Cấu trúc repository](#3-cấu-trúc-repository)
4. [Chạy local](#4-chạy-local)
5. [Environment variables](#5-environment-variables)
6. [Schema dữ liệu & quy tắc](#6-schema-dữ-liệu--quy-tắc)
7. [Line distribution — quy tắc tính](#7-line-distribution--quy-tắc-tính)
8. [Trang web & tính năng SEO](#8-trang-web--tính-năng-seo)
9. [Tìm kiếm client-side](#9-tìm-kiếm-client-side)
10. [Decap CMS tại `/admin/`](#10-decap-cms-tại-admin)
11. [Cấu hình đăng nhập GitHub](#11-cấu-hình-đăng-nhập-github)
12. [Quy trình contributor → duyệt → deploy](#12-quy-trình-contributor--duyệt--deploy)
13. [Form correction (GitHub Issue)](#13-form-correction-github-issue)
14. [Deploy lên Cloudflare Pages](#14-deploy-lên-cloudflare-pages)
15. [Chính sách nội dung](#15-chính-sách-nội-dung)
16. [Checklist những chỗ cần thay](#16-checklist-những-chỗ-cần-thay)
17. [Kiểm tra sau khi deploy](#17-kiểm-tra-sau-khi-deploy)

---

## 1. Tính năng

- **Color-coded lyrics**: mỗi dòng là một “thẻ” riêng, có chip màu thành viên, viền trái theo màu,
  nền nhẹ theo màu. Dòng nhiều thành viên hiển thị gradient/border kép.
- **Tabs Original / Romanization / Translation** — sticky trên mobile, scroll ngang được,
  **tăng/giảm cỡ chữ** (16–28px, lưu vào localStorage), **nút Copy** theo tab đang chọn,
  **toggle Hiện adlib**.
- **Line distribution**: thanh stacked bar ngang + danh sách thanh ngang (không dùng pie chart),
  số dòng, phần trăm, sắp xếp giảm dần. Adlib **không** được tính.
- **Trang**: Trang chủ `/`, bài hát `/lyrics/[slug]/`, nghệ sĩ `/artist/[slug]/`,
  thành viên `/member/[slug]/`, tìm kiếm `/search/`, correction `/corrections/`,
  chính sách `/content-policy/`, 404 có gợi ý bài hát ngẫu nhiên.
- **CMS**: Decap CMS tại `/admin/` — tạo/sửa/xoá nghệ sĩ & bài hát ngay trên web,
  color picker cho màu thành viên, list widget cho lyrics line, upload ảnh cover,
  `publish_mode: editorial_workflow` + `open_authoring`.
- **Dữ liệu là JSON trong Git** (`content/artists/*.json`, `content/songs/*.json`) —
  **không database**, không service trả phí.
- **Dark/light mode** (dark mặc định, lưu `localStorage`), mobile-first, accessibility
  (semantic HTML, focus visible, alt ảnh, touch target ≥ 44px, không khoá zoom).
- **SEO**: title/meta description động, canonical, Open Graph, Twitter Card, JSON-LD
  (WebSite, MusicRecording, MusicGroup, BreadcrumbList), `sitemap.xml` lúc build, `robots.txt`.
- **Build kiểm tra dữ liệu**: cảnh báo (không crash) khi `artistId` hoặc `memberIds`
  không khớp dữ liệu nghệ sĩ.

## 2. Tech stack

| Thành phần       | Công nghệ                                          |
| ---------------- | -------------------------------------------------- |
| Framework        | Astro 5 (static output, **không adapter SSR**)     |
| Ngôn ngữ         | TypeScript (strict mode)                           |
| Styling          | Tailwind CSS 3                                     |
| CMS              | Decap CMS (`/admin/`, CDN)                         |
| Lưu trữ nội dung | GitHub repository (file JSON)                      |
| Hosting          | Cloudflare Pages (`npm run build` → `dist/`)       |
| Search           | Chỉ mục tạo lúc build + tìm phía client           |
| OAuth            | Decap Turbo (mặc định) / Cloudflare Worker (tự host) |

> ⚠️ **KHÔNG** cài `@astrojs/cloudflare`, **KHÔNG** `output: 'server'`.
> Build command: `npm run build` · Output directory: `dist`.

## 3. Cấu trúc repository

```
.
├─ astro.config.mjs          # Astro static (site từ PUBLIC_SITE_URL)
├─ package.json
├─ tsconfig.json             # TypeScript strict
├─ tailwind.config.mjs
├─ postcss.config.mjs
├─ README.md
├─ .env.example              # mẫu environment variables
├─ .gitignore
├─ public/
│  ├─ favicon.svg
│  ├─ robots.txt             # ← thay YOUR_DOMAIN ở đây
│  └─ uploads/               # ảnh cover (SVG placeholder local, không hotlink)
├─ src/
│  ├─ layouts/BaseLayout.astro
│  ├─ components/            # Header, Footer, LyricsPanel, Distribution, …
│  ├─ pages/                 # /, /lyrics/[slug], /artist/[slug], /member/[slug],
│  │                         # /search, /corrections, /content-policy, /404, sitemap
│  ├─ lib/                   # content (đọc JSON + validate), distribution, search, seo
│  └─ styles/global.css
├─ content/
│  ├─ artists/               # ive.json, demo-group.json  (mỗi nghệ sĩ 1 file)
│  └─ songs/                 # ive-crumbs.json, demo-song-01…03.json (mỗi bài 1 file)
├─ public/admin/             # ← “admin/” trong sơ đồ cấu trúc (Astro chỉ serve public/)
│  ├─ index.html             # Decap CMS + OAuth relay
│  ├─ config.yml             # cấu hình Decap CMS
│  └─ config.d.ts
├─ .github/ISSUE_TEMPLATE/   # mẫu Issue cho correction
└─ workers/oauth/            # Cloudflare Worker OAuth (phương án tự host)
   ├─ src/index.js
   └─ wrangler.toml          # mẫu (không chứa secret)
```

> **Lưu ý cấu trúc:** Astro static chỉ serve thư mục `public/`, nên `admin/` nằm ở
> `public/admin/` để truy cập được `/admin/` (cả khi dev lẫn khi deploy).

## 4. Chạy local

```bash
npm install        # cài dependencies
npm run dev        # dev server → http://localhost:4321
npm run build      # build static → dist/
npm run preview    # xem trước bản build → http://localhost:4321
```

Kiểm tra type (không bắt buộc nhưng nên chạy trước khi mở PR):

```bash
npx astro check    # 0 errors / 0 warnings
```

## 5. Environment variables

Copy `.env.example` → `.env` (đã có trong `.gitignore`):

| Biến                    | Dùng để làm gì                                        | Ví dụ                                        |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------- |
| `PUBLIC_SITE_URL`       | Canonical URL, OG, sitemap (bắt buộc khi deploy)      | `https://your-project.pages.dev`             |
| `PUBLIC_GITHUB_REPO`    | Nút correction mở GitHub Issue; link repo ở footer    | `your-username/your-repo-name`               |

- Nếu **không set** `PUBLIC_GITHUB_REPO`, project tự suy ra từ `git remote origin` lúc build.
- **Không bao giờ** commit secret vào source. OAuth secret chỉ nằm trong
  Cloudflare Worker secrets (`wrangler secret put`) — xem mục 11.

## 6. Schema dữ liệu & quy tắc

### Artist — `content/artists/<slug>.json`

```json
{
  "id": "ive",
  "name": "IVE",
  "slug": "ive",
  "type": "group",
  "description": "…",
  "cover": "/uploads/ive-cover.svg",
  "members": [
    {
      "id": "gaeul",
      "name": "Gaeul",
      "romanized": "Gaeul",
      "color": "#e05c8a",
      "role": "Main Dancer",
      "officialColor": "#e05c8a",
      "colorSource": ""
    }
  ]
}
```

### Song — `content/songs/<slug>.json`

```json
{
  "id": "song-ive-crumbs",
  "title": "CRUMBS",
  "artistId": "ive",
  "slug": "ive-crumbs",
  "status": "published",
  "released": "2026-11-07",
  "youtube": "https://www.youtube.com/watch?v=demo",
  "cover": "/uploads/ive-crumbs-cover.svg",
  "language": "ko",
  "album": "",
  "credits": {
    "lyrics": [], "composition": [], "arrangement": [],
    "translation": [], "romanization": [], "colorCoding": [],
    "source": ""
  },
  "members": [{ "id": "gaeul", "name": "Gaeul", "color": "#e05c8a" }],
  "sections": [
    {
      "id": "intro",
      "label": "Intro",
      "lines": [
        {
          "id": "line-001",
          "memberIds": ["gaeul"],
          "text": "",
          "romanization": "",
          "translation": "",
          "type": "lyric"
        }
      ]
    }
  ],
  "notes": [],
  "sources": []
}
```

### Quy tắc dữ liệu

- `artistId` phải khớp `artists[].id`.
- `members[].id` là ID duy nhất, lowercase, không dấu, không khoảng trắng —
  **KHÔNG dùng tên hiển thị làm khoá dữ liệu**.
- `memberIds` là mảng string; **rỗng = All/ensemble**; 1 dòng có thể có 0, 1 hoặc nhiều thành viên;
  phải khớp chính xác `members[].id`.
- `type`: `lyric` | `all` | `instrumental` | `spoken` | `adlib`.
- Adlib: **không thêm mặc định**; chỉ thêm khi thực sự cần và phải ghi `notes`.
- Color coding mặc định theo **bản studio**; nếu là live version phải ghi `notes` riêng.
- **Build cảnh báo** (console, không crash) nếu `artistId`/`memberIds` không tồn tại,
  id trùng lặp, hoặc thiếu slug.

## 7. Line distribution — quy tắc tính

- Mỗi lần một `memberId` xuất hiện trong một dòng → +1 dòng cho thành viên đó.
  Dòng có 2 thành viên → **cả hai** đều được +1.
- Dòng `adlib` **không tính** (và bị ẩn cho đến khi người xem bật “Hiện adlib”).
- Dòng không có `memberIds` (all/instrumental) không tính cho thành viên nào
  (hiện riêng ở ô “Dòng All/ensemble”).
- Phần trăm = số dòng của thành viên ÷ tổng số dòng có gán thành viên × 100.
- Số liệu dùng để **tra cứu nội dung**, không dùng để so sánh cạnh tranh
  (có ghi chú ngay trên trang).

## 8. Trang web & tính năng SEO

| Route                 | Mô tả                                                        |
| --------------------- | ------------------------------------------------------------ |
| `/`                   | Hero + search, bài mới nhất, trending, nghệ sĩ, thành viên  |
| `/lyrics/[slug]/`     | Lyrics màu, tabs, distribution, credits, notes, prev/next    |
| `/artist/[slug]/`     | Thành viên + màu, tổng dòng, filter album/năm/ngôn ngữ       |
| `/member/[slug]/`     | Màu thành viên, danh sách bài + số dòng, tổng toàn site      |
| `/search/`            | Tìm client-side (không dấu, không phân biệt hoa thường)      |
| `/corrections/`       | Form gửi correction → GitHub Issue                           |
| `/content-policy/`    | Chính sách nội dung + nút báo cáo                            |
| `/404`                | Thiết kế đẹp, nút về home, gợi ý bài ngẫu nhiên              |
| `/sitemap.xml`        | Tạo lúc build (chỉ bài published + trang tĩnh)               |
| `/robots.txt`         | Trong `public/robots.txt` — **thay `YOUR_DOMAIN`**            |
| `/admin/`             | Decap CMS                                                    |

- Bài có `status` khác `published` vẫn build trang (để admin preview) nhưng gắn
  `noindex` và **không** nằm trong danh sách/sitemap/tìm kiếm.
- Ảnh cover: có `width`/`height` + `aspect-ratio`, `loading="lazy"` → không layout shift.
- Font: dùng system font stack có CJK (Noto Sans KR/JP/SC, Apple SD Gothic Neo…) —
  **không tải font ngoài** → không cần preconnect, tối ưu Core Web Vitals.

## 9. Tìm kiếm client-side

- Chỉ mục được tạo lúc build từ JSON (`src/lib/search.ts`), nhúng vào trang `/search/`.
- Chuẩn hoá: lowercase → bỏ dấu (NFD) → gộp khoảng trắng → tìm AND theo token.
- Tìm theo title, nghệ sĩ, thành viên, album, slug. Không backend, không Algolia/Meilisearch.

## 10. Decap CMS tại `/admin/`

- `public/admin/index.html` nạp Decap CMS từ CDN (`unpkg.com/decap-cms`) — open source, không key.
- `public/admin/config.yml`:
  - `backend: github` + `repo: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` + `open_authoring: true`
  - `publish_mode: editorial_workflow` → lưu nháp tạo **branch + PR**, không commit thẳng `main`
  - `media_folder: public/uploads` / `public_folder: /uploads`
  - Collections **Artists** và **Songs** với: relation chọn nghệ sĩ, **select thành viên cho từng line**,
    color picker, list widget thêm/xoá/sắp xếp line/section, datetime ngày phát hành,
    credits & sources, `preview_path: lyrics/{{slug}}/` (nút xem bài đã đăng).
- **Contributor không có quyền merge vào `main`** — admin review trên GitHub rồi merge
  (không có “tự publish”).

### So với config mẫu, đã bổ sung gì?

Để khớp JSON schema bắt buộc, config có thêm (vẫn hợp lệ YAML):

- `id` cho song, `id` cho section, `id` cho line (schema yêu cầu);
- `album` (schema có trường này);
- `released` format `YYYY-MM-DD` (khớp schema);
- `memberIds` là **select** các ID thành viên (yêu cầu “select member cho từng line”),
  options sinh từ `content/artists/` hiện có — **khi thêm nghệ sĩ mới, thêm ID của họ vào
  options này** (hoặc contributor gõ ID trực tiếp);
- `field:` cho các list credits/notes/sources (mỗi mục một ô nhập, tránh lỗi tách nhầm dấu phẩy);
- `site_url` + `preview_path` cho nút xem live.

## 11. Cấu hình đăng nhập GitHub

Chọn **MỘT** trong hai phương án.

### Phương án A (mặc định): Decap Turbo

1. Đăng ký <https://turbo.decapcms.org/> (có gói miễn phí), tạo Organization → kết nối
   GitHub → tạo Site trỏ tới repo này (config path: `public/admin/config.yml`).
2. Lấy **site id** (UUID ở tab Overview).
3. Sửa `public/admin/config.yml`, thay khối `backend` thành:

   ```yaml
   backend:
     name: turbo-github
     turbo_site_id: <SITE_ID_CỦA_BẠN>
     branch: main
   ```

4. Thêm các **admin interface URL** của site vào Turbo dashboard
   (VD: `https://your-project.pages.dev/admin/`, `http://localhost:4321/admin/`).
5. Mở `/admin/` → **Login with Turbo**.

> Turbo lo phần đăng nhập GitHub + proxy API; editorial workflow và open authoring vẫn chạy.

### Phương án B (thay thế): Cloudflare Worker OAuth tự host

Worker có 2 route: `/auth` (redirect sang GitHub) và `/callback` (đổi `code` → token,
trả về Decap bằng `window.postMessage`). **Không lưu token vào database**; CSRF protection
bằng `state` đã ký HMAC (stateless, hết hạn 10 phút).

#### B1. Tạo GitHub OAuth App

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. Đền:

   | Field                        | Giá trị                                            |
   | ---------------------------- | -------------------------------------------------- |
   | Application name             | Tên tùy ý                                          |
   | Homepage URL                 | `https://YOUR_DOMAIN`                              |
   | **Authorization callback URL** | **`https://YOUR_DOMAIN/admin/`** (bắt buộc)      |

3. Lưu → copy **Client ID** → Generate a **Client Secret**.

#### B2. Deploy Worker

```bash
cd workers/oauth
npx wrangler login            # lần đầu
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put STATE_SECRET        # chuỗi ngẫu nhiên dài (khuyến nghị)
```

- Sửa `wrangler.toml`: `REDIRECT_URI = "https://YOUR_DOMAIN/admin/"`,
  bỏ comment 2 đoạn `[[routes]]` với `pattern = "YOUR_DOMAIN/auth"` và
  `"YOUR_DOMAIN/callback"` (cần domain đã gắn vào zone Cloudflare — xem mục 14).
- `npx wrangler deploy`.
- (Phương án B không cần domain riêng: đặt `REDIRECT_URI = "https://<ten-worker>.workers.dev/callback"`
  và dùng URL worker đó cho `base_url` — callback khi đó là `/callback` thay vì `/admin/`.)

#### B3. Bật trong Decap config

Ở `public/admin/config.yml`, bỏ comment 2 dòng trong khối `backend`:

```yaml
backend:
  name: github
  repo: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
  branch: main
  open_authoring: true
  base_url: "https://YOUR_DOMAIN"   # origin chứa route /auth và /callback
  auth_endpoint: "auth"
```

**Cách hoạt động:** Decap mở popup → `https://YOUR_DOMAIN/auth` → GitHub →
callback `https://YOUR_DOMAIN/admin/?code=…` → script relay trong `public/admin/index.html`
chuyển popup sang `/callback` của Worker → Worker đổi token server-side →
`window.postMessage` trả token cho Decap (đúng hợp thức handshake của Decap/Netlify).

> Secret chỉ nằm trong Worker environment — **không** nằm trong `config.yml`, không trong source web.

## 12. Quy trình contributor → duyệt → deploy

```
Contributor (không có quyền write)
   │  đăng nhập GitHub (Turbo / OAuth) tại /admin/
   ▼
Decap CMS — tạo/sửa entry → Save → "Ready for review"
   │  open_authoring: tự fork repo (nếu chưa có quyền)
   ▼
GitHub Pull Request  (branch cms/<collection>/<slug>)
   │
   ▼
ADMIN review trên GitHub: xem diff, kiểm tra nguồn/credits,
   │  gắn nhãn, comment yêu cầu sửa (contributor push thêm commit vào PR)
   ▼
Admin MERGE Pull Request vào main
   │
   ▼
Cloudflare Pages tự build (npm run build) & deploy → site cập nhật
```

- Chỉ **admin/maintainer** có quyền merge vào `main` (cấu hình repo: Settings → Branches
  hoặc Rulesets: yêu cầu review + chỉ Maintainers được merge — khuyến nghị bật
  **Require pull request before merging**).
- Trạng thái entry trong CMS: Draft → In review → Ready (tương ứng PR đang mở/sẵn sàng).
- Preview deployment: Cloudflare Pages tự tạo bản xem trước cho **mỗi PR** —
  admin có thể xem bài trước khi merge.

## 13. Form correction (GitHub Issue)

- Trang `/corrections/` yêu cầu: đoạn lyrics cần sửa, lý do/bằng chứng, **link nguồn**
  (official audio/MV/lyric video/interview…), liên hệ (tùy chọn).
- Submit → mở GitHub Issue có sẵn nội dung trong repo (nhãn `correction, submitted`).
  Nếu chưa cấu hình `PUBLIC_GITHUB_REPO`, form tự **copy nội dung** để bạn tạo Issue thủ công.
- Trạng thái (gắn nhãn trên Issue): `submitted` → `reviewing` → `approved` / `rejected`.
- **Correction không tự đổi JSON.** Sau khi duyệt, maintainer sửa qua PR → merge → deploy.
- Mẫu Issue: `.github/ISSUE_TEMPLATE/correction.md`.

## 14. Deploy lên Cloudflare Pages

1. **Tạo GitHub repository** riêng (VD: `your-username/chaereve-lyrics`).
2. **Push project lên GitHub:**

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin arena/2f732665-chaereve-color-coded-lyrics-we
   ```

   (Đặt nhánh `main` làm nhánh production nếu bạn gộp nhánh hiện tại vào `main`.)

3. Đăng nhập **Cloudflare Dashboard**.
4. **Workers & Pages → Create → Pages → Connect to Git** → chọn repo vừa push.
5. Framework preset: **Astro** (hoặc để custom).
6. Build command: **`npm run build`**
7. Build output directory: **`dist`**
8. Environment variables (Settings → Environment variables, Production):

   | Key                    | Value                                  |
   | ---------------------- | -------------------------------------- |
   | `PUBLIC_SITE_URL`      | `https://your-project.pages.dev`       |
   | `PUBLIC_GITHUB_REPO`   | `<you>/<repo>`                         |

9. **Deploy** → truy cập `https://your-project.pages.dev/`.
10. Mở `https://your-project.pages.dev/admin/` → đăng nhập (mục 11).
11. Thêm contributor: repo → Settings → Collaborators → Invite (permission **Read**
    là đủ vì `open_authoring` cho họ fork; hoặc **Write** nếu muốn họ push thẳng branch).
12. Test open authoring: contributor vào `/admin/` → tạo draft → **Ready for review** →
    PR tự mở trên GitHub.
13. Test trọn flow: admin merge PR → Cloudflare Pages tự build lại → nội dung mới lên site.
    (PR khác sẽ có **preview deployment** riêng.)

### Kèm theo khi deploy

- Thay `YOUR_DOMAIN` trong `public/robots.txt` (dòng `Sitemap:`) thành domain thật.
- Thay `YOUR_DOMAIN` trong `public/admin/config.yml` (dòng `site_url`) nếu muốn nút “View live”.
- **OAuth Worker (phương án B)** cần domain của site nằm trên cùng zone Cloudflare
  (Custom domain của Pages) để gắn route `YOUR_DOMAIN/auth` và `YOUR_DOMAIN/callback`.
  Các nhánh PR/preview không có route này — đăng nhập CMS chỉ cần trên domain chính
  (hoặc local).

## 15. Chính sách nội dung

Trang `/content-policy/` (có nút “Báo nội dung”) nêu rõ:

1. Không lưu trữ lyrics trái phép — dữ liệu demo là lyrics **giả lập**.
2. Credits nguồn translation bắt buộc; **không dùng auto-translation làm nguồn chính**.
3. Correction cần bằng chứng + link nguồn đối chiếu; có kiểm duyệt.
4. Color coding theo **studio version** (live phải ghi chú riêng).
5. Adlib không được thêm mặc định; background vocal không color-code trùng lặp nếu không cần.
6. Không dùng line distribution để so sánh cạnh tranh / gây fanwar.

## 16. Checklist những chỗ cần thay

| # | Cần thay                              | Ở đâu                                             |
| - | ------------------------------------- | -------------------------------------------------- |
| 1 | **GitHub username + repo name**       | `public/admin/config.yml` → `backend.repo`         |
| 2 | **Domain (PUBLIC_SITE_URL)**          | `.env` / env var trên Cloudflare Pages             |
| 3 | **Domain trong robots.txt**           | `public/robots.txt` → dòng `Sitemap:`              |
| 4 | **Domain trong site_url CMS**         | `public/admin/config.yml` → `site_url`             |
| 5 | **PUBLIC_GITHUB_REPO**                | `.env` / env var trên Cloudflare Pages             |
| 6 | **GitHub OAuth Client ID/Secret**     | Worker secrets (`wrangler secret put`) — phương án B|
| 7 | **REDIRECT_URI**                      | `workers/oauth/wrangler.toml` (=`https://DOMAIN/admin/`) |
| 8 | **Turbo site id**                     | `public/admin/config.yml` — phương án A            |
| 9 | Tên site / tagline                    | `src/lib/config.ts` (`SITE_NAME`, `SITE_TAGLINE`)  |
| 10| Nội dung demo → dữ liệu thật          | `content/artists/*.json`, `content/songs/*.json`   |

**KHÔNG** hardcode username/repo/domain/OAuth credential trong source — mọi giá trị
nhạy cảm dùng environment variable hoặc secret của Worker.

## 17. Kiểm tra sau khi deploy

- [ ] `npm install` · `npm run build` · `npm run preview` không lỗi.
- [ ] Trang chủ hiện bài demo; trang lyrics hiện màu đúng theo thành viên.
- [ ] Line distribution: số dòng + phần trăm đúng; dòng 2 thành viên tính cho cả hai; adlib không tính.
- [ ] Tabs Original/Romanization/Translation sticky, copy theo tab, tăng/giảm cỡ chữ hoạt động.
- [ ] Tìm kiếm không dấu + không phân biệt hoa/thường.
- [ ] Dark/light mode lưu localStorage.
- [ ] `/admin/` load Decap; tạo draft được; lưu nháp tạo PR chứ không commit thẳng `main`.
- [ ] `/corrections/` mở GitHub Issue có sẵn nội dung.
- [ ] `/sitemap.xml`, `robots.txt`, canonical/OG/JSON-LD hiển thị đúng.
- [ ] Dùng DevTools ở 360px / 390px / 414px: không có horizontal scroll, nút ≥ 44px.
- [ ] Console không có lỗi nghiêm trọng.

---

### Ghi chú kỹ thuật

- Project là **Astro static** tuyệt đối: không adapter, không SSR, không database,
  không service trả phí. Nội dung = file JSON trong Git; Cloudflare Pages chỉ serve `dist/`.
- Cảnh báo dữ liệu sai xuất hiện khi build (`[content] ⚠ …`) nhưng **không** làm build fail.
- Lyrics trong repo (bài CRUMBS + 3 Demo Song) đều là **lời giả lập** được viết cho demo,
  không phải lời bài hát thật có bản quyền.
