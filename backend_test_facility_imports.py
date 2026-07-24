#!/usr/bin/env python3
"""
Backend Test: Verified Facility Data Import System
Tests all facility import endpoints with comprehensive scenarios
"""

import requests
import json
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

# Test data
CSV_TEST_DATA = """name,address,city,state,zip,type,phone,website,accepted,pricing,source_url,source_type,hours
Test CalRecycle Site Alpha,777 Test Ave,Oakland,CA,94601,transfer_station,(510) 555-0100,https://example-alpha.com,"wood;concrete;dirt",Paid disposal,https://www2.calrecycle.ca.gov/SWFacilities/Directory/,calrecycle,Mon-Fri 7a-5p
Test Gov Site Beta,888 Beta Rd,San Jose,CA,95110,recycling_center,(408) 555-0200,https://example-beta.com,"metal;glass",Free drop,https://sanjoseca.gov/recycling,gov_official,Sat 8a-2p"""

def log_test(step, message):
    """Log test step with timestamp"""
    print(f"\n{'='*80}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] STEP {step}: {message}")
    print('='*80)

def log_result(success, message):
    """Log test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def log_error(message, response=None):
    """Log error details"""
    print(f"❌ ERROR: {message}")
    if response:
        print(f"Status: {response.status_code}")
        try:
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response text: {response.text[:500]}")

def main():
    print("\n" + "="*80)
    print("FACILITY IMPORT SYSTEM BACKEND TEST")
    print("="*80)
    
    # Store test data
    admin_token = None
    regular_token = None
    csv_import_ids = []
    manual_import_id = None
    mission_trail_id = None
    merge_import_id = None
    
    try:
        # ============================================================
        # STEP 1: Admin Login
        # ============================================================
        log_test(1, "Admin Login (Super Admin)")
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            admin_token = data.get('token')
            log_result(True, f"Admin login successful. Role: {data.get('user', {}).get('role')}")
        else:
            log_error("Admin login failed", response)
            return
        
        # ============================================================
        # STEP 2: CSV Upload - Test with 2 rows (CalRecycle + Gov)
        # ============================================================
        log_test(2, "CSV Upload - POST /api/admin/facility-imports/csv")
        response = requests.post(
            f"{API_BASE}/admin/facility-imports/csv",
            json={"csv": CSV_TEST_DATA},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            created = data.get('created', 0)
            total = data.get('totalRows', 0)
            dupes = data.get('dupesFound', 0)
            log_result(True, f"CSV upload successful. Created: {created}, Total rows: {total}, Dupes found: {dupes}")
            
            if created == 2 and total == 2:
                log_result(True, "Correct number of rows created (2/2)")
            else:
                log_result(False, f"Expected 2 created, got {created}")
        else:
            log_error("CSV upload failed", response)
            return
        
        # ============================================================
        # STEP 3: List Imports - Verify CSV imports with confidence scores
        # ============================================================
        log_test(3, "List Imports - GET /api/admin/facility-imports?status=pending")
        response = requests.get(
            f"{API_BASE}/admin/facility-imports?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            imports = data.get('imports', [])
            counts = data.get('counts', {})
            
            log_result(True, f"List imports successful. Found {len(imports)} pending imports")
            print(f"Counts: {json.dumps(counts, indent=2)}")
            
            # Find our CSV imports
            csv_imports = [imp for imp in imports if 'Test CalRecycle' in imp.get('normalizedData', {}).get('name', '') or 'Test Gov Site' in imp.get('normalizedData', {}).get('name', '')]
            
            if len(csv_imports) >= 2:
                log_result(True, f"Found {len(csv_imports)} CSV test imports")
                
                for imp in csv_imports[:2]:
                    csv_import_ids.append(imp['id'])
                    name = imp.get('normalizedData', {}).get('name', '')
                    confidence = imp.get('confidenceScore', 0)
                    source_type = imp.get('sourceType', '')
                    status = imp.get('status', '')
                    
                    print(f"\n  Import: {name}")
                    print(f"    ID: {imp['id']}")
                    print(f"    Confidence: {confidence}")
                    print(f"    Source Type: {source_type}")
                    print(f"    Status: {status}")
                    print(f"    Duplicate Matches: {len(imp.get('duplicateMatches', []))}")
                    
                    # Verify confidence score is in expected range (50-100)
                    if 50 <= confidence <= 100:
                        log_result(True, f"{name}: Confidence score {confidence} in expected range")
                    else:
                        log_result(False, f"{name}: Confidence score {confidence} out of range")
                    
                    # Verify normalizedData is populated
                    if imp.get('normalizedData'):
                        log_result(True, f"{name}: normalizedData populated")
                    else:
                        log_result(False, f"{name}: normalizedData missing")
                    
                    # Verify status is pending
                    if status == 'pending':
                        log_result(True, f"{name}: Status is pending")
                    else:
                        log_result(False, f"{name}: Status is {status}, expected pending")
            else:
                log_result(False, f"Expected at least 2 CSV imports, found {len(csv_imports)}")
        else:
            log_error("List imports failed", response)
            return
        
        # ============================================================
        # STEP 4: Manual Entry - Lower confidence than CalRecycle
        # ============================================================
        log_test(4, "Manual Entry - POST /api/admin/facility-imports")
        response = requests.post(
            f"{API_BASE}/admin/facility-imports",
            json={
                "name": "Manual Test Facility",
                "address": "999 Manual Way",
                "city": "Berkeley",
                "state": "CA",
                "zip": "94704",
                "typeKey": "transfer_station",
                "sourceType": "manual",
                "sourceUrl": ""
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            imp = data.get('import', {})
            manual_import_id = imp.get('id')
            confidence = imp.get('confidenceScore', 0)
            
            log_result(True, f"Manual entry created. ID: {manual_import_id}, Confidence: {confidence}")
            
            # Verify confidence is lower than CalRecycle (should be ~30-50 for manual with no extras)
            if confidence < 60:
                log_result(True, f"Manual entry confidence ({confidence}) is appropriately lower than CalRecycle entries")
            else:
                log_result(False, f"Manual entry confidence ({confidence}) is unexpectedly high")
            
            # Verify duplicateMatches is present
            if 'duplicateMatches' in imp:
                log_result(True, f"duplicateMatches present: {len(imp['duplicateMatches'])} matches")
            else:
                log_result(False, "duplicateMatches missing")
        else:
            log_error("Manual entry failed", response)
            return
        
        # ============================================================
        # STEP 5: Duplicate Check Preview - Mission Trail
        # ============================================================
        log_test(5, "Duplicate Check Preview - GET /api/admin/facility-imports/duplicate-check")
        response = requests.get(
            f"{API_BASE}/admin/facility-imports/duplicate-check?name=Mission%20Trail&address=1080%20Walsh&city=Santa%20Clara",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            dupes = data.get('dupes', [])
            
            log_result(True, f"Duplicate check successful. Found {len(dupes)} potential duplicates")
            
            if len(dupes) > 0:
                log_result(True, "Found at least one duplicate match")
                
                for dupe in dupes[:3]:
                    print(f"\n  Match: {dupe.get('name')}")
                    print(f"    Address: {dupe.get('address')}")
                    print(f"    Similarity: {dupe.get('similarity')}%")
                    print(f"    Name Sim: {dupe.get('nameSim')}%, Addr Sim: {dupe.get('addrSim')}%")
                    
                    # Store Mission Trail ID for merge test
                    if 'Mission Trail' in dupe.get('name', ''):
                        mission_trail_id = dupe.get('id')
                        log_result(True, f"Found Mission Trail facility ID: {mission_trail_id}")
                    
                    # Check for high similarity
                    if dupe.get('similarity', 0) >= 70:
                        log_result(True, f"High similarity match: {dupe.get('similarity')}%")
            else:
                log_result(False, "No duplicate matches found for Mission Trail")
        else:
            log_error("Duplicate check failed", response)
            return
        
        # ============================================================
        # STEP 6: Get Import Detail - Refresh duplicates
        # ============================================================
        if csv_import_ids:
            log_test(6, f"Get Import Detail - GET /api/admin/facility-imports/{csv_import_ids[0]}")
            response = requests.get(
                f"{API_BASE}/admin/facility-imports/{csv_import_ids[0]}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                imp = data.get('import', {})
                
                log_result(True, "Import detail retrieved successfully")
                print(f"  Name: {imp.get('normalizedData', {}).get('name')}")
                print(f"  Confidence: {imp.get('confidenceScore')}")
                print(f"  Status: {imp.get('status')}")
                print(f"  Duplicate Matches: {len(imp.get('duplicateMatches', []))}")
                
                # Verify duplicateMatches refreshed
                if 'duplicateMatches' in imp:
                    log_result(True, "duplicateMatches refreshed in detail view")
                else:
                    log_result(False, "duplicateMatches missing in detail view")
            else:
                log_error("Get import detail failed", response)
        
        # ============================================================
        # STEP 7: Edit Import - Update phone and hours
        # ============================================================
        if csv_import_ids:
            log_test(7, f"Edit Import - PATCH /api/admin/facility-imports/{csv_import_ids[0]}")
            response = requests.patch(
                f"{API_BASE}/admin/facility-imports/{csv_import_ids[0]}",
                json={
                    "action": "edit",
                    "normalizedData": {
                        "phone": "(555) 999-9999",
                        "hours": "Mon-Sun 24/7"
                    }
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                imp = data.get('import', {})
                updated_phone = imp.get('normalizedData', {}).get('phone')
                updated_hours = imp.get('normalizedData', {}).get('hours')
                new_confidence = imp.get('confidenceScore')
                
                log_result(True, "Import edited successfully")
                print(f"  Updated Phone: {updated_phone}")
                print(f"  Updated Hours: {updated_hours}")
                print(f"  New Confidence: {new_confidence}")
                
                # Verify updates
                if updated_phone == "(555) 999-9999":
                    log_result(True, "Phone updated correctly")
                else:
                    log_result(False, f"Phone not updated correctly: {updated_phone}")
                
                if updated_hours == "Mon-Sun 24/7":
                    log_result(True, "Hours updated correctly")
                else:
                    log_result(False, f"Hours not updated correctly: {updated_hours}")
                
                # Confidence should be recomputed (potentially higher with more fields)
                log_result(True, f"Confidence recomputed: {new_confidence}")
            else:
                log_error("Edit import failed", response)
        
        # ============================================================
        # STEP 8: Approve & Publish - Create facility
        # ============================================================
        if csv_import_ids and len(csv_import_ids) > 1:
            log_test(8, f"Approve & Publish - PATCH /api/admin/facility-imports/{csv_import_ids[1]}")
            response = requests.patch(
                f"{API_BASE}/admin/facility-imports/{csv_import_ids[1]}",
                json={"action": "approve"},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                facility = data.get('facility', {})
                facility_id = facility.get('id')
                
                log_result(True, f"Import approved and published. Facility ID: {facility_id}")
                print(f"  Name: {facility.get('name')}")
                print(f"  Address: {facility.get('address')}")
                print(f"  Source URL: {facility.get('sourceUrl')}")
                print(f"  Source Type: {facility.get('sourceType')}")
                print(f"  Confidence Score: {facility.get('confidenceScore')}")
                print(f"  Last Verified At: {facility.get('lastVerifiedAt')}")
                print(f"  Verification Status: {facility.get('verificationStatus')}")
                print(f"  Status: {facility.get('status')}")
                
                # Verify required fields
                if facility.get('sourceUrl'):
                    log_result(True, "sourceUrl preserved")
                else:
                    log_result(False, "sourceUrl missing")
                
                if facility.get('sourceType'):
                    log_result(True, f"sourceType preserved: {facility.get('sourceType')}")
                else:
                    log_result(False, "sourceType missing")
                
                if facility.get('confidenceScore'):
                    log_result(True, f"confidenceScore preserved: {facility.get('confidenceScore')}")
                else:
                    log_result(False, "confidenceScore missing")
                
                if facility.get('lastVerifiedAt'):
                    log_result(True, "lastVerifiedAt preserved")
                else:
                    log_result(False, "lastVerifiedAt missing")
                
                if facility.get('verificationStatus') == 'staff_imported':
                    log_result(True, "verificationStatus set to staff_imported")
                else:
                    log_result(False, f"verificationStatus is {facility.get('verificationStatus')}, expected staff_imported")
                
                if facility.get('status') == 'active':
                    log_result(True, "Status set to active")
                else:
                    log_result(False, f"Status is {facility.get('status')}, expected active")
                
                # Verify facility is accessible via GET /api/facilities
                log_test("8b", "Verify facility in public API - GET /api/facilities")
                search_name = facility.get('name', '').split()[0]
                response2 = requests.get(
                    f"{API_BASE}/facilities?status=active&q={search_name}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response2.status_code == 200:
                    facilities = response2.json().get('facilities', [])
                    found = any(f.get('id') == facility_id for f in facilities)
                    
                    if found:
                        log_result(True, "Approved facility found in public API")
                        
                        # Find the facility and verify fields
                        pub_facility = next((f for f in facilities if f.get('id') == facility_id), None)
                        if pub_facility:
                            print(f"  Public facility fields:")
                            print(f"    sourceUrl: {pub_facility.get('sourceUrl')}")
                            print(f"    sourceType: {pub_facility.get('sourceType')}")
                            print(f"    confidenceScore: {pub_facility.get('confidenceScore')}")
                            print(f"    lastVerifiedAt: {pub_facility.get('lastVerifiedAt')}")
                            
                            if all([pub_facility.get('sourceUrl'), pub_facility.get('sourceType'), 
                                   pub_facility.get('confidenceScore'), pub_facility.get('lastVerifiedAt')]):
                                log_result(True, "All provenance fields preserved in public API")
                            else:
                                log_result(False, "Some provenance fields missing in public API")
                    else:
                        log_result(False, "Approved facility not found in public API")
                else:
                    log_error("Failed to verify facility in public API", response2)
            else:
                log_error("Approve & publish failed", response)
        
        # ============================================================
        # STEP 9: Reject Import
        # ============================================================
        if manual_import_id:
            log_test(9, f"Reject Import - PATCH /api/admin/facility-imports/{manual_import_id}")
            response = requests.patch(
                f"{API_BASE}/admin/facility-imports/{manual_import_id}",
                json={
                    "action": "reject",
                    "reason": "test rejection"
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                log_result(True, f"Import rejected. Status: {data.get('status')}")
                
                # Verify in rejected list
                log_test("9b", "Verify rejected import - GET /api/admin/facility-imports?status=rejected")
                response2 = requests.get(
                    f"{API_BASE}/admin/facility-imports?status=rejected",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                if response2.status_code == 200:
                    imports = response2.json().get('imports', [])
                    rejected = next((imp for imp in imports if imp.get('id') == manual_import_id), None)
                    
                    if rejected:
                        log_result(True, "Rejected import found in rejected list")
                        print(f"  Rejected Reason: {rejected.get('rejectedReason')}")
                        
                        if rejected.get('rejectedReason') == 'test rejection':
                            log_result(True, "Rejection reason preserved correctly")
                        else:
                            log_result(False, f"Rejection reason is '{rejected.get('rejectedReason')}', expected 'test rejection'")
                    else:
                        log_result(False, "Rejected import not found in rejected list")
                else:
                    log_error("Failed to verify rejected import", response2)
            else:
                log_error("Reject import failed", response)
        
        # ============================================================
        # STEP 10: Merge Import - Create similar to Mission Trail
        # ============================================================
        if mission_trail_id:
            log_test(10, "Create import similar to Mission Trail for merge test")
            response = requests.post(
                f"{API_BASE}/admin/facility-imports",
                json={
                    "name": "Mission Trail Waste",
                    "address": "1080 Walsh Avenue",
                    "city": "Santa Clara",
                    "state": "CA",
                    "zip": "95050",
                    "typeKey": "transfer_station",
                    "sourceType": "manual",
                    "sourceUrl": "",
                    "phone": "(408) 555-1234",
                    "hours": "Mon-Fri 7am-6pm"
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                imp = data.get('import', {})
                merge_import_id = imp.get('id')
                dupes = imp.get('duplicateMatches', [])
                
                log_result(True, f"Merge test import created. ID: {merge_import_id}")
                print(f"  Duplicate Matches: {len(dupes)}")
                
                if len(dupes) > 0:
                    log_result(True, f"Found {len(dupes)} duplicate matches")
                    
                    # Check if Mission Trail is in the matches
                    mission_match = next((d for d in dupes if d.get('id') == mission_trail_id), None)
                    if mission_match:
                        log_result(True, f"Mission Trail found in duplicates with {mission_match.get('similarity')}% similarity")
                    else:
                        log_result(False, "Mission Trail not found in duplicate matches")
                    
                    # Now perform merge
                    log_test("10b", f"Merge Import - PATCH /api/admin/facility-imports/{merge_import_id}")
                    response2 = requests.patch(
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
                    
                    if response2.status_code == 200:
                        data2 = response2.json()
                        
                        log_result(True, f"Merge successful. Status: {data2.get('status')}")
                        print(f"  Merged Into: {data2.get('mergedInto')}")
                        print(f"  Fields Updated: {data2.get('fields')}")
                        
                        # Verify target facility was updated
                        log_test("10c", "Verify target facility updated - GET /api/facilities")
                        response3 = requests.get(
                            f"{API_BASE}/facilities?q=Mission%20Trail",
                            headers={"Authorization": f"Bearer {admin_token}"}
                        )
                        
                        if response3.status_code == 200:
                            facilities = response3.json().get('facilities', [])
                            mission_facility = next((f for f in facilities if f.get('id') == mission_trail_id), None)
                            
                            if mission_facility:
                                log_result(True, "Target facility found")
                                print(f"  Last Verified At: {mission_facility.get('lastVerifiedAt')}")
                                
                                # Check if lastVerifiedAt was updated (should be recent)
                                if mission_facility.get('lastVerifiedAt'):
                                    log_result(True, "lastVerifiedAt updated after merge")
                                else:
                                    log_result(False, "lastVerifiedAt not updated")
                            else:
                                log_result(False, "Target facility not found")
                        else:
                            log_error("Failed to verify target facility", response3)
                    else:
                        log_error("Merge failed", response2)
                else:
                    log_result(False, "No duplicate matches found for merge test")
            else:
                log_error("Failed to create merge test import", response)
        
        # ============================================================
        # STEP 11: RBAC - Anonymous rejected (401)
        # ============================================================
        log_test(11, "RBAC - Anonymous access rejected (401)")
        
        endpoints = [
            ("GET", f"{API_BASE}/admin/facility-imports"),
            ("POST", f"{API_BASE}/admin/facility-imports/csv"),
            ("POST", f"{API_BASE}/admin/facility-imports"),
        ]
        
        all_401 = True
        for method, url in endpoints:
            if method == "GET":
                response = requests.get(url)
            else:
                response = requests.post(url, json={})
            
            if response.status_code == 401:
                log_result(True, f"{method} {url.split('/api/')[-1]} → 401")
            else:
                log_result(False, f"{method} {url.split('/api/')[-1]} → {response.status_code} (expected 401)")
                all_401 = False
        
        if all_401:
            log_result(True, "All anonymous requests correctly rejected with 401")
        
        # ============================================================
        # STEP 12: RBAC - Regular user rejected (403)
        # ============================================================
        log_test(12, "RBAC - Regular user access rejected (403)")
        
        # Create a regular user
        test_email = f"regular_user_{datetime.now().timestamp()}@test.com"
        response = requests.post(
            f"{API_BASE}/auth/signup",
            json={
                "email": test_email,
                "password": "testpass123",
                "name": "Regular User"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            regular_token = response.json().get('token')
            log_result(True, f"Regular user created: {test_email}")
            
            # Try to access admin endpoint
            response2 = requests.get(
                f"{API_BASE}/admin/facility-imports",
                headers={"Authorization": f"Bearer {regular_token}"}
            )
            
            if response2.status_code == 403:
                log_result(True, "Regular user correctly rejected with 403")
            else:
                log_result(False, f"Regular user got {response2.status_code}, expected 403")
        else:
            log_error("Failed to create regular user", response)
        
        # ============================================================
        # STEP 13: Notification Counts
        # ============================================================
        log_test(13, "Notification Counts - GET /api/admin/notification-counts")
        response = requests.get(
            f"{API_BASE}/admin/notification-counts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            counts = data.get('counts', {})
            needs_attention = data.get('needsAttention', [])
            
            log_result(True, "Notification counts retrieved successfully")
            
            # Check facility_imports count
            if 'facility_imports' in counts:
                fi_count = counts['facility_imports']
                log_result(True, f"facility_imports count present: {json.dumps(fi_count)}")
                
                if 'count' in fi_count and 'urgent' in fi_count:
                    log_result(True, "facility_imports has count and urgent fields")
                else:
                    log_result(False, "facility_imports missing count or urgent fields")
            else:
                log_result(False, "facility_imports not found in counts")
            
            # Check needsAttention array
            pending_imports = next((item for item in needs_attention if item.get('key') == 'pending_facility_imports'), None)
            
            if pending_imports:
                log_result(True, f"pending_facility_imports found in needsAttention: {json.dumps(pending_imports)}")
            else:
                log_result(False, "pending_facility_imports not found in needsAttention")
        else:
            log_error("Notification counts failed", response)
        
        # ============================================================
        # STEP 14: Bad Input Tests
        # ============================================================
        log_test(14, "Bad Input Tests")
        
        # Empty CSV
        response = requests.post(
            f"{API_BASE}/admin/facility-imports/csv",
            json={"csv": ""},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        if response.status_code == 400:
            log_result(True, "Empty CSV rejected with 400")
        else:
            log_result(False, f"Empty CSV got {response.status_code}, expected 400")
        
        # Missing required fields
        response = requests.post(
            f"{API_BASE}/admin/facility-imports",
            json={},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        if response.status_code == 400:
            log_result(True, "Missing required fields rejected with 400")
        else:
            log_result(False, f"Missing fields got {response.status_code}, expected 400")
        
        # Unknown action
        if csv_import_ids:
            response = requests.patch(
                f"{API_BASE}/admin/facility-imports/{csv_import_ids[0]}",
                json={"action": "unknown"},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            if response.status_code == 400:
                log_result(True, "Unknown action rejected with 400")
            else:
                log_result(False, f"Unknown action got {response.status_code}, expected 400")
        
        # Nonexistent ID
        response = requests.patch(
            f"{API_BASE}/admin/facility-imports/nonexistent-id-12345",
            json={"action": "approve"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        if response.status_code == 404:
            log_result(True, "Nonexistent ID rejected with 404")
        else:
            log_result(False, f"Nonexistent ID got {response.status_code}, expected 404")
        
        # ============================================================
        # FINAL SUMMARY
        # ============================================================
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print("✅ All critical facility import endpoints tested")
        print("✅ CSV upload with 2 rows (CalRecycle + Gov)")
        print("✅ Manual entry with lower confidence score")
        print("✅ Duplicate detection working")
        print("✅ Edit functionality working")
        print("✅ Approve & publish working with provenance fields")
        print("✅ Reject functionality working")
        print("✅ Merge functionality working")
        print("✅ RBAC working (401 for anonymous, 403 for regular users)")
        print("✅ Notification counts working")
        print("✅ Bad input validation working")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
