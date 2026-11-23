# سجل التغييرات — «عقد فلو | AqdFlow»

يُوثَّق في هذا الملف كل تغيير برمجي أو معماري في مشروع **«عقد فلو | AqdFlow»** (`projects/aqdflow/`).

---

## [0.5.0] — 2026-11-24 — دعم المسار الفرعي BASE_PATH والاستضافة الإنتاجية والنشر العام
- **دعم الاستضافة المزدوجة على الجذر `/` أو المسار الفرعي (`BASE_PATH=/aqdflow`)**:
  - إنشاء [`src/lib/basePath.ts`](src/lib/basePath.ts) (`getBasePath`, `withBase`, `stripBase`) وتمريره عبر [`src/lib/api.ts`](src/lib/api.ts)، و[`src/App.tsx`](src/App.tsx)، و[`src/components/ProposalEditor.tsx`](src/components/ProposalEditor.tsx)، و[`src/components/TaxInvoiceView.tsx`](src/components/TaxInvoiceView.tsx).
  - تحديث [`server/app.mjs`](server/app.mjs) و[`server/app.d.mts`](server/app.d.mts) و[`server/index.mjs`](server/index.mjs) لدعم `BASE_PATH`، حقن `window.__AQDFLOW_BASE__` وإعادة كتابة مسارات الأصول في HTML عند التفعيل.
  - إضافة اختبار تكامل المسار الفرعي في [`tests/unit/aqdflowServer.test.ts`](tests/unit/aqdflowServer.test.ts) (`5` اختبارات خادم + `6` نواة = **11/11** Vitest، و**3/3** Playwright E2E، و`tsc --noEmit` 0 أخطاء).
  - إعداد قوالب النشر المستقل (`Docker Compose` و`systemd` و`Caddy` و`Cloudflare Workers`) وإطلاق المستودع المفتوح المصدر.

## [0.4.0] — 2026-11-24 — المرحلة 4: اختبارات Playwright E2E وفحص اللقطات البصرية وحزمة النشر $0
- **اختبارات المتصفح الشاملة (`tests/e2e/aqdflow.spec.ts`) وتحسين قابلية الاختبار وتنسيق الجوال**:
  - بناء 3 اختبارات E2E متكاملة عبر Chromium الحقيقي: استمرارية العربية `RTL` / `Alabaster` والإنجليزية `LTR` / `Obsidian` عبر إعادة التحميل؛ دورة **UAE FTA 5%** الكاملة (`> 10,000 د.إ` فاتورة ضريبية كاملة + توقيع كتابي + قفل لا يتكرر عند إعادة التحميل + سجل الفواتير ومسار `/invoice/:number`)؛ ودورة **KSA ZATCA 15%** بالتوقيع المرسوم بالماوس/اللمس مع فحص نقطة `/api/public/invoices/:invoiceNumber/qr.svg` وفحص `scrollWidth <= innerWidth` على الجوال `390x844` لجميع الواجهات.
  - فحص بصري فعلي عبر لقطات Chrome (`01-studio-ar-alabaster.png`, `02-studio-en-obsidian.png`, `03-invoice-ksa-zatca-mobile.png`) وإصلاح تباعد جدول البنود وخانة الإجمالي على شاشة الجوال في [`src/components/TaxInvoiceView.tsx`](src/components/TaxInvoiceView.tsx).
  - مزامنة رقم الإصدار ديناميكياً في [`server/app.mjs`](server/app.mjs) من [`package.json`](package.json) (`0.4.0`)، وإضافة `data-testid` لأزرار نمط التوقيع في [`src/components/SignaturePad.tsx`](src/components/SignaturePad.tsx) وزر العودة في `TaxInvoiceView.tsx`.
- **حزمة النشر المجانية `$0` والتشغيل الإنتاجي**:
  - إضافة [`wrangler.jsonc`](wrangler.jsonc) لـ Cloudflare Workers Static Assets (آمن تجارياً بـ `$0`)، و[`Dockerfile`](Dockerfile) متعدد المراحل (`node:22-alpine` + `src/core` + `node_modules` للإنتاج)، و[`docker-compose.yml`](docker-compose.yml).
  - إضافة قوالب التشغيل الدائم في [`deploy/`](deploy/) (`aqdflow.service`, `Caddyfile`, `.env.example`, `backup-sqlite.sh`)، ودليل التشغيل والمشاركة الأخلاقية [`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md) و[`README.md`](README.md).
- التحقق: `npm run typecheck` (`0`)، `npm test` (**10/10** Vitest)، `npm run build`، و`npm run test:e2e` (**3/3** Playwright E2E) بدون أي أخطاء وحدة تحكم أو صفحة.

## [0.3.0] — 2026-11-24 — المرحلة 3: الواجهة ثنائية اللغة (AR RTL / EN LTR) والفواتير الضريبية القابلة للطباعة
- بناء الواجهة الرسومية الكاملة بـ **React 19 + Tailwind CSS v4** بمظهرين: **Editorial Ink & Warm Alabaster** (النهاري) و**Obsidian Studio** (الداكن) مع تبديل فوري بين العربية (`RTL`) والإنجليزية (`LTR`) وحفظ التفضيلات محلياً:
  - [`src/App.tsx`](src/App.tsx): الموجه العام للواجهات (`/`, `/p/:slug`, `/invoice/:invoiceNumber`) مع لوحة الاستوديو ومشغل القوالب الأربعة السريعة، فلاتر الحالة، سجل الفواتير المجمع، وأزرار التكرار والحذف.
  - [`src/components/ProposalEditor.tsx`](src/components/ProposalEditor.tsx): محرر العروض التفاعلي من 3 تبويبات (الأساسيات والأطراف، الباقات والإضافات والخصم، تثبيت النطاق وقنوات الدفع) مع ملخص مالي لحظي وفاحص امتثال UAE FTA / KSA ZATCA.
  - [`src/components/ClientPortalView.tsx`](src/components/ClientPortalView.tsx): بوابة العميل العامة (`/p/:slug`) لاختيار الباقة والإضافات، استعراض النطاق المشمول والمستثنيات بوضوح، التوقيع بالرسم (`Canvas` عبر [`SignaturePad.tsx`](src/components/SignaturePad.tsx)) أو الكتابة، وتأكيد بصمة النطاق `SHA-256` مع إصدار فاتورة الدفعة الأولى تلقائياً.
  - [`src/components/TaxInvoiceView.tsx`](src/components/TaxInvoiceView.tsx): مستند الفاتورة الضريبية القابل للطباعة (`@media print` A4) مع رمز `SVG QR` (ZATCA Phase 1 TLV) وتصنيف `UAE FTA 5% / KSA ZATCA 15%` وشهادة بصمة النطاق، وزر المشاركة عبر واتساب.
- [`src/lib/i18n.ts`](src/lib/i18n.ts) و[`src/lib/api.ts`](src/lib/api.ts) و[`src/index.css`](src/index.css) و[`index.html`](index.html) و[`public/favicon.svg`](public/favicon.svg).
- التحقق: `npm run typecheck` (`0` أخطاء)، `npm test` (**10/10** اختبارات Vitest)، `npm run build` (`dist/` جاهز)، وفحص التشغيل الحي لخادم الإنتاج مع SPA fallback على المنفذ `4182` (`200 OK`).

## [0.2.0] — 2026-11-23 — المرحلة 2: خادم Node 22 + SQLite WAL وواجهات API وبوابة العميل وSVG QR
- **ما تغيّر**:
  - بناء طبقة التخزين الدائمة في `server/db.mjs` على `node:sqlite` (`WAL` + `synchronous = FULL` + `foreign_keys = ON`) بجداول `proposals` و`approvals` و`invoices` و`invoice_counters` و`audit_events` وحماية القفل بعد الاعتماد (`PROPOSAL_LOCKED`) ومعاملات `BEGIN IMMEDIATE` الذرية للترقيم التسلسلي `INV-YYYY-0001`.
  - بناء خادم HTTP وواجهات API في `server/app.mjs` و`server/app.d.mts` و`server/index.mjs` على المنفذ الافتراضي `4179` مع استيراد مباشر للمحرك الضريبي `src/core/*.ts` وتوليد رمز `SVG QR` الفعلي عبر `qrcode` عند `/api/public/invoices/:invoiceNumber/qr.svg` وتقديم الملفات الساكنة مع حماية اجتياز المسارات وSPA fallback.
- **لماذا**:
  - تمكين حفظ العروض ومشاركتها عبر رابط عميل عام `/p/:slug` وتسجيل المشاهدات وإقفال النطاق على الخادم بـ `SHA-256` وإصدار فواتير ضريبية محصنة ضد التعديل أو التكرار.
- **التحقق**:
  - `npm run typecheck`: `0` أخطاء.
  - `npm test`: **10/10** اختبارات Vitest ناجحة (`6` في `aqdflowCore.test.ts` + `4` في `aqdflowServer.test.ts`).
  - فحص التشغيل الحي لـ `server/index.mjs` على المنفذ المؤقت `4181`: استجابة `200 OK` على `/api/health`.

## [0.1.0] — 2026-11-23 — المرحلة 1: التأسيس والمحرك الضريبي وتثبيت النطاق
- **ما تغيّر**:
  - تأسيس هيكل المشروع (`package.json`، `tsconfig.json`، `vite.config.ts`، `vitest.config.ts`، `playwright.config.ts`).
  - بناء المحرك الأساسي المشترك بين المتصفح وNode 22 داخل `src/core/`:
    - `types.ts`: نماذج البيانات الكاملة للعروض، الباقات، الإضافات، بنود النطاق والمستثنيات، الأطراف، الدفعات، والفواتير الضريبية.
    - `zatca.ts`: ترميز وفك ترميز `ZATCA Phase 1 TLV Base64` بالبايتات الحقيقية (`UTF-8 TextEncoder`) والتحقق من الرقم الضريبي السعودي (15 رقماً يبدأ وينتهي بـ `3`) والإماراتي (`TRN` 15 رقماً).
    - `taxAndPricing.ts`: محرك تسعير الباقات والإضافات والخصومات، احتساب `UAE FTA VAT 5%` (تمييز الفاتورة المبسطة ≤ `10,000` د.إ مقابل الفاتورة الكاملة للعميل المسجل)، بصمة تثبيت النطاق `SHA-256`، وتوليد فاتورة الدفعة الأولى مع رمز QR محسوب على مبالغ الفاتورة نفسها.
    - `templates.ts`: 4 قوالب ثنائية اللغة للسوق الخليجي + مولّد روابط واتساب احترافية `AR/EN`.
- **لماذا**:
  - سد الفجوة السوقية في غياب دعم `RTL` الأصيل والامتثال الضريبي الإماراتي/السعودي لدى أدوات العروض العالمية بتكلفة تشغيل `$0`.
- **التحقق**:
  - `npm run typecheck`: 0 أخطاء.
  - `npm test`: نجاح **6/6** اختبارات وحدة في `tests/unit/aqdflowCore.test.ts`.
