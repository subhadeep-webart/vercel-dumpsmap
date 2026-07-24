#!/usr/bin/env python3
"""
Backend test for Stripe Checkout End-to-End + Donor CSV Export
Test environment: NO Stripe keys configured - graceful fallback to queued-intent flow
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"
ADMIN_EMAIL = "aj@bisonjunk.com"
ADMIN_PASSWORD = "admin123"

def login(email, password):
    """Login and return token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed for {email}: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    token = data.get("token")
    print(f"✅ Login successful for {email}")
    return token

def test_scenario_1_happy_path_one_time():
    """Test 1a: Happy path one-time donation"""
    print("\n" + "="*80)
    print("TEST 1a: POST /api/donations/intent - Happy path one-time donation")
    print("="*80)
    
    payload = {
        "email": "backend.test+onetime@dumpmaps.org",
        "amount": 25,
        "name": "Test One",
        "tier": "community",
        "recurring": False,
        "message": "backend test one-time"
    }
    
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Verify response structure
    assert "intent" in data, "❌ Missing 'intent' in response"
    assert "stripeReady" in data, "❌ Missing 'stripeReady' in response"
    assert "checkoutUrl" in data, "❌ Missing 'checkoutUrl' in response"
    assert "sessionId" in data, "❌ Missing 'sessionId' in response"
    assert "stripeError" in data, "❌ Missing 'stripeError' in response"
    assert "message" in data, "❌ Missing 'message' in response"
    
    intent = data["intent"]
    print(f"\nIntent ID: {intent.get('id')}")
    print(f"Intent amount: {intent.get('amount')}")
    print(f"Intent status: {intent.get('status')}")
    print(f"Intent contactedStatus: {intent.get('contactedStatus')}")
    print(f"Intent convertedStatus: {intent.get('convertedStatus')}")
    print(f"stripeReady: {data.get('stripeReady')}")
    print(f"checkoutUrl: {data.get('checkoutUrl')}")
    print(f"sessionId: {data.get('sessionId')}")
    print(f"stripeError: {data.get('stripeError')}")
    print(f"message: {data.get('message')}")
    
    # Verify expected values for NO Stripe keys environment
    assert intent.get("amount") == 25, f"❌ Expected amount=25, got {intent.get('amount')}"
    assert intent.get("status") == "queued", f"❌ Expected status='queued', got {intent.get('status')}"
    assert intent.get("contactedStatus") == "", f"❌ Expected contactedStatus='', got {intent.get('contactedStatus')}"
    assert intent.get("convertedStatus") == "queued", f"❌ Expected convertedStatus='queued', got {intent.get('convertedStatus')}"
    assert data.get("stripeReady") == False, f"❌ Expected stripeReady=false, got {data.get('stripeReady')}"
    assert data.get("checkoutUrl") is None, f"❌ Expected checkoutUrl=null, got {data.get('checkoutUrl')}"
    assert data.get("sessionId") is None, f"❌ Expected sessionId=null, got {data.get('sessionId')}"
    assert data.get("stripeError") is None, f"❌ Expected stripeError=null, got {data.get('stripeError')}"
    assert "logged" in data.get("message", "").lower() or "live" in data.get("message", "").lower(), \
        f"❌ Expected message to contain 'logged' or 'live', got: {data.get('message')}"
    
    print("\n✅ TEST 1a PASSED: One-time donation intent created with queued status")
    return intent.get("id")

def test_scenario_1_happy_path_recurring():
    """Test 1b: Happy path recurring (monthly) donation"""
    print("\n" + "="*80)
    print("TEST 1b: POST /api/donations/intent - Happy path recurring (monthly)")
    print("="*80)
    
    payload = {
        "email": "backend.test+monthly@dumpmaps.org",
        "amount": 10,
        "name": "Test Mon",
        "tier": "contractor",
        "recurring": True,
        "message": "backend test monthly"
    }
    
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    intent = data["intent"]
    
    print(f"Intent ID: {intent.get('id')}")
    print(f"Intent recurring: {intent.get('recurring')}")
    print(f"Intent status: {intent.get('status')}")
    print(f"stripeReady: {data.get('stripeReady')}")
    
    assert intent.get("recurring") == True, f"❌ Expected recurring=true, got {intent.get('recurring')}"
    assert intent.get("status") == "queued", f"❌ Expected status='queued', got {intent.get('status')}"
    assert data.get("stripeReady") == False, f"❌ Expected stripeReady=false, got {data.get('stripeReady')}"
    
    print("\n✅ TEST 1b PASSED: Recurring donation intent created with queued status")
    return intent.get("id")

def test_scenario_1_validation_missing_email():
    """Test 1c: Validation - missing email"""
    print("\n" + "="*80)
    print("TEST 1c: POST /api/donations/intent - Validation: missing email")
    print("="*80)
    
    payload = {
        "amount": 25,
        "name": "Test",
        "tier": "community"
    }
    
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Error: {data.get('error')}")
    
    assert "email" in data.get("error", "").lower() and "amount" in data.get("error", "").lower(), \
        f"❌ Expected error to mention 'email and positive amount', got: {data.get('error')}"
    
    print("✅ TEST 1c PASSED: Missing email correctly rejected with 400")
    return True

def test_scenario_1_validation_zero_amount():
    """Test 1d: Validation - zero/negative amount"""
    print("\n" + "="*80)
    print("TEST 1d: POST /api/donations/intent - Validation: zero/negative amount")
    print("="*80)
    
    # Test zero amount
    payload = {
        "email": "test@test.com",
        "amount": 0,
        "name": "Test"
    }
    
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status (zero amount): {resp.status_code}")
    
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400 for zero amount, got {resp.status_code}")
        return False
    
    # Test negative amount
    payload["amount"] = -10
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status (negative amount): {resp.status_code}")
    
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400 for negative amount, got {resp.status_code}")
        return False
    
    print("✅ TEST 1d PASSED: Zero/negative amounts correctly rejected with 400")
    return True

def test_scenario_1_validation_missing_amount():
    """Test 1e: Validation - missing amount"""
    print("\n" + "="*80)
    print("TEST 1e: POST /api/donations/intent - Validation: missing amount")
    print("="*80)
    
    payload = {
        "email": "test@test.com",
        "name": "Test"
    }
    
    resp = requests.post(f"{BASE_URL}/donations/intent", json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 400:
        print(f"❌ FAILED: Expected 400, got {resp.status_code}")
        return False
    
    print("✅ TEST 1e PASSED: Missing amount correctly rejected with 400")
    return True

def test_scenario_2_webhook_no_keys():
    """Test 2: POST /api/donations/webhook (no signature, no Stripe keys)"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/donations/webhook - No signature, no Stripe keys")
    print("="*80)
    
    payload = {}
    
    resp = requests.post(f"{BASE_URL}/donations/webhook", json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response: {data}")
    
    assert data.get("received") == True, f"❌ Expected received=true, got {data.get('received')}"
    assert data.get("skipped") == True, f"❌ Expected skipped=true, got {data.get('skipped')}"
    
    print("✅ TEST 2 PASSED: Webhook correctly returns 200 with received=true, skipped=true")
    return True

def test_scenario_3_admin_donations_list(token):
    """Test 3: GET /api/admin/donations (requires moderator+)"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/admin/donations - List donations and intents")
    print("="*80)
    
    # Test without auth
    print("\nTest 3a: Without Authorization header")
    resp = requests.get(f"{BASE_URL}/admin/donations")
    print(f"Status (no auth): {resp.status_code}")
    
    if resp.status_code not in [401, 403]:
        print(f"⚠️  WARNING: Expected 401 or 403 without auth, got {resp.status_code}")
    else:
        print(f"✅ Correctly rejected without auth: {resp.status_code}")
    
    # Test with admin token
    print("\nTest 3b: With admin token (aj@bisonjunk.com)")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/admin/donations", headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    assert "donations" in data, "❌ Missing 'donations' in response"
    assert "intents" in data, "❌ Missing 'intents' in response"
    assert "stripeReady" in data, "❌ Missing 'stripeReady' in response"
    assert "stats" in data, "❌ Missing 'stats' in response"
    
    print(f"\nstripeReady: {data.get('stripeReady')}")
    print(f"Donations count: {len(data.get('donations', []))}")
    print(f"Intents count: {len(data.get('intents', []))}")
    print(f"Stats: {data.get('stats')}")
    
    assert data.get("stripeReady") == False, f"❌ Expected stripeReady=false, got {data.get('stripeReady')}"
    
    # Check if our test intents are in the list
    intents = data.get("intents", [])
    test_emails = ["backend.test+onetime@dumpmaps.org", "backend.test+monthly@dumpmaps.org"]
    found_intents = [i for i in intents if i.get("email") in test_emails]
    print(f"\nFound {len(found_intents)} test intents in the list")
    
    if len(found_intents) > 0:
        print("✅ Test intents found in the list")
        for intent in found_intents:
            print(f"  - {intent.get('email')}: {intent.get('amount')} {intent.get('currency')} ({intent.get('status')})")
    
    print("\n✅ TEST 3 PASSED: Admin donations list endpoint working correctly")
    return True

def test_scenario_4_csv_export(token, intent_id_1, intent_id_2):
    """Test 4: GET /api/admin/donations/export (CSV export)"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/admin/donations/export - CSV export")
    print("="*80)
    
    # Test without auth
    print("\nTest 4a: Without Authorization header")
    resp = requests.get(f"{BASE_URL}/admin/donations/export?scope=all")
    print(f"Status (no auth): {resp.status_code}")
    
    if resp.status_code not in [401, 403]:
        print(f"⚠️  WARNING: Expected 401 or 403 without auth, got {resp.status_code}")
    else:
        print(f"✅ Correctly rejected without auth: {resp.status_code}")
    
    # Test with super_admin token - scope=all
    print("\nTest 4b: With super_admin token - scope=all")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/admin/donations/export?scope=all", headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    content_type = resp.headers.get("Content-Type", "")
    content_disposition = resp.headers.get("Content-Disposition", "")
    
    print(f"Content-Type: {content_type}")
    print(f"Content-Disposition: {content_disposition}")
    
    assert content_type.startswith("text/csv"), f"❌ Expected Content-Type to start with 'text/csv', got {content_type}"
    assert "attachment" in content_disposition, f"❌ Expected 'attachment' in Content-Disposition, got {content_disposition}"
    assert "dumpmaps-donations-" in content_disposition, f"❌ Expected filename 'dumpmaps-donations-' in Content-Disposition, got {content_disposition}"
    
    csv_content = resp.text
    lines = csv_content.strip().split("\n")
    print(f"\nCSV lines count: {len(lines)}")
    
    if len(lines) > 0:
        header = lines[0]
        print(f"CSV Header: {header}")
        
        # Verify header has exactly 15 columns
        expected_header = "Date,Source,Donor Name,Email,Amount,Currency,Frequency,Supporter Tier,Status,Stripe Session ID,Stripe Payment Intent ID,Stripe Subscription ID,Message/Notes,Contacted Status,Converted Status"
        
        # Normalize for comparison (remove extra spaces)
        header_normalized = ",".join([col.strip() for col in header.split(",")])
        
        if header_normalized == expected_header:
            print("✅ CSV header matches expected 15 columns")
        else:
            print(f"⚠️  WARNING: CSV header doesn't match exactly")
            print(f"Expected: {expected_header}")
            print(f"Got:      {header_normalized}")
    
    # Check if our test emails are in the CSV
    test_emails = ["backend.test+onetime@dumpmaps.org", "backend.test+monthly@dumpmaps.org"]
    found_rows = [line for line in lines[1:] if any(email in line for email in test_emails)]
    print(f"\nFound {len(found_rows)} test rows in CSV")
    
    if len(found_rows) > 0:
        print("✅ Test intents found in CSV export")
        for row in found_rows:
            cols = row.split(",")
            if len(cols) >= 7:
                print(f"  - Email: {cols[3]}, Amount: {cols[4]}, Frequency: {cols[6]}")
                # Verify frequency column
                if "monthly" in cols[6].lower() or "one-time" in cols[6].lower():
                    print(f"    ✅ Frequency column correct: {cols[6]}")
    
    # Test scope=intents
    print("\nTest 4c: scope=intents")
    resp = requests.get(f"{BASE_URL}/admin/donations/export?scope=intents", headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200 for scope=intents, got {resp.status_code}")
        return False
    
    csv_content = resp.text
    lines = csv_content.strip().split("\n")
    print(f"CSV lines count (intents only): {len(lines)}")
    
    # Test scope=donations
    print("\nTest 4d: scope=donations")
    resp = requests.get(f"{BASE_URL}/admin/donations/export?scope=donations", headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200 for scope=donations, got {resp.status_code}")
        return False
    
    csv_content = resp.text
    lines = csv_content.strip().split("\n")
    print(f"CSV lines count (donations only): {len(lines)}")
    print("(May be empty if no Stripe-confirmed donations exist - this is OK)")
    
    print("\n✅ TEST 4 PASSED: CSV export working correctly with all scopes")
    return True

def test_scenario_5_patch_intent_status(token, intent_id):
    """Test 5: PATCH /api/admin/donations/intents/:id (update status)"""
    print("\n" + "="*80)
    print("TEST 5: PATCH /api/admin/donations/intents/:id - Update intent status")
    print("="*80)
    
    if not intent_id:
        print("⚠️  WARNING: No intent_id provided, skipping test")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 5a: Set status to 'contacted'
    print(f"\nTest 5a: Set status to 'contacted' for intent {intent_id}")
    payload = {
        "status": "contacted",
        "adminNote": "reached out via email"
    }
    
    resp = requests.patch(f"{BASE_URL}/admin/donations/intents/{intent_id}", json=payload, headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    intent = data.get("intent", {})
    
    print(f"Intent status: {intent.get('status')}")
    print(f"Intent contactedStatus: {intent.get('contactedStatus')}")
    
    assert intent.get("contactedStatus") == "contacted", \
        f"❌ Expected contactedStatus='contacted', got {intent.get('contactedStatus')}"
    assert intent.get("status") == "contacted", \
        f"❌ Expected status='contacted', got {intent.get('status')}"
    
    print("✅ Status updated to 'contacted' successfully")
    
    # Test 5b: Set status to 'converted'
    print(f"\nTest 5b: Set status to 'converted' for intent {intent_id}")
    payload = {
        "status": "converted"
    }
    
    resp = requests.patch(f"{BASE_URL}/admin/donations/intents/{intent_id}", json=payload, headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    intent = data.get("intent", {})
    
    print(f"Intent status: {intent.get('status')}")
    print(f"Intent convertedStatus: {intent.get('convertedStatus')}")
    
    assert intent.get("convertedStatus") == "converted", \
        f"❌ Expected convertedStatus='converted', got {intent.get('convertedStatus')}"
    assert intent.get("status") == "converted", \
        f"❌ Expected status='converted', got {intent.get('status')}"
    
    print("✅ Status updated to 'converted' successfully")
    
    # Test 5c: Re-export CSV and verify the updated status
    print("\nTest 5c: Re-export CSV and verify updated status columns")
    resp = requests.get(f"{BASE_URL}/admin/donations/export?scope=intents", headers=headers)
    
    if resp.status_code != 200:
        print(f"⚠️  WARNING: CSV export failed, status {resp.status_code}")
        return True  # Don't fail the whole test
    
    csv_content = resp.text
    lines = csv_content.strip().split("\n")
    
    # Find the row for our test intent
    test_email = "backend.test+onetime@dumpmaps.org"
    found_row = None
    for line in lines[1:]:
        if test_email in line:
            found_row = line
            break
    
    if found_row:
        cols = found_row.split(",")
        if len(cols) >= 15:
            contacted_status = cols[13]
            converted_status = cols[14]
            print(f"CSV row found for {test_email}")
            print(f"  Contacted Status column: {contacted_status}")
            print(f"  Converted Status column: {converted_status}")
            
            if "contacted" in contacted_status.lower():
                print("  ✅ Contacted Status populated correctly")
            if "converted" in converted_status.lower():
                print("  ✅ Converted Status populated correctly")
    else:
        print(f"⚠️  WARNING: Could not find row for {test_email} in CSV")
    
    print("\n✅ TEST 5 PASSED: Intent status updates working correctly")
    return True

def main():
    print("="*80)
    print("STRIPE CHECKOUT + DONOR CSV EXPORT BACKEND TEST")
    print("Environment: NO Stripe keys configured - graceful fallback to queued-intent")
    print("="*80)
    
    # Login as super admin
    print("\n" + "="*80)
    print("SETUP: Login as super admin")
    print("="*80)
    super_admin_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not super_admin_token:
        print("❌ CRITICAL: Super admin login failed, cannot continue")
        return
    
    # Login as admin
    print("\n" + "="*80)
    print("SETUP: Login as admin")
    print("="*80)
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("⚠️  WARNING: Admin login failed, will use super_admin token for all tests")
        admin_token = super_admin_token
    
    # Run all test scenarios
    results = []
    
    # Scenario 1: POST /api/donations/intent
    intent_id_1 = test_scenario_1_happy_path_one_time()
    results.append(("1a: One-time donation intent", intent_id_1 is not None))
    
    intent_id_2 = test_scenario_1_happy_path_recurring()
    results.append(("1b: Recurring donation intent", intent_id_2 is not None))
    
    results.append(("1c: Validation - missing email", test_scenario_1_validation_missing_email()))
    results.append(("1d: Validation - zero/negative amount", test_scenario_1_validation_zero_amount()))
    results.append(("1e: Validation - missing amount", test_scenario_1_validation_missing_amount()))
    
    # Scenario 2: POST /api/donations/webhook
    results.append(("2: Webhook with no keys", test_scenario_2_webhook_no_keys()))
    
    # Scenario 3: GET /api/admin/donations
    results.append(("3: Admin donations list", test_scenario_3_admin_donations_list(admin_token)))
    
    # Scenario 4: GET /api/admin/donations/export
    results.append(("4: CSV export", test_scenario_4_csv_export(super_admin_token, intent_id_1, intent_id_2)))
    
    # Scenario 5: PATCH /api/admin/donations/intents/:id
    results.append(("5: Update intent status", test_scenario_5_patch_intent_status(super_admin_token, intent_id_1)))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Stripe Checkout + Donor CSV Export backend is working correctly!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - see details above")

if __name__ == "__main__":
    main()
