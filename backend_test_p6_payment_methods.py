#!/usr/bin/env python3
"""
P6 Payment Method Profiles Backend Test
Tests the Stripe SetupIntents flow API contract.

KNOWN: payment_settings.singleton has placeholder Stripe keys.
Live SetupIntent creation will fail with "Invalid API Key" — THIS IS EXPECTED.
We verify the API CONTRACT (auth, gating, routing, validation), NOT real Stripe round-trips.
"""

import requests
import json
import os

# Base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def print_test(num, desc):
    print(f"\n{'='*70}")
    print(f"TEST {num}: {desc}")
    print('='*70)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def login(email, password):
    """Login and return token"""
    resp = requests.post(f"{API_BASE}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        data = resp.json()
        return data.get('token')
    return None

def main():
    passed = 0
    total = 11
    
    print("\n" + "="*70)
    print("P6 PAYMENT METHOD PROFILES BACKEND TEST")
    print("="*70)
    
    # ========================================================================
    # TEST 1: GET /api/stripe/config (no auth) → 200, body should have publishableKey and mode
    # ========================================================================
    print_test(1, "GET /api/stripe/config (no auth) → 200 with publishableKey + mode, NO secret")
    try:
        resp = requests.get(f"{API_BASE}/stripe/config")
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 200:
            if 'publishableKey' in body and 'mode' in body:
                # Check that no secret key is exposed
                body_str = json.dumps(body).lower()
                if 'sk_' not in body_str and 'secret' not in body_str:
                    print_pass("Returns publishableKey + mode, no secret exposed")
                    passed += 1
                else:
                    print_fail("Response contains secret key or 'secret' field")
            else:
                print_fail("Missing publishableKey or mode in response")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 2: GET /api/users/me/payment-methods (no auth) → 401
    # ========================================================================
    print_test(2, "GET /api/users/me/payment-methods (no auth) → 401")
    try:
        resp = requests.get(f"{API_BASE}/users/me/payment-methods")
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 401 and 'error' in body:
            print_pass("Correctly returns 401 with error key")
            passed += 1
        else:
            print_fail(f"Expected 401 with error, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 3: Login as jamal@dumpmaps.org → get token
    # ========================================================================
    print_test(3, "Login as jamal@dumpmaps.org (super_admin)")
    try:
        token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        if token:
            print_pass(f"Login successful, token: {token[:20]}...")
            passed += 1
        else:
            print_fail("Login failed")
            print("Cannot continue without auth token. Exiting.")
            return
    except Exception as e:
        print_fail(f"Exception: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # ========================================================================
    # TEST 4: GET /api/users/me/payment-methods (auth=jamal) → 200 with paymentMethods array
    # ========================================================================
    print_test(4, "GET /api/users/me/payment-methods (auth=jamal) → 200 with paymentMethods array")
    try:
        resp = requests.get(f"{API_BASE}/users/me/payment-methods", headers=headers)
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 200 and 'paymentMethods' in body:
            print_pass("Returns 200 with paymentMethods array")
            passed += 1
        else:
            print_fail(f"Expected 200 with paymentMethods, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 5: POST /api/users/me/payment-methods/setup (no auth) → 401
    # ========================================================================
    print_test(5, "POST /api/users/me/payment-methods/setup (no auth) → 401")
    try:
        resp = requests.post(f"{API_BASE}/users/me/payment-methods/setup", json={})
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 401:
            print_pass("Correctly returns 401")
            passed += 1
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 6: POST /api/users/me/payment-methods/setup (auth=jamal) → 200 OR 500 with "Invalid API Key"
    # ========================================================================
    print_test(6, "POST /api/users/me/payment-methods/setup (auth=jamal) → 200 OR 500 with 'Invalid API Key'")
    try:
        resp = requests.post(f"{API_BASE}/users/me/payment-methods/setup", headers=headers, json={})
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        # Either 200 with clientSecret, setupIntentId, customerId, publishableKey, mode
        # OR 500 with error and detail containing "Invalid API Key"
        if resp.status_code == 200:
            required_keys = ['clientSecret', 'setupIntentId', 'customerId', 'publishableKey', 'mode']
            if all(k in body for k in required_keys):
                print_pass("Returns 200 with all required keys (clientSecret, setupIntentId, customerId, publishableKey, mode)")
                passed += 1
            else:
                print_fail(f"200 but missing keys. Expected: {required_keys}, got: {list(body.keys())}")
        elif resp.status_code == 500:
            if 'error' in body and 'detail' in body and 'Invalid API Key' in body['detail']:
                print_pass("Returns 500 with 'Invalid API Key' in detail (expected with placeholder keys)")
                passed += 1
            else:
                print_fail("500 but missing 'Invalid API Key' in detail")
        elif resp.status_code == 404:
            print_fail("404 - route missing (handler not registered)")
        elif resp.status_code == 401:
            print_fail("401 - auth lost (should not happen)")
        else:
            print_fail(f"Unexpected status {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 7: POST /api/users/me/payment-methods (auth=jamal) with empty body → 400 "paymentMethodId is required"
    # ========================================================================
    print_test(7, "POST /api/users/me/payment-methods (auth=jamal, body={}) → 400 'paymentMethodId is required'")
    try:
        resp = requests.post(f"{API_BASE}/users/me/payment-methods", headers=headers, json={})
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 400 and 'paymentMethodId is required' in body.get('error', ''):
            print_pass("Correctly returns 400 'paymentMethodId is required'")
            passed += 1
        else:
            print_fail(f"Expected 400 with 'paymentMethodId is required', got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 8: POST /api/users/me/payment-methods (auth=jamal) with invalid paymentMethodId → 400
    # ========================================================================
    print_test(8, "POST /api/users/me/payment-methods (auth=jamal, paymentMethodId='not_a_pm') → 400")
    try:
        resp = requests.post(f"{API_BASE}/users/me/payment-methods", headers=headers, json={"paymentMethodId": "not_a_pm"})
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 400 and 'paymentMethodId is required' in body.get('error', ''):
            print_pass("Correctly validates pm_ prefix and returns 400")
            passed += 1
        else:
            print_fail(f"Expected 400 with 'paymentMethodId is required', got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 9: PATCH /api/users/me/payment-methods/nonexistent-id/default (auth=jamal) → 404
    # ========================================================================
    print_test(9, "PATCH /api/users/me/payment-methods/nonexistent-id/default (auth=jamal) → 404")
    try:
        resp = requests.patch(f"{API_BASE}/users/me/payment-methods/nonexistent-id/default", headers=headers)
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 404 and 'Payment method not found' in body.get('error', ''):
            print_pass("Correctly returns 404 'Payment method not found'")
            passed += 1
        else:
            print_fail(f"Expected 404 with 'Payment method not found', got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 10: DELETE /api/users/me/payment-methods/nonexistent-id (auth=jamal) → 404
    # ========================================================================
    print_test(10, "DELETE /api/users/me/payment-methods/nonexistent-id (auth=jamal) → 404")
    try:
        resp = requests.delete(f"{API_BASE}/users/me/payment-methods/nonexistent-id", headers=headers)
        print(f"Status: {resp.status_code}")
        body = resp.json()
        print(f"Body: {json.dumps(body, indent=2)}")
        
        if resp.status_code == 404 and 'Payment method not found' in body.get('error', ''):
            print_pass("Correctly returns 404 'Payment method not found'")
            passed += 1
        else:
            print_fail(f"Expected 404 with 'Payment method not found', got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # TEST 11: Confirm paymentMethods feature in GET /api/admin/feature-flags
    # ========================================================================
    print_test(11, "GET /api/admin/feature-flags (auth=jamal) → paymentMethods feature present")
    try:
        resp = requests.get(f"{API_BASE}/admin/feature-flags", headers=headers)
        print(f"Status: {resp.status_code}")
        body = resp.json()
        
        if resp.status_code == 200:
            flags = body.get('flags', [])
            payment_methods_flag = next((f for f in flags if f.get('key') == 'paymentMethods'), None)
            
            if payment_methods_flag:
                print(f"paymentMethods flag: {json.dumps(payment_methods_flag, indent=2)}")
                if (payment_methods_flag.get('globalStatus') == 'live' and 
                    payment_methods_flag.get('requiredMembershipTier') == 'free'):
                    print_pass("paymentMethods feature present with globalStatus='live', requiredMembershipTier='free'")
                    passed += 1
                else:
                    print_fail(f"paymentMethods feature found but wrong config: globalStatus={payment_methods_flag.get('globalStatus')}, requiredMembershipTier={payment_methods_flag.get('requiredMembershipTier')}")
            else:
                print_fail("paymentMethods feature not found in flags")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*70)
    print(f"SUMMARY: {passed}/{total} tests passed")
    print("="*70)
    
    if passed == total:
        print("✅ ALL TESTS PASSED - P6 Payment Method Profiles backend is working correctly")
    else:
        print(f"❌ {total - passed} test(s) failed")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
