import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  MessageCircle,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { buildInvoiceWhatsAppUrl } from '../core/templates.ts';
import type { ClientApproval, GeneratedInvoice, Locale, Proposal } from '../core/types.ts';
import { withBase } from '../lib/basePath.ts';
import {
  classificationLabel,
  formatMoney,
  formatShortDate,
  getCopy,
  taxRegimeLabel,
} from '../lib/i18n.ts';

interface TaxInvoiceViewProps {
  invoice: GeneratedInvoice;
  proposal?: Proposal;
  approval?: ClientApproval | null;
  locale: Locale;
  onBackToStudio?: () => void;
}

export function TaxInvoiceView({
  invoice,
  proposal,
  approval,
  locale,
  onBackToStudio,
}: TaxInvoiceViewProps) {
  const copy = getCopy(locale);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!invoice.zatcaQrBase64) {
      setQrSvg('');
      return;
    }
    QRCode.toString(invoice.zatcaQrBase64, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg('');
      });

    return () => {
      cancelled = true;
    };
  }, [invoice.zatcaQrBase64]);

  const qrDataUri = useMemo(() => {
    if (!qrSvg) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  }, [qrSvg]);

  const whatsappHref = useMemo(() => {
    const baseProposal: Proposal = proposal ?? {
      id: invoice.proposalId,
      slug: invoice.proposalId,
      status: 'invoiced',
      defaultLocale: locale,
      currency: invoice.currency,
      taxRegime: invoice.taxRegime,
      titleAr: invoice.invoiceNumber,
      titleEn: invoice.invoiceNumber,
      subtitleAr: '',
      subtitleEn: '',
      seller: invoice.seller,
      client: invoice.client,
      tiers: [],
      selectedTierId: '',
      addons: [],
      selectedAddonIds: [],
      deliverables: [],
      revisionRounds: 2,
      validityDays: 14,
      depositPercent: invoice.depositPercent,
      paymentChannels: invoice.paymentChannels,
      createdAt: invoice.issuedAt,
      updatedAt: invoice.issuedAt,
    };
    return buildInvoiceWhatsAppUrl(baseProposal, invoice, locale);
  }, [invoice, locale, proposal]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  const sellerName =
    locale === 'ar'
      ? invoice.seller.nameAr || invoice.seller.nameEn
      : invoice.seller.nameEn || invoice.seller.nameAr;
  const sellerAddress =
    locale === 'ar'
      ? invoice.seller.addressAr || invoice.seller.addressEn
      : invoice.seller.addressEn || invoice.seller.addressAr;
  const clientName =
    locale === 'ar'
      ? invoice.client.nameAr || invoice.client.nameEn
      : invoice.client.nameEn || invoice.client.nameAr;
  const clientAddress =
    locale === 'ar'
      ? invoice.client.addressAr || invoice.client.addressEn
      : invoice.client.addressEn || invoice.client.addressAr;

  const paymentEntries = [
    { key: 'iban', label: copy.ibanLabel, value: invoice.paymentChannels.iban },
    {
      key: 'bank',
      label: locale === 'ar' ? copy.bankNameArLabel : copy.bankNameEnLabel,
      value:
        locale === 'ar'
          ? invoice.paymentChannels.bankNameAr || invoice.paymentChannels.bankNameEn
          : invoice.paymentChannels.bankNameEn || invoice.paymentChannels.bankNameAr,
    },
    { key: 'aani', label: copy.aaniLabel, value: invoice.paymentChannels.aani },
    { key: 'stcpay', label: copy.stcPayLabel, value: invoice.paymentChannels.stcPay },
    { key: 'instapay', label: copy.instapayLabel, value: invoice.paymentChannels.instapay },
  ].filter((entry): entry is { key: string; label: string; value: string } =>
    Boolean(entry.value && entry.value.trim()),
  );

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-5" data-testid="tax-invoice-view">
      {/* Action Bar (.no-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          {onBackToStudio && (
            <button
              type="button"
              onClick={onBackToStudio}
              data-testid="invoice-back-studio-btn"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <BackIcon className="h-4 w-4" />
              {copy.backToStudio}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <MessageCircle className="h-4 w-4 text-[var(--accent-primary)]" />
            {copy.shareInvoiceWaBtn}
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
            data-testid="print-invoice-btn"
          >
            <Printer className="h-4 w-4" />
            {copy.printPdfBtn}
          </button>
        </div>
      </div>

      {/* Main Printable Document */}
      <article className="aqd-card rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
              {classificationLabel(invoice.classification, locale)}
            </span>
            <h1 className="aqd-display text-2xl font-extrabold text-[var(--text-primary)]">
              {copy.invoicePageTitle}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {taxRegimeLabel(invoice.taxRegime, locale)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm">
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.invoiceNumberLabel}</div>
              <div className="num-tabular font-bold text-[var(--text-primary)]" dir="ltr">
                {invoice.invoiceNumber}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">{copy.issuedAtLabel}</div>
              <div className="num-tabular font-semibold text-[var(--text-primary)]">
                {formatShortDate(invoice.issuedAt, locale)}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-[var(--text-secondary)]">{copy.depositPaidSchedule}</div>
              <div className="num-tabular font-semibold text-[var(--accent-amber)]">
                {invoice.depositPercent}% — {formatMoney(invoice.totalAmount, invoice.currency, locale)}
              </div>
            </div>
          </div>
        </header>

        {/* Compliance Warnings if any */}
        {invoice.warnings.length > 0 && (
          <div className="no-print space-y-2 rounded-xl border border-[var(--accent-amber)]/40 bg-[var(--accent-amber-soft)] p-4">
            {invoice.warnings.map((w) => (
              <div key={w.code} className="flex items-start gap-2.5 text-xs sm:text-sm text-[var(--text-primary)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-amber)]" />
                <span>{locale === 'ar' ? w.messageAr : w.messageEn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Seller & Client Cards */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {copy.sellerLabel}
            </div>
            <div className="text-base font-bold text-[var(--text-primary)]">{sellerName || '—'}</div>
            {sellerAddress && <div className="text-sm text-[var(--text-secondary)]">{sellerAddress}</div>}
            {invoice.seller.trn && (
              <div className="pt-1 text-xs font-semibold text-[var(--text-primary)]">
                {copy.trnShort}:{' '}
                <span className="num-tabular font-mono" dir="ltr">
                  {invoice.seller.trn}
                </span>
              </div>
            )}
            {(invoice.seller.email || invoice.seller.phone) && (
              <div className="text-xs text-[var(--text-secondary)]" dir="ltr">
                {[invoice.seller.email, invoice.seller.phone].filter(Boolean).join(' • ')}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {copy.clientLabel}
            </div>
            <div className="text-base font-bold text-[var(--text-primary)]">{clientName || '—'}</div>
            {clientAddress && <div className="text-sm text-[var(--text-secondary)]">{clientAddress}</div>}
            {invoice.client.trn && (
              <div className="pt-1 text-xs font-semibold text-[var(--text-primary)]">
                {copy.trnShort}:{' '}
                <span className="num-tabular font-mono" dir="ltr">
                  {invoice.client.trn}
                </span>
              </div>
            )}
            {(invoice.client.email || invoice.client.phone) && (
              <div className="text-xs text-[var(--text-secondary)]" dir="ltr">
                {[invoice.client.email, invoice.client.phone].filter(Boolean).join(' • ')}
              </div>
            )}
          </div>
        </section>

        {/* Line Items Table */}
        <section className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                <th className="min-w-[220px] px-4 py-3 text-start font-semibold">{copy.itemDescCol}</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">{copy.qtyCol}</th>
                <th className="px-3 py-3 text-end font-semibold whitespace-nowrap">{copy.netCol}</th>
                <th className="px-3 py-3 text-end font-semibold whitespace-nowrap">{copy.vatCol}</th>
                <th className="px-4 py-3 text-end font-semibold whitespace-nowrap">{copy.totalCol}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="px-4 py-3.5 font-medium text-[var(--text-primary)]">
                    {locale === 'ar' ? item.descriptionAr : item.descriptionEn}
                  </td>
                  <td className="num-tabular px-3 py-3.5 text-center text-[var(--text-secondary)] whitespace-nowrap">
                    {item.quantity}
                  </td>
                  <td className="num-tabular px-3 py-3.5 text-end text-[var(--text-primary)] whitespace-nowrap">
                    {formatMoney(item.netAmount, invoice.currency, locale)}
                  </td>
                  <td className="num-tabular px-3 py-3.5 text-end text-[var(--text-secondary)] whitespace-nowrap">
                    {formatMoney(item.taxAmount, invoice.currency, locale)}
                  </td>
                  <td className="num-tabular px-4 py-3.5 text-end font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    {formatMoney(item.grossAmount, invoice.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals + ZATCA QR Grid */}
        <section className="print-avoid-break grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            {/* Payment Channels */}
            {paymentEntries.length > 0 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2.5">
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  {copy.paymentChannelsTitle}
                </div>
                <div className="space-y-2">
                  {paymentEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs sm:text-sm"
                    >
                      <span className="text-[var(--text-secondary)]">{entry.label}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="num-tabular break-all font-mono font-semibold text-[var(--text-primary)]"
                          dir="ltr"
                        >
                          {entry.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue(entry.key, entry.value)}
                          className="no-print inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {copiedKey === entry.key ? (
                            <>
                              <Check className="h-3 w-3 text-[var(--accent-seal)]" />
                              {copy.copiedLabel}
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              {copy.copyLabel}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {(invoice.paymentChannels.paymentNoteAr || invoice.paymentChannels.paymentNoteEn) && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {locale === 'ar'
                      ? invoice.paymentChannels.paymentNoteAr || invoice.paymentChannels.paymentNoteEn
                      : invoice.paymentChannels.paymentNoteEn || invoice.paymentChannels.paymentNoteAr}
                  </p>
                )}
              </div>
            )}

            {/* Scope Lock Audit Certificate */}
            <div className="rounded-xl border border-[var(--accent-seal)]/35 bg-[var(--accent-seal-soft)] p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--accent-seal)]">
                <ShieldCheck className="h-4 w-4" />
                {copy.scopeCertificateTitle}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[var(--text-secondary)]">{copy.signedByLabel}: </span>
                  <span className="font-bold text-[var(--text-primary)]">{invoice.signerName}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">{copy.issuedAtLabel}: </span>
                  <span className="num-tabular font-medium text-[var(--text-primary)]">
                    {formatShortDate(approval?.approvedAt || invoice.issuedAt, locale)}
                  </span>
                </div>
              </div>
              {approval?.signatureType === 'drawn' && approval.signatureDataUrl && (
                <div className="mt-2 inline-block rounded-lg border border-[var(--border-subtle)] bg-white p-2">
                  <img
                    src={approval.signatureDataUrl}
                    alt={invoice.signerName}
                    className="h-14 w-auto object-contain"
                  />
                </div>
              )}
              <div className="pt-1">
                <div className="text-[11px] text-[var(--text-secondary)]">{copy.scopeDigestLabel}</div>
                <code
                  className="block break-all rounded bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text-primary)]"
                  dir="ltr"
                  data-testid="invoice-scope-digest"
                >
                  {invoice.scopeDigestHex}
                </code>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            {/* Totals Box */}
            <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">{copy.netBeforeTax}</span>
                <span className="num-tabular shrink-0 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                  {formatMoney(invoice.subtotal, invoice.currency, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {copy.taxRow} ({Math.round(invoice.taxRate * 100)}%)
                </span>
                <span className="num-tabular shrink-0 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                  {formatMoney(invoice.taxAmount, invoice.currency, locale)}
                </span>
              </div>
              <div className="border-t border-[var(--border-strong)] pt-3 flex items-baseline justify-between gap-4">
                <span className="text-sm sm:text-base font-bold leading-snug text-[var(--text-primary)]">
                  {copy.depositDueNow}
                </span>
                <span className="num-tabular aqd-display shrink-0 whitespace-nowrap text-xl font-extrabold text-[var(--accent-primary)]">
                  {formatMoney(invoice.totalAmount, invoice.currency, locale)}
                </span>
              </div>
              {invoice.remainingBalance > 0 && (
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                  <span>{copy.remainingBalanceNote}</span>
                  <span className="num-tabular shrink-0 whitespace-nowrap font-semibold">
                    {formatMoney(invoice.remainingBalance, invoice.currency, locale)}
                  </span>
                </div>
              )}
            </div>

            {/* ZATCA QR Card */}
            {invoice.zatcaQrBase64 && qrDataUri && (
              <div
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center space-y-2.5"
                data-testid="zatca-qr-card"
              >
                <div className="text-xs font-bold text-[var(--text-primary)]">{copy.zatcaQrTitle}</div>
                <div className="mx-auto inline-block rounded-xl border border-[var(--border-subtle)] bg-white p-2.5">
                  <img
                    src={qrDataUri}
                    alt="ZATCA Phase 1 QR Code"
                    className="h-36 w-36 object-contain"
                    data-testid="zatca-qr-img"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">{copy.zatcaQrSubtitle}</p>
                <a
                  href={withBase(`/api/public/invoices/${encodeURIComponent(invoice.invoiceNumber)}/qr.svg`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print inline-block text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  SVG QR ({invoice.invoiceNumber})
                </a>
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
