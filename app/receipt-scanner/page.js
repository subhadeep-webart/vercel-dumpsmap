'use client'

// /receipt-scanner — Mobile-first AI Receipt Scanner.
//
// Flow (target: snap → scan → confirm → save in under 10 seconds):
//   1. STAGE='pick'    — Big camera CTA; opens native camera or file picker.
//   2. STAGE='scanning' — Show photo thumbnail + animated progress while
//                         POSTing to /api/receipts/scan (server calls Gemini).
//   3. STAGE='review'   — Render extracted fields in editable form with
//                         confidence badge. User edits anything that's wrong.
//   4. STAGE='saving'   — POST /api/receipts to persist (includes ocr metadata).
//   5. STAGE='done'     — Success card with link to receipts list + scan another.
//
// Gating: feature flag `ocrReceiptScanner` (beta). Locked state shows an
// "Apply for beta" copy when the user doesn't have a grant.
//
// All data/logic lives in hooks/use-receipt-scanner.js (+ its actions hook);
// this file is presentation only.

import React from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, Camera, CheckCircle2, FileText, Loader2,
  RefreshCw, ScanLine, Sparkles, Upload, AlertTriangle, Lock,
} from 'lucide-react'
import { useReceiptScanner } from '@/hooks/use-receipt-scanner'
import { humanizeSource } from '@/lib/receipt-scanner-helpers'
import { MATERIALS, LOADS, PAY_METHODS } from '@/constants/receipt_scanner_constants'

export default function ReceiptScannerPage() {
  const {
    fileRef, cameraRef,
    authStatus, access,
    stage, previewUrl, scanError, draft, ocrMeta, savedRewards,
    onFile, onDraftChange, onWeightChange, onSave, resetAll,
  } = useReceiptScanner()

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (authStatus !== 'ready') {
    return (
      <PageShell active="receipts" breadcrumbs={[{ label: 'Receipts', href: '/receipts' }, { label: 'Scan' }]} maxWidth="max-w-2xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">AI Receipt Scanner</h1>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Beta</Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">Snap a photo. AI extracts the fields. Review and save in under 10 seconds.</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-xl bg-brand-50" />
              <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking your access…
            </div>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  // Feature gate UI
  if (!access.loading && !access.allowed) {
    const lockedState = access.lockedState
    const Header = (
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900">AI Receipt Scanner is in Beta</h2>
      </div>
    )
    let body = (
      <p className="mt-2 text-sm text-neutral-600">
        This feature is currently rolling out to a small group of beta testers.
        Want early access? Email <a href="mailto:jamal@dumpmaps.org" className="underline">jamal@dumpmaps.org</a> with your DumpMaps email and we’ll add you.
      </p>
    )
    if (lockedState === 'upgrade') {
      body = (
        <p className="mt-2 text-sm text-neutral-600">
          Your trial for AI Receipt Scanner has ended. To keep using it, upgrade to <span className="font-bold">Verified Commercial</span> or higher.
        </p>
      )
    }
    return (
      <PageShell active="receipts" breadcrumbs={[{ label: 'Receipts', href: '/receipts' }, { label: 'Scan' }]} maxWidth="max-w-2xl">
          <Card><CardContent className="p-8">
            {Header}
            {body}
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/receipts"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to receipts</Button></Link>
              {lockedState === 'upgrade' && <Link href="/membership"><Button>Upgrade</Button></Link>}
            </div>
          </CardContent></Card>
      </PageShell>
    )
  }

  return (
    <PageShell active="receipts" breadcrumbs={[{ label: 'Receipts', href: '/receipts' }, { label: 'Scan' }]} maxWidth="max-w-2xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">AI Receipt Scanner</h1>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Beta</Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">Snap a photo. AI extracts the fields. Review and save in under 10 seconds.</p>
          </div>
        </div>

        {/* STAGE: PICK ------------------------------------------------------ */}
        {stage === 'pick' && (
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-8 text-center transition hover:border-brand-400 hover:bg-brand-100"
                >
                  <Camera className="h-8 w-8 text-brand-600" />
                  <div className="text-sm font-bold text-brand-900">Take photo</div>
                  <div className="text-[11px] text-brand-700">Opens your camera</div>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center transition hover:border-neutral-500"
                >
                  <Upload className="h-8 w-8 text-neutral-500" />
                  <div className="text-sm font-bold text-neutral-900">Choose from gallery</div>
                  <div className="text-[11px] text-neutral-500">JPEG, PNG, HEIC up to 8 MB</div>
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {scanError && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{scanError}</span>
                </div>
              )}
              <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600">
                <div className="flex items-center gap-2 font-bold text-neutral-800">
                  <Sparkles className="h-3 w-3 text-violet-600" /> Tips for the best scan
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>Lay the receipt flat — avoid wrinkles and shadows</li>
                  <li>Frame the whole ticket including totals and weights</li>
                  <li>Hold the phone steady. Bright but glare-free is best.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STAGE: SCANNING -------------------------------------------------- */}
        {stage === 'scanning' && (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center">
                {previewUrl && (
                  <img src={previewUrl} alt="receipt" className="mb-4 max-h-72 w-auto rounded-md border border-neutral-200 object-contain shadow-sm" />
                )}
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  Scanning receipt with Gemini 2.5 Flash…
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">Usually takes 3–8 seconds. Hang tight.</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STAGE: REVIEW ---------------------------------------------------- */}
        {stage === 'review' && draft && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {previewUrl && (
                    <img src={previewUrl} alt="receipt" className="max-h-32 w-auto rounded-md border border-neutral-200 object-contain shadow-sm" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700">Scan complete</span>
                      {ocrMeta?.confidence != null && (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                          {ocrMeta.confidence}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Review and edit any fields below, then save.</p>
                    {ocrMeta?.elapsedMs != null && (
                      <p className="mt-1 text-[10px] text-neutral-400">Powered by Gemini 2.5 Flash · {(ocrMeta.elapsedMs / 1000).toFixed(1)}s</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={resetAll}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Rescan
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <SectionHead title="Facility" />
                <Field2 label="Facility name" value={draft.facilityName} onChange={(v) => onDraftChange('facilityName', v)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field2 label="Address" value={draft.facilityAddress} onChange={(v) => onDraftChange('facilityAddress', v)} />
                  <Field2 label="City / State" value={draft.facilityCity} onChange={(v) => onDraftChange('facilityCity', v)} />
                </div>

                <SectionHead title="Ticket" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field2 label="Date" type="date" value={draft.dateOf} onChange={(v) => onDraftChange('dateOf', v)} />
                  <Field2 label="Time in" type="time" value={draft.timeIn} onChange={(v) => onDraftChange('timeIn', v)} />
                  <Field2 label="Time out" type="time" value={draft.timeOut} onChange={(v) => onDraftChange('timeOut', v)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field2 label="Ticket #" value={draft.ticketNumber} onChange={(v) => onDraftChange('ticketNumber', v)} />
                  <Field2 label="Vehicle / Plate" value={draft.vehicleNumber} onChange={(v) => onDraftChange('vehicleNumber', v)} />
                </div>

                <SectionHead title="Weights" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field2 label="Gross (lb)" type="number" value={draft.grossLb} onChange={(v) => onWeightChange('grossLb', v)} />
                  <Field2 label="Tare (lb)" type="number" value={draft.tareLb} onChange={(v) => onWeightChange('tareLb', v)} />
                  <Field2 label="Net (lb)" type="number" value={draft.netLb} onChange={(v) => onDraftChange('netLb', v)} />
                  <Field2 label="Net (tons)" type="number" value={draft.netTons} onChange={(v) => onDraftChange('netTons', v)} step="0.0001" />
                </div>

                <SectionHead title="Material & cost" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Material" value={draft.materialType} options={MATERIALS} onChange={(v) => onDraftChange('materialType', v)} />
                  <SelectField label="Load type" value={draft.loadType} options={LOADS.map((l) => ({ value: l, label: l.toUpperCase() }))} onChange={(v) => onDraftChange('loadType', v)} />
                  <Field2 label="Total paid ($)" type="number" value={draft.totalCost} onChange={(v) => onDraftChange('totalCost', v)} step="0.01" />
                  <Field2 label="Recycling payout ($)" type="number" value={draft.recyclingPayout} onChange={(v) => onDraftChange('recyclingPayout', v)} step="0.01" />
                  <SelectField label="Payment method" value={draft.paymentMethod} options={PAY_METHODS.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} onChange={(v) => onDraftChange('paymentMethod', v)} />
                  <Field2 label="Price / ton (optional)" type="number" value={draft.pricePerTon} onChange={(v) => onDraftChange('pricePerTon', v)} step="0.01" />
                </div>
              </CardContent>
            </Card>

            <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur sm:static sm:mx-0 sm:rounded-lg sm:border sm:p-4 sm:shadow-sm">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={resetAll} className="flex-1 sm:flex-none">Cancel</Button>
                <Button onClick={onSave} className="flex-1" disabled={!draft.facilityName?.trim()}>
                  <FileText className="mr-2 h-4 w-4" /> Save receipt
                </Button>
              </div>
              {!draft.facilityName?.trim() && (
                <p className="mt-1 text-[10px] text-amber-700">A facility name is required before saving.</p>
              )}
            </div>
          </div>
        )}

        {/* STAGE: SAVING ---------------------------------------------------- */}
        {stage === 'saving' && (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-brand-600" />
              <div className="text-sm font-bold">Saving receipt…</div>
            </CardContent>
          </Card>
        )}

        {/* STAGE: DONE ------------------------------------------------------ */}
        {stage === 'done' && (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
              <h2 className="text-lg font-extrabold text-neutral-900">Receipt saved</h2>
              <p className="mt-1 text-sm text-neutral-600">Your scanned receipt has been added to your records.</p>

              {savedRewards && savedRewards.totalPoints > 0 && (
                <div className="mx-auto mt-4 max-w-md rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-left">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-green-700">DumpMaps Rewards</div>
                      <div className="text-2xl font-extrabold leading-tight text-green-800">+{savedRewards.totalPoints} pts</div>
                    </div>
                    <div className="text-right text-[10px] text-green-700">
                      ≈ ${(savedRewards.totalPoints / 100).toFixed(2)}
                    </div>
                  </div>
                  {Array.isArray(savedRewards.awards) && savedRewards.awards.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-green-900">
                      {savedRewards.awards.filter((a) => !a.duplicate && a.points > 0).map((a, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span>+{a.points} · {humanizeSource(a.source)}</span>
                          <span className="text-[10px] text-green-700">{a.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Button onClick={resetAll}>
                  <Camera className="mr-2 h-4 w-4" /> Scan another
                </Button>
                <Link href="/receipts">
                  <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" /> View all receipts
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// Presentational helpers (kept in-file; data/logic lives in the hooks)
// ---------------------------------------------------------------------------
function SectionHead({ title }) {
  return <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</div>
}

function Field2({ label, value, onChange, type = 'text', step }) {
  return (
    <div>
      <Label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</Label>
      <Input
        type={type}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  // Accept either array of strings or array of {value,label}
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o || '— none —' } : o))
  return (
    <div>
      <Label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</Label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
