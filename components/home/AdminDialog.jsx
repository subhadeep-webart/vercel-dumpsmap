'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

// ---------- Admin Dialog ----------
export default function AdminDialog({ open, onOpenChange }) {
  const [email, setEmail] = useState('admin@dumpmaps.com')
  const [password, setPassword] = useState('admin123')
  const [pending, setPending] = useState([])
  const [me, setMe] = useState(null)

  // Auth rides in the httpOnly session cookie (attached automatically by the
  // global fetch shim on every /api call), so there's no token to track in JS.
  const login = async () => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const j = await r.json()
    if (r.ok && j.user) {
      setMe(j.user)
      toast.success(`Welcome, ${j.user.name}`)
      loadPending()
    } else {
      toast.error(j.error || 'Login failed')
    }
  }

  const loadPending = async () => {
    const r = await fetch('/api/admin/pending')
    const j = await r.json()
    if (j.facilities) setPending(j.facilities)
  }

  useEffect(() => {
    if (!open) return
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => {
        setMe(j.user)
        if (j.user?.role === 'admin') loadPending()
      })
      .catch(() => {})
  }, [open])

  const moderate = async (id, payload) => {
    const r = await fetch(`/api/admin/facilities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      toast.success('Updated')
      loadPending()
    }
  }

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* best-effort */ }
    setMe(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admin Dashboard</DialogTitle>
        </DialogHeader>
        {!me || me.role !== 'admin' ? (
          <div className="space-y-3 pt-2">
            <div className="text-sm text-neutral-600">
              Demo admin pre-seeded — log in to moderate submissions.
            </div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <Button onClick={login} className="w-full bg-brand-600 hover:bg-brand-700">Log in</Button>
            <div className="text-xs text-neutral-500">Default: admin@dumpmaps.com / admin123</div>
          </div>
        ) : (
          <div className="pt-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-neutral-600">Logged in as <b>{me.email}</b></div>
              <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
            </div>
            <div className="mb-2 text-sm font-semibold">Pending submissions ({pending.length})</div>
            <div className="space-y-2">
              {pending.map((f) => (
                <div key={f.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-xs text-neutral-500">{f.type} · {f.address}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => moderate(f.id, { status: 'approved', verified: true })}>
                        Approve + Verify
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => moderate(f.id, { status: 'approved' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => moderate(f.id, { status: 'rejected' })}>
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!pending.length && <div className="text-sm text-neutral-500">No pending submissions.</div>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
