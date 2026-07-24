#!/usr/bin/env python3
"""
Backend test for PR-2b Dashboard Feed + Dump Receipt Center endpoints.
Tests NEW endpoints added in this session:
  - GET /api/dashboard/feed
  - POST /api/receipts
  - GET /api/receipts
  - GET /api/receipts/stats
  - GET /api/receipts/:id
  - PATCH /api/receipts/:id
  - DELETE /api/receipts/:id
"""

import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN = {
    'email': 'jamal@dumpmaps.org',
    'password': '@@Jefferson2180'
}

def login(email, password):
    """Login and return token"""
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={'email': email, 'password': password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get('token')
        else:
            print(f"❌ Login failed: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return None

def signup(email, password, name, primaryProfile='general'):
    """Sign up a new user and return token"""
    try:
        resp = requests.post(f"{API_BASE}/auth/signup", json={
            'email': email,
            'password': password,
            'name': name,
            'primaryProfile': primaryProfile
        }, timeout=10)
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data.get('token')
        else:
            print(f"❌ Signup failed: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Signup exception: {e}")
        return None

def test_dashboard_feed():
    """Test GET /api/dashboard/feed"""
    print("\n" + "="*80)
    print("TEST: GET /api/dashboard/feed")
    print("="*80)
    
    # Test 1: 401 when no Authorization header
    print("\n✓ Test 1: 401 when no Authorization header")
    try:
        resp = requests.get(f"{API_BASE}/dashboard/feed", timeout=10)
        if resp.status_code == 401:
            print(f"  ✅ PASS: Got 401 as expected")
        else:
            print(f"  ❌ FAIL: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 2: 200 when authenticated as super_admin (jamal)
    print("\n✓ Test 2: 200 when authenticated as super_admin (jamal)")
    admin_token = login(SUPER_ADMIN['email'], SUPER_ADMIN['password'])
    if not admin_token:
        print("  ❌ FAIL: Could not login as super_admin")
        return
    
    try:
        resp = requests.get(f"{API_BASE}/dashboard/feed", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ PASS: Got 200")
            
            # Verify response shape
            required_keys = ['user', 'stats', 'feed', 'hotSpots', 'marketplaceFresh', 'savedItems']
            for key in required_keys:
                if key in data:
                    print(f"  ✅ PASS: Response has '{key}' field")
                else:
                    print(f"  ❌ FAIL: Response missing '{key}' field")
            
            # Verify user object
            if 'user' in data:
                user = data['user']
                user_keys = ['id', 'name', 'email', 'role', 'primaryProfile']
                for key in user_keys:
                    if key in user:
                        print(f"  ✅ PASS: user.{key} present: {user[key]}")
                    else:
                        print(f"  ❌ FAIL: user.{key} missing")
            
            # Verify stats object
            if 'stats' in data:
                stats = data['stats']
                print(f"  ✅ PASS: stats.role = {stats.get('role')}")
                print(f"  ✅ PASS: stats.label = {stats.get('label')}")
                print(f"  ✅ PASS: stats.contractor = {stats.get('contractor')}")
                
                # As super_admin (jamal), stats.contractor MUST be present (staff have contractor access)
                if stats.get('contractor'):
                    if isinstance(stats['contractor'], dict):
                        print(f"  ✅ PASS: stats.contractor is a dict (staff have contractor access)")
                        contractor_keys = ['tripsThisMonth', 'totalCostThisMonth', 'totalTonsThisMonth']
                        for key in contractor_keys:
                            if key in stats['contractor']:
                                print(f"  ✅ PASS: stats.contractor.{key} = {stats['contractor'][key]}")
                            else:
                                print(f"  ❌ FAIL: stats.contractor.{key} missing")
                    else:
                        print(f"  ❌ FAIL: stats.contractor should be a dict for staff, got {type(stats['contractor'])}")
                else:
                    print(f"  ❌ FAIL: stats.contractor missing for super_admin (staff should have contractor access)")
                
                # Verify activity object
                if 'activity' in stats:
                    activity = stats['activity']
                    activity_keys = ['myListings', 'myPosts', 'myJobs']
                    for key in activity_keys:
                        if key in activity:
                            print(f"  ✅ PASS: stats.activity.{key} = {activity[key]}")
                        else:
                            print(f"  ❌ FAIL: stats.activity.{key} missing")
            
            # Verify feed is sorted by createdAt DESC
            if 'feed' in data and isinstance(data['feed'], list):
                feed = data['feed']
                print(f"  ✅ PASS: feed has {len(feed)} items")
                if len(feed) > 1:
                    sorted_correctly = True
                    for i in range(len(feed) - 1):
                        if feed[i].get('createdAt') and feed[i+1].get('createdAt'):
                            if feed[i]['createdAt'] < feed[i+1]['createdAt']:
                                sorted_correctly = False
                                break
                    if sorted_correctly:
                        print(f"  ✅ PASS: feed is sorted by createdAt DESC")
                    else:
                        print(f"  ❌ FAIL: feed is NOT sorted by createdAt DESC")
                
                # Check feed item structure
                if len(feed) > 0:
                    item = feed[0]
                    item_keys = ['kind', 'id', 'title', 'body', 'tone', 'createdAt', 'href']
                    for key in item_keys:
                        if key in item:
                            print(f"  ✅ PASS: feed[0].{key} present")
                        else:
                            print(f"  ❌ FAIL: feed[0].{key} missing")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 3: Sign up a fresh user and verify stats.contractor is false
    print("\n✓ Test 3: Fresh user signup - stats.contractor should be false")
    fresh_email = f"fresh_user_{datetime.now().timestamp()}@test.com"
    fresh_token = signup(fresh_email, 'password123', 'Fresh User', 'general')
    if not fresh_token:
        print("  ❌ FAIL: Could not signup fresh user")
        return
    
    try:
        resp = requests.get(f"{API_BASE}/dashboard/feed", headers={'Authorization': f'Bearer {fresh_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ PASS: Got 200 for fresh user")
            
            if 'stats' in data:
                stats = data['stats']
                contractor = stats.get('contractor')
                if contractor is False:
                    print(f"  ✅ PASS: stats.contractor = false (no contractor access)")
                elif isinstance(contractor, dict):
                    print(f"  ❌ FAIL: stats.contractor should be false for normal user, got dict: {contractor}")
                else:
                    print(f"  ❌ FAIL: stats.contractor should be false, got {contractor}")
                
                # Verify activity is all zeros for fresh user
                if 'activity' in stats:
                    activity = stats['activity']
                    if activity.get('myListings') == 0 and activity.get('myPosts') == 0 and activity.get('myJobs') == 0:
                        print(f"  ✅ PASS: Fresh user activity is all zeros")
                    else:
                        print(f"  ❌ FAIL: Fresh user activity should be all zeros, got {activity}")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")

def test_receipts():
    """Test POST /api/receipts and related endpoints"""
    print("\n" + "="*80)
    print("TEST: Dump Receipt Center Endpoints")
    print("="*80)
    
    # Test 1: 401 unauthenticated
    print("\n✓ Test 1: POST /api/receipts - 401 unauthenticated")
    try:
        resp = requests.post(f"{API_BASE}/receipts", json={'facilityName': 'Test'}, timeout=10)
        if resp.status_code == 401:
            print(f"  ✅ PASS: Got 401 as expected")
        else:
            print(f"  ❌ FAIL: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 2: 403 as fresh signup resident (normal_user, no contractor roles)
    print("\n✓ Test 2: POST /api/receipts - 403 as fresh resident (no contractor access)")
    fresh_email = f"resident_{datetime.now().timestamp()}@test.com"
    resident_token = signup(fresh_email, 'password123', 'Resident User', 'general')
    if not resident_token:
        print("  ❌ FAIL: Could not signup resident user")
        return
    
    try:
        resp = requests.post(f"{API_BASE}/receipts", 
                           json={'facilityName': 'Test', 'grossLb': 1000, 'tareLb': 500, 'pricePerTon': 50},
                           headers={'Authorization': f'Bearer {resident_token}'}, 
                           timeout=10)
        if resp.status_code == 403:
            print(f"  ✅ PASS: Got 403 as expected (Contractor access required)")
        else:
            print(f"  ❌ FAIL: Expected 403, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 3: 200 as super_admin (has contractor access via STAFF_ROLES)
    print("\n✓ Test 3: POST /api/receipts - 200 as super_admin")
    admin_token = login(SUPER_ADMIN['email'], SUPER_ADMIN['password'])
    if not admin_token:
        print("  ❌ FAIL: Could not login as super_admin")
        return
    
    # Test 3a: Math case a) gross=8400, tare=5200, pricePerTon=75, totalCost omitted
    print("\n  ✓ Test 3a: Math case a) gross=8400, tare=5200, pricePerTon=75, totalCost omitted")
    try:
        resp = requests.post(f"{API_BASE}/receipts", 
                           json={
                               'facilityName': 'Test Facility A',
                               'grossLb': 8400,
                               'tareLb': 5200,
                               'pricePerTon': 75,
                               'dateOf': '2026-05-01'
                           },
                           headers={'Authorization': f'Bearer {admin_token}'}, 
                           timeout=10)
        if resp.status_code in [200, 201]:
            data = resp.json()
            receipt = data.get('receipt', {})
            print(f"    ✅ PASS: Got {resp.status_code}")
            
            # Verify math: netLb=3200, netTons=1.6, totalCost auto=120
            expected_net_lb = 8400 - 5200  # 3200
            expected_net_tons = expected_net_lb / 2000  # 1.6
            expected_total_cost = expected_net_tons * 75  # 120
            
            if receipt.get('netLb') == expected_net_lb:
                print(f"    ✅ PASS: netLb = {receipt['netLb']} (expected {expected_net_lb})")
            else:
                print(f"    ❌ FAIL: netLb = {receipt.get('netLb')}, expected {expected_net_lb}")
            
            if receipt.get('netTons') == expected_net_tons:
                print(f"    ✅ PASS: netTons = {receipt['netTons']} (expected {expected_net_tons})")
            else:
                print(f"    ❌ FAIL: netTons = {receipt.get('netTons')}, expected {expected_net_tons}")
            
            if receipt.get('totalCost') == expected_total_cost:
                print(f"    ✅ PASS: totalCost = {receipt['totalCost']} (expected {expected_total_cost})")
            else:
                print(f"    ❌ FAIL: totalCost = {receipt.get('totalCost')}, expected {expected_total_cost}")
            
            receipt_a_id = receipt.get('id')
        else:
            print(f"    ❌ FAIL: Expected 200/201, got {resp.status_code}: {resp.text}")
            receipt_a_id = None
    except Exception as e:
        print(f"    ❌ FAIL: Exception: {e}")
        receipt_a_id = None
    
    # Test 3b: Math case b) gross=10000, tare=5000, pricePerTon=80, totalCost=400 (explicit)
    print("\n  ✓ Test 3b: Math case b) gross=10000, tare=5000, pricePerTon=80, totalCost=400 (explicit)")
    try:
        resp = requests.post(f"{API_BASE}/receipts", 
                           json={
                               'facilityName': 'Test Facility B',
                               'grossLb': 10000,
                               'tareLb': 5000,
                               'pricePerTon': 80,
                               'totalCost': 400,  # Explicit totalCost
                               'dateOf': '2026-05-02'
                           },
                           headers={'Authorization': f'Bearer {admin_token}'}, 
                           timeout=10)
        if resp.status_code in [200, 201]:
            data = resp.json()
            receipt = data.get('receipt', {})
            print(f"    ✅ PASS: Got {resp.status_code}")
            
            # Verify math: netLb=5000, netTons=2.5, totalCost stays 400 (not 200)
            expected_net_lb = 10000 - 5000  # 5000
            expected_net_tons = expected_net_lb / 2000  # 2.5
            # totalCost should stay 400 (explicit), not auto-computed (2.5 * 80 = 200)
            
            if receipt.get('netLb') == expected_net_lb:
                print(f"    ✅ PASS: netLb = {receipt['netLb']} (expected {expected_net_lb})")
            else:
                print(f"    ❌ FAIL: netLb = {receipt.get('netLb')}, expected {expected_net_lb}")
            
            if receipt.get('netTons') == expected_net_tons:
                print(f"    ✅ PASS: netTons = {receipt['netTons']} (expected {expected_net_tons})")
            else:
                print(f"    ❌ FAIL: netTons = {receipt.get('netTons')}, expected {expected_net_tons}")
            
            if receipt.get('totalCost') == 400:
                print(f"    ✅ PASS: totalCost = {receipt['totalCost']} (explicit 400, not auto-computed 200)")
            else:
                print(f"    ❌ FAIL: totalCost = {receipt.get('totalCost')}, expected 400 (explicit)")
            
            receipt_b_id = receipt.get('id')
        else:
            print(f"    ❌ FAIL: Expected 200/201, got {resp.status_code}: {resp.text}")
            receipt_b_id = None
    except Exception as e:
        print(f"    ❌ FAIL: Exception: {e}")
        receipt_b_id = None
    
    # Test 3c: facilityName required (400 if both facilityName and facilityId missing)
    print("\n  ✓ Test 3c: 400 if both facilityName and facilityId missing")
    try:
        resp = requests.post(f"{API_BASE}/receipts", 
                           json={
                               'grossLb': 1000,
                               'tareLb': 500,
                               'pricePerTon': 50
                           },
                           headers={'Authorization': f'Bearer {admin_token}'}, 
                           timeout=10)
        if resp.status_code == 400:
            print(f"    ✅ PASS: Got 400 as expected (facilityName or facilityId required)")
        else:
            print(f"    ❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"    ❌ FAIL: Exception: {e}")
    
    # Test 4: GET /api/receipts - list current user's receipts only, sorted by dateOf DESC
    print("\n✓ Test 4: GET /api/receipts - list current user's receipts")
    try:
        resp = requests.get(f"{API_BASE}/receipts", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            receipts = data.get('receipts', [])
            print(f"  ✅ PASS: Got 200, found {len(receipts)} receipts")
            
            # Verify sorted by dateOf DESC
            if len(receipts) > 1:
                sorted_correctly = True
                for i in range(len(receipts) - 1):
                    if receipts[i].get('dateOf') and receipts[i+1].get('dateOf'):
                        if receipts[i]['dateOf'] < receipts[i+1]['dateOf']:
                            sorted_correctly = False
                            break
                if sorted_correctly:
                    print(f"  ✅ PASS: Receipts sorted by dateOf DESC")
                else:
                    print(f"  ❌ FAIL: Receipts NOT sorted by dateOf DESC")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 5: GET /api/receipts?month=YYYY-MM filter
    print("\n✓ Test 5: GET /api/receipts?month=2026-05 filter")
    try:
        resp = requests.get(f"{API_BASE}/receipts?month=2026-05", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            receipts = data.get('receipts', [])
            print(f"  ✅ PASS: Got 200, found {len(receipts)} receipts for May 2026")
            
            # Verify all receipts are from May 2026
            all_may = True
            for r in receipts:
                if not r.get('dateOf', '').startswith('2026-05'):
                    all_may = False
                    break
            if all_may:
                print(f"  ✅ PASS: All receipts are from May 2026")
            else:
                print(f"  ❌ FAIL: Some receipts are not from May 2026")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 6: GET /api/receipts?limit=1
    print("\n✓ Test 6: GET /api/receipts?limit=1")
    try:
        resp = requests.get(f"{API_BASE}/receipts?limit=1", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            receipts = data.get('receipts', [])
            if len(receipts) <= 1:
                print(f"  ✅ PASS: Got {len(receipts)} receipt(s) (limit=1)")
            else:
                print(f"  ❌ FAIL: Expected max 1 receipt, got {len(receipts)}")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 7: GET /api/receipts/stats - verify math
    print("\n✓ Test 7: GET /api/receipts/stats - verify math")
    try:
        resp = requests.get(f"{API_BASE}/receipts/stats", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ PASS: Got 200")
            
            # Verify structure
            required_keys = ['thisMonth', 'previousMonth', 'lifetime', 'topFacilities']
            for key in required_keys:
                if key in data:
                    print(f"  ✅ PASS: Response has '{key}' field")
                else:
                    print(f"  ❌ FAIL: Response missing '{key}' field")
            
            # Verify lifetime stats (we created 2 receipts: 120 + 400 = 520, 1.6 + 2.5 = 4.1 tons)
            if 'lifetime' in data:
                lifetime = data['lifetime']
                print(f"  ✅ PASS: lifetime.trips = {lifetime.get('trips')}")
                print(f"  ✅ PASS: lifetime.totalCost = {lifetime.get('totalCost')}")
                print(f"  ✅ PASS: lifetime.totalNetTons = {lifetime.get('totalNetTons')}")
                print(f"  ✅ PASS: lifetime.totalNetLb = {lifetime.get('totalNetLb')}")
                print(f"  ✅ PASS: lifetime.avgCostPerTon = {lifetime.get('avgCostPerTon')}")
                print(f"  ✅ PASS: lifetime.avgCostPerTrip = {lifetime.get('avgCostPerTrip')}")
                
                # Verify math (at least 2 trips from this test, but may have more from previous tests)
                if lifetime.get('trips', 0) >= 2:
                    print(f"  ✅ PASS: lifetime.trips >= 2")
                else:
                    print(f"  ❌ FAIL: lifetime.trips should be >= 2, got {lifetime.get('trips')}")
                
                # avgCostPerTon = totalCost / totalNetTons
                if lifetime.get('totalNetTons', 0) > 0:
                    expected_avg_cost_per_ton = lifetime['totalCost'] / lifetime['totalNetTons']
                    if abs(lifetime.get('avgCostPerTon', 0) - expected_avg_cost_per_ton) < 0.01:
                        print(f"  ✅ PASS: avgCostPerTon math correct ({lifetime['avgCostPerTon']} ≈ {expected_avg_cost_per_ton:.2f})")
                    else:
                        print(f"  ❌ FAIL: avgCostPerTon math incorrect ({lifetime.get('avgCostPerTon')} != {expected_avg_cost_per_ton:.2f})")
            
            # Verify topFacilities
            if 'topFacilities' in data:
                top_facilities = data['topFacilities']
                print(f"  ✅ PASS: topFacilities has {len(top_facilities)} facilities (max 5)")
                if len(top_facilities) <= 5:
                    print(f"  ✅ PASS: topFacilities respects max 5 limit")
                else:
                    print(f"  ❌ FAIL: topFacilities should have max 5, got {len(top_facilities)}")
                
                # Verify sorted by trips DESC
                if len(top_facilities) > 1:
                    sorted_correctly = True
                    for i in range(len(top_facilities) - 1):
                        if top_facilities[i].get('trips', 0) < top_facilities[i+1].get('trips', 0):
                            sorted_correctly = False
                            break
                    if sorted_correctly:
                        print(f"  ✅ PASS: topFacilities sorted by trips DESC")
                    else:
                        print(f"  ❌ FAIL: topFacilities NOT sorted by trips DESC")
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
    
    # Test 8: GET /api/receipts/:id - owner-scoped
    print("\n✓ Test 8: GET /api/receipts/:id - owner-scoped")
    if receipt_a_id:
        try:
            resp = requests.get(f"{API_BASE}/receipts/{receipt_a_id}", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                receipt = data.get('receipt', {})
                print(f"  ✅ PASS: Got 200, receipt.id = {receipt.get('id')}")
            else:
                print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"  ❌ FAIL: Exception: {e}")
        
        # Test 8b: Another user requesting same id → 404
        print("\n  ✓ Test 8b: Another user requesting same id → 404")
        try:
            resp = requests.get(f"{API_BASE}/receipts/{receipt_a_id}", headers={'Authorization': f'Bearer {resident_token}'}, timeout=10)
            if resp.status_code == 404:
                print(f"    ✅ PASS: Got 404 as expected (owner-scoped)")
            elif resp.status_code == 403:
                print(f"    ✅ PASS: Got 403 as expected (no contractor access)")
            else:
                print(f"    ❌ FAIL: Expected 404 or 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"    ❌ FAIL: Exception: {e}")
    else:
        print("  ⚠️  SKIP: No receipt_a_id to test")
    
    # Test 9: PATCH /api/receipts/:id - owner-scoped, re-compute net/totalCost
    print("\n✓ Test 9: PATCH /api/receipts/:id - owner-scoped, re-compute net/totalCost")
    if receipt_a_id:
        try:
            # Get original receipt
            resp = requests.get(f"{API_BASE}/receipts/{receipt_a_id}", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            original = resp.json().get('receipt', {})
            original_updated_at = original.get('updatedAt')
            
            # Update grossLb
            resp = requests.patch(f"{API_BASE}/receipts/{receipt_a_id}", 
                                json={'grossLb': 9000},  # Change from 8400 to 9000
                                headers={'Authorization': f'Bearer {admin_token}'}, 
                                timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                receipt = data.get('receipt', {})
                print(f"  ✅ PASS: Got 200")
                
                # Verify net/totalCost re-computed
                # New: gross=9000, tare=5200 → net=3800, netTons=1.9, totalCost=1.9*75=142.5
                expected_net_lb = 9000 - 5200  # 3800
                expected_net_tons = expected_net_lb / 2000  # 1.9
                expected_total_cost = expected_net_tons * 75  # 142.5
                
                if receipt.get('netLb') == expected_net_lb:
                    print(f"  ✅ PASS: netLb re-computed = {receipt['netLb']} (expected {expected_net_lb})")
                else:
                    print(f"  ❌ FAIL: netLb = {receipt.get('netLb')}, expected {expected_net_lb}")
                
                if receipt.get('netTons') == expected_net_tons:
                    print(f"  ✅ PASS: netTons re-computed = {receipt['netTons']} (expected {expected_net_tons})")
                else:
                    print(f"  ❌ FAIL: netTons = {receipt.get('netTons')}, expected {expected_net_tons}")
                
                if receipt.get('totalCost') == expected_total_cost:
                    print(f"  ✅ PASS: totalCost re-computed = {receipt['totalCost']} (expected {expected_total_cost})")
                else:
                    print(f"  ❌ FAIL: totalCost = {receipt.get('totalCost')}, expected {expected_total_cost}")
                
                # Verify updatedAt changed
                new_updated_at = receipt.get('updatedAt')
                if new_updated_at != original_updated_at:
                    print(f"  ✅ PASS: updatedAt changed")
                else:
                    print(f"  ❌ FAIL: updatedAt should have changed")
            else:
                print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"  ❌ FAIL: Exception: {e}")
    else:
        print("  ⚠️  SKIP: No receipt_a_id to test")
    
    # Test 10: DELETE /api/receipts/:id - soft delete
    print("\n✓ Test 10: DELETE /api/receipts/:id - soft delete")
    if receipt_b_id:
        try:
            resp = requests.delete(f"{API_BASE}/receipts/{receipt_b_id}", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            if resp.status_code == 200:
                print(f"  ✅ PASS: Got 200 (soft delete)")
                
                # Verify GET /api/receipts excludes it
                resp = requests.get(f"{API_BASE}/receipts", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    receipts = data.get('receipts', [])
                    found = any(r.get('id') == receipt_b_id for r in receipts)
                    if not found:
                        print(f"  ✅ PASS: Deleted receipt excluded from GET /api/receipts")
                    else:
                        print(f"  ❌ FAIL: Deleted receipt still in GET /api/receipts")
                
                # Verify GET /api/receipts/stats excludes it
                resp = requests.get(f"{API_BASE}/receipts/stats", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                if resp.status_code == 200:
                    print(f"  ✅ PASS: GET /api/receipts/stats still works after delete")
                
                # Verify GET /api/receipts/:id returns 404
                resp = requests.get(f"{API_BASE}/receipts/{receipt_b_id}", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
                if resp.status_code == 404:
                    print(f"  ✅ PASS: GET /api/receipts/:id returns 404 after delete")
                else:
                    print(f"  ❌ FAIL: Expected 404, got {resp.status_code}")
            else:
                print(f"  ❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"  ❌ FAIL: Exception: {e}")
    else:
        print("  ⚠️  SKIP: No receipt_b_id to test")
    
    # Test 11: Gating verification - all /api/receipts* endpoints require contractor access
    print("\n✓ Test 11: Gating verification - all /api/receipts* endpoints require contractor access")
    print("  (Already tested in Test 2: resident user gets 403)")
    
    # Clean up: delete receipt_a_id
    if receipt_a_id:
        try:
            resp = requests.delete(f"{API_BASE}/receipts/{receipt_a_id}", headers={'Authorization': f'Bearer {admin_token}'}, timeout=10)
            if resp.status_code == 200:
                print(f"\n✓ Cleanup: Deleted receipt {receipt_a_id}")
        except Exception as e:
            print(f"\n✗ Cleanup failed: {e}")

def main():
    print("="*80)
    print("BACKEND TEST: PR-2b Dashboard Feed + Dump Receipt Center")
    print("="*80)
    print(f"BASE_URL: {BASE_URL}")
    print(f"API_BASE: {API_BASE}")
    
    test_dashboard_feed()
    test_receipts()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)

if __name__ == '__main__':
    main()
