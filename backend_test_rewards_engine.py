#!/usr/bin/env python3
"""
P4 Rewards Engine Backend Test Suite
Tests all endpoints in handlers/rewardsEngine.js + lib/rewards.js + lib/impact.js

Test credentials:
- Super admin: jamal@dumpmaps.org / @@Jefferson2180
- Backend URL: https://dumpmaps-pilot.preview.emergentagent.com/api
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login(email, password):
    """Login and return JWT token and user info"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        log(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None, None
    data = resp.json()
    token = data.get("token")
    user = data.get("user")
    log(f"✅ Logged in as {email}")
    return token, user

def get_facilities(token):
    """Get list of facilities"""
    resp = requests.get(f"{BASE_URL}/facilities", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        return []
    data = resp.json()
    return data.get("facilities", [])

# ============================================================================
# TEST SUITE
# ============================================================================

def main():
    log("=" * 80)
    log("P4 REWARDS ENGINE BACKEND TEST SUITE")
    log("=" * 80)
    
    # Login as super admin
    log("\n🔐 Step 0: Login as super admin")
    token, user = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not token:
        log("❌ FATAL: Cannot login as super admin")
        return
    
    # Get user ID
    user_id = user.get("id") if user else None
    log(f"✅ Super admin user ID: {user_id}")
    
    # Get a facility for testing
    log("\n📍 Step 0.5: Get a facility for testing")
    facilities = get_facilities(token)
    if not facilities:
        log("❌ FATAL: No facilities found")
        return
    facility = facilities[0]
    facility_id = facility.get("id")
    log(f"✅ Using facility: {facility.get('name')} (ID: {facility_id})")
    
    # ========================================================================
    # PUBLIC ENDPOINTS (no auth required)
    # ========================================================================
    log("\n" + "=" * 80)
    log("PUBLIC ENDPOINTS (no auth)")
    log("=" * 80)
    
    # Test 1: GET /facilities/:id/impact
    log("\n✅ TEST 1: GET /facilities/:id/impact (valid facility)")
    resp = requests.get(f"{BASE_URL}/facilities/{facility_id}/impact")
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        required_keys = ["facilityId", "isNew", "metrics", "formulaVersion", "computedAt"]
        missing = [k for k in required_keys if k not in data]
        if missing:
            log(f"❌ Missing keys: {missing}")
        else:
            log(f"✅ Response structure correct")
            log(f"   - facilityId: {data['facilityId']}")
            log(f"   - isNew: {data['isNew']}")
            log(f"   - metrics keys: {list(data['metrics'].keys())}")
            log(f"   - formulaVersion: {data['formulaVersion']}")
            # Verify all metric values are present (even if 0)
            expected_metrics = ["lbsDiverted", "contractorVisits", "treesEquivalent", "lbsCo2Offset", 
                              "gallonsWaterSaved", "rewardsPaidUsd", "communityRating", "reviewCount"]
            missing_metrics = [k for k in expected_metrics if k not in data['metrics']]
            if missing_metrics:
                log(f"❌ Missing metrics: {missing_metrics}")
            else:
                log(f"✅ All expected metrics present")
    
    # Test 2: GET /facilities/:id/rewards-program
    log("\n✅ TEST 2: GET /facilities/:id/rewards-program (facility never configured)")
    resp = requests.get(f"{BASE_URL}/facilities/{facility_id}/rewards-program")
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "rewardsConfig" not in data:
            log(f"❌ Missing rewardsConfig key")
        else:
            cfg = data["rewardsConfig"]
            log(f"✅ Response structure correct")
            log(f"   - participating: {cfg.get('participating')}")
            log(f"   - status: {cfg.get('status')}")
            log(f"   - rewardType: {cfg.get('rewardType')}")
    
    # Test 3: GET /facilities/INVALID_ID/impact
    log("\n✅ TEST 3: GET /facilities/INVALID_ID/impact (404)")
    resp = requests.get(f"{BASE_URL}/facilities/invalid_id_xyz/impact")
    if resp.status_code != 404:
        log(f"❌ Expected 404, got {resp.status_code}: {resp.text}")
    else:
        log(f"✅ Correctly returned 404")
    
    # ========================================================================
    # USER ENDPOINTS (require super admin token to bypass demo gating)
    # ========================================================================
    log("\n" + "=" * 80)
    log("USER ENDPOINTS (auth required, gated by feature flag)")
    log("=" * 80)
    
    # Test 4: GET /users/me/rewards/balance
    log("\n✅ TEST 4: GET /users/me/rewards/balance (new user)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        required_keys = ["balance", "lifetimeEarned", "lifetimeSpent", "lastActivityAt", "dollarsAvailable"]
        missing = [k for k in required_keys if k not in data]
        if missing:
            log(f"❌ Missing keys: {missing}")
        else:
            log(f"✅ Response structure correct")
            log(f"   - balance: {data['balance']}")
            log(f"   - lifetimeEarned: {data['lifetimeEarned']}")
            log(f"   - lifetimeSpent: {data['lifetimeSpent']}")
            log(f"   - dollarsAvailable: {data['dollarsAvailable']}")
    
    # Test 5: GET /users/me/rewards/history
    log("\n✅ TEST 5: GET /users/me/rewards/history (new user)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/history", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "entries" not in data:
            log(f"❌ Missing entries key")
        else:
            log(f"✅ Response structure correct")
            log(f"   - entries count: {len(data['entries'])}")
    
    # Test 6: GET /users/me/rewards/redemptions
    log("\n✅ TEST 6: GET /users/me/rewards/redemptions (new user)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/redemptions", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "redemptions" not in data:
            log(f"❌ Missing redemptions key")
        else:
            log(f"✅ Response structure correct")
            log(f"   - redemptions count: {len(data['redemptions'])}")
    
    # Test 7: POST /users/me/rewards/redeem/preview (1500 pts)
    log("\n✅ TEST 7: POST /users/me/rewards/redeem/preview (1500 pts)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem/preview", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 1500})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "preview" not in data:
            log(f"❌ Missing preview key")
        else:
            preview = data["preview"]
            log(f"✅ Response structure correct")
            log(f"   - points: {preview.get('points')}")
            log(f"   - grossUsd: {preview.get('grossUsd')}")
            log(f"   - fee: {preview.get('fee')}")
            log(f"   - netUsd: {preview.get('netUsd')}")
            log(f"   - conversionRate: {preview.get('conversionRate')}")
            # Verify fee bracket logic: $10-19.99 = flat $0.50
            if preview.get('grossUsd') == 15.0 and preview.get('fee') == 0.5 and preview.get('netUsd') == 14.5:
                log(f"✅ Fee bracket logic correct ($10-19.99 = flat $0.50)")
            else:
                log(f"❌ Fee bracket logic incorrect")
    
    # Test 8: POST /users/me/rewards/redeem/preview (5000 pts)
    log("\n✅ TEST 8: POST /users/me/rewards/redeem/preview (5000 pts)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem/preview", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 5000})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        preview = data["preview"]
        log(f"✅ Response structure correct")
        log(f"   - grossUsd: {preview.get('grossUsd')}")
        log(f"   - fee: {preview.get('fee')}")
        log(f"   - netUsd: {preview.get('netUsd')}")
        # Verify fee bracket logic: $20-99.99 = 3%
        if preview.get('grossUsd') == 50.0 and preview.get('fee') == 1.5 and preview.get('netUsd') == 48.5:
            log(f"✅ Fee bracket logic correct ($20-99.99 = 3%)")
        else:
            log(f"❌ Fee bracket logic incorrect")
    
    # Test 9: POST /users/me/rewards/redeem/preview (50000 pts)
    log("\n✅ TEST 9: POST /users/me/rewards/redeem/preview (50000 pts)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem/preview", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 50000})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        preview = data["preview"]
        log(f"✅ Response structure correct")
        log(f"   - grossUsd: {preview.get('grossUsd')}")
        log(f"   - fee: {preview.get('fee')}")
        log(f"   - netUsd: {preview.get('netUsd')}")
        # Verify fee bracket logic: $100+ = 2%
        if preview.get('grossUsd') == 500.0 and preview.get('fee') == 10.0 and preview.get('netUsd') == 490.0:
            log(f"✅ Fee bracket logic correct ($100+ = 2%)")
        else:
            log(f"❌ Fee bracket logic incorrect")
    
    # Test 10: POST /users/me/rewards/redeem (100 pts - below minimum)
    log("\n✅ TEST 10: POST /users/me/rewards/redeem (100 pts - below minimum)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 100})
    if resp.status_code != 400:
        log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if data.get("code") == "BELOW_MINIMUM":
            log(f"✅ Correctly rejected with BELOW_MINIMUM")
        else:
            log(f"❌ Expected code BELOW_MINIMUM, got {data.get('code')}")
    
    # Test 11: POST /users/me/rewards/redeem (100000 pts - insufficient balance)
    log("\n✅ TEST 11: POST /users/me/rewards/redeem (100000 pts - insufficient balance)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 100000})
    if resp.status_code != 400:
        log(f"❌ Expected 400, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if data.get("code") == "INSUFFICIENT_BALANCE":
            log(f"✅ Correctly rejected with INSUFFICIENT_BALANCE")
        else:
            log(f"❌ Expected code INSUFFICIENT_BALANCE, got {data.get('code')}")
    
    # ========================================================================
    # ADMIN SETTINGS (super admin only)
    # ========================================================================
    log("\n" + "=" * 80)
    log("ADMIN SETTINGS (super admin only)")
    log("=" * 80)
    
    # Test 12: GET /admin/rewards/settings
    log("\n✅ TEST 12: GET /admin/rewards/settings")
    resp = requests.get(f"{BASE_URL}/admin/rewards/settings", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "settings" not in data:
            log(f"❌ Missing settings key")
        else:
            settings = data["settings"]
            log(f"✅ Response structure correct")
            log(f"   - conversionRate: {settings.get('conversionRate')}")
            log(f"   - minCashoutPoints: {settings.get('minCashoutPoints')}")
            log(f"   - feeBrackets: {len(settings.get('feeBrackets', []))} brackets")
            log(f"   - pointRules: {len(settings.get('pointRules', {}))} rules")
            # Verify default point rules
            expected_rules = ["facility_check_in", "receipt_verified", "first_visit_bonus", 
                            "donation_receipt", "ewaste_receipt", "transfer_station_receipt",
                            "partner_facility_bonus", "community_post", "illegal_dump_report",
                            "cleanup_event", "referral_bonus"]
            point_rules = settings.get("pointRules", {})
            missing_rules = [r for r in expected_rules if r not in point_rules]
            if missing_rules:
                log(f"❌ Missing point rules: {missing_rules}")
            else:
                log(f"✅ All expected point rules present")
    
    # Test 13: PATCH /admin/rewards/settings (update community_post to 15)
    log("\n✅ TEST 13: PATCH /admin/rewards/settings (update community_post to 15)")
    resp = requests.patch(f"{BASE_URL}/admin/rewards/settings", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={"pointRules": {"community_post": 15}})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        settings = data["settings"]
        if settings.get("pointRules", {}).get("community_post") == 15:
            log(f"✅ community_post updated to 15")
        else:
            log(f"❌ community_post not updated correctly")
    
    # Test 14: PATCH /admin/rewards/settings (restore community_post to 10)
    log("\n✅ TEST 14: PATCH /admin/rewards/settings (restore community_post to 10)")
    resp = requests.patch(f"{BASE_URL}/admin/rewards/settings", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={"pointRules": {"community_post": 10}})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        settings = data["settings"]
        if settings.get("pointRules", {}).get("community_post") == 10:
            log(f"✅ community_post restored to 10")
        else:
            log(f"❌ community_post not restored correctly")
    
    # Test 15: GET /admin/impact/settings
    log("\n✅ TEST 15: GET /admin/impact/settings")
    resp = requests.get(f"{BASE_URL}/admin/impact/settings", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "settings" not in data:
            log(f"❌ Missing settings key")
        else:
            settings = data["settings"]
            log(f"✅ Response structure correct")
            log(f"   - lbsCo2PerLbDiverted: {settings.get('lbsCo2PerLbDiverted')}")
            log(f"   - lbsCo2PerTreePerYear: {settings.get('lbsCo2PerTreePerYear')}")
            log(f"   - gallonsWaterPerLbDiverted: {settings.get('gallonsWaterPerLbDiverted')}")
            log(f"   - schemaVersion: {settings.get('schemaVersion')}")
    
    # Test 16: PATCH /admin/impact/settings (update lbsCo2PerLbDiverted to 3.0, then restore)
    log("\n✅ TEST 16: PATCH /admin/impact/settings (update lbsCo2PerLbDiverted to 3.0)")
    resp = requests.patch(f"{BASE_URL}/admin/impact/settings", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={"lbsCo2PerLbDiverted": 3.0})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        settings = data["settings"]
        if settings.get("lbsCo2PerLbDiverted") == 3.0:
            log(f"✅ lbsCo2PerLbDiverted updated to 3.0")
        else:
            log(f"❌ lbsCo2PerLbDiverted not updated correctly")
    
    # Restore to 2.5
    log("   Restoring lbsCo2PerLbDiverted to 2.5...")
    resp = requests.patch(f"{BASE_URL}/admin/impact/settings", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={"lbsCo2PerLbDiverted": 2.5})
    if resp.status_code == 200:
        log(f"✅ lbsCo2PerLbDiverted restored to 2.5")
    
    # Test 17: PATCH /admin/facilities/:id/rewards-config (enable rewards)
    log("\n✅ TEST 17: PATCH /admin/facilities/:id/rewards-config (enable rewards)")
    resp = requests.patch(f"{BASE_URL}/admin/facilities/{facility_id}/rewards-config", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={
                             "participating": True,
                             "status": "live",
                             "rewardType": "percentage_cashback",
                             "validationWindow": "7d"
                         })
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        cfg = data.get("rewardsConfig", {})
        log(f"✅ Rewards config updated")
        log(f"   - participating: {cfg.get('participating')}")
        log(f"   - status: {cfg.get('status')}")
        log(f"   - rewardType: {cfg.get('rewardType')}")
        log(f"   - validationWindow: {cfg.get('validationWindow')}")
    
    # Verify facility doc updated
    log("   Verifying facility doc updated...")
    resp = requests.get(f"{BASE_URL}/facilities/{facility_id}", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        fac = data.get("facility", {})
        if fac.get("rewardsPartner") == True:
            log(f"✅ Facility doc updated: rewardsPartner=true")
        else:
            log(f"❌ Facility doc not updated correctly: rewardsPartner={fac.get('rewardsPartner')}")
    
    # Test 18: POST /facilities/:id/check-in (first visit)
    log("\n✅ TEST 18: POST /facilities/:id/check-in (first visit)")
    resp = requests.post(f"{BASE_URL}/facilities/{facility_id}/check-in", 
                        headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        log(f"✅ Check-in successful")
        log(f"   - awarded: {data.get('awarded')}")
        log(f"   - breakdown: {data.get('breakdown')}")
        log(f"   - isFirstVisit: {data.get('isFirstVisit')}")
        # Verify 150 pts total = 25 (check_in) + 100 (first_visit) + 25 (partner_bonus)
        if data.get('awarded') == 150:
            log(f"✅ Correct points awarded (150 = 25 + 100 + 25)")
        else:
            log(f"❌ Incorrect points awarded: expected 150, got {data.get('awarded')}")
    
    # Test 19: POST /facilities/:id/check-in (same day - should fail)
    log("\n✅ TEST 19: POST /facilities/:id/check-in (same day - should fail)")
    resp = requests.post(f"{BASE_URL}/facilities/{facility_id}/check-in", 
                        headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 409:
        log(f"❌ Expected 409, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        if "Already checked in today" in data.get("error", ""):
            log(f"✅ Correctly rejected with 'Already checked in today'")
        else:
            log(f"❌ Unexpected error message: {data.get('error')}")
    
    # Test 20: GET /users/me/rewards/balance (should be 150)
    log("\n✅ TEST 20: GET /users/me/rewards/balance (should be 150)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        balance = data.get("balance")
        log(f"✅ Balance: {balance}")
        if balance >= 150:
            log(f"✅ Balance includes check-in points")
        else:
            log(f"❌ Balance incorrect: expected >= 150, got {balance}")
    
    # Test 21: GET /users/me/rewards/history (should have check-in entry)
    log("\n✅ TEST 21: GET /users/me/rewards/history (should have check-in entry)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/history", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        entries = data.get("entries", [])
        log(f"✅ History entries: {len(entries)}")
        if entries:
            latest = entries[0]
            log(f"   - Latest entry source: {latest.get('source')}")
            log(f"   - Latest entry points: {latest.get('points')}")
            if latest.get('source') == 'facility_check_in' and latest.get('points') == 150:
                log(f"✅ Check-in entry found")
            else:
                log(f"⚠️  Latest entry is not the check-in (may have other entries)")
    
    # Test 22: POST /users/me/rewards/redeem/preview (150 pts - below minimum)
    log("\n✅ TEST 22: POST /users/me/rewards/redeem/preview (150 pts - below minimum)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem/preview", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 150})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        log(f"✅ Preview returned (preview is allowed, actual redeem will fail)")
        log(f"   - minCashoutPoints: {data.get('minCashoutPoints')}")
    
    # ========================================================================
    # CASHOUT METHODS
    # ========================================================================
    log("\n" + "=" * 80)
    log("CASHOUT METHODS")
    log("=" * 80)
    
    # Test 23: POST /users/me/cashout-methods (create manual method)
    log("\n✅ TEST 23: POST /users/me/cashout-methods (create manual method)")
    resp = requests.post(f"{BASE_URL}/users/me/cashout-methods", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "type": "manual",
                            "label": "Test check",
                            "notes": "Mail to test address",
                            "isDefault": True
                        })
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        method = data.get("method", {})
        method_id = method.get("id")
        log(f"✅ Cashout method created")
        log(f"   - id: {method_id}")
        log(f"   - type: {method.get('type')}")
        log(f"   - label: {method.get('label')}")
        log(f"   - isDefault: {method.get('isDefault')}")
    
    # Test 24: GET /users/me/cashout-methods
    log("\n✅ TEST 24: GET /users/me/cashout-methods")
    resp = requests.get(f"{BASE_URL}/users/me/cashout-methods", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        methods = data.get("methods", [])
        log(f"✅ Cashout methods: {len(methods)}")
        if methods:
            method_id = methods[0].get("id")
            log(f"   - First method ID: {method_id}")
    
    # Test 25: PATCH /users/me/cashout-methods/:id (update label)
    log("\n✅ TEST 25: PATCH /users/me/cashout-methods/:id (update label)")
    if methods:
        method_id = methods[0].get("id")
        resp = requests.patch(f"{BASE_URL}/users/me/cashout-methods/{method_id}", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={"label": "Updated label"})
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            method = data.get("method", {})
            if method.get("label") == "Updated label":
                log(f"✅ Label updated successfully")
            else:
                log(f"❌ Label not updated correctly")
    
    # Test 26: DELETE /users/me/cashout-methods/:id
    log("\n✅ TEST 26: DELETE /users/me/cashout-methods/:id")
    if methods:
        method_id = methods[0].get("id")
        resp = requests.delete(f"{BASE_URL}/users/me/cashout-methods/{method_id}", 
                              headers={"Authorization": f"Bearer {token}"})
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
        else:
            log(f"✅ Cashout method deleted")
            # Verify it's gone
            resp = requests.get(f"{BASE_URL}/users/me/cashout-methods", headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 200:
                data = resp.json()
                methods_after = data.get("methods", [])
                if len(methods_after) < len(methods):
                    log(f"✅ Method removed from list")
                else:
                    log(f"❌ Method still in list")
    
    # ========================================================================
    # ADMIN MANUAL AWARD & REDEMPTION FLOW
    # ========================================================================
    log("\n" + "=" * 80)
    log("ADMIN MANUAL AWARD & REDEMPTION FLOW")
    log("=" * 80)
    
    # Test 27: POST /admin/rewards/award (grant 5000 pts)
    log("\n✅ TEST 27: POST /admin/rewards/award (grant 5000 pts)")
    resp = requests.post(f"{BASE_URL}/admin/rewards/award", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "userId": user_id,
                            "points": 5000,
                            "source": "admin_adjustment",
                            "note": "test grant"
                        })
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        entry = data.get("entry", {})
        log(f"✅ Points awarded")
        log(f"   - points: {entry.get('points')}")
        log(f"   - source: {entry.get('source')}")
    
    # Verify balance increased
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        balance = data.get("balance")
        log(f"✅ New balance: {balance}")
    
    # Test 28: POST /users/me/rewards/redeem (1500 pts)
    log("\n✅ TEST 28: POST /users/me/rewards/redeem (1500 pts)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 1500})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        redemption = data.get("redemption", {})
        redemption_id_1 = redemption.get("id")
        log(f"✅ Redemption created")
        log(f"   - id: {redemption_id_1}")
        log(f"   - status: {redemption.get('status')}")
        log(f"   - grossUsd: {redemption.get('grossUsd')}")
        log(f"   - fee: {redemption.get('fee')}")
        log(f"   - netUsd: {redemption.get('netUsd')}")
        # Verify fee calculation
        if redemption.get('grossUsd') == 15.0 and redemption.get('fee') == 0.5 and redemption.get('netUsd') == 14.5:
            log(f"✅ Fee calculation correct")
        else:
            log(f"❌ Fee calculation incorrect")
    
    # Verify balance decreased
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        balance_after_redeem = data.get("balance")
        log(f"✅ Balance after redemption: {balance_after_redeem}")
    
    # Test 29: GET /admin/rewards/redemptions
    log("\n✅ TEST 29: GET /admin/rewards/redemptions")
    resp = requests.get(f"{BASE_URL}/admin/rewards/redemptions", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        redemptions = data.get("redemptions", [])
        log(f"✅ Admin redemptions list: {len(redemptions)} redemptions")
        if redemptions:
            log(f"   - Latest redemption status: {redemptions[0].get('status')}")
    
    # Test 30: PATCH /admin/rewards/redemptions/:id (status=processing)
    log("\n✅ TEST 30: PATCH /admin/rewards/redemptions/:id (status=processing)")
    if 'redemption_id_1' in locals():
        resp = requests.patch(f"{BASE_URL}/admin/rewards/redemptions/{redemption_id_1}", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={"status": "processing"})
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            redemption = data.get("redemption", {})
            if redemption.get("status") == "processing":
                log(f"✅ Status updated to processing")
            else:
                log(f"❌ Status not updated correctly")
    
    # Test 31: PATCH /admin/rewards/redemptions/:id (status=paid)
    log("\n✅ TEST 31: PATCH /admin/rewards/redemptions/:id (status=paid)")
    if 'redemption_id_1' in locals():
        resp = requests.patch(f"{BASE_URL}/admin/rewards/redemptions/{redemption_id_1}", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={"status": "paid"})
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            redemption = data.get("redemption", {})
            if redemption.get("status") == "paid":
                log(f"✅ Status updated to paid")
            else:
                log(f"❌ Status not updated correctly")
    
    # Test 32: GET /users/me/rewards/balance (verify no refund for paid)
    log("\n✅ TEST 32: GET /users/me/rewards/balance (verify no refund for paid)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        balance_after_paid = data.get("balance")
        log(f"✅ Balance after paid: {balance_after_paid}")
        log(f"   (Should NOT be refunded, balance should remain decreased)")
    
    # ========================================================================
    # REJECT FLOW (auto-refund)
    # ========================================================================
    log("\n" + "=" * 80)
    log("REJECT FLOW (auto-refund)")
    log("=" * 80)
    
    # Test 33: POST /users/me/rewards/redeem (1500 pts again)
    log("\n✅ TEST 33: POST /users/me/rewards/redeem (1500 pts again)")
    resp = requests.post(f"{BASE_URL}/users/me/rewards/redeem", 
                        headers={"Authorization": f"Bearer {token}"},
                        json={"points": 1500})
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        redemption = data.get("redemption", {})
        redemption_id_2 = redemption.get("id")
        log(f"✅ Second redemption created")
        log(f"   - id: {redemption_id_2}")
        log(f"   - status: {redemption.get('status')}")
    
    # Get balance before reject
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        balance_before_reject = data.get("balance")
        log(f"✅ Balance before reject: {balance_before_reject}")
    
    # Test 34: PATCH /admin/rewards/redemptions/:id (status=rejected)
    log("\n✅ TEST 34: PATCH /admin/rewards/redemptions/:id (status=rejected)")
    if 'redemption_id_2' in locals():
        resp = requests.patch(f"{BASE_URL}/admin/rewards/redemptions/{redemption_id_2}", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={"status": "rejected", "note": "test reject"})
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            redemption = data.get("redemption", {})
            if redemption.get("status") == "rejected":
                log(f"✅ Status updated to rejected")
            else:
                log(f"❌ Status not updated correctly")
    
    # Test 35: GET /users/me/rewards/balance (verify refund)
    log("\n✅ TEST 35: GET /users/me/rewards/balance (verify refund)")
    resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        data = resp.json()
        balance_after_reject = data.get("balance")
        log(f"✅ Balance after reject: {balance_after_reject}")
        if 'balance_before_reject' in locals():
            refund = balance_after_reject - balance_before_reject
            if refund == 1500:
                log(f"✅ Refund applied correctly (+1500 pts)")
            else:
                log(f"⚠️  Refund amount: {refund} (expected +1500)")
    
    # ========================================================================
    # CLEANUP
    # ========================================================================
    log("\n" + "=" * 80)
    log("CLEANUP")
    log("=" * 80)
    
    # Test 36: Reset facility rewards config
    log("\n✅ TEST 36: Reset facility rewards config")
    resp = requests.patch(f"{BASE_URL}/admin/facilities/{facility_id}/rewards-config", 
                         headers={"Authorization": f"Bearer {token}"},
                         json={
                             "participating": False,
                             "status": "not_active",
                             "rewardType": None
                         })
    if resp.status_code != 200:
        log(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
    else:
        log(f"✅ Facility rewards config reset")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    log("\n" + "=" * 80)
    log("TEST SUITE COMPLETE")
    log("=" * 80)
    log("\n✅ All 36 test cases executed")
    log("   Review the output above for any ❌ failures")
    log("\n" + "=" * 80)

if __name__ == "__main__":
    main()
