import type {
  ClientApproval,
  ComplianceWarning,
  ComputedTotals,
  GeneratedInvoice,
  InvoiceClassification,
  InvoiceLineItem,
  PricingTier,
  Proposal,
  ProposalAddon,
} from './types.ts';
import {
  encodeZatcaTlvBase64,
  isValidKsaVatNumber,
  isValidUaeTrn,
  normalizeDigits,
} from './zatca.ts';

const utf8Encoder = new TextEncoder();

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function getTaxRateForRegime(regime: Proposal['taxRegime']): number {
  if (regime === 'uae_fta_5') return 0.05;
  if (regime === 'ksa_zatca_15') return 0.15;
  return 0;
}

function resolveSelectedTier(proposal: Proposal, selectedTierId?: string): PricingTier {
  const targetId = selectedTierId ?? proposal.selectedTierId;
  const matched = proposal.tiers.find((t) => t.id === targetId) ?? proposal.tiers[0];
  if (!matched) {
    throw new Error('Proposal must define at least one pricing tier');
  }
  return matched;
}

function resolveSelectedAddons(proposal: Proposal, selectedAddonIds?: string[]): ProposalAddon[] {
  const idSet = new Set(selectedAddonIds ?? proposal.selectedAddonIds);
  return proposal.addons.filter((addon) => idSet.has(addon.id));
}

function buildComplianceInfo(
  proposal: Proposal,
  grandTotal: number,
): { classification: InvoiceClassification; warnings: ComplianceWarning[] } {
  const warnings: ComplianceWarning[] = [];
  const sellerTrn = normalizeDigits(proposal.seller.trn);
  const clientTrn = normalizeDigits(proposal.client.trn);
  const hasSellerAddress = Boolean(proposal.seller.addressAr.trim() || proposal.seller.addressEn.trim());
  const hasClientAddress = Boolean(proposal.client.addressAr.trim() || proposal.client.addressEn.trim());

  if (proposal.taxRegime === 'none') {
    return { classification: 'receipt', warnings };
  }

  if (proposal.taxRegime === 'uae_fta_5') {
    const isFullTaxInvoice = Boolean(proposal.client.vatRegistered && grandTotal > 10000);
    const classification: InvoiceClassification = isFullTaxInvoice
      ? 'uae_full_tax_invoice'
      : 'uae_simplified_tax_invoice';

    if (!sellerTrn) {
      warnings.push({
        code: 'UAE_SELLER_TRN_MISSING',
        severity: 'error',
        messageAr:
          'الرقم الضريبي للمورّد (TRN من 15 رقماً) مفقود — عدم عرضه في الفاتورة الضريبية يعرّض لغرامة إدارية تبدأ من 2,500 د.إ وفق المادة 59.',
        messageEn:
          'Supplier 15-digit UAE TRN is missing — omitting TRN on a UAE tax invoice risks FTA administrative penalties starting at AED 2,500.',
      });
    } else if (!isValidUaeTrn(sellerTrn)) {
      warnings.push({
        code: 'UAE_SELLER_TRN_INVALID',
        severity: 'error',
        messageAr: 'الرقم الضريبي الإماراتي للمورّد غير صالح: يجب أن يتكون من 15 رقماً بالضبط.',
        messageEn: 'Invalid UAE Supplier TRN: must be exactly 15 digits.',
      });
    }

    if (!hasSellerAddress) {
      warnings.push({
        code: 'UAE_SELLER_ADDRESS_MISSING',
        severity: 'warning',
        messageAr: 'عنوان المورّد التجاري مطلوب إلزامياً ضمن الفاتورة الضريبية الإماراتية.',
        messageEn: 'Supplier physical business address is mandatory on UAE tax invoices.',
      });
    }

    if (proposal.currency !== 'AED') {
      warnings.push({
        code: 'UAE_CURRENCY_AED_NOTICE',
        severity: 'warning',
        messageAr:
          'قانون الضريبة الإماراتي يشترط إظهار القيمة والضريبة بالدرهم الإماراتي (AED) وفق سعر صرف المصرف المركزي.',
        messageEn:
          'UAE FTA requires amounts and VAT to be displayed in AED using the official UAE Central Bank exchange rate.',
      });
    }

    if (isFullTaxInvoice && (!isValidUaeTrn(clientTrn) || !hasClientAddress)) {
      warnings.push({
        code: 'UAE_FULL_INVOICE_CLIENT_DETAILS_REQUIRED',
        severity: 'error',
        messageAr:
          'تجاوز التوريد 10,000 د.إ لعميل مسجل ضريبياً يوجب إصدار «فاتورة ضريبية كاملة» تتضمن عنوان العميل ورقمه الضريبي (15 رقماً).',
        messageEn:
          'Supply exceeds AED 10,000 for a VAT-registered client: a Full Tax Invoice including client address and 15-digit TRN is mandatory.',
      });
    }

    return { classification, warnings };
  }

  // KSA ZATCA 15%
  const classification: InvoiceClassification = proposal.client.vatRegistered
    ? 'ksa_standard_tax_invoice'
    : 'ksa_simplified_tax_invoice';

  if (!sellerTrn) {
    warnings.push({
      code: 'KSA_VAT_NUMBER_MISSING',
      severity: 'error',
      messageAr: 'الرقم الضريبي السعودي للبائع (15 رقماً يبدأ وينتهي بـ 3) مطلوب لتوليد رمز ZATCA QR.',
      messageEn: 'KSA seller VAT number (15 digits starting and ending with 3) is required to generate ZATCA QR.',
    });
  } else if (!isValidKsaVatNumber(sellerTrn)) {
    warnings.push({
      code: 'KSA_VAT_NUMBER_INVALID',
      severity: 'error',
      messageAr: 'الرقم الضريبي السعودي غير صالح: يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3.',
      messageEn: 'Invalid KSA VAT number: must be 15 digits starting and ending with 3.',
    });
  }

  if (classification === 'ksa_standard_tax_invoice' && (!isValidKsaVatNumber(clientTrn) || !hasClientAddress)) {
    warnings.push({
      code: 'KSA_STANDARD_INVOICE_CLIENT_DETAILS_REQUIRED',
      severity: 'warning',
      messageAr: 'الفاتورة الضريبية القياسية (B2B) في السعودية تتطلب الرقم الضريبي وعنوان المشتري.',
      messageEn: 'KSA Standard Tax Invoice (B2B) requires buyer VAT number and address.',
    });
  }

  return { classification, warnings };
}

export function computeProposalTotals(
  proposal: Proposal,
  selectedTierId?: string,
  selectedAddonIds?: string[],
): ComputedTotals {
  const selectedTier = resolveSelectedTier(proposal, selectedTierId);
  const selectedAddons = resolveSelectedAddons(proposal, selectedAddonIds);

  const tierSubtotal = roundMoney(Math.max(0, selectedTier.price));
  const addonsSubtotal = roundMoney(
    selectedAddons.reduce(
      (sum, addon) => sum + roundMoney(Math.max(0, addon.price) * Math.max(1, addon.quantity)),
      0,
    ),
  );
  const grossSubtotal = roundMoney(tierSubtotal + addonsSubtotal);

  let rawDiscount = 0;
  if (proposal.discount && proposal.discount.value > 0) {
    if (proposal.discount.type === 'percent') {
      const pct = Math.min(100, Math.max(0, proposal.discount.value));
      rawDiscount = grossSubtotal * (pct / 100);
    } else {
      rawDiscount = proposal.discount.value;
    }
  }
  const discountAmount = roundMoney(Math.min(grossSubtotal, Math.max(0, rawDiscount)));
  const taxableSubtotal = roundMoney(Math.max(0, grossSubtotal - discountAmount));

  const taxRate = getTaxRateForRegime(proposal.taxRegime);
  const taxAmount = roundMoney(taxableSubtotal * taxRate);
  const grandTotal = roundMoney(taxableSubtotal + taxAmount);

  const depositPercent = Math.min(100, Math.max(0, roundMoney(proposal.depositPercent)));
  const depositAmount = roundMoney(grandTotal * (depositPercent / 100));
  const balanceAmount = roundMoney(grandTotal - depositAmount);

  let depositTaxAmount = 0;
  let depositSubtotal = depositAmount;
  if (taxRate > 0 && depositAmount > 0) {
    depositTaxAmount = roundMoney(depositAmount - depositAmount / (1 + taxRate));
    depositSubtotal = roundMoney(depositAmount - depositTaxAmount);
  }

  const { classification, warnings } = buildComplianceInfo(proposal, grandTotal);

  return {
    selectedTier,
    selectedAddons,
    tierSubtotal,
    addonsSubtotal,
    grossSubtotal,
    discountAmount,
    taxableSubtotal,
    taxRate,
    taxAmount,
    grandTotal,
    depositPercent,
    depositSubtotal,
    depositTaxAmount,
    depositAmount,
    balanceAmount,
    invoiceClassification: classification,
    warnings,
  };
}

export function buildScopeLockCanonicalText(
  proposal: Proposal,
  selectedTierId?: string,
  selectedAddonIds?: string[],
): string {
  const tier = resolveSelectedTier(proposal, selectedTierId);
  const addons = resolveSelectedAddons(proposal, selectedAddonIds).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const included = proposal.deliverables
    .filter((d) => d.included)
    .map((d) => `${d.id}:${d.titleAr.trim()}|${d.titleEn.trim()}`)
    .sort();
  const excluded = proposal.deliverables
    .filter((d) => !d.included)
    .map((d) => `${d.id}:${d.titleAr.trim()}|${d.titleEn.trim()}`)
    .sort();

  const payload = {
    proposalId: proposal.id,
    currency: proposal.currency,
    taxRegime: proposal.taxRegime,
    depositPercent: roundMoney(proposal.depositPercent),
    revisionRounds: proposal.revisionRounds,
    validityDays: proposal.validityDays,
    tier: {
      id: tier.id,
      price: roundMoney(tier.price),
      deliveryDays: tier.deliveryDays,
      nameAr: tier.nameAr.trim(),
      nameEn: tier.nameEn.trim(),
    },
    addons: addons.map((a) => ({
      id: a.id,
      price: roundMoney(a.price),
      quantity: Math.max(1, a.quantity),
      titleAr: a.titleAr.trim(),
      titleEn: a.titleEn.trim(),
    })),
    discount: proposal.discount
      ? { type: proposal.discount.type, value: roundMoney(proposal.discount.value) }
      : null,
    includedDeliverables: included,
    excludedDeliverables: excluded,
  };

  return JSON.stringify(payload);
}

export async function computeScopeDigestHex(canonicalText: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto subtle API is unavailable in this environment');
  }
  const encoded = utf8Encoder.encode(canonicalText);
  const digestBuffer = await subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digestBuffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function generateDepositInvoice(
  proposal: Proposal,
  approval: ClientApproval,
  invoiceNumber: string,
  issuedAtIso: string = new Date().toISOString(),
): GeneratedInvoice {
  const totals = computeProposalTotals(
    proposal,
    approval.selectedTierId,
    approval.selectedAddonIds,
  );
  const cleanInvoiceNumber = invoiceNumber.trim() || `INV-${proposal.id.slice(0, 8).toUpperCase()}`;
  const isDepositInvoice = totals.depositPercent < 100;
  const items: InvoiceLineItem[] = [];

  if (isDepositInvoice || totals.discountAmount > 0) {
    const addonCount = totals.selectedAddons.length;
    const addonSuffixAr = addonCount > 0 ? ` + ${addonCount} إضافات` : '';
    const addonSuffixEn = addonCount > 0 ? ` + ${addonCount} add-on(s)` : '';
    const pctLabel = isDepositInvoice ? `دفعة أولى (${totals.depositPercent}%) — ` : '';
    const pctLabelEn = isDepositInvoice ? `Deposit (${totals.depositPercent}%) — ` : '';

    items.push({
      id: 'deposit-scope-item',
      descriptionAr: `${pctLabel}${proposal.titleAr} (${totals.selectedTier.nameAr}${addonSuffixAr})`,
      descriptionEn: `${pctLabelEn}${proposal.titleEn} (${totals.selectedTier.nameEn}${addonSuffixEn})`,
      quantity: 1,
      unitPrice: totals.depositSubtotal,
      netAmount: totals.depositSubtotal,
      taxAmount: totals.depositTaxAmount,
      grossAmount: totals.depositAmount,
    });
  } else {
    const tierTax = roundMoney(totals.tierSubtotal * totals.taxRate);
    items.push({
      id: `tier-${totals.selectedTier.id}`,
      descriptionAr: `${totals.selectedTier.nameAr} — ${proposal.titleAr}`,
      descriptionEn: `${totals.selectedTier.nameEn} — ${proposal.titleEn}`,
      quantity: 1,
      unitPrice: totals.tierSubtotal,
      netAmount: totals.tierSubtotal,
      taxAmount: tierTax,
      grossAmount: roundMoney(totals.tierSubtotal + tierTax),
    });

    for (const addon of totals.selectedAddons) {
      const qty = Math.max(1, addon.quantity);
      const net = roundMoney(addon.price * qty);
      const tax = roundMoney(net * totals.taxRate);
      items.push({
        id: `addon-${addon.id}`,
        descriptionAr: addon.titleAr,
        descriptionEn: addon.titleEn,
        quantity: qty,
        unitPrice: roundMoney(addon.price),
        netAmount: net,
        taxAmount: tax,
        grossAmount: roundMoney(net + tax),
      });
    }

    // Reconcile 0.01 rounding difference if multiple line items caused tax rounding drift
    const sumNet = roundMoney(items.reduce((s, item) => s + item.netAmount, 0));
    const sumTax = roundMoney(items.reduce((s, item) => s + item.taxAmount, 0));
    const netDelta = roundMoney(totals.depositSubtotal - sumNet);
    const taxDelta = roundMoney(totals.depositTaxAmount - sumTax);
    const lastItem = items[items.length - 1];
    if (lastItem && (netDelta !== 0 || taxDelta !== 0)) {
      lastItem.netAmount = roundMoney(lastItem.netAmount + netDelta);
      lastItem.taxAmount = roundMoney(lastItem.taxAmount + taxDelta);
      lastItem.grossAmount = roundMoney(lastItem.netAmount + lastItem.taxAmount);
    }
  }

  let zatcaQrBase64: string | undefined;
  if (proposal.taxRegime === 'ksa_zatca_15' && isValidKsaVatNumber(proposal.seller.trn)) {
    const sellerName =
      proposal.defaultLocale === 'ar'
        ? proposal.seller.nameAr.trim() || proposal.seller.nameEn.trim()
        : proposal.seller.nameEn.trim() || proposal.seller.nameAr.trim();

    if (sellerName) {
      zatcaQrBase64 = encodeZatcaTlvBase64({
        sellerName,
        vatNumber: normalizeDigits(proposal.seller.trn),
        timestamp: issuedAtIso,
        invoiceTotal: totals.depositAmount,
        vatTotal: totals.depositTaxAmount,
      });
    }
  }

  return {
    invoiceNumber: cleanInvoiceNumber,
    proposalId: proposal.id,
    issuedAt: issuedAtIso,
    currency: proposal.currency,
    taxRegime: proposal.taxRegime,
    classification: totals.invoiceClassification,
    isDepositInvoice,
    depositPercent: totals.depositPercent,
    seller: proposal.seller,
    client: proposal.client,
    items,
    subtotal: totals.depositSubtotal,
    taxRate: totals.taxRate,
    taxAmount: totals.depositTaxAmount,
    totalAmount: totals.depositAmount,
    remainingBalance: totals.balanceAmount,
    paymentChannels: proposal.paymentChannels,
    scopeDigestHex: approval.scopeDigestHex,
    signerName: approval.signerName,
    zatcaQrBase64,
    warnings: totals.warnings,
  };
}
