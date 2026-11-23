import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Eye,
  Languages,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { computeProposalTotals } from '../core/taxAndPricing.ts';
import type { Locale } from '../core/types.ts';
import {
  ApiError,
  approvePublicProposal,
  getPublicProposal,
  type ProposalBundle,
} from '../lib/api.ts';
import {
  classificationLabel,
  formatMoney,
  getCopy,
  taxRegimeLabel,
} from '../lib/i18n.ts';
import { SignaturePad } from './SignaturePad.tsx';
import { TaxInvoiceView } from './TaxInvoiceView.tsx';

interface ClientPortalViewProps {
  slug: string;
  locale: Locale;
  theme: 'alabaster' | 'obsidian';
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  onBackToStudio?: () => void;
}

export function ClientPortalView({
  slug,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  onBackToStudio,
}: ClientPortalViewProps) {
  const copy = getCopy(locale);
  const [bundle, setBundle] = useState<ProposalBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedTierId, setSelectedTierId] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [scopeAccepted, setScopeAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    setSubmitError('');
    getPublicProposal(slug)
      .then((res) => {
        if (cancelled) return;
        setBundle(res);
        setSelectedTierId(res.proposal.selectedTierId || res.proposal.tiers[0]?.id || '');
        setSelectedAddonIds(res.proposal.selectedAddonIds ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setBundle(null);
        setErrorMsg(err instanceof Error ? err.message : copy.notFoundBody);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, copy.notFoundBody]);

  const totals = useMemo(() => {
    if (!bundle) return null;
    return computeProposalTotals(bundle.proposal, selectedTierId, selectedAddonIds);
  }, [bundle, selectedTierId, selectedAddonIds]);

  function toggleAddon(addonId: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId],
    );
  }

  async function handleApproveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle || submitting) return;
    setSubmitError('');

    if (signerName.trim().length < 2) {
      setSubmitError(
        locale === 'ar'
          ? 'يرجى كتابة الاسم الكامل للمفوّض بالتوقيع (حرفين على الأقل).'
          : 'Please enter the authorized signer full name (at least 2 characters).',
      );
      return;
    }
    if (signatureType === 'drawn' && !signatureDataUrl.startsWith('data:image/png;base64,')) {
      setSubmitError(
        locale === 'ar'
          ? 'يرجى رسم التوقيع داخل المربع أو التبديل إلى التوقيع المكتوب.'
          : 'Please draw your signature on the canvas or switch to typed signature.',
      );
      return;
    }
    if (!scopeAccepted) {
      setSubmitError(
        locale === 'ar'
          ? 'يجب تأكيد الموافقة على نطاق العمل والمستثنيات قبل الاعتماد.'
          : 'Please check the scope lock confirmation box before signing.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const approved = await approvePublicProposal(slug, {
        selectedTierId,
        selectedAddonIds,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || undefined,
        signerEmail: signerEmail.trim() || undefined,
        signatureType,
        signatureDataUrl: signatureType === 'drawn' ? signatureDataUrl : undefined,
        scopeAccepted: true,
      });
      setBundle(approved);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Approval failed';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center text-sm text-[var(--text-secondary)]">
        {copy.loadingLabel}
      </div>
    );
  }

  if (!bundle || !totals) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="aqd-card rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--accent-amber)]" />
          <h1 className="aqd-display text-xl font-bold text-[var(--text-primary)]">
            {copy.notFoundTitle}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{errorMsg || copy.notFoundBody}</p>
          {onBackToStudio && (
            <button
              type="button"
              onClick={onBackToStudio}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-primary-fg)]"
            >
              <BackIcon className="h-4 w-4" />
              {copy.backToStudio}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { proposal } = bundle;
  const sellerName =
    locale === 'ar'
      ? proposal.seller.nameAr || proposal.seller.nameEn
      : proposal.seller.nameEn || proposal.seller.nameAr;
  const clientName =
    locale === 'ar'
      ? proposal.client.nameAr || proposal.client.nameEn
      : proposal.client.nameEn || proposal.client.nameAr;
  const title = locale === 'ar' ? proposal.titleAr : proposal.titleEn;
  const subtitle = locale === 'ar' ? proposal.subtitleAr : proposal.subtitleEn;

  const includedDeliverables = proposal.deliverables.filter((d) => d.included);
  const excludedDeliverables = proposal.deliverables.filter((d) => !d.included);

  if (bundle.invoice && proposal.status === 'invoiced') {
    return (
      <div className="mx-auto max-w-5xl space-y-5 py-6 px-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-seal)]/35 bg-[var(--accent-seal-soft)] px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--accent-seal)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{copy.alreadyApprovedBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLocale}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <Languages className="h-3.5 w-3.5" />
              {copy.langSwitch}
            </button>
          </div>
        </div>
        <TaxInvoiceView
          invoice={bundle.invoice}
          proposal={proposal}
          approval={bundle.approval}
          locale={locale}
          onBackToStudio={onBackToStudio}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6 px-4" data-testid="client-portal-view">
      {/* Portal Top Bar */}
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBackToStudio && (
            <button
              type="button"
              onClick={onBackToStudio}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <BackIcon className="h-4 w-4" />
              {copy.backToStudio}
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {copy.brandName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLocale}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            data-testid="portal-locale-toggle"
          >
            <Languages className="h-3.5 w-3.5" />
            {copy.langSwitch}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            {theme === 'alabaster' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {theme === 'alabaster' ? copy.themeObsidian : copy.themeAlabaster}
          </button>
        </div>
      </header>

      {/* Proposal Hero Card */}
      <section className="aqd-card rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {copy.portalPreparedFor}{' '}
              <strong className="text-[var(--text-primary)]">{clientName || '—'}</strong>
            </span>
            <span>•</span>
            <span>
              {copy.portalFrom}{' '}
              <strong className="text-[var(--text-primary)]">{sellerName || '—'}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="num-tabular rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1">
              {copy.portalValidity}: {proposal.validityDays} {copy.daysSuffix}
            </span>
            <span className="num-tabular inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1">
              <Eye className="h-3.5 w-3.5" />
              {copy.portalViews}: {bundle.viewCount}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="aqd-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-3xl text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-secondary)]">
          <span>{taxRegimeLabel(proposal.taxRegime, locale)}</span>
          <span>•</span>
          <span>{classificationLabel(totals.invoiceClassification, locale)}</span>
        </div>
      </section>

      {/* Main Layout: Packages + Scope vs Summary + E-Sign */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          {/* Interactive Pricing Tiers */}
          <section className="space-y-4">
            <h2 className="aqd-display text-lg font-bold text-[var(--text-primary)]">
              {copy.choosePackageTitle}
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {proposal.tiers.map((tier) => {
                const isSelected = tier.id === totals.selectedTier.id;
                const features = locale === 'ar' ? tier.featuresAr : tier.featuresEn;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    data-testid={`portal-tier-${tier.id}`}
                    className={`w-full rounded-2xl border p-5 text-start transition ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)] ring-2 ring-[var(--accent-primary)]/20'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="aqd-display text-base font-extrabold text-[var(--text-primary)]">
                            {locale === 'ar' ? tier.nameAr : tier.nameEn}
                          </span>
                          {tier.recommended && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-amber-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-amber)]">
                              <Sparkles className="h-3 w-3" />
                              {copy.recommendedBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                          {locale === 'ar' ? tier.summaryAr : tier.summaryEn}
                        </p>
                      </div>
                      <div className="text-end">
                        <div className="num-tabular aqd-display text-xl font-extrabold text-[var(--accent-primary)]">
                          {formatMoney(tier.price, proposal.currency, locale)}
                        </div>
                        <div className="num-tabular text-xs text-[var(--text-secondary)]">
                          {tier.deliveryDays} {copy.daysUnit}
                        </div>
                      </div>
                    </div>

                    {features.length > 0 && (
                      <ul className="mt-4 grid grid-cols-1 gap-1.5 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2">
                        {features.map((feat, idx) => (
                          <li
                            key={`${tier.id}-f-${idx}`}
                            className="flex items-start gap-2 text-xs text-[var(--text-primary)]"
                          >
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-seal)]" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Optional Add-ons */}
          {proposal.addons.length > 0 && (
            <section className="space-y-3">
              <h2 className="aqd-display text-lg font-bold text-[var(--text-primary)]">
                {copy.optionalAddonsTitle}
              </h2>
              <div className="space-y-2.5">
                {proposal.addons.map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  const qty = Math.max(1, addon.quantity);
                  return (
                    <label
                      key={addon.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition ${
                        checked
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-soft)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(addon.id)}
                          data-testid={`portal-addon-${addon.id}`}
                          className="h-4 w-4 accent-[var(--accent-primary)]"
                        />
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {locale === 'ar' ? addon.titleAr : addon.titleEn}
                          </div>
                          {qty > 1 && (
                            <div className="text-xs text-[var(--text-secondary)]">
                              {copy.quantityLabel}: {qty}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="num-tabular text-sm font-bold text-[var(--text-primary)]">
                        + {formatMoney(addon.price * qty, proposal.currency, locale)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Scope Lock Section */}
          <section className="aqd-card rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="aqd-display flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                <Lock className="h-4 w-4 text-[var(--accent-primary)]" />
                {copy.scopeLockTitle}
              </h2>
              <span className="num-tabular rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
                {copy.revisionCapLabel}: {proposal.revisionRounds} {copy.roundsSuffix}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-[var(--accent-seal)]/25 bg-[var(--accent-seal-soft)] p-4">
                <div className="text-xs font-bold text-[var(--accent-seal)]">
                  {copy.scopeIncludedBadge}
                </div>
                <ul className="space-y-2">
                  {includedDeliverables.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text-primary)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-seal)]" />
                      <span>{locale === 'ar' ? item.titleAr : item.titleEn}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 rounded-xl border border-[var(--accent-amber)]/25 bg-[var(--accent-amber-soft)] p-4">
                <div className="text-xs font-bold text-[var(--accent-amber)]">
                  {copy.scopeExcludedBadge}
                </div>
                <ul className="space-y-2">
                  {excludedDeliverables.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text-primary)]">
                      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-amber)]" />
                      <span>{locale === 'ar' ? item.titleAr : item.titleEn}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {(proposal.notesAr || proposal.notesEn) && (
              <p className="text-xs text-[var(--text-secondary)]">
                {locale === 'ar'
                  ? proposal.notesAr || proposal.notesEn
                  : proposal.notesEn || proposal.notesAr}
              </p>
            )}
          </section>
        </div>

        {/* Sticky Investment Summary & E-Sign Column */}
        <aside className="lg:col-span-5">
          <div className="aqd-card sticky top-5 rounded-2xl p-6 space-y-6">
            <div className="space-y-3 border-b border-[var(--border-subtle)] pb-5">
              <h2 className="aqd-display text-lg font-bold text-[var(--text-primary)]">
                {copy.investmentSummaryTitle}
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{copy.packageSubtotal}</span>
                  <span className="num-tabular font-semibold">
                    {formatMoney(totals.tierSubtotal, proposal.currency, locale)}
                  </span>
                </div>
                {totals.addonsSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">{copy.addonsSubtotal}</span>
                    <span className="num-tabular font-semibold">
                      {formatMoney(totals.addonsSubtotal, proposal.currency, locale)}
                    </span>
                  </div>
                )}
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-[var(--accent-seal)]">
                    <span>{copy.discountRow}</span>
                    <span className="num-tabular font-semibold">
                      - {formatMoney(totals.discountAmount, proposal.currency, locale)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{copy.netBeforeTax}</span>
                  <span className="num-tabular font-semibold">
                    {formatMoney(totals.taxableSubtotal, proposal.currency, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    {copy.taxRow} ({Math.round(totals.taxRate * 100)}%)
                  </span>
                  <span className="num-tabular font-semibold">
                    {formatMoney(totals.taxAmount, proposal.currency, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2.5 text-base font-bold">
                  <span>{copy.grandTotalRow}</span>
                  <span className="num-tabular" data-testid="portal-grand-total">
                    {formatMoney(totals.grandTotal, proposal.currency, locale)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--bg-soft)] p-3.5 space-y-1">
                <div className="flex items-center justify-between text-sm font-bold text-[var(--accent-primary)]">
                  <span>
                    {copy.depositDueNow} ({totals.depositPercent}%)
                  </span>
                  <span className="num-tabular text-lg" data-testid="portal-deposit-due">
                    {formatMoney(totals.depositAmount, proposal.currency, locale)}
                  </span>
                </div>
                {totals.balanceAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{copy.balanceOnDelivery}</span>
                    <span className="num-tabular">
                      {formatMoney(totals.balanceAmount, proposal.currency, locale)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* E-Sign & Scope Approval Form */}
            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <h3 className="aqd-display text-base font-bold text-[var(--text-primary)]">
                {copy.approvalFormTitle}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    {copy.signerNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder={locale === 'ar' ? 'مثال: سارة المنصوري' : 'e.g. Sarah Al Mansoori'}
                    className="aqd-input"
                    data-testid="signer-name-input"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.signerTitleLabel}
                    </label>
                    <input
                      type="text"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      className="aqd-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.signerEmailLabel}
                    </label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      dir="ltr"
                      className="aqd-input"
                    />
                  </div>
                </div>
              </div>

              <SignaturePad
                locale={locale}
                signerName={signerName}
                mode={signatureType}
                onModeChange={setSignatureType}
                drawnDataUrl={signatureDataUrl}
                onDrawnChange={setSignatureDataUrl}
              />

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={scopeAccepted}
                  onChange={(e) => setScopeAccepted(e.target.checked)}
                  data-testid="scope-accept-checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
                />
                <span>{copy.scopeConfirmText}</span>
              </label>

              {submitError && (
                <div className="rounded-xl bg-[var(--danger-soft)] p-3 text-xs font-semibold text-[var(--danger-text)]">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="approve-proposal-btn"
                className="w-full rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-[var(--accent-primary-fg)] transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
              >
                {submitting ? copy.approvingBtn : copy.approveAndIssueBtn}
              </button>
            </form>
          </div>
        </aside>
      </div>

      <footer className="pb-6 text-center text-xs text-[var(--text-secondary)]">
        {copy.poweredBy}
      </footer>
    </div>
  );
}
