#!/usr/bin/env python3
"""
Backend test for /api/recommendations/best-option endpoint
Tests all 13 scenarios from the review request
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def print_test(step, description):
    print(f"\n{'='*80}")
    print(f"TEST {step}: {description}")
    print('='*80)

def print_pass(message):
    print(f"✅ PASS: {message}")

def print_fail(message):
    print(f"❌ FAIL: {message}")

def print_info(message):
    print(f"ℹ️  INFO: {message}")

# Step 0: Login to get token
print_test(0, "Login as super admin to get token")
try:
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if login_resp.status_code == 200:
        token = login_resp.json().get('token')
        print_pass(f"Login successful, token obtained")
        print_info(f"Token: {token[:20]}...")
    else:
        print_fail(f"Login failed: {login_resp.status_code} - {login_resp.text}")
        token = None
except Exception as e:
    print_fail(f"Login error: {e}")
    token = None

# Test 1: Happy path no material
print_test(1, "Happy path no material - GET /api/recommendations/best-option?lat=37.3382&lng=-121.8863&maxKm=50&limit=5")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50,
        "limit": 5
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Check response shape
        required_keys = ['topPick', 'alternatives', 'scoredAt', 'signals']
        missing_keys = [k for k in required_keys if k not in data]
        if missing_keys:
            print_fail(f"Missing keys: {missing_keys}")
        else:
            print_pass("All required keys present")
        
        # Check topPick
        if data.get('topPick'):
            top_pick = data['topPick']
            print_info(f"topPick keys: {list(top_pick.keys())}")
            
            # Check facility fields
            if 'facility' in top_pick:
                facility = top_pick['facility']
                required_facility_fields = ['name', 'address', 'distanceKm', 'id']
                missing_facility_fields = [f for f in required_facility_fields if f not in facility]
                if missing_facility_fields:
                    print_fail(f"Missing facility fields: {missing_facility_fields}")
                else:
                    print_pass(f"Facility has all required fields: {facility['name']}, {facility['distanceKm']} km")
            
            # Check score
            if 'score' in top_pick and isinstance(top_pick['score'], (int, float)):
                print_pass(f"Score is a number: {top_pick['score']}")
            else:
                print_fail(f"Score is not a number: {top_pick.get('score')}")
            
            # Check scorePct
            if 'scorePct' in top_pick:
                score_pct = top_pick['scorePct']
                if 0 <= score_pct <= 100:
                    print_pass(f"scorePct is between 0 and 100: {score_pct}")
                else:
                    print_fail(f"scorePct out of range: {score_pct}")
            
            # Check reasons and penalties
            if 'reasons' in top_pick and isinstance(top_pick['reasons'], list):
                print_pass(f"Reasons array present with {len(top_pick['reasons'])} items")
            if 'penalties' in top_pick and isinstance(top_pick['penalties'], list):
                print_pass(f"Penalties array present with {len(top_pick['penalties'])} items")
            
            # Check breakdown
            if 'breakdown' in top_pick:
                breakdown = top_pick['breakdown']
                print_info(f"Breakdown: {breakdown}")
                print_pass(f"Breakdown present with {len(breakdown)} components")
        else:
            print_fail("topPick is null or missing")
        
        # Check alternatives
        if 'alternatives' in data:
            alternatives = data['alternatives']
            if len(alternatives) <= 4:  # limit - 1
                print_pass(f"Alternatives length ≤ 4: {len(alternatives)}")
            else:
                print_fail(f"Alternatives length > 4: {len(alternatives)}")
        
        # Check signals
        if 'signals' in data:
            signals = data['signals']
            print_info(f"Signals: {signals}")
            if signals.get('eligibleCount', 0) > 0:
                print_pass(f"eligibleCount > 0: {signals['eligibleCount']}")
            if signals.get('totalConsidered', 0) > 0:
                print_pass(f"totalConsidered > 0: {signals['totalConsidered']}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 2: With material that exists
print_test(2, "With material that exists - construction debris")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "material": "construction debris",
        "maxKm": 50,
        "limit": 3
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        
        if data.get('topPick'):
            top_pick = data['topPick']
            
            # Check for material in reasons
            reasons = top_pick.get('reasons', [])
            material_reason = [r for r in reasons if 'construction debris' in r.lower() or 'accepts' in r.lower()]
            if material_reason:
                print_pass(f"Material reason found: {material_reason[0]}")
            else:
                print_info(f"Material reason not found in reasons: {reasons}")
            
            # Check breakdown.material > 0
            breakdown = top_pick.get('breakdown', {})
            material_score = breakdown.get('material', 0)
            if material_score > 0:
                print_pass(f"breakdown.material > 0: {material_score}")
            else:
                print_fail(f"breakdown.material not > 0: {material_score}")
            
            # Check that some facilities were excluded
            signals = data.get('signals', {})
            eligible = signals.get('eligibleCount', 0)
            total = signals.get('totalConsidered', 0)
            if eligible < total:
                print_pass(f"Some facilities excluded: eligible={eligible}, total={total}")
            else:
                print_info(f"No facilities excluded: eligible={eligible}, total={total}")
            
            # Check that topPick accepts the material (priority logic)
            facility = top_pick.get('facility', {})
            print_info(f"Top pick: {facility.get('name')}, distance: {facility.get('distanceKm')} km")
        else:
            print_fail("topPick is null")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 3: Material no one accepts
print_test(3, "Material no one accepts - lithium_battery_xyz999")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "material": "lithium_battery_xyz999",
        "maxKm": 50
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        
        top_pick = data.get('topPick')
        signals = data.get('signals', {})
        
        if top_pick is None:
            print_pass("topPick is null (expected for non-existent material)")
            if 'reason' in signals:
                print_pass(f"Signals.reason present: {signals['reason']}")
            if signals.get('eligibleCount', 0) == 0:
                print_pass("eligibleCount = 0 (expected)")
        else:
            # If topPick exists, check material score
            breakdown = top_pick.get('breakdown', {})
            material_score = breakdown.get('material', 0)
            if material_score <= 8:
                print_pass(f"topPick exists with partial/no match: material score = {material_score}")
            else:
                print_fail(f"topPick exists with high material score: {material_score}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 4: Validation - missing lat/lng
print_test(4, "Validation: missing lat/lng")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option")
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 400:
        data = resp.json()
        if 'error' in data and 'lat and lng required' in data['error']:
            print_pass(f"Correct 400 error: {data['error']}")
        else:
            print_fail(f"Wrong error message: {data}")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 5: Validation - invalid lat
print_test(5, "Validation: invalid lat")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": "not-a-number",
        "lng": -121.8863
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 400:
        print_pass("Correct 400 error for invalid lat")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 6: Tiny radius
print_test(6, "Tiny radius - maxKm=1")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 1
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        signals = data.get('signals', {})
        eligible = signals.get('eligibleCount', 0)
        
        print_info(f"eligibleCount: {eligible}")
        
        if eligible == 0:
            print_pass("eligibleCount = 0 (expected for tiny radius)")
            if data.get('topPick') is None:
                print_pass("topPick is null (expected)")
            if 'reason' in signals and '1 km' in signals['reason']:
                print_pass(f"Signals.reason mentions radius: {signals['reason']}")
        else:
            print_info(f"Some facilities found within 1 km: {eligible}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 7: Score breakdown sanity check
print_test(7, "Score breakdown sanity check")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50,
        "limit": 5
    })
    
    if resp.status_code == 200:
        data = resp.json()
        
        if data.get('topPick'):
            top_pick = data['topPick']
            score = top_pick.get('score', 0)
            breakdown = top_pick.get('breakdown', {})
            
            breakdown_sum = sum(breakdown.values())
            
            print_info(f"Score: {score}")
            print_info(f"Breakdown: {breakdown}")
            print_info(f"Breakdown sum: {breakdown_sum}")
            
            if abs(score - breakdown_sum) <= 1:
                print_pass(f"Score matches breakdown sum (within ±1): {score} ≈ {breakdown_sum}")
            else:
                print_fail(f"Score mismatch: {score} != {breakdown_sum}")
            
            # Check all expected breakdown keys
            expected_keys = ['proximity', 'open', 'wait', 'contractor', 'community', 'reviews', 'hazards', 'pricing', 'hotspots', 'material']
            missing_keys = [k for k in expected_keys if k not in breakdown]
            if missing_keys:
                print_fail(f"Missing breakdown keys: {missing_keys}")
            else:
                print_pass("All expected breakdown keys present")
        else:
            print_fail("topPick is null")
    else:
        print_fail(f"Request failed: {resp.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 8: Reasons array format
print_test(8, "Reasons array format - check for emoji prefixes")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50
    })
    
    if resp.status_code == 200:
        data = resp.json()
        
        if data.get('topPick'):
            reasons = data['topPick'].get('reasons', [])
            
            if reasons:
                print_info(f"Reasons: {reasons}")
                
                # Check if each reason is a string
                all_strings = all(isinstance(r, str) for r in reasons)
                if all_strings:
                    print_pass("All reasons are strings")
                else:
                    print_fail("Not all reasons are strings")
                
                # Check for emoji prefixes (common emojis used in the code)
                emoji_prefixes = ['📍', '✅', '⚡', '👥', '⭐', '💰', '🔧', '≈']
                has_emoji = any(any(emoji in r for emoji in emoji_prefixes) for r in reasons)
                if has_emoji:
                    print_pass("Reasons contain emoji prefixes")
                else:
                    print_info("No emoji prefixes found in reasons (may be valid)")
            else:
                print_info("No reasons in response")
        else:
            print_fail("topPick is null")
    else:
        print_fail(f"Request failed: {resp.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 9: Contractor mode
print_test(9, "Contractor mode - with Authorization header")
if token:
    try:
        # First, call without token
        resp_no_auth = requests.get(f"{BASE_URL}/recommendations/best-option", params={
            "lat": 37.3382,
            "lng": -121.8863,
            "maxKm": 50
        })
        
        # Then call with token
        headers = {"Authorization": f"Bearer {token}"}
        resp_with_auth = requests.get(f"{BASE_URL}/recommendations/best-option", params={
            "lat": 37.3382,
            "lng": -121.8863,
            "maxKm": 50
        }, headers=headers)
        
        print_info(f"Status with auth: {resp_with_auth.status_code}")
        
        if resp_with_auth.status_code == 200:
            data = resp_with_auth.json()
            signals = data.get('signals', {})
            
            if 'userIsContractor' in signals:
                print_pass(f"userIsContractor field present: {signals['userIsContractor']}")
                
                if isinstance(signals['userIsContractor'], bool):
                    print_pass("userIsContractor is a boolean")
                else:
                    print_fail(f"userIsContractor is not a boolean: {type(signals['userIsContractor'])}")
                
                # Check if contractor bonus is applied when userIsContractor=true
                if signals['userIsContractor'] and data.get('topPick'):
                    breakdown = data['topPick'].get('breakdown', {})
                    contractor_score = breakdown.get('contractor', 0)
                    print_info(f"Contractor score: {contractor_score}")
                    if contractor_score == 5:
                        print_pass("Contractor bonus applied (5 points)")
                    else:
                        print_info(f"Contractor score is {contractor_score} (may be 0 if facility not contractor-friendly)")
            else:
                print_fail("userIsContractor field missing in signals")
        else:
            print_fail(f"Request failed: {resp_with_auth.status_code}")
    except Exception as e:
        print_fail(f"Error: {e}")
else:
    print_fail("No token available, skipping contractor mode test")

# Test 10: scoredAt timestamp
print_test(10, "scoredAt timestamp - verify valid ISO timestamp")
try:
    resp1 = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50
    })
    
    time.sleep(1)  # Wait 1 second
    
    resp2 = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50
    })
    
    if resp1.status_code == 200 and resp2.status_code == 200:
        data1 = resp1.json()
        data2 = resp2.json()
        
        scored_at_1 = data1.get('scoredAt')
        scored_at_2 = data2.get('scoredAt')
        
        print_info(f"scoredAt 1: {scored_at_1}")
        print_info(f"scoredAt 2: {scored_at_2}")
        
        if scored_at_1 and scored_at_2:
            print_pass("Both responses have scoredAt timestamps")
            
            # Try to parse as ISO timestamp
            try:
                dt1 = datetime.fromisoformat(scored_at_1.replace('Z', '+00:00'))
                dt2 = datetime.fromisoformat(scored_at_2.replace('Z', '+00:00'))
                print_pass("Timestamps are valid ISO format")
                
                if scored_at_1 != scored_at_2:
                    print_pass("Two consecutive calls have different timestamps")
                else:
                    print_info("Timestamps are the same (may be within same second)")
            except Exception as e:
                print_fail(f"Failed to parse timestamps: {e}")
        else:
            print_fail("scoredAt missing in one or both responses")
    else:
        print_fail("One or both requests failed")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 11: Far-away location (New York City)
print_test(11, "Far-away location - NYC (40.7128, -74.0060)")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 40.7128,
        "lng": -74.0060,
        "maxKm": 50
    })
    print_info(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        
        top_pick = data.get('topPick')
        signals = data.get('signals', {})
        eligible = signals.get('eligibleCount', 0)
        
        if top_pick is None or eligible == 0:
            print_pass("topPick is null or eligibleCount=0 (expected for NYC)")
            print_info(f"Signals: {signals}")
        else:
            print_info(f"Unexpected: found {eligible} facilities near NYC")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 12: Hot-spot density signal
print_test(12, "Hot-spot density signal - verify nearbyJobCount")
try:
    resp = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50
    })
    
    if resp.status_code == 200:
        data = resp.json()
        signals = data.get('signals', {})
        
        if 'nearbyJobCount' in signals:
            nearby_jobs = signals['nearbyJobCount']
            if isinstance(nearby_jobs, int) and nearby_jobs >= 0:
                print_pass(f"nearbyJobCount is a non-negative number: {nearby_jobs}")
                
                if data.get('topPick'):
                    breakdown = data['topPick'].get('breakdown', {})
                    hotspots_score = breakdown.get('hotspots', 0)
                    
                    if nearby_jobs > 0:
                        if hotspots_score == 2:
                            print_pass("Hotspots score = 2 (expected when jobs nearby)")
                        else:
                            print_info(f"Hotspots score = {hotspots_score} (expected 2 when jobs nearby)")
                    else:
                        if hotspots_score == 0:
                            print_pass("Hotspots score = 0 (expected when no jobs nearby)")
                        else:
                            print_fail(f"Hotspots score = {hotspots_score} (expected 0 when no jobs)")
            else:
                print_fail(f"nearbyJobCount is not a valid number: {nearby_jobs}")
        else:
            print_fail("nearbyJobCount missing in signals")
    else:
        print_fail(f"Request failed: {resp.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

# Test 13: Material exclusion check
print_test(13, "Material exclusion check - compare no material vs with material")
try:
    # First call without material
    resp1 = requests.get(f"{BASE_URL}/recommendations/best-option", params={
        "lat": 37.3382,
        "lng": -121.8863,
        "maxKm": 50
    })
    
    if resp1.status_code == 200:
        data1 = resp1.json()
        
        if data1.get('topPick'):
            top_pick1 = data1['topPick']
            facility1 = top_pick1.get('facility', {})
            breakdown1 = top_pick1.get('breakdown', {})
            
            print_info(f"First call (no material): {facility1.get('name')}")
            print_info(f"breakdown.material: {breakdown1.get('material', 0)}")
            
            if breakdown1.get('material', 0) == 0:
                print_pass("breakdown.material = 0 (expected when no material specified)")
            
            # Get first accepted material from this facility
            accepted = facility1.get('accepted', [])
            if accepted:
                first_material = accepted[0]
                print_info(f"First accepted material: {first_material}")
                
                # Second call with that material
                resp2 = requests.get(f"{BASE_URL}/recommendations/best-option", params={
                    "lat": 37.3382,
                    "lng": -121.8863,
                    "material": first_material
                })
                
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    
                    if data2.get('topPick'):
                        top_pick2 = data2['topPick']
                        breakdown2 = top_pick2.get('breakdown', {})
                        reasons2 = top_pick2.get('reasons', [])
                        
                        material_score = breakdown2.get('material', 0)
                        print_info(f"Second call (with material): breakdown.material = {material_score}")
                        
                        if material_score == 15:
                            print_pass("breakdown.material = 15 (exact match)")
                        elif material_score == 8:
                            print_pass("breakdown.material = 8 (partial match)")
                        else:
                            print_info(f"breakdown.material = {material_score}")
                        
                        # Check reasons for material mention
                        material_in_reasons = any(first_material.lower() in r.lower() or 'accepts' in r.lower() for r in reasons2)
                        if material_in_reasons:
                            print_pass(f"Reasons mention material: {[r for r in reasons2 if 'accept' in r.lower()]}")
                        else:
                            print_info(f"Material not explicitly mentioned in reasons: {reasons2}")
                    else:
                        print_fail("topPick is null in second call")
                else:
                    print_fail(f"Second request failed: {resp2.status_code}")
            else:
                print_info("No accepted materials in top facility")
        else:
            print_fail("topPick is null in first call")
    else:
        print_fail(f"First request failed: {resp1.status_code}")
except Exception as e:
    print_fail(f"Error: {e}")

print("\n" + "="*80)
print("ALL TESTS COMPLETED")
print("="*80)
