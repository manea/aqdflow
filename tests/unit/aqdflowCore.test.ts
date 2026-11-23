import { describe, expect, it } from 'vitest';
import {
  decodeZatcaTlvBase64,
  encodeZatcaTlvBase64,
  isValidKsaVatNumber,
  isValidUaeTrn,
} from '../../src/core/zatca.ts';
import {
  buildScopeLockCanonicalText,
  computeProposalTotals,
  computeScopeDigestHex,
  generateDepositInvoice,
  roundMoney,
} from '../../src/core/taxAndPricing.ts';
import {
  PROPOSAL_TEMPLATES,
  buildInvoiceWhatsAppUrl,
  buildProposalWhatsAppUrl,
  createProposalFromTemplate,
} from '../../src/core/templates.ts';
import type { ClientApproval } from '../../src/core/types.ts';

function decodeRawBase64Bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe('ZATCA Phase 1 TLV QR encoder/decoder', () => {
  it('encodes and decodes UTF-8 Arabic seller names using exact byte lengths rather than JS string length', () => {
    const sellerName = 'مؤسسة أفق الرقمية للتجارة';
    const utf8BytesCount = new TextEncoder().encode(sellerName).length;
    expect(utf8BytesCount).toBeGreaterThan(sellerName.length);

    const base64 = encodeZatcaTlvBase64({
      sellerName,
      vatNumber: '310122393500003',
      timestamp: '2026-11-23T19:30:00Z',
      invoiceTotal: 1150,
      vatTotal: 150,
    });

    const rawBytes = decodeRawBase64Bytes(base64);
    expect(rawBytes[0]).toBe(1);
    expect(rawBytes[1]).toBe(utf8BytesCount);

    const decoded = decodeZatcaTlvBase64(base64);
    expect(decoded[1]).toBe(sellerName);
    expect(decoded[2]).toBe('310122393500003');
    expect(decoded[3]).toBe('2026-11-23T19:30:00Z');
    expect(decoded[4]).toBe('1150.00');
    expect(decoded[5]).toBe('150.00');
  });

  it('rejects oversized UTF-8 fields (>255 bytes), truncated TLV Base64 payloads, and invalid KSA VAT numbers', () => {
    expect(isValidKsaVatNumber('300000000000003')).toBe(true);
    expect(isValidKsaVatNumber('100000000000003')).toBe(false);
    expect(isValidKsaVatNumber('300000000000009')).toBe(false);
    expect(isValidKsaVatNumber('30000000000003')).toBe(false);
    expect(isValidUaeTrn('100000000000003')).toBe(true);
    expect(isValidUaeTrn('10000000000000')).toBe(false);

    // 140 Arabic chars => 280 UTF-8 bytes > 255 byte limit even though string.length < 255
    const longArabicName = 'أ'.repeat(140);
    expect(() =>
      encodeZatcaTlvBase64({
        sellerName: longArabicName,
        vatNumber: '300000000000003',
        timestamp: '2026-11-23T19:30:00Z',
        invoiceTotal: 115,
        vatTotal: 15,
      }),
    ).toThrow(/exceeds 255 UTF-8 bytes/);

    expect(() =>
      encodeZatcaTlvBase64({
        sellerName: 'شركة النخبة',
        vatNumber: '200000000000003',
        timestamp: '2026-11-23T19:30:00Z',
        invoiceTotal: 115,
        vatTotal: 15,
      }),
    ).toThrow(/Invalid KSA VAT number/);

    const validBase64 = encodeZatcaTlvBase64({
      sellerName: 'Ofoq LLC',
      vatNumber: '300000000000003',
      timestamp: '2026-11-23T19:30:00Z',
      invoiceTotal: 115,
      vatTotal: 15,
    });
    const raw = decodeRawBase64Bytes(validBase64);
    const truncatedBytes = raw.slice(0, raw.length - 3);
    let bin = '';
    for (const b of truncatedBytes) bin += String.fromCharCode(b);
    const truncatedB64 = btoa(bin);

    expect(() => decodeZatcaTlvBase64(truncatedB64)).toThrow(/Truncated ZATCA TLV/);
    expect(() => decodeZatcaTlvBase64('not-valid-b64!')).toThrow();
  });
});

describe('UAE FTA VAT 5% classification, compliance warnings, and totals arithmetic', () => {
  it('distinguishes UAE Simplified vs Full Tax Invoice around the AED 10,000 VAT-registered threshold and flags TRN issues', () => {
    const proposal = createProposalFromTemplate('web-commerce');
    // Unregistered client even above 10,000 AED => simplified tax invoice
    proposal.selectedTierId = 'tier-enterprise'; // 14,500 AED + 5% = 15,225 AED
    proposal.client.vatRegistered = false;
    const unregisteredTotals = computeProposalTotals(proposal);
    expect(unregisteredTotals.invoiceClassification).toBe('uae_simplified_tax_invoice');
    expect(unregisteredTotals.taxAmount).toBe(725);
    expect(unregisteredTotals.grandTotal).toBe(15225);

    // VAT-registered client <= 10,000 AED => simplified tax invoice
    proposal.selectedTierId = 'tier-growth'; // 8,900 + 5% = 9,345 <= 10,000
    proposal.client.vatRegistered = true;
    proposal.client.trn = '';
    const underLimitTotals = computeProposalTotals(proposal);
    expect(underLimitTotals.invoiceClassification).toBe('uae_simplified_tax_invoice');
    expect(underLimitTotals.warnings.some((w) => w.code === 'UAE_FULL_INVOICE_CLIENT_DETAILS_REQUIRED')).toBe(false);

    // VAT-registered client > 10,000 AED => full tax invoice + warns when client TRN is missing/invalid
    proposal.selectedTierId = 'tier-enterprise';
    const overLimitMissingTrn = computeProposalTotals(proposal);
    expect(overLimitMissingTrn.invoiceClassification).toBe('uae_full_tax_invoice');
    expect(overLimitMissingTrn.warnings.some((w) => w.code === 'UAE_FULL_INVOICE_CLIENT_DETAILS_REQUIRED')).toBe(true);

    // Invalid seller TRN triggers error warning
    proposal.seller.trn = '12345';
    proposal.client.trn = '100999999999993';
    const invalidSellerTrn = computeProposalTotals(proposal);
    expect(invalidSellerTrn.warnings.some((w) => w.code === 'UAE_SELLER_TRN_INVALID')).toBe(true);
    expect(invalidSellerTrn.warnings.some((w) => w.code === 'UAE_FULL_INVOICE_CLIENT_DETAILS_REQUIRED')).toBe(false);
  });

  it('computes tier + multiple addons with quantities + percent/fixed discounts and exact deposit split', () => {
    const proposal = createProposalFromTemplate('web-commerce');
    // tier-growth = 8900, addon-copywriting = 1200 (qty 2 => 2400), addon-whatsapp-bot = 950 (qty 1)
    const addons = proposal.addons.map((a) =>
      a.id === 'addon-copywriting' ? { ...a, quantity: 2 } : a,
    );
    proposal.addons = addons;
    proposal.selectedAddonIds = ['addon-copywriting', 'addon-whatsapp-bot'];
    proposal.discount = { type: 'percent', value: 10 };
    proposal.depositPercent = 33; // odd percentage to verify cent reconciliation

    const percentTotals = computeProposalTotals(proposal);
    // Gross = 8900 + 2400 + 950 = 12250; 10% discount = 1225; taxable = 11025; 5% VAT = 551.25; grand = 11576.25
    expect(percentTotals.grossSubtotal).toBe(12250);
    expect(percentTotals.discountAmount).toBe(1225);
    expect(percentTotals.taxableSubtotal).toBe(11025);
    expect(percentTotals.taxAmount).toBe(551.25);
    expect(percentTotals.grandTotal).toBe(11576.25);
    expect(roundMoney(percentTotals.depositAmount + percentTotals.balanceAmount)).toBe(percentTotals.grandTotal);
    expect(roundMoney(percentTotals.depositSubtotal + percentTotals.depositTaxAmount)).toBe(
      percentTotals.depositAmount,
    );

    // Fixed discount test
    proposal.discount = { type: 'fixed', value: 1250 };
    const fixedTotals = computeProposalTotals(proposal);
    // Gross = 12250 - 1250 = 11000; 5% VAT = 550; grand = 11550
    expect(fixedTotals.taxableSubtotal).toBe(11000);
    expect(fixedTotals.taxAmount).toBe(550);
    expect(fixedTotals.grandTotal).toBe(11550);
  });
});

describe('Scope lock SHA-256 digest, deposit invoice generation, templates & WhatsApp links', () => {
  it('produces deterministic SHA-256 scope lock digests that react to tier, addons, and exclusions', async () => {
    const proposal = createProposalFromTemplate('brand-identity');
    const c1 = buildScopeLockCanonicalText(proposal, proposal.selectedTierId, []);
    const c2 = buildScopeLockCanonicalText(proposal, proposal.selectedTierId, []);
    const h1 = await computeScopeDigestHex(c1);
    const h2 = await computeScopeDigestHex(c2);

    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);

    // Changing tier changes hash
    const hTierChanged = await computeScopeDigestHex(
      buildScopeLockCanonicalText(proposal, 'tier-launch-kit', []),
    );
    expect(hTierChanged).not.toBe(h1);

    // Adding an addon changes hash
    const hAddonChanged = await computeScopeDigestHex(
      buildScopeLockCanonicalText(proposal, proposal.selectedTierId, ['addon-packaging']),
    );
    expect(hAddonChanged).not.toBe(h1);

    // Modifying an explicit exclusion item changes hash
    const modifiedProposal = {
      ...proposal,
      deliverables: proposal.deliverables.map((d) =>
        !d.included ? { ...d, titleAr: `${d.titleAr} (محدث)` } : d,
      ),
    };
    const hExclusionChanged = await computeScopeDigestHex(
      buildScopeLockCanonicalText(modifiedProposal, modifiedProposal.selectedTierId, []),
    );
    expect(hExclusionChanged).not.toBe(h1);
  });

  it('generates KSA deposit invoice with ZATCA QR matching exact deposit invoice amounts, plus bilingual WhatsApp URLs and 4 presets', async () => {
    expect(PROPOSAL_TEMPLATES).toHaveLength(4);

    const ksaProposal = createProposalFromTemplate('saas-mvp', {
      id: 'prop-ksa-001',
      slug: 'ksa-mvp-test',
    });
    // tier-mvp = 18,500 SAR + addon-landing = 2,500 SAR => taxable = 21,000 SAR + 15% VAT (3,150) = 24,150 SAR
    // depositPercent = 40 => depositAmount = 9,660.00 SAR (net 8,400.00 + VAT 1,260.00), balance = 14,490.00 SAR
    const selectedAddonIds = ['addon-landing'];
    const digest = await computeScopeDigestHex(
      buildScopeLockCanonicalText(ksaProposal, 'tier-mvp', selectedAddonIds),
    );

    const approval: ClientApproval = {
      proposalId: ksaProposal.id,
      selectedTierId: 'tier-mvp',
      selectedAddonIds,
      signerName: 'فهد القحطاني',
      signatureType: 'typed',
      scopeAccepted: true,
      scopeDigestHex: digest,
      approvedAt: '2026-11-23T19:45:00Z',
    };

    const invoice = generateDepositInvoice(
      ksaProposal,
      approval,
      'INV-2026-0001',
      '2026-11-23T19:45:00Z',
    );

    expect(invoice.isDepositInvoice).toBe(true);
    expect(invoice.subtotal).toBe(8400);
    expect(invoice.taxAmount).toBe(1260);
    expect(invoice.totalAmount).toBe(9660);
    expect(invoice.remainingBalance).toBe(14490);
    expect(invoice.zatcaQrBase64).toBeTruthy();

    const qrDecoded = decodeZatcaTlvBase64(invoice.zatcaQrBase64!);
    expect(qrDecoded[1]).toBe(ksaProposal.seller.nameAr);
    expect(qrDecoded[2]).toBe('300000000000003');
    expect(qrDecoded[3]).toBe('2026-11-23T19:45:00Z');
    expect(qrDecoded[4]).toBe('9660.00');
    expect(qrDecoded[5]).toBe('1260.00');

    const waPropAr = buildProposalWhatsAppUrl(
      ksaProposal,
      'https://aqdflow.example.com/p/ksa-mvp-test',
      'ar',
    );
    const waPropEn = buildProposalWhatsAppUrl(
      ksaProposal,
      'https://aqdflow.example.com/p/ksa-mvp-test',
      'en',
    );
    expect(waPropAr).toMatch(/^https:\/\/wa\.me\/966550000000\?text=/);
    expect(decodeURIComponent(waPropAr)).toContain('عرض السعر التفاعلي');
    expect(decodeURIComponent(waPropEn)).toContain('interactive proposal');

    const waInvAr = buildInvoiceWhatsAppUrl(ksaProposal, invoice, 'ar');
    expect(decodeURIComponent(waInvAr)).toContain('INV-2026-0001');
    expect(decodeURIComponent(waInvAr)).toContain('9,660.00 SAR');
  });
});
