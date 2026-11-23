export type Locale = 'ar' | 'en';

export type CurrencyCode = 'AED' | 'SAR' | 'USD' | 'QAR' | 'KWD' | 'EGP';

export type TaxRegime = 'none' | 'uae_fta_5' | 'ksa_zatca_15';

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'invoiced';

export type InvoiceClassification =
  | 'receipt'
  | 'uae_simplified_tax_invoice'
  | 'uae_full_tax_invoice'
  | 'ksa_simplified_tax_invoice'
  | 'ksa_standard_tax_invoice';

export interface PricingTier {
  id: string;
  nameAr: string;
  nameEn: string;
  summaryAr: string;
  summaryEn: string;
  price: number;
  deliveryDays: number;
  featuresAr: string[];
  featuresEn: string[];
  recommended?: boolean;
}

export interface ProposalAddon {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  quantity: number;
  defaultSelected?: boolean;
}

export interface ScopeDeliverable {
  id: string;
  titleAr: string;
  titleEn: string;
  /** true = ضمن نطاق العمل؛ false = مستثنى صراحة لمنع Scope Creep */
  included: boolean;
}

export interface PartyInfo {
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  email?: string;
  phone?: string;
  trn?: string;
  vatRegistered?: boolean;
}

export interface PaymentChannels {
  iban?: string;
  bankNameAr?: string;
  bankNameEn?: string;
  aani?: string;
  stcPay?: string;
  instapay?: string;
  paymentNoteAr?: string;
  paymentNoteEn?: string;
}

export interface DiscountConfig {
  type: 'percent' | 'fixed';
  value: number;
  labelAr?: string;
  labelEn?: string;
}

export interface Proposal {
  id: string;
  slug: string;
  templateId?: string;
  status: ProposalStatus;
  defaultLocale: Locale;
  currency: CurrencyCode;
  taxRegime: TaxRegime;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  seller: PartyInfo;
  client: PartyInfo;
  tiers: PricingTier[];
  selectedTierId: string;
  addons: ProposalAddon[];
  selectedAddonIds: string[];
  deliverables: ScopeDeliverable[];
  revisionRounds: number;
  validityDays: number;
  depositPercent: number;
  discount?: DiscountConfig;
  paymentChannels: PaymentChannels;
  notesAr?: string;
  notesEn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientApproval {
  proposalId: string;
  selectedTierId: string;
  selectedAddonIds: string[];
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  signatureDataUrl?: string;
  signatureType: 'drawn' | 'typed';
  scopeAccepted: boolean;
  scopeDigestHex: string;
  approvedAt: string;
}

export interface ComplianceWarning {
  code: string;
  severity: 'warning' | 'error';
  messageAr: string;
  messageEn: string;
}

export interface ComputedTotals {
  selectedTier: PricingTier;
  selectedAddons: ProposalAddon[];
  tierSubtotal: number;
  addonsSubtotal: number;
  grossSubtotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  depositPercent: number;
  depositSubtotal: number;
  depositTaxAmount: number;
  depositAmount: number;
  balanceAmount: number;
  invoiceClassification: InvoiceClassification;
  warnings: ComplianceWarning[];
}

export interface InvoiceLineItem {
  id: string;
  descriptionAr: string;
  descriptionEn: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface GeneratedInvoice {
  invoiceNumber: string;
  proposalId: string;
  issuedAt: string;
  currency: CurrencyCode;
  taxRegime: TaxRegime;
  classification: InvoiceClassification;
  isDepositInvoice: boolean;
  depositPercent: number;
  seller: PartyInfo;
  client: PartyInfo;
  items: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  remainingBalance: number;
  paymentChannels: PaymentChannels;
  scopeDigestHex: string;
  signerName: string;
  zatcaQrBase64?: string;
  warnings: ComplianceWarning[];
}
