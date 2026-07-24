#!/usr/bin/env python3
"""
Feature Controls Phase A — Backend Testing
Tests all endpoints for global feature flags + audit log + access map
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def login(email, password):
    """Login and return auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def signup(email, password, name="Test User"):
    """Signup new user"""
    resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "email": email,
        "password": password,
        "name": name
    })
    if resp.status_code not in [200, 201]:
        print(f"⚠️  Signup failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def test_auth_gating():
    """TEST 1 — Auth gating"""
    print("\n" + "="*80)
    print("TEST 1 — Auth gating")
    print("="*80)
    
    # Test 1a: No auth header
    print("\n[1a] GET /api/admin/feature-flags without Authorization → 401")
    resp = requests.get(f"{BASE_URL}/api/admin/feature-flags")
    if resp.status_code == 401:
        print(f"✅ PASS: Got 401 as expected")
    else:
        print(f"❌ FAIL: Expected 401, got {resp.status_code}")
    
    # Test 1b: Regular user (sign up new user)
    print("\n[1b] GET as regular user → 403")
    regular_token = signup("qa.fc1@example.com", "Test12345!", "QA FC1")
    if not regular_token:
        # Try login if already exists
        regular_token = login("qa.fc1@example.com", "Test12345!")
    
    if regular_token:
        resp = requests.get(f"{BASE_URL}/api/admin/feature-flags", headers={"Authorization": f"Bearer {regular_token}"})
        if resp.status_code == 403:
            print(f"✅ PASS: Regular user got 403 as expected")
        else:
            print(f"❌ FAIL: Expected 403, got {resp.status_code}")
    else:
        print(f"⚠️  SKIP: Could not create/login regular user")
    
    # Test 1c: PATCH without auth
    print("\n[1c] PATCH without auth → 401")
    resp = requests.patch(f"{BASE_URL}/api/admin/feature-flags/timeClock", json={"globalStatus": "live"})
    if resp.status_code == 401:
        print(f"✅ PASS: Got 401 as expected")
    else:
        print(f"❌ FAIL: Expected 401, got {resp.status_code}")
    
    # Test 1d: GET /me/feature-access without auth
    print("\n[1d] GET /api/me/feature-access without auth → 200 with authenticated: false")
    resp = requests.get(f"{BASE_URL}/api/me/feature-access")
    if resp.status_code == 200:
        data = resp.json()
        if data.get("authenticated") == False:
            print(f"✅ PASS: Got 200 with authenticated: false")
        else:
            print(f"❌ FAIL: authenticated should be false, got {data.get('authenticated')}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")

def test_seeding_idempotence(admin_token):
    """TEST 2 — Seeding & idempotence"""
    print("\n" + "="*80)
    print("TEST 2 — Seeding & idempotence")
    print("="*80)
    
    # First GET
    print("\n[2a] First GET /api/admin/feature-flags → 200, flags array has length 10")
    resp = requests.get(f"{BASE_URL}/api/admin/feature-flags", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return
    
    data = resp.json()
    flags = data.get("flags", [])
    print(f"✅ PASS: Got {len(flags)} flags")
    
    if len(flags) != 10:
        print(f"❌ FAIL: Expected 10 flags, got {len(flags)}")
    else:
        print(f"✅ PASS: Flags array has length 10")
    
    # Verify seeded statuses
    print("\n[2b] Verify seeded statuses")
    flag_by_key = {f["key"]: f for f in flags}
    
    checks = [
        ("timeClock", "live"),
        ("commercialB2B", "live"),
        ("membershipPlans", "live"),
        ("rewardsEngine", "demo"),
        ("rewardsCashout", "demo"),
    ]
    
    for key, expected_status in checks:
        if key in flag_by_key:
            actual = flag_by_key[key].get("globalStatus")
            if actual == expected_status:
                print(f"✅ PASS: {key}.globalStatus === '{expected_status}'")
            else:
                print(f"❌ FAIL: {key}.globalStatus expected '{expected_status}', got '{actual}'")
        else:
            print(f"❌ FAIL: {key} not found in flags")
    
    # Check all 10 keys present
    print("\n[2c] Check all 10 keys present")
    expected_keys = [
        "timeClock", "commercialB2B", "membershipPlans", "rewardsEngine", 
        "rewardsCashout", "ocrReceiptScanner", "contractorImpactDashboard",
        "fleetManagement", "enterpriseTeamManagement", "facilityRewardsProgram"
    ]
    for key in expected_keys:
        if key in flag_by_key:
            print(f"✅ PASS: {key} present")
        else:
            print(f"❌ FAIL: {key} missing")
    
    # Second GET (idempotence check)
    print("\n[2d] Second GET → same array length (no duplicates)")
    resp2 = requests.get(f"{BASE_URL}/api/admin/feature-flags", headers={"Authorization": f"Bearer {admin_token}"})
    if resp2.status_code == 200:
        data2 = resp2.json()
        flags2 = data2.get("flags", [])
        if len(flags2) == len(flags):
            print(f"✅ PASS: Same length ({len(flags2)}), no duplicates")
        else:
            print(f"❌ FAIL: Length changed from {len(flags)} to {len(flags2)}")
    else:
        print(f"❌ FAIL: Second GET failed with {resp2.status_code}")
    
    # Check response includes featureStatuses, membershipTiers, validRoles
    print("\n[2e] Check response includes featureStatuses, membershipTiers, validRoles")
    if "featureStatuses" in data:
        print(f"✅ PASS: featureStatuses present ({len(data['featureStatuses'])} entries)")
    else:
        print(f"❌ FAIL: featureStatuses missing")
    
    if "membershipTiers" in data:
        print(f"✅ PASS: membershipTiers present ({len(data['membershipTiers'])} entries)")
    else:
        print(f"❌ FAIL: membershipTiers missing")
    
    if "validRoles" in data:
        print(f"✅ PASS: validRoles present ({len(data['validRoles'])} entries)")
    else:
        print(f"❌ FAIL: validRoles missing")

def test_get_single_and_unknown(admin_token):
    """TEST 3 — GET single + GET unknown"""
    print("\n" + "="*80)
    print("TEST 3 — GET single + GET unknown")
    print("="*80)
    
    # GET single
    print("\n[3a] GET /api/admin/feature-flags/timeClock → 200")
    resp = requests.get(f"{BASE_URL}/api/admin/feature-flags/timeClock", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("key") == "timeClock":
            print(f"✅ PASS: Got single flag with key='timeClock'")
        else:
            print(f"❌ FAIL: Flag key mismatch or missing")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # GET unknown
    print("\n[3b] GET /api/admin/feature-flags/nonexistent → 404")
    resp = requests.get(f"{BASE_URL}/api/admin/feature-flags/nonexistent", headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 404:
        data = resp.json()
        if "Unknown feature key" in data.get("error", ""):
            print(f"✅ PASS: Got 404 with 'Unknown feature key'")
        else:
            print(f"⚠️  PASS: Got 404 but error message different: {data.get('error')}")
    else:
        print(f"❌ FAIL: Expected 404, got {resp.status_code}")

def test_patch_valid_combinations(admin_token, admin_email):
    """TEST 4 — PATCH valid combinations"""
    print("\n" + "="*80)
    print("TEST 4 — PATCH valid combinations")
    print("="*80)
    
    feature_key = "ocrReceiptScanner"
    
    # Test different globalStatus values
    statuses = ["beta", "live", "paused", "not_active", "demo"]
    for status in statuses:
        print(f"\n[4a] PATCH globalStatus to '{status}'")
        resp = requests.patch(
            f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"globalStatus": status, "auditNotes": f"QA test {status}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            flag = data.get("flag")
            if flag and flag.get("globalStatus") == status:
                print(f"✅ PASS: globalStatus === '{status}'")
                # Check updatedByEmail
                if flag.get("updatedByEmail") == admin_email:
                    print(f"✅ PASS: updatedByEmail === '{admin_email}'")
                else:
                    print(f"⚠️  updatedByEmail: expected '{admin_email}', got '{flag.get('updatedByEmail')}'")
                # Check updatedBy is set
                if flag.get("updatedBy"):
                    print(f"✅ PASS: updatedBy is set")
                else:
                    print(f"❌ FAIL: updatedBy is not set")
            else:
                print(f"❌ FAIL: globalStatus expected '{status}', got '{flag.get('globalStatus') if flag else 'N/A'}'")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    
    # Test defaultTrialDays
    print(f"\n[4b] PATCH defaultTrialDays to 30")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"defaultTrialDays": 30}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("defaultTrialDays") == 30:
            print(f"✅ PASS: defaultTrialDays === 30")
        else:
            print(f"❌ FAIL: defaultTrialDays expected 30, got {flag.get('defaultTrialDays') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test allowedRoles
    print(f"\n[4c] PATCH allowedRoles to ['user', 'contractor']")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"allowedRoles": ["user", "contractor"]}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and set(flag.get("allowedRoles", [])) == {"user", "contractor"}:
            print(f"✅ PASS: allowedRoles === ['user', 'contractor']")
        else:
            print(f"❌ FAIL: allowedRoles expected ['user', 'contractor'], got {flag.get('allowedRoles') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test allowedRoles with invalid role (should be filtered)
    print(f"\n[4d] PATCH allowedRoles with invalid role ['user', 'nope', 'contractor']")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"allowedRoles": ["user", "nope", "contractor"]}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        roles = flag.get("allowedRoles", []) if flag else []
        if "nope" not in roles and len(roles) == 2:
            print(f"✅ PASS: 'nope' filtered out, final array length 2")
        else:
            print(f"❌ FAIL: Expected 'nope' to be filtered, got {roles}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test requiredMembershipTier
    print(f"\n[4e] PATCH requiredMembershipTier to 'enterprise'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"requiredMembershipTier": "enterprise"}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("requiredMembershipTier") == "enterprise":
            print(f"✅ PASS: requiredMembershipTier === 'enterprise'")
        else:
            print(f"❌ FAIL: requiredMembershipTier expected 'enterprise', got {flag.get('requiredMembershipTier') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test visibleToUsers
    print(f"\n[4f] PATCH visibleToUsers to false")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"visibleToUsers": False}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("visibleToUsers") == False:
            print(f"✅ PASS: visibleToUsers === false")
        else:
            print(f"❌ FAIL: visibleToUsers expected false, got {flag.get('visibleToUsers') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test trialEligible
    print(f"\n[4g] PATCH trialEligible to false")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"trialEligible": False}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("trialEligible") == False:
            print(f"✅ PASS: trialEligible === false")
        else:
            print(f"❌ FAIL: trialEligible expected false, got {flag.get('trialEligible') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test notes
    print(f"\n[4h] PATCH notes to 'Internal note'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "Internal note"}
    )
    if resp.status_code == 200:
        data = resp.json()
        flag = data.get("flag")
        if flag and flag.get("notes") == "Internal note":
            print(f"✅ PASS: notes === 'Internal note'")
        else:
            print(f"❌ FAIL: notes expected 'Internal note', got {flag.get('notes') if flag else 'N/A'}")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Revert to seed defaults
    print(f"\n[4i] Revert {feature_key} to seed defaults")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "globalStatus": "demo",
            "visibleToUsers": False,
            "allowedRoles": ["contractor", "admin", "super_admin"],
            "requiredMembershipTier": "verified_commercial",
            "trialEligible": True,
            "defaultTrialDays": 25,
            "notes": "Slated next in roadmap. Needs OCR provider key."
        }
    )
    if resp.status_code == 200:
        print(f"✅ PASS: Reverted to seed defaults")
    else:
        print(f"⚠️  Revert failed: {resp.status_code}")

def test_patch_validation_errors(admin_token):
    """TEST 5 — PATCH validation errors"""
    print("\n" + "="*80)
    print("TEST 5 — PATCH validation errors")
    print("="*80)
    
    feature_key = "ocrReceiptScanner"
    
    # Invalid globalStatus
    print(f"\n[5a] PATCH globalStatus to 'invalid' → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "invalid"}
    )
    if resp.status_code == 400:
        data = resp.json()
        error = data.get("error", "")
        if all(s in error for s in ["demo", "beta", "live", "paused", "not_active"]):
            print(f"✅ PASS: Got 400 with all valid statuses in error message")
        else:
            print(f"⚠️  PASS: Got 400 but error message incomplete: {error}")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Invalid defaultTrialDays (negative)
    print(f"\n[5b] PATCH defaultTrialDays to -1 → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"defaultTrialDays": -1}
    )
    if resp.status_code == 400:
        print(f"✅ PASS: Got 400 for negative defaultTrialDays")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Invalid defaultTrialDays (too large)
    print(f"\n[5c] PATCH defaultTrialDays to 999 → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"defaultTrialDays": 999}
    )
    if resp.status_code == 400:
        print(f"✅ PASS: Got 400 for defaultTrialDays > 365")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Invalid defaultTrialDays (string)
    print(f"\n[5d] PATCH defaultTrialDays to 'abc' → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"defaultTrialDays": "abc"}
    )
    if resp.status_code == 400:
        print(f"✅ PASS: Got 400 for non-numeric defaultTrialDays")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Invalid requiredMembershipTier
    print(f"\n[5e] PATCH requiredMembershipTier to 'bogus' → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"requiredMembershipTier": "bogus"}
    )
    if resp.status_code == 400:
        print(f"✅ PASS: Got 400 for invalid requiredMembershipTier")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Invalid allowedRoles (not array)
    print(f"\n[5f] PATCH allowedRoles to 'not-array' → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"allowedRoles": "not-array"}
    )
    if resp.status_code == 400:
        data = resp.json()
        if "allowedRoles must be an array" in data.get("error", ""):
            print(f"✅ PASS: Got 400 with 'allowedRoles must be an array'")
        else:
            print(f"⚠️  PASS: Got 400 but error message different: {data.get('error')}")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # Empty body
    print(f"\n[5g] PATCH with empty body → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={}
    )
    if resp.status_code == 400:
        data = resp.json()
        if "No supported fields to update" in data.get("error", ""):
            print(f"✅ PASS: Got 400 with 'No supported fields to update'")
        else:
            print(f"⚠️  PASS: Got 400 but error message different: {data.get('error')}")
    else:
        print(f"❌ FAIL: Expected 400, got {resp.status_code}")
    
    # PATCH on unknown key
    print(f"\n[5h] PATCH on /api/admin/feature-flags/nope → 404")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/nope",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "live"}
    )
    if resp.status_code == 404:
        print(f"✅ PASS: Got 404 for unknown key")
    else:
        print(f"❌ FAIL: Expected 404, got {resp.status_code}")
    
    # PUT method (not allowed)
    print(f"\n[5i] PUT /api/admin/feature-flags/{feature_key} → 405")
    resp = requests.put(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "live"}
    )
    if resp.status_code == 405:
        print(f"✅ PASS: Got 405 for PUT method")
    else:
        print(f"❌ FAIL: Expected 405, got {resp.status_code}")
    
    # DELETE method (not allowed)
    print(f"\n[5j] DELETE /api/admin/feature-flags/{feature_key} → 405")
    resp = requests.delete(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 405:
        print(f"✅ PASS: Got 405 for DELETE method")
    else:
        print(f"❌ FAIL: Expected 405, got {resp.status_code}")

def test_audit_log(admin_token):
    """TEST 6 — Audit log"""
    print("\n" + "="*80)
    print("TEST 6 — Audit log")
    print("="*80)
    
    # GET audit log (global)
    print(f"\n[6a] GET /api/admin/feature-flags/audit?limit=20")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/audit?limit=20",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        data = resp.json()
        entries = data.get("entries", [])
        print(f"✅ PASS: Got {len(entries)} audit entries")
        
        if len(entries) >= 5:
            print(f"✅ PASS: At least 5 entries (from previous PATCHes)")
            
            # Check first entry structure
            entry = entries[0]
            required_fields = ["id", "adminId", "adminEmail", "action", "featureKey", "scope", "scopeId", "oldValue", "newValue", "createdAt"]
            missing = [f for f in required_fields if f not in entry]
            if not missing:
                print(f"✅ PASS: Entry has all required fields")
            else:
                print(f"❌ FAIL: Entry missing fields: {missing}")
            
            # Check action
            if entry.get("action") == "feature.flag.updated":
                print(f"✅ PASS: action === 'feature.flag.updated'")
            else:
                print(f"⚠️  action: expected 'feature.flag.updated', got '{entry.get('action')}'")
            
            # Check scope
            if entry.get("scope") == "global":
                print(f"✅ PASS: scope === 'global'")
            else:
                print(f"⚠️  scope: expected 'global', got '{entry.get('scope')}'")
            
            # Check scopeId is null
            if entry.get("scopeId") is None:
                print(f"✅ PASS: scopeId === null")
            else:
                print(f"⚠️  scopeId: expected null, got '{entry.get('scopeId')}'")
            
            # Check entries are sorted by createdAt desc
            if len(entries) >= 2:
                first_time = datetime.fromisoformat(entries[0]["createdAt"].replace("Z", "+00:00"))
                second_time = datetime.fromisoformat(entries[1]["createdAt"].replace("Z", "+00:00"))
                if first_time >= second_time:
                    print(f"✅ PASS: Entries sorted by createdAt desc")
                else:
                    print(f"❌ FAIL: Entries not sorted correctly")
        else:
            print(f"⚠️  Only {len(entries)} entries found (expected at least 5)")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # GET audit log filtered by featureKey
    print(f"\n[6b] GET /api/admin/feature-flags/audit?featureKey=ocrReceiptScanner")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/audit?featureKey=ocrReceiptScanner",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        data = resp.json()
        entries = data.get("entries", [])
        print(f"✅ PASS: Got {len(entries)} entries for ocrReceiptScanner")
        
        # Check all entries are for ocrReceiptScanner
        all_match = all(e.get("featureKey") == "ocrReceiptScanner" for e in entries)
        if all_match:
            print(f"✅ PASS: All entries are for ocrReceiptScanner")
        else:
            print(f"❌ FAIL: Some entries are for other features")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # GET audit log for single feature (alternate path)
    print(f"\n[6c] GET /api/admin/feature-flags/ocrReceiptScanner/audit")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/ocrReceiptScanner/audit",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        data = resp.json()
        entries = data.get("entries", [])
        print(f"✅ PASS: Got {len(entries)} entries via alternate path")
        
        # Check all entries are for ocrReceiptScanner
        all_match = all(e.get("featureKey") == "ocrReceiptScanner" for e in entries)
        if all_match:
            print(f"✅ PASS: All entries are for ocrReceiptScanner")
        else:
            print(f"❌ FAIL: Some entries are for other features")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")

def test_diff_correctness(admin_token):
    """TEST 7 — Diff correctness"""
    print("\n" + "="*80)
    print("TEST 7 — Diff correctness")
    print("="*80)
    
    feature_key = "contractorImpactDashboard"
    
    # Get current state
    print(f"\n[7a] Get current state of {feature_key}")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code != 200:
        print(f"❌ FAIL: Could not get current state: {resp.status_code}")
        return
    
    current_flag = resp.json().get("flag")
    old_status = current_flag.get("globalStatus")
    print(f"Current globalStatus: {old_status}")
    
    # PATCH to beta
    print(f"\n[7b] PATCH {feature_key} globalStatus to 'beta'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "beta"}
    )
    if resp.status_code != 200:
        print(f"❌ FAIL: PATCH failed: {resp.status_code}")
        return
    
    print(f"✅ PASS: PATCH successful")
    
    # Get most recent audit entry
    print(f"\n[7c] Check most recent audit entry")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}/audit?limit=1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code != 200:
        print(f"❌ FAIL: Could not get audit log: {resp.status_code}")
        return
    
    entries = resp.json().get("entries", [])
    if not entries:
        print(f"❌ FAIL: No audit entries found")
        return
    
    entry = entries[0]
    old_value = entry.get("oldValue", {})
    new_value = entry.get("newValue", {})
    
    # Check oldValue.globalStatus
    if old_value.get("globalStatus") == old_status:
        print(f"✅ PASS: oldValue.globalStatus === '{old_status}' (prior state)")
    else:
        print(f"❌ FAIL: oldValue.globalStatus expected '{old_status}', got '{old_value.get('globalStatus')}'")
    
    # Check newValue.globalStatus
    if new_value.get("globalStatus") == "beta":
        print(f"✅ PASS: newValue.globalStatus === 'beta'")
    else:
        print(f"❌ FAIL: newValue.globalStatus expected 'beta', got '{new_value.get('globalStatus')}'")
    
    # Check only changed fields in diff
    if len(old_value) == 1 and len(new_value) == 1:
        print(f"✅ PASS: Only changed field (globalStatus) in oldValue/newValue")
    else:
        print(f"⚠️  oldValue has {len(old_value)} fields, newValue has {len(new_value)} fields (expected 1 each)")
    
    # Revert to demo
    print(f"\n[7d] Revert {feature_key} to 'demo'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "demo"}
    )
    if resp.status_code == 200:
        print(f"✅ PASS: Reverted to 'demo'")
    else:
        print(f"⚠️  Revert failed: {resp.status_code}")

def test_me_feature_access(admin_token, regular_token):
    """TEST 8 — /me/feature-access"""
    print("\n" + "="*80)
    print("TEST 8 — /me/feature-access")
    print("="*80)
    
    # Test as super admin
    print(f"\n[8a] GET /api/me/feature-access as super admin")
    resp = requests.get(
        f"{BASE_URL}/api/me/feature-access",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        data = resp.json()
        if data.get("authenticated") == True:
            print(f"✅ PASS: authenticated === true")
        else:
            print(f"❌ FAIL: authenticated should be true")
        
        access = data.get("access", {})
        if len(access) == 10:
            print(f"✅ PASS: access map has 10 keys")
        else:
            print(f"❌ FAIL: access map should have 10 keys, got {len(access)}")
        
        # Check all entries have allowed: true and reason: "super_admin"
        all_allowed = all(v.get("allowed") == True for v in access.values())
        all_super_admin = all(v.get("reason") == "super_admin" for v in access.values())
        
        if all_allowed:
            print(f"✅ PASS: All entries have allowed: true")
        else:
            print(f"❌ FAIL: Not all entries have allowed: true")
        
        if all_super_admin:
            print(f"✅ PASS: All entries have reason: 'super_admin'")
        else:
            print(f"❌ FAIL: Not all entries have reason: 'super_admin'")
        
        # Check each entry has feature object
        sample_key = "timeClock"
        if sample_key in access:
            entry = access[sample_key]
            feature = entry.get("feature")
            if feature:
                required = ["key", "name", "category", "status", "visibleToUsers"]
                missing = [f for f in required if f not in feature]
                if not missing:
                    print(f"✅ PASS: Entry has feature object with all required fields")
                else:
                    print(f"❌ FAIL: feature object missing fields: {missing}")
            else:
                print(f"❌ FAIL: Entry missing feature object")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test as guest (no auth)
    print(f"\n[8b] GET /api/me/feature-access as guest (no auth)")
    resp = requests.get(f"{BASE_URL}/api/me/feature-access")
    if resp.status_code == 200:
        data = resp.json()
        if data.get("authenticated") == False:
            print(f"✅ PASS: authenticated === false")
        else:
            print(f"❌ FAIL: authenticated should be false")
        
        access = data.get("access", {})
        if len(access) == 10:
            print(f"✅ PASS: access map has 10 keys")
        else:
            print(f"❌ FAIL: access map should have 10 keys, got {len(access)}")
        
        # Most should have allowed: false
        allowed_count = sum(1 for v in access.values() if v.get("allowed") == True)
        print(f"Guest has {allowed_count} allowed features (expected few or none)")
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    
    # Test as regular user
    print(f"\n[8c] GET /api/me/feature-access as regular user")
    if regular_token:
        resp = requests.get(
            f"{BASE_URL}/api/me/feature-access",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            access = data.get("access", {})
            
            # Check timeClock (live, allowedRoles: ['contractor','admin','super_admin'])
            # Regular user with role='user' should get allowed=false, reason='role_not_allowed'
            if "timeClock" in access:
                tc = access["timeClock"]
                if tc.get("allowed") == False and tc.get("reason") == "role_not_allowed":
                    print(f"✅ PASS: timeClock: allowed=false, reason='role_not_allowed' (user role not in allowedRoles)")
                else:
                    print(f"⚠️  timeClock: allowed={tc.get('allowed')}, reason={tc.get('reason')}")
            
            # Check rewardsEngine (demo)
            if "rewardsEngine" in access:
                re = access["rewardsEngine"]
                if re.get("allowed") == False and re.get("reason") == "demo_super_admin_only":
                    print(f"✅ PASS: rewardsEngine: allowed=false, reason='demo_super_admin_only'")
                else:
                    print(f"⚠️  rewardsEngine: allowed={re.get('allowed')}, reason={re.get('reason')}")
            
            # Check commercialB2B (live, requires verified_commercial tier)
            if "commercialB2B" in access:
                cb = access["commercialB2B"]
                if cb.get("allowed") == False and cb.get("reason") == "tier_too_low":
                    print(f"✅ PASS: commercialB2B: allowed=false, reason='tier_too_low' (default tier < verified_commercial)")
                else:
                    print(f"⚠️  commercialB2B: allowed={cb.get('allowed')}, reason={cb.get('reason')}")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
    else:
        print(f"⚠️  SKIP: No regular user token")

def test_persistence(admin_token):
    """TEST 9 — Persistence after restart-like scenario"""
    print("\n" + "="*80)
    print("TEST 9 — Persistence")
    print("="*80)
    
    feature_key = "ocrReceiptScanner"
    
    # PATCH to live
    print(f"\n[9a] PATCH {feature_key} globalStatus to 'live'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "live"}
    )
    if resp.status_code == 200:
        print(f"✅ PASS: PATCH successful")
    else:
        print(f"❌ FAIL: PATCH failed: {resp.status_code}")
        return
    
    # GET immediately
    print(f"\n[9b] GET {feature_key} immediately")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        flag = resp.json().get("flag")
        if flag and flag.get("globalStatus") == "live":
            print(f"✅ PASS: globalStatus === 'live'")
        else:
            print(f"❌ FAIL: globalStatus expected 'live', got '{flag.get('globalStatus') if flag else 'N/A'}'")
    else:
        print(f"❌ FAIL: GET failed: {resp.status_code}")
    
    # Wait 2 seconds
    print(f"\n[9c] Wait 2 seconds...")
    time.sleep(2)
    
    # GET again
    print(f"\n[9d] GET {feature_key} again")
    resp = requests.get(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        flag = resp.json().get("flag")
        if flag and flag.get("globalStatus") == "live":
            print(f"✅ PASS: globalStatus still 'live' (persisted)")
        else:
            print(f"❌ FAIL: globalStatus expected 'live', got '{flag.get('globalStatus') if flag else 'N/A'}'")
    else:
        print(f"❌ FAIL: GET failed: {resp.status_code}")
    
    # Revert to demo
    print(f"\n[9e] Revert {feature_key} to 'demo'")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/{feature_key}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "demo"}
    )
    if resp.status_code == 200:
        print(f"✅ PASS: Reverted to 'demo'")
    else:
        print(f"⚠️  Revert failed: {resp.status_code}")

def test_method_not_allowed(admin_token):
    """TEST 10 — Method not allowed"""
    print("\n" + "="*80)
    print("TEST 10 — Method not allowed")
    print("="*80)
    
    # DELETE /api/admin/feature-flags
    print(f"\n[10a] DELETE /api/admin/feature-flags → 405")
    resp = requests.delete(
        f"{BASE_URL}/api/admin/feature-flags",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 405:
        print(f"✅ PASS: Got 405 for DELETE")
    else:
        print(f"❌ FAIL: Expected 405, got {resp.status_code}")
    
    # POST /api/admin/feature-flags/timeClock
    print(f"\n[10b] POST /api/admin/feature-flags/timeClock → 405")
    resp = requests.post(
        f"{BASE_URL}/api/admin/feature-flags/timeClock",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "live"}
    )
    if resp.status_code == 405:
        print(f"✅ PASS: Got 405 for POST")
    else:
        print(f"❌ FAIL: Expected 405, got {resp.status_code}")

def cleanup(admin_token):
    """Cleanup — revert flags to seed defaults"""
    print("\n" + "="*80)
    print("CLEANUP — Revert flags to seed defaults")
    print("="*80)
    
    # Revert ocrReceiptScanner
    print(f"\n[Cleanup] Revert ocrReceiptScanner to demo")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/ocrReceiptScanner",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "demo"}
    )
    if resp.status_code == 200:
        print(f"✅ ocrReceiptScanner reverted")
    else:
        print(f"⚠️  ocrReceiptScanner revert failed: {resp.status_code}")
    
    # Revert contractorImpactDashboard
    print(f"\n[Cleanup] Revert contractorImpactDashboard to demo")
    resp = requests.patch(
        f"{BASE_URL}/api/admin/feature-flags/contractorImpactDashboard",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"globalStatus": "demo"}
    )
    if resp.status_code == 200:
        print(f"✅ contractorImpactDashboard reverted")
    else:
        print(f"⚠️  contractorImpactDashboard revert failed: {resp.status_code}")

def main():
    print("\n" + "="*80)
    print("Feature Controls Phase A — Backend Testing")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test credentials: {SUPER_ADMIN_EMAIL}")
    
    # Login as super admin
    print("\n[Setup] Login as super admin...")
    admin_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not admin_token:
        print("❌ FATAL: Could not login as super admin")
        return
    print(f"✅ Super admin logged in")
    
    # Get regular user token for later tests
    regular_token = signup("qa.fc1@example.com", "Test12345!", "QA FC1")
    if not regular_token:
        regular_token = login("qa.fc1@example.com", "Test12345!")
    
    # Run all tests
    test_auth_gating()
    test_seeding_idempotence(admin_token)
    test_get_single_and_unknown(admin_token)
    test_patch_valid_combinations(admin_token, SUPER_ADMIN_EMAIL)
    test_patch_validation_errors(admin_token)
    test_audit_log(admin_token)
    test_diff_correctness(admin_token)
    test_me_feature_access(admin_token, regular_token)
    test_persistence(admin_token)
    test_method_not_allowed(admin_token)
    cleanup(admin_token)
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)

if __name__ == "__main__":
    main()
