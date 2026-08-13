'use client'

// Resident (non-owner) panels for the Portal — the regular-user side of the
// role-based split described in docs/FACILITY_PORTAL_DEV.md §6 Q3:
//
//   ResidentDashboardPanel : "My Activity" — a snapshot of what they've contributed
//   ResidentJobsPanel      : jobs they posted + work they accepted
//   ResidentReportsPanel   : the reports/reviews they've filed
//
// Residents cannot manage facility data. Where that boundary might be unclear,
// the panels say so explicitly (PORTAL_COPY.residentNotice) and point at the
// reporting path instead, which is how a resident contributes price/wait signals.

import Link from 'next/link'
import {
  Activity, Briefcase, MessageSquareWarning, MapPin, Star, Building2,
  Info, ArrowUpRight, Megaphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import PortalCard from './PortalCard'
import { timeAgo } from './portal-helpers'
import { PORTAL_COPY } from '@/constants/facility_portal_constants'
import { useResidentPortal } from '@/hooks/use-resident-portal'

// ── shared bits ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body, cta, href }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 p-8 text-center">
      <Icon className="h-8 w-8 text-neutral-300" />
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {body && <p className="max-w-sm text-xs text-neutral-500">{body}</p>}
      {cta && href && (
        <Link href={href} className="mt-1">
          <Button size="sm" variant="outline" className="gap-1.5">{cta} <ArrowUpRight className="h-3.5 w-3.5" /></Button>
        </Link>
      )}
    </div>
  )
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">{value}</div>
    </div>
  )
}

// A resident's contribution is a signal, not verified facility data — the badge
// keeps that distinction visible (Q6).
function ReportRow({ report }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{report.label || report.type}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Community report
          </span>
        </div>
        {report.text && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{report.text}</p>}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
          {report.facilityName && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" /> {report.facilityName}
            </span>
          )}
          <span>{timeAgo(report.createdAt)}</span>
        </div>
      </div>
    </li>
  )
}

function JobRow({ title, meta, state, href }) {
  const row = (
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <Briefcase className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>
        {meta && <div className="mt-0.5 truncate text-[11px] text-neutral-400">{meta}</div>}
      </div>
      {state && (
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-neutral-600 ring-1 ring-neutral-200">
          {String(state).replace(/_/g, ' ')}
        </span>
      )}
    </div>
  )
  return <li>{href ? <Link href={href} className="block rounded-lg transition-colors hover:bg-neutral-50">{row}</Link> : row}</li>
}

// ── Dashboard ("My Activity") ─────────────────────────────────────────────────

export function ResidentDashboardPanel({ user }) {
  const { reports, reviews, postedJobs, acceptedWork, feed, loading } = useResidentPortal()
  const { title, body } = PORTAL_COPY.residentNotice

  return (
    <div className="space-y-5">
      <PortalCard id="dashboard" title="My Activity">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Megaphone} label="Reports" value={loading ? '—' : reports.length} />
            <StatTile icon={Star} label="Reviews" value={loading ? '—' : reviews.length} />
            <StatTile icon={Briefcase} label="Jobs posted" value={loading ? '—' : postedJobs.length} />
            <StatTile icon={Activity} label="Jobs accepted" value={loading ? '—' : acceptedWork.length} />
          </div>

          {/* Why this account can't edit facility data — stated plainly rather than
              leaving the resident to wonder where the management tools went. */}
          <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{body}</p>
              <Link href="/facilities" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                Find a facility to report on <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </PortalCard>

      <PortalCard id="recent" title="Recent Posts" index={1}>
        {feed.length ? (
          <ul className="divide-y divide-neutral-100">
            {feed.slice(0, 6).map((c) => (
              <li key={c.id} className="py-3">
                <Link href={c.href || '/activity-hub'} className="block">
                  <div className="truncate text-sm font-semibold text-neutral-900">{c.title || c.body || 'Post'}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-400">{timeAgo(c.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Activity}
            title={loading ? 'Loading your activity…' : 'Nothing here yet'}
            body="Posts you share in the Activity Hub show up here."
            cta="Open Activity Hub"
            href="/activity-hub"
          />
        )}
      </PortalCard>
    </div>
  )
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function ResidentJobsPanel() {
  const { postedJobs, acceptedWork, loading } = useResidentPortal()

  return (
    <div className="space-y-5">
      <PortalCard
        id="jobs-posted"
        title="Jobs I Posted"
        action={<Link href="/jobs"><Button size="sm" variant="outline" className="gap-1.5">Browse jobs <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>}
      >
        {postedJobs.length ? (
          <ul className="divide-y divide-neutral-100">
            {postedJobs.map((j) => (
              <JobRow
                key={j.id}
                title={j.title || 'Untitled job'}
                meta={[j.jobType, j.location?.city].filter(Boolean).join(' · ')}
                state={j.state}
                href={`/jobs/${j.id}`}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Briefcase}
            title={loading ? 'Loading…' : 'You haven’t posted a job yet'}
            body="Post a job when you need something hauled, cleared, or collected."
            cta="Go to Jobs"
            href="/jobs"
          />
        )}
      </PortalCard>

      <PortalCard id="jobs-accepted" title="Work I Accepted" index={1}>
        {acceptedWork.length ? (
          <ul className="divide-y divide-neutral-100">
            {acceptedWork.map((w) => (
              <JobRow
                key={w.id}
                title={w.scope || 'Work order'}
                meta={w.budget ? `Budget $${w.budget}` : null}
                state={w.state || w.status}
                href={`/jobs/${w.sourceId || w.id}`}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Briefcase}
            title={loading ? 'Loading…' : 'No accepted work yet'}
            body="Jobs you accept appear here so you can track them through to completion."
            cta="Find work"
            href="/jobs"
          />
        )}
      </PortalCard>
    </div>
  )
}

// ── My Reports ────────────────────────────────────────────────────────────────

export function ResidentReportsPanel() {
  const { reports, reviews, submissions, loading } = useResidentPortal()

  return (
    <div className="space-y-5">
      <PortalCard
        id="activity"
        title="My Reports"
        info="Reports are community signals — helpful to other users, but not the facility's official data."
      >
        {reports.length ? (
          <ul className="divide-y divide-neutral-100">
            {reports.map((r) => <ReportRow key={r.id} report={r} />)}
          </ul>
        ) : (
          <EmptyState
            icon={MessageSquareWarning}
            title={loading ? 'Loading your reports…' : 'No reports yet'}
            body="Seen a long wait, a closed gate, or a price that changed? Report it from the facility's page to help other users."
            cta="Find a facility"
            href="/facilities"
          />
        )}
      </PortalCard>

      {reviews.length > 0 && (
        <PortalCard id="reviews" title="My Reviews" index={1}>
          <ul className="divide-y divide-neutral-100">
            {reviews.map((rev) => (
              <li key={rev.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="text-sm font-semibold text-neutral-900">{rev.rating ? `${rev.rating} / 5` : 'Review'}</span>
                  <span className="text-[11px] text-neutral-400">{timeAgo(rev.createdAt)}</span>
                </div>
                {rev.text && <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{rev.text}</p>}
              </li>
            ))}
          </ul>
        </PortalCard>
      )}

      {submissions.length > 0 && (
        <PortalCard id="submissions" title="Facilities I Submitted" index={2}>
          <ul className="divide-y divide-neutral-100">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Building2 className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">{s.name}</span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-neutral-600">
                  {s.status || 'pending'}
                </span>
              </li>
            ))}
          </ul>
        </PortalCard>
      )}
    </div>
  )
}
