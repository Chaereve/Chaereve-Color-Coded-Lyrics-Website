# Chaereve Lyrics — Website lời bài hát màu hóa + thống kê số dòng

> Website **thông tin cộng đồng, chạy hoàn toàn static** (Astro + Tailwind), hiển thị **lời bài hát màu hóa** (mỗi dòng được tô màu theo thành viên hát), kèm **romanization**, **bản dịch**, **credits** và **thanh phân bố số dòng (line distribution)** theo từng thành viên.
>
> **Giao diện (bố cục + kiểu dáng) được dựng theo đúng reference [colorcodedlyrics.com](https://colorcodedlyrics.com/)**: theme sáng, brand + tagline giữa header, menu ngôn ngữ (KOREAN ENGLISH JAPANESE CHINESE OST), trang chủ "Trending Songs" + lưới bài mới, trang bài hát 1 cột giữa (chủ thể → tiêu đề → album/ngày → credits → ảnh vuông + tên TV màu → 3 khối lời Romanization/Hangul/Translation chia bằng gạch ngang → Credits nguồn → More songs by X → Similar Posts → bình luận).

⚠️ **Bản checkout này chứa DỮ LIỆU MẪU (sample data).** Một số bài mẫu dùng tên bài thật để giữ nguyên URL theo spec, nhưng **từng dòng lời trong repo là văn bản giả lập tự viết** (không phải lời bài hát thật). Các nghệ sĩ **LUMI** và **Juna** là hư cấu. Trước khi chạy thật, bạn phải thay bằng nội dung đã được cấp phép — xem [Content Policy](content/pages/content-policy.md).

---

## Tính năng chính

| Khu vực | Đường dẫn | Mô tả |
| --- | --- | --- |
| Trang chủ | `/` | H1 **"Trending Songs"** (ô vuông cover + "ARTIST – Title" + "By author / date / n Comments") + lưới **"Latest Songs"** (cover 400×260 + tiêu đề + danh mục) — đúng bố cục reference |
| Kho lời | `/lyrics/` | Danh sách card ngang (ảnh 400×260 + link danh mục + tiêu đề + excerpt kiểu CCL: tiêu đề/tên gốc/album/đầy đủ ngày YYYY.MM.DD/Lyrics·Composer·Arranger), mới → cũ, phân trang "‹ Newer posts / Older posts ›" (`/page/N/`) |
| Trang bài hát | `/lyrics/[nghệ-sĩ]/[bài-hát]/` | 1 cột giữa, đúng trình tự reference: links danh mục → **tiêu đề lớn** → tên gốc italic → album → ngày `YYYY.MM.DD` → Lyrics/작사 · Composer/작곡 · Arranger/편곡 → **ảnh cover vuông + tên thành viên (màu, ngăn dấu phẩy)** → 3 khối lời **Romanization / Hangul / Translation** (toàn bộ lời, không tabs, chia bằng `<hr>`) → **Credits** (Korean/Rom/Eng/Info) → **Line distribution** (panel mở rộng) → thanh công cụ (Names/Adlibs/cỡ chữ/Copy/YouTube) → **More songs by X** → **Similar Posts** (2 card) → **Comments + Leave a Reply** |
| Phân bố dòng | (trong trang bài) | **Thanh ngang** theo thành viên (không dùng pie chart), nằm trong panel "Line distribution" mở rộng; công tắc **Adlibs** (thống kê loại adlib mặc định), công tắc **Names**, nút cỡ chữ A−/A/A+ |
| Nghệ sĩ (A–Z) | `/artists/`, `/artist/[slug]/` | Hồ sơ, thành viên, danh sách bài (card kiểu archive) |
| Thành viên | `/members/`, `/member/[slug]/` | Tổng số dòng + phân bố theo từng bài |
| Danh mục / thẻ | `/category/[slug]/`, `/tag/[slug]/` | Danh mục = **ngôn ngữ như reference: KOREAN (krn), ENGLISH (eng), JAPANESE (jpn), CHINESE (chn), OST (ost)** + thẻ phụ (girl-group, rap, ballad…) |
| Bản dịch | `/translations/` | Trạng thái `submitted → reviewing → approved/rejected`, luôn có **tên người dịch**; kèm form nộp dịch |
| Báo sửa | `/corrections/` | Trạng thái `open → reviewing → accepted/applied/rejected` — **chỉ sửa JSON sau khi được chấp nhận** |
| Người đóng góp | `/authors/`, `/author/[slug]/` | Vai trò (admin/editor/translator/coder) + bài đã color-coding |
| Tìm kiếm | `/search/` | Index build-time (tên bài/nghệ sĩ/TV/album/lời/dịch), **không phân biệt dấu**, gợi ý, bộ lọc nghệ sĩ/ngôn ngữ/danh mục/năm/thành viên |
| CMS | `/admin/` | Decap CMS, `publish_mode: editorial_workflow` |
| SEO | — | Title/description động, Open Graph, Twitter Card, canonical, JSON-LD (WebSite, MusicRecording, MusicGroup, Person, BreadcrumbList), sitemap, robots, RSS, breadcrumbs, 404 |

**Không dùng database** (không Supabase/Firebase/Mongo/Postgres/MySQL). Bình luận & báo sửa được điều hành qua **GitHub Issues** (D1 chỉ là lựa chọn nâng cấp sau, có ghi chú trong tài liệu on-site).

---

## Kiến trúc

```
┌────────────────────────────────────────────────────────────┐
│  Astro static site (output: "static") → dist/ → Cloudflare │
│  ├── content/        JSON + Markdown (mọi dữ liệu)         │
│  ├── admin/          Decap CMS (CDN) + config template     │
│  ├── src/pages/      routes + endpoints (sitemap, RSS,     │
│  │                   search-index.json, admin/config.yml)  │
│  └── workers/        2 Cloudflare Worker riêng (free tier) │
│       ├── oauth/     proxy GitHub OAuth cho Decap (fallback│
│       │              cho Decap Turbo) — routes /auth,/callback│
│       └── forms/     form public → GitHub Issue + Turnstile│
└────────────────────────────────────────────────────────────┘
```

- **Build**: `npm run build` → thư mục `dist` (yêu cầu Node **≥ 22.23.4**).
- **Không** `@astrojs/cloudflare`, **không** `output: 'server'` — site là static thuần; mỗi PR trên GitHub có một bản preview build đầy đủ từ Cloudflare Pages.

---

## Cấu trúc thư mục

```
├── admin/
│   ├── index.html              # Trang CMS (CDN decap-cms@^3.0.0, có sẵn backend Turbo)
│   ├── config.yml              # Template CMS (khóa Turbo); file DEPLOY được sinh lúc build
│   └── config.d.ts             # Kiểu TS của config (dùng cho scripts kiểm tra)
├── content/                    # ← Decap CMS chỉ sửa vùng này
│   ├── artists/*.json          #   1 file / nghệ sĩ
│   ├── songs/*.json            #   1 file / bài hát
│   ├── categories|tags|authors|translations|corrections|comments/*.json
│   ├── pages/*.md              #   trang nội dung (content policy, guidelines…)
│   └── settings/site.json
├── public/
│   ├── favicon.svg, robots.txt
│   └── uploads/                # ảnh cover (placeholder SVG) + media upload của CMS
├── src/
│   ├── layouts/BaseLayout.astro
│   ├── components/             # Seo, Header, Footer, Lyrics, LyricLine,
│   │   │                       # LineDistribution, SongCard, CommunityForm, …
│   │   └── scripts/            # client JS: song.ts, search.ts, forms.ts
│   ├── lib/                    # types, validate, content loader, distribution,
│   │                           # lyrics (màu/gradient), color (WCAG), seo, search
│   ├── pages/                  # toàn bộ routes + endpoints
│   └── styles/                 # global.css (tokens) + member-colors.generated.css
├── scripts/                    # validate-content, check-cms-config,
│                               # generate-cms-config, generate-covers, generate-member-colors
├── workers/
│   ├── oauth/                  # OAuth proxy (wrangler)
│   └── forms/                  # Form → GitHub Issue (wrangler)
└── .github/                    # CI (check + build) + issue templates
```

---

## Schema dữ liệu JSON

Tất cả quan hệ dùng **ID nội bộ** (không bao giờ dùng tên hiển thị làm khóa):

- `song.artistId` → `artist.id`
- `song.members[].id` → `artist.members[].id` (khách mời = id của nghệ sĩ khác)
- `line.memberIds[]` → `song.members[].id`
- `song.categories[]` / `song.tags[]` / `song.authorId` → id tương ứng

### Artist (`content/artists/*.json`)

```jsonc
{
  "id": "ive",                      // khóa duy nhất toàn site
  "name": "IVE",
  "nativeName": "아이브",
  "romanized": "A-i-ve",
  "slug": "ive",                    // /artist/ive/
  "type": "group",                  // solo | group
  "description": "…",
  "cover": "/uploads/cover-ive.svg",
  "debut": "2021-12-01",
  "label": "…",
  "members": [
    {
      "id": "jisoo",                // ID duy nhất TOÀN SITE (tất cả nghệ sĩ)
      "name": "Jisoo",
      "nativeName": "이지수",
      "romanized": "Lee Jisoo",
      "color": "#b69cff",           // màu dùng cho lời (tự điều chỉnh contrast)
      "officialColor": "#b69cff",   // màu chính thức (tham khảo)
      "colorSource": "official announcement",
      "role": "Rapper",
      "bio": "…"
    }
  ]
}
```

### Song (`content/songs/*.json`)

```jsonc
{
  "id": "ive-crumbs",
  "title": "Crumbs",
  "artistId": "ive",
  "slug": "crumbs",                 // URL: /lyrics/ive/crumbs/
  "status": "published",            // draft | in_review | published
  "released": "2024-12-05",
  "createdAt": "2026-09-02",        // date thêm vào site (mặc định = released)
  "language": "ko",
  "album": "…",
  "categories": ["korean"],         // ngôn ngữ/danh mục: korean|english|japanese|chinese|ost
  "tags": ["girl-group", "rap"],    // tag.id
  "authorId": "team-chaereve",      // người color-coding
  "featured": true,
  "credits": { "lyrics": ["…"], "composition": ["…"], "arrangement": ["…"],
               "translation": ["…"], "romanization": ["…"], "colorCoding": ["…"],
               "source": "…" },
  "members": [ { "id": "jisoo", "name": "Jisoo", "color": "#b69cff" } ],
  "sections": [
    {
      "label": "Chorus",
      "lines": [
        { "memberIds": [],                       // rỗng = All / cả nhóm
          "text": "…", "romanization": "…", "translation": "…",
          "type": "all" },                       // lyric|all|instrumental|spoken|adlib
        { "memberIds": ["haein", "mira"],        // 1 dòng có thể nhiều TV
          "text": "nửa đầu | nửa sau",           // tách theo | (cùng thứ tự ids)
          "type": "lyric" }
      ]
    }
  ],
  "versions": [
    { "id": "live-rooftop-2026", "name": "Live at Rooftop 2026",
      "audioType": "live",                     // studio|live|remix
      "sections": [ /* sections riêng, coding riêng */ ],
      "notes": ["Live coding khác studio: …"] }
  ],
  "notes": ["Color coding basis: studio audio."],
  "sources": ["…"]
}
```

### Quy tắc tính & hiển thị

- **Mỗi thành viên được credit trong một dòng = 1 dòng** của người đó (hát đôi → mỗi người +1).
- `memberIds: []` → dòng **All**, hiển thị màu trung tính, không gán cho TV cụ thể.
- `instrumental` → không vào thống kê; `adlib` → **mặc định LOẠI khỏi thống kê** (có nút bật/tắt).
- **Studio là cơ sở mặc định** cho color coding; bản live/remix phải khai báo explicit trong `versions[]` (sections + coding riêng + notes).
- Text nhiều TV tách bằng `|` đúng thứ tự `memberIds`; nếu không khớp → tự dùng **gradient text** qua màu các TV.
- **Contrast tự động**: màu mỗi TV được làm đậm/sáng riêng cho nền sáng và nền tối để chữ màu đạt **WCAG AA (≥ 4.5:1)** — xem `src/lib/color.ts` và `src/styles/member-colors.generated.css`.
- Build **CẢNH BÁO** (không crash) khi: `memberIds`/`artistId`/`categories`/`tags`/`authorId` không tồn tại, id trùng, slug không hợp lệ, JSON sai…

---

## Chạy local

Yêu cầu: **Node.js ≥ 22.23.4** (test trên 22.23.5).

```bash
npm install
npm run dev          # http://localhost:4321  (dev tự hiện bài draft/in_review)

npm run check        # astro check + validate content + kiểm tra CMS config
npm run build        # build static → dist/
npm run preview      # xem build
```

Lệnh tiện ích:

```bash
npm run validate     # chỉ kiểm tra content (exit ≠ 0 khi có lỗi thật)
npm run check:cms    # kiểm tra admin/config.yml (editorial workflow, collections…)
npm run cms:generate # sinh lại admin/config.yml template (khi thêm nghệ sĩ/thẻ…)
npm run covers       # sinh lại ảnh cover placeholder (SVG)
npm run colors       # sinh lại member-colors.generated.css
npx decap-server     # proxy CMS local (mở http://localhost:8080/admin/)
```

> Lưu ý: mỗi lần đổi **màu thành viên** hoặc **versions có members override**, hãy chạy lại `npm run colors` (dev server tự chạy khi khởi động).

---

## Workflow nội dung (Decap CMS + GitHub)

`admin/config.yml` luôn đặt **`publish_mode: editorial_workflow`**:

1. Người đóng góp sửa nội dung trong CMS → tạo **draft** (hoặc fork + PR nếu dùng open authoring).
2. Draft chuyển **“Ready to review”** → tự mở **pull request**.
3. Cloudflare Pages build **PR preview** — admin kiểm tra đúng trang thay đổi trên bản preview.
4. **Admin review và merge** → build production, nội dung lên site.

→ **Không ai ngoài admin có quyền publish/merge**; bản dịch, báo sửa, bình luận **không bao giờ auto-publish**; báo sửa **không bao giờ tự sửa nội dung**.

### Backend CMS — 2 phương án (cùng 1 codebase)

| | **A. Decap Turbo (mặc định)** | **B. GitHub + OAuth Worker (fallback)** |
| --- | --- | --- |
| Biến môi trường | `CMS_BACKEND=turbo-github`, `CMS_TURBO_SITE_ID=…` | `CMS_BACKEND=github`, `CMS_GITHUB_REPO=…`, `CMS_OAUTH_BASE_URL=…` |
| Đăng nhập | popup “Login with Turbo” | OAuth GitHub qua `workers/oauth` (self-hosted) |
| Contributor | được **mời vào Turbo site** (Free = 1 seat) | **open_authoring: true** — fork repo, mở PR, không cần quyền repo |
| Phù hợp | đơn giản, không chạy worker | nhiều contributor không có tài khoản Turbo |

`/admin/config.yml` được **sinh lúc build** từ các biến trên (function `buildCmsConfig` trong `src/lib/cms-config.ts`); file `admin/config.yml` trong repo là template mặc định (Turbo).

#### B1. Tạo GitHub OAuth App

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**.
2. Homepage: URL site của bạn.
3. **Authorization callback URL**: `https://YOUR_OAUTH_WORKER_DOMAIN/callback`.
4. Ghi lại `Client ID` / `Client Secret`.

#### B2. Deploy OAuth Worker (free)

```bash
cd workers/oauth
npm install
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
# wrangler secret put REDIRECT_URI        # tùy chọn, nếu không dùng <origin>/callback
wrangler deploy                           # → https://chaereve-oauth.<subdomain>.workers.dev
```

Rồi ở repo site đặt:

```
CMS_BACKEND=github
CMS_GITHUB_REPO=YOUR_GITHUB_USERNAME/YOUR_REPO
CMS_BRANCH=main
CMS_OAUTH_BASE_URL=https://YOUR_OAUTH_WORKER_DOMAIN
CMS_OAUTH_AUTH_ENDPOINT=auth
```

#### B3. (Tùy chọn) Form public qua Worker

```bash
cd workers/forms
npm install
wrangler secret put GITHUB_TOKEN          # PAT "Issues: write" cho repo
wrangler secret put GITHUB_REPO
wrangler secret put TURNSTILE_SECRET_KEY
wrangler deploy                           # → https://chaereve-forms.<subdomain>.workers.dev
```

Ở repo site đặt:

```
PUBLIC_FORMS_ENDPOINT=https://YOUR_FORMS_WORKER_DOMAIN
PUBLIC_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

> **Nếu KHÔNG cấu hình form Worker**: mọi form trên site tự động mở trang **“Create new issue” đã điền sẵn** (title/body/labels) — không mất dữ liệu, chỉ bớt tiện. Turnstile tạo miễn phí tại Cloudflare → Turnstile.

---

## Deploy lên Cloudflare Pages — 13 bước

1. **Tạo repo GitHub** cho project (đặt tên tùy ý, ví dụ `chaereve-lyrics`) và đẩy toàn bộ code này lên `main`.
2. **Đăng ký Decap** (mức Free) tại https://decapcms.org, tạo một **site** mới cho project.
3. Trong Decap site → tab **Overview** → copy **`turbo_site_id`** (UUID).
4. Trong Decap site → **Settings → “Admin interface URLs”**: thêm origin của site.
   - Với Cloudflare Pages preview, dùng pattern anchor kiểu `https://*--YOUR_PROJECT.pages.dev/admin/` (chỉ một wildcard `*` đầu tiên; `*.pages.dev` trần bị từ chối).
   - Khi có custom domain, thêm luôn origin đó.
5. **Tạo dự án Cloudflare Pages**: Cloudflare dashboard → Workers & Pages → **Create application → Pages → Connect to Git** → chọn repo ở bước 1.
6. **Cấu hình build**:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: **`22.23.5`** (bắt buộc ≥ 22.23.4)
7. **Thêm environment variables** cho Pages (Production + Preview):
   - `PUBLIC_GITHUB_REPO=YOUR_GITHUB_USERNAME/YOUR_REPO`
   - `SITE_URL=https://YOUR_DOMAIN` (sau khi có domain; khi dùng `*.pages.dev` có thể bỏ trống — `CF_PAGES_URL` được tự nạp)
   - `CMS_BACKEND=turbo-github` + `CMS_TURBO_SITE_ID=<uuid từ bước 3>` *(hoặc bộ biến GitHub ở phần B)*
   - `PUBLIC_FORMS_ENDPOINT`, `PUBLIC_TURNSTILE_SITE_KEY` *(nếu dùng form Worker)*
8. **Build lần đầu** → nhận domain `https://YOUR_PROJECT.pages.dev`.
9. **Mở `/admin/`** trên domain đó → đăng nhập Decap (Turbo hoặc GitHub) → kiểm tra: collections hiện đủ (songs, artists, …), thử tạo 1 draft → “Ready to review” → thấy PR được mở.
10. **(Tùy chọn) Custom domain**: Pages → Custom domains → kết nối `YOUR_DOMAIN`, cập nhật `SITE_URL` ở bước 7 và `Sitemap:` trong `public/robots.txt`, build lại.
11. **Kiểm tra PR preview flow**: mở một PR thay đổi nội dung (qua CMS open authoring hoặc git) → Cloudflare Pages tự build bản preview → admin xem trước trên URL `*.pages.dev` rồi merge.
12. **Deploy 2 Worker** (nếu dùng): `workers/oauth` và/hoặc `workers/forms` theo hướng dẫn ở trên, rồi cập nhật `CMS_OAUTH_BASE_URL` / `PUBLIC_FORMS_ENDPOINT` / `ALLOWED_ORIGIN` cho khớp domain worker.
13. **Thay toàn bộ placeholder** (bảng dưới) + **thay nội dung mẫu bằng nội dung đã cấp phép** → build production cuối.

### Chỗ cần thay (placeholders)

| Placeholder | Ở đâu | Thay bằng |
| --- | --- | --- |
| `YOUR_GITHUB_USERNAME/YOUR_REPO` | `.env.example`, `admin/config.yml`, `public/robots.txt`, mẫu data corrections, docs | repo GitHub thật |
| `YOUR_DOMAIN` | env, docs, robots.txt | domain production |
| `YOUR_TURBO_SITE_ID` | env `CMS_TURBO_SITE_ID` | UUID từ Decap Overview |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | secrets của `workers/oauth` | OAuth App thật |
| `YOUR_OAUTH_WORKER_DOMAIN` | env `CMS_OAUTH_BASE_URL` | domain `workers.dev` của OAuth worker |
| `YOUR_FORMS_WORKER_DOMAIN` | env `PUBLIC_FORMS_ENDPOINT`, `wrangler.toml` [vars] | domain `workers.dev` của forms worker |
| `YOUR_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | env / secrets | khóa Turnstile thật |
| `GITHUB_TOKEN` + `GITHUB_REPO` | secrets của `workers/forms` | PAT + repo thật |
| Cover ảnh + lời mẫu | `content/`, `public/uploads/` | nội dung thật đã cấp phép |

---

## Onboarding người đóng góp (tóm tắt)

1. **Turbo**: được admin mời vào Turbo site với vai trò member (không owner) → đăng nhập CMS bằng tài khoản Turbo.
2. **Open authoring** (backend GitHub): đăng nhập CMS bằng tài khoản GitHub → sửa → fork + PR tự động.
3. Người đóng góp chỉ tạo **draft/PR**; admin duyệt bản preview rồi merge.
4. Quy tắc đóng góp chi tiết (color coding, corrections, translations) nằm ngay trên site: `/pages/contributor-guidelines/`; quy trình duyệt bình luận: `/pages/comment-moderation/`.

---

## Tìm kiếm

- Index **build-time** tại `/search-index.json` (endpoint `src/pages/search-index.json.ts`) gồm: title, nativeTitle, artist, members, album, lyrics, romanization, translation — đã **chuẩn hóa bỏ dấu** (`normalizeText`).
- Client bundle (`src/components/scripts/search.ts`) tải index 1 lần, ghép token kiểu **AND**, chấm điểm theo trường (title > artist > members > album > lyrics > romanization > translation) + bộ lọc artist/language/category/year/member.
- Gợi ý nhanh: các nghệ sĩ & thành viên khớp hiện thành badge phía trên kết quả.

---

## SEO

- Title/description **động theo trang** (`src/components/Seo.astro`), canonical tuyệt đối theo `SITE_URL`.
- Open Graph + Twitter Card (ảnh OG mặc định `/uploads/og-default.svg`, override theo trang).
- JSON-LD: `WebSite` (trang chủ, kèm SearchAction), `MusicRecording` (trang bài), `MusicGroup` (trang nghệ sĩ), `Person` (trang thành viên/author), `BreadcrumbList` (breadcrumbs).
- `sitemap-index.xml` + `sitemap-0.xml` (loại `/admin/` và `/page/1/`), `public/robots.txt`, `/rss.xml` (RSS 2.0 của kho lời), trang 404 thân thiện.

---

## An toàn & nguyên tắc

- **Không có database**, không có secret trong source (chỉ placeholder/env), không service trả phí.
- Form public: **Turnstile** + CORS khóa theo origin + rate bằng bản chất GitHub API (free tier đủ cho cộng đồng nhỏ).
- Email người bình luận **chỉ tồn tại trong issue điều hành**, không bao giờ vào repo/site.
- Nội dung tuân theo [Content Policy](content/pages/content-policy.md): không leak, không nội dung vi phạm bản quyền, bản dịch phải do người thật và được ghi công.

---

## Giấy phép & ràng buộc

Code trong repo này tự do sử dụng theo chính sách bạn chọn (thêm LICENSE khi cần). **Mọi lời bài hát thật thuộc bản quyền của chủ sở hữu** — trước khi public, chỉ tải lên lời có căn cứ hợp pháp và thay toàn bộ placeholder. Website mẫu **không liên kết** với bất kỳ nghệ sĩ/label nào.
