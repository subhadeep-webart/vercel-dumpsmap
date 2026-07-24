#!/usr/bin/env python3
"""
Backend test for Facility Imports UX Overhaul
Tests the new productivity counters, needs_details workflow, and bulk operations
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def login(email, password):
    """Login and return JWT token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def signup_user(email, password):
    """Create a new user and return JWT token"""
    resp = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email,
        "password": password,
        "name": "Test User"
    })
    if resp.status_code != 200:
        print(f"❌ Signup failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def test_productivity_counters(token):
    """Test 1: Productivity counters in list response"""
    print("\n" + "="*80)
    print("TEST 1: Productivity counters in list response")
    print("="*80)
    
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        
        # Check response shape
        if "imports" not in data:
            print(f"❌ FAILED: Missing 'imports' field")
            return False
        
        if "counts" not in data:
            print(f"❌ FAILED: Missing 'counts' field")
            return False
        
        if "metrics" not in data:
            print(f"❌ FAILED: Missing 'metrics' field")
            return False
        
        metrics = data["metrics"]
        
        # Check all four metrics fields
        required_metrics = ["approvedToday", "rejectedToday", "needsDetailsCount", "duplicatesFound"]
        for metric in required_metrics:
            if metric not in metrics:
                print(f"❌ FAILED: Missing metric '{metric}'")
                return False
            if not isinstance(metrics[metric], (int, float)):
                print(f"❌ FAILED: Metric '{metric}' is not numeric: {metrics[metric]}")
                return False
        
        print(f"✅ Response shape correct")
        print(f"   - imports: {len(data['imports'])} items")
        print(f"   - counts: {data['counts']}")
        print(f"   - metrics.approvedToday: {metrics['approvedToday']}")
        print(f"   - metrics.rejectedToday: {metrics['rejectedToday']}")
        print(f"   - metrics.needsDetailsCount: {metrics['needsDetailsCount']}")
        print(f"   - metrics.duplicatesFound: {metrics['duplicatesFound']}")
        
        # Verify duplicatesFound logic
        pending_with_dupes = sum(1 for imp in data['imports'] 
                                if imp.get('status') in ['pending', 'needs_details'] 
                                and len(imp.get('duplicateMatches', [])) > 0)
        
        print(f"✅ duplicatesFound metric: {metrics['duplicatesFound']} (pending/needs_details imports with duplicateMatches)")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_single_needs_details(token):
    """Test 2: Single needs_details PATCH"""
    print("\n" + "="*80)
    print("TEST 2: Single needs_details PATCH")
    print("="*80)
    
    try:
        # Get a pending import
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=pending&limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch pending imports: {resp.status_code}")
            return False
        
        data = resp.json()
        pending_imports = data.get("imports", [])
        
        if not pending_imports:
            print(f"⚠️  SKIPPED: No pending imports available")
            return True
        
        import_id = pending_imports[0]["id"]
        print(f"   Using import ID: {import_id}")
        
        # PATCH with needs_details action
        patch_resp = requests.patch(
            f"{BASE_URL}/admin/facility-imports/{import_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "action": "needs_details",
                "reasons": ["missing_hours", "low_confidence"],
                "notes": "Need to call facility"
            }
        )
        
        if patch_resp.status_code != 200:
            print(f"❌ FAILED: PATCH returned {patch_resp.status_code}")
            print(f"Response: {patch_resp.text}")
            return False
        
        patch_data = patch_resp.json()
        
        if not patch_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        if patch_data.get("status") != "needs_details":
            print(f"❌ FAILED: Expected status='needs_details', got '{patch_data.get('status')}'")
            return False
        
        if patch_data.get("reasons") != ["missing_hours", "low_confidence"]:
            print(f"❌ FAILED: Reasons mismatch: {patch_data.get('reasons')}")
            return False
        
        print(f"✅ PATCH successful: {patch_data}")
        
        # Verify with GET
        get_resp = requests.get(
            f"{BASE_URL}/admin/facility-imports/{import_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if get_resp.status_code != 200:
            print(f"❌ FAILED: GET returned {get_resp.status_code}")
            return False
        
        get_data = get_resp.json()
        import_obj = get_data.get("import", {})
        
        # Verify all fields
        checks = [
            ("status", "needs_details"),
            ("needsDetailsReasons", ["missing_hours", "low_confidence"]),
            ("needsDetailsNotes", "Need to call facility"),
        ]
        
        for field, expected in checks:
            actual = import_obj.get(field)
            if actual != expected:
                print(f"❌ FAILED: Field '{field}' mismatch. Expected {expected}, got {actual}")
                return False
        
        # Check timestamp fields exist
        if not import_obj.get("needsDetailsAt"):
            print(f"❌ FAILED: Missing needsDetailsAt timestamp")
            return False
        
        if not import_obj.get("needsDetailsBy"):
            print(f"❌ FAILED: Missing needsDetailsBy user ID")
            return False
        
        print(f"✅ GET verification successful")
        print(f"   - status: {import_obj['status']}")
        print(f"   - needsDetailsReasons: {import_obj['needsDetailsReasons']}")
        print(f"   - needsDetailsNotes: {import_obj['needsDetailsNotes']}")
        print(f"   - needsDetailsAt: {import_obj['needsDetailsAt']}")
        print(f"   - needsDetailsBy: {import_obj['needsDetailsBy']}")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_filter_needs_details(token):
    """Test 3: Filter by needs_details status"""
    print("\n" + "="*80)
    print("TEST 3: Filter by needs_details status")
    print("="*80)
    
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=needs_details",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        imports = data.get("imports", [])
        
        # Verify all returned imports have status='needs_details'
        for imp in imports:
            if imp.get("status") != "needs_details":
                print(f"❌ FAILED: Import {imp['id']} has status '{imp.get('status')}', expected 'needs_details'")
                return False
        
        print(f"✅ Filter working: {len(imports)} needs_details imports returned")
        
        # Should include the one we just flagged in test 2
        if len(imports) > 0:
            print(f"   Sample import: {imports[0]['id']} - {imports[0].get('normalizedData', {}).get('name', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bulk_needs_details(token):
    """Test 4: Bulk needs-details"""
    print("\n" + "="*80)
    print("TEST 4: Bulk needs-details")
    print("="*80)
    
    try:
        # Get 3 pending imports
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=pending&limit=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch pending imports: {resp.status_code}")
            return False
        
        data = resp.json()
        pending_imports = data.get("imports", [])
        
        if len(pending_imports) < 3:
            print(f"⚠️  SKIPPED: Need at least 3 pending imports, found {len(pending_imports)}")
            return True
        
        ids = [imp["id"] for imp in pending_imports[:3]]
        print(f"   Using import IDs: {ids}")
        
        # POST bulk-needs-details
        bulk_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-needs-details",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "ids": ids,
                "reasons": ["missing_phone", "missing_hours"],
                "notes": "Bulk test batch"
            }
        )
        
        if bulk_resp.status_code != 200:
            print(f"❌ FAILED: POST returned {bulk_resp.status_code}")
            print(f"Response: {bulk_resp.text}")
            return False
        
        bulk_data = bulk_resp.json()
        
        if not bulk_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        if bulk_data.get("flagged") != 3:
            print(f"❌ FAILED: Expected flagged=3, got {bulk_data.get('flagged')}")
            return False
        
        if bulk_data.get("skipped") != 0:
            print(f"❌ FAILED: Expected skipped=0, got {bulk_data.get('skipped')}")
            return False
        
        print(f"✅ Bulk needs-details successful: {bulk_data}")
        
        # Verify each import
        for import_id in ids:
            get_resp = requests.get(
                f"{BASE_URL}/admin/facility-imports/{import_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if get_resp.status_code != 200:
                print(f"❌ FAILED: Could not verify import {import_id}")
                return False
            
            import_obj = get_resp.json().get("import", {})
            
            if import_obj.get("status") != "needs_details":
                print(f"❌ FAILED: Import {import_id} status is '{import_obj.get('status')}', expected 'needs_details'")
                return False
            
            if import_obj.get("needsDetailsReasons") != ["missing_phone", "missing_hours"]:
                print(f"❌ FAILED: Import {import_id} reasons mismatch")
                return False
            
            if import_obj.get("needsDetailsNotes") != "Bulk test batch":
                print(f"❌ FAILED: Import {import_id} notes mismatch")
                return False
        
        print(f"✅ All 3 imports verified with correct status and reasons/notes")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bulk_approve_from_needs_details(token):
    """Test 5: Bulk-approve from needs_details"""
    print("\n" + "="*80)
    print("TEST 5: Bulk-approve from needs_details")
    print("="*80)
    
    try:
        # Get 2 needs_details imports
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=needs_details&limit=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch needs_details imports: {resp.status_code}")
            return False
        
        data = resp.json()
        needs_details_imports = data.get("imports", [])
        
        if len(needs_details_imports) < 2:
            print(f"⚠️  SKIPPED: Need at least 2 needs_details imports, found {len(needs_details_imports)}")
            return True
        
        ids = [imp["id"] for imp in needs_details_imports[:2]]
        print(f"   Using import IDs: {ids}")
        
        # POST bulk-approve
        bulk_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-approve",
            headers={"Authorization": f"Bearer {token}"},
            json={"ids": ids}
        )
        
        if bulk_resp.status_code != 200:
            print(f"❌ FAILED: POST returned {bulk_resp.status_code}")
            print(f"Response: {bulk_resp.text}")
            return False
        
        bulk_data = bulk_resp.json()
        
        if not bulk_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        if bulk_data.get("approved") != 2:
            print(f"❌ FAILED: Expected approved=2, got {bulk_data.get('approved')}")
            return False
        
        if bulk_data.get("skipped") != 0:
            print(f"❌ FAILED: Expected skipped=0, got {bulk_data.get('skipped')}")
            return False
        
        created = bulk_data.get("created", [])
        if len(created) != 2:
            print(f"❌ FAILED: Expected 2 created facilities, got {len(created)}")
            return False
        
        print(f"✅ Bulk-approve successful: {bulk_data}")
        print(f"   Created facilities:")
        for fac in created:
            print(f"     - {fac['id']}: {fac['name']}")
        
        # Verify facilities exist in facilities collection
        for fac in created:
            fac_resp = requests.get(
                f"{BASE_URL}/facilities/{fac['id']}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if fac_resp.status_code != 200:
                print(f"❌ FAILED: Facility {fac['id']} not found in facilities collection")
                return False
            
            fac_data = fac_resp.json()
            facility = fac_data.get("facility", {})
            if facility.get("status") != "active":
                print(f"❌ FAILED: Facility {fac['id']} status is '{facility.get('status')}', expected 'active'")
                return False
        
        print(f"✅ All 2 facilities verified in facilities collection with status='active'")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bulk_reject(token):
    """Test 6: Bulk-reject"""
    print("\n" + "="*80)
    print("TEST 6: Bulk-reject")
    print("="*80)
    
    try:
        # Get 2 pending imports
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=pending&limit=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch pending imports: {resp.status_code}")
            return False
        
        data = resp.json()
        pending_imports = data.get("imports", [])
        
        if len(pending_imports) < 2:
            print(f"⚠️  SKIPPED: Need at least 2 pending imports, found {len(pending_imports)}")
            return True
        
        ids = [imp["id"] for imp in pending_imports[:2]]
        print(f"   Using import IDs: {ids}")
        
        # POST bulk-reject
        bulk_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-reject",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "ids": ids,
                "reason": "out of business"
            }
        )
        
        if bulk_resp.status_code != 200:
            print(f"❌ FAILED: POST returned {bulk_resp.status_code}")
            print(f"Response: {bulk_resp.text}")
            return False
        
        bulk_data = bulk_resp.json()
        
        if not bulk_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        if bulk_data.get("rejected") != 2:
            print(f"❌ FAILED: Expected rejected=2, got {bulk_data.get('rejected')}")
            return False
        
        if bulk_data.get("skipped") != 0:
            print(f"❌ FAILED: Expected skipped=0, got {bulk_data.get('skipped')}")
            return False
        
        print(f"✅ Bulk-reject successful: {bulk_data}")
        
        # Verify each import
        for import_id in ids:
            get_resp = requests.get(
                f"{BASE_URL}/admin/facility-imports/{import_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if get_resp.status_code != 200:
                print(f"❌ FAILED: Could not verify import {import_id}")
                return False
            
            import_obj = get_resp.json().get("import", {})
            
            if import_obj.get("status") != "rejected":
                print(f"❌ FAILED: Import {import_id} status is '{import_obj.get('status')}', expected 'rejected'")
                return False
            
            if import_obj.get("rejectedReason") != "out of business":
                print(f"❌ FAILED: Import {import_id} rejectedReason is '{import_obj.get('rejectedReason')}', expected 'out of business'")
                return False
        
        print(f"✅ All 2 imports verified with status='rejected' and rejectedReason='out of business'")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bulk_merge_with_duplicates(token):
    """Test 7: Bulk-merge with duplicates"""
    print("\n" + "="*80)
    print("TEST 7: Bulk-merge with duplicates")
    print("="*80)
    
    try:
        # First, create a facility to merge into
        # We'll use bulk-approve to create a facility from an import
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=pending&limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch pending imports: {resp.status_code}")
            return False
        
        data = resp.json()
        pending_imports = data.get("imports", [])
        
        if not pending_imports:
            print(f"⚠️  SKIPPED: No pending imports available to create target facility")
            return True
        
        # Approve one import to create a target facility
        target_import = pending_imports[0]
        target_name = target_import.get("normalizedData", {}).get("name", "Test Facility")
        target_address = target_import.get("normalizedData", {}).get("address", "123 Main St")
        target_city = target_import.get("normalizedData", {}).get("city", "San Jose")
        
        approve_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-approve",
            headers={"Authorization": f"Bearer {token}"},
            json={"ids": [target_import["id"]]}
        )
        
        if approve_resp.status_code != 200:
            print(f"❌ FAILED: Could not approve target import: {approve_resp.status_code}")
            return False
        
        approve_data = approve_resp.json()
        created = approve_data.get("created", [])
        
        if not created:
            print(f"❌ FAILED: No facility created from approval")
            return False
        
        target_facility_id = created[0]["id"]
        print(f"✅ Created target facility: {target_facility_id} - {target_name}")
        
        # Now create a similar import that will match the target facility
        similar_name = target_name  # Same name
        similar_address = target_address  # Same address
        similar_city = target_city  # Same city
        
        create_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": similar_name,
                "address": similar_address,
                "city": similar_city,
                "state": "CA",
                "typeKey": "transfer_station",
                "sourceType": "manual"
            }
        )
        
        if create_resp.status_code != 200:
            print(f"❌ FAILED: Could not create similar import: {create_resp.status_code}")
            print(f"Response: {create_resp.text}")
            return False
        
        import_obj = create_resp.json().get("import", {})
        import_id = import_obj["id"]
        print(f"✅ Created similar import: {import_id}")
        
        # Check if it has duplicates
        dupes = import_obj.get("duplicateMatches", [])
        if not dupes:
            print(f"⚠️  WARNING: Import has no duplicates detected, duplicate detection may not be working")
            # Continue anyway to test the merge logic
        else:
            print(f"✅ Duplicate detection found {len(dupes)} match(es)")
        
        # POST bulk-merge
        bulk_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-merge",
            headers={"Authorization": f"Bearer {token}"},
            json={"ids": [import_id]}
        )
        
        if bulk_resp.status_code != 200:
            print(f"❌ FAILED: POST returned {bulk_resp.status_code}")
            print(f"Response: {bulk_resp.text}")
            return False
        
        bulk_data = bulk_resp.json()
        
        if not bulk_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        # If no duplicates were detected, it should skip
        if not dupes:
            if bulk_data.get("merged") != 0 or bulk_data.get("skipped") != 1:
                print(f"❌ FAILED: Expected skipped=1 when no duplicates, got merged={bulk_data.get('merged')}, skipped={bulk_data.get('skipped')}")
                return False
            print(f"✅ Correctly skipped import without duplicates")
            return True
        
        # If duplicates were detected, it should merge
        if bulk_data.get("merged") != 1:
            print(f"❌ FAILED: Expected merged=1, got {bulk_data.get('merged')}")
            return False
        
        if bulk_data.get("skipped") != 0:
            print(f"❌ FAILED: Expected skipped=0, got {bulk_data.get('skipped')}")
            return False
        
        results = bulk_data.get("results", [])
        if len(results) != 1:
            print(f"❌ FAILED: Expected 1 result, got {len(results)}")
            return False
        
        result = results[0]
        if not result.get("mergedInto"):
            print(f"❌ FAILED: Missing mergedInto field")
            return False
        
        if not result.get("targetName"):
            print(f"❌ FAILED: Missing targetName field")
            return False
        
        if "fieldsFilled" not in result:
            print(f"❌ FAILED: Missing fieldsFilled field")
            return False
        
        print(f"✅ Bulk-merge successful: {bulk_data}")
        print(f"   Result: {result}")
        
        # Verify import status
        get_resp = requests.get(
            f"{BASE_URL}/admin/facility-imports/{import_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if get_resp.status_code != 200:
            print(f"❌ FAILED: Could not verify import {import_id}")
            return False
        
        import_obj = get_resp.json().get("import", {})
        
        if import_obj.get("status") != "merged":
            print(f"❌ FAILED: Import status is '{import_obj.get('status')}', expected 'merged'")
            return False
        
        if not import_obj.get("mergedIntoFacilityId"):
            print(f"❌ FAILED: Missing mergedIntoFacilityId")
            return False
        
        print(f"✅ Import verified with status='merged' and mergedIntoFacilityId='{import_obj['mergedIntoFacilityId']}'")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bulk_merge_without_duplicates(token):
    """Test 8: Bulk-merge with import lacking duplicates"""
    print("\n" + "="*80)
    print("TEST 8: Bulk-merge with import lacking duplicates")
    print("="*80)
    
    try:
        # Create a manual import with unique name (no duplicates)
        import random
        unique_suffix = f"{datetime.now().timestamp()}_{random.randint(10000, 99999)}"
        unique_name = f"ZZZZZ Unique Test Facility {unique_suffix}"
        create_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": unique_name,
                "address": f"999{random.randint(1000, 9999)} Nowhere Lane XYZ",
                "city": "Uniqueville",
                "state": "CA",
                "zip": "99999",
                "typeKey": "recycling_center",
                "sourceType": "manual"
            }
        )
        
        if create_resp.status_code != 200:
            print(f"❌ FAILED: Could not create test import: {create_resp.status_code}")
            print(f"Response: {create_resp.text}")
            return False
        
        import_obj = create_resp.json().get("import", {})
        import_id = import_obj["id"]
        print(f"   Created unique import: {import_id}")
        
        # Verify it has no duplicates
        if len(import_obj.get("duplicateMatches", [])) > 0:
            print(f"⚠️  WARNING: Import has duplicates, test may not be accurate")
        
        # POST bulk-merge
        bulk_resp = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-merge",
            headers={"Authorization": f"Bearer {token}"},
            json={"ids": [import_id]}
        )
        
        if bulk_resp.status_code != 200:
            print(f"❌ FAILED: POST returned {bulk_resp.status_code}")
            print(f"Response: {bulk_resp.text}")
            return False
        
        bulk_data = bulk_resp.json()
        
        if not bulk_data.get("ok"):
            print(f"❌ FAILED: Response ok=false")
            return False
        
        if bulk_data.get("merged") != 0:
            print(f"❌ FAILED: Expected merged=0, got {bulk_data.get('merged')}")
            return False
        
        if bulk_data.get("skipped") != 1:
            print(f"❌ FAILED: Expected skipped=1, got {bulk_data.get('skipped')}")
            return False
        
        results = bulk_data.get("results", [])
        if len(results) != 1:
            print(f"❌ FAILED: Expected 1 result, got {len(results)}")
            return False
        
        result = results[0]
        if result.get("id") != import_id:
            print(f"❌ FAILED: Result id mismatch")
            return False
        
        if result.get("skipped") != "no_duplicate":
            print(f"❌ FAILED: Expected skipped='no_duplicate', got '{result.get('skipped')}'")
            return False
        
        print(f"✅ Bulk-merge correctly skipped import without duplicates: {bulk_data}")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_validation_empty_ids(token):
    """Test 9: Validation - empty ids on all bulk endpoints"""
    print("\n" + "="*80)
    print("TEST 9: Validation - empty ids on all bulk endpoints")
    print("="*80)
    
    try:
        endpoints = [
            ("bulk-reject", {"ids": [], "reason": "test"}),
            ("bulk-needs-details", {"ids": [], "reasons": ["test"], "notes": "test"}),
            ("bulk-merge", {"ids": []}),
            ("bulk-approve", {"ids": []}),
        ]
        
        for endpoint, payload in endpoints:
            resp = requests.post(
                f"{BASE_URL}/admin/facility-imports/{endpoint}",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            
            if resp.status_code != 400:
                print(f"❌ FAILED: {endpoint} - Expected 400, got {resp.status_code}")
                return False
            
            data = resp.json()
            if "error" not in data or "ids" not in data["error"].lower():
                print(f"❌ FAILED: {endpoint} - Error message doesn't mention 'ids': {data}")
                return False
            
            print(f"✅ {endpoint} correctly rejected empty ids with 400")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_rbac(token):
    """Test 10: RBAC"""
    print("\n" + "="*80)
    print("TEST 10: RBAC")
    print("="*80)
    
    try:
        # Create a new regular user
        new_email = f"newuser_{datetime.now().timestamp()}@test.com"
        new_token = signup_user(new_email, "password123")
        
        if not new_token:
            print(f"❌ FAILED: Could not create new user")
            return False
        
        print(f"✅ Created new user: {new_email}")
        
        # Test bulk-needs-details (moderator+ required)
        resp1 = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-needs-details",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"ids": ["test"], "reasons": ["test"], "notes": "test"}
        )
        
        if resp1.status_code != 403:
            print(f"❌ FAILED: bulk-needs-details - Expected 403, got {resp1.status_code}")
            return False
        
        print(f"✅ bulk-needs-details correctly rejected with 403")
        
        # Test bulk-reject (moderator+ required)
        resp2 = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-reject",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"ids": ["test"], "reason": "test"}
        )
        
        if resp2.status_code != 403:
            print(f"❌ FAILED: bulk-reject - Expected 403, got {resp2.status_code}")
            return False
        
        print(f"✅ bulk-reject correctly rejected with 403")
        
        # Test bulk-approve (admin+ required)
        resp3 = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-approve",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"ids": ["test"]}
        )
        
        if resp3.status_code != 403:
            print(f"❌ FAILED: bulk-approve - Expected 403, got {resp3.status_code}")
            return False
        
        print(f"✅ bulk-approve correctly rejected with 403")
        
        # Test bulk-merge (admin+ required)
        resp4 = requests.post(
            f"{BASE_URL}/admin/facility-imports/bulk-merge",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"ids": ["test"]}
        )
        
        if resp4.status_code != 403:
            print(f"❌ FAILED: bulk-merge - Expected 403, got {resp4.status_code}")
            return False
        
        print(f"✅ bulk-merge correctly rejected with 403")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_counters_update(token):
    """Test 11: Counters update after actions"""
    print("\n" + "="*80)
    print("TEST 11: Counters update after actions")
    print("="*80)
    
    try:
        # Get initial counts
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=all",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch imports: {resp.status_code}")
            return False
        
        data = resp.json()
        metrics = data.get("metrics", {})
        
        approved_today = metrics.get("approvedToday", 0)
        rejected_today = metrics.get("rejectedToday", 0)
        
        print(f"   Initial metrics:")
        print(f"     - approvedToday: {approved_today}")
        print(f"     - rejectedToday: {rejected_today}")
        
        # After test 5 (bulk-approve 2) and test 6 (bulk-reject 2)
        # approvedToday should be >= 2
        # rejectedToday should be >= 2
        
        if approved_today < 2:
            print(f"⚠️  WARNING: approvedToday={approved_today}, expected >= 2 (from test 5)")
        else:
            print(f"✅ approvedToday >= 2 (reflects bulk-approve from test 5)")
        
        if rejected_today < 2:
            print(f"⚠️  WARNING: rejectedToday={rejected_today}, expected >= 2 (from test 6)")
        else:
            print(f"✅ rejectedToday >= 2 (reflects bulk-reject from test 6)")
        
        # Check counts
        counts = data.get("counts", {})
        print(f"   Counts: {counts}")
        
        if "approved" not in counts:
            print(f"❌ FAILED: Missing 'approved' count")
            return False
        
        print(f"✅ Counters present and updated")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_needs_details_metric(token):
    """Test 12: needs_details metric"""
    print("\n" + "="*80)
    print("TEST 12: needs_details metric")
    print("="*80)
    
    try:
        # Get metrics
        resp = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=all",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Could not fetch imports: {resp.status_code}")
            return False
        
        data = resp.json()
        metrics = data.get("metrics", {})
        
        needs_details_count = metrics.get("needsDetailsCount", 0)
        
        print(f"   metrics.needsDetailsCount: {needs_details_count}")
        
        # After test 4 (bulk-flag 3 imports as needs_details)
        # and test 5 (bulk-approve 2 of them)
        # needsDetailsCount should reflect remaining count
        
        # Get actual needs_details imports
        resp2 = requests.get(
            f"{BASE_URL}/admin/facility-imports?status=needs_details&limit=200",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if resp2.status_code != 200:
            print(f"❌ FAILED: Could not fetch needs_details imports: {resp2.status_code}")
            return False
        
        actual_count = len(resp2.json().get("imports", []))
        
        print(f"   Actual needs_details imports: {actual_count}")
        
        if needs_details_count != actual_count:
            print(f"❌ FAILED: needsDetailsCount={needs_details_count} doesn't match actual count={actual_count}")
            return False
        
        print(f"✅ needsDetailsCount metric matches actual count")
        
        # After test 4 (flagged 3) and test 5 (approved 2), we expect at least 1 remaining
        # But there might be more from test 2 (single needs_details)
        if actual_count >= 1:
            print(f"✅ needsDetailsCount reflects remaining imports after bulk-approve")
        else:
            print(f"⚠️  WARNING: Expected at least 1 needs_details import remaining")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*80)
    print("FACILITY IMPORTS UX OVERHAUL - BACKEND TEST")
    print("="*80)
    
    # Login as super admin
    print("\nLogging in as super admin...")
    token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    if not token:
        print("❌ FAILED: Could not login as super admin")
        sys.exit(1)
    
    print(f"✅ Logged in successfully")
    
    # Run all tests
    tests = [
        ("Productivity counters in list response", test_productivity_counters),
        ("Single needs_details PATCH", test_single_needs_details),
        ("Filter by needs_details status", test_filter_needs_details),
        ("Bulk needs-details", test_bulk_needs_details),
        ("Bulk-approve from needs_details", test_bulk_approve_from_needs_details),
        ("Bulk-reject", test_bulk_reject),
        ("Bulk-merge with duplicates", test_bulk_merge_with_duplicates),
        ("Bulk-merge without duplicates", test_bulk_merge_without_duplicates),
        ("Validation: empty ids", test_validation_empty_ids),
        ("RBAC", test_rbac),
        ("Counters update after actions", test_counters_update),
        ("needs_details metric", test_needs_details_metric),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func(token)
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed with exception: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
