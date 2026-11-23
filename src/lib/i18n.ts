import type {
  CurrencyCode,
  InvoiceClassification,
  Locale,
  ProposalStatus,
  TaxRegime,
} from '../core/types.ts';

export interface CopyBundle {
  brandName: string;
  brandTagline: string;
  navStudio: string;
  navInvoices: string;
  themeAlabaster: string;
  themeObsidian: string;
  langSwitch: string;
  heroTitle: string;
  heroSubtitle: string;
  statTotal: string;
  statSent: string;
  statInvoiced: string;
  statCollected: string;
  quickTemplatesTitle: string;
  quickTemplatesSub: string;
  createFromTemplate: string;
  createBlank: string;
  proposalsListTitle: string;
  filterAll: string;
  filterDraft: string;
  filterSent: string;
  filterInvoiced: string;
  noProposals: string;
  openEditor: string;
  viewPortal: string;
  viewInvoice: string;
  duplicateProposal: string;
  deleteProposal: string;
  backToStudio: string;
  // Editor
  editorTitle: string;
  tabBasics: string;
  tabPackages: string;
  tabScopePayment: string;
  saveDraft: string;
  saving: string;
  saved: string;
  publishAndCopy: string;
  copiedLink: string;
  previewPortal: string;
  sendWhatsApp: string;
  lockedBanner: string;
  cloneToEdit: string;
  proposalTitleAr: string;
  proposalTitleEn: string;
  proposalSubtitleAr: string;
  proposalSubtitleEn: string;
  slugLabel: string;
  currencyLabel: string;
  taxRegimeLabel: string;
  depositPercentLabel: string;
  revisionRoundsLabel: string;
  validityDaysLabel: string;
  sellerCardTitle: string;
  clientCardTitle: string;
  nameArLabel: string;
  nameEnLabel: string;
  addressArLabel: string;
  addressEnLabel: string;
  emailLabel: string;
  phoneLabel: string;
  trnLabel: string;
  vatRegisteredLabel: string;
  tiersSectionTitle: string;
  addTier: string;
  tierPrice: string;
  deliveryDays: string;
  recommendedTier: string;
  featuresArLabel: string;
  featuresEnLabel: string;
  addonsSectionTitle: string;
  addAddon: string;
  quantityLabel: string;
  discountSectionTitle: string;
  discountNone: string;
  discountPercent: string;
  discountFixed: string;
  deliverablesIncludedTitle: string;
  deliverablesExcludedTitle: string;
  addIncludedItem: string;
  addExcludedItem: string;
  paymentChannelsTitle: string;
  ibanLabel: string;
  bankNameArLabel: string;
  bankNameEnLabel: string;
  aaniLabel: string;
  stcPayLabel: string;
  instapayLabel: string;
  paymentNoteArLabel: string;
  paymentNoteEnLabel: string;
  liveSummaryTitle: string;
  complianceTitle: string;
  complianceReady: string;
  // Portal
  portalPreparedFor: string;
  portalFrom: string;
  portalValidity: string;
  portalViews: string;
  choosePackageTitle: string;
  daysUnit: string;
  recommendedBadge: string;
  optionalAddonsTitle: string;
  scopeLockTitle: string;
  scopeIncludedBadge: string;
  scopeExcludedBadge: string;
  revisionCapLabel: string;
  investmentSummaryTitle: string;
  packageSubtotal: string;
  addonsSubtotal: string;
  discountRow: string;
  netBeforeTax: string;
  taxRow: string;
  grandTotalRow: string;
  depositDueNow: string;
  balanceOnDelivery: string;
  approvalFormTitle: string;
  signerNameLabel: string;
  signerTitleLabel: string;
  signerEmailLabel: string;
  signatureModeTyped: string;
  signatureModeDrawn: string;
  clearSignature: string;
  drawSignatureHint: string;
  scopeConfirmText: string;
  approveAndIssueBtn: string;
  approvingBtn: string;
  alreadyApprovedBanner: string;
  poweredBy: string;
  // Invoice
  invoicePageTitle: string;
  invoiceNumberLabel: string;
  issuedAtLabel: string;
  classificationLabel: string;
  sellerLabel: string;
  clientLabel: string;
  trnShort: string;
  itemDescCol: string;
  qtyCol: string;
  netCol: string;
  vatCol: string;
  totalCol: string;
  depositPaidSchedule: string;
  remainingBalanceNote: string;
  zatcaQrTitle: string;
  zatcaQrSubtitle: string;
  copyLabel: string;
  copiedLabel: string;
  scopeCertificateTitle: string;
  scopeDigestLabel: string;
  signedByLabel: string;
  printPdfBtn: string;
  shareInvoiceWaBtn: string;
  notFoundTitle: string;
  notFoundBody: string;
  loadingLabel: string;
  daysSuffix: string;
  roundsSuffix: string;
}

const AR: CopyBundle = {
  brandName: 'عقد فلو | AqdFlow',
  brandTagline: 'عروض الأسعار وتثبيت النطاق والفواتير الضريبية',
  navStudio: 'الاستوديو والعروض',
  navInvoices: 'سجل الفواتير',
  themeAlabaster: 'النهاري',
  themeObsidian: 'الداكن',
  langSwitch: 'English',
  heroTitle: 'أغلق عروضك بوضوح، وثّبت النطاق، وأصدر فاتورة الدفعة الأولى في خطوة واحدة',
  heroSubtitle:
    'صُمم خصيصاً للمستقلين والوكالات في الإمارات والخليج: RTL/LTR أصيل، تثبيت بصمة SHA-256 ضد التعديلات المجانية، وامتثال ضريبي UAE FTA 5% وZATCA Phase 1 QR.',
  statTotal: 'إجمالي العروض',
  statSent: 'بانتظار التوقيع',
  statInvoiced: 'معتمدة ومفوترة',
  statCollected: 'دفعات أولى مصدرة',
  quickTemplatesTitle: 'ابدأ من قالب احترافي جاهز',
  quickTemplatesSub: 'اختر قالباً ثنائي اللغة لتوليد مسودة متكاملة بالباقات والمستثنيات في ثوانٍ.',
  createFromTemplate: 'إنشاء عرض من القالب',
  createBlank: 'عرض سريع جديد',
  proposalsListTitle: 'عروض الأسعار',
  filterAll: 'الكل',
  filterDraft: 'مسودة',
  filterSent: 'مرسل للعميل',
  filterInvoiced: 'معتمد ومفوتر',
  noProposals: 'لا توجد عروض مطابقة حالياً — ابدأ بإنشاء عرض من أحد القوالب أعلاه.',
  openEditor: 'تحرير / عرض',
  viewPortal: 'بوابة العميل',
  viewInvoice: 'الفاتورة الضريبية',
  duplicateProposal: 'استنساخ لمسودة',
  deleteProposal: 'حذف',
  backToStudio: 'العودة للاستوديو',
  editorTitle: 'محرر العرض التفاعلي',
  tabBasics: '1. الأساسيات والأطراف',
  tabPackages: '2. الباقات والإضافات والخصم',
  tabScopePayment: '3. تثبيت النطاق وقنوات الدفع',
  saveDraft: 'حفظ التعديلات',
  saving: 'جارٍ الحفظ...',
  saved: 'تم الحفظ',
  publishAndCopy: 'نشر ونسخ رابط العميل',
  copiedLink: 'تم نسخ رابط العميل',
  previewPortal: 'معاينة بوابة العميل',
  sendWhatsApp: 'إرسال عبر واتساب',
  lockedBanner:
    'هذا العرض معتمد ومقفل ببصمة SHA-256 لحماية الطرفين. للتعديل يمكنك استنساخه إلى مسودة جديدة.',
  cloneToEdit: 'استنساخ لمسودة جديدة',
  proposalTitleAr: 'عنوان العرض (عربي)',
  proposalTitleEn: 'Proposal Title (English)',
  proposalSubtitleAr: 'ملخص التنفيذ (عربي)',
  proposalSubtitleEn: 'Executive Summary (English)',
  slugLabel: 'الرابط المختصر (Slug)',
  currencyLabel: 'العملة',
  taxRegimeLabel: 'النظام الضريبي',
  depositPercentLabel: 'نسبة الدفعة الأولى (%)',
  revisionRoundsLabel: 'عدد جولات التعديل المشمولة',
  validityDaysLabel: 'صلاحية العرض (أيام)',
  sellerCardTitle: 'بيانات المورّد (أنت / شركتك)',
  clientCardTitle: 'بيانات العميل',
  nameArLabel: 'الاسم بالعربية',
  nameEnLabel: 'Name in English',
  addressArLabel: 'العنوان بالعربية',
  addressEnLabel: 'Address in English',
  emailLabel: 'البريد الإلكتروني',
  phoneLabel: 'رقم الهاتف / واتساب',
  trnLabel: 'الرقم الضريبي (TRN / VAT 15 رقماً)',
  vatRegisteredLabel: 'العميل مسجل ضريبياً (B2B VAT Registered)',
  tiersSectionTitle: 'الباقات التفاعلية للعميل',
  addTier: 'إضافة باقة',
  tierPrice: 'السعر',
  deliveryDays: 'مدة التسليم (يوم)',
  recommendedTier: 'باقة موصى بها',
  featuresArLabel: 'مزايا الباقة (عربي — سطر لكل ميزة)',
  featuresEnLabel: 'Tier Features (English — one per line)',
  addonsSectionTitle: 'الإضافات الاختيارية',
  addAddon: 'إضافة بند اختياري',
  quantityLabel: 'الكمية',
  discountSectionTitle: 'الخصم التجاري',
  discountNone: 'بدون خصم',
  discountPercent: 'نسبة مئوية (%)',
  discountFixed: 'مبلغ ثابت',
  deliverablesIncludedTitle: 'ضمن نطاق العمل المشمول (Included Scope)',
  deliverablesExcludedTitle: 'خارج النطاق ومستثنى صراحةً (Explicit Exclusions)',
  addIncludedItem: 'إضافة بند مشمول',
  addExcludedItem: 'إضافة استثناء صريح',
  paymentChannelsTitle: 'قنوات التحويل والدفع المحلية',
  ibanLabel: 'رقم الآيبان (IBAN)',
  bankNameArLabel: 'اسم البنك (عربي)',
  bankNameEnLabel: 'Bank Name (English)',
  aaniLabel: 'تحويل Aani الفوري (الإمارات)',
  stcPayLabel: 'STC Pay (السعودية)',
  instapayLabel: 'InstaPay (مصر)',
  paymentNoteArLabel: 'ملاحظة الدفع (عربي)',
  paymentNoteEnLabel: 'Payment Note (English)',
  liveSummaryTitle: 'الملخص المالي الحي',
  complianceTitle: 'فاحص الامتثال الضريبي',
  complianceReady: 'البيانات الضريبية مكتملة ومتوافقة مع المعيار المختار.',
  portalPreparedFor: 'عرض سعر مخصّص لـ',
  portalFrom: 'مقدّم من',
  portalValidity: 'صالح لمدة',
  portalViews: 'المشاهدات',
  choosePackageTitle: 'اختر الباقة الأنسب لمشروعك',
  daysUnit: 'يوم تسليم',
  recommendedBadge: 'الخيار الموصى به',
  optionalAddonsTitle: 'إضافات اختيارية لتوسيع النتيجة',
  scopeLockTitle: 'ميثاق نطاق العمل وتثبيت الحدود (Scope Lock)',
  scopeIncludedBadge: 'مشمول في التنفيذ',
  scopeExcludedBadge: 'مستثنى صراحةً',
  revisionCapLabel: 'سقف جولات التعديل المعتمدة',
  investmentSummaryTitle: 'ملخص الاستثمار والدفعة الأولى',
  packageSubtotal: 'الباقة المختارة',
  addonsSubtotal: 'الإضافات الاختيارية',
  discountRow: 'الخصم',
  netBeforeTax: 'الصافي الخاضع للضريبة',
  taxRow: 'ضريبة القيمة المضافة',
  grandTotalRow: 'الإجمالي الكلي للمشروع',
  depositDueNow: 'الدفعة الأولى المستحقة عند الاعتماد',
  balanceOnDelivery: 'الرصيد المتبقي لاحقاً',
  approvalFormTitle: 'اعتماد النطاق والتوقيع الإلكتروني',
  signerNameLabel: 'الاسم الكامل للمفوّض بالتوقيع *',
  signerTitleLabel: 'المسمى الوظيفي (اختياري)',
  signerEmailLabel: 'البريد الإلكتروني (اختياري)',
  signatureModeTyped: 'توقيع مكتوب',
  signatureModeDrawn: 'توقيع مرسوم باليد',
  clearSignature: 'مسح التوقيع',
  drawSignatureHint: 'وقّع هنا بإصبعك أو بالفأرة',
  scopeConfirmText:
    'أقر بمراجعة الباقة المختارة وبنود نطاق العمل والمستثنيات وحدّ جولات التعديل، وأوافق على تثبيت هذا النطاق وإصدار فاتورة الدفعة الأولى.',
  approveAndIssueBtn: 'اعتماد العرض وإصدار الفاتورة الضريبية',
  approvingBtn: 'جارٍ التثبيت والإصدار...',
  alreadyApprovedBanner: 'تم اعتماد هذا العرض وتثبيت نطاقه وإصدار فاتورة الدفعة الأولى.',
  poweredBy: 'أُنشئ عبر عقد فلو | AqdFlow — بوابة العروض والفواتير العربية',
  invoicePageTitle: 'مستند ضريبي وشهادة اعتماد النطاق',
  invoiceNumberLabel: 'رقم الفاتورة',
  issuedAtLabel: 'تاريخ الإصدار',
  classificationLabel: 'التصنيف الضريبي',
  sellerLabel: 'المورّد (Seller)',
  clientLabel: 'العميل (Buyer / Client)',
  trnShort: 'الرقم الضريبي',
  itemDescCol: 'الوصف والبيان',
  qtyCol: 'الكمية',
  netCol: 'الصافي',
  vatCol: 'الضريبة',
  totalCol: 'الإجمالي',
  depositPaidSchedule: 'استحقاق الدفعة الأولى',
  remainingBalanceNote: 'الرصيد المتبقي حسب التقدم/التسليم',
  zatcaQrTitle: 'رمز الاستجابة السريعة للفوترة الإلكترونية (ZATCA Phase 1)',
  zatcaQrSubtitle: 'مشفر بصيغة TLV UTF-8 Base64 بالوسوم الخمسة القياسية',
  copyLabel: 'نسخ',
  copiedLabel: 'نُسخ',
  scopeCertificateTitle: 'شهادة تثبيت نطاق العمل (SHA-256 Scope Lock)',
  scopeDigestLabel: 'البصمة التوثيقية (SHA-256)',
  signedByLabel: 'موقّع من قِبل',
  printPdfBtn: 'طباعة / حفظ PDF',
  shareInvoiceWaBtn: 'إرسال الفاتورة عبر واتساب',
  notFoundTitle: 'تعذّر العثور على المستند',
  notFoundBody: 'تأكد من نشر العرض أولاً من الاستوديو أو صحة الرابط المختصر.',
  loadingLabel: 'جارٍ التحميل...',
  daysSuffix: 'يوماً',
  roundsSuffix: 'جولات',
};

const EN: CopyBundle = {
  brandName: 'AqdFlow | عقد فلو',
  brandTagline: 'Interactive Proposals, Scope Lock & Tax Invoices',
  navStudio: 'Studio & Proposals',
  navInvoices: 'Invoices Ledger',
  themeAlabaster: 'Light',
  themeObsidian: 'Dark',
  langSwitch: 'العربية',
  heroTitle: 'Close client scopes clearly, lock deliverables, and issue compliant deposit invoices',
  heroSubtitle:
    'Built for UAE & GCC freelancers and agencies: native RTL/LTR layouts, SHA-256 scope lock against scope creep, UAE FTA 5% VAT & KSA ZATCA Phase 1 QR compliance.',
  statTotal: 'Total Proposals',
  statSent: 'Awaiting Signature',
  statInvoiced: 'Locked & Invoiced',
  statCollected: 'Deposit Invoices Issued',
  quickTemplatesTitle: 'Start from a ready GCC template',
  quickTemplatesSub: 'Pick a bilingual preset to spin up packages, exclusions, and VAT rules in seconds.',
  createFromTemplate: 'Use Template',
  createBlank: 'New Blank Proposal',
  proposalsListTitle: 'Proposals',
  filterAll: 'All',
  filterDraft: 'Draft',
  filterSent: 'Sent',
  filterInvoiced: 'Approved & Invoiced',
  noProposals: 'No matching proposals yet — create one from any preset above.',
  openEditor: 'Edit / Inspect',
  viewPortal: 'Client Portal',
  viewInvoice: 'Tax Invoice',
  duplicateProposal: 'Duplicate to Draft',
  deleteProposal: 'Delete',
  backToStudio: 'Back to Studio',
  editorTitle: 'Interactive Proposal Editor',
  tabBasics: '1. Basics & Parties',
  tabPackages: '2. Tiers, Add-ons & Discount',
  tabScopePayment: '3. Scope Lock & Payments',
  saveDraft: 'Save Changes',
  saving: 'Saving...',
  saved: 'Saved',
  publishAndCopy: 'Publish & Copy Client Link',
  copiedLink: 'Client Link Copied',
  previewPortal: 'Open Client Portal',
  sendWhatsApp: 'Send via WhatsApp',
  lockedBanner:
    'This proposal is signed and SHA-256 scope-locked. Clone it into a new draft if you want to make edits.',
  cloneToEdit: 'Clone to New Draft',
  proposalTitleAr: 'Proposal Title (Arabic)',
  proposalTitleEn: 'Proposal Title (English)',
  proposalSubtitleAr: 'Executive Summary (Arabic)',
  proposalSubtitleEn: 'Executive Summary (English)',
  slugLabel: 'Public Slug',
  currencyLabel: 'Currency',
  taxRegimeLabel: 'Tax Regime',
  depositPercentLabel: 'Deposit (%)',
  revisionRoundsLabel: 'Included Revision Rounds',
  validityDaysLabel: 'Validity (Days)',
  sellerCardTitle: 'Supplier / Seller Info',
  clientCardTitle: 'Client Info',
  nameArLabel: 'Name (Arabic)',
  nameEnLabel: 'Name (English)',
  addressArLabel: 'Address (Arabic)',
  addressEnLabel: 'Address (English)',
  emailLabel: 'Email',
  phoneLabel: 'Phone / WhatsApp',
  trnLabel: 'Tax Registration No. (15-digit TRN / VAT)',
  vatRegisteredLabel: 'Client is VAT-registered (B2B)',
  tiersSectionTitle: 'Client Pricing Tiers',
  addTier: 'Add Tier',
  tierPrice: 'Price',
  deliveryDays: 'Delivery (Days)',
  recommendedTier: 'Recommended tier',
  featuresArLabel: 'Features (Arabic — one per line)',
  featuresEnLabel: 'Features (English — one per line)',
  addonsSectionTitle: 'Optional Add-ons',
  addAddon: 'Add Optional Item',
  quantityLabel: 'Qty',
  discountSectionTitle: 'Commercial Discount',
  discountNone: 'No Discount',
  discountPercent: 'Percentage (%)',
  discountFixed: 'Fixed Amount',
  deliverablesIncludedTitle: 'Included Deliverables',
  deliverablesExcludedTitle: 'Explicit Exclusions (Anti-Scope-Creep)',
  addIncludedItem: 'Add Deliverable',
  addExcludedItem: 'Add Exclusion',
  paymentChannelsTitle: 'Regional Payment Channels',
  ibanLabel: 'IBAN',
  bankNameArLabel: 'Bank Name (Arabic)',
  bankNameEnLabel: 'Bank Name (English)',
  aaniLabel: 'UAE Aani Instant Pay',
  stcPayLabel: 'STC Pay (KSA)',
  instapayLabel: 'InstaPay (Egypt)',
  paymentNoteArLabel: 'Payment Note (Arabic)',
  paymentNoteEnLabel: 'Payment Note (English)',
  liveSummaryTitle: 'Live Financial Breakdown',
  complianceTitle: 'Tax Compliance Inspector',
  complianceReady: 'All mandatory tax fields look complete for the selected regime.',
  portalPreparedFor: 'Prepared exclusively for',
  portalFrom: 'Presented by',
  portalValidity: 'Valid for',
  portalViews: 'Views',
  choosePackageTitle: 'Select your preferred package',
  daysUnit: 'days delivery',
  recommendedBadge: 'Recommended',
  optionalAddonsTitle: 'Optional add-ons',
  scopeLockTitle: 'Scope Boundary & Exclusions (Scope Lock)',
  scopeIncludedBadge: 'Included',
  scopeExcludedBadge: 'Excluded',
  revisionCapLabel: 'Included revision rounds',
  investmentSummaryTitle: 'Investment & Deposit Summary',
  packageSubtotal: 'Selected Package',
  addonsSubtotal: 'Selected Add-ons',
  discountRow: 'Discount',
  netBeforeTax: 'Taxable Subtotal',
  taxRow: 'VAT',
  grandTotalRow: 'Project Total',
  depositDueNow: 'Deposit Due on Approval',
  balanceOnDelivery: 'Remaining Balance',
  approvalFormTitle: 'Approve Scope & E-Sign',
  signerNameLabel: 'Authorized Signer Full Name *',
  signerTitleLabel: 'Title / Role (Optional)',
  signerEmailLabel: 'Email (Optional)',
  signatureModeTyped: 'Typed Signature',
  signatureModeDrawn: 'Hand-Drawn Canvas',
  clearSignature: 'Clear',
  drawSignatureHint: 'Draw signature using mouse or finger',
  scopeConfirmText:
    'I have reviewed the selected package, included deliverables, explicit exclusions, and revision cap, and authorize locking this scope and issuing the deposit invoice.',
  approveAndIssueBtn: 'Approve Scope & Issue Tax Invoice',
  approvingBtn: 'Locking Scope & Issuing...',
  alreadyApprovedBanner: 'This proposal has been approved, scope-locked, and invoiced.',
  poweredBy: 'Powered by AqdFlow | عقد فلو — Bilingual GCC Proposals & Invoices',
  invoicePageTitle: 'Tax Document & Scope Lock Certificate',
  invoiceNumberLabel: 'Invoice No.',
  issuedAtLabel: 'Issue Date',
  classificationLabel: 'Tax Classification',
  sellerLabel: 'Supplier / Seller',
  clientLabel: 'Client / Buyer',
  trnShort: 'TRN / VAT No.',
  itemDescCol: 'Description',
  qtyCol: 'Qty',
  netCol: 'Net',
  vatCol: 'VAT',
  totalCol: 'Total',
  depositPaidSchedule: 'Deposit Invoice Due',
  remainingBalanceNote: 'Remaining contract balance',
  zatcaQrTitle: 'ZATCA Phase 1 E-Invoicing QR Code',
  zatcaQrSubtitle: 'Encoded with standard 5-tag UTF-8 TLV Base64 specification',
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  scopeCertificateTitle: 'Scope Lock Audit Certificate (SHA-256)',
  scopeDigestLabel: 'Cryptographic Digest',
  signedByLabel: 'Signed by',
  printPdfBtn: 'Print / Save PDF',
  shareInvoiceWaBtn: 'Share Invoice via WhatsApp',
  notFoundTitle: 'Document not found',
  notFoundBody: 'Ensure the proposal is published from the studio or verify the URL slug.',
  loadingLabel: 'Loading...',
  daysSuffix: 'days',
  roundsSuffix: 'rounds',
};

export function getCopy(locale: Locale): CopyBundle {
  return locale === 'en' ? EN : AR;
}

export function formatMoney(amount: number, currency: CurrencyCode, locale: Locale): string {
  const num = Number.isFinite(amount) ? amount : 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (locale === 'ar' && currency === 'AED') return `${formatted} د.إ`;
  if (locale === 'ar' && currency === 'SAR') return `${formatted} ر.س`;
  return `${formatted} ${currency}`;
}

export function formatShortDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function statusLabel(status: ProposalStatus, locale: Locale): string {
  const map: Record<ProposalStatus, { ar: string; en: string }> = {
    draft: { ar: 'مسودة', en: 'Draft' },
    sent: { ar: 'مرسل للعميل', en: 'Sent' },
    approved: { ar: 'معتمد', en: 'Approved' },
    invoiced: { ar: 'معتمد ومفوتر', en: 'Invoiced' },
  };
  return map[status][locale];
}

export function taxRegimeLabel(regime: TaxRegime, locale: Locale): string {
  const map: Record<TaxRegime, { ar: string; en: string }> = {
    none: { ar: 'بدون ضريبة (0%)', en: 'No VAT (0%)' },
    uae_fta_5: { ar: 'ضريبة القيمة المضافة الإمارات — 5% FTA', en: 'UAE FTA VAT — 5%' },
    ksa_zatca_15: { ar: 'ضريبة القيمة المضافة السعودية — 15% ZATCA QR', en: 'KSA ZATCA VAT — 15% + QR' },
  };
  return map[regime][locale];
}

export function classificationLabel(classification: InvoiceClassification, locale: Locale): string {
  const map: Record<InvoiceClassification, { ar: string; en: string }> = {
    receipt: { ar: 'إيصال دفعة / مستند مالي', en: 'Payment Receipt' },
    uae_simplified_tax_invoice: {
      ar: 'فاتورة ضريبية مبسطة (الإمارات FTA)',
      en: 'Simplified Tax Invoice (UAE FTA)',
    },
    uae_full_tax_invoice: {
      ar: 'فاتورة ضريبية كاملة (الإمارات FTA)',
      en: 'Full Tax Invoice (UAE FTA)',
    },
    ksa_simplified_tax_invoice: {
      ar: 'فاتورة ضريبية مبسطة (السعودية ZATCA)',
      en: 'Simplified Tax Invoice (KSA ZATCA)',
    },
    ksa_standard_tax_invoice: {
      ar: 'فاتورة ضريبية قياسية (السعودية ZATCA)',
      en: 'Standard Tax Invoice (KSA ZATCA)',
    },
  };
  return map[classification][locale];
}
