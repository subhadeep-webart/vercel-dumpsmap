'use client'

// useActivityHub — all data reads for the Activity Hub feed.
//
// The page component used to inline the feed fetch, the AbortController + 10s
// watchdog, the loading/hasMore state machine, and a hand-rolled
// IntersectionObserver "load more" that appended de-duped pages to local state.
// This hook owns that via useSWRInfinite, so the feed is cached/deduped,
// revalidates on focus, and paginates through the same `before=<createdAt>`
// cursor the API already speaks. The page just renders and calls loadMore().
//
// Pagination cursor: the feed mixes user posts (real createdAt) with aggregate
// cards (jobs/bounties/alerts with synthetic ids). We page with the OLDEST
// user-post createdAt from the previous page as `before`; when a page has no
// user post to anchor on, there's nothing older to fetch and we stop.
//
// The signed-in user is owned by the page (via useRequireAuth, which also drives
// the SoftLoginModal); this hook only reads the feed.

import { useCallback, useMemo } from 'react'
import useSWRInfinite from 'swr/infinite'
import { api } from '@/lib/api-client'
import { FEED_PAGE_SIZE } from '@/constants/activity_hub_constants'

const fetcher = (path) => api.get(path)

// Oldest user-post createdAt in a page, used as the `before` cursor for the
// next page. Aggregate cards have synthetic ids, so we only anchor on real
// posts (kind === 'post').
function oldestPostCursor(page) {
  const arr = Array.isArray(page?.feed) ? page.feed : []
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.kind === 'post' && arr[i]?.createdAt) return arr[i].createdAt
  }
  return null
}

export function useActivityHub(filter) {
  // getKey builds each page's request. Page 0 has no cursor; later pages use
  // the previous page's oldest user-post createdAt. Returning null stops
  // pagination (SWR treats a null key as "no more pages").
  const getKey = useCallback((pageIndex, previousPage) => {
    if (previousPage) {
      // Previous page came back short → no further pages.
      if (!Array.isArray(previousPage.feed) || previousPage.feed.length < FEED_PAGE_SIZE) return null
      const before = oldestPostCursor(previousPage)
      if (!before) return null
      return `/activity-hub/feed?filter=${filter}&limit=${FEED_PAGE_SIZE}&before=${encodeURIComponent(before)}`
    }
    return `/activity-hub/feed?filter=${filter}&limit=${FEED_PAGE_SIZE}`
  }, [filter])

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    getKey,
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  )

  // Flatten all pages into one feed, de-duping by card id (aggregate cards can
  // recur across page boundaries).
  const feed = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const page of data || []) {
      for (const card of (page?.feed || [])) {
        if (card?.id != null && seen.has(card.id)) continue
        if (card?.id != null) seen.add(card.id)
        out.push(card)
      }
    }
    return out
  }, [data])

  const lastPage = data?.[data.length - 1]
  const reachedEnd = !!data && Array.isArray(lastPage?.feed) && lastPage.feed.length < FEED_PAGE_SIZE
  const hasMore = !reachedEnd && (!data || (getKey(size, lastPage) !== null))

  // SWR marks pages beyond the first as loading via isValidating while size grows.
  const loadingMore = isValidating && !!data && size > data.length

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return
    setSize((s) => s + 1)
  }, [hasMore, loadingMore, setSize])

  return {
    feed,
    loading: isLoading && !data,
    loadingMore,
    hasMore,
    loadMore,
    error: error || null,
    // Imperative cache access for optimistic writes (prepend a new post,
    // patch/remove a card). Callers pass a mapper over the pages array.
    mutate,
  }
}
