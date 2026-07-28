'use client'

// Materials tab — accepted materials, turned-away materials, and scale/access
// notes, with inline textarea editing for owners. Extracted from
// app/facilities/[id]/page.js.

import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertTriangle, Wrench, X } from 'lucide-react'
import { SectionCard } from './primitives'

export default function MaterialsTab({ facility, editing, editForm, setEditForm }) {
  const accepted = facility.accepted || []
  const notAccepted = facility.notAccepted || []
  const contractorNotes = facility.contractorNotes || []

  return (
    <div className="space-y-4">
      <SectionCard icon={CheckCircle2} title="What they take" iconClass="text-green-600">
        {editing ? (
          <Textarea rows={3} value={editForm.accepted} onChange={(e) => setEditForm((f) => ({ ...f, accepted: e.target.value }))} placeholder="Concrete, Wood, Mixed debris…" />
        ) : accepted.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {accepted.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                <CheckCircle2 className="h-3 w-3" /> {m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-neutral-500">Not yet verified. Call to confirm accepted materials.</p>
        )}
      </SectionCard>

      <SectionCard icon={AlertTriangle} title="Will turn away" iconClass="text-red-600">
        {editing ? (
          <Textarea rows={3} value={editForm.notAccepted} onChange={(e) => setEditForm((f) => ({ ...f, notAccepted: e.target.value }))} placeholder="Hazardous, Tires, Mattresses…" />
        ) : notAccepted.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {notAccepted.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <X className="h-3 w-3 shrink-0" /> {m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-neutral-500">No restrictions recorded. Call ahead to confirm.</p>
        )}
      </SectionCard>

      <SectionCard icon={Wrench} title="Scale & access notes" iconClass="text-amber-600">
        {contractorNotes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {contractorNotes.map((n) => (
              <Badge key={n} variant="outline" className="inline-flex items-center gap-1 border-orange-200 bg-orange-50 text-orange-800"><AlertTriangle className="h-3 w-3 shrink-0" /> {n}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-neutral-500">No contractor-specific notes yet.</p>
        )}
      </SectionCard>
    </div>
  )
}
