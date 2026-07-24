#!/usr/bin/env python3
"""
P0 STRIPE WEBHOOK + PAYMENT HEALTH FIX VERIFICATION

Tests the two critical bug fixes:
1. Stripe webhook now ALWAYS upserts a donation on checkout.session.completed
   (even when there's no matching donation_intent)
2. /admin/payment-health/test-connection now does a REAL Stripe SDK call
   (not sdk_not_wired)

Test environment:
- Base URL: http://localhost:3000
- DB: MongoDB via MONGO_URL env var
- Super admin: jamal@dumpmaps.org / @@Jefferson2180
"""

import requests
import json
import time
import hmac
import hashlib
from pymongo import MongoClient
import os

BASE_URL = "http://localhost:3000"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "dumpmaps")

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

# Test data tracking
test_donations = []
test_webhook_events = []
test_donation_intents = []

def get_db():
    """Get MongoDB connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def cleanup_test_data():
    """Delete all test data created during tests"""
    print("\n🧹 Cleaning up test data...")
    db = get_db()
    
    # Delete test donations
    if test_donations:
        result = db.donations.delete_many({"stripeCheckoutSessionId": {"$in": test_donations}})
        print(f"   Deleted {result.deleted_count} test donations")
    
    # Delete test webhook events
    if test_webhook_events:
        result = db.stripe_webhook_events.delete_many({"eventId": {"$in": test_webhook_events}})
        print(f"   Deleted {result.deleted_count} test webhook events")
    
    # Delete test donation intents
    if test_donation_intents:
        result = db.donation_intents.delete_many({"id": {"$in": test_donation_intents}})
        print(f"   Deleted {result.deleted_count} test donation intents")
    
    print("✅ Cleanup complete\n")

def generate_stripe_signature(payload_str, secret):
    """
    Generate a valid Stripe webhook signature using the same algorithm Stripe uses.
    This allows us to test webhook signature verification without hitting Stripe's API.
    """
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{payload_str}"
    signature = hmac.new(
        secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"

def test_1_webhook_security_gates():
    """TEST 1 — Webhook security gates (no Stripe key needed)"""
    print("\n" + "="*80)
    print("TEST 1 — Webhook security gates")
    print("="*80)
    
    try:
        # Test 1a: GET should return 405 (POST-only route)
        print("\n1a. Testing GET /api/stripe/webhook (should be 405)...")
        resp = requests.get(f"{BASE_URL}/api/stripe/webhook")
        if resp.status_code == 405:
            print(f"   ✅ PASS: GET rejected with 405")
        else:
            print(f"   ❌ FAIL: Expected 405, got {resp.status_code}")
            return False
        
        # Test 1b: POST with no headers should return 400
        print("\n1b. Testing POST with no Stripe-Signature header (should be 400)...")
        resp = requests.post(f"{BASE_URL}/api/stripe/webhook", json={})
        if resp.status_code == 400 and "Missing Stripe-Signature" in resp.text:
            print(f"   ✅ PASS: Missing signature rejected with 400")
        else:
            print(f"   ❌ FAIL: Expected 400 with 'Missing Stripe-Signature', got {resp.status_code}: {resp.text}")
            return False
        
        # Test 1c: POST with bogus signature but no Stripe configured should return 503
        print("\n1c. Testing POST with bogus signature, no Stripe configured (should be 503)...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={"Stripe-Signature": "bogus"},
            json={}
        )
        if resp.status_code == 503 and "Stripe not configured" in resp.text:
            print(f"   ✅ PASS: No Stripe config rejected with 503")
        else:
            print(f"   ❌ FAIL: Expected 503 with 'Stripe not configured', got {resp.status_code}: {resp.text}")
            return False
        
        print("\n✅ TEST 1 PASSED: All security gates working correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_2_configure_stripe_in_db():
    """TEST 2 — Configure Stripe in DB (so the rest of the tests can simulate real webhooks)"""
    print("\n" + "="*80)
    print("TEST 2 — Configure Stripe in DB")
    print("="*80)
    
    try:
        db = get_db()
        
        # Use fake-but-correctly-prefixed keys for testing
        test_config = {
            "id": "singleton",
            "stripeSecretKey": "sk_test_FAKE_DO_NOT_USE_FOR_REAL_CALLS",
            "stripePublishableKey": "pk_test_FAKE",
            "stripeWebhookSecret": "whsec_test_FAKE_SECRET_FOR_LOCAL_SIGNING"
        }
        
        print("\n2a. Seeding payment_settings with test keys...")
        result = db.payment_settings.update_one(
            {"id": "singleton"},
            {"$set": test_config},
            upsert=True
        )
        print(f"   ✅ Payment settings configured (matched: {result.matched_count}, modified: {result.modified_count}, upserted: {result.upserted_id})")
        
        # Verify it was saved
        print("\n2b. Verifying payment_settings...")
        settings = db.payment_settings.find_one({"id": "singleton"})
        if settings and settings.get("stripeWebhookSecret") == test_config["stripeWebhookSecret"]:
            print(f"   ✅ PASS: Payment settings verified in DB")
        else:
            print(f"   ❌ FAIL: Payment settings not found or incorrect")
            return False
        
        print("\n✅ TEST 2 PASSED: Stripe configured in DB")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_3_webhook_records_donation_on_checkout_completed():
    """TEST 3 — /api/stripe/webhook correctly records a donation on checkout.session.completed"""
    print("\n" + "="*80)
    print("TEST 3 — Webhook records donation on checkout.session.completed")
    print("="*80)
    
    try:
        db = get_db()
        settings = db.payment_settings.find_one({"id": "singleton"})
        webhook_secret = settings["stripeWebhookSecret"]
        
        # Build a synthetic checkout.session.completed event
        session_id = f"cs_test_session_{int(time.time())}_AAA"
        event_id = f"evt_test_{int(time.time())}_AAA"
        
        event = {
            "id": event_id,
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {
                "object": {
                    "id": session_id,
                    "object": "checkout.session",
                    "mode": "payment",
                    "status": "complete",
                    "amount_total": 500,  # $5.00
                    "currency": "usd",
                    "customer_email": "donor@example.com",
                    "customer_details": {
                        "email": "donor@example.com",
                        "name": "Test Donor"
                    },
                    "payment_intent": "pi_test_AAA",
                    "customer": "cus_test_AAA",
                    "metadata": {},
                    "client_reference_id": None,
                }
            }
        }
        
        payload_str = json.dumps(event)
        signature = generate_stripe_signature(payload_str, webhook_secret)
        
        print(f"\n3a. Posting checkout.session.completed event (session: {session_id})...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={
                "Stripe-Signature": signature,
                "Content-Type": "application/json"
            },
            data=payload_str
        )
        
        if resp.status_code == 200 and "Webhook received" in resp.text:
            print(f"   ✅ PASS: Webhook accepted (200)")
        else:
            print(f"   ❌ FAIL: Expected 200 with 'Webhook received', got {resp.status_code}: {resp.text}")
            return False
        
        # Track for cleanup
        test_donations.append(session_id)
        test_webhook_events.append(event_id)
        
        # Verify donation was created
        print("\n3b. Verifying donation was created in DB...")
        time.sleep(0.5)  # Give DB a moment
        donation = db.donations.find_one({"stripeCheckoutSessionId": session_id})
        
        if not donation:
            print(f"   ❌ FAIL: Donation not found in DB")
            return False
        
        # Verify all fields
        checks = [
            ("amount", 5, donation.get("amount")),
            ("email", "donor@example.com", donation.get("email")),
            ("status", "succeeded", donation.get("status")),
            ("provider", "stripe", donation.get("provider")),
            ("stripePaymentIntentId", "pi_test_AAA", donation.get("stripePaymentIntentId")),
            ("stripeCheckoutSessionId", session_id, donation.get("stripeCheckoutSessionId")),
            ("livemode", False, donation.get("livemode")),
            ("currency", "usd", donation.get("currency")),
        ]
        
        all_good = True
        for field, expected, actual in checks:
            if actual == expected:
                print(f"   ✅ {field}: {actual}")
            else:
                print(f"   ❌ {field}: expected {expected}, got {actual}")
                all_good = False
        
        if donation.get("id") and donation.get("createdAt"):
            print(f"   ✅ id: {donation['id']}")
            print(f"   ✅ createdAt: {donation['createdAt']}")
        else:
            print(f"   ❌ Missing id or createdAt")
            all_good = False
        
        # Verify webhook event was logged
        print("\n3c. Verifying webhook event was logged...")
        webhook_event = db.stripe_webhook_events.find_one({"eventId": event_id})
        
        if not webhook_event:
            print(f"   ❌ FAIL: Webhook event not found in DB")
            return False
        
        if webhook_event.get("status") == "processed" and webhook_event.get("type") == "checkout.session.completed":
            print(f"   ✅ Webhook event logged: status={webhook_event['status']}, type={webhook_event['type']}")
        else:
            print(f"   ❌ Webhook event incorrect: status={webhook_event.get('status')}, type={webhook_event.get('type')}")
            all_good = False
        
        if all_good:
            print("\n✅ TEST 3 PASSED: Donation recorded correctly from checkout.session.completed")
            return True
        else:
            print("\n❌ TEST 3 FAILED: Some fields incorrect")
            return False
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_4_idempotency_replay_same_event():
    """TEST 4 — Idempotency: replay same event → no duplicate donation"""
    print("\n" + "="*80)
    print("TEST 4 — Idempotency: replay same event")
    print("="*80)
    
    try:
        db = get_db()
        settings = db.payment_settings.find_one({"id": "singleton"})
        webhook_secret = settings["stripeWebhookSecret"]
        
        # Use the same session ID from test 3
        session_id = test_donations[0] if test_donations else f"cs_test_session_{int(time.time())}_AAA"
        event_id = test_webhook_events[0] if test_webhook_events else f"evt_test_{int(time.time())}_AAA"
        
        # Count donations before replay
        count_before = db.donations.count_documents({"stripeCheckoutSessionId": session_id})
        print(f"\n4a. Donations before replay: {count_before}")
        
        # Replay the EXACT same event
        event = {
            "id": event_id,
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {
                "object": {
                    "id": session_id,
                    "object": "checkout.session",
                    "mode": "payment",
                    "status": "complete",
                    "amount_total": 500,
                    "currency": "usd",
                    "customer_email": "donor@example.com",
                    "customer_details": {
                        "email": "donor@example.com",
                        "name": "Test Donor"
                    },
                    "payment_intent": "pi_test_AAA",
                    "customer": "cus_test_AAA",
                    "metadata": {},
                    "client_reference_id": None,
                }
            }
        }
        
        payload_str = json.dumps(event)
        signature = generate_stripe_signature(payload_str, webhook_secret)
        
        print(f"\n4b. Replaying event {event_id}...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={
                "Stripe-Signature": signature,
                "Content-Type": "application/json"
            },
            data=payload_str
        )
        
        if resp.status_code == 200:
            print(f"   ✅ PASS: Webhook accepted (200)")
        else:
            print(f"   ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        # Count donations after replay
        time.sleep(0.5)
        count_after = db.donations.count_documents({"stripeCheckoutSessionId": session_id})
        print(f"\n4c. Donations after replay: {count_after}")
        
        if count_after == count_before == 1:
            print(f"   ✅ PASS: No duplicate donation created (still 1)")
            print("\n✅ TEST 4 PASSED: Idempotency working correctly")
            return True
        else:
            print(f"   ❌ FAIL: Expected 1 donation, got {count_after}")
            return False
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_5_donation_with_intent():
    """TEST 5 — Donation also records when a donation_intent DOES exist (regression check)"""
    print("\n" + "="*80)
    print("TEST 5 — Donation records when donation_intent exists")
    print("="*80)
    
    try:
        db = get_db()
        settings = db.payment_settings.find_one({"id": "singleton"})
        webhook_secret = settings["stripeWebhookSecret"]
        
        # Create a donation_intent first
        intent_id = f"intent_test_{int(time.time())}_BBB"
        intent_doc = {
            "id": intent_id,
            "email": "donor2@example.com",
            "amount": 25,
            "currency": "usd",
            "status": "pending",
            "tier": "pro_supporter",
            "createdAt": time.time()
        }
        
        print(f"\n5a. Creating donation_intent: {intent_id}...")
        db.donation_intents.insert_one(intent_doc)
        test_donation_intents.append(intent_id)
        print(f"   ✅ Donation intent created")
        
        # Build checkout.session.completed event with metadata.donation_intent_id
        session_id = f"cs_test_session_{int(time.time())}_BBB"
        event_id = f"evt_test_{int(time.time())}_BBB"
        
        event = {
            "id": event_id,
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {
                "object": {
                    "id": session_id,
                    "object": "checkout.session",
                    "mode": "payment",
                    "status": "complete",
                    "amount_total": 2500,  # $25.00
                    "currency": "usd",
                    "customer_email": "donor2@example.com",
                    "customer_details": {
                        "email": "donor2@example.com",
                        "name": "Test Donor 2"
                    },
                    "payment_intent": "pi_test_BBB",
                    "customer": "cus_test_BBB",
                    "metadata": {
                        "donation_intent_id": intent_id
                    },
                    "client_reference_id": None,
                }
            }
        }
        
        payload_str = json.dumps(event)
        signature = generate_stripe_signature(payload_str, webhook_secret)
        
        print(f"\n5b. Posting checkout.session.completed with donation_intent_id...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={
                "Stripe-Signature": signature,
                "Content-Type": "application/json"
            },
            data=payload_str
        )
        
        if resp.status_code == 200:
            print(f"   ✅ PASS: Webhook accepted (200)")
        else:
            print(f"   ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        # Track for cleanup
        test_donations.append(session_id)
        test_webhook_events.append(event_id)
        
        # Verify donation was created with correct fields
        print("\n5c. Verifying donation was created...")
        time.sleep(0.5)
        donation = db.donations.find_one({"stripeCheckoutSessionId": session_id})
        
        if not donation:
            print(f"   ❌ FAIL: Donation not found")
            return False
        
        checks = [
            ("amount", 25, donation.get("amount")),
            ("email", "donor2@example.com", donation.get("email")),
            ("donationIntentId", intent_id, donation.get("donationIntentId")),
            ("tier", "pro_supporter", donation.get("tier")),
        ]
        
        all_good = True
        for field, expected, actual in checks:
            if actual == expected:
                print(f"   ✅ {field}: {actual}")
            else:
                print(f"   ❌ {field}: expected {expected}, got {actual}")
                all_good = False
        
        # Verify donation_intent was updated
        print("\n5d. Verifying donation_intent was updated...")
        updated_intent = db.donation_intents.find_one({"id": intent_id})
        
        if not updated_intent:
            print(f"   ❌ FAIL: Donation intent not found")
            return False
        
        intent_checks = [
            ("status", "succeeded", updated_intent.get("status")),
            ("convertedStatus", "paid", updated_intent.get("convertedStatus")),
        ]
        
        for field, expected, actual in intent_checks:
            if actual == expected:
                print(f"   ✅ {field}: {actual}")
            else:
                print(f"   ❌ {field}: expected {expected}, got {actual}")
                all_good = False
        
        if updated_intent.get("convertedAt"):
            print(f"   ✅ convertedAt: {updated_intent['convertedAt']}")
        else:
            print(f"   ❌ Missing convertedAt")
            all_good = False
        
        if all_good:
            print("\n✅ TEST 5 PASSED: Donation with intent recorded correctly")
            return True
        else:
            print("\n❌ TEST 5 FAILED: Some fields incorrect")
            return False
        
    except Exception as e:
        print(f"\n❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_6_admin_payment_health_reflects_donations():
    """TEST 6 — Admin Payment Health dashboard reflects new donations"""
    print("\n" + "="*80)
    print("TEST 6 — Admin Payment Health reflects donations")
    print("="*80)
    
    try:
        # Login as super admin
        print("\n6a. Logging in as super admin...")
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Login failed: {resp.status_code}: {resp.text}")
            return False
        
        token = resp.json().get("token")
        print(f"   ✅ Logged in successfully")
        
        # Get payment health
        print("\n6b. Getting payment health...")
        resp = requests.get(
            f"{BASE_URL}/api/admin/payment-health",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Payment health request failed: {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        print(f"   ✅ Payment health retrieved")
        
        # Verify donations section
        print("\n6c. Verifying donations section...")
        donations = data.get("donations", {})
        
        lifetime_count = donations.get("lifetimeCount", 0)
        lifetime_amount = donations.get("lifetimeAmount", 0)
        last_donation = donations.get("lastDonation")
        
        print(f"   Lifetime count: {lifetime_count}")
        print(f"   Lifetime amount: ${lifetime_amount}")
        
        if lifetime_count >= 2:
            print(f"   ✅ PASS: lifetimeCount >= 2 ({lifetime_count})")
        else:
            print(f"   ❌ FAIL: Expected lifetimeCount >= 2, got {lifetime_count}")
            return False
        
        if lifetime_amount >= 30:
            print(f"   ✅ PASS: lifetimeAmount >= $30 (${lifetime_amount})")
        else:
            print(f"   ❌ FAIL: Expected lifetimeAmount >= $30, got ${lifetime_amount}")
            return False
        
        if last_donation and last_donation.get("amount") and last_donation.get("email") and last_donation.get("createdAt"):
            print(f"   ✅ PASS: lastDonation populated: ${last_donation['amount']} from {last_donation['email']}")
        else:
            print(f"   ❌ FAIL: lastDonation not properly populated: {last_donation}")
            return False
        
        # Verify webhooks section
        print("\n6d. Verifying webhooks section...")
        webhooks = data.get("webhooks", {})
        
        last_received_at = webhooks.get("lastReceivedAt")
        last_received_type = webhooks.get("lastReceivedType")
        
        if last_received_at:
            print(f"   ✅ PASS: lastReceivedAt: {last_received_at}")
        else:
            print(f"   ❌ FAIL: lastReceivedAt not set")
            return False
        
        if last_received_type:
            print(f"   ✅ PASS: lastReceivedType: {last_received_type}")
        else:
            print(f"   ❌ FAIL: lastReceivedType not set")
            return False
        
        print("\n✅ TEST 6 PASSED: Payment health reflects donations correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_7_admin_donations_list():
    """TEST 7 — /api/admin/donations lists the new donations"""
    print("\n" + "="*80)
    print("TEST 7 — Admin donations list")
    print("="*80)
    
    try:
        # Login as super admin
        print("\n7a. Logging in as super admin...")
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Login failed: {resp.status_code}: {resp.text}")
            return False
        
        token = resp.json().get("token")
        print(f"   ✅ Logged in successfully")
        
        # Get donations list
        print("\n7b. Getting donations list...")
        resp = requests.get(
            f"{BASE_URL}/api/admin/donations",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Donations list request failed: {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        donations = data.get("donations", [])
        print(f"   ✅ Retrieved {len(donations)} donations")
        
        # Check if our test donations are in the list
        print("\n7c. Verifying test donations are in the list...")
        test_session_ids = [sid for sid in test_donations if sid.startswith("cs_test_session_")]
        
        found_donations = [d for d in donations if d.get("stripeCheckoutSessionId") in test_session_ids]
        
        if len(found_donations) >= 2:
            print(f"   ✅ PASS: Found {len(found_donations)} test donations in list")
            for d in found_donations:
                print(f"      - ${d.get('amount')} from {d.get('email')} ({d.get('stripeCheckoutSessionId')})")
        else:
            print(f"   ❌ FAIL: Expected at least 2 test donations, found {len(found_donations)}")
            return False
        
        print("\n✅ TEST 7 PASSED: Donations list contains test donations")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 7 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_8_payment_health_test_connection():
    """TEST 8 — /admin/payment-health/test-connection now does a real Stripe SDK call"""
    print("\n" + "="*80)
    print("TEST 8 — Payment health test-connection (real Stripe SDK call)")
    print("="*80)
    
    try:
        # Login as super admin
        print("\n8a. Logging in as super admin...")
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Login failed: {resp.status_code}: {resp.text}")
            return False
        
        token = resp.json().get("token")
        print(f"   ✅ Logged in successfully")
        
        # Test connection with fake keys (will fail but should NOT return sdk_not_wired)
        print("\n8b. Testing connection with fake keys...")
        resp = requests.post(
            f"{BASE_URL}/api/admin/payment-health/test-connection",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"   ❌ FAIL: Test connection request failed: {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        print(f"   ✅ Test connection response received")
        
        # Verify response structure
        print("\n8c. Verifying response structure...")
        
        ok = data.get("ok")
        status = data.get("status")
        message = data.get("message", "")
        error_code = data.get("errorCode")
        
        print(f"   ok: {ok}")
        print(f"   status: {status}")
        print(f"   message: {message}")
        print(f"   errorCode: {error_code}")
        
        # The key thing: status MUST NOT be sdk_not_wired
        if status == "sdk_not_wired":
            print(f"   ❌ FAIL: Status is still 'sdk_not_wired' - SDK not being called!")
            return False
        else:
            print(f"   ✅ PASS: Status is NOT 'sdk_not_wired' (got '{status}')")
        
        # With fake keys, we expect stripe_error
        if status == "stripe_error":
            print(f"   ✅ PASS: Status is 'stripe_error' (expected with fake keys)")
        else:
            print(f"   ⚠️  WARNING: Expected 'stripe_error' with fake keys, got '{status}'")
        
        # Should have ok: false
        if ok == False:
            print(f"   ✅ PASS: ok is false (expected with fake keys)")
        else:
            print(f"   ⚠️  WARNING: Expected ok=false with fake keys, got {ok}")
        
        # Should have an error message
        if message and len(message) > 0:
            print(f"   ✅ PASS: Error message present: {message[:100]}...")
        else:
            print(f"   ❌ FAIL: No error message")
            return False
        
        # Should have an error code
        if error_code:
            print(f"   ✅ PASS: Error code present: {error_code}")
        else:
            print(f"   ⚠️  WARNING: No error code (expected with Stripe SDK errors)")
        
        print("\n✅ TEST 8 PASSED: Real Stripe SDK call confirmed (not sdk_not_wired)")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 8 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_9_checkout_session_expired():
    """TEST 9 — checkout.session.expired correctly handled"""
    print("\n" + "="*80)
    print("TEST 9 — checkout.session.expired handling")
    print("="*80)
    
    try:
        db = get_db()
        settings = db.payment_settings.find_one({"id": "singleton"})
        webhook_secret = settings["stripeWebhookSecret"]
        
        # Build checkout.session.expired event
        session_id = f"cs_test_session_{int(time.time())}_EXPIRED"
        event_id = f"evt_test_{int(time.time())}_EXPIRED"
        
        event = {
            "id": event_id,
            "type": "checkout.session.expired",
            "livemode": False,
            "data": {
                "object": {
                    "id": session_id,
                    "object": "checkout.session",
                    "mode": "payment",
                    "status": "expired",
                }
            }
        }
        
        payload_str = json.dumps(event)
        signature = generate_stripe_signature(payload_str, webhook_secret)
        
        print(f"\n9a. Posting checkout.session.expired event...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={
                "Stripe-Signature": signature,
                "Content-Type": "application/json"
            },
            data=payload_str
        )
        
        if resp.status_code == 200:
            print(f"   ✅ PASS: Webhook accepted (200)")
        else:
            print(f"   ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            return False
        
        # Track for cleanup
        test_webhook_events.append(event_id)
        
        # Verify webhook event was logged
        print("\n9b. Verifying webhook event was logged...")
        time.sleep(0.5)
        webhook_event = db.stripe_webhook_events.find_one({"eventId": event_id})
        
        if not webhook_event:
            print(f"   ❌ FAIL: Webhook event not found")
            return False
        
        if webhook_event.get("status") == "processed":
            print(f"   ✅ PASS: Webhook event logged with status 'processed'")
        else:
            print(f"   ❌ FAIL: Expected status 'processed', got '{webhook_event.get('status')}'")
            return False
        
        print("\n✅ TEST 9 PASSED: checkout.session.expired handled correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 9 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_10_failed_signature_logged():
    """TEST 10 — Failed signature is logged in stripe_webhook_events"""
    print("\n" + "="*80)
    print("TEST 10 — Failed signature logging")
    print("="*80)
    
    try:
        db = get_db()
        
        # Build a valid event but with WRONG signature
        event = {
            "id": f"evt_test_{int(time.time())}_BADSIG",
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {
                "object": {
                    "id": f"cs_test_{int(time.time())}_BADSIG",
                    "object": "checkout.session",
                }
            }
        }
        
        payload_str = json.dumps(event)
        # Use a WRONG signature
        wrong_signature = "t=1234567890,v1=wrongsignaturehash"
        
        print(f"\n10a. Posting event with wrong signature...")
        resp = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            headers={
                "Stripe-Signature": wrong_signature,
                "Content-Type": "application/json"
            },
            data=payload_str
        )
        
        if resp.status_code == 400 and "Webhook Error" in resp.text:
            print(f"   ✅ PASS: Webhook rejected with 400 'Webhook Error'")
        else:
            print(f"   ❌ FAIL: Expected 400 with 'Webhook Error', got {resp.status_code}: {resp.text}")
            return False
        
        # Verify failed signature was logged
        print("\n10b. Verifying failed signature was logged...")
        time.sleep(0.5)
        
        # Find recent signature_verification_failed events
        failed_events = list(db.stripe_webhook_events.find({
            "type": "signature_verification_failed",
            "status": "failed"
        }).sort("receivedAt", -1).limit(5))
        
        if len(failed_events) > 0:
            latest = failed_events[0]
            print(f"   ✅ PASS: Found signature_verification_failed event")
            print(f"      type: {latest.get('type')}")
            print(f"      status: {latest.get('status')}")
            print(f"      receivedAt: {latest.get('receivedAt')}")
            print(f"      processingError: {latest.get('processingError')}")
        else:
            print(f"   ❌ FAIL: No signature_verification_failed event found")
            return False
        
        print("\n✅ TEST 10 PASSED: Failed signature logged correctly")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 10 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("P0 STRIPE WEBHOOK + PAYMENT HEALTH FIX VERIFICATION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print(f"Super Admin: {SUPER_ADMIN_EMAIL}")
    
    results = []
    
    try:
        # Run all tests in order
        results.append(("TEST 1: Webhook security gates", test_1_webhook_security_gates()))
        results.append(("TEST 2: Configure Stripe in DB", test_2_configure_stripe_in_db()))
        results.append(("TEST 3: Webhook records donation", test_3_webhook_records_donation_on_checkout_completed()))
        results.append(("TEST 4: Idempotency", test_4_idempotency_replay_same_event()))
        results.append(("TEST 5: Donation with intent", test_5_donation_with_intent()))
        results.append(("TEST 6: Payment health reflects donations", test_6_admin_payment_health_reflects_donations()))
        results.append(("TEST 7: Admin donations list", test_7_admin_donations_list()))
        results.append(("TEST 8: Payment health test-connection", test_8_payment_health_test_connection()))
        results.append(("TEST 9: checkout.session.expired", test_9_checkout_session_expired()))
        results.append(("TEST 10: Failed signature logged", test_10_failed_signature_logged()))
        
    finally:
        # Always cleanup
        cleanup_test_data()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Both fixes verified:")
        print("   1. Webhook ALWAYS upserts donation on checkout.session.completed")
        print("   2. Payment health test-connection does REAL Stripe SDK call")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
