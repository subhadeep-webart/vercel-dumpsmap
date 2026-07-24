// PR-2b/2c feature handlers index — dispatched in order before the route catch-all.
import { handle as handleMessaging } from './messaging'
import { handle as handleGroupChat } from './groupChat'
import { handle as handleReviewsRecs } from './reviewsRecs'
import { handle as handleInboxCount } from './inboxCount'
import { handle as handleSeedDemo } from './seedDemo'
import { handle as handlePreferences } from './preferences'
import { handle as handleReceipts } from './receipts'
import { handle as handleDashboard } from './dashboard'
import { handle as handlePasswordReset } from './passwordReset'
import { handle as handleVehicleInspections } from './vehicleInspections'
import { handle as handleTimeClock } from './timeClock'
import { handle as handleAdminContractorOps } from './adminContractorOps'
import { handle as handleCommercialMarketplace } from './commercialMarketplace'
import { handle as handleAdminUsersV2 } from './adminUsersV2'
import { handle as handleFeatureControls } from './featureControls'
import { handle as handlePaymentMethods } from './paymentMethods'
import { handle as handleOcrReceipts } from './ocrReceipts'
import { handle as handleRewardsEngine } from './rewardsEngine'
import { handle as handleAuthProfile } from './authProfile'
import { handle as handleWorkItems } from './workItems'
import { handle as handleActivityHub } from './activityHub'

/**
 * Run all PR-2b/2c extracted handlers in order. Returns the first Response
 * that matches, or null if none of them claim the route.
 */
export async function dispatchPr2b(ctx) {
  let resp
  resp = await handleMessaging(ctx);             if (resp) return resp
  resp = await handleGroupChat(ctx);             if (resp) return resp
  resp = await handleReviewsRecs(ctx);           if (resp) return resp
  resp = await handleInboxCount(ctx);            if (resp) return resp
  resp = await handleSeedDemo(ctx);              if (resp) return resp
  resp = await handlePreferences(ctx);           if (resp) return resp
  // Admin contractor-ops views must dispatch BEFORE generic receipts handler
  // so /admin/receipts and /admin/vehicle-inspections aren't shadowed.
  resp = await handleAdminContractorOps(ctx);    if (resp) return resp
  // Commercial B2B marketplace — listings + access applications + admin queue.
  // Must run BEFORE generic /marketplace handler so /marketplace/commercial
  // and /marketplace/commercial/:id aren't shadowed by the residential code.
  resp = await handleCommercialMarketplace(ctx); if (resp) return resp
  resp = await handleAdminUsersV2(ctx);           if (resp) return resp
  resp = await handleFeatureControls(ctx);        if (resp) return resp
  resp = await handlePaymentMethods(ctx);         if (resp) return resp
  // Rewards engine \u2014 dispatched BEFORE generic /facilities handler so
  // /facilities/:id/impact, /facilities/:id/check-in, /facilities/:id/rewards-program
  // are claimed here.
  resp = await handleRewardsEngine(ctx);          if (resp) return resp
  // Auth audit + profile redesign — change-password, logout, /users/me/profile
  resp = await handleAuthProfile(ctx);            if (resp) return resp
  // Sprint A foundation — jobs / bounties / volunteer events / work orders
  resp = await handleWorkItems(ctx);              if (resp) return resp
  // Activity Hub — unified feed (Community + Live Feed + Jobs + Bounties + Donations)
  resp = await handleActivityHub(ctx);            if (resp) return resp
  // OCR scanner must dispatch BEFORE generic /receipts handler so /receipts/scan
  // isn't shadowed by the receipts list/create handler.
  resp = await handleOcrReceipts(ctx);             if (resp) return resp
  resp = await handleReceipts(ctx);              if (resp) return resp
  resp = await handleVehicleInspections(ctx);    if (resp) return resp
  resp = await handleTimeClock(ctx);              if (resp) return resp
  resp = await handleDashboard(ctx);             if (resp) return resp
  resp = await handlePasswordReset(ctx);         if (resp) return resp
  return null
}
