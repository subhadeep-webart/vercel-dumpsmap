#!/usr/bin/env python3
"""
Sprint 1B Backend Testing — Forgot Password + Admin User Management
Test ONLY the new endpoints. Do NOT re-test prior sprints.

Test Credentials:
- super_admin: jamal@dumpmaps.org / @@Jefferson2180

Base URL: https://dumpmaps-pilot.preview.emergentagent.com
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def log_test(step, message):
    print(f"\n{'='*80}")
    print(f"TEST {step}: {message}")
    print('='*80)

def log_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def login(email, password):
    """Login and return token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")
        else:
            print(f"Login failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def signup_test_user(email, password, name="Test User"):
    """Create a test user"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": email,
            "password": password,
            "name": name
        }, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("user", {}).get("id")
        else:
            print(f"Signup failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"Signup error: {e}")
        return None

def main():
    print("\n" + "="*80)
    print("SPRINT 1B BACKEND TESTING — FORGOT PASSWORD + ADMIN USER MANAGEMENT")
    print("="*80)
    
    # Login as super admin
    log_test("SETUP", "Login as super_admin")
    admin_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not admin_token:
        print("❌ CRITICAL: Cannot login as super_admin. Aborting tests.")
        return
    log_result(True, f"Super admin logged in successfully")
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    # Create a test target user for password reset testing
    test_email = f"pwreset_test_{int(time.time())}@test.com"
    test_password = "TestPass123!"
    log_test("SETUP", f"Create test user: {test_email}")
    target_user_id = signup_test_user(test_email, test_password)
    if not target_user_id:
        print("❌ CRITICAL: Cannot create test user. Aborting tests.")
        return
    log_result(True, f"Test user created: {target_user_id}")
    
    # =========================================================================
    # TEST 1: POST /api/auth/forgot-password (PUBLIC)
    # =========================================================================
    
    log_test("1a", "POST /api/auth/forgot-password with unknown email")
    try:
        resp = requests.post(f"{BASE_URL}/auth/forgot-password", json={
            "email": "nobody@nowhere.test"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            expected_msg = "If an account exists for that email, a reset link has been sent."
            if data.get("ok") and expected_msg in data.get("message", ""):
                log_result(True, f"Returns 200 with safe message: {data.get('message')}")
                unknown_email_response = resp.text
            else:
                log_result(False, f"Unexpected response: {data}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    log_test("1b", "POST /api/auth/forgot-password with real email (super_admin)")
    try:
        resp = requests.post(f"{BASE_URL}/auth/forgot-password", json={
            "email": SUPER_ADMIN_EMAIL
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            expected_msg = "If an account exists for that email, a reset link has been sent."
            if data.get("ok") and expected_msg in data.get("message", ""):
                log_result(True, f"Returns 200 with safe message: {data.get('message')}")
                real_email_response = resp.text
                # Check if responses are identical (byte-equal)
                if unknown_email_response == real_email_response:
                    log_result(True, "Response is byte-equal to unknown email response (no enumeration leak)")
                else:
                    log_result(False, f"Response differs from unknown email response:\nUnknown: {unknown_email_response}\nReal: {real_email_response}")
            else:
                log_result(False, f"Unexpected response: {data}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    log_test("1c", "POST /api/auth/forgot-password with empty body")
    try:
        resp = requests.post(f"{BASE_URL}/auth/forgot-password", json={}, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            expected_msg = "If an account exists for that email, a reset link has been sent."
            if data.get("ok") and expected_msg in data.get("message", ""):
                log_result(True, f"Returns 200 with safe message (no enumeration leak)")
            else:
                log_result(False, f"Unexpected response: {data}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    log_test("1d", "POST /api/auth/forgot-password with invalid email format")
    try:
        resp = requests.post(f"{BASE_URL}/auth/forgot-password", json={
            "email": "not-an-email"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            expected_msg = "If an account exists for that email, a reset link has been sent."
            if data.get("ok") and expected_msg in data.get("message", ""):
                log_result(True, f"Returns 200 with safe message (no enumeration leak)")
            else:
                log_result(False, f"Unexpected response: {data}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # TEST 2: POST /api/auth/reset-password (PUBLIC)
    # =========================================================================
    
    # First, get a valid token via admin endpoint
    log_test("2-SETUP", f"Admin generates password reset token for test user")
    valid_token = None
    try:
        resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", 
                           headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            valid_token = data.get("token")
            reset_link = data.get("resetLink")
            expires_at = data.get("expiresAt")
            log_result(True, f"Token generated: {valid_token[:16]}... (expires: {expires_at})")
            log_result(True, f"Reset link: {reset_link}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    if not valid_token:
        print("❌ CRITICAL: Cannot get valid token. Skipping reset-password tests.")
    else:
        new_password = "NewSecure!Pass99"
        
        log_test("2ii", f"POST /api/auth/reset-password with valid token and new password")
        try:
            resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                "token": valid_token,
                "password": new_password
            }, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and "Password updated" in data.get("message", ""):
                    log_result(True, f"Password reset successful: {data.get('message')}")
                else:
                    log_result(False, f"Unexpected response: {data}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("2iii", "Verify password actually changed - login with NEW password")
        try:
            new_token = login(test_email, new_password)
            if new_token:
                log_result(True, f"Login successful with new password")
            else:
                log_result(False, f"Login failed with new password")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("2iv", "Verify OLD password no longer works")
        try:
            old_token = login(test_email, test_password)
            if old_token:
                log_result(False, f"Login succeeded with old password (should have failed)")
            else:
                log_result(True, f"Login correctly rejected with old password")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("2v", "POST /api/auth/reset-password with SAME token (should fail - already used)")
        try:
            resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                "token": valid_token,
                "password": "AnotherPass123!"
            }, timeout=10)
            
            if resp.status_code == 400:
                data = resp.json()
                if "already been used" in data.get("error", ""):
                    log_result(True, f"Correctly rejected: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("2vi", "POST /api/auth/reset-password with invalid token")
        try:
            resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                "token": "obviously-invalid-token-12345",
                "password": "ValidPass123!"
            }, timeout=10)
            
            if resp.status_code == 400:
                data = resp.json()
                if "Invalid or expired" in data.get("error", ""):
                    log_result(True, f"Correctly rejected: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("2vii", "POST /api/auth/reset-password with missing token")
        try:
            resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                "password": "ValidPass123!"
            }, timeout=10)
            
            if resp.status_code == 400:
                data = resp.json()
                if "token and password required" in data.get("error", ""):
                    log_result(True, f"Correctly rejected: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        # Generate a new token for short password test
        log_test("2viii-SETUP", "Generate new token for short password test")
        short_pw_token = None
        try:
            resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", 
                               headers=headers_admin, timeout=10)
            if resp.status_code == 200:
                short_pw_token = resp.json().get("token")
                log_result(True, f"New token generated")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        if short_pw_token:
            log_test("2viii", "POST /api/auth/reset-password with short password (<8 chars)")
            try:
                resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                    "token": short_pw_token,
                    "password": "short"
                }, timeout=10)
                
                if resp.status_code == 400:
                    data = resp.json()
                    if "at least 8" in data.get("error", ""):
                        log_result(True, f"Correctly rejected: {data.get('error')}")
                    else:
                        log_result(False, f"Wrong error message: {data.get('error')}")
                else:
                    log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
            except Exception as e:
                log_result(False, f"Exception: {e}")
        
        # Generate another token for missing password test
        log_test("2ix-SETUP", "Generate new token for missing password test")
        missing_pw_token = None
        try:
            resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", 
                               headers=headers_admin, timeout=10)
            if resp.status_code == 200:
                missing_pw_token = resp.json().get("token")
                log_result(True, f"New token generated")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        if missing_pw_token:
            log_test("2ix", "POST /api/auth/reset-password with missing password")
            try:
                resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                    "token": missing_pw_token
                }, timeout=10)
                
                if resp.status_code == 400:
                    data = resp.json()
                    if "token and password required" in data.get("error", ""):
                        log_result(True, f"Correctly rejected: {data.get('error')}")
                    else:
                        log_result(False, f"Wrong error message: {data.get('error')}")
                else:
                    log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
            except Exception as e:
                log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # TEST 3: POST /api/admin/users/:id/send-password-reset
    # =========================================================================
    
    log_test("3a", "POST /api/admin/users/:id/send-password-reset with no Authorization header")
    try:
        resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", timeout=10)
        
        if resp.status_code == 401:
            log_result(True, f"Correctly rejected with 401")
        else:
            log_result(False, f"Expected 401, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    # Create a normal user for 403 test
    log_test("3b-SETUP", "Create normal user for 403 test")
    normal_email = f"normal_user_{int(time.time())}@test.com"
    normal_password = "NormalPass123!"
    normal_user_id = signup_test_user(normal_email, normal_password, "Normal User")
    normal_token = login(normal_email, normal_password)
    
    if normal_token:
        log_test("3b", "POST /api/admin/users/:id/send-password-reset as normal_user (should be 403)")
        try:
            headers_normal = {"Authorization": f"Bearer {normal_token}"}
            resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", 
                               headers=headers_normal, timeout=10)
            
            if resp.status_code == 403:
                data = resp.json()
                if "Admin access required" in data.get("error", ""):
                    log_result(True, f"Correctly rejected with 403: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
    
    log_test("3c", "POST /api/admin/users/:id/send-password-reset as super_admin (should succeed)")
    try:
        resp = requests.post(f"{BASE_URL}/admin/users/{target_user_id}/send-password-reset", 
                           headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("resetLink") and data.get("token") and data.get("expiresAt"):
                log_result(True, f"Success: {data.get('message')}")
                log_result(True, f"resetLink contains token: {data.get('token')[:16]}... in {data.get('resetLink')}")
                
                # Verify expiresAt is roughly 1 hour from now
                try:
                    expires_at = datetime.fromisoformat(data.get("expiresAt").replace('Z', '+00:00'))
                    now = datetime.now(expires_at.tzinfo)
                    diff = (expires_at - now).total_seconds()
                    if 3540 <= diff <= 3660:  # 59-61 minutes (±1 min tolerance)
                        log_result(True, f"expiresAt is ~1 hour from now ({diff/60:.1f} minutes)")
                    else:
                        log_result(False, f"expiresAt is {diff/60:.1f} minutes from now (expected ~60)")
                except Exception as e:
                    log_result(False, f"Cannot parse expiresAt: {e}")
            else:
                log_result(False, f"Missing fields in response: {data}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    log_test("3d", "POST /api/admin/users/:id/send-password-reset against non-existent userId")
    try:
        fake_user_id = "nonexistent-user-id-12345"
        resp = requests.post(f"{BASE_URL}/admin/users/{fake_user_id}/send-password-reset", 
                           headers=headers_admin, timeout=10)
        
        if resp.status_code == 404:
            data = resp.json()
            if "not found" in data.get("error", "").lower():
                log_result(True, f"Correctly rejected with 404: {data.get('error')}")
            else:
                log_result(False, f"Wrong error message: {data.get('error')}")
        else:
            log_result(False, f"Expected 404, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # TEST 4: PATCH /api/admin/users/:id — extended actions
    # =========================================================================
    
    # Create a fresh test user for PATCH tests
    log_test("4-SETUP", "Create fresh test user for PATCH tests")
    patch_email = f"patch_test_{int(time.time())}@test.com"
    patch_password = "PatchPass123!"
    patch_user_id = signup_test_user(patch_email, patch_password, "Patch Test User")
    
    if not patch_user_id:
        print("❌ CRITICAL: Cannot create patch test user. Skipping PATCH tests.")
    else:
        log_test("4a", "PATCH /api/admin/users/:id with action=suspend_30d")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "suspend_30d"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("accountStatus") == "suspended" and user.get("suspendedUntil"):
                    log_result(True, f"accountStatus=suspended")
                    
                    # Verify suspendedUntil is ~30 days from now
                    try:
                        suspended_until = datetime.fromisoformat(user.get("suspendedUntil").replace('Z', '+00:00'))
                        now = datetime.now(suspended_until.tzinfo)
                        diff_days = (suspended_until - now).total_seconds() / 86400
                        if 29.5 <= diff_days <= 30.5:  # ±0.5 day tolerance
                            log_result(True, f"suspendedUntil is ~30 days from now ({diff_days:.1f} days)")
                        else:
                            log_result(False, f"suspendedUntil is {diff_days:.1f} days from now (expected ~30)")
                    except Exception as e:
                        log_result(False, f"Cannot parse suspendedUntil: {e}")
                else:
                    log_result(False, f"Unexpected user state: {user}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4b", "PATCH /api/admin/users/:id with action=unlock")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "unlock"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("accountStatus") == "active" and user.get("suspendedUntil") is None:
                    log_result(True, f"accountStatus=active, suspendedUntil=null")
                else:
                    log_result(False, f"Unexpected user state: accountStatus={user.get('accountStatus')}, suspendedUntil={user.get('suspendedUntil')}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4c", "PATCH /api/admin/users/:id with action=suspend (7-day default)")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "suspend"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("accountStatus") == "suspended" and user.get("suspendedUntil"):
                    log_result(True, f"accountStatus=suspended")
                    
                    # Verify suspendedUntil is ~7 days from now
                    try:
                        suspended_until = datetime.fromisoformat(user.get("suspendedUntil").replace('Z', '+00:00'))
                        now = datetime.now(suspended_until.tzinfo)
                        diff_days = (suspended_until - now).total_seconds() / 86400
                        if 6.5 <= diff_days <= 7.5:  # ±0.5 day tolerance
                            log_result(True, f"suspendedUntil is ~7 days from now ({diff_days:.1f} days)")
                        else:
                            log_result(False, f"suspendedUntil is {diff_days:.1f} days from now (expected ~7)")
                    except Exception as e:
                        log_result(False, f"Cannot parse suspendedUntil: {e}")
                else:
                    log_result(False, f"Unexpected user state: {user}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4d", "PATCH /api/admin/users/:id with action=unlock (clear suspension)")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "unlock"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("accountStatus") == "active" and user.get("suspendedUntil") is None:
                    log_result(True, f"accountStatus=active, suspendedUntil=null")
                else:
                    log_result(False, f"Unexpected user state: {user}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4e", "PATCH /api/admin/users/:id with action=delete")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "delete"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if (user.get("accountStatus") == "deleted" and 
                    user.get("deletedAt") and 
                    user.get("deletedBy")):
                    log_result(True, f"accountStatus=deleted, deletedAt={user.get('deletedAt')}, deletedBy={user.get('deletedBy')}")
                else:
                    log_result(False, f"Unexpected user state: {user}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4f", "PATCH /api/admin/users/:id with action=unlock (reset from deleted)")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"action": "unlock"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("accountStatus") == "active":
                    log_result(True, f"accountStatus=active (restored from deleted)")
                else:
                    log_result(False, f"Unexpected accountStatus: {user.get('accountStatus')}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        # Get current email for restoration later
        current_email = patch_email
        
        log_test("4g", "PATCH /api/admin/users/:id with valid new email")
        new_email = f"updated_{int(time.time())}@example.com"
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"email": new_email}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                if user.get("email") == new_email:
                    log_result(True, f"Email updated to: {new_email}")
                    current_email = new_email
                else:
                    log_result(False, f"Email not updated: {user.get('email')}")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        # Restore original email
        log_test("4g-RESTORE", "Restore original email")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"email": patch_email}, 
                                timeout=10)
            if resp.status_code == 200:
                log_result(True, f"Email restored to: {patch_email}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4h", "PATCH /api/admin/users/:id with invalid email format")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"email": "not-an-email"}, 
                                timeout=10)
            
            if resp.status_code == 400:
                data = resp.json()
                if "Invalid email" in data.get("error", ""):
                    log_result(True, f"Correctly rejected: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4i", "PATCH /api/admin/users/:id with duplicate email (super_admin's email)")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"email": SUPER_ADMIN_EMAIL}, 
                                timeout=10)
            
            if resp.status_code == 409:
                data = resp.json()
                if "already uses this email" in data.get("error", ""):
                    log_result(True, f"Correctly rejected: {data.get('error')}")
                else:
                    log_result(False, f"Wrong error message: {data.get('error')}")
            else:
                log_result(False, f"Expected 409, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4j", "PATCH /api/admin/users/:id with adminNote")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"adminNote": "hello world"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                admin_notes = user.get("adminNotes", [])
                if len(admin_notes) > 0:
                    latest_note = admin_notes[-1]
                    if (latest_note.get("text") == "hello world" and 
                        latest_note.get("authorId") and 
                        latest_note.get("authorEmail") and 
                        latest_note.get("createdAt")):
                        log_result(True, f"Admin note added: {latest_note}")
                    else:
                        log_result(False, f"Admin note missing fields: {latest_note}")
                else:
                    log_result(False, f"No admin notes found")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        log_test("4k", "PATCH /api/admin/users/:id with second adminNote (verify array append)")
        try:
            resp = requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                                headers=headers_admin, 
                                json={"adminNote": "second note"}, 
                                timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {})
                admin_notes = user.get("adminNotes", [])
                if len(admin_notes) >= 2:
                    log_result(True, f"Admin notes array has {len(admin_notes)} entries (not overwritten)")
                    # Verify both notes exist
                    texts = [note.get("text") for note in admin_notes]
                    if "hello world" in texts and "second note" in texts:
                        log_result(True, f"Both notes present: {texts}")
                    else:
                        log_result(False, f"Notes missing: {texts}")
                else:
                    log_result(False, f"Admin notes array has only {len(admin_notes)} entries")
            else:
                log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # TEST 5: GET /api/admin/users/:id/activity
    # =========================================================================
    
    log_test("5a", "GET /api/admin/users/:id/activity with no auth")
    try:
        resp = requests.get(f"{BASE_URL}/admin/users/{patch_user_id}/activity", timeout=10)
        
        if resp.status_code == 401:
            log_result(True, f"Correctly rejected with 401")
        else:
            log_result(False, f"Expected 401, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    if normal_token:
        log_test("5b", "GET /api/admin/users/:id/activity as normal user")
        try:
            headers_normal = {"Authorization": f"Bearer {normal_token}"}
            resp = requests.get(f"{BASE_URL}/admin/users/{patch_user_id}/activity", 
                              headers=headers_normal, timeout=10)
            
            if resp.status_code == 403:
                log_result(True, f"Correctly rejected with 403")
            else:
                log_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
    
    log_test("5c", "GET /api/admin/users/:id/activity as super_admin")
    try:
        resp = requests.get(f"{BASE_URL}/admin/users/{patch_user_id}/activity", 
                          headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("user") and 
                isinstance(data.get("events"), list) and 
                "lastLogin" in data and 
                "createdAt" in data and 
                isinstance(data.get("adminNotes"), list)):
                log_result(True, f"Response structure correct: user, events[], lastLogin, createdAt, adminNotes[]")
                
                # Verify adminNotes has at least 2 entries from 4j+4k
                admin_notes = data.get("adminNotes", [])
                if len(admin_notes) >= 2:
                    log_result(True, f"adminNotes has {len(admin_notes)} entries (from tests 4j+4k)")
                else:
                    log_result(False, f"adminNotes has only {len(admin_notes)} entries (expected ≥2)")
            else:
                log_result(False, f"Response structure incorrect: {data.keys()}")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    log_test("5d", "GET /api/admin/users/:id/activity with ?limit=5")
    try:
        resp = requests.get(f"{BASE_URL}/admin/users/{patch_user_id}/activity?limit=5", 
                          headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            events = data.get("events", [])
            if len(events) <= 5:
                log_result(True, f"Events capped at {len(events)} (limit=5)")
            else:
                log_result(False, f"Events has {len(events)} entries (expected ≤5)")
        else:
            log_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # TEST 6: lastLoginAt stamp on /api/auth/login
    # =========================================================================
    
    # Create a fresh user for lastLoginAt test
    log_test("6-SETUP", "Create fresh user for lastLoginAt test")
    login_test_email = f"login_test_{int(time.time())}@test.com"
    login_test_password = "LoginTest123!"
    login_test_user_id = signup_test_user(login_test_email, login_test_password, "Login Test User")
    
    if not login_test_user_id:
        print("❌ CRITICAL: Cannot create login test user. Skipping lastLoginAt test.")
    else:
        log_test("6a", "Note current lastLoginAt (might be null)")
        current_last_login = None
        try:
            resp = requests.get(f"{BASE_URL}/admin/users/{login_test_user_id}/activity", 
                              headers=headers_admin, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                current_last_login = data.get("lastLogin")
                log_result(True, f"Current lastLoginAt: {current_last_login}")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        # Set password via admin reset flow so we know it
        log_test("6b", "Set password via admin reset flow")
        reset_token = None
        try:
            resp = requests.post(f"{BASE_URL}/admin/users/{login_test_user_id}/send-password-reset", 
                               headers=headers_admin, timeout=10)
            if resp.status_code == 200:
                reset_token = resp.json().get("token")
                log_result(True, f"Reset token generated")
        except Exception as e:
            log_result(False, f"Exception: {e}")
        
        if reset_token:
            new_known_password = "KnownPass123!"
            try:
                resp = requests.post(f"{BASE_URL}/auth/reset-password", json={
                    "token": reset_token,
                    "password": new_known_password
                }, timeout=10)
                if resp.status_code == 200:
                    log_result(True, f"Password set to known value")
            except Exception as e:
                log_result(False, f"Exception: {e}")
            
            log_test("6c", "POST /api/auth/login with new credentials")
            login_time_before = datetime.now()
            try:
                login_token = login(login_test_email, new_known_password)
                if login_token:
                    log_result(True, f"Login successful")
                    
                    # Wait a moment for DB update
                    time.sleep(1)
                    
                    log_test("6d", "GET /api/admin/users/:id/activity to verify lastLoginAt was stamped")
                    try:
                        resp = requests.get(f"{BASE_URL}/admin/users/{login_test_user_id}/activity", 
                                          headers=headers_admin, timeout=10)
                        if resp.status_code == 200:
                            data = resp.json()
                            new_last_login = data.get("lastLogin")
                            
                            if new_last_login:
                                log_result(True, f"lastLoginAt is now: {new_last_login}")
                                
                                # Verify it's >= pre-login timestamp
                                try:
                                    last_login_dt = datetime.fromisoformat(new_last_login.replace('Z', '+00:00'))
                                    if last_login_dt >= login_time_before.replace(tzinfo=last_login_dt.tzinfo):
                                        log_result(True, f"lastLoginAt is ≥ pre-login timestamp")
                                    else:
                                        log_result(False, f"lastLoginAt ({last_login_dt}) is before login time ({login_time_before})")
                                except Exception as e:
                                    log_result(False, f"Cannot parse lastLoginAt: {e}")
                            else:
                                log_result(False, f"lastLoginAt is still null")
                    except Exception as e:
                        log_result(False, f"Exception: {e}")
                else:
                    log_result(False, f"Login failed")
            except Exception as e:
                log_result(False, f"Exception: {e}")
    
    # =========================================================================
    # CLEANUP
    # =========================================================================
    
    log_test("CLEANUP", "Restore test users to known-good state")
    
    # Restore patch_user_id to active state
    if patch_user_id:
        try:
            requests.patch(f"{BASE_URL}/admin/users/{patch_user_id}", 
                         headers=headers_admin, 
                         json={"action": "unlock"}, 
                         timeout=10)
            log_result(True, f"Restored patch_user_id to active")
        except:
            pass
    
    print("\n" + "="*80)
    print("SPRINT 1B BACKEND TESTING COMPLETE")
    print("="*80)
    print("\nAll tests executed. Review results above for pass/fail status.")
    print("Look for ❌ FAIL markers to identify issues.")
    print("\n")

if __name__ == "__main__":
    main()
