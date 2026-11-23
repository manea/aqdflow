# دليل النشر المجاني ($0) والمشاركة الأخلاقية — «عقد فلو | AqdFlow»

يقدّم هذا الدليل مسارَي نشر عمليين بميزانية ابتدائية **\$0** دون رسوم SaaS شهرية، بالإضافة إلى مسودات مشاركة مجتمعية أخلاقية (قيمة حقيقية، بدون سبام أو مبالغات).

---

## المسار أ: النشر الساكن المجاني والآمن تجارياً ($0 — Cloudflare Workers Static Assets)

> **ملاحظة التراخيص التجارية**: يعتمد الاستوديو حصراً على **Cloudflare Workers Static Assets / Pages** للنشر المجاني التجاري الآمن؛ ويُستبعد **Vercel Hobby** (للاستخدام غير التجاري فقط) و**GitHub Pages** (محظور للأغراض التجارية) تماماً.

في هذا الوضع يعمل التطبيق بالكامل عبر المتصفح مع تخزين محلي تلقائي (`localStorage` عبر آلية fallback في `src/lib/api.ts`)، وهو مثالي للنسخة التجريبية العامة أو توليد العروض والفواتير محلياً والطباعة المباشرة `PDF`.

```bash
cd projects/aqdflow
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

ملف التهيئة الجاهز: [`wrangler.jsonc`](../wrangler.jsonc) (`assets.directory = "./dist"`, `not_found_handling = "single-page-application"`).

---

## المسار ب: النشر المتكامل الكامل (Node 22 + SQLite WAL + بوابة العميل `/p/:slug`)

لتفعيل الروابط المشتركة العامة للعملاء (`/p/:slug`)، وتسجيل المشاهدات، وبصمة النطاق من الخادم (`SHA-256 Scope Lock`)، والترقيم الذري غير القابل للتكرار (`INV-YYYY-0001`):

### 1) عبر Docker Compose (خادم شخصي أو VPS اقتصادي)
```bash
cd projects/aqdflow
cp deploy/.env.example .env
# عدّل APP_ORIGIN إلى نطاقك عند توفره
docker compose up -d --build
curl -sf http://127.0.0.1:4179/api/health
```

### 2) عبر Node 22 + systemd + Caddy HTTPS
1. انسخ [`deploy/.env.example`](../deploy/.env.example) إلى مجلد البيانات (مثلاً `~/srv-data/aqdflow/.env`) واضبط `AQDFLOW_DATA_DIR` و`BASE_PATH` (اتركه فارغاً للجذر `/` أو `/aqdflow` للمسار الفرعي) و`APP_ORIGIN`.
2. ابْنِ الواجهة الإنتاجية محلياً أو على الخادم:
   ```bash
   npm ci && npm run build
   ```
3. ثبّت وحدة الخدمة [`deploy/aqdflow.service`](../deploy/aqdflow.service) وربطها خلف [`deploy/Caddyfile`](../deploy/Caddyfile) على المنفذ `4179`.
4. جدوِل النسخ الاحتياطي اليومي الآمن عبر [`deploy/backup-sqlite.sh`](../deploy/backup-sqlite.sh):
   ```bash
   AQDFLOW_DATA_DIR=/path/to/data ./deploy/backup-sqlite.sh
   ```

---

## مسودات المشاركة والتعريف الأخلاقي (Zero-Budget Distribution)

### 1) منشور LinkedIn (عربي — موجه للمستقلين والوكالات في الإمارات والسعودية)
> من أكبر أسباب تأخر تحصيل الدفعات أو نزاعات «التعديلات اللانهائية» بين المستقل/الوكالة والعميل: غياب وضوح المستثنيات من البداية، وفصل خطوة الموافقة عن فاتورة الدفعة الأولى.
>
> بنينا أداة **«عقد فلو | AqdFlow»** مفتوحة المصدر لفرق الخدمات في الإمارات والخليج:
> - عرض أسعار تفاعلي ثنائي اللغة (`AR RTL / EN LTR`) يتيح للعميل اختيار الباقة والإضافات بنفسه.
> - تثبيت نطاق العمل والمستثنيات ببصمة `SHA-256` مع التوقيع الإلكتروني بالرسم أو الكتابة.
> - إصدار فوري لفاتورة الدفعة الأولى القابلة للطباعة مع فحص امتثال **UAE FTA 5%** ورمز **QR لـ ZATCA Phase 1**.
>
> يسعدني سماع ملاحظات المستقلين وأصحاب الاستوديوهات لتطويرها أكثر.

### 2) منشور LinkedIn / X (English — Freelancers & Boutique Studios in UAE/GCC)
> Scope creep usually starts when proposals hide exclusions in fine print and deposit invoicing happens days after verbal approval.
>
> **AqdFlow (عقد فلو)** turns interactive proposals into a 1-step close:
> 1. Share a clean bilingual (`RTL Arabic / LTR English`) proposal link (`/p/:slug`) with tiered pricing and optional add-ons.
> 2. Lock explicit included & excluded deliverables with a `SHA-256` scope digest + e-signature.
> 3. Issue a print-ready A4 deposit invoice with `UAE FTA 5%` validation and `KSA ZATCA Phase 1` SVG QR support.
>
> Lightweight Node 22 + SQLite WAL architecture, `$0` static demo mode supported. Feedback welcome!

### 3) رسالة تعريفية لمجموعات المصممين والمطورين على واتساب (غير مزعجة)
> السلام عليكم يا شباب، شاركنا اليوم أداة مجانية صممناها خصيصاً للمستقلين والوكالات في الخليج اسمها **عقد فلو (AqdFlow)**: تساعدك ترسل عرض سعر تفاعلي بالعربي والإنجليزي، يختار العميل باقته ويوقّع على النطاق والمستثنيات (حتى ما تتكرر التعديلات المجانية)، وتصدر له فاتورة الدفعة الأولى فوراً متوافقة مع ضريبة الإمارات 5% وQR السعودية 15%. من حابب يجربها ويعطينا رأيه لتطوير القوالب يخبرنا.
