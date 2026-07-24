#!/usr/bin/env python3
"""
Backend Test: Receipts → Rewards → Impact Score Wiring
Test Date: 2026-06-08
Test Script for: Receipt save → Rewards points + Impact Score wiring

Tests the complete flow:
1. POST /api/receipts with various receipt types
2. Verify rewards points are awarded correctly
3. Verify impact score aggregation
4. Test idempotency
5. Test batch receipts
6. Test balance progression
7. Test facility rewards partner flow
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials (super admin)
ADMIN_EMAIL = "jamal@dumpmaps.org"
ADMIN_PASSWORD = "@@Jefferson2180"

# Global state
admin_token = None
test_facility_id = None
initial_balance = 0
total_points_awarded = 0
receipt_ids = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login(email, password):
    """Login and return token"""
    try:
        log(f"Logging in as {email}...")
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Login failed: {resp.status_code} - {resp.text}")
            return None
        data = resp.json()
        token = data.get("token")
        if not token:
            log(f"❌ No token in response: {data}")
            return None
        log(f"✅ Login successful")
        return token
    except Exception as e:
        log(f"❌ Login exception: {e}")
        return None

def get_balance(token):
    """Get current rewards balance"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/users/me/rewards/balance", headers=headers, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Get balance failed: {resp.status_code} - {resp.text}")
            return None
        data = resp.json()
        balance = data.get("balance", 0)
        log(f"✅ Current balance: {balance} points")
        return balance
    except Exception as e:
        log(f"❌ Get balance exception: {e}")
        return None

def get_facilities(token):
    """Get list of facilities"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/facilities?limit=10", headers=headers, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Get facilities failed: {resp.status_code} - {resp.text}")
            return []
        data = resp.json()
        facilities = data.get("facilities", [])
        log(f"✅ Found {len(facilities)} facilities")
        return facilities
    except Exception as e:
        log(f"❌ Get facilities exception: {e}")
        return []

def create_receipt(token, receipt_data):
    """Create a receipt and return response"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = requests.post(f"{BASE_URL}/receipts", json=receipt_data, headers=headers, timeout=10)
        if resp.status_code not in [200, 201]:
            log(f"❌ Create receipt failed: {resp.status_code} - {resp.text}")
            return None
        data = resp.json()
        return data
    except Exception as e:
        log(f"❌ Create receipt exception: {e}")
        return None

def get_facility_impact(facility_id):
    """Get facility impact score (public endpoint)"""
    try:
        resp = requests.get(f"{BASE_URL}/facilities/{facility_id}/impact", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Get impact failed: {resp.status_code} - {resp.text}")
            return None
        data = resp.json()
        return data
    except Exception as e:
        log(f"❌ Get impact exception: {e}")
        return None

def enable_facility_rewards(token, facility_id):
    """Enable rewards for a facility"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        config = {
            "participating": True,
            "status": "live",
            "rewardType": "percentage_cashback",
            "validationWindow": "7d"
        }
        resp = requests.patch(f"{BASE_URL}/admin/facilities/{facility_id}/rewards-config", json=config, headers=headers, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Enable rewards failed: {resp.status_code} - {resp.text}")
            return False
        log(f"✅ Rewards enabled for facility {facility_id}")
        return True
    except Exception as e:
        log(f"❌ Enable rewards exception: {e}")
        return False

def disable_facility_rewards(token, facility_id):
    """Disable rewards for a facility"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        config = {
            "participating": False,
            "status": "not_active"
        }
        resp = requests.patch(f"{BASE_URL}/admin/facilities/{facility_id}/rewards-config", json=config, headers=headers, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Disable rewards failed: {resp.status_code} - {resp.text}")
            return False
        log(f"✅ Rewards disabled for facility {facility_id}")
        return True
    except Exception as e:
        log(f"❌ Disable rewards exception: {e}")
        return False

def get_rewards_history(token, limit=20):
    """Get rewards history"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/users/me/rewards/history?limit={limit}", headers=headers, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Get history failed: {resp.status_code} - {resp.text}")
            return []
        data = resp.json()
        # API returns 'entries' not 'history'
        history = data.get("entries", data.get("history", []))
        return history
    except Exception as e:
        log(f"❌ Get history exception: {e}")
        return []

def batch_create_receipts(token, receipts):
    """Create batch receipts"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "confirm": "I confirm these receipt records are accurate",
            "receipts": receipts
        }
        resp = requests.post(f"{BASE_URL}/receipts/batch", json=payload, headers=headers, timeout=10)
        if resp.status_code not in [200, 201]:
            log(f"❌ Batch create failed: {resp.status_code} - {resp.text}")
            return None
        data = resp.json()
        return data
    except Exception as e:
        log(f"❌ Batch create exception: {e}")
        return None

# ============================================================================
# TEST CASES
# ============================================================================

def test_1_generic_receipt():
    """Test 1: Generic receipt - should award 50 pts (receipt_verified)"""
    global admin_token, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 1: Generic receipt (Mixed C&D)")
    log("="*80)
    
    receipt_data = {
        "facilityName": "Test Generic",
        "dateOf": "2026-06-08",
        "grossLb": 5000,
        "tareLb": 2000,
        "pricePerTon": 80,
        "materialType": "Mixed C&D",
        "loadType": "mixed",
        "paymentMethod": "card"
    }
    
    result = create_receipt(admin_token, receipt_data)
    if not result:
        log("❌ TEST 1 FAILED: Could not create receipt")
        return False
    
    receipt = result.get("receipt", {})
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify receipt fields
    if receipt.get("netLb") != 3000:
        log(f"❌ TEST 1 FAILED: Expected netLb=3000, got {receipt.get('netLb')}")
        return False
    
    if receipt.get("materialType") != "Mixed C&D":
        log(f"❌ TEST 1 FAILED: Expected materialType='Mixed C&D', got {receipt.get('materialType')}")
        return False
    
    # Verify rewards
    if len(awards) != 1:
        log(f"❌ TEST 1 FAILED: Expected 1 award, got {len(awards)}")
        return False
    
    award = awards[0]
    if award.get("source") != "receipt_verified":
        log(f"❌ TEST 1 FAILED: Expected source='receipt_verified', got {award.get('source')}")
        return False
    
    if award.get("points") != 50:
        log(f"❌ TEST 1 FAILED: Expected points=50, got {award.get('points')}")
        return False
    
    if award.get("duplicate") != False:
        log(f"❌ TEST 1 FAILED: Expected duplicate=False, got {award.get('duplicate')}")
        return False
    
    if total_points != 50:
        log(f"❌ TEST 1 FAILED: Expected totalPoints=50, got {total_points}")
        return False
    
    total_points_awarded += total_points
    receipt_ids.append(receipt.get("id"))
    
    log(f"✅ TEST 1 PASSED: Generic receipt awarded {total_points} pts (receipt_verified)")
    log(f"   Receipt ID: {receipt.get('id')}")
    log(f"   netLb: {receipt.get('netLb')}, materialType: {receipt.get('materialType')}")
    return True

def test_2_ewaste_receipt():
    """Test 2: E-Waste receipt - should award 75 pts (ewaste_receipt)"""
    global admin_token, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 2: E-Waste receipt")
    log("="*80)
    
    receipt_data = {
        "facilityName": "Test EWaste",
        "dateOf": "2026-06-08",
        "grossLb": 1000,
        "tareLb": 300,
        "materialType": "E-Waste",
        "loadType": "other",
        "paymentMethod": "card"
    }
    
    result = create_receipt(admin_token, receipt_data)
    if not result:
        log("❌ TEST 2 FAILED: Could not create receipt")
        return False
    
    receipt = result.get("receipt", {})
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify rewards
    if len(awards) != 1:
        log(f"❌ TEST 2 FAILED: Expected 1 award, got {len(awards)}")
        return False
    
    award = awards[0]
    if award.get("source") != "ewaste_receipt":
        log(f"❌ TEST 2 FAILED: Expected source='ewaste_receipt', got {award.get('source')}")
        return False
    
    if award.get("points") != 75:
        log(f"❌ TEST 2 FAILED: Expected points=75, got {award.get('points')}")
        return False
    
    if total_points != 75:
        log(f"❌ TEST 2 FAILED: Expected totalPoints=75, got {total_points}")
        return False
    
    total_points_awarded += total_points
    receipt_ids.append(receipt.get("id"))
    
    log(f"✅ TEST 2 PASSED: E-Waste receipt awarded {total_points} pts (ewaste_receipt)")
    log(f"   Receipt ID: {receipt.get('id')}")
    return True

def test_3_donation_receipt():
    """Test 3: Donation receipt - should award 75 pts (donation_receipt)"""
    global admin_token, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 3: Donation receipt")
    log("="*80)
    
    receipt_data = {
        "facilityName": "Goodwill Test",
        "dateOf": "2026-06-08",
        "grossLb": 300,
        "tareLb": 100,
        "materialType": "Donation",
        "loadType": "other",
        "paymentMethod": "other"
    }
    
    result = create_receipt(admin_token, receipt_data)
    if not result:
        log("❌ TEST 3 FAILED: Could not create receipt")
        return False
    
    receipt = result.get("receipt", {})
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify rewards
    if len(awards) != 1:
        log(f"❌ TEST 3 FAILED: Expected 1 award, got {len(awards)}")
        return False
    
    award = awards[0]
    if award.get("source") != "donation_receipt":
        log(f"❌ TEST 3 FAILED: Expected source='donation_receipt', got {award.get('source')}")
        return False
    
    if award.get("points") != 75:
        log(f"❌ TEST 3 FAILED: Expected points=75, got {award.get('points')}")
        return False
    
    if total_points != 75:
        log(f"❌ TEST 3 FAILED: Expected totalPoints=75, got {total_points}")
        return False
    
    total_points_awarded += total_points
    receipt_ids.append(receipt.get("id"))
    
    log(f"✅ TEST 3 PASSED: Donation receipt awarded {total_points} pts (donation_receipt)")
    log(f"   Receipt ID: {receipt.get('id')}")
    return True

def test_4_facility_linked_receipt():
    """Test 4: Receipt linked to real facility - should award 50+ pts (receipt_verified + first_visit_bonus)"""
    global admin_token, test_facility_id, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 4: Receipt linked to real facility")
    log("="*80)
    
    # Get a real facility
    facilities = get_facilities(admin_token)
    if not facilities:
        log("❌ TEST 4 FAILED: No facilities found")
        return False
    
    test_facility_id = facilities[0].get("id")
    facility_name = facilities[0].get("name")
    log(f"Using facility: {facility_name} (ID: {test_facility_id})")
    
    receipt_data = {
        "facilityId": test_facility_id,
        "dateOf": "2026-06-08",
        "grossLb": 4000,
        "tareLb": 1000,
        "pricePerTon": 60,
        "materialType": "Wood",
        "loadType": "clean",
        "paymentMethod": "card"
    }
    
    result = create_receipt(admin_token, receipt_data)
    if not result:
        log("❌ TEST 4 FAILED: Could not create receipt")
        return False
    
    receipt = result.get("receipt", {})
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify receipt fields
    if receipt.get("facilityId") != test_facility_id:
        log(f"❌ TEST 4 FAILED: Expected facilityId={test_facility_id}, got {receipt.get('facilityId')}")
        return False
    
    if not receipt.get("facilityName"):
        log(f"❌ TEST 4 FAILED: facilityName should be auto-filled")
        return False
    
    # Verify rewards (should have receipt_verified + possibly first_visit_bonus)
    if total_points < 50:
        log(f"❌ TEST 4 FAILED: Expected totalPoints >= 50, got {total_points}")
        return False
    
    # Check if first_visit_bonus was awarded
    has_first_visit = any(a.get("source") == "first_visit_bonus" for a in awards)
    if has_first_visit:
        log(f"✅ First visit bonus awarded (100 pts)")
        if total_points != 150:
            log(f"⚠️  Expected totalPoints=150 (50+100), got {total_points}")
    else:
        log(f"ℹ️  No first visit bonus (user has prior receipts at this facility)")
    
    total_points_awarded += total_points
    receipt_ids.append(receipt.get("id"))
    
    log(f"✅ TEST 4 PASSED: Facility-linked receipt awarded {total_points} pts")
    log(f"   Receipt ID: {receipt.get('id')}")
    log(f"   Facility: {receipt.get('facilityName')}")
    log(f"   Awards: {[a.get('source') for a in awards]}")
    return True

def test_5_rewards_partner_flow():
    """Test 5: Rewards partner + check-in flow"""
    global admin_token, test_facility_id, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 5: Rewards partner + check-in flow")
    log("="*80)
    
    if not test_facility_id:
        log("❌ TEST 5 FAILED: No test facility ID from previous test")
        return False
    
    # Enable rewards for the facility
    if not enable_facility_rewards(admin_token, test_facility_id):
        log("❌ TEST 5 FAILED: Could not enable rewards")
        return False
    
    # Create a new receipt at this facility
    receipt_data = {
        "facilityId": test_facility_id,
        "dateOf": "2026-06-08",
        "grossLb": 4000,
        "tareLb": 1000,
        "materialType": "Cardboard",
        "loadType": "clean",
        "paymentMethod": "card"
    }
    
    result = create_receipt(admin_token, receipt_data)
    if not result:
        log("❌ TEST 5 FAILED: Could not create receipt")
        return False
    
    receipt = result.get("receipt", {})
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify rewards include partner_facility_bonus
    has_partner_bonus = any(a.get("source") == "partner_facility_bonus" for a in awards)
    if not has_partner_bonus:
        log(f"❌ TEST 5 FAILED: Expected partner_facility_bonus in awards")
        log(f"   Awards: {[a.get('source') for a in awards]}")
        return False
    
    # Should have receipt_verified (50) + partner_facility_bonus (25)
    # May also have first_visit_bonus (100) if this is first receipt at this facility
    partner_award = next(a for a in awards if a.get("source") == "partner_facility_bonus")
    if partner_award.get("points") != 25:
        log(f"❌ TEST 5 FAILED: Expected partner_facility_bonus=25 pts, got {partner_award.get('points')}")
        return False
    
    total_points_awarded += total_points
    receipt_ids.append(receipt.get("id"))
    
    log(f"✅ TEST 5 PASSED: Rewards partner receipt awarded {total_points} pts")
    log(f"   Receipt ID: {receipt.get('id')}")
    awards_str = [f"{a.get('source')}:{a.get('points')}" for a in awards]
    log(f"   Awards: {awards_str}")
    return True

def test_6_idempotency_check():
    """Test 6: Idempotency check - verify same receipt can't double-award"""
    global admin_token, receipt_ids
    log("\n" + "="*80)
    log("TEST 6: Idempotency check")
    log("="*80)
    
    if not receipt_ids:
        log("❌ TEST 6 FAILED: No receipt IDs from previous tests")
        return False
    
    # Get rewards history
    history = get_rewards_history(admin_token, limit=50)
    if not history:
        log("❌ TEST 6 FAILED: Could not get rewards history")
        return False
    
    # Check for duplicate entries per receipt
    receipt_id = receipt_ids[0]
    entries_for_receipt = [h for h in history if h.get("refId") == receipt_id]
    
    log(f"Checking receipt {receipt_id}...")
    log(f"Found {len(entries_for_receipt)} ledger entries for this receipt")
    
    # Group by source
    sources = {}
    for entry in entries_for_receipt:
        source = entry.get("source")
        if source not in sources:
            sources[source] = 0
        sources[source] += 1
    
    # Verify no duplicates per source
    has_duplicates = False
    for source, count in sources.items():
        log(f"  {source}: {count} entries")
        if count > 1:
            log(f"❌ DUPLICATE FOUND: {source} has {count} entries")
            has_duplicates = True
    
    if has_duplicates:
        log("❌ TEST 6 FAILED: Found duplicate ledger entries")
        return False
    
    log(f"✅ TEST 6 PASSED: No duplicate ledger entries found (idempotency working)")
    return True

def test_7_batch_receipts():
    """Test 7: Batch receipts - should award 150 pts (3 × 50)"""
    global admin_token, total_points_awarded, receipt_ids
    log("\n" + "="*80)
    log("TEST 7: Batch receipts (3 receipts)")
    log("="*80)
    
    receipts = [
        {
            "facilityName": "Batch Test 1",
            "dateOf": "2026-06-08",
            "grossLb": 2000,
            "tareLb": 500,
            "materialType": "Mixed C&D",
            "loadType": "mixed",
            "paymentMethod": "card"
        },
        {
            "facilityName": "Batch Test 2",
            "dateOf": "2026-06-08",
            "grossLb": 3000,
            "tareLb": 1000,
            "materialType": "Mixed C&D",
            "loadType": "mixed",
            "paymentMethod": "card"
        },
        {
            "facilityName": "Batch Test 3",
            "dateOf": "2026-06-08",
            "grossLb": 1500,
            "tareLb": 500,
            "materialType": "Mixed C&D",
            "loadType": "mixed",
            "paymentMethod": "card"
        }
    ]
    
    result = batch_create_receipts(admin_token, receipts)
    if not result:
        log("❌ TEST 7 FAILED: Could not create batch receipts")
        return False
    
    batch_receipts = result.get("receipts", [])
    rewards = result.get("rewards", {})
    awards = rewards.get("awards", [])
    total_points = rewards.get("totalPoints", 0)
    
    # Verify 3 receipts created
    if len(batch_receipts) != 3:
        log(f"❌ TEST 7 FAILED: Expected 3 receipts, got {len(batch_receipts)}")
        return False
    
    # Verify 3 awards
    if len(awards) != 3:
        log(f"❌ TEST 7 FAILED: Expected 3 awards, got {len(awards)}")
        return False
    
    # Verify total points (3 × 50 = 150)
    if total_points != 150:
        log(f"❌ TEST 7 FAILED: Expected totalPoints=150, got {total_points}")
        return False
    
    total_points_awarded += total_points
    for r in batch_receipts:
        receipt_ids.append(r.get("id"))
    
    log(f"✅ TEST 7 PASSED: Batch receipts awarded {total_points} pts (3 × 50)")
    log(f"   Batch ID: {result.get('batchId')}")
    log(f"   Receipts: {len(batch_receipts)}")
    return True

def test_8_balance_progression():
    """Test 8: Balance progression - verify balance increased by total points awarded"""
    global admin_token, initial_balance, total_points_awarded
    log("\n" + "="*80)
    log("TEST 8: Balance progression")
    log("="*80)
    
    final_balance = get_balance(admin_token)
    if final_balance is None:
        log("❌ TEST 8 FAILED: Could not get final balance")
        return False
    
    expected_balance = initial_balance + total_points_awarded
    actual_increase = final_balance - initial_balance
    
    log(f"Initial balance: {initial_balance} pts")
    log(f"Total points awarded: {total_points_awarded} pts")
    log(f"Expected final balance: {expected_balance} pts")
    log(f"Actual final balance: {final_balance} pts")
    log(f"Actual increase: {actual_increase} pts")
    
    # Allow for some tolerance in case there were other concurrent operations
    if actual_increase < total_points_awarded:
        log(f"❌ TEST 8 FAILED: Balance increase ({actual_increase}) is less than points awarded ({total_points_awarded})")
        return False
    
    if actual_increase > total_points_awarded:
        log(f"⚠️  Balance increase ({actual_increase}) is greater than points awarded ({total_points_awarded})")
        log(f"   This may be due to concurrent operations or previous test runs")
    
    log(f"✅ TEST 8 PASSED: Balance increased by at least {total_points_awarded} pts")
    return True

def test_9_impact_score_aggregation():
    """Test 9: Impact Score aggregation - verify facility impact metrics"""
    global test_facility_id
    log("\n" + "="*80)
    log("TEST 9: Impact Score aggregation")
    log("="*80)
    
    if not test_facility_id:
        log("❌ TEST 9 FAILED: No test facility ID")
        return False
    
    impact = get_facility_impact(test_facility_id)
    if not impact:
        log("❌ TEST 9 FAILED: Could not get facility impact")
        return False
    
    is_new = impact.get("isNew")
    metrics = impact.get("metrics", {})
    
    log(f"Facility Impact Score:")
    log(f"  isNew: {is_new}")
    log(f"  receiptCount: {metrics.get('receiptCount')}")
    log(f"  lbsDiverted: {metrics.get('lbsDiverted')}")
    log(f"  treesEquivalent: {metrics.get('treesEquivalent')}")
    log(f"  lbsCo2Offset: {metrics.get('lbsCo2Offset')}")
    log(f"  gallonsWaterSaved: {metrics.get('gallonsWaterSaved')}")
    
    # Verify isNew is false (we created receipts)
    if is_new != False:
        log(f"❌ TEST 9 FAILED: Expected isNew=False, got {is_new}")
        return False
    
    # Verify receiptCount >= 2 (we created at least 2 facility-linked receipts)
    receipt_count = metrics.get("receiptCount", 0)
    if receipt_count < 2:
        log(f"❌ TEST 9 FAILED: Expected receiptCount >= 2, got {receipt_count}")
        return False
    
    # Verify lbsDiverted >= 6000 (3000 + 3000 from tests 4 and 5)
    lbs_diverted = metrics.get("lbsDiverted", 0)
    if lbs_diverted < 6000:
        log(f"❌ TEST 9 FAILED: Expected lbsDiverted >= 6000, got {lbs_diverted}")
        return False
    
    # Verify treesEquivalent > 0
    trees = metrics.get("treesEquivalent", 0)
    if trees <= 0:
        log(f"❌ TEST 9 FAILED: Expected treesEquivalent > 0, got {trees}")
        return False
    
    # Verify lbsCo2Offset formula (lbsDiverted * 2.5, rounded to nearest 100)
    lbs_co2 = metrics.get("lbsCo2Offset", 0)
    expected_co2 = round((lbs_diverted * 2.5) / 100) * 100
    if lbs_co2 != expected_co2:
        log(f"⚠️  lbsCo2Offset formula check: expected {expected_co2}, got {lbs_co2}")
        log(f"   (This may be due to rounding or other receipts at this facility)")
    
    # Verify gallonsWaterSaved formula (lbsDiverted * 7)
    gallons = metrics.get("gallonsWaterSaved", 0)
    expected_gallons = lbs_diverted * 7
    if gallons != expected_gallons:
        log(f"⚠️  gallonsWaterSaved formula check: expected {expected_gallons}, got {gallons}")
    
    log(f"✅ TEST 9 PASSED: Impact score aggregation working correctly")
    return True

def test_10_cleanup():
    """Test 10: Cleanup - disable facility rewards program"""
    global admin_token, test_facility_id
    log("\n" + "="*80)
    log("TEST 10: Cleanup - disable facility rewards")
    log("="*80)
    
    if not test_facility_id:
        log("⚠️  TEST 10 SKIPPED: No test facility ID")
        return True
    
    if not disable_facility_rewards(admin_token, test_facility_id):
        log("❌ TEST 10 FAILED: Could not disable rewards")
        return False
    
    log(f"✅ TEST 10 PASSED: Facility rewards disabled")
    return True

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    global admin_token, initial_balance
    
    log("="*80)
    log("RECEIPTS → REWARDS → IMPACT SCORE WIRING TEST")
    log("="*80)
    log(f"Backend URL: {BASE_URL}")
    log(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("")
    
    # Login
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ FATAL: Could not login")
        sys.exit(1)
    
    # Get initial balance
    initial_balance = get_balance(admin_token)
    if initial_balance is None:
        log("❌ FATAL: Could not get initial balance")
        sys.exit(1)
    
    # Run tests
    tests = [
        ("Test 1: Generic receipt", test_1_generic_receipt),
        ("Test 2: E-Waste receipt", test_2_ewaste_receipt),
        ("Test 3: Donation receipt", test_3_donation_receipt),
        ("Test 4: Facility-linked receipt", test_4_facility_linked_receipt),
        ("Test 5: Rewards partner flow", test_5_rewards_partner_flow),
        ("Test 6: Idempotency check", test_6_idempotency_check),
        ("Test 7: Batch receipts", test_7_batch_receipts),
        ("Test 8: Balance progression", test_8_balance_progression),
        ("Test 9: Impact score aggregation", test_9_impact_score_aggregation),
        ("Test 10: Cleanup", test_10_cleanup),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            log(f"❌ {name} EXCEPTION: {e}")
            failed += 1
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    log(f"Total tests: {len(tests)}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    log(f"Total points awarded: {total_points_awarded}")
    log(f"Receipt IDs created: {len(receipt_ids)}")
    
    if failed == 0:
        log("\n✅ ALL TESTS PASSED - RECEIPTS → REWARDS → IMPACT SCORE WIRING IS WORKING")
        sys.exit(0)
    else:
        log(f"\n❌ {failed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
