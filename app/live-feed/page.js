// /live-feed → permanent redirect to /activity-hub
import { redirect } from 'next/navigation'

export default function LiveFeedRedirect() {
  redirect('/activity-hub')
}
