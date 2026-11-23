import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  MessageCircle,
  Plus,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { computeProposalTotals } from '../core/taxAndPricing.ts';
import { buildProposalWhatsAppUrl } from '../core/templates.ts';
import { withBase } from '../lib/basePath.ts';
import type {
  CurrencyCode,
  GeneratedInvoice,
  Locale,
  Proposal,
  TaxRegime,
} from '../core/types.ts';
import {
  ApiError,
  duplicateProposal,
  getProposal,
  publishProposal,
  updateProposal,
} from '../lib/api.ts';
import {
  classificationLabel,
  formatMoney,
  getCopy,
  statusLabel,
} from '../lib/i18n.ts';

interface ProposalEditorProps {
  proposalId: string;
  locale: Locale;
  onBack: () => void;
  onSelectProposalId: (newId: string) => void;
  onOpenPortal: (slug: string) => void;
  onOpenInvoice: (invoiceNumber: string) => void;
  onProposalChanged: () => void;
}

type EditorTab = 'basics' | 'packages' | 'scope';

export function ProposalEditor({
  proposalId,
  locale,
  onBack,
  onSelectProposalId,
  onOpenPortal,
  onOpenInvoice,
  onProposalChanged,
}: ProposalEditorProps) {
  const copy = getCopy(locale);
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [invoice, setInvoice] = useState<GeneratedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedPortalNotice, setCopiedPortalNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('basics');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    getProposal(proposalId)
      .then((bundle) => {
        if (cancelled) return;
        setDraft(bundle.proposal);
        setInvoice(bundle.invoice);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : copy.notFoundBody);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [proposalId, copy.notFoundBody]);

  const totals = useMemo(() => (draft ? computeProposalTotals(draft) : null), [draft]);

  const isLocked = draft ? draft.status === 'approved' || draft.status === 'invoiced' : false;

  async function handleSave(): Promise<Proposal | null> {
    if (!draft || isLocked) return draft;
    setSaving(true);
    setErrorMsg('');
    try {
      const updatedBundle = await updateProposal(draft.id, draft);
      setDraft(updatedBundle.proposal);
      setInvoice(updatedBundle.invoice);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
      onProposalChanged();
      return updatedBundle.proposal;
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishAndCopy() {
    if (!draft) return;
    setErrorMsg('');
    try {
      const saved = isLocked ? draft : await handleSave();
      if (!saved) return;
      const pubBundle = await publishProposal(saved.id);
      setDraft(pubBundle.proposal);
      onProposalChanged();
      const url = pubBundle.portalUrl || `${window.location.origin}${withBase(`/p/${pubBundle.proposal.slug}`)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedPortalNotice(true);
        setTimeout(() => setCopiedPortalNotice(false), 2200);
      } catch {
        // clipboard may be blocked in headless environments
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  async function handlePreviewPortal() {
    if (!draft) return;
    setErrorMsg('');
    try {
      if (draft.status === 'draft') {
        const saved = await handleSave();
        if (!saved) return;
        const pub = await publishProposal(saved.id);
        setDraft(pub.proposal);
        onProposalChanged();
        onOpenPortal(pub.proposal.slug);
        return;
      }
      if (!isLocked) {
        const saved = await handleSave();
        if (saved) {
          onOpenPortal(saved.slug);
          return;
        }
      }
      onOpenPortal(draft.slug);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to open portal');
    }
  }

  async function handleDuplicate() {
    if (!draft) return;
    try {
      const cloned = await duplicateProposal(draft.id);
      onProposalChanged();
      onSelectProposalId(cloned.proposal.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Duplicate failed');
    }
  }

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
        {copy.loadingLabel}
      </div>
    );
  }

  if (!draft || !totals) {
    return (
      <div className="aqd-card rounded-2xl p-8 text-center space-y-4">
        <p className="text-sm text-[var(--danger-text)]">{errorMsg || copy.notFoundBody}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 py-2 text-sm"
        >
          <BackIcon className="h-4 w-4" />
          {copy.backToStudio}
        </button>
      </div>
    );
  }

  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${withBase(`/p/${draft.slug}`)}`;
  const whatsappUrl = buildProposalWhatsAppUrl(draft, portalUrl, locale);

  const includedList = draft.deliverables.filter((d) => d.included);
  const excludedList = draft.deliverables.filter((d) => !d.included);

  function addTier() {
    if (!draft || isLocked) return;
    const id = `tier-${Date.now().toString(36)}`;
    setDraft({
      ...draft,
      tiers: [
        ...draft.tiers,
        {
          id,
          nameAr: 'باقة جديدة',
          nameEn: 'New Package',
          summaryAr: 'وصف مختصر للباقة',
          summaryEn: 'Short tier summary',
          price: 3000,
          deliveryDays: 14,
          featuresAr: ['بند تنفيذي رئيسي'],
          featuresEn: ['Core deliverable'],
        },
      ],
    });
  }

  function removeTier(tierId: string) {
    if (!draft || isLocked || draft.tiers.length <= 1) return;
    const nextTiers = draft.tiers.filter((t) => t.id !== tierId);
    const nextSelected =
      draft.selectedTierId === tierId ? nextTiers[0]?.id ?? '' : draft.selectedTierId;
    setDraft({ ...draft, tiers: nextTiers, selectedTierId: nextSelected });
  }

  function addAddon() {
    if (!draft || isLocked) return;
    const id = `addon-${Date.now().toString(36)}`;
    setDraft({
      ...draft,
      addons: [
        ...draft.addons,
        {
          id,
          titleAr: 'إضافة اختيارية جديدة',
          titleEn: 'New Optional Add-on',
          price: 800,
          quantity: 1,
        },
      ],
    });
  }

  function removeAddon(addonId: string) {
    if (!draft || isLocked) return;
    setDraft({
      ...draft,
      addons: draft.addons.filter((a) => a.id !== addonId),
      selectedAddonIds: draft.selectedAddonIds.filter((id) => id !== addonId),
    });
  }

  function addDeliverable(included: boolean) {
    if (!draft || isLocked) return;
    const id = `${included ? 'del' : 'exc'}-${Date.now().toString(36)}`;
    setDraft({
      ...draft,
      deliverables: [
        ...draft.deliverables,
        {
          id,
          titleAr: included ? 'مخرج جديد ضمن النطاق' : 'مستثنى: بند خارج النطاق المتفق عليه',
          titleEn: included ? 'New included deliverable' : 'Excluded: Out-of-scope item',
          included,
        },
      ],
    });
  }

  function updateDeliverable(id: string, field: 'titleAr' | 'titleEn', val: string) {
    if (!draft || isLocked) return;
    setDraft({
      ...draft,
      deliverables: draft.deliverables.map((d) => (d.id === id ? { ...d, [field]: val } : d)),
    });
  }

  function removeDeliverable(id: string) {
    if (!draft || isLocked) return;
    setDraft({ ...draft, deliverables: draft.deliverables.filter((d) => d.id !== id) });
  }

  return (
    <div className="space-y-6" data-testid="proposal-editor">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <BackIcon className="h-4 w-4" />
            {copy.backToStudio}
          </button>
          <div>
            <h1 className="aqd-display text-lg sm:text-xl font-extrabold text-[var(--text-primary)]">
              {locale === 'ar' ? draft.titleAr : draft.titleEn}
            </h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{statusLabel(draft.status, locale)}</span>
              <span>•</span>
              <span dir="ltr">/p/{draft.slug}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDuplicate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          <Copy className="h-4 w-4" />
          {copy.duplicateProposal}
        </button>
      </div>

      {/* Locked Banner */}
      {isLocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-seal)]/40 bg-[var(--accent-seal-soft)] p-4">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--accent-seal)]">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{copy.lockedBanner}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice && (
              <button
                type="button"
                onClick={() => onOpenInvoice(invoice.invoiceNumber)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-bold text-white"
              >
                <FileText className="h-3.5 w-3.5" />
                {copy.viewInvoice} ({invoice.invoiceNumber})
              </button>
            )}
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copy.cloneToEdit}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-xs sm:text-sm font-semibold text-[var(--danger-text)]">
          {errorMsg}
        </div>
      )}

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5">
            {(
              [
                ['basics', copy.tabBasics],
                ['packages', copy.tabPackages],
                ['scope', copy.tabScopePayment],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                data-testid={`editor-tab-${tabKey}`}
                className={`flex-1 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition ${
                  activeTab === tabKey
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 1: Basics & Parties */}
          {activeTab === 'basics' && (
            <div className="space-y-5">
              <section className="aqd-card rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.proposalTitleAr}
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={draft.titleAr}
                      onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })}
                      className="aqd-input"
                      data-testid="input-title-ar"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.proposalTitleEn}
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      value={draft.titleEn}
                      onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
                      className="aqd-input"
                      data-testid="input-title-en"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.proposalSubtitleAr}
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={draft.subtitleAr}
                      onChange={(e) => setDraft({ ...draft, subtitleAr: e.target.value })}
                      className="aqd-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.proposalSubtitleEn}
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      dir="ltr"
                      value={draft.subtitleEn}
                      onChange={(e) => setDraft({ ...draft, subtitleEn: e.target.value })}
                      className="aqd-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.slugLabel}
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      value={draft.slug}
                      onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                      className="aqd-input font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.currencyLabel}
                    </label>
                    <select
                      disabled={isLocked}
                      value={draft.currency}
                      onChange={(e) =>
                        setDraft({ ...draft, currency: e.target.value as CurrencyCode })
                      }
                      className="aqd-input"
                    >
                      <option value="AED">AED (د.إ)</option>
                      <option value="SAR">SAR (ر.س)</option>
                      <option value="USD">USD ($)</option>
                      <option value="QAR">QAR</option>
                      <option value="KWD">KWD</option>
                      <option value="EGP">EGP</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.taxRegimeLabel}
                    </label>
                    <select
                      disabled={isLocked}
                      value={draft.taxRegime}
                      onChange={(e) =>
                        setDraft({ ...draft, taxRegime: e.target.value as TaxRegime })
                      }
                      className="aqd-input"
                      data-testid="select-tax-regime"
                    >
                      <option value="uae_fta_5">UAE FTA VAT (5%)</option>
                      <option value="ksa_zatca_15">KSA ZATCA (15% + QR)</option>
                      <option value="none">No VAT (0%)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.depositPercentLabel}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={isLocked}
                      value={draft.depositPercent}
                      onChange={(e) =>
                        setDraft({ ...draft, depositPercent: Number(e.target.value) || 0 })
                      }
                      className="aqd-input num-tabular"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.revisionRoundsLabel}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      disabled={isLocked}
                      value={draft.revisionRounds}
                      onChange={(e) =>
                        setDraft({ ...draft, revisionRounds: Number(e.target.value) || 0 })
                      }
                      className="aqd-input num-tabular"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                      {copy.validityDaysLabel}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      disabled={isLocked}
                      value={draft.validityDays}
                      onChange={(e) =>
                        setDraft({ ...draft, validityDays: Number(e.target.value) || 14 })
                      }
                      className="aqd-input num-tabular"
                    />
                  </div>
                </div>
              </section>

              {/* Seller & Client Cards */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <section className="aqd-card rounded-2xl p-5 space-y-3">
                  <h2 className="aqd-display text-sm font-bold text-[var(--text-primary)]">
                    {copy.sellerCardTitle}
                  </h2>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.nameArLabel}
                    value={draft.seller.nameAr}
                    onChange={(e) =>
                      setDraft({ ...draft, seller: { ...draft.seller, nameAr: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.nameEnLabel}
                    value={draft.seller.nameEn}
                    onChange={(e) =>
                      setDraft({ ...draft, seller: { ...draft.seller, nameEn: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.addressArLabel}
                    value={draft.seller.addressAr}
                    onChange={(e) =>
                      setDraft({ ...draft, seller: { ...draft.seller, addressAr: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.addressEnLabel}
                    value={draft.seller.addressEn}
                    onChange={(e) =>
                      setDraft({ ...draft, seller: { ...draft.seller, addressEn: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.trnLabel}
                    value={draft.seller.trn ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, seller: { ...draft.seller, trn: e.target.value } })
                    }
                    className="aqd-input font-mono"
                    data-testid="input-seller-trn"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={copy.emailLabel}
                      value={draft.seller.email ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, seller: { ...draft.seller, email: e.target.value } })
                      }
                      className="aqd-input text-xs"
                    />
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={copy.phoneLabel}
                      value={draft.seller.phone ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, seller: { ...draft.seller, phone: e.target.value } })
                      }
                      className="aqd-input text-xs"
                    />
                  </div>
                </section>

                <section className="aqd-card rounded-2xl p-5 space-y-3">
                  <h2 className="aqd-display text-sm font-bold text-[var(--text-primary)]">
                    {copy.clientCardTitle}
                  </h2>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.nameArLabel}
                    value={draft.client.nameAr}
                    onChange={(e) =>
                      setDraft({ ...draft, client: { ...draft.client, nameAr: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.nameEnLabel}
                    value={draft.client.nameEn}
                    onChange={(e) =>
                      setDraft({ ...draft, client: { ...draft.client, nameEn: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.addressArLabel}
                    value={draft.client.addressAr}
                    onChange={(e) =>
                      setDraft({ ...draft, client: { ...draft.client, addressAr: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.addressEnLabel}
                    value={draft.client.addressEn}
                    onChange={(e) =>
                      setDraft({ ...draft, client: { ...draft.client, addressEn: e.target.value } })
                    }
                    className="aqd-input"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={Boolean(draft.client.vatRegistered)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          client: { ...draft.client, vatRegistered: e.target.checked },
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    {copy.vatRegisteredLabel}
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.trnLabel}
                    value={draft.client.trn ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, client: { ...draft.client, trn: e.target.value } })
                    }
                    className="aqd-input font-mono"
                    data-testid="input-client-trn"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={copy.emailLabel}
                      value={draft.client.email ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, client: { ...draft.client, email: e.target.value } })
                      }
                      className="aqd-input text-xs"
                    />
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={copy.phoneLabel}
                      value={draft.client.phone ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, client: { ...draft.client, phone: e.target.value } })
                      }
                      className="aqd-input text-xs"
                    />
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Tab 2: Packages, Add-ons & Discount */}
          {activeTab === 'packages' && (
            <div className="space-y-5">
              <section className="aqd-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="aqd-display text-base font-bold">{copy.tiersSectionTitle}</h2>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={addTier}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {copy.addTier}
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {draft.tiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="radio"
                              name="defaultTier"
                              disabled={isLocked}
                              checked={draft.selectedTierId === tier.id}
                              onChange={() => setDraft({ ...draft, selectedTierId: tier.id })}
                            />
                            {locale === 'ar' ? 'الباقة الافتراضية' : 'Default Tier'}
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-[var(--accent-amber)]">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={Boolean(tier.recommended)}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  tiers: draft.tiers.map((t) =>
                                    t.id === tier.id ? { ...t, recommended: e.target.checked } : t,
                                  ),
                                })
                              }
                            />
                            {copy.recommendedTier}
                          </label>
                        </div>
                        {!isLocked && draft.tiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTier(tier.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--danger-text)] hover:bg-[var(--danger-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {copy.deleteProposal}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <input
                          type="text"
                          disabled={isLocked}
                          placeholder={copy.nameArLabel}
                          value={tier.nameAr}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id ? { ...t, nameAr: e.target.value } : t,
                              ),
                            })
                          }
                          className="aqd-input"
                        />
                        <input
                          type="text"
                          disabled={isLocked}
                          dir="ltr"
                          placeholder={copy.nameEnLabel}
                          value={tier.nameEn}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id ? { ...t, nameEn: e.target.value } : t,
                              ),
                            })
                          }
                          className="aqd-input"
                        />
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          placeholder={copy.tierPrice}
                          value={tier.price}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id
                                  ? { ...t, price: Number(e.target.value) || 0 }
                                  : t,
                              ),
                            })
                          }
                          className="aqd-input num-tabular"
                        />
                        <input
                          type="number"
                          min={1}
                          disabled={isLocked}
                          placeholder={copy.deliveryDays}
                          value={tier.deliveryDays}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id
                                  ? { ...t, deliveryDays: Number(e.target.value) || 1 }
                                  : t,
                              ),
                            })
                          }
                          className="aqd-input num-tabular"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <textarea
                          rows={2}
                          disabled={isLocked}
                          placeholder={copy.featuresArLabel}
                          value={tier.featuresAr.join('\n')}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id
                                  ? {
                                      ...t,
                                      featuresAr: e.target.value
                                        .split('\n')
                                        .filter((line) => line.trim() !== ''),
                                    }
                                  : t,
                              ),
                            })
                          }
                          className="aqd-input text-xs"
                        />
                        <textarea
                          rows={2}
                          disabled={isLocked}
                          dir="ltr"
                          placeholder={copy.featuresEnLabel}
                          value={tier.featuresEn.join('\n')}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              tiers: draft.tiers.map((t) =>
                                t.id === tier.id
                                  ? {
                                      ...t,
                                      featuresEn: e.target.value
                                        .split('\n')
                                        .filter((line) => line.trim() !== ''),
                                    }
                                  : t,
                              ),
                            })
                          }
                          className="aqd-input text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Addons */}
              <section className="aqd-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="aqd-display text-base font-bold">{copy.addonsSectionTitle}</h2>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={addAddon}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3 py-1.5 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {copy.addAddon}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {draft.addons.map((addon) => (
                    <div
                      key={addon.id}
                      className="grid grid-cols-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 sm:grid-cols-12"
                    >
                      <input
                        type="text"
                        disabled={isLocked}
                        value={addon.titleAr}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            addons: draft.addons.map((a) =>
                              a.id === addon.id ? { ...a, titleAr: e.target.value } : a,
                            ),
                          })
                        }
                        className="aqd-input sm:col-span-4 text-xs"
                      />
                      <input
                        type="text"
                        disabled={isLocked}
                        dir="ltr"
                        value={addon.titleEn}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            addons: draft.addons.map((a) =>
                              a.id === addon.id ? { ...a, titleEn: e.target.value } : a,
                            ),
                          })
                        }
                        className="aqd-input sm:col-span-4 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        disabled={isLocked}
                        value={addon.price}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            addons: draft.addons.map((a) =>
                              a.id === addon.id ? { ...a, price: Number(e.target.value) || 0 } : a,
                            ),
                          })
                        }
                        className="aqd-input num-tabular sm:col-span-2 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        disabled={isLocked}
                        value={addon.quantity}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            addons: draft.addons.map((a) =>
                              a.id === addon.id
                                ? { ...a, quantity: Math.max(1, Number(e.target.value) || 1) }
                                : a,
                            ),
                          })
                        }
                        className="aqd-input num-tabular sm:col-span-1 text-xs"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeAddon(addon.id)}
                          aria-label="Remove addon"
                          className="inline-flex justify-center rounded-lg p-2 text-[var(--danger-text)] hover:bg-[var(--danger-soft)] sm:col-span-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Discount */}
              <section className="aqd-card rounded-2xl p-5 space-y-3">
                <h2 className="aqd-display text-base font-bold">{copy.discountSectionTitle}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    disabled={isLocked}
                    value={draft.discount ? draft.discount.type : 'none'}
                    onChange={(e) => {
                      const mode = e.target.value;
                      if (mode === 'none') {
                        setDraft({ ...draft, discount: undefined });
                      } else {
                        setDraft({
                          ...draft,
                          discount: {
                            type: mode === 'fixed' ? 'fixed' : 'percent',
                            value: draft.discount?.value ?? 10,
                          },
                        });
                      }
                    }}
                    className="aqd-input"
                  >
                    <option value="none">{copy.discountNone}</option>
                    <option value="percent">{copy.discountPercent}</option>
                    <option value="fixed">{copy.discountFixed}</option>
                  </select>
                  {draft.discount && (
                    <input
                      type="number"
                      min={0}
                      disabled={isLocked}
                      value={draft.discount.value}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          discount: {
                            type: draft.discount!.type,
                            value: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="aqd-input num-tabular"
                    />
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Tab 3: Scope Lock & Payment Channels */}
          {activeTab === 'scope' && (
            <div className="space-y-5">
              {/* Included Deliverables */}
              <section className="aqd-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="aqd-display text-base font-bold text-[var(--accent-seal)]">
                    {copy.deliverablesIncludedTitle}
                  </h2>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => addDeliverable(true)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] px-3 py-1.5 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {copy.addIncludedItem}
                    </button>
                  )}
                </div>
                {includedList.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 gap-2 sm:grid-cols-11">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={item.titleAr}
                      onChange={(e) => updateDeliverable(item.id, 'titleAr', e.target.value)}
                      className="aqd-input sm:col-span-5 text-xs"
                    />
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      value={item.titleEn}
                      onChange={(e) => updateDeliverable(item.id, 'titleEn', e.target.value)}
                      className="aqd-input sm:col-span-5 text-xs"
                    />
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => removeDeliverable(item.id)}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--danger-text)] hover:bg-[var(--danger-soft)] sm:col-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {/* Explicit Exclusions */}
              <section className="aqd-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="aqd-display text-base font-bold text-[var(--accent-amber)]">
                    {copy.deliverablesExcludedTitle}
                  </h2>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => addDeliverable(false)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] px-3 py-1.5 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {copy.addExcludedItem}
                    </button>
                  )}
                </div>
                {excludedList.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 gap-2 sm:grid-cols-11">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={item.titleAr}
                      onChange={(e) => updateDeliverable(item.id, 'titleAr', e.target.value)}
                      className="aqd-input sm:col-span-5 text-xs"
                    />
                    <input
                      type="text"
                      disabled={isLocked}
                      dir="ltr"
                      value={item.titleEn}
                      onChange={(e) => updateDeliverable(item.id, 'titleEn', e.target.value)}
                      className="aqd-input sm:col-span-5 text-xs"
                    />
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => removeDeliverable(item.id)}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--danger-text)] hover:bg-[var(--danger-soft)] sm:col-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </section>

              {/* Payment Channels */}
              <section className="aqd-card rounded-2xl p-5 space-y-3">
                <h2 className="aqd-display text-base font-bold">{copy.paymentChannelsTitle}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.ibanLabel}
                    value={draft.paymentChannels.iban ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, iban: e.target.value },
                      })
                    }
                    className="aqd-input font-mono text-xs"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.bankNameArLabel}
                    value={draft.paymentChannels.bankNameAr ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, bankNameAr: e.target.value },
                      })
                    }
                    className="aqd-input text-xs"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.aaniLabel}
                    value={draft.paymentChannels.aani ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, aani: e.target.value },
                      })
                    }
                    className="aqd-input text-xs"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.stcPayLabel}
                    value={draft.paymentChannels.stcPay ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, stcPay: e.target.value },
                      })
                    }
                    className="aqd-input text-xs"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    dir="ltr"
                    placeholder={copy.instapayLabel}
                    value={draft.paymentChannels.instapay ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, instapay: e.target.value },
                      })
                    }
                    className="aqd-input text-xs"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder={copy.paymentNoteArLabel}
                    value={draft.paymentChannels.paymentNoteAr ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paymentChannels: { ...draft.paymentChannels, paymentNoteAr: e.target.value },
                      })
                    }
                    className="aqd-input text-xs"
                  />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Right Live Summary + Actions */}
        <aside className="space-y-5 lg:col-span-4">
          <div className="aqd-card sticky top-5 rounded-2xl p-5 space-y-5">
            <div className="space-y-2.5">
              <h2 className="aqd-display text-base font-bold">{copy.liveSummaryTitle}</h2>
              <div className="text-xs text-[var(--text-secondary)]">
                {classificationLabel(totals.invoiceClassification, locale)}
              </div>

              <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{copy.packageSubtotal}</span>
                  <span className="num-tabular font-semibold">
                    {formatMoney(totals.tierSubtotal, draft.currency, locale)}
                  </span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-[var(--accent-seal)]">
                    <span>{copy.discountRow}</span>
                    <span className="num-tabular font-semibold">
                      - {formatMoney(totals.discountAmount, draft.currency, locale)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    {copy.taxRow} ({Math.round(totals.taxRate * 100)}%)
                  </span>
                  <span className="num-tabular font-semibold">
                    {formatMoney(totals.taxAmount, draft.currency, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2 font-bold">
                  <span>{copy.grandTotalRow}</span>
                  <span className="num-tabular" data-testid="editor-grand-total">
                    {formatMoney(totals.grandTotal, draft.currency, locale)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[var(--accent-primary)]">
                  <span>
                    {copy.depositDueNow} ({totals.depositPercent}%)
                  </span>
                  <span className="num-tabular">
                    {formatMoney(totals.depositAmount, draft.currency, locale)}
                  </span>
                </div>
              </div>
            </div>

            {/* Compliance Inspector */}
            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <div className="text-xs font-bold text-[var(--text-primary)]">
                {copy.complianceTitle}
              </div>
              {totals.warnings.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-[var(--accent-seal-soft)] p-3 text-xs font-semibold text-[var(--accent-seal)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{copy.complianceReady}</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="compliance-warnings">
                  {totals.warnings.map((w) => (
                    <div
                      key={w.code}
                      className="flex items-start gap-2 rounded-xl bg-[var(--accent-amber-soft)] p-2.5 text-xs text-[var(--text-primary)]"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-amber)]" />
                      <span>{locale === 'ar' ? w.messageAr : w.messageEn}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="save-draft-btn"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-soft)]"
                >
                  {savedNotice ? (
                    <>
                      <Check className="h-4 w-4 text-[var(--accent-seal)]" />
                      {copy.saved}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {saving ? copy.saving : copy.saveDraft}
                    </>
                  )}
                </button>
              )}

              {!isLocked && (
                <button
                  type="button"
                  onClick={handlePublishAndCopy}
                  data-testid="publish-copy-btn"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
                >
                  {copiedPortalNotice ? (
                    <>
                      <Check className="h-4 w-4" />
                      {copy.copiedLink}
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      {copy.publishAndCopy}
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handlePreviewPortal}
                data-testid="preview-portal-btn"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent-primary)] px-4 py-2.5 text-sm font-bold text-[var(--accent-primary)] hover:bg-[var(--bg-soft)]"
              >
                <ExternalLink className="h-4 w-4" />
                {copy.previewPortal}
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              >
                <MessageCircle className="h-4 w-4 text-[var(--accent-seal)]" />
                {copy.sendWhatsApp}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
