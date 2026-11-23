import type { CurrencyCode, GeneratedInvoice, Locale, Proposal, TaxRegime } from './types.ts';
import { computeProposalTotals } from './taxAndPricing.ts';

export interface ProposalTemplatePreset {
  id: 'web-commerce' | 'brand-identity' | 'saas-mvp' | 'monthly-retainer';
  nameAr: string;
  nameEn: string;
  badgeAr: string;
  badgeEn: string;
  defaultCurrency: CurrencyCode;
  defaultTaxRegime: TaxRegime;
  factory: () => Omit<Proposal, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
}

const DEFAULT_SELLER = {
  nameAr: 'استوديو أفق للحلول الرقمية',
  nameEn: 'Ofoq Digital Studio LLC',
  addressAr: 'أبوظبي، الإمارات العربية المتحدة',
  addressEn: 'Abu Dhabi, United Arab Emirates',
  email: 'hello@ofoq.ae',
  phone: '+971500000000',
  trn: '100000000000003',
  vatRegistered: true,
};

const DEFAULT_CLIENT = {
  nameAr: 'شركة النخبة للتجارة',
  nameEn: 'Al Nukhba Trading Co.',
  addressAr: 'دبي، الإمارات العربية المتحدة',
  addressEn: 'Dubai, United Arab Emirates',
  email: 'client@alnukhba.ae',
  phone: '+971550000000',
  trn: '',
  vatRegistered: false,
};

const DEFAULT_PAYMENT_CHANNELS = {
  iban: 'AE070331234567890123456',
  bankNameAr: 'بنك أبوظبي الأول (FAB)',
  bankNameEn: 'First Abu Dhabi Bank (FAB)',
  aani: '+971500000000',
  stcPay: '',
  instapay: '',
  paymentNoteAr: 'يرجى إرسال إشعار التحويل البنكي أو Aani لتفعيل التنفيذ فوراً.',
  paymentNoteEn: 'Please share the bank transfer or Aani receipt to kick off immediately.',
};

export const PROPOSAL_TEMPLATES: ProposalTemplatePreset[] = [
  {
    id: 'web-commerce',
    nameAr: 'متجر إلكتروني وموقع متكامل',
    nameEn: 'E-Commerce Store & Bilingual Website',
    badgeAr: 'تجارة إلكترونية',
    badgeEn: 'E-Commerce',
    defaultCurrency: 'AED',
    defaultTaxRegime: 'uae_fta_5',
    factory: () => ({
      templateId: 'web-commerce',
      status: 'draft',
      defaultLocale: 'ar',
      currency: 'AED',
      taxRegime: 'uae_fta_5',
      titleAr: 'تصميم وتطوير متجر إلكتروني متكامل ثنائي اللغة',
      titleEn: 'Bilingual E-Commerce Store Design & Development',
      subtitleAr: 'تجربة شراء سريعة تدعم العربية والإنجليزية والدفع الإلكتروني وربط الشحن المحلي.',
      subtitleEn: 'High-conversion RTL/LTR storefront with local UAE checkout & courier setup.',
      seller: { ...DEFAULT_SELLER },
      client: { ...DEFAULT_CLIENT },
      tiers: [
        {
          id: 'tier-essential',
          nameAr: 'الباقة الأساسية',
          nameEn: 'Essential Launch',
          summaryAr: 'متجر منظم جاهز لإطلاق أول 50 منتجاً خلال أسبوعين.',
          summaryEn: 'Clean storefront ready to launch up to 50 SKUs in 2 weeks.',
          price: 5500,
          deliveryDays: 14,
          featuresAr: ['واجهة عربية RTL + إنجليزية LTR', 'ربط بوابة دفع واحدة', 'تجهيز 5 صفحات تعريفية'],
          featuresEn: ['Native RTL Arabic + LTR English UI', 'Single payment gateway integration', '5 core storefront pages'],
        },
        {
          id: 'tier-growth',
          nameAr: 'باقة النمو (موصى بها)',
          nameEn: 'Growth Commerce (Recommended)',
          summaryAr: 'تصميم مخصص كامل مع أتمتة الطلبات وتقارير المبيعات.',
          summaryEn: 'Custom UX with courier automation, analytics, and speed optimization.',
          price: 8900,
          deliveryDays: 21,
          recommended: true,
          featuresAr: [
            'تصميم هوية واجهات مخصص بالكامل',
            'ربط Apple Pay وبوابات الدفع وشركة شحن',
            'تحسين سرعة الأداء وSEO ثنائي اللغة',
          ],
          featuresEn: [
            'Bespoke storefront UX/UI design',
            'Apple Pay, card checkout & courier integration',
            'Core Web Vitals & bilingual SEO optimization',
          ],
        },
        {
          id: 'tier-enterprise',
          nameAr: 'باقة التوسع الكامل',
          nameEn: 'Scale & ERP Sync',
          summaryAr: 'ربط المخزون والمحاسبة مع تطبيق عملاء وتعدد مستودعات.',
          summaryEn: 'Multi-warehouse inventory, accounting sync & custom loyalty rules.',
          price: 14500,
          deliveryDays: 35,
          featuresAr: ['ربط API مع نظام المحاسبة/المخزون', 'لوحة خصومات وولاء مخصصة', 'دعم فني 60 يوماً بعد الإطلاق'],
          featuresEn: ['Accounting & ERP API sync', 'Custom loyalty & tiered discounts', '60-day post-launch SLA support'],
        },
      ],
      selectedTierId: 'tier-growth',
      addons: [
        {
          id: 'addon-copywriting',
          titleAr: 'كتابة وصياغة المحتوى الإعلاني',
          titleEn: 'Bilingual UX Copywriting',
          price: 1200,
          quantity: 1,
          defaultSelected: false,
        },
        {
          id: 'addon-whatsapp-bot',
          titleAr: 'إشعارات الطلبات الفورية عبر واتساب',
          titleEn: 'Automated WhatsApp Order Alerts',
          price: 950,
          quantity: 1,
          defaultSelected: false,
        },
      ],
      selectedAddonIds: [],
      deliverables: [
        {
          id: 'del-ui',
          titleAr: 'تصميم وبرمجة الواجهات المتجاوبة للجوال والكمبيوتر',
          titleEn: 'Responsive mobile & desktop storefront build',
          included: true,
        },
        {
          id: 'del-training',
          titleAr: 'جلسة تدريب مسجلة لإدارة المنتجات والطلبات',
          titleEn: 'Recorded handover & catalog training session',
          included: true,
        },
        {
          id: 'exc-adspend',
          titleAr: 'مستثنى: ميزانيات الإعلانات المدفوعة وتصوير المنتجات الفوتوغرافي',
          titleEn: 'Excluded: Paid ad budgets and physical product studio photography',
          included: false,
        },
      ],
      revisionRounds: 2,
      validityDays: 14,
      depositPercent: 50,
      paymentChannels: { ...DEFAULT_PAYMENT_CHANNELS },
      notesAr: 'أي طلبات إضافية خارج النطاق المعتمد يتم تسعيرها بأمر تغيير مستقل.',
      notesEn: 'Any feature outside the locked scope is billed via a separate change order.',
    }),
  },
  {
    id: 'brand-identity',
    nameAr: 'تصميم الهوية البصرية والدليل الإرشادي',
    nameEn: 'Brand Identity & Guidelines System',
    badgeAr: 'هوية بصرية',
    badgeEn: 'Branding',
    defaultCurrency: 'AED',
    defaultTaxRegime: 'uae_fta_5',
    factory: () => ({
      templateId: 'brand-identity',
      status: 'draft',
      defaultLocale: 'ar',
      currency: 'AED',
      taxRegime: 'uae_fta_5',
      titleAr: 'تطوير الهوية البصرية الكاملة والخط العربي واللاتيني',
      titleEn: 'Complete Bilingual Visual Identity & Brand Book',
      subtitleAr: 'من الشعار والأنماط إلى قوالب العرض ومستندات الشركة الرسمية.',
      subtitleEn: 'From logomark & Arabic/Latin typography to pitch and stationery templates.',
      seller: { ...DEFAULT_SELLER },
      client: { ...DEFAULT_CLIENT },
      tiers: [
        {
          id: 'tier-logo',
          nameAr: 'حزمة التأسيس',
          nameEn: 'Core Identity',
          summaryAr: 'شعار ثنائي اللغة ولوحة ألوان وخطوط معتمدة.',
          summaryEn: 'Primary/secondary marks, palette and typography rules.',
          price: 4200,
          deliveryDays: 10,
          featuresAr: ['مفهومان أوليان للشعار', 'دليل ألوان وخطوط مختصر', 'ملفات المصدر SVG/PDF'],
          featuresEn: ['2 initial logo concepts', 'Mini palette & font guide', 'Vector SVG/PDF source files'],
        },
        {
          id: 'tier-full-brand',
          nameAr: 'الهوية الشاملة (موصى بها)',
          nameEn: 'Full Brand System (Recommended)',
          summaryAr: 'دليل علامة تجارية متكامل + مطبوعات + قوالب تواصل اجتماعي.',
          summaryEn: 'Comprehensive Brand Book, stationery & 12 social media templates.',
          price: 7800,
          deliveryDays: 18,
          recommended: true,
          featuresAr: ['3 اتجاهات إبداعية للشعار', 'دليل استخدام الهوية من 28 صفحة', 'قوالب الفواتير والعروض والتواصل'],
          featuresEn: ['3 creative logo directions', '28-page bilingual Brand Book', 'Stationery & social kit'],
        },
        {
          id: 'tier-launch-kit',
          nameAr: 'هوية + ملف تعريفي + موقع تعريفي',
          nameEn: 'Brand + Company Profile + Landing',
          summaryAr: 'جاهزية إطلاق شاملة للعلامة التجارية رقمياً ومطبوعاً.',
          summaryEn: 'End-to-end brand identity paired with a landing page & company deck.',
          price: 12000,
          deliveryDays: 28,
          featuresAr: ['الهوية الشاملة + ملف الشركة PDF', 'صفحة هبوط تعريفية متجاوبة', 'تعديلات موسعة قبل الاعتماد'],
          featuresEn: ['Full identity + PDF Company Profile', 'Responsive brand landing page', 'Priority polish before sign-off'],
        },
      ],
      selectedTierId: 'tier-full-brand',
      addons: [
        {
          id: 'addon-packaging',
          titleAr: 'تصميم عبوة أو صندوق منتج واحد',
          titleEn: 'Single Product Packaging Dieline',
          price: 1500,
          quantity: 1,
        },
        {
          id: 'addon-deck',
          titleAr: 'قالب عرض استثماري من 12 شريحة',
          titleEn: '12-Slide Investor Pitch Template',
          price: 1800,
          quantity: 1,
        },
      ],
      selectedAddonIds: [],
      deliverables: [
        {
          id: 'del-vectors',
          titleAr: 'تسليم جميع الملفات المتجهة القابلة للطباعة والويب',
          titleEn: 'All print-ready & web vector deliverables (AI/SVG/PDF)',
          included: true,
        },
        {
          id: 'exc-printing',
          titleAr: 'مستثنى: تكاليف الطباعة الفعلية وشراء خطوط مدفوعة ذات ترخيص تجاري خاص',
          titleEn: 'Excluded: Physical printing costs and custom commercial font licensing fees',
          included: false,
        },
      ],
      revisionRounds: 2,
      validityDays: 14,
      depositPercent: 50,
      paymentChannels: { ...DEFAULT_PAYMENT_CHANNELS },
    }),
  },
  {
    id: 'saas-mvp',
    nameAr: 'تطوير منتج SaaS أو تطبيق ويب مخصص',
    nameEn: 'Custom SaaS MVP & Web Application',
    badgeAr: 'تقنية وبرمجة',
    badgeEn: 'SaaS MVP',
    defaultCurrency: 'SAR',
    defaultTaxRegime: 'ksa_zatca_15',
    factory: () => ({
      templateId: 'saas-mvp',
      status: 'draft',
      defaultLocale: 'ar',
      currency: 'SAR',
      taxRegime: 'ksa_zatca_15',
      titleAr: 'بناء النسخة الأولية لمنتج ويب سحابي (MVP)',
      titleEn: 'Cloud Web App MVP Architecture & Build',
      subtitleAr: 'بناء نظيف وقابل للتوسع يشمل المصادقة وقاعدة البيانات ولوحة التحكم.',
      subtitleEn: 'Production-ready MVP with authentication, database, and admin dashboard.',
      seller: {
        nameAr: 'مختبر حلول السحابة التقنية',
        nameEn: 'Sahaba Cloud Solutions Lab',
        addressAr: 'الرياض، المملكة العربية السعودية',
        addressEn: 'Riyadh, Saudi Arabia',
        email: 'billing@sahabalab.sa',
        phone: '+966500000000',
        trn: '300000000000003',
        vatRegistered: true,
      },
      client: {
        nameAr: 'شركة مسار للابتكار',
        nameEn: 'Masar Innovation Co.',
        addressAr: 'جدة، المملكة العربية السعودية',
        addressEn: 'Jeddah, Saudi Arabia',
        email: 'finance@masar.sa',
        phone: '+966550000000',
        trn: '',
        vatRegistered: false,
      },
      tiers: [
        {
          id: 'tier-prototype',
          nameAr: 'نموذج تفاعلي وتدفق مستخدم',
          nameEn: 'Interactive Prototype + Core Flow',
          summaryAr: 'إثبات المفهوم التفاعلي مع قاعدة بيانات أولية.',
          summaryEn: 'Clickable product flow backed by initial data persistence.',
          price: 9000,
          deliveryDays: 14,
          featuresAr: ['تصميم تجربة المستخدم UX/UI', 'بناء التدفق الأساسي للمستخدم', 'استضافة سحابية مهيأة'],
          featuresEn: ['UX/UI system design', 'Core user workflow build', 'Cloud deployment setup'],
        },
        {
          id: 'tier-mvp',
          nameAr: 'المنتج الأولي المتكامل (موصى به)',
          nameEn: 'Full Production MVP (Recommended)',
          summaryAr: 'بناء كامل + اختبارات تلقائية + لوحة تحكم وصلاحيات.',
          summaryEn: 'Complete MVP + automated tests + auth & admin dashboard.',
          price: 18500,
          deliveryDays: 28,
          recommended: true,
          featuresAr: ['مصادقة آمنة ولوحة إدارة', 'اختبارات وحدة واختبارات متصفح E2E', 'نشر وتشغيل ومراقبة أولية'],
          featuresEn: ['Secure auth & admin console', 'Unit & E2E browser test suite', 'Production launch & monitoring'],
        },
        {
          id: 'tier-scale',
          nameAr: 'حزمة الإطلاق والتكاملات',
          nameEn: 'Launch + External Integrations',
          summaryAr: 'ربط بوابات الدفع وإشعارات البريد والرسائل وواجهات API.',
          summaryEn: 'Payment webhooks, notifications & third-party API connectors.',
          price: 29000,
          deliveryDays: 42,
          featuresAr: ['تكامل الدفع وإدارة الاشتراكات', 'إشعارات بريد وواتساب API', 'نقل ملكية الكود والتوثيق الكامل'],
          featuresEn: ['Payment & subscription lifecycle', 'Email/WhatsApp webhooks', 'Full code handover & docs'],
        },
      ],
      selectedTierId: 'tier-mvp',
      addons: [
        {
          id: 'addon-landing',
          titleAr: 'صفحة تسويقية للإطلاق بـ SEO',
          titleEn: 'SEO-Ready Marketing Landing Page',
          price: 2500,
          quantity: 1,
        },
      ],
      selectedAddonIds: [],
      deliverables: [
        {
          id: 'del-repo',
          titleAr: 'تسليم مستودع الكود المصدري Git كاملاً للعميل عند السداد النهائي',
          titleEn: 'Full Git source code handover upon final payment settlement',
          included: true,
        },
        {
          id: 'exc-infra',
          titleAr: 'مستثنى: رسوم الخوادم السحابية والرسائل المدفوعة واشتراكات الطرف الثالث',
          titleEn: 'Excluded: Third-party cloud hosting, SMS credits & external API fees',
          included: false,
        },
      ],
      revisionRounds: 2,
      validityDays: 14,
      depositPercent: 40,
      paymentChannels: {
        iban: 'SA0380000000608010167519',
        bankNameAr: 'مصرف الراجحي',
        bankNameEn: 'Al Rajhi Bank',
        stcPay: '+966500000000',
        paymentNoteAr: 'يتضمن المبلغ 15% ضريبة القيمة المضافة وفق متطلبات هيئة الزكاة والضريبة والجمارك.',
        paymentNoteEn: 'Includes 15% VAT per ZATCA Phase 1 e-invoicing specifications.',
      },
    }),
  },
  {
    id: 'monthly-retainer',
    nameAr: 'عقد صيانة وتطوير وتسويق شهري (Retainer)',
    nameEn: 'Monthly Growth & Engineering Retainer',
    badgeAr: 'اشتراك شهري',
    badgeEn: 'Retainer',
    defaultCurrency: 'AED',
    defaultTaxRegime: 'uae_fta_5',
    factory: () => ({
      templateId: 'monthly-retainer',
      status: 'draft',
      defaultLocale: 'ar',
      currency: 'AED',
      taxRegime: 'uae_fta_5',
      titleAr: 'باقة الرعاية والتطوير الشهري المستمر',
      titleEn: 'Ongoing Monthly Support & Growth Retainer',
      subtitleAr: 'ساعات تطوير مخصصة، صيانة استباقية، وتقارير أداء شهرية واضحة.',
      subtitleEn: 'Dedicated sprint hours, proactive monitoring, and monthly executive reports.',
      seller: { ...DEFAULT_SELLER },
      client: { ...DEFAULT_CLIENT },
      tiers: [
        {
          id: 'tier-care',
          nameAr: 'رعاية وتشغيل (10 ساعات/شهر)',
          nameEn: 'Care Plan (10 hrs/mo)',
          summaryAr: 'تحديثات أمان، نسخ احتياطي، وتعديلات سريعة.',
          summaryEn: 'Security patches, backups, and minor content/UI tweaks.',
          price: 2500,
          deliveryDays: 30,
          featuresAr: ['مراقبة التوافر يومياً', '10 ساعات تطوير وصيانة', 'تقرير إنجاز شهري'],
          featuresEn: ['Daily uptime monitoring', '10 development/maintenance hours', 'Monthly summary report'],
        },
        {
          id: 'tier-partner',
          nameAr: 'شريك النمو (25 ساعة/شهر — موصى بها)',
          nameEn: 'Growth Partner (25 hrs/mo — Recommended)',
          summaryAr: 'تطوير ميزات جديدة أسبوعياً وتحسين مستمر للأداء.',
          summaryEn: 'Weekly feature sprints and conversion optimization.',
          price: 5500,
          deliveryDays: 30,
          recommended: true,
          featuresAr: ['25 ساعة هندسة وتصميم', 'أولوية استجابة خلال 4 ساعات عمل', 'اجتماع مراجعة نصف شهري'],
          featuresEn: ['25 engineering & UX hours', '4-hour business SLA response', 'Bi-weekly strategy sync'],
        },
        {
          id: 'tier-dedicated',
          nameAr: 'فريق مخصص (50 ساعة/شهر)',
          nameEn: 'Dedicated Squad (50 hrs/mo)',
          summaryAr: 'تسريع خريطة الطريق وبناء تكاملات أسبوعية.',
          summaryEn: 'Accelerated roadmap delivery and priority integrations.',
          price: 9800,
          deliveryDays: 30,
          featuresAr: ['50 ساعة عمل شهرية', 'مطور ومصمم مخصصان', 'اختبارات جودة مستمرة قبل كل نشر'],
          featuresEn: ['50 monthly hours', 'Dedicated developer + designer', 'Continuous QA before every release'],
        },
      ],
      selectedTierId: 'tier-partner',
      addons: [
        {
          id: 'addon-weekend-sla',
          titleAr: 'دعم طوارئ عطلة نهاية الأسبوع',
          titleEn: 'Weekend Emergency On-Call SLA',
          price: 1000,
          quantity: 1,
        },
      ],
      selectedAddonIds: [],
      deliverables: [
        {
          id: 'del-report',
          titleAr: 'تقرير ساعات وإنجازات أسبوعي شفاف',
          titleEn: 'Transparent weekly hours & deliverable log',
          included: true,
        },
        {
          id: 'exc-rollover',
          titleAr: 'مستثنى: ترحيل أكثر من 20% من الساعات غير المستخدمة للشهر التالي',
          titleEn: 'Excluded: Rolling over more than 20% of unused hours to the next cycle',
          included: false,
        },
      ],
      revisionRounds: 2,
      validityDays: 10,
      depositPercent: 100,
      paymentChannels: { ...DEFAULT_PAYMENT_CHANNELS, instapay: 'ofoq@instapay' },
    }),
  },
];

export function createProposalFromTemplate(
  templateId: ProposalTemplatePreset['id'],
  overrides: Partial<Proposal> = {},
): Proposal {
  const preset =
    PROPOSAL_TEMPLATES.find((t) => t.id === templateId) ?? PROPOSAL_TEMPLATES[0]!;
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 7);
  const id = overrides.id ?? `prop_${Date.now().toString(36)}_${suffix}`;
  const slug = overrides.slug ?? `${preset.id}-${suffix}`;
  const base = preset.factory();

  return {
    ...base,
    ...overrides,
    id,
    slug,
    seller: { ...base.seller, ...(overrides.seller ?? {}) },
    client: { ...base.client, ...(overrides.client ?? {}) },
    paymentChannels: { ...base.paymentChannels, ...(overrides.paymentChannels ?? {}) },
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function cleanWhatsAppPhone(phone?: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  return digits;
}

export function buildProposalWhatsAppUrl(
  proposal: Proposal,
  portalUrl: string,
  locale: Locale = proposal.defaultLocale,
): string {
  const totals = computeProposalTotals(proposal);
  const clientName =
    locale === 'ar'
      ? proposal.client.nameAr || proposal.client.nameEn
      : proposal.client.nameEn || proposal.client.nameAr;
  const sellerName =
    locale === 'ar'
      ? proposal.seller.nameAr || proposal.seller.nameEn
      : proposal.seller.nameEn || proposal.seller.nameAr;
  const title = locale === 'ar' ? proposal.titleAr : proposal.titleEn;

  const text =
    locale === 'ar'
      ? [
          `السلام عليكم ${clientName}،`,
          `نشارككم عرض السعر التفاعلي لمشروع: *${title}*`,
          `الإجمالي المبدئي: ${totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${proposal.currency} (الدفعة الأولى ${totals.depositPercent}%: ${totals.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${proposal.currency})`,
          `يمكنكم اختيار الباقة واعتماد النطاق والتوقيع مباشرة عبر الرابط:`,
          portalUrl,
          `مع التحية — ${sellerName}`,
        ].join('\n')
      : [
          `Hello ${clientName},`,
          `Here is your interactive proposal for: *${title}*`,
          `Estimated total: ${totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${proposal.currency} (${totals.depositPercent}% deposit: ${totals.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${proposal.currency})`,
          `Select your package, review scope & e-sign directly here:`,
          portalUrl,
          `Best regards — ${sellerName}`,
        ].join('\n');

  const phone = cleanWhatsAppPhone(proposal.client.phone);
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function buildInvoiceWhatsAppUrl(
  proposal: Proposal,
  invoice: GeneratedInvoice,
  locale: Locale = proposal.defaultLocale,
): string {
  const clientName =
    locale === 'ar'
      ? invoice.client.nameAr || invoice.client.nameEn
      : invoice.client.nameEn || invoice.client.nameAr;
  const sellerName =
    locale === 'ar'
      ? invoice.seller.nameAr || invoice.seller.nameEn
      : invoice.seller.nameEn || invoice.seller.nameAr;
  const amountStr = invoice.totalAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const paymentHint = invoice.paymentChannels.iban
    ? `IBAN: ${invoice.paymentChannels.iban}`
    : invoice.paymentChannels.aani
      ? `Aani: ${invoice.paymentChannels.aani}`
      : '';

  const text =
    locale === 'ar'
      ? [
          `مرحباً ${clientName}، شكراً لاعتماد العرض.`,
          `تم إصدار فاتورة الدفعة الأولى رقم *${invoice.invoiceNumber}* بمبلغ *${amountStr} ${invoice.currency}* (شاملة الضريبة).`,
          paymentHint,
          `مع التحية — ${sellerName}`,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `Hello ${clientName}, thank you for approving the scope.`,
          `Deposit invoice *${invoice.invoiceNumber}* for *${amountStr} ${invoice.currency}* (incl. tax) has been issued.`,
          paymentHint,
          `Best regards — ${sellerName}`,
        ]
          .filter(Boolean)
          .join('\n');

  const phone = cleanWhatsAppPhone(invoice.client.phone);
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
