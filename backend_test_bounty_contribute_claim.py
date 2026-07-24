#!/usr/bin/env python3
"""
Backend test for Bounty Contribute + Claim endpoints
Test date: 2026-06-17
Backend URL: https://dumpmaps-pilot.preview.emergentagent.com/api
Test credentials: jamal@dumpmaps.org / @@Jefferson2180 (super_admin)
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
EMAIL = "jamal@dumpmaps.org"
PASSWORD = "@@Jefferson2180"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_bounty_contribute_claim():
    """Test bounty contribute and claim endpoints"""
    
    # ===== STEP 1: Login =====
    log("STEP 1: Login as super_admin")
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
        if r.status_code != 200:
            log(f"❌ Login failed: {r.status_code} {r.text}")
            return False
        token = r.json().get("token")
        user_id = r.json().get("user", {}).get("id")
        if not token:
            log("❌ No token in login response")
            return False
        headers = {"Authorization": f"Bearer {token}"}
        log(f"✅ Login successful, user_id: {user_id}")
    except Exception as e:
        log(f"❌ Login exception: {e}")
        return False

    # ===== STEP 2: Create bounty for funding =====
    log("\nSTEP 2: Create bounty (draft)")
    try:
        bounty_payload = {
            "title": "Test bounty TC",
            "description": "test",
            "location": {"city": "SJ", "state": "CA"},
            "fundingGoalUsd": 100
        }
        r = requests.post(f"{BASE_URL}/bounties", json=bounty_payload, headers=headers, timeout=10)
        if r.status_code != 201:
            log(f"❌ Create bounty failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        bounty_id = bounty.get("id")
        if not bounty_id:
            log("❌ No bounty id in response")
            return False
        if bounty.get("state") != "draft":
            log(f"❌ Expected state=draft, got {bounty.get('state')}")
            return False
        if bounty.get("fundedUsd") != 0:
            log(f"❌ Expected fundedUsd=0, got {bounty.get('fundedUsd')}")
            return False
        if len(bounty.get("contributors", [])) != 0:
            log(f"❌ Expected contributors=[], got {bounty.get('contributors')}")
            return False
        log(f"✅ Bounty created: id={bounty_id}, state=draft, fundedUsd=0, contributors=[]")
    except Exception as e:
        log(f"❌ Create bounty exception: {e}")
        return False

    # ===== STEP 3: Transition to funding =====
    log("\nSTEP 3: Transition bounty to funding")
    try:
        r = requests.patch(f"{BASE_URL}/bounties/{bounty_id}/state", json={"state": "funding"}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Transition to funding failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        if bounty.get("state") != "funding":
            log(f"❌ Expected state=funding, got {bounty.get('state')}")
            return False
        log(f"✅ Bounty transitioned to funding")
    except Exception as e:
        log(f"❌ Transition exception: {e}")
        return False

    # ===== STEP 4: Contribute happy path (first contribution) =====
    log("\nSTEP 4: Contribute $25 (first contribution)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 25}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Contribute failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        contribution = r.json().get("contribution")
        if bounty.get("fundedUsd") != 25:
            log(f"❌ Expected fundedUsd=25, got {bounty.get('fundedUsd')}")
            return False
        if len(bounty.get("contributors", [])) != 1:
            log(f"❌ Expected 1 contributor, got {len(bounty.get('contributors', []))}")
            return False
        contrib = bounty.get("contributors", [])[0]
        if contrib.get("userId") != user_id:
            log(f"❌ Expected userId={user_id}, got {contrib.get('userId')}")
            return False
        if contrib.get("amountUsd") != 25:
            log(f"❌ Expected amountUsd=25, got {contrib.get('amountUsd')}")
            return False
        if not contrib.get("contributedAt"):
            log(f"❌ Missing contributedAt timestamp")
            return False
        log(f"✅ First contribution successful: fundedUsd=25, contributors.length=1")
    except Exception as e:
        log(f"❌ Contribute exception: {e}")
        return False

    # ===== STEP 5: Contribute again (second contribution) =====
    log("\nSTEP 5: Contribute $30 (second contribution)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 30}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Second contribute failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        if bounty.get("fundedUsd") != 55:
            log(f"❌ Expected fundedUsd=55, got {bounty.get('fundedUsd')}")
            return False
        if len(bounty.get("contributors", [])) != 2:
            log(f"❌ Expected 2 contributors, got {len(bounty.get('contributors', []))}")
            return False
        log(f"✅ Second contribution successful: fundedUsd=55, contributors.length=2")
    except Exception as e:
        log(f"❌ Second contribute exception: {e}")
        return False

    # ===== STEP 6: Auto-transition on goal reached =====
    log("\nSTEP 6: Contribute $50 to reach goal (auto-transition to goal_reached)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 50}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Third contribute failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        if bounty.get("fundedUsd") != 105:
            log(f"❌ Expected fundedUsd=105, got {bounty.get('fundedUsd')}")
            return False
        if bounty.get("state") != "goal_reached":
            log(f"❌ Expected state=goal_reached (auto-transition), got {bounty.get('state')}")
            return False
        log(f"✅ Goal reached: fundedUsd=105, state=goal_reached (auto-transitioned)")
    except Exception as e:
        log(f"❌ Third contribute exception: {e}")
        return False

    # ===== STEP 7: Validation - amountUsd = 0 =====
    log("\nSTEP 7: Validation - amountUsd = 0 (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 0}, headers=headers, timeout=10)
        if r.status_code != 400:
            log(f"❌ Expected 400, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if "positive number" not in error.lower():
            log(f"❌ Expected 'positive number' in error, got: {error}")
            return False
        log(f"✅ Validation passed: amountUsd=0 rejected with 400 '{error}'")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 8: Validation - amountUsd = -5 =====
    log("\nSTEP 8: Validation - amountUsd = -5 (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": -5}, headers=headers, timeout=10)
        if r.status_code != 400:
            log(f"❌ Expected 400, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if "positive number" not in error.lower():
            log(f"❌ Expected 'positive number' in error, got: {error}")
            return False
        log(f"✅ Validation passed: amountUsd=-5 rejected with 400 '{error}'")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 9: Validation - amountUsd = 200000 (exceeds max) =====
    log("\nSTEP 9: Validation - amountUsd = 200000 (exceeds maximum)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 200000}, headers=headers, timeout=10)
        if r.status_code != 400:
            log(f"❌ Expected 400, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if "exceeds maximum" not in error.lower():
            log(f"❌ Expected 'exceeds maximum' in error, got: {error}")
            return False
        log(f"✅ Validation passed: amountUsd=200000 rejected with 400 '{error}'")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 10: Create cancelled bounty for validation =====
    log("\nSTEP 10: Create cancelled bounty for validation")
    try:
        bounty_payload = {
            "title": "Test cancelled bounty",
            "description": "test",
            "location": {"city": "SJ", "state": "CA"},
            "fundingGoalUsd": 100
        }
        r = requests.post(f"{BASE_URL}/bounties", json=bounty_payload, headers=headers, timeout=10)
        if r.status_code != 201:
            log(f"❌ Create cancelled bounty failed: {r.status_code} {r.text}")
            return False
        cancelled_bounty_id = r.json().get("bounty", {}).get("id")
        
        # Transition to funding
        r = requests.patch(f"{BASE_URL}/bounties/{cancelled_bounty_id}/state", json={"state": "funding"}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Transition to funding failed: {r.status_code} {r.text}")
            return False
        
        # Cancel it
        r = requests.patch(f"{BASE_URL}/bounties/{cancelled_bounty_id}/state", json={"state": "cancelled"}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Cancel bounty failed: {r.status_code} {r.text}")
            return False
        log(f"✅ Cancelled bounty created: id={cancelled_bounty_id}")
    except Exception as e:
        log(f"❌ Create cancelled bounty exception: {e}")
        return False

    # ===== STEP 11: Validation - contribute to cancelled bounty =====
    log("\nSTEP 11: Validation - contribute to cancelled bounty (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{cancelled_bounty_id}/contribute", json={"amountUsd": 10}, headers=headers, timeout=10)
        if r.status_code != 400:
            log(f"❌ Expected 400, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if "not accepting contributions" not in error.lower() or "cancelled" not in error.lower():
            log(f"❌ Expected 'not accepting contributions' and 'cancelled' in error, got: {error}")
            return False
        log(f"✅ Validation passed: contribute to cancelled bounty rejected with 400 '{error}'")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 12: Validation - contribute without auth =====
    log("\nSTEP 12: Validation - contribute without auth (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/contribute", json={"amountUsd": 10}, timeout=10)
        if r.status_code != 401:
            log(f"❌ Expected 401, got {r.status_code}")
            return False
        log(f"✅ Validation passed: contribute without auth rejected with 401")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 13: Claim happy path =====
    log("\nSTEP 13: Claim bounty (happy path)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/claim", headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Claim failed: {r.status_code} {r.text}")
            return False
        bounty = r.json().get("bounty")
        work_order = r.json().get("workOrder")
        
        # Verify bounty state
        if bounty.get("state") != "claimed":
            log(f"❌ Expected state=claimed, got {bounty.get('state')}")
            return False
        if bounty.get("claimedContractorId") != user_id:
            log(f"❌ Expected claimedContractorId={user_id}, got {bounty.get('claimedContractorId')}")
            return False
        if not bounty.get("workOrderId"):
            log(f"❌ Missing workOrderId in bounty")
            return False
        
        # Verify work order
        if not work_order:
            log(f"❌ Missing workOrder in response")
            return False
        if work_order.get("sourceKind") != "bounty":
            log(f"❌ Expected sourceKind=bounty, got {work_order.get('sourceKind')}")
            return False
        if work_order.get("sourceId") != bounty_id:
            log(f"❌ Expected sourceId={bounty_id}, got {work_order.get('sourceId')}")
            return False
        if work_order.get("contractorId") != user_id:
            log(f"❌ Expected contractorId={user_id}, got {work_order.get('contractorId')}")
            return False
        if work_order.get("posterId") != user_id:
            log(f"❌ Expected posterId={user_id}, got {work_order.get('posterId')}")
            return False
        if work_order.get("budget") != 105:
            log(f"❌ Expected budget=105, got {work_order.get('budget')}")
            return False
        if work_order.get("state") != "open":
            log(f"❌ Expected state=open, got {work_order.get('state')}")
            return False
        
        log(f"✅ Claim successful:")
        log(f"   - bounty.state=claimed")
        log(f"   - bounty.claimedContractorId={user_id}")
        log(f"   - bounty.workOrderId={bounty.get('workOrderId')}")
        log(f"   - workOrder.id={work_order.get('id')}")
        log(f"   - workOrder.sourceKind=bounty")
        log(f"   - workOrder.sourceId={bounty_id}")
        log(f"   - workOrder.contractorId={user_id}")
        log(f"   - workOrder.posterId={user_id}")
        log(f"   - workOrder.budget=105")
        log(f"   - workOrder.state=open")
        
        # Verify work order exists in database
        work_order_id = work_order.get("id")
        r = requests.get(f"{BASE_URL}/work-orders/{work_order_id}", headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Work order not found in database: {r.status_code}")
            return False
        log(f"✅ Work order verified in database")
        
    except Exception as e:
        log(f"❌ Claim exception: {e}")
        return False

    # ===== STEP 14: Validation - claim again (already claimed) =====
    log("\nSTEP 14: Validation - claim again (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{bounty_id}/claim", headers=headers, timeout=10)
        # Note: Implementation checks state first, so claimed bounty returns 400 (state: claimed) not 409
        if r.status_code not in [400, 409]:
            log(f"❌ Expected 400 or 409, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if r.status_code == 400 and "cannot be claimed" in error.lower() and "claimed" in error.lower():
            log(f"✅ Validation passed: claim again rejected with 400 '{error}' (state check)")
        elif r.status_code == 409 and "already claimed" in error.lower():
            log(f"✅ Validation passed: claim again rejected with 409 '{error}'")
        else:
            log(f"❌ Unexpected error message: {error}")
            return False
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 15: Create bounty in funding state for claim validation =====
    log("\nSTEP 15: Create bounty in funding state for claim validation")
    try:
        bounty_payload = {
            "title": "Test funding bounty",
            "description": "test",
            "location": {"city": "SJ", "state": "CA"},
            "fundingGoalUsd": 100
        }
        r = requests.post(f"{BASE_URL}/bounties", json=bounty_payload, headers=headers, timeout=10)
        if r.status_code != 201:
            log(f"❌ Create funding bounty failed: {r.status_code} {r.text}")
            return False
        funding_bounty_id = r.json().get("bounty", {}).get("id")
        
        # Transition to funding
        r = requests.patch(f"{BASE_URL}/bounties/{funding_bounty_id}/state", json={"state": "funding"}, headers=headers, timeout=10)
        if r.status_code != 200:
            log(f"❌ Transition to funding failed: {r.status_code} {r.text}")
            return False
        log(f"✅ Funding bounty created: id={funding_bounty_id}")
    except Exception as e:
        log(f"❌ Create funding bounty exception: {e}")
        return False

    # ===== STEP 16: Validation - claim bounty in funding state =====
    log("\nSTEP 16: Validation - claim bounty in funding state (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{funding_bounty_id}/claim", headers=headers, timeout=10)
        if r.status_code != 400:
            log(f"❌ Expected 400, got {r.status_code}")
            return False
        error = r.json().get("error", "")
        if "cannot be claimed" not in error.lower() or "funding" not in error.lower():
            log(f"❌ Expected 'cannot be claimed' and 'funding' in error, got: {error}")
            return False
        log(f"✅ Validation passed: claim funding bounty rejected with 400 '{error}'")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 17: Validation - claim without auth =====
    log("\nSTEP 17: Validation - claim without auth (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/bounties/{funding_bounty_id}/claim", timeout=10)
        if r.status_code != 401:
            log(f"❌ Expected 401, got {r.status_code}")
            return False
        log(f"✅ Validation passed: claim without auth rejected with 401")
    except Exception as e:
        log(f"❌ Validation exception: {e}")
        return False

    # ===== STEP 18: Cleanup - cancel test bounties =====
    log("\nSTEP 18: Cleanup - cancel test bounties")
    try:
        # Cancel the claimed bounty (already claimed, so just soft-cancel)
        r = requests.patch(f"{BASE_URL}/bounties/{bounty_id}/state", json={"state": "cancelled"}, headers=headers, timeout=10)
        if r.status_code == 200:
            log(f"✅ Cancelled bounty {bounty_id}")
        else:
            log(f"⚠️ Could not cancel bounty {bounty_id}: {r.status_code}")
        
        # Cancel the cancelled bounty (already cancelled)
        log(f"✅ Bounty {cancelled_bounty_id} already cancelled")
        
        # Cancel the funding bounty
        r = requests.patch(f"{BASE_URL}/bounties/{funding_bounty_id}/state", json={"state": "cancelled"}, headers=headers, timeout=10)
        if r.status_code == 200:
            log(f"✅ Cancelled bounty {funding_bounty_id}")
        else:
            log(f"⚠️ Could not cancel bounty {funding_bounty_id}: {r.status_code}")
        
        log(f"✅ Cleanup complete (work_orders left as-is, no DELETE endpoint)")
    except Exception as e:
        log(f"⚠️ Cleanup exception: {e}")

    log("\n" + "="*80)
    log("✅ ALL TESTS PASSED - Bounty Contribute + Claim endpoints verified")
    log("="*80)
    return True

if __name__ == "__main__":
    success = test_bounty_contribute_claim()
    exit(0 if success else 1)
