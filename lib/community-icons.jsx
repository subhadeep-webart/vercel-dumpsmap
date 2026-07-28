// community-icons.jsx
// ---------------------------------------------------------------------------
// Resolves community category / reaction / profile-type slugs to lucide-react
// icon components. Kept separate from lib/community-categories.js so that file
// stays plain, React-free data (categoryColor / timeAgo / resolveProfileType run
// in non-React contexts). Mirrors lib/facility-icons.jsx.

import {
  Flame, Gift, HeartHandshake, Truck, Wrench, MapPin, AlertTriangle, Trash2,
  Landmark, MessageCircle, ThumbsUp, HandHeart, Home, HardHat, Recycle, Factory,
  Building2, Building, Briefcase, Users, Coins,
} from 'lucide-react'

// COMMUNITY_CATEGORIES keys (see lib/community-categories.js).
const CATEGORY_ICONS = {
  illegal_dumping: Flame,
  free_items: Gift,
  donation_need: HeartHandshake,
  pickup_request: Truck,
  contractor_tip: Wrench,
  facility_update: MapPin,
  safety_alert: AlertTriangle,
  cleanup_event: Trash2,
  agency_notice: Landmark,
  general: MessageCircle,
}

// REACTION_TYPES keys.
const REACTION_ICONS = {
  helpful: ThumbsUp,
  thanks: HandHeart,
  concern: AlertTriangle,
  onit: Truck,
  fire: Flame,
}

// PROFILE_TYPES keys.
const PROFILE_TYPE_ICONS = {
  resident: Home,
  contractor: HardHat,
  hauler: Truck,
  recycler: Recycle,
  facility_owner: Factory,
  realtor: Building2,
  property_manager: Building,
  volunteer: HeartHandshake,
  business: Briefcase,
  agency: Landmark,
}

// Group-category keys (component-local taxonomy in app/community/groups/*).
const GROUP_CATEGORY_ICONS = {
  haulers: Truck,
  cleanup: Trash2,
  reuse: Gift,
  contractors: HardHat,
  recycling: Recycle,
  property: Building,
  scrap: Coins,
  donation: HeartHandshake,
  agency: Landmark,
  general: MessageCircle,
}

export function getCategoryIcon(key) { return CATEGORY_ICONS[key] || MessageCircle }
export function getReactionIcon(key) { return REACTION_ICONS[key] || ThumbsUp }
export function getProfileTypeIcon(key) { return PROFILE_TYPE_ICONS[key] || Home }
export function getGroupCategoryIcon(key) { return GROUP_CATEGORY_ICONS[key] || MessageCircle }

export function CategoryIcon({ categoryKey, className = 'h-4 w-4' }) {
  const Icon = getCategoryIcon(categoryKey)
  return <Icon className={className} />
}
export function ReactionIcon({ reactionKey, className = 'h-4 w-4' }) {
  const Icon = getReactionIcon(reactionKey)
  return <Icon className={className} />
}
export function ProfileTypeIcon({ profileKey, className = 'h-4 w-4' }) {
  const Icon = getProfileTypeIcon(profileKey)
  return <Icon className={className} />
}
export function GroupCategoryIcon({ categoryKey, className = 'h-4 w-4' }) {
  const Icon = getGroupCategoryIcon(categoryKey)
  return <Icon className={className} />
}
