#!/usr/bin/env python3
"""
Backend test for profilePhotoUrl ↔ avatarUrl mirroring feature
Tests the new canonical profilePhotoUrl field and its automatic mirroring with legacy avatarUrl
"""

import requests
import json
import sys

# Backend URL from .env
BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials (super admin)
ADMIN_EMAIL = "jamal@dumpmaps.org"
ADMIN_PASSWORD = "@@Jefferson2180"

def log_test(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def log_pass(message):
    print(f"✅ PASS: {message}")

def log_fail(message):
    print(f"❌ FAIL: {message}")

def log_info(message):
    print(f"ℹ️  INFO: {message}")

def main():
    print("\n" + "="*80)
    print("PROFILE PHOTO MIRRORING TEST - profilePhotoUrl ↔ avatarUrl")
    print("="*80)
    
    token = None
    test_results = []
    original_photo = None
    
    # =========================================================================
    # SETUP: Login and get original photo value
    # =========================================================================
    log_test("SETUP", "Login and capture original photo values")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            log_pass(f"Login successful. Token received.")
            
            # Get current profile to save original photo
            headers = {"Authorization": f"Bearer {token}"}
            resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
            if resp2.status_code == 200:
                user = resp2.json().get("user", {})
                original_photo = user.get("profilePhotoUrl") or user.get("avatarUrl") or ""
                log_info(f"Original photo value: {original_photo if original_photo else '(empty)'}")
        else:
            log_fail(f"Login failed: {resp.status_code}")
            return
    except Exception as e:
        log_fail(f"Setup failed: {e}")
        return
    
    if not token:
        log_fail("Cannot proceed without token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # =========================================================================
    # TEST 1: Canonical write (profilePhotoUrl only) - should mirror to avatarUrl
    # =========================================================================
    log_test(1, "PATCH with profilePhotoUrl only - verify auto-mirror to avatarUrl")
    try:
        test_url = "/api/files/test-canonical.jpg"
        resp = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
            "profilePhotoUrl": test_url
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            profile_photo = user.get("profilePhotoUrl")
            avatar_url = user.get("avatarUrl")
            
            log_info(f"Response: profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
            
            if profile_photo == test_url and avatar_url == test_url:
                log_pass(f"✅ Both fields mirrored correctly: {test_url}")
                
                # Verify persistence with GET
                resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    user2 = resp2.json().get("user", {})
                    if user2.get("profilePhotoUrl") == test_url and user2.get("avatarUrl") == test_url:
                        log_pass("✅ Values persisted correctly in GET")
                        test_results.append(("Test 1", True, "Canonical write mirrors to avatarUrl"))
                    else:
                        log_fail(f"GET returned different values: profilePhotoUrl={user2.get('profilePhotoUrl')}, avatarUrl={user2.get('avatarUrl')}")
                        test_results.append(("Test 1", False, "Values not persisted correctly"))
                else:
                    log_fail(f"GET failed: {resp2.status_code}")
                    test_results.append(("Test 1", False, "GET request failed"))
            else:
                log_fail(f"Mirror failed. Expected both={test_url}, got profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
                test_results.append(("Test 1", False, "Mirror logic failed"))
        else:
            log_fail(f"PATCH failed: {resp.status_code} - {resp.text}")
            test_results.append(("Test 1", False, f"PATCH failed: {resp.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 1", False, str(e)))
    
    # =========================================================================
    # TEST 2: Legacy write (avatarUrl only) - should mirror to profilePhotoUrl
    # =========================================================================
    log_test(2, "PATCH with avatarUrl only - verify auto-mirror to profilePhotoUrl")
    try:
        test_url = "/api/files/test-legacy.jpg"
        resp = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
            "avatarUrl": test_url
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            profile_photo = user.get("profilePhotoUrl")
            avatar_url = user.get("avatarUrl")
            
            log_info(f"Response: profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
            
            if profile_photo == test_url and avatar_url == test_url:
                log_pass(f"✅ Both fields mirrored correctly: {test_url}")
                
                # Verify persistence with GET
                resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    user2 = resp2.json().get("user", {})
                    if user2.get("profilePhotoUrl") == test_url and user2.get("avatarUrl") == test_url:
                        log_pass("✅ Values persisted correctly in GET")
                        test_results.append(("Test 2", True, "Legacy write mirrors to profilePhotoUrl"))
                    else:
                        log_fail(f"GET returned different values: profilePhotoUrl={user2.get('profilePhotoUrl')}, avatarUrl={user2.get('avatarUrl')}")
                        test_results.append(("Test 2", False, "Values not persisted correctly"))
                else:
                    log_fail(f"GET failed: {resp2.status_code}")
                    test_results.append(("Test 2", False, "GET request failed"))
            else:
                log_fail(f"Mirror failed. Expected both={test_url}, got profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
                test_results.append(("Test 2", False, "Mirror logic failed"))
        else:
            log_fail(f"PATCH failed: {resp.status_code} - {resp.text}")
            test_results.append(("Test 2", False, f"PATCH failed: {resp.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 2", False, str(e)))
    
    # =========================================================================
    # TEST 3: Both fields explicitly set (different values) - keep each as-is
    # =========================================================================
    log_test(3, "PATCH with BOTH fields (different values) - verify no mirror overwrite")
    try:
        photo_a = "/api/files/photo-a.jpg"
        photo_b = "/api/files/photo-b.jpg"
        resp = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
            "profilePhotoUrl": photo_a,
            "avatarUrl": photo_b
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            profile_photo = user.get("profilePhotoUrl")
            avatar_url = user.get("avatarUrl")
            
            log_info(f"Response: profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
            
            if profile_photo == photo_a and avatar_url == photo_b:
                log_pass(f"✅ Each value persisted as sent (no mirror overwrite)")
                
                # Verify persistence with GET
                resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    user2 = resp2.json().get("user", {})
                    if user2.get("profilePhotoUrl") == photo_a and user2.get("avatarUrl") == photo_b:
                        log_pass("✅ Different values persisted correctly in GET")
                        test_results.append(("Test 3", True, "Both fields set - no mirror overwrite"))
                    else:
                        log_fail(f"GET returned different values: profilePhotoUrl={user2.get('profilePhotoUrl')}, avatarUrl={user2.get('avatarUrl')}")
                        test_results.append(("Test 3", False, "Values not persisted correctly"))
                else:
                    log_fail(f"GET failed: {resp2.status_code}")
                    test_results.append(("Test 3", False, "GET request failed"))
            else:
                log_fail(f"Values changed unexpectedly. Expected profilePhotoUrl={photo_a}, avatarUrl={photo_b}, got profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
                test_results.append(("Test 3", False, "Unexpected mirror behavior"))
        else:
            log_fail(f"PATCH failed: {resp.status_code} - {resp.text}")
            test_results.append(("Test 3", False, f"PATCH failed: {resp.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 3", False, str(e)))
    
    # =========================================================================
    # TEST 4: Empty string clears both fields
    # =========================================================================
    log_test(4, "PATCH with empty string - verify both fields cleared")
    try:
        resp = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
            "profilePhotoUrl": ""
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            profile_photo = user.get("profilePhotoUrl", None)
            avatar_url = user.get("avatarUrl", None)
            
            log_info(f"Response: profilePhotoUrl={repr(profile_photo)}, avatarUrl={repr(avatar_url)}")
            
            # Both should be empty string or None
            if (profile_photo == "" or profile_photo is None) and (avatar_url == "" or avatar_url is None):
                log_pass(f"✅ Both fields cleared (empty string mirrored)")
                
                # Verify persistence with GET
                resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    user2 = resp2.json().get("user", {})
                    profile_photo2 = user2.get("profilePhotoUrl", None)
                    avatar_url2 = user2.get("avatarUrl", None)
                    if (profile_photo2 == "" or profile_photo2 is None) and (avatar_url2 == "" or avatar_url2 is None):
                        log_pass("✅ Empty values persisted correctly in GET")
                        test_results.append(("Test 4", True, "Empty string clears both fields"))
                    else:
                        log_fail(f"GET returned non-empty values: profilePhotoUrl={repr(profile_photo2)}, avatarUrl={repr(avatar_url2)}")
                        test_results.append(("Test 4", False, "Empty values not persisted"))
                else:
                    log_fail(f"GET failed: {resp2.status_code}")
                    test_results.append(("Test 4", False, "GET request failed"))
            else:
                log_fail(f"Fields not cleared. Got profilePhotoUrl={repr(profile_photo)}, avatarUrl={repr(avatar_url)}")
                test_results.append(("Test 4", False, "Empty string did not clear both fields"))
        else:
            log_fail(f"PATCH failed: {resp.status_code} - {resp.text}")
            test_results.append(("Test 4", False, f"PATCH failed: {resp.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 4", False, str(e)))
    
    # =========================================================================
    # TEST 5: Restore original photo value (cleanup)
    # =========================================================================
    log_test(5, "CLEANUP - Restore original photo value")
    try:
        restore_value = original_photo if original_photo else ""
        resp = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
            "profilePhotoUrl": restore_value
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            profile_photo = user.get("profilePhotoUrl", "")
            avatar_url = user.get("avatarUrl", "")
            
            log_info(f"Restored: profilePhotoUrl={profile_photo}, avatarUrl={avatar_url}")
            
            # Verify no other fields were changed
            resp2 = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
            if resp2.status_code == 200:
                user2 = resp2.json().get("user", {})
                # Check a few key fields to ensure they weren't accidentally modified
                key_fields = ["name", "email", "phone", "availabilityStatus", "paymentMethodsAccepted"]
                all_intact = True
                for field in key_fields:
                    if field in user2:
                        log_info(f"  {field}: {user2.get(field)}")
                
                log_pass("✅ Original photo restored, other fields intact")
                test_results.append(("Test 5", True, "Cleanup successful"))
            else:
                log_fail(f"GET failed: {resp2.status_code}")
                test_results.append(("Test 5", False, "GET request failed"))
        else:
            log_fail(f"PATCH failed: {resp.status_code} - {resp.text}")
            test_results.append(("Test 5", False, f"PATCH failed: {resp.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 5", False, str(e)))
    
    # =========================================================================
    # TEST 6: Regression check - verify other profile fields still work
    # =========================================================================
    log_test(6, "REGRESSION - Verify other profile fields (name, phone, availabilityStatus, paymentMethodsAccepted)")
    try:
        # Get current values
        resp = requests.get(f"{BASE_URL}/users/me/profile", headers=headers, timeout=10)
        if resp.status_code != 200:
            log_fail(f"GET failed: {resp.status_code}")
            test_results.append(("Test 6", False, "GET request failed"))
        else:
            original_user = resp.json().get("user", {})
            original_name = original_user.get("name", "")
            original_phone = original_user.get("phone", "")
            original_availability = original_user.get("availabilityStatus", "")
            original_payments = original_user.get("paymentMethodsAccepted", [])
            
            # Make a test update
            test_name = f"{original_name} (test)"
            resp2 = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
                "name": test_name,
                "availabilityStatus": "available"
            }, timeout=10)
            
            if resp2.status_code == 200:
                data = resp2.json()
                user = data.get("user", {})
                
                if user.get("name") == test_name and user.get("availabilityStatus") == "available":
                    log_pass("✅ Other profile fields update correctly")
                    
                    # Restore original name
                    resp3 = requests.patch(f"{BASE_URL}/users/me/profile", headers=headers, json={
                        "name": original_name
                    }, timeout=10)
                    
                    if resp3.status_code == 200:
                        log_pass("✅ Original name restored")
                        test_results.append(("Test 6", True, "Regression check passed"))
                    else:
                        log_fail(f"Failed to restore name: {resp3.status_code}")
                        test_results.append(("Test 6", False, "Failed to restore original name"))
                else:
                    log_fail(f"Fields not updated correctly: name={user.get('name')}, availabilityStatus={user.get('availabilityStatus')}")
                    test_results.append(("Test 6", False, "Other fields not updating correctly"))
            else:
                log_fail(f"PATCH failed: {resp2.status_code} - {resp2.text}")
                test_results.append(("Test 6", False, f"PATCH failed: {resp2.status_code}"))
    except Exception as e:
        log_fail(f"Exception: {e}")
        test_results.append(("Test 6", False, str(e)))
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY - PROFILE PHOTO MIRRORING")
    print("="*80)
    
    passed = sum(1 for _, result, _ in test_results if result)
    total = len(test_results)
    
    for test_name, result, message in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! profilePhotoUrl ↔ avatarUrl mirroring is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the failures above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
