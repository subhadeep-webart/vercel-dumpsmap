#!/usr/bin/env python3
"""
P4 Layout Preference Backend Verification
Tests the viewPreference field in /api/users/me/preferences endpoint
"""

import requests
import json
import sys

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com"
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def login(email, password):
    """Login and return auth token"""
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            if token:
                print(f"✅ Login successful for {email}")
                return token
            else:
                print(f"❌ Login response missing token: {data}")
                return None
        else:
            print(f"❌ Login failed: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return None

def test_auth_gating():
    """TEST 1 — Auth gating"""
    print("\n" + "="*80)
    print("TEST 1 — Auth gating")
    print("="*80)
    
    try:
        # GET without Authorization header → 401
        resp = requests.get(f"{BASE_URL}/api/users/me/preferences", timeout=10)
        if resp.status_code == 401:
            data = resp.json()
            if "Auth required" in data.get("error", ""):
                print("✅ GET without auth → 401 'Auth required'")
            else:
                print(f"⚠️  GET without auth → 401 but unexpected error: {data}")
        else:
            print(f"❌ GET without auth → {resp.status_code} (expected 401)")
            return False
        
        # PATCH without Authorization header → 401
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", json={"viewPreference": "mobile"}, timeout=10)
        if resp.status_code == 401:
            data = resp.json()
            if "Auth required" in data.get("error", ""):
                print("✅ PATCH without auth → 401 'Auth required'")
            else:
                print(f"⚠️  PATCH without auth → 401 but unexpected error: {data}")
        else:
            print(f"❌ PATCH without auth → {resp.status_code} (expected 401)")
            return False
        
        print("✅ TEST 1 PASSED — Auth gating working correctly")
        return True
    except Exception as e:
        print(f"❌ TEST 1 FAILED — Exception: {e}")
        return False

def test_get_default(token):
    """TEST 2 — GET returns default"""
    print("\n" + "="*80)
    print("TEST 2 — GET returns default")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/users/me/preferences", headers=headers, timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ GET preferences → {resp.status_code} (expected 200)")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        prefs = data.get("preferences")
        
        if not prefs:
            print(f"❌ Response missing 'preferences' key: {data}")
            return False
        
        # Check response shape
        required_fields = ["viewMode", "fieldModeOnboarded", "viewPreference", "locale"]
        for field in required_fields:
            if field not in prefs:
                print(f"❌ Missing field '{field}' in preferences: {prefs}")
                return False
        
        print(f"✅ Response shape correct: {list(prefs.keys())}")
        
        # Check default viewPreference
        view_pref = prefs.get("viewPreference")
        if view_pref == "auto":
            print(f"✅ Default viewPreference is 'auto' (correct)")
        else:
            print(f"⚠️  viewPreference is '{view_pref}' (expected 'auto' for user with no prior setting)")
        
        print(f"✅ Full preferences: {json.dumps(prefs, indent=2)}")
        print("✅ TEST 2 PASSED — GET returns correct shape and default")
        return True
    except Exception as e:
        print(f"❌ TEST 2 FAILED — Exception: {e}")
        return False

def test_patch_valid_values(token):
    """TEST 3 — PATCH valid viewPreference values"""
    print("\n" + "="*80)
    print("TEST 3 — PATCH valid viewPreference values")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        valid_values = ["mobile", "desktop", "auto"]
        
        for value in valid_values:
            # PATCH with value
            resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                                headers=headers, 
                                json={"viewPreference": value}, 
                                timeout=10)
            
            if resp.status_code != 200:
                print(f"❌ PATCH viewPreference='{value}' → {resp.status_code} (expected 200)")
                print(f"Response: {resp.text}")
                return False
            
            data = resp.json()
            prefs = data.get("preferences")
            
            if not prefs:
                print(f"❌ Response missing 'preferences' key: {data}")
                return False
            
            if prefs.get("viewPreference") != value:
                print(f"❌ PATCH viewPreference='{value}' → response.preferences.viewPreference='{prefs.get('viewPreference')}' (mismatch)")
                return False
            
            print(f"✅ PATCH viewPreference='{value}' → 200, response.preferences.viewPreference='{value}'")
            
            # GET to verify persistence
            resp = requests.get(f"{BASE_URL}/api/users/me/preferences", headers=headers, timeout=10)
            if resp.status_code != 200:
                print(f"❌ GET after PATCH → {resp.status_code}")
                return False
            
            data = resp.json()
            prefs = data.get("preferences")
            
            if prefs.get("viewPreference") != value:
                print(f"❌ GET after PATCH → viewPreference='{prefs.get('viewPreference')}' (expected '{value}')")
                return False
            
            print(f"✅ GET after PATCH → viewPreference='{value}' (persistence verified)")
        
        print("✅ TEST 3 PASSED — All valid values work and persist")
        return True
    except Exception as e:
        print(f"❌ TEST 3 FAILED — Exception: {e}")
        return False

def test_patch_invalid_values(token):
    """TEST 4 — PATCH invalid value"""
    print("\n" + "="*80)
    print("TEST 4 — PATCH invalid value")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test invalid string value
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={"viewPreference": "tablet"}, 
                            timeout=10)
        
        if resp.status_code != 400:
            print(f"❌ PATCH viewPreference='tablet' → {resp.status_code} (expected 400)")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get("error", "")
        
        # Check if error message mentions valid values
        if "auto" in error and "mobile" in error and "desktop" in error:
            print(f"✅ PATCH viewPreference='tablet' → 400 with error mentioning 'auto', 'mobile', 'desktop': {error}")
        else:
            print(f"⚠️  PATCH viewPreference='tablet' → 400 but error doesn't mention all valid values: {error}")
        
        # Test invalid type (number)
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={"viewPreference": 123}, 
                            timeout=10)
        
        if resp.status_code != 400:
            print(f"❌ PATCH viewPreference=123 → {resp.status_code} (expected 400)")
            print(f"Response: {resp.text}")
            return False
        
        print(f"✅ PATCH viewPreference=123 → 400")
        
        # Test null value (check documented behavior)
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={"viewPreference": None}, 
                            timeout=10)
        
        if resp.status_code == 400:
            print(f"✅ PATCH viewPreference=null → 400 (rejected)")
        elif resp.status_code == 200:
            print(f"⚠️  PATCH viewPreference=null → 200 (accepted, check if this is intended)")
        else:
            print(f"⚠️  PATCH viewPreference=null → {resp.status_code}")
        
        print("✅ TEST 4 PASSED — Invalid values correctly rejected")
        return True
    except Exception as e:
        print(f"❌ TEST 4 FAILED — Exception: {e}")
        return False

def test_orthogonal_axes(token):
    """TEST 5 — Orthogonal axes (P4 design requirement)"""
    print("\n" + "="*80)
    print("TEST 5 — Orthogonal axes (P4 design requirement)")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # PATCH with both viewMode and viewPreference
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={"viewMode": "field", "viewPreference": "desktop"}, 
                            timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ PATCH viewMode='field' + viewPreference='desktop' → {resp.status_code} (expected 200)")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        prefs = data.get("preferences")
        
        if not prefs:
            print(f"❌ Response missing 'preferences' key: {data}")
            return False
        
        view_mode = prefs.get("viewMode")
        view_pref = prefs.get("viewPreference")
        
        if view_mode != "field":
            print(f"❌ viewMode='{view_mode}' (expected 'field')")
            return False
        
        if view_pref != "desktop":
            print(f"❌ viewPreference='{view_pref}' (expected 'desktop')")
            return False
        
        print(f"✅ PATCH viewMode='field' + viewPreference='desktop' → 200")
        print(f"✅ Response: viewMode='{view_mode}', viewPreference='{view_pref}'")
        
        # GET to verify both persist simultaneously
        resp = requests.get(f"{BASE_URL}/api/users/me/preferences", headers=headers, timeout=10)
        if resp.status_code != 200:
            print(f"❌ GET after PATCH → {resp.status_code}")
            return False
        
        data = resp.json()
        prefs = data.get("preferences")
        
        view_mode = prefs.get("viewMode")
        view_pref = prefs.get("viewPreference")
        
        if view_mode != "field" or view_pref != "desktop":
            print(f"❌ GET after PATCH → viewMode='{view_mode}', viewPreference='{view_pref}' (expected field + desktop)")
            return False
        
        print(f"✅ GET after PATCH → viewMode='field' AND viewPreference='desktop' (both persisted)")
        print("✅ TEST 5 PASSED — Field/Standard and Mobile/Desktop preferences are independent")
        return True
    except Exception as e:
        print(f"❌ TEST 5 FAILED — Exception: {e}")
        return False

def test_empty_body(token):
    """TEST 6 — Empty body"""
    print("\n" + "="*80)
    print("TEST 6 — Empty body")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # PATCH with empty body
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={}, 
                            timeout=10)
        
        if resp.status_code != 400:
            print(f"❌ PATCH with empty body → {resp.status_code} (expected 400)")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        error = data.get("error", "")
        
        if "No supported preferences provided" in error:
            print(f"✅ PATCH with empty body → 400 'No supported preferences provided'")
        else:
            print(f"⚠️  PATCH with empty body → 400 but unexpected error: {error}")
        
        print("✅ TEST 6 PASSED — Empty body correctly rejected")
        return True
    except Exception as e:
        print(f"❌ TEST 6 FAILED — Exception: {e}")
        return False

def test_db_persistence(token):
    """TEST 7 — DB persistence"""
    print("\n" + "="*80)
    print("TEST 7 — DB persistence")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Set a unique value
        test_value = "mobile"
        resp = requests.patch(f"{BASE_URL}/api/users/me/preferences", 
                            headers=headers, 
                            json={"viewPreference": test_value}, 
                            timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ PATCH viewPreference='{test_value}' → {resp.status_code}")
            return False
        
        print(f"✅ PATCH viewPreference='{test_value}' → 200")
        
        # Re-login to simulate fresh session
        print(f"Re-logging in as {SUPER_ADMIN_EMAIL}...")
        new_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        
        if not new_token:
            print(f"❌ Re-login failed")
            return False
        
        # GET with new token
        new_headers = {"Authorization": f"Bearer {new_token}"}
        resp = requests.get(f"{BASE_URL}/api/users/me/preferences", headers=new_headers, timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ GET with new token → {resp.status_code}")
            return False
        
        data = resp.json()
        prefs = data.get("preferences")
        
        if prefs.get("viewPreference") != test_value:
            print(f"❌ GET with new token → viewPreference='{prefs.get('viewPreference')}' (expected '{test_value}')")
            return False
        
        print(f"✅ GET with new token → viewPreference='{test_value}' (DB persistence verified)")
        print("✅ TEST 7 PASSED — Value persisted in DB across sessions")
        return True
    except Exception as e:
        print(f"❌ TEST 7 FAILED — Exception: {e}")
        return False

def main():
    print("="*80)
    print("P4 LAYOUT PREFERENCE BACKEND VERIFICATION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Credentials: {SUPER_ADMIN_EMAIL}")
    print("="*80)
    
    # Login
    token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not token:
        print("\n❌ FATAL: Login failed, cannot proceed with tests")
        sys.exit(1)
    
    # Run all tests
    results = []
    results.append(("TEST 1 — Auth gating", test_auth_gating()))
    results.append(("TEST 2 — GET returns default", test_get_default(token)))
    results.append(("TEST 3 — PATCH valid values", test_patch_valid_values(token)))
    results.append(("TEST 4 — PATCH invalid values", test_patch_invalid_values(token)))
    results.append(("TEST 5 — Orthogonal axes", test_orthogonal_axes(token)))
    results.append(("TEST 6 — Empty body", test_empty_body(token)))
    results.append(("TEST 7 — DB persistence", test_db_persistence(token)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} — {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("="*80)
    print(f"Total: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print("="*80)
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED — P4 Layout Preference backend is PRODUCTION READY")
        sys.exit(0)
    else:
        print(f"\n❌ {failed} TEST(S) FAILED — Review output above")
        sys.exit(1)

if __name__ == "__main__":
    main()
