'use client'

// useTimeClockActions — write/mutation service for the Time Clock page.
//
// The page inlined ~10 /api mutations (clock in/out, break start/end, submit,
// delete, duplicate, CSV + email export) each with its own fetch, toast, and
// post-success reload. That's reusable service logic, not view logic, so it
// lives here; the page just calls the handlers and renders.
//
// Every action routes through the central api client, shows a success/error
// toast, and triggers the caller's onMutated() refresh (the page passes
// useTimeClock's reload). A single `busy` flag disables buttons + prevents
// double-submits while any request is in flight.
//
// Usage:
//   const actions = useTimeClockActions({ onMutated: reload })
//   await actions.clockIn(payload)

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { ymd, fmtMinutes } from '@/lib/time-clock-helpers'

// Pull a human message off an ApiError (the client puts the server's `error`
// field on err.data.error and also on err.message).
function errMsg(e, fallback) {
  if (e instanceof ApiError) return e.data?.error || e.message || fallback
  return fallback
}

export function useTimeClockActions({ onMutated } = {}) {
  const [busy, setBusy] = useState(false)

  // Wrap a mutation with the busy flag + a post-success reload. Returns the
  // action's result (or null on failure) so callers can branch.
  const withBusy = useCallback(async (fn) => {
    setBusy(true)
    try {
      return await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  const clockIn = useCallback((payload) => withBusy(async () => {
    try {
      await api.post('/time-clock/clock-in', payload || {})
      toast.success('Clocked in')
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Failed to clock in'))
      return false
    }
  }), [withBusy, onMutated])

  const clockOut = useCallback(() => withBusy(async () => {
    try {
      const j = await api.post('/time-clock/clock-out', {})
      toast.success(`Clocked out · ${fmtMinutes(j?.entry?.netMinutes || 0)} worked`)
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Failed to clock out'))
      return false
    }
  }), [withBusy, onMutated])

  const breakStart = useCallback(() => withBusy(async () => {
    try {
      await api.post('/time-clock/break/start')
      toast.success('Break started')
    } catch (e) {
      toast.error(errMsg(e, 'Could not start break'))
    }
    onMutated?.()
  }), [withBusy, onMutated])

  const breakEnd = useCallback(() => withBusy(async () => {
    try {
      await api.post('/time-clock/break/end')
      toast.success('Back to work')
    } catch (e) {
      toast.error(errMsg(e, 'Could not end break'))
    }
    onMutated?.()
  }), [withBusy, onMutated])

  const submit = useCallback(async (id) => {
    try {
      await api.post(`/time-clock/entries/${id}/submit`)
      toast.success('Submitted for approval')
    } catch (e) {
      toast.error(errMsg(e, 'Submit failed'))
    }
    onMutated?.()
  }, [onMutated])

  const remove = useCallback(async (id) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    try {
      await api.del(`/time-clock/entries/${id}`)
      toast.success('Deleted')
    } catch {
      toast.error('Delete failed')
    }
    onMutated?.()
  }, [onMutated])

  const duplicate = useCallback(async (id) => {
    const targetDate = prompt('Duplicate to date (YYYY-MM-DD)?', ymd())
    if (!targetDate) return
    try {
      await api.post(`/time-clock/entries/${id}/duplicate`, { targetDate })
      toast.success('Shift duplicated')
    } catch (e) {
      toast.error(errMsg(e, 'Duplicate failed'))
    }
    onMutated?.()
  }, [onMutated])

  const exportCsv = useCallback(async () => {
    try {
      const res = await api.raw('/time-clock/export.csv?from=&to=')
      if (!res.ok) throw new Error('bad status')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `timeclock_${ymd()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('CSV downloaded')
    } catch {
      toast.error('Export failed')
    }
  }, [])

  const emailExport = useCallback(async () => {
    try {
      const j = await api.get('/time-clock/email-payload')
      const params = new URLSearchParams({ subject: j?.subject || 'Timesheet', body: j?.body || '' })
      window.location.href = `mailto:${encodeURIComponent(j?.to || '')}?${params.toString()}`
    } catch (e) {
      toast.error(errMsg(e, 'Email payload failed'))
    }
  }, [])

  // Save the settings form. Coerces the numeric fields, returns the saved
  // settings object on success (so the caller can patch its cache) or null.
  const saveSettings = useCallback((form) => withBusy(async () => {
    try {
      const j = await api.patch('/time-clock/settings', {
        roundToMinutes: Number(form.roundToMinutes),
        roundDirection: form.roundDirection,
        autoBreakMinutes: Number(form.autoBreakMinutes),
        managerEmail: form.managerEmail,
        defaultRate: Number(form.defaultRate),
      })
      toast.success('Settings saved')
      return j?.settings || null
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'))
      return null
    }
  }), [withBusy])

  // Create or update a manual entry. `entryId` present → PATCH, else POST.
  // Returns true on success. Validation of required times stays in the dialog.
  const saveEntry = useCallback((payload, entryId) => withBusy(async () => {
    try {
      const path = entryId ? `/time-clock/entries/${entryId}` : '/time-clock/entries'
      if (entryId) await api.patch(path, payload)
      else await api.post(path, payload)
      toast.success(entryId ? 'Entry updated' : 'Manual entry created')
      onMutated?.()
      return true
    } catch (e) {
      toast.error(errMsg(e, 'Save failed'))
      return false
    }
  }), [withBusy, onMutated])

  return {
    busy,
    clockIn, clockOut, breakStart, breakEnd,
    submit, remove, duplicate, exportCsv, emailExport,
    saveSettings, saveEntry,
  }
}
