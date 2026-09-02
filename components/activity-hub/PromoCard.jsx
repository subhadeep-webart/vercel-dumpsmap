'use client'

// PromoCard — the "Smarter Waste, Better Future" promo in the Activity Hub
// right rail.
//
// /right_panel_card.png supplies ONLY the artwork: the truck, the recycling
// globe and the green swash, with its top-left left deliberately empty. The
// heading, body copy and button are real HTML laid over that empty region, so
// the copy stays selectable, translatable and legible at any zoom rather than
// being baked into a bitmap.
//
// The card holds the image's own 295x312 aspect ratio so the truck never
// stretches as the rail narrows between lg and xl.

import Link from 'next/link'

const PROMO = {
  title: ['Smarter Waste', 'Better Future'],
  body: 'Advanced waste management solutions for a cleaner tomorrow.',
  // No /about route exists yet — point at the facilities directory, which is
  // the real "waste management solutions" destination. Swap the href when a
  // marketing page lands.
  cta: { label: 'Learn More', href: '/facilities' },
}

export default function PromoCard() {
  return (
    <section
      className="relative aspect-[295/312] overflow-hidden rounded-[16px] border border-[#E0EBE2] bg-white bg-[url('/right_panel_card.png')] bg-cover bg-center bg-no-repeat"
      aria-label={PROMO.title.join(' ')}
    >
      <div className="flex h-full flex-col items-start p-4">
        <h2 className="text-[16px] font-bold leading-[22px] text-neutral-900">
          {PROMO.title.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </h2>

        <p className="mt-2 max-w-[85%] text-[13px] font-normal leading-[20px] text-neutral-600">
          {PROMO.body}
        </p>

        <Link
          href={PROMO.cta.href}
          className="mt-4 inline-flex items-center rounded-md bg-green-800 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-green-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          {PROMO.cta.label}
        </Link>
      </div>
    </section>
  )
}
