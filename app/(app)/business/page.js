'use client'

import Reveal from '@/components/Reveal'
import BusinessHero from '@/components/business/BusinessHero'
import BusinessStats from '@/components/business/BusinessStats'
import BusinessHowItWorks from '@/components/business/BusinessHowItWorks'
import BusinessBenefits from '@/components/business/BusinessBenefits'
import BusinessFacilityCategories from '@/components/business/BusinessFacilityCategories'
import BusinessPartnerForm from '@/components/business/BusinessPartnerForm'
import BusinessCtaBand from '@/components/business/BusinessCtaBand'
import BusinessFooterStrip from '@/components/business/BusinessFooterStrip'

export default function BusinessPage() {
  const scrollToForm = () => {
    const el = document.getElementById('partner-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <BusinessHero onCtaClick={scrollToForm} />
      <Reveal><BusinessStats /></Reveal>
      <Reveal><BusinessHowItWorks /></Reveal>
      <Reveal><BusinessBenefits /></Reveal>
      <Reveal><BusinessFacilityCategories /></Reveal>
      <Reveal><BusinessPartnerForm /></Reveal>
      <Reveal><BusinessCtaBand onCtaClick={scrollToForm} /></Reveal>
      <Reveal><BusinessFooterStrip /></Reveal>
    </div>
  )
}
