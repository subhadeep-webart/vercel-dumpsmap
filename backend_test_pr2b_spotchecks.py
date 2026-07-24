#!/usr/bin/env python3
"""
PR-2b Refactor Phase 1 - Spot-checks for unrelated routes
Tests 4 routes that were NOT extracted to confirm no regression
"""

import requests
import json
import os

# Load base URL from .env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}

def test_spot_checks():
    """Run 4 spot-checks on unrelated routes"""
    print("\n" + "="*80)
    print("PR-2b REFACTOR PHASE 1 - SPOT-CHECKS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print("="*80)
    
    results = []
    
    # Spot-check 1: POST /api/auth/login (existing, NOT extracted)
    print("\n--- Spot-check 1: POST /api/auth/login ---")
    try:
        resp = requests.post(f"{API_URL}/auth/login", json=SUPER_ADMIN, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'token' in data and 'user' in data:
                print(f"✅ Login successful: {data['user'].get('name', 'Unknown')}")
                token = data['token']
                results.append(True)
            else:
                print(f"❌ Login response missing token or user")
                results.append(False)
        else:
            print(f"❌ Login failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Login error: {e}")
        results.append(False)
    
    # Spot-check 2: GET /api/facilities (existing, NOT extracted)
    print("\n--- Spot-check 2: GET /api/facilities ---")
    try:
        resp = requests.get(f"{API_URL}/facilities?status=active&limit=5", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            facilities = data.get('facilities', [])
            if len(facilities) > 0:
                print(f"✅ Facilities endpoint working: returned {len(facilities)} facilities")
                print(f"   Sample: {facilities[0].get('name', 'Unknown')}")
                results.append(True)
            else:
                print(f"⚠️  Facilities endpoint returned 0 facilities (may be expected)")
                results.append(True)  # Not a failure, just empty
        else:
            print(f"❌ Facilities failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Facilities error: {e}")
        results.append(False)
    
    # Spot-check 3: GET /api/admin/facility-imports?status=pending (existing, NOT extracted)
    print("\n--- Spot-check 3: GET /api/admin/facility-imports?status=pending ---")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{API_URL}/admin/facility-imports?status=pending&limit=5", 
                          headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            imports = data.get('imports', [])
            counts = data.get('counts', {})
            print(f"✅ Facility imports endpoint working: {counts.get('pending', 0)} pending imports")
            if len(imports) > 0:
                print(f"   Sample: {imports[0].get('normalizedData', {}).get('name', 'Unknown')}")
            results.append(True)
        else:
            print(f"❌ Facility imports failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Facility imports error: {e}")
        results.append(False)
    
    # Spot-check 4: GET /api/non-existent → 404 (catch-all still fires)
    print("\n--- Spot-check 4: GET /api/non-existent (should return 404) ---")
    try:
        resp = requests.get(f"{API_URL}/non-existent-route-12345", timeout=10)
        if resp.status_code == 404:
            print(f"✅ Catch-all 404 working correctly")
            results.append(True)
        else:
            print(f"❌ Expected 404, got: {resp.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Catch-all test error: {e}")
        results.append(False)
    
    # Final summary
    print("\n" + "="*80)
    print("SPOT-CHECKS SUMMARY")
    print("="*80)
    
    labels = [
        "POST /api/auth/login",
        "GET /api/facilities",
        "GET /api/admin/facility-imports",
        "GET /api/non-existent (404)"
    ]
    
    for i, (label, passed) in enumerate(zip(labels, results), 1):
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{i}. {label}: {status}")
    
    all_passed = all(results)
    print("\n" + "="*80)
    if all_passed:
        print("🎉 ALL SPOT-CHECKS PASSED")
    else:
        print("⚠️  SOME SPOT-CHECKS FAILED")
    print("="*80)
    
    return all_passed

if __name__ == "__main__":
    success = test_spot_checks()
    exit(0 if success else 1)
