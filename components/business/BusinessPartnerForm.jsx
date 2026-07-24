'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import FieldError from '@/components/FieldError'
import { businessInquirySchema } from '@/validator/business-inquiry'
import { useBusinessInquiry } from '@/lib/useBusinessInquiry'
import { FORM_BENEFITS, BUSINESS_TYPE_OPTIONS, INTEREST_OPTIONS } from '@/constants/business_constants'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'

export default function BusinessPartnerForm() {
  const { submit, isLoading, isSuccess } = useBusinessInquiry()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(businessInquirySchema),
    mode: 'onChange',
    defaultValues: {
      businessName: '',
      contactName: '',
      email: '',
      phone: '',
      businessType: '',
      city: '',
      state: '',
      website: '',
      interest: 'partnership',
      message: '',
    },
  })

  // react-hook-form calls this only when zod validation passes.
  // The actual POST + toasts + loading/success state live in useBusinessInquiry.
  const onSubmit = (values) => submit(values)

  return (
    <section id="partner-form" className="border-b border-neutral-100 bg-white py-16 md:py-20">
      <div className="container mx-auto grid items-start gap-10 px-4 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Grow your business.<br />
            <span className="text-emerald-600">Reward your customers.</span><br />
            Improve your community.
          </h2>
          <p className="mt-4 max-w-lg text-neutral-600">
            Join DumpMaps to connect with local customers, offer cash back rewards, and build trust in your community.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {FORM_BENEFITS.map((b) => {
              const Icon = b.icon
              return (
                <div key={b.t} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-neutral-800">{b.t}</span>
                </div>
              )
            })}
          </div>
        </div>

        <Card className="border-neutral-200 bg-white p-6 shadow-lg shadow-emerald-50 md:sticky md:top-24">
          {isSuccess ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="mt-4 text-xl font-bold">Thanks — we&apos;ll be in touch!</h3>
              <p className="mt-2 text-sm text-neutral-600">
                A member of our partnerships team will reach out within 1 business day to schedule your onboarding.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div>
                <h3 className="text-lg font-bold">Create your business account</h3>
                <p className="mt-1 text-sm text-neutral-600">It&apos;s free and easy to get started.</p>
              </div>

              <div>
                <Label className="text-[13px]">Business Name <span className="text-red-500">*</span></Label>
                <Input {...register('businessName')} placeholder="Legal business name" className={`mt-1 h-11 ${errors.businessName ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.businessName} />
                <FieldError msg={errors.businessName?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px]">Contact Name</Label>
                  <Input {...register('contactName')} placeholder="Full name" className={`mt-1 h-11 ${errors.contactName ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.contactName} />
                  <FieldError msg={errors.contactName?.message} />
                </div>
                <div>
                  <Label className="text-[13px]">Business Type</Label>
                  <Controller
                    control={control}
                    name="businessType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger onBlur={field.onBlur} className={`mt-1 h-11 ${errors.businessType ? 'border-red-400 focus:ring-red-400' : ''}`} aria-invalid={!!errors.businessType}><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError msg={errors.businessType?.message} />
                </div>
              </div>

              <div>
                <Label className="text-[13px]">Email <span className="text-red-500">*</span></Label>
                <Input type="email" {...register('email')} placeholder="business@email.com" className={`mt-1 h-11 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.email} />
                <FieldError msg={errors.email?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px]">Phone</Label>
                  <Input {...register('phone')} placeholder="(555) 123-4567" className={`mt-1 h-11 ${errors.phone ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.phone} />
                  <FieldError msg={errors.phone?.message} />
                </div>
                <div>
                  <Label className="text-[13px]">Website</Label>
                  <Input {...register('website')} placeholder="https://…" className={`mt-1 h-11 ${errors.website ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.website} />
                  <FieldError msg={errors.website?.message} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px]">City</Label>
                  <Input {...register('city')} placeholder="City" className={`mt-1 h-11 ${errors.city ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.city} />
                  <FieldError msg={errors.city?.message} />
                </div>
                <div>
                  <Label className="text-[13px]">State</Label>
                  <Input {...register('state')} placeholder="State" className={`mt-1 h-11 ${errors.state ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.state} />
                  <FieldError msg={errors.state?.message} />
                </div>
              </div>

              <div>
                <Label className="text-[13px]">I&apos;m interested in…</Label>
                <Controller
                  control={control}
                  name="interest"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger onBlur={field.onBlur} className="mt-1 h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTEREST_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.interest?.message} />
              </div>

              <div>
                <Label className="text-[13px]">Message <span className="text-neutral-400">(optional)</span></Label>
                <Textarea {...register('message')} placeholder="Tell us about your facility…" className={`mt-1 min-h-[80px] ${errors.message ? 'border-red-400 focus-visible:ring-red-400' : ''}`} aria-invalid={!!errors.message} />
                <FieldError msg={errors.message?.message} />
              </div>

              <Button type="submit" disabled={!isValid || isLoading} className="h-12 w-full bg-emerald-600 text-[15px] font-semibold hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <>Partner With Us <ArrowRight className="ml-1.5 h-4 w-4" /></>
                )}
              </Button>
              <p className="text-center text-[11px] text-neutral-500">
                Free to join. No upfront costs. We&apos;re here to help.
              </p>
            </form>
          )}
        </Card>
      </div>
    </section>
  )
}
