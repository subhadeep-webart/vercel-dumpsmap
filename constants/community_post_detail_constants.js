// Constants for the community post detail page (app/community/posts/[id]).
// Kept out of the components so the presentational layer stays declarative.

import { Home } from 'lucide-react'

// Reaction applied by a plain tap on the React button; long-press picks another.
export const DEFAULT_REACTION = 'helpful'

// How long (ms) to hold the React button before the full reaction panel opens.
export const REACTION_LONG_PRESS_MS = 350

// Grace delay (ms) before a hovered reaction panel closes, so the pointer can
// travel from the button up to the emojis without it snapping shut.
export const REACTION_HOVER_CLOSE_MS = 250

// Back target — the Activity Hub is the feed source-of-truth.
export const POST_DETAIL_BACK = '/activity-hub'

// Character limits past which long text collapses behind a "Read more" toggle.
// Comments are shorter/denser, so they truncate sooner than the post body.
export const POST_BODY_TRUNCATE = 400
export const COMMENT_TRUNCATE = 220

// Hard cap on how many characters a comment may contain. Matches the server,
// which slices the body to 2000 chars on save.
export const COMMENT_MAX_LENGTH = 2000

// Show the live character counter only once the draft gets within this many
// characters of the cap, so it stays out of the way for normal short comments.
export const COMMENT_COUNTER_THRESHOLD = 200

// Comments are paginated newest-first; "Load more" reveals older ones. This is
// the page size for both the initial load and each subsequent batch.
export const COMMENTS_PAGE_SIZE = 15

// Breadcrumb trail for the post detail page. Home › Community › <category>.
// The last crumb is dynamic (the post's category), so this is a builder rather
// than a static array.
export const buildPostBreadcrumbs = (categoryLabel) => [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Community', href: '/community' },
  { label: categoryLabel || 'Post' },
]
