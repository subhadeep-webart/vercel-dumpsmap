'use client'

// /profile — DumpMaps unified Profile editor (Phase 1 redesign)
// ----------------------------------------------------------------------------
// Single comprehensive profile page. Every authenticated user lands here to
// manage:
//   • Personal: name, email, phone, full address
//   • Profile:  avatar, cover photo, bio, company, website, service area
//   • Availability: status pill (one-tap toggle, saves on click)
//   • Payment Preferences: which payment types they accept
//   • Visibility: public / private profile, verified badge readout
//   • Security: change password
//
// Layout:
//   ┌────────────────────────────────────────┐
//   │ Cover image (with edit overlay)        │
//   │ Avatar  Name | Role | Verified         │
//   │         Availability status pill       │
//   ├────────────────────────────────────────┤
//   │ Tabs: Personal · Profile · Availability│
//   │       · Payments · Visibility · Security│
//   └────────────────────────────────────────┘
//
// All edits save immediately (PATCH /api/users/me/profile) with toast feedback.

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearAuthToken } from '@/hooks/use-logout'
import { api } from '@/lib/api-client'
import PageShell from '@/components/PageShell'
import SafeImage from '@/components/SafeImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import MediaUploader from '@/components/MediaUploader'
import {
  User, Mail, Phone, MapPin, Image as ImageIcon, Briefcase, Globe, Activity,
  Wallet, Eye, EyeOff, Lock, ShieldCheck, Loader2, Save, Camera, Pencil,
  Sparkles, CheckCircle2, AlertCircle, Edit3, RefreshCw,
  CircleCheck, Clock, CircleSlash, Ban, CreditCard, Landmark, Banknote,
  Smartphone, FileText, Receipt, DollarSign,
} from 'lucide-react'

// Availability options
const AVAILABILITY_OPTIONS = [
  { value: 'available',     label: 'Available',         Icon: CircleCheck, tone: 'bg-green-100 text-green-800 border-green-300', desc: 'Open for work, jobs, calls' },
  { value: 'busy',          label: 'Busy',              Icon: Clock,       tone: 'bg-amber-100 text-amber-900 border-amber-300', desc: 'On a job, limited availability' },
  { value: 'offline',       label: 'Offline',           Icon: CircleSlash, tone: 'bg-red-100 text-red-800 border-red-300',       desc: 'Off the clock' },
  { value: 'not_accepting', label: 'Not Accepting Work', Icon: Ban,        tone: 'bg-neutral-200 text-neutral-700 border-neutral-300', desc: 'Pausing new requests' },
]

// Payment method options
const PAYMENT_OPTIONS = [
  { value: 'stripe',  label: 'Stripe',   Icon: CreditCard },
  { value: 'paypal',  label: 'PayPal',   Icon: Wallet },
  { value: 'cashapp', label: 'Cash App', Icon: Banknote },
  { value: 'zelle',   label: 'Zelle',    Icon: Landmark },
  { value: 'venmo',   label: 'Venmo',    Icon: Smartphone },
  { value: 'check',   label: 'Check',    Icon: FileText },
  { value: 'cash',    label: 'Cash',     Icon: DollarSign },
  { value: 'other',   label: 'Other',    Icon: Receipt },
]

const TABS = [
  { key: 'personal',     label: 'Personal Info',  icon: User },
  { key: 'business',     label: 'Business Info',  icon: Briefcase },
  { key: 'payment',      label: 'Payment',        icon: Wallet },
  { key: 'service-area', label: 'Service Area',   icon: MapPin },
  { key: 'documents',    label: 'Documents',      icon: ImageIcon },
  { key: 'preferences',  label: 'Preferences',    icon: Sparkles },
]

// Canonical profile photo resolver. Fallback chain:
//   profilePhotoUrl  → avatarUrl  → imageUrl  → '' (initials placeholder)
// We migrate all surfaces to read profilePhotoUrl first, but writes mirror to
// avatarUrl so legacy reads (Marketplace, Community, etc.) still work.
const resolveAvatar = (u) => (
  (u && (u.profilePhotoUrl || u.avatarUrl || u.imageUrl)) || ''
)

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('personal')
  // One-shot guard so the bootstrap effect never re-runs after the first mount
  // (prevents stray redirects when navigation/router refs change mid-session).
  const bootstrappedRef = React.useRef(false)

  // Field-level form state mirrors the user record (controlled inputs).
  const [form, setForm] = useState({})
  const [savingField, setSavingField] = useState(null) // tracks which field is currently saving

  // Patch a single field (or a few related fields) and toast success/error.
  // CRITICAL: For avatar/cover changes we mirror the value to all legacy
  // image fields (profilePhotoUrl ↔ avatarUrl) so the rest of the app picks
  // up the change instantly without any router/page reload.
  const save = async (patch, label) => {
    setSavingField(label)
    try {
      const payload = { ...patch }
      // Avatar mirror: write both canonical + legacy field so other surfaces
      // (Activity Hub, Marketplace, Community) keep showing the new photo.
      if (payload.avatarUrl !== undefined || payload.profilePhotoUrl !== undefined) {
        const v = payload.profilePhotoUrl ?? payload.avatarUrl ?? ''
        payload.avatarUrl = v
        payload.profilePhotoUrl = v
      }
      const j = await api.patch('/api/users/me/profile', payload)
      // Defensive: only swap user state if the server returned a user object.
      if (j?.user) setUser(j.user)
      // Sync form state to whatever the server normalised (e.g. website prefixed).
      const next = {}
      for (const k of Object.keys(payload)) {
        next[k] = j?.user ? (j.user[k] ?? payload[k]) : payload[k]
      }
      setForm((f) => ({ ...f, ...next }))
      toast.success(`${label} updated`)
      return true
    } catch (e) {
      toast.error(e.message || 'Save failed')
      return false
    } finally {
      setSavingField(null)
    }
  }

  // Single bootstrap effect — loads the profile ONCE on mount. The
  // `bootstrappedRef` guard prevents stale re-runs (e.g. router ref changes)
  // that previously caused unwanted redirects after a photo upload.
  //
  // IMPORTANT: We intentionally do NOT use a `cancelled` cleanup flag here.
  // In React 18 dev StrictMode, useEffect mounts twice. With a cancelled
  // flag, the first mount's fetch resolves AFTER its cleanup sets cancelled,
  // and the early-return in `if (cancelled) return` skips the setStatus
  // calls — leaving the page stuck on "Loading…". The bootstrappedRef
  // guard already prevents duplicate network requests, so a stale setState
  // after unmount is harmless (React just emits a warning).
  useEffect(() => {
    if (bootstrappedRef.current) return undefined
    bootstrappedRef.current = true
    const run = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dm_token') : null
      if (!token) {
        router.replace('/?login=1&returnTo=/profile')
        return
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      try {
        let j
        try {
          j = await api.get('/api/users/me/profile', { signal: ctrl.signal, timeout: 0 })
        } catch (err) {
          // A non-2xx (thrown ApiError with a status) is an auth failure —
          // mirror the old `!r.ok` branch: clear the token and bounce to login.
          if (err?.name === 'ApiError' && err.status) {
            clearAuthToken()
            router.replace('/?login=1&returnTo=/profile')
            return
          }
          throw err // network/abort/timeout → handled by the outer catch below
        }
        if (!j?.user) {
          clearAuthToken()
          router.replace('/?login=1&returnTo=/profile')
          return
        }
        setUser(j.user)
        setForm({
          name: j.user.name || '',
          email: j.user.email || '',
          phone: j.user.phone || '',
          addressLine1: j.user.addressLine1 || '',
          addressLine2: j.user.addressLine2 || '',
          city: j.user.city || '',
          state: j.user.state || '',
          zip: j.user.zip || '',
          bio: j.user.bio || '',
          companyName: j.user.companyName || '',
          website: j.user.website || '',
          avatarUrl: resolveAvatar(j.user),
          profilePhotoUrl: resolveAvatar(j.user),
          coverImageUrl: j.user.coverImageUrl || '',
          serviceAreaRadiusMi: j.user.serviceAreaRadiusMi ?? 25,
          availabilityStatus: j.user.availabilityStatus || 'available',
          profileVisibility: j.user.profileVisibility || 'public',
          paymentMethodsAccepted: Array.isArray(j.user.paymentMethodsAccepted) ? j.user.paymentMethodsAccepted : [],
          // NEW Sprint A fields
          profileType: j.user.profileType || '',
          businessType: j.user.businessType || '',
          ein: j.user.ein || '',
          isRepresentative: j.user.isRepresentative || 'independent',
          zipCodes: Array.isArray(j.user.zipCodes) ? j.user.zipCodes : [],
          preferredZones: Array.isArray(j.user.preferredZones) ? j.user.preferredZones : [],
          notifications: j.user.notifications || { email: true, sms: false, push: true, newJobs: true, newBounties: true, rewardsEarned: true, workOrderUpdates: true },
          documents: Array.isArray(j.user.documents) ? j.user.documents : [],
        })
        setStatus('ready')
      } catch (e) {
        // The 8s watchdog aborts `ctrl`; api-client surfaces that as an
        // ApiError. Treat any abort of our controller as the timeout state,
        // matching the previous `e?.name === 'AbortError'` check.
        const timedOut = ctrl.signal.aborted || e?.code === 'timeout' || e?.code === 'aborted'
        setStatus(timedOut ? 'timeout' : 'error')
      } finally {
        clearTimeout(timer)
      }
    }
    run()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retryLoad = () => { setStatus('loading'); window.location.reload() }

  if (status === 'loading') return <ProfileSkeleton />
  if (status !== 'ready' || !user) return <ProfileError onRetry={retryLoad} />

  const initials = (user.name || user.email || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
  const role = (user.role || 'user').replace(/_/g, ' ')
  const availability = AVAILABILITY_OPTIONS.find((o) => o.value === form.availabilityStatus) || AVAILABILITY_OPTIONS[0]

  return (
    <PageShell active="profile" maxWidth={null} padding="" bg="bg-neutral-50"
      breadcrumbs={[{ label: 'Profile' }]}
    >
      {/* ============== HERO COVER + AVATAR ============== */}
      <ProfileHero
        user={user}
        form={form}
        availability={availability}
        onChangeCover={(url) => save({ coverImageUrl: url }, 'Cover photo')}
        onChangeAvatar={(url) => save({ avatarUrl: url }, 'Profile photo')}
        initials={initials}
        role={role}
      />

      {/* ============== TABS ============== */}
      <nav className="sticky top-14 z-10 border-b border-neutral-200 bg-white shadow-sm">
        <div className="container mx-auto flex gap-0 overflow-x-auto px-2 sm:px-4">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = t.key === activeTab
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-semibold transition sm:px-4 ${
                  isActive ? 'text-green-700' : 'text-neutral-500 hover:text-neutral-900'
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
                {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-green-600" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ============== BODY ============== */}
      <main className="container mx-auto grid gap-6 px-4 py-6 pb-28 md:grid-cols-3 md:pb-10">
        <div className="space-y-4 md:col-span-2">
          {activeTab === 'personal' && (
            <PersonalTab form={form} setForm={setForm} save={save} saving={savingField} />
          )}
          {activeTab === 'business' && (
            <BusinessTab form={form} setForm={setForm} save={save} saving={savingField} />
          )}
          {activeTab === 'payment' && (
            <PaymentsTab form={form} setForm={setForm} save={save} saving={savingField} />
          )}
          {activeTab === 'service-area' && (
            <ServiceAreaTab form={form} setForm={setForm} save={save} saving={savingField} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab form={form} setForm={setForm} save={save} saving={savingField} />
          )}
          {activeTab === 'preferences' && (
            <PreferencesTab form={form} setForm={setForm} save={save} user={user} saving={savingField} />
          )}
        </div>

        {/* Sidebar — quick stats / shortcuts */}
        <aside className="space-y-4">
          <SidebarQuickActions user={user} availability={availability} />
          <SidebarVerificationCard user={user} />
          <SidebarLinkCard
            title="Settings hub"
            href="/settings"
            description="Integrations, payment methods, app preferences"
          />
        </aside>
      </main>
    </PageShell>
  )
}

/* =========================================================================
   HERO
   ========================================================================= */
function ProfileHero({ user, form, availability, onChangeCover, onChangeAvatar, initials, role }) {
  return (
    <section className="relative">
      {/* Cover photo (full-bleed) — uses MediaUploader with cover variant */}
      <MediaUploader
        variant="cover"
        value={form.coverImageUrl}
        onChange={(url) => onChangeCover(url)}
        accept="image/*"
        showRemove
      />

      {/* Avatar + name (overlapping the cover by -mt-12) */}
      <div className="container mx-auto -mt-6 px-4 pb-3 sm:-mt-12">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <MediaUploader
              variant="avatar"
              value={form.profilePhotoUrl || form.avatarUrl || ''}
              onChange={(url) => onChangeAvatar(url)}
              label={initials}
              accept="image/*"
              showRemove
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">{user.name || user.email}</h1>
              {user.verified && (
                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">
                  <ShieldCheck className="mr-0.5 h-3 w-3" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="border-neutral-300 bg-white text-[10px] uppercase tracking-wider text-neutral-600">
                {role}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
              {user.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>}
              {(user.city || user.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[user.city, user.state].filter(Boolean).join(', ')}</span>}
            </div>
          </div>
          {/* Availability quick pill (shortcut to Availability tab) */}
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs mb-5 font-bold ${availability.tone}`}>
            {availability.Icon && <availability.Icon className="h-4 w-4" />} {availability.label}
          </div>
        </div>
      </div>
    </section>
  )
}

/* =========================================================================
   TABS
   ========================================================================= */
function PersonalTab({ form, setForm, save, saving }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <FieldRow label="Full name" icon={User}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => save({ name: form.name.trim() }, 'Name')}
            placeholder="e.g. Jane Smith" />
        </FieldRow>
        <FieldRow label="Email" icon={Mail} note="Changing email resets verification status">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => { const trimmed = form.email.trim().toLowerCase(); if (trimmed) save({ email: trimmed }, 'Email') }} />
        </FieldRow>
        <FieldRow label="Phone" icon={Phone}>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            onBlur={() => save({ phone: form.phone.trim() }, 'Phone')}
            placeholder="(555) 555-5555" />
        </FieldRow>
        <FieldRow label="Address line 1" icon={MapPin}>
          <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            onBlur={() => save({ addressLine1: form.addressLine1.trim() }, 'Address')}
            placeholder="123 Main St" />
        </FieldRow>
        <FieldRow label="Address line 2" icon={MapPin}>
          <Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            onBlur={() => save({ addressLine2: form.addressLine2.trim() }, 'Address line 2')}
            placeholder="Apt, suite, unit (optional)" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldRow label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              onBlur={() => save({ city: form.city.trim() }, 'City')} />
          </FieldRow>
          <FieldRow label="State">
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
              onBlur={() => save({ state: form.state.trim() }, 'State')}
              maxLength={2} placeholder="CA" />
          </FieldRow>
          <FieldRow label="ZIP">
            <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })}
              onBlur={() => save({ zip: form.zip.trim() }, 'ZIP')}
              maxLength={10} />
          </FieldRow>
        </div>
        {saving && <SavingHint label={saving} />}
      </CardContent>
    </Card>
  )
}

function BusinessTab({ form, setForm, save, saving }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Business information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Bio / About you" icon={Sparkles}>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              onBlur={() => save({ bio: form.bio }, 'Bio')}
              placeholder="Tell the community who you are and what you do. 1-2 sentences works best." />
          </FieldRow>
          <FieldRow label="Company name" icon={Briefcase}>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              onBlur={() => save({ companyName: form.companyName.trim() }, 'Company name')}
              placeholder="DumpMaps Inc · ABC Hauling · etc." />
          </FieldRow>
          <FieldRow label="Website" icon={Globe}>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              onBlur={() => save({ website: form.website.trim() }, 'Website')}
              placeholder="example.com" />
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Business type" icon={Briefcase} note="LLC, Sole Prop, Corp, etc.">
              <Input value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                onBlur={() => save({ businessType: form.businessType.trim() }, 'Business type')}
                placeholder="e.g. LLC" />
            </FieldRow>
            <FieldRow label="EIN (optional)" icon={Lock} note="Required for verified business status">
              <Input value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })}
                onBlur={() => save({ ein: form.ein.trim() }, 'EIN')}
                placeholder="XX-XXXXXXX" />
            </FieldRow>
          </div>
          <FieldRow label="Representation" icon={User} note="Are you an individual or representing a company?">
            <div className="flex gap-2">
              {['independent', 'company_representative'].map((v) => (
                <button key={v} type="button"
                  onClick={() => { setForm({ ...form, isRepresentative: v }); save({ isRepresentative: v }, 'Representation') }}
                  className={`flex-1 rounded-lg border p-3 text-left text-sm transition ${form.isRepresentative === v ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
                >
                  <div className="font-bold text-neutral-900">{v === 'independent' ? 'Independent' : 'Company Representative'}</div>
                  <div className="text-xs text-neutral-600">{v === 'independent' ? 'Solo contractor / individual' : 'I represent a business'}</div>
                </button>
              ))}
            </div>
          </FieldRow>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}

function ServiceAreaTab({ form, setForm, save, saving }) {
  const [zipDraft, setZipDraft] = useState('')
  const [zoneDraft, setZoneDraft] = useState('')

  const addZip = () => {
    const v = (zipDraft || '').trim()
    if (!v) return
    const next = [...new Set([...(form.zipCodes || []), v])]
    setForm({ ...form, zipCodes: next })
    save({ zipCodes: next }, 'ZIP codes')
    setZipDraft('')
  }
  const removeZip = (z) => {
    const next = (form.zipCodes || []).filter((x) => x !== z)
    setForm({ ...form, zipCodes: next })
    save({ zipCodes: next }, 'ZIP codes')
  }
  const addZone = () => {
    const v = (zoneDraft || '').trim()
    if (!v) return
    const next = [...new Set([...(form.preferredZones || []), v])]
    setForm({ ...form, preferredZones: next })
    save({ preferredZones: next }, 'Preferred zones')
    setZoneDraft('')
  }
  const removeZone = (z) => {
    const next = (form.preferredZones || []).filter((x) => x !== z)
    setForm({ ...form, preferredZones: next })
    save({ preferredZones: next }, 'Preferred zones')
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Service area</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Home city" icon={MapPin}>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                onBlur={() => save({ city: form.city.trim() }, 'City')} />
            </FieldRow>
            <FieldRow label="Service radius (miles)" note="0-500">
              <Input type="number" min={0} max={500} value={form.serviceAreaRadiusMi}
                onChange={(e) => setForm({ ...form, serviceAreaRadiusMi: e.target.value })}
                onBlur={() => save({ serviceAreaRadiusMi: Number(form.serviceAreaRadiusMi) || 0 }, 'Service radius')} />
            </FieldRow>
          </div>

          <FieldRow label="ZIP codes you cover" note="Press Enter or click Add">
            <div className="flex gap-2">
              <Input value={zipDraft} onChange={(e) => setZipDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addZip() } }}
                placeholder="e.g. 95110" />
              <Button variant="outline" onClick={addZip}>Add</Button>
            </div>
            {(form.zipCodes || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.zipCodes || []).map((z) => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                    {z} <button onClick={() => removeZip(z)} className="text-green-600 hover:text-red-600">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </FieldRow>

          <FieldRow label="Preferred work zones" note="Neighbourhoods or named areas you prefer">
            <div className="flex gap-2">
              <Input value={zoneDraft} onChange={(e) => setZoneDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addZone() } }}
                placeholder="e.g. Downtown San Jose" />
              <Button variant="outline" onClick={addZone}>Add</Button>
            </div>
            {(form.preferredZones || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.preferredZones || []).map((z) => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {z} <button onClick={() => removeZone(z)} className="text-blue-600 hover:text-red-600">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </FieldRow>

          <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <b>Map view</b> coming in a later sprint — you&apos;ll be able to draw your service area on the map directly.
          </div>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentsTab({ form, setForm, save, saving }) {
  const documents = form.documents || []
  const addDocument = React.useCallback(async (category, url, label) => {
    if (!url) return
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `doc_${Date.now()}`
    const next = [...documents, { id, category, url, label, uploadedAt: new Date().toISOString() }]
    setForm((f) => ({ ...f, documents: next }))
    await save({ documents: next }, 'Documents')
  }, [documents, setForm, save])
  const removeDocument = React.useCallback(async (id) => {
    const next = documents.filter((d) => d.id !== id)
    setForm((f) => ({ ...f, documents: next }))
    await save({ documents: next }, 'Documents')
  }, [documents, setForm, save])

  const CATEGORIES = [
    { key: 'drivers_license',      label: "Driver's License",      icon: User },
    { key: 'contractor_license',   label: 'Contractor License',    icon: Briefcase },
    { key: 'insurance_certificate', label: 'Insurance Certificate', icon: ShieldCheck },
    { key: 'w9',                    label: 'W9 Form',               icon: Lock },
    { key: 'business_logo',         label: 'Business Logo',         icon: ImageIcon },
    { key: 'certification',         label: 'Certifications',        icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Documents & uploads</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-neutral-600">Upload your licenses, insurance, W9, business logo, and certifications. Documents are private by default — only admins and verified parties can view them. Verification queue is launching in a later sprint.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const matches = documents.filter((d) => d.category === cat.key)
              return (
                <div key={cat.key} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-bold text-neutral-900">{cat.label}</span>
                    {matches.length > 0 && <Badge variant="outline" className="text-[10px]">{matches.length}</Badge>}
                  </div>
                  <MediaUploader
                    variant="tile"
                    value=""
                    onChange={(url) => addDocument(cat.key, url, cat.label)}
                    label={`Upload ${cat.label}`}
                    helpText="JPG/PNG/PDF · ≤8MB"
                    className="aspect-video"
                    accept="image/*"
                  />
                  {matches.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {matches.map((d) => (
                        <li key={d.id} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                          <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-xs text-neutral-700 hover:text-green-700">
                            <ImageIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{d.label || d.url.split('/').pop()}</span>
                            <span className="ml-1 text-[10px] text-neutral-400 shrink-0">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                          </a>
                          <button onClick={() => removeDocument(d.id)} className="ml-2 text-xs text-red-600 hover:text-red-800">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
          {saving && <SavingHint label={saving} />}
        </CardContent>
      </Card>
    </div>
  )
}

function PreferencesTab({ form, setForm, save, user, saving }) {
  const current = form.availabilityStatus || 'available'
  const isPublic = (form.profileVisibility || 'public') === 'public'
  const notifications = form.notifications || {}
  const setNotification = (key, value) => {
    const next = { ...notifications, [key]: value, _existing: notifications }
    setForm({ ...form, notifications: { ...notifications, [key]: value } })
    save({ notifications: next }, 'Notifications')
  }
  return (
    <div className="space-y-4">
      {/* Availability */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Availability status</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-neutral-600">Tap a status to change instantly. Shown on your public profile and to job posters.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {AVAILABILITY_OPTIONS.map((o) => {
              const isActive = current === o.value
              return (
                <button key={o.value}
                  onClick={() => { setForm({ ...form, availabilityStatus: o.value }); save({ availabilityStatus: o.value }, 'Availability') }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    isActive ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {o.Icon && <o.Icon className="h-5 w-5 shrink-0 text-neutral-700" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-neutral-900">{o.label}</div>
                    <div className="text-xs text-neutral-600">{o.desc}</div>
                  </div>
                  {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Profile visibility</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isPublic ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-neutral-500" />}
                <span className="text-sm font-bold text-neutral-900">{isPublic ? 'Public profile' : 'Private profile'}</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">
                {isPublic ? 'Anyone can find and view your profile.' : 'Only people you connect with can see your details.'}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={(v) => {
              const next = v ? 'public' : 'private'
              setForm({ ...form, profileVisibility: next })
              save({ profileVisibility: next }, 'Visibility')
            }} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            { key: 'email', label: 'Email notifications' },
            { key: 'sms', label: 'SMS notifications' },
            { key: 'push', label: 'Push notifications' },
            { key: 'newJobs', label: 'New jobs near me' },
            { key: 'newBounties', label: 'New bounty campaigns' },
            { key: 'rewardsEarned', label: 'When I earn rewards' },
            { key: 'workOrderUpdates', label: 'Work order updates' },
          ].map((opt) => (
            <div key={opt.key} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="text-sm text-neutral-800">{opt.label}</span>
              <Switch checked={!!notifications[opt.key]} onCheckedChange={(v) => setNotification(opt.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <SecurityTab />
      {saving && <SavingHint label={saving} />}
    </div>
  )
}

function AvailabilityTab({ form, setForm, save, saving }) {
  const current = form.availabilityStatus || 'available'
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Current availability</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-neutral-600">Tap a status to change it instantly. Visible on your public profile and to job posters.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {AVAILABILITY_OPTIONS.map((o) => {
              const isActive = current === o.value
              return (
                <button
                  key={o.value}
                  onClick={() => { setForm({ ...form, availabilityStatus: o.value }); save({ availabilityStatus: o.value }, 'Availability') }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    isActive ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {o.Icon && <o.Icon className="h-5 w-5 shrink-0 text-neutral-700" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-neutral-900">{o.label}</div>
                    <div className="text-xs text-neutral-600">{o.desc}</div>
                  </div>
                  {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                </button>
              )
            })}
          </div>
          {saving === 'Availability' && <SavingHint label="Availability" />}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentsTab({ form, setForm, save, saving }) {
  const accepted = new Set(form.paymentMethodsAccepted || [])
  const toggle = (val) => {
    const next = new Set(accepted)
    if (next.has(val)) next.delete(val); else next.add(val)
    const arr = [...next]
    setForm({ ...form, paymentMethodsAccepted: arr })
    save({ paymentMethodsAccepted: arr }, 'Payment preferences')
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Payment methods accepted</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-neutral-600">Select which ways you accept payment from customers. They&apos;ll see these on your profile and job listings.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((o) => {
            const isOn = accepted.has(o.value)
            return (
              <button
                key={o.value}
                onClick={() => toggle(o.value)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                  isOn ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <span className="flex items-center gap-3">
                  {o.Icon && <o.Icon className="h-5 w-5 shrink-0 text-neutral-700" />}
                  <span className="text-sm font-bold text-neutral-900">{o.label}</span>
                </span>
                {isOn ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-xs text-neutral-400">Off</span>}
              </button>
            )
          })}
        </div>
        {saving === 'Payment preferences' && <SavingHint label="Payment preferences" />}
        <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <b>Note:</b> Stripe payouts can be configured under <Link href="/settings/payment-methods" className="text-green-700 underline">Settings → Payment Methods</Link>.
        </div>
      </CardContent>
    </Card>
  )
}

function VisibilityTab({ form, setForm, save, user, saving }) {
  const isPublic = (form.profileVisibility || 'public') === 'public'
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Profile visibility</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isPublic ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-neutral-500" />}
                <span className="text-sm font-bold text-neutral-900">{isPublic ? 'Public profile' : 'Private profile'}</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">
                {isPublic
                  ? 'Anyone can find and view your profile, including bio, company, and service area.'
                  : 'Only people you connect with can see your full profile details.'}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={(v) => {
              const next = v ? 'public' : 'private'
              setForm({ ...form, profileVisibility: next })
              save({ profileVisibility: next }, 'Visibility')
            }} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${user.verified ? 'text-green-600' : 'text-neutral-400'}`} />
                <span className="text-sm font-bold text-neutral-900">Verified badge</span>
              </div>
              {user.verified ? (
                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">Active</Badge>
              ) : (
                <Badge variant="outline" className="border-neutral-300 bg-neutral-50 text-neutral-600">Not verified</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              {user.verified
                ? 'You display a Verified badge. Customers see this on every listing, bid, and review.'
                : 'Get verified by uploading ID and business documents. Verified contractors get more jobs and higher placements.'}
            </p>
            {!user.verified && (
              <Button variant="outline" className="mt-3 border-green-300 text-green-800 hover:bg-green-50" asChild>
                <Link href="/verification">Start verification</Link>
              </Button>
            )}
          </div>

          {saving === 'Visibility' && <SavingHint label="Visibility" />}
        </CardContent>
      </Card>
    </div>
  )
}

function SecurityTab() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!current || !next) return toast.error('All fields required')
    if (next.length < 8) return toast.error('New password must be at least 8 characters')
    if (next !== confirm) return toast.error('Passwords do not match')
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next })
      toast.success('Password updated')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      // api.post throws ApiError on non-2xx; the server error body is on
      // `e.data`, preserving the old `j.error || 'Update failed'` message.
      toast.error(e?.data?.error || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Current password" icon={Lock}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </FieldRow>
          <FieldRow label="New password" icon={Lock}>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Minimum 8 characters" />
          </FieldRow>
          <FieldRow label="Confirm new password" icon={Lock}>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FieldRow>
          <div className="pt-1">
            <Button onClick={submit} disabled={busy} className="bg-green-700 hover:bg-green-800">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Update password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Forgot your password?</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">If you can&apos;t remember your current password, use the password reset flow.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/?reset=1">Send reset link to my email</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* =========================================================================
   SIDEBAR
   ========================================================================= */
function SidebarQuickActions({ user, availability }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Quick actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Button asChild variant="outline" className="w-full justify-between"><Link href="/settings">Settings hub <span>→</span></Link></Button>
        <Button asChild variant="outline" className="w-full justify-between"><Link href="/settings/payment-methods">Payment methods <span>→</span></Link></Button>
        <Button asChild variant="outline" className="w-full justify-between"><Link href="/receipts">My receipts <span>→</span></Link></Button>
        <Button asChild variant="outline" className="w-full justify-between"><Link href="/inbox">Inbox <span>→</span></Link></Button>
      </CardContent>
    </Card>
  )
}

function SidebarVerificationCard({ user }) {
  return (
    <Card className={user.verified ? 'border-green-200 bg-green-50/40' : ''}>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Verification</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span>Email</span>{user.emailVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
        <div className="flex items-center justify-between"><span>Phone</span>{user.phoneVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
        <div className="flex items-center justify-between"><span>Business</span>{user.businessVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
      </CardContent>
    </Card>
  )
}

function SidebarLinkCard({ title, href, description }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Link href={href} className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-neutral-900">{title}</div>
            <div className="text-xs text-neutral-600">{description}</div>
          </div>
          <span className="text-neutral-400">→</span>
        </Link>
      </CardContent>
    </Card>
  )
}

/* =========================================================================
   PRIMITIVES
   ========================================================================= */
function FieldRow({ label, icon: Icon, note, children }) {
  return (
    <div>
      <Label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      {children}
      {note && <p className="mt-1 text-[11px] text-neutral-500">{note}</p>}
    </div>
  )
}

function SavingHint({ label }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving {label}…
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <PageShell active="profile" maxWidth={null} padding="" bg="bg-neutral-50">
      <div className="h-40 w-full animate-pulse bg-neutral-200 sm:h-56" />
      <div className="container mx-auto -mt-12 px-4 sm:-mt-14">
        <div className="flex items-end gap-3">
          <div className="h-24 w-24 animate-pulse rounded-full border-4 border-white bg-neutral-200 sm:h-28 sm:w-28" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      </div>
      <div className="container mx-auto mt-8 grid gap-4 px-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />)}
        </div>
        <div className="space-y-3"><div className="h-32 animate-pulse rounded-xl bg-white shadow-sm" /></div>
      </div>
      <div className="container mx-auto mt-6 flex items-center gap-2 px-4 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading profile…
      </div>
    </PageShell>
  )
}

function ProfileError({ onRetry }) {
  return (
    <PageShell active="profile" maxWidth="max-w-md">
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold">Couldn&apos;t load your profile</h2>
          <p className="text-sm text-neutral-600">Check your connection and try again.</p>
          <Button onClick={onRetry} className="bg-green-700 hover:bg-green-800"><RefreshCw className="mr-1.5 h-4 w-4" /> Retry</Button>
        </CardContent>
      </Card>
    </PageShell>
  )
}
