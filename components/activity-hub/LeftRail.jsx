'use client'

// LeftRail — Activity Hub left panel.
//
// Holds the post-type filter nav that used to be the horizontal FilterBar chip
// row above the feed. Same controlled state, different presentation.

import RailFilterNav from './RailFilterNav'

export default function LeftRail({ user, filter, onChange, counts }) {
  return <RailFilterNav user={user} filter={filter} onChange={onChange} counts={counts} />
}
