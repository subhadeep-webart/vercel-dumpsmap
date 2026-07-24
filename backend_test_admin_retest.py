#!/usr/bin/env python3
"""
Quick re-test on the 2 previously failing admin endpoints after main agent removed the shadow endpoints.
"""
import requests
import json

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}
ADMIN = {"email": "aj@bisonjunk.com", "password": "admin123"}

def login(creds):
    """Login and return token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def test_admin_users_endpoints():
    """Test GET /api/admin/users with various filters"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/admin/users?limit=5 (enriched fields check)")
    print("="*80)
    
    token = login(SUPER_ADMIN)
    if not token:
        print("❌ Failed to login as super_admin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: limit=5 with enriched fields
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=5", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        users = data.get("users", [])
        
        print(f"✅ Returned {len(users)} users")
        
        # Check if limit is respected
        if len(users) > 5:
            print(f"❌ FAILED: Expected max 5 users, got {len(users)}")
            return False
        else:
            print(f"✅ PASSED: Limit respected (returned {len(users)} users)")
        
        # Check enriched fields
        if len(users) > 0:
            first_user = users[0]
            required_fields = ["marketplaceCount", "jobsPosted", "alertsPosted"]
            missing_fields = [f for f in required_fields if f not in first_user]
            
            if missing_fields:
                print(f"❌ FAILED: Missing enriched fields: {missing_fields}")
                print(f"User object keys: {list(first_user.keys())}")
                return False
            else:
                print(f"✅ PASSED: All enriched fields present")
                print(f"   Sample user: {first_user.get('email')} - marketplaceCount={first_user.get('marketplaceCount')}, jobsPosted={first_user.get('jobsPosted')}, alertsPosted={first_user.get('alertsPosted')}")
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
    
    # Test 2: role=admin filter
    print("\n" + "="*80)
    print("TEST 2: GET /api/admin/users?role=admin (role filter check)")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?role=admin", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        users = data.get("users", [])
        
        print(f"✅ Returned {len(users)} users with role=admin")
        
        # Check if all returned users have role=admin
        non_admin_users = [u for u in users if u.get("role") != "admin"]
        
        if non_admin_users:
            print(f"❌ FAILED: Found {len(non_admin_users)} non-admin users in results")
            for u in non_admin_users[:3]:
                print(f"   - {u.get('email')} has role={u.get('role')}")
            return False
        else:
            print(f"✅ PASSED: All returned users have role=admin")
            # Check if aj@bisonjunk.com is in the list
            aj_found = any(u.get("email") == "aj@bisonjunk.com" for u in users)
            if aj_found:
                print(f"✅ PASSED: aj@bisonjunk.com found in admin users")
            else:
                print(f"⚠️  WARNING: aj@bisonjunk.com not found in admin users")
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
    
    # Test 3: status=active filter
    print("\n" + "="*80)
    print("TEST 3: GET /api/admin/users?status=active (status filter check)")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?status=active", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        users = data.get("users", [])
        
        print(f"✅ Returned {len(users)} users with status=active")
        
        # Check if all returned users have accountStatus=active
        non_active_users = [u for u in users if u.get("accountStatus") != "active"]
        
        if non_active_users:
            print(f"❌ FAILED: Found {len(non_active_users)} non-active users in results")
            for u in non_active_users[:3]:
                print(f"   - {u.get('email')} has accountStatus={u.get('accountStatus')}")
            return False
        else:
            print(f"✅ PASSED: All returned users have accountStatus=active")
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
    
    # Test 4: q=jamal search
    print("\n" + "="*80)
    print("TEST 4: GET /api/admin/users?q=jamal (search filter check)")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?q=jamal", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        users = data.get("users", [])
        
        print(f"✅ Returned {len(users)} users matching 'jamal'")
        
        # Check if results contain jamal in name or email
        if len(users) == 0:
            print(f"❌ FAILED: No users found matching 'jamal'")
            return False
        
        # Check if jamal@dumpmaps.org is in the results
        jamal_found = any("jamal" in u.get("email", "").lower() or "jamal" in u.get("name", "").lower() for u in users)
        
        if jamal_found:
            print(f"✅ PASSED: Found users matching 'jamal'")
            for u in users:
                print(f"   - {u.get('email')} ({u.get('name')})")
        else:
            print(f"❌ FAILED: No users with 'jamal' in name or email")
            return False
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
    
    return True

def test_admin_analytics_endpoint():
    """Test GET /api/admin/analytics (7 expected keys)"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/admin/analytics (7 expected keys check)")
    print("="*80)
    
    token = login(SUPER_ADMIN)
    if not token:
        print("❌ Failed to login as super_admin")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/analytics", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        
        # Expected 7 keys
        expected_keys = [
            "trendingFacilities",
            "busiestFacilities",
            "fastestMoving",
            "mostActiveUsers",
            "topMarketCategories",
            "activeJobsByCategory",
            "topAlertTypes"
        ]
        
        print(f"Response keys: {list(data.keys())}")
        
        missing_keys = [k for k in expected_keys if k not in data]
        extra_keys = [k for k in data.keys() if k not in expected_keys and k != "generatedAt"]
        
        if missing_keys:
            print(f"❌ FAILED: Missing expected keys: {missing_keys}")
            return False
        
        if extra_keys:
            print(f"⚠️  WARNING: Extra keys found (old endpoint?): {extra_keys}")
            # Check if this is the old endpoint structure
            if "totals" in data or "topMaterials" in data or "topFacilities" in data:
                print(f"❌ FAILED: Old endpoint structure detected! Duplicate endpoint still exists.")
                return False
        
        print(f"✅ PASSED: All 7 expected keys present")
        
        # Verify each key is an array
        for key in expected_keys:
            value = data.get(key)
            if not isinstance(value, list):
                print(f"❌ FAILED: {key} is not an array (got {type(value).__name__})")
                return False
            else:
                print(f"   ✅ {key}: array with {len(value)} items")
        
        return True
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("ADMIN ENDPOINTS RE-TEST (After Shadow Endpoint Removal)")
    print("="*80)
    
    results = {
        "admin_users": False,
        "admin_analytics": False
    }
    
    # Test 1-4: Admin users endpoints
    results["admin_users"] = test_admin_users_endpoints()
    
    # Test 5: Admin analytics endpoint
    results["admin_analytics"] = test_admin_analytics_endpoint()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASSED" if passed_flag else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Shadow endpoints successfully removed!")
        return True
    else:
        print("\n❌ SOME TESTS FAILED - Shadow endpoints may still exist")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
