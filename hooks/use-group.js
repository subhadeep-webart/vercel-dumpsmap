'use client'

// useGroup — data reads for the community group detail page
// (app/community/groups/[id]/page.js).
//
// The page inlined three effect-driven fetches: the group itself (a 404 mapped
// to a 'not_found' sentinel), the group's posts, and — only once the Members
// tab is opened — the member list. All three now go through the central api
// client as SWR keys. The members key stays null until `membersEnabled` is
// true, preserving the original lazy-load, and separate reload callbacks let the
// action hook refresh exactly what a given mutation changed.

import useSWR from 'swr'
import { api } from '@/lib/api-client'
import { GROUP_POSTS_LIMIT, GROUP_MEMBERS_LIMIT } from '@/constants/groups_constants'

const fetcher = (path) => api.get(path)
const SWR_OPTS = { revalidateOnFocus: false, shouldRetryOnError: false }

// `membersEnabled` gates the members request the same way the page did (fetch
// only when the Members tab is active).
export function useGroup(id, membersEnabled) {
  const group = useSWR(id ? `/community/groups/${id}` : null, fetcher, SWR_OPTS)
  const posts = useSWR(
    id ? `/community/groups/${id}/posts?limit=${GROUP_POSTS_LIMIT}` : null,
    fetcher,
    SWR_OPTS,
  )
  const members = useSWR(
    id && membersEnabled ? `/community/groups/${id}/members?limit=${GROUP_MEMBERS_LIMIT}` : null,
    fetcher,
    SWR_OPTS,
  )

  // A 404 on the group is a real "not found", not a transient error — surface it
  // as a sentinel so the page can render its not-found state (matches the old
  // setGroup('not_found')). Anything still loading yields null.
  let groupValue = null
  if (group.error?.status === 404 || group.error?.code === 'not_found') {
    groupValue = 'not_found'
  } else if (group.data?.group) {
    groupValue = group.data.group
  }

  return {
    group: groupValue,
    posts: posts.data?.posts || [],
    members: members.data?.members || [],
    reloadGroup: () => group.mutate(),
    reloadPosts: () => posts.mutate(),
    reloadMembers: () => members.mutate(),
  }
}
