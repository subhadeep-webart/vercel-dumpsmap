'use client'

// PostOwnerMenu — the author-only "⋯" menu with Edit and Delete, plus a delete
// confirmation dialog. Reused on the post detail page and on Activity Hub feed
// cards. Purely presentational: it calls `onEdit` (open the edit modal) and
// `onDelete` (perform the delete, returning a promise) — the caller owns what
// happens next (navigation / list removal).
//
// Render nothing unless `canManage` is true, so callers can drop it in
// unconditionally and let ownership gating live here.

import React, { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

export default function PostOwnerMenu({ canManage, onEdit, onDelete, size = 'md' }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!canManage) return null

  const iconBtn = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'

  const confirmDelete = async () => {
    setDeleting(true)
    const ok = await onDelete()
    setDeleting(false)
    if (ok) setConfirmOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Post options"
            className={`flex ${iconBtn} shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.() }}>
            <Pencil className="mr-2 h-4 w-4" /> Edit post
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
            className="text-red-600 focus:bg-red-50 focus:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={deleting ? undefined : setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Your post and its comments will be removed from the feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {deleting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Deleting…</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
