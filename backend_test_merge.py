#!/usr/bin/env python3
"""
Focused test for merge functionality
"""

import requests
import json
import os

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def main():
    print("\n" + "="*80)
    print("MERGE FUNCTIONALITY TEST")
    print("="*80)
    
    # Login
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    admin_token = response.json()['token']
    print("✅ Admin login successful")
    
    # Find Mission Trail facility
    response = requests.get(
        f"{API_BASE}/facilities?q=Mission%20Trail",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    facilities = response.json().get('facilities', [])
    mission_trail = next((f for f in facilities if 'Mission Trail' in f.get('name', '')), None)
    
    if not mission_trail:
        print("❌ Mission Trail facility not found")
        return
    
    mission_trail_id = mission_trail['id']
    print(f"✅ Found Mission Trail facility: {mission_trail_id}")
    print(f"   Name: {mission_trail['name']}")
    print(f"   Address: {mission_trail['address']}")
    
    # Create a similar import for merge test
    print("\n--- Creating import similar to Mission Trail ---")
    response = requests.post(
        f"{API_BASE}/admin/facility-imports",
        json={
            "name": "Mission Trail Waste Systems",
            "address": "1080 Walsh Ave",
            "city": "Santa Clara",
            "state": "CA",
            "zip": "95050",
            "typeKey": "transfer_station",
            "sourceType": "manual",
            "sourceUrl": "https://example.com/verified-source",
            "phone": "(408) 555-1234",
            "hours": "Mon-Fri 7am-6pm",
            "website": "https://missiontrail-updated.com"
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to create import: {response.status_code}")
        print(response.text)
        return
    
    imp = response.json().get('import', {})
    merge_import_id = imp.get('id')
    dupes = imp.get('duplicateMatches', [])
    
    print(f"✅ Import created: {merge_import_id}")
    print(f"   Confidence: {imp.get('confidenceScore')}")
    print(f"   Duplicate matches: {len(dupes)}")
    
    if dupes:
        for d in dupes[:3]:
            print(f"     - {d.get('name')}: {d.get('similarity')}% similarity")
    
    # Check if Mission Trail is in duplicates
    mission_match = next((d for d in dupes if d.get('id') == mission_trail_id), None)
    
    if mission_match:
        print(f"✅ Mission Trail found in duplicates with {mission_match.get('similarity')}% similarity")
    else:
        print(f"⚠️  Mission Trail not in duplicates, but proceeding with merge anyway")
    
    # Perform merge
    print(f"\n--- Merging import {merge_import_id} into facility {mission_trail_id} ---")
    response = requests.patch(
        f"{API_BASE}/admin/facility-imports/{merge_import_id}",
        json={
            "action": "merge",
            "targetFacilityId": mission_trail_id
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Merge failed: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    print(f"✅ Merge successful!")
    print(f"   Status: {data.get('status')}")
    print(f"   Merged into: {data.get('mergedInto')}")
    print(f"   Fields updated: {data.get('fields')}")
    
    # Verify target facility was updated
    print(f"\n--- Verifying target facility was updated ---")
    response = requests.get(
        f"{API_BASE}/facilities?q=Mission%20Trail",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    facilities = response.json().get('facilities', [])
    updated_facility = next((f for f in facilities if f.get('id') == mission_trail_id), None)
    
    if updated_facility:
        print(f"✅ Target facility found")
        print(f"   Name: {updated_facility.get('name')}")
        print(f"   Phone: {updated_facility.get('phone')}")
        print(f"   Website: {updated_facility.get('website')}")
        print(f"   Hours: {updated_facility.get('hours')}")
        print(f"   Source URL: {updated_facility.get('sourceUrl')}")
        print(f"   Last Verified At: {updated_facility.get('lastVerifiedAt')}")
        print(f"   Confidence Score: {updated_facility.get('confidenceScore')}")
        
        # Check if fields were merged
        if updated_facility.get('lastVerifiedAt'):
            print("✅ lastVerifiedAt was updated")
        else:
            print("❌ lastVerifiedAt not updated")
        
        if updated_facility.get('sourceUrl'):
            print(f"✅ sourceUrl present: {updated_facility.get('sourceUrl')}")
        else:
            print("❌ sourceUrl missing")
    else:
        print("❌ Target facility not found after merge")
    
    # Verify import status is merged
    print(f"\n--- Verifying import status ---")
    response = requests.get(
        f"{API_BASE}/admin/facility-imports/{merge_import_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        imp = response.json().get('import', {})
        print(f"✅ Import status: {imp.get('status')}")
        print(f"   Merged into: {imp.get('mergedIntoFacilityId')}")
        print(f"   Merged at: {imp.get('mergedAt')}")
    else:
        print(f"❌ Failed to get import detail: {response.status_code}")
    
    print("\n" + "="*80)
    print("MERGE TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
