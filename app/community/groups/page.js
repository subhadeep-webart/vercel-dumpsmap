'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Plus, Users, Search, MapPin, Star, BadgeCheck, Globe } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import PageShell from '@/components/PageShell'
import FieldError from '@/components/FieldError'
import { GroupCategoryIcon } from '@/lib/community-icons'
import { isLikelyLoggedIn } from '@/lib/api-client'
import { createGroupSchema } from '@/validator/community-group'
import { GROUP_CATEGORIES, CAT_BY_KEY, GROUP_FORM_DEFAULTS } from '@/constants/groups_constants'
import { useGroups, useCities } from '@/hooks/use-groups'
import { useGroupActions } from '@/hooks/use-group-actions'

export default function GroupsPage() {
  return (
    <Suspense fallback={<PageShell><div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">Loading groups…</div></PageShell>}>
      <GroupsPageInner />
    </Suspense>
  )
}

// useSearchParams() must live inside a <Suspense> boundary (see default export
// above) so the page can be statically prerendered without a CSR bailout.
function GroupsPageInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const [filter, setFilter] = useState({ city: sp.get('city') || '', category: sp.get('category') || '', q: '', mine: false })
  const [createOpen, setCreateOpen] = useState(false)

  const loggedIn = isLikelyLoggedIn()
  const { groups, loading, reload } = useGroups(filter)
  const { cities } = useCities()

  return (
    <PageShell active="community" breadcrumbs={[{ label: 'Community', href: '/community' }, { label: 'Groups' }]} maxWidth="max-w-6xl">
      <div className="container mx-auto px-4 py-4">
        <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100 p-4">
          <h1 className="text-lg font-extrabold md:text-xl">Local groups for haulers, contractors &amp; cleanup crews</h1>
          <p className="mt-0.5 text-sm text-neutral-700">Find your tribe. Join groups by city, category, or trade. Organizers can pin posts, edit rules, and moderate.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <CategoryChip current={filter.category} value="" label="All" icon={<Globe className="h-3.5 w-3.5" />} onClick={(v) => setFilter((f) => ({ ...f, category: v }))} />
            {GROUP_CATEGORIES.map((c) => (
              <CategoryChip key={c.key} current={filter.category} value={c.key} label={c.label} icon={<GroupCategoryIcon categoryKey={c.key} className="h-3.5 w-3.5" />} onClick={(v) => setFilter((f) => ({ ...f, category: v }))} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Browse by city</div>
                <div className="space-y-1">
                  <button onClick={() => setFilter((f) => ({ ...f, city: '' }))} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${!filter.city ? 'bg-brand-50 font-bold text-brand-800' : 'hover:bg-neutral-50'}`}>
                    <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> All cities</span>
                  </button>
                  {cities.slice(0, 12).map((c) => (
                    <button key={c.key} onClick={() => setFilter((f) => ({ ...f, city: f.city === c.name ? '' : c.name }))} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${filter.city === c.name ? 'bg-brand-50 font-bold text-brand-800' : 'hover:bg-neutral-50'}`}>
                      <span><MapPin className="mr-1 inline h-3 w-3" /> {c.name}</span>
                      <span className="text-[10px] text-neutral-500">{c.groups || 0}g · {c.posts || 0}p</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            {loggedIn && (
              <Card>
                <CardContent className="p-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.mine} onChange={(e) => setFilter((f) => ({ ...f, mine: e.target.checked }))} />
                    Show only groups I&apos;ve joined
                  </label>
                </CardContent>
              </Card>
            )}
          </aside>

          <main>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} placeholder="Search groups by name, description, tags…" className="pl-9" />
            </div>
            {loading && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">Loading groups…</div>}
            {!loading && groups.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-2 text-sm text-neutral-600">No groups match this view yet — be the first to start one for your city or trade.</p>
                {loggedIn ? <Button onClick={() => setCreateOpen(true)} className="mt-3 bg-brand-600 hover:bg-brand-700"><Plus className="mr-1 h-4 w-4" /> Create group</Button> : null}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => <GroupCard key={g.id} group={g} token={loggedIn} onChanged={reload} />)}
            </div>
          </main>
        </div>
      </div>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(g) => { setCreateOpen(false); router.push(`/community/groups/${g.slug || g.id}`) }} />
    </PageShell>
  )
}

function CategoryChip({ current, value, label, icon, onClick }) {
  const active = current === value
  return (
    <button onClick={() => onClick(value)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? 'border-brand-500 bg-brand-100 text-brand-900 shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'}`}>
      {icon}<span>{label}</span>
    </button>
  )
}

function GroupCard({ group, token, onChanged }) {
  const cat = CAT_BY_KEY[group.category] || CAT_BY_KEY.general
  const joined = !!group.myRole
  const { busy, join } = useGroupActions()
  const handleJoin = () => join(group.id, { loggedIn: token, loginMsg: 'Log in to join', successMsg: 'Joined', onReload: onChanged })
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/community/groups/${group.slug || group.id}`} className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Badge variant="outline" className="inline-flex items-center gap-1"><GroupCategoryIcon categoryKey={group.category} className="h-3.5 w-3.5" /> {cat.label}</Badge>
              {group.featured && <Badge variant="outline" className="inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-amber-700"><Star className="h-3 w-3" /> Featured</Badge>}
              {group.adminVerified && <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700"><BadgeCheck className="mr-0.5 h-3 w-3" />Verified</Badge>}
            </div>
            <h3 className="mt-1.5 truncate text-sm font-bold md:text-base">{group.name}</h3>
            {group.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{group.description}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
              {group.city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {group.city}{group.state ? `, ${group.state}` : ''}</span>}
              <span>· <Users className="inline h-3 w-3" /> {group.memberCount || 0} members</span>
              {group.postCount > 0 && <span>· {group.postCount} posts</span>}
            </div>
          </Link>
          <div className="shrink-0">
            {joined
              ? <Badge variant="outline" className="border-brand-300 bg-brand-50 text-brand-700">{group.myRole === 'group_admin' ? 'Organizer' : 'Joined'}</Badge>
              : <Button size="sm" onClick={handleJoin} disabled={busy} className="bg-brand-600 hover:bg-brand-700">Join</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateGroupDialog({ open, onOpenChange, onCreated }) {
  const { createGroup } = useGroupActions()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createGroupSchema),
    mode: 'onChange',
    defaultValues: GROUP_FORM_DEFAULTS,
  })

  // The category picker is a button grid, so it's registered manually and driven
  // via watch()/setValue() rather than a native input.
  const category = watch('category')

  // Reset back to a clean slate whenever the modal is (re)opened.
  useEffect(() => { if (open) reset(GROUP_FORM_DEFAULTS) }, [open, reset])

  // Only runs once zod validation passes (RHF blocks submit otherwise).
  const onSubmit = async (values) => {
    const group = await createGroup(values)
    if (!group) return
    reset(GROUP_FORM_DEFAULTS)
    onCreated?.(group)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 p-0">
        {/* Pinned header — stays put while the form body scrolls. */}
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 pb-4 pt-6">
          <DialogTitle>Create a new group</DialogTitle>
          <DialogDescription>You&apos;ll be added as the organizer with pin, edit, and member-management rights. Keep it operational and hyper-local.</DialogDescription>
        </DialogHeader>
        {/* handleSubmit gates on zod; the footer button submits this form. */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body — only this region overflows, not the whole modal. */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            <div>
              <label className="text-xs font-bold uppercase">Group name *</label>
              <Input {...register('name')} maxLength={80} placeholder="e.g. South Bay Haulers" aria-invalid={!!errors.name} />
              <FieldError msg={errors.name?.message} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Category *</label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {GROUP_CATEGORIES.map((c) => (
                  <button key={c.key} type="button" onClick={() => setValue('category', c.key, { shouldValidate: true, shouldDirty: true })} className={`flex items-center gap-1.5 rounded-lg border p-2 text-left text-xs transition ${category === c.key ? 'border-brand-500 bg-brand-50 font-bold text-brand-900' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}>
                    <GroupCategoryIcon categoryKey={c.key} className="h-3.5 w-3.5" /><span>{c.label}</span>
                  </button>
                ))}
              </div>
              <FieldError msg={errors.category?.message} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Description</label>
              <Textarea rows={3} {...register('description')} maxLength={1000} placeholder="What is this group about? Who should join?" aria-invalid={!!errors.description} />
              <FieldError msg={errors.description?.message} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase">City</label>
                <Input {...register('city')} placeholder="Hayward" aria-invalid={!!errors.city} />
                <FieldError msg={errors.city?.message} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase">State</label>
                <Input {...register('state')} maxLength={2} aria-invalid={!!errors.state} />
                <FieldError msg={errors.state?.message} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Tags (comma-separated)</label>
              <Input {...register('tags')} placeholder="haulers, south-bay, junk-removal" aria-invalid={!!errors.tags} />
              <FieldError msg={errors.tags?.message} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase">Group rules (one per line, optional)</label>
              <Textarea rows={3} {...register('rules')} placeholder="No scams. No harassment. Operational posts only." aria-invalid={!!errors.rules} />
              <FieldError msg={errors.rules?.message} />
            </div>
          </div>
          {/* Pinned footer — the primary action stays reachable. */}
          <div className="shrink-0 border-t border-neutral-200 px-6 py-4">
            <Button type="submit" disabled={isSubmitting} className="w-full bg-brand-600 hover:bg-brand-700">{isSubmitting ? 'Creating…' : 'Create group'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
