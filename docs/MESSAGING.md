# Messaging (Direct Messages) — current state & implementation plan

> Scope of this doc: **1:1 direct messages between users, text only.**
> Explicitly out of scope: real-time sockets, message caching/offline sync, typing
> indicators, read receipts UI, attachments. This is *not* a WhatsApp-grade chat —
> it is a lightweight "contact this person" inbox. Polling is the transport.

---

## 1. TL;DR — what already exists

Direct messaging is **already built end-to-end** in this codebase. It was shipped
in the PR-2b phase and never given a dedicated page beyond `/inbox`. Nothing needs
to be built from zero; the work is **surfacing, wiring, and cleanup**.

| Layer | File | Status |
|---|---|---|
| API handler | [messaging.js](../app/api/%5B%5B...path%5D%5D/handlers/messaging.js) | ✅ Done — 4 endpoints |
| Unread counter | [inboxCount.js](../app/api/%5B%5B...path%5D%5D/handlers/inboxCount.js) | ✅ Done |
| Thread panel UI | [DmThreadPanel.jsx](../components/messaging/DmThreadPanel.jsx) | ✅ Done |
| "Message" CTA | [StartDmButton.jsx](../components/messaging/StartDmButton.jsx) | ✅ Done |
| Toast/desktop notifications | [DmNotificationListener.jsx](../components/messaging/DmNotificationListener.jsx) | ✅ Done |
| Inbox page | [app/(app)/inbox/page.js](../app/(app)/inbox/page.js) | ⚠️ Works, but violates the 4 cleanup conventions |
| `/messages` route | [app/messages/page.js](../app/messages/page.js) | ✅ Redirects → `/inbox` |
| Activity Hub message entry point | [FeedCard.jsx](../components/activity-hub/FeedCard.jsx) | ❌ **Missing — this is the client request** |
| `?dm=<userId>` deep link | — | ❌ **Broken — callers pass it, inbox ignores it** |

---

## 2. Decisions on record

Settled calls, with the reasoning that produced them. The point of writing these
down is so they don't get re-litigated in three months — if you're about to
overturn one, check whether the condition in "What would change this" actually
fired.

### D1 — Transport: **polling, not WebSocket/Socket.io**
*Decided 2026-08-12. Status: firm.*

Direct messages poll on a 5s interval. We are **not** adding WebSockets or
Socket.io, and not adopting a hosted realtime service (Pusher/Ably/Supabase
Realtime).

**Why:**

1. **The deployment model fights it.** The entire backend is one Next.js App Router
   catch-all route handler. Route handlers are request/response — they terminate.
   A WebSocket needs a persistent process holding the connection open. That means
   either a custom `server.js` wrapping Node's http server (which this project does
   not have, and which forfeits some Next optimizations) or an external paid
   service. **Socket.io specifically cannot attach to a Next route handler at all**
   — it needs the underlying HTTP server.
2. **5s is imperceptible for this use case.** This is "message the seller about a
   listing" / "ask the facility owner a question", not a live group chat. No one is
   watching for a reply in real time.
3. **It matches the stated product requirement.** Client explicitly ruled out
   caching and WhatsApp-grade chat. Realtime sockets are the other half of that
   same bet — they exist to buy sub-second delivery and presence.
4. **Latency was never the actual problem.** The real inefficiency is three
   overlapping 5s timers, two of them hitting the same endpoint (§5). Sockets do
   not fix that. The Phase 3 SWR refactor does, for free, via request dedup.
5. **The cost lands on unsolved parts.** Sockets bring reconnection handling,
   scaling per open connection, a polling fallback anyway, and — significantly —
   re-solving auth: the session is an httpOnly cookie with CSRF double-submit, and
   that has to be redone for the socket handshake.

**What would change this:** *not* latency complaints — **product scope**. If typing
indicators, online presence, or live group chat get added, bidirectional realtime
becomes the actual product and sockets earn their cost. Short of that, they don't.

**The cheap middle step, if it ever needs to feel live:** **Server-Sent Events**.
One-directional server→client push over plain HTTP, no custom server needed on a
persistent host, and sending stays an ordinary POST. That gets push-style delivery
without socket infrastructure. Reach for SSE before reaching for sockets.

**Why this is safely reversible:** the transport is isolated inside
`DmThreadPanel` and the inbox hooks, so the swap surface is small. The Phase 3 SWR
refactor makes a future swap *easier*, not harder — it centralizes the reads a
push transport would replace.

> ✅ **Deploy target confirmed (2026-08-12): Vercel.** This closes the question by
> platform, not by preference — Vercel is serverless, so there is no long-lived
> process to hold a socket open. **WebSockets and Socket.io are not available here
> at all.** Reasons 1–5 above explain why polling would still be the right call on
> a persistent host; on Vercel there is no alternative to weigh.
>
> **Planned migration:** the client will move to their own hosting later (date TBD).
> That does *not* auto-reopen this decision — it only makes a push transport
> *possible* again. If and when the move happens, re-evaluate in this order:
> 1. Has product scope actually grown (typing indicators / presence / live group
>    chat)? If no → **stay on polling**, the move changes nothing.
> 2. If yes → **SSE first**. It needs only a persistent host, no custom server, and
>    sending stays an ordinary POST.
> 3. Sockets only if SSE's one-directional model is genuinely insufficient — and
>    budget for the custom `server.js` plus re-solving the httpOnly-cookie/CSRF
>    handshake auth.

### D2 — Threads are derived, never stored
*Pre-existing (PR-2b), documented here. Status: firm.*

There is no `dm_threads` collection. Thread identity is computed from the two user
ids (§3). Do not "fix" this by adding a threads collection — the derived scheme is
why opening a thread costs zero writes and why both parties agree on the id without
a lookup. Its one real consequence — empty threads are invisible until the first
message — is intentional.

### D3 — No caching layer
*Client requirement. Status: firm.*

No persisted message store, no offline sync, no optimistic cache beyond the
in-memory append-on-send that reconciles on the next poll.

> **Not a contradiction:** the Phase 3 move to SWR is for **request dedup and
> polling ergonomics**, not caching. SWR collapsing two identical in-flight
> `/dm/threads` requests is not the persisted-cache layer the client ruled out.
> Keep `revalidateOnFocus: false` and expect data to come from the network.

### D4 — Text-only
*Client requirement. Status: firm for this pass.*

The API already accepts and stores a `photos[]` array (capped at 6) — it is dead
weight for now. **Do not delete the field**; leaving it costs nothing and removing
it would need a migration if attachments are ever approved. Just don't build UI
for it.

### D5 — `StartDmButton` is the only sanctioned way to open a DM
*Convention. Status: firm.*

Any new "message this person" entry point composes `StartDmButton` rather than
hand-rolling a `POST /api/dm/threads` + dialog. It already encodes the login gate,
the self-DM guard, and the error toast. Six call sites use it; the Activity Hub
card will be the seventh.

### D6 — All API calls go through `lib/api-client`
*Codebase-wide convention. Status: firm.*

Never bare `fetch()`. The client attaches `credentials: 'include'` and the
`X-CSRF-Token` double-submit header on mutations — a bare `fetch` silently breaks
CSRF on any mutating call. Note that `components/Marketplace.jsx` and
`components/field/FieldShell.jsx` still call `fetch('/api/inbox/unread-count')`
directly; those are pre-existing violations worth cleaning up when touched.

---

## 3. Data model

MongoDB collection: **`dm_messages`**. There is **no `dm_threads` collection** —
threads are *derived*, not stored. This is the single most important thing to
understand about this feature.

```js
// one document per message
{
  id:         "uuid-v4",
  threadId:   "dm_<userIdA>_<userIdB>",  // the two ids sorted lexicographically
  fromUserId: "<sender id>",
  toUserId:   "<recipient id>",
  body:       "text content",
  photos:     [],                         // schema supports it; text-only for now
  read:       false,
  readAt:     Date,                       // set when marked read
  createdAt:  Date,
}
```

### Thread identity

```js
const makeDmThreadId = (a, b) => {
  const [u1, u2] = [a, b].sort()
  return `dm_${u1}_${u2}`
}
```

Deterministic and symmetric — both participants compute the same `threadId`
without a lookup. Consequences:

- **Opening a thread costs zero writes.** `POST /api/dm/threads` just computes the
  id and returns it; the thread "exists" once the first message is inserted.
- **Empty threads are invisible.** If A opens a thread with B and never sends,
  neither party sees it in their list. This is intentional and fine.
- **Authorization is string-matching**, not a membership lookup:
  `tid.startsWith('dm_') && tid.includes(auth.id)`. See §8 for the caveat.

### Related (separate) message systems

DM is one of **four** message sources unified in the inbox. Do not confuse them:

| Source | Collection | Unread field |
|---|---|---|
| Direct messages | `dm_messages` | `toUserId` + `read:false` |
| Marketplace | `marketplace_messages` | `receiverId` + `read:false` |
| Jobs | `job_messages` | `receiverId` + `read:false` |
| Group chats | `community_group_messages` | `createdAt > member.lastReadAt` |

---

## 4. API surface

All routes are served by the single catch-all
[`app/api/[[...path]]/route.js`](../app/api/%5B%5B...path%5D%5D/route.js). The DM
handler is dispatched **first** in
[`handlers/index.js`](../app/api/%5B%5B...path%5D%5D/handlers/index.js) →
`dispatchPr2b()`, so nothing can shadow it.

### `GET /api/dm/threads`
Returns the caller's derived thread list.

```jsonc
{
  "threads": [{
    "threadId": "dm_a_b",
    "otherUserId": "b",
    "otherUserName": "Jane",
    "otherUserAvatar": "https://…",
    "otherUserVerification": "normal_user",
    "lastMessage": "see you then",
    "lastMessageAt": "2026-08-12T…",
    "lastSenderId": "b",
    "unread": 2
  }],
  "totalUnread": 2
}
```

Implementation: pulls the caller's **last 800 messages** sorted newest-first, then
folds them into a Map keyed by `threadId` (first hit per thread wins = latest
message). Other-party users are batch-fetched with one `$in` query — do not
reintroduce the per-thread `findOne` that was removed here.

> ⚠️ **Known limit:** the 800-message window means a very chatty user could have an
> old thread fall off the list entirely. Acceptable at current scale; noted in §9.

### `POST /api/dm/threads`
Body `{ userId }`. Validates the target exists and isn't self, returns the computed
thread stub. **Writes nothing.**

### `GET /api/dm/threads/:threadId/messages`
Returns up to 500 messages ascending by `createdAt`, and **side-effects a
`updateMany` marking the caller's incoming messages read.** Reading is marking.

### `POST /api/dm/threads/:threadId/messages`
Body `{ body }` (and optionally `photos`, unused for now). Derives the recipient by
splitting the threadId. Inserts and returns the created message.

### `PATCH /api/dm/threads/:threadId/read`
Bulk-marks incoming messages read. Currently unused by the frontend since GET
already does it — keep it for the "mark all read" affordance.

### `GET /api/inbox/unread-count`
Cross-source badge counts:
`{ count, dm, marketplace, jobs, groups, groupBreakdown[] }`.

> ⚠️ The group-chat branch loops `countDocuments` **once per membership** — an N+1.
> Not a DM problem, but it sits on the same 5s poll. See §9.

---

## 5. Frontend architecture

### Transport: polling, no cache

Confirmed against the client's requirement — **no caching layer, no realtime.**

| Component | Interval | Endpoints |
|---|---|---|
| `DmThreadPanel` | 5s (`POLL_MS`) | `GET /dm/threads/:tid/messages` |
| Inbox page | 5s (`POLL_MS`) | `dm/threads`, `marketplace/inbox/threads`, `inbox/unread-count` |
| `DmNotificationListener` | 5s (`POLL_MS`) | `dm/threads`, `inbox/unread-count` |

Note that with the inbox open and a thread selected, **three independent 5s timers**
are running (two of them hitting `/dm/threads`). The listener does suppress *toasts*
on `/inbox`, but it still polls. Consolidating this is §7, item 4.

Messages are appended optimistically on send (`setMessages(prev => [...prev, msg])`)
and reconciled on the next poll.

### Auth

Session is an **httpOnly cookie**; JS cannot read it. Rules:

- All calls go through `api` from [`lib/api-client`](../lib/api-client.js) — it
  attaches `credentials: 'include'` and the `X-CSRF-Token` double-submit header on
  mutations. **Never use bare `fetch()`.**
- Client-side "is logged in?" gates use `isLikelyLoggedIn()` (presence of the
  readable `dm_csrf` cookie). It's a hint; the server always re-validates.
- The `token` prop on `DmThreadPanel` / `StartDmButton` is **vestigial** — accepted
  for backward compat, unused. New call sites should not pass it.

### Components

**`StartDmButton`** — the canonical "Message this person" CTA. Renders a button,
`POST`s to open the thread, and opens a `Dialog` containing a `DmThreadPanel`.

```jsx
<StartDmButton
  targetUserId={author.id}
  targetUserName={author.name}
  currentUser={user}
  variant="ghost" size="sm" label="Message"
/>
```

Already used in: contractor detail, facility sidebar, Jobs, Marketplace, public
profile actions.

**`DmThreadPanel`** — the conversation view. Bubbles (blue right / grey left),
textarea with Enter-to-send + Shift+Enter newline, 2000-char cap, 5s poll.

**`DmNotificationListener`** — mounted globally via `GlobalNotificationsMount`.
Baselines on first tick (no toast storm on load), then fires a sonner toast +
optional browser Notification + optional WebAudio ping per new incoming message.

---

## 6. The client request — comment vs. message icon on Activity Hub cards

### What the client said
> "In the activity hub page each card has the comment sign, now it's showing as the
> message icon. Client wants a comment icon there, and instead of that we have to
> put a message icon for the direct message."

### What's actually in the code

[`FeedCard.jsx:129`](../components/activity-hub/FeedCard.jsx#L129) — the comments
toggle uses **`MessageSquare`**, which reads visually as a *chat/DM* bubble:

```jsx
<button onClick={() => setCommentsOpen(v => !v)} …>
  <MessageSquare className="h-4 w-4" /> {card.comments || 0}
</button>
```

The same `MessageSquare` also appears at [line 156](../components/activity-hub/FeedCard.jsx#L156)
(aggregate-card footer) and in
[`activity_hub_constants.js`](../constants/activity_hub_constants.js) for the
`general` post-type badge.

And there is **no DM entry point on a feed card at all** — you can like, comment,
save, share, and view, but you cannot message the author.

### The fix — two parts

**(a) Change the comment icon.** Swap `MessageSquare` → **`MessageCircle`** (a
rounded speech bubble = the conventional "comment" affordance) on the comments
button only. Leave the type-badge constant alone.

**(b) Add a DM icon.** Add a **`Send`** (paper-plane) or **`MessageCircle`**-distinct
action to the card footer that opens a DM with `card.author`.

> **Open question for the client — see §10.** "Comment icon" and "message icon" are
> both speech bubbles in Lucide, so we must pick a pair that reads unambiguously.
> Recommended pairing: **comment = `MessageCircle`**, **DM = `Send`** (paper plane).

### Data is already available

`postToCard()` in
[`activityHub.js`](../app/api/%5B%5B...path%5D%5D/handlers/activityHub.js) already
projects everything needed — no API change required:

```js
posterId: p.authorId,
author: { id, name, avatarUrl, verificationLevel, role }
```

Gating rules for the new button:
- Only on `card.kind === 'post'` (aggregate job/bounty/alert cards have no author).
- Hide when `card.posterId === user.id` (can't DM yourself — the API 400s).
- Logged-out → route through `requireAuth('message')` so `SoftLoginModal` fires,
  matching how like/save already behave.

---

## 7. Implementation plan

### Phase 1 — Activity Hub icons + DM entry point *(the client ask)*
1. `FeedCard.jsx`: comments button icon `MessageSquare` → `MessageCircle`.
2. `FeedCard.jsx`: add a message action rendering `StartDmButton` (or a slim icon
   button that opens the same dialog) for `isUserPost && author.id !== user.id`.
3. Add a `'message'` entry to whatever action-label map `SoftLoginModal` reads, so
   the logged-out prompt reads correctly.
4. Hoist any new icon choices into `constants/activity_hub_constants.js` rather
   than hardcoding in the component (cleanup rule #1).

### Phase 2 — Fix the `?dm=<userId>` deep link *(currently dead)*
Three call sites already push `/inbox?dm=<userId>`:
- [jobs/[id]/page.js:35](../app/(app)/jobs/%5Bid%5D/page.js#L35)
- [marketplace/[id]/page.js:69](../app/(app)/marketplace/%5Bid%5D/page.js#L69)
- [field/FieldShell.jsx:270](../components/field/FieldShell.jsx#L270)

The inbox page **never reads `searchParams`**, so these land on a generic inbox with
nothing selected. Fix: read `?dm=`, `POST /api/dm/threads` to resolve the thread,
auto-select it, then strip the param via `router.replace` (mirror the
`?compose=` pattern in `activity-hub/page.js`). Requires a `<Suspense>` boundary —
Next 15 needs it around `useSearchParams()`.

Same for `/notifications` → `/inbox?tab=notifications`: the `tab` param is
likewise ignored, and there is no `notifications` tab.

### Phase 3 — Refactor `app/(app)/inbox/page.js` to house conventions
The page is a 246-line client component holding all four tabs' state, three raw
polls, and an inline `SoftLoginModal`-less auth gate. Per the standing cleanup
rules it should become:

| New file | Contents |
|---|---|
| `constants/inbox_constants.js` | `POLL_MS`, `SOUND_KEY`, the `TABS` array (key/label/icon), empty-state copy |
| `lib/inbox-helpers.js` | thread-preview truncation, unread-badge formatting (`99+`), avatar initial |
| `hooks/use-inbox.js` | SWR reads for threads + unread counts (`refreshInterval: POLL_MS`) |
| `hooks/use-inbox-actions.js` | open/select thread, mark-read, send |
| `components/messaging/ThreadList.jsx` | the DM list column |
| `components/messaging/SoundToggle.jsx` | lift the inline component out |

SWR with `refreshInterval` replaces the hand-rolled `setInterval` and gives request
dedup for free — which also collapses the duplicate `/dm/threads` polls (§5).
Note: dedup is *not* the same as the caching the client ruled out; there is no
persisted message store and no offline layer.

Follow the established opts: `{ revalidateOnFocus: false, shouldRetryOnError: false }`,
`const fetcher = (path) => api.get(path)`.

### Phase 4 — Polish (optional, confirm with client)
- Empty-thread state and a "Message" CTA from a user's public profile card.
- `PATCH /read` wired to a "mark all read" button.
- Mobile: full-screen thread view instead of the 320px/1fr split grid.

---

## 8. Security notes

**Thread authorization is a substring check.** In `messaging.js`:

```js
if (!tid.startsWith('dm_') || !tid.includes(auth.id)) return 403
```

This is correct only because user ids are UUIDs (fixed length, not prefixes of one
another). It would break if ids ever became sequential or variable-length — a user
with id `1` would match every thread containing `1`. If the id scheme changes,
switch to parsing `tid.slice(3).split('_')` and comparing both halves exactly.

**Recipient derivation trusts the threadId.** `POST …/messages` derives `otherId`
from the threadId string rather than validating the user exists. A malformed-but-
authorized threadId could write a message addressed to a non-existent user. Low
impact (the message is simply unreadable), but worth tightening.

**No rate limiting or blocking.** There's no per-user send throttle, no block list,
and no report flow on DMs. The panel's footer says "spam will be moderated" — there
is currently no mechanism behind that claim. Flag to the client if DMs go public.

**CSRF** is handled centrally by `api-client` — as long as call sites use it.

---

## 9. Known issues / tech debt

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | `?dm=<userId>` deep link ignored | inbox page | **High** — 3 dead call sites |
| 2 | No DM entry point on Activity Hub cards | `FeedCard.jsx` | **High** — client ask |
| 3 | Comment icon reads as a message icon | `FeedCard.jsx:129` | **High** — client ask |
| 4 | Three overlapping 5s polls when inbox is open | inbox + panel + listener | Medium |
| 5 | Unread-count group branch is N+1 `countDocuments` | `inboxCount.js:19-31` | Medium |
| 6 | 800-message window can drop old threads from the list | `messaging.js:23` | Low |
| 7 | Inbox page violates all 4 cleanup conventions | inbox page | Medium |
| 8 | `?tab=notifications` param ignored; no such tab | inbox page | Low |
| 9 | Dead `soundRef` assignment (`? null : null`) | `DmNotificationListener.jsx:29-30` | Trivial |
| 10 | `photos` supported by API, no UI — dead path for now | messaging.js | Trivial |

---

## 10. Questions for the client

1. **Icon pairing.** Lucide's "comment" and "message" glyphs are both speech
   bubbles. Which pair do you want?
   - **(Recommended)** comment = `MessageCircle` (bubble), DM = `Send` (paper plane)
   - comment = `MessageSquare` (square bubble), DM = `MessageCircle` (round bubble)
   - comment = `MessageCircle`, DM = `Mail` (envelope)

2. **Where does the DM button live on the card?** Inline in the action row next to
   like/comment/save/share, or tucked into the author row on the top-right?

3. **Dialog or navigate?** Tapping message on a feed card — open the existing modal
   `DmThreadPanel` in place (keeps feed scroll position), or navigate to
   `/inbox?dm=<authorId>`? Recommendation: modal on desktop, navigate on mobile.

4. **Should we fix the dead `?dm=` deep link now** (Phase 2), or is that a separate
   ticket? It's small and unblocks the "navigate" option in Q3.

5. **Rate limiting / blocking / reporting on DMs** — in scope for this pass, or
   deferred? (See §8.)

6. **Inbox refactor** (Phase 3) — do you want it in this pass, or ship the icon +
   entry-point change first and clean up after?

> **Answered / not client-facing:** the deploy target (Vercel, moving to client
> hosting later) is confirmed and folded into D1 in §2. Q4 and Q6 below are
> internal engineering calls — decide them in-house rather than putting a refactor
> question to the client.
