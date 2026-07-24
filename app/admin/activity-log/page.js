'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function AdminActivityLog() {
  const { authFetch } = useAdmin()
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams({ limit: '200' })
    if (q) p.set('action', q)
    const r = await authFetch(`/api/admin/activity-log?${p}`)
    const j = await r.json()
    setLogs(j.logs || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Activity Log</h1>
          <p className="text-sm text-neutral-500">Audit trail of all admin moderation actions.</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Filter by action (e.g. user.ban)…" className="w-72" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">Loading…</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">No activity yet.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-xs text-neutral-500">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{l.actorEmail}<br /><span className="text-[10px] text-neutral-500">{l.actorRole}</span></td>
                <td className="px-3 py-2"><Badge variant="outline">{l.action}</Badge></td>
                <td className="px-3 py-2 text-xs">{l.targetKind} <span className="text-neutral-400">·</span> {l.targetLabel || l.targetId}</td>
                <td className="px-3 py-2 text-[11px] text-neutral-500"><pre className="max-w-md overflow-hidden truncate whitespace-pre-wrap">{l.payload ? JSON.stringify(l.payload) : ''}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
