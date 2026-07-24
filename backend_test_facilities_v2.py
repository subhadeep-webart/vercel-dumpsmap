#!/usr/bin/env python3
"""
Backend test for Submit Form v2 facilities endpoint.
Tests POST /api/facilities with new fields: currentStatus, contractorNotes, notAccepted, tags, pricingFields
"""
import requests
import json
import sys

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@dumpmaps.com"
ADMIN_PASSWORD = "admin123"

def test_facilities_v2():
    print("=" * 80)
    print("FACILITIES SUBMIT FORM V2 BACKEND TEST")
    print("=" * 80)
    
    # Step 1: Admin login
    print("\n[Step 1] Admin login...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  ❌ Login failed: {resp.text}")
            return False
        data = resp.json()
        admin_token = data.get("token")
        if not admin_token:
            print(f"  ❌ No token in response: {data}")
            return False
        print(f"  ✅ Admin logged in, token: {admin_token[:20]}...")
    except Exception as e:
        print(f"  ❌ Exception during login: {e}")
        return False
    
    # Step 2: POST /api/facilities with Submit Form v2 fields
    print("\n[Step 2] POST /api/facilities with Submit Form v2 fields...")
    facility_payload = {
        "name": "Submit V2 Test Facility",
        "type": "Landfill / Transfer Station",
        "typeKey": "transfer_station",
        "address": "100 Test Way, San Jose, CA",
        "hours": "Mon-Sat 7a-4p",
        "accepted": ["Concrete", "Dirt", "Wood"],
        "notAccepted": ["Hazardous waste", "Tires", "Asbestos"],
        "currentStatus": "moving_fast",
        "contractorNotes": ["Covered load required", "Cash only", "Best time AM"],
        "tags": ["paid disposal", "per ton", "no hazardous waste", "moving fast", "covered load required"],
        "pricingFields": {
            "pricePerTon": "95",
            "minimumCharge": "25",
            "scaleInRequired": True
        },
        "extraFields": {},
        "status": "pending"
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/facilities",
            json=facility_payload,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  ❌ POST failed: {resp.text}")
            return False
        
        data = resp.json()
        facility = data.get("facility")
        if not facility:
            print(f"  ❌ No facility in response: {data}")
            return False
        
        facility_id = facility.get("id")
        print(f"  ✅ Facility created with id: {facility_id}")
        
        # Verify all new fields are in the response
        print("\n  [Verification] Checking response fields...")
        
        # Check currentStatus
        if facility.get("currentStatus") != "moving_fast":
            print(f"  ❌ currentStatus mismatch: expected 'moving_fast', got '{facility.get('currentStatus')}'")
            return False
        print(f"  ✅ currentStatus: {facility.get('currentStatus')}")
        
        # Check contractorNotes
        contractor_notes = facility.get("contractorNotes", [])
        expected_notes = ["Covered load required", "Cash only", "Best time AM"]
        if contractor_notes != expected_notes:
            print(f"  ❌ contractorNotes mismatch: expected {expected_notes}, got {contractor_notes}")
            return False
        print(f"  ✅ contractorNotes: {contractor_notes}")
        
        # Check notAccepted
        not_accepted = facility.get("notAccepted", [])
        expected_not_accepted = ["Hazardous waste", "Tires", "Asbestos"]
        if not_accepted != expected_not_accepted:
            print(f"  ❌ notAccepted mismatch: expected {expected_not_accepted}, got {not_accepted}")
            return False
        print(f"  ✅ notAccepted: {not_accepted}")
        
        # Check accepted
        accepted = facility.get("accepted", [])
        expected_accepted = ["Concrete", "Dirt", "Wood"]
        if accepted != expected_accepted:
            print(f"  ❌ accepted mismatch: expected {expected_accepted}, got {accepted}")
            return False
        print(f"  ✅ accepted: {accepted}")
        
        # Check tags
        tags = facility.get("tags", [])
        expected_tags = ["paid disposal", "per ton", "no hazardous waste", "moving fast", "covered load required"]
        if tags != expected_tags:
            print(f"  ❌ tags mismatch: expected {expected_tags}, got {tags}")
            return False
        print(f"  ✅ tags: {tags}")
        
        # Check pricingFields
        pricing_fields = facility.get("pricingFields", {})
        expected_pricing = {
            "pricePerTon": "95",
            "minimumCharge": "25",
            "scaleInRequired": True
        }
        if pricing_fields != expected_pricing:
            print(f"  ❌ pricingFields mismatch: expected {expected_pricing}, got {pricing_fields}")
            return False
        print(f"  ✅ pricingFields: {pricing_fields}")
        
        # Check status
        if facility.get("status") != "pending":
            print(f"  ❌ status mismatch: expected 'pending', got '{facility.get('status')}'")
            return False
        print(f"  ✅ status: {facility.get('status')}")
        
    except Exception as e:
        print(f"  ❌ Exception during POST: {e}")
        return False
    
    # Step 3: GET /api/facilities?status=pending to verify the facility is listed
    print("\n[Step 3] GET /api/facilities?status=pending...")
    try:
        resp = requests.get(
            f"{BASE_URL}/facilities?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  ❌ GET failed: {resp.text}")
            return False
        
        data = resp.json()
        facilities = data.get("facilities", [])
        print(f"  Found {len(facilities)} pending facilities")
        
        # Find our test facility
        test_facility = None
        for f in facilities:
            if f.get("id") == facility_id:
                test_facility = f
                break
        
        if not test_facility:
            print(f"  ❌ Test facility not found in pending list")
            return False
        
        print(f"  ✅ Test facility found in pending list")
        
        # Verify fields again from GET response
        print("\n  [Verification] Checking GET response fields...")
        
        if test_facility.get("currentStatus") != "moving_fast":
            print(f"  ❌ currentStatus mismatch in GET: expected 'moving_fast', got '{test_facility.get('currentStatus')}'")
            return False
        print(f"  ✅ currentStatus: {test_facility.get('currentStatus')}")
        
        if test_facility.get("contractorNotes") != expected_notes:
            print(f"  ❌ contractorNotes mismatch in GET")
            return False
        print(f"  ✅ contractorNotes: {test_facility.get('contractorNotes')}")
        
        if test_facility.get("notAccepted") != expected_not_accepted:
            print(f"  ❌ notAccepted mismatch in GET")
            return False
        print(f"  ✅ notAccepted: {test_facility.get('notAccepted')}")
        
        if test_facility.get("accepted") != expected_accepted:
            print(f"  ❌ accepted mismatch in GET")
            return False
        print(f"  ✅ accepted: {test_facility.get('accepted')}")
        
        if test_facility.get("tags") != expected_tags:
            print(f"  ❌ tags mismatch in GET")
            return False
        print(f"  ✅ tags: {test_facility.get('tags')}")
        
        if test_facility.get("pricingFields") != expected_pricing:
            print(f"  ❌ pricingFields mismatch in GET")
            return False
        print(f"  ✅ pricingFields: {test_facility.get('pricingFields')}")
        
    except Exception as e:
        print(f"  ❌ Exception during GET: {e}")
        return False
    
    # Step 4: GET /api/facilities (default - active) to check no regression
    print("\n[Step 4] GET /api/facilities (default - active) - regression check...")
    try:
        resp = requests.get(f"{BASE_URL}/facilities", timeout=10)
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  ❌ GET failed: {resp.text}")
            return False
        
        data = resp.json()
        facilities = data.get("facilities", [])
        print(f"  Found {len(facilities)} active facilities")
        
        # Check that we have some facilities (seeded data)
        if len(facilities) == 0:
            print(f"  ⚠️  Warning: No active facilities found (expected seeded data)")
        else:
            print(f"  ✅ Active facilities returned (seeded data intact)")
            # Check first facility has expected structure
            first = facilities[0]
            if "name" in first and "address" in first and "type" in first:
                print(f"  ✅ First facility has expected structure: {first.get('name')}")
            else:
                print(f"  ❌ First facility missing expected fields")
                return False
        
    except Exception as e:
        print(f"  ❌ Exception during regression check: {e}")
        return False
    
    # Step 5: Try GET /api/admin/pending (admin endpoint)
    print("\n[Step 5] GET /api/admin/pending (admin endpoint)...")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/pending",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            pending = data.get("pending", {})
            pending_facilities = pending.get("facilities", [])
            print(f"  ✅ Admin pending endpoint returned {len(pending_facilities)} pending facilities")
            
            # Find our test facility
            found = False
            for f in pending_facilities:
                if f.get("id") == facility_id:
                    found = True
                    print(f"  ✅ Test facility found in admin pending list")
                    break
            
            if not found:
                print(f"  ⚠️  Test facility not found in admin pending list (might be filtered)")
        elif resp.status_code == 404:
            print(f"  ⚠️  Admin pending endpoint not found (404) - skipping")
        else:
            print(f"  ⚠️  Admin pending endpoint returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  ⚠️  Exception during admin pending check: {e}")
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED - Submit Form v2 fields are persisted and returned correctly")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = test_facilities_v2()
    sys.exit(0 if success else 1)
