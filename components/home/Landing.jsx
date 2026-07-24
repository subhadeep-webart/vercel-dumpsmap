'use client'

import { useRouter } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import Reveal from '@/components/Reveal'
import HomeHero from '@/components/home/HomeHero'
import HomeCashbackStrip from '@/components/home/HomeCashbackStrip'
import HomeFeatures from '@/components/home/HomeFeatures'
import HomeFacilityCategories from '@/components/home/HomeFacilityCategories'
import HomeHowItWorks from '@/components/home/HomeHowItWorks'
import HomeSupportMission from '@/components/home/HomeSupportMission'
import HomeFooter from '@/components/home/HomeFooter'

export default function Landing({ onEnterMap, onSubmit, userMenu, onCommunity, onDashboard, user }) {
  const router = useRouter()

  const goBeta = () => router.push('/beta')
  const goDonate = () => router.push('/donate')
  const goFacilities = () => router.push('/facilities')
  const goBusiness = () => router.push('/business')

  return (
    <div className=" bg-white text-neutral-900">
      <SiteHeader
        user={user}
        onLogin={userMenu.onLogin}
        onProfile={userMenu.onProfile}
        onLogout={userMenu.onLogout}
        onAdmin={userMenu.onAdmin}
        onDashboard={onDashboard}
        onSubmit={onSubmit}
        onEnterApp={() => onEnterMap?.()}
        active="home"
      />

      <HomeHero onSearchFacilities={goFacilities} onJoinBeta={goBeta} onDonate={goDonate} />
      <Reveal><HomeCashbackStrip onCtaClick={goBeta} /></Reveal>
      <Reveal><HomeFeatures /></Reveal>
      <Reveal><HomeFacilityCategories onCategoryClick={goFacilities} /></Reveal>
      <Reveal><HomeHowItWorks /></Reveal>
      <Reveal><HomeSupportMission onDonate={goDonate} onBusiness={goBusiness} /></Reveal>
      <Reveal><HomeFooter onJoinBeta={goBeta} onDonate={goDonate} /></Reveal>
    </div>
  )
}
