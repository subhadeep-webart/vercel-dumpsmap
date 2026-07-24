'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/components/admin/AdminContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plug, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

const STATUS_META = {
  connected:     { color: 'border-brand-300 bg-brand-50 text-brand-800',  icon: CheckCircle2, label: 'Connected' },
  coming_soon:   { color: 'border-amber-300 bg-amber-50 text-amber-800',  icon: AlertTriangle, label: 'Coming soon' },
  not_connected: { color: 'border-red-300 bg-red-50 text-red-700',        icon: XCircle, label: 'Not connected' },
}

export default function AdminIntegrations() {
  const { authFetch } = useAdmin()
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [notes, setNotes] = useState('')

  const load = async () => {
    const r = await authFetch('/api/admin/integrations')
    const j = await r.json()
    setItems(j.integrations || [])
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    const r = await authFetch(`/api/admin/integrations/${editing.key}`, { method: 'PATCH', body: JSON.stringify({ notes }) })
    if (r.ok) { toast.success('Saved'); setEditing(null); load() } else toast.error('Failed')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Integrations</h1>
        <p className="text-sm text-neutral-500">Manage 3rd-party services. Status auto-detects from env vars.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const meta = STATUS_META[i.status] || STATUS_META.not_connected
          const Icon = meta.icon
          return (
            <Card key={i.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Plug className="h-4 w-4 text-brand-600" /> {i.name}</span>
                  <Badge variant="outline" className={meta.color}><Icon className="mr-1 h-3 w-3" /> {meta.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[11px] uppercase tracking-wide text-neutral-400">{i.category}</div>
                <p className="mt-1 text-xs text-neutral-600">{i.notes}</p>
                {(i.envVars && i.envVars.length > 0) && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Required env vars</div>
                    <div className="flex flex-wrap gap-1">
                      {i.envVars.map((v) => (
                        <code key={v} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">{v}</code>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(i); setNotes(i.notes || '') }}>Edit notes</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.name} — notes</DialogTitle></DialogHeader>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this integration…" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
