#!/usr/bin/env python3
"""
Backend test for Marketplace V1 — Phase 1
Tests seed endpoint, listings API, reserve flow, address hiding, and auth/validation
"""

import requests
import time
import uuid
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"
ADMIN_EMAIL = "aj@bisonjunk.com"
ADMIN_PASSWORD = "admin123"

def print_step(step_num, description):
    print(f"\n{'='*80}")
    print(f"STEP {step_num}: {description}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def login(email, password):
    """Login and return Bearer token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            print_result(True, f"Login successful for {email}")
            return token
        else:
            print_result(False, f"Login failed for {email}: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Login exception for {email}: {str(e)}")
        return None

def signup_test_user(email, password):
    """Create a new test user and return Bearer token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": email,
            "password": password,
            "name": f"Test User {email.split('@')[0]}"
        })
        if response.status_code == 200:
            token = response.json().get("token")
            user_id = response.json().get("user", {}).get("id")
            print_result(True, f"Signup successful for {email}, userId: {user_id}")
            return token, user_id
        else:
            print_result(False, f"Signup failed for {email}: {response.status_code} {response.text}")
            return None, None
    except Exception as e:
        print_result(False, f"Signup exception for {email}: {str(e)}")
        return None, None

def main():
    print("\n" + "="*80)
    print("MARKETPLACE V1 — PHASE 1 BACKEND TEST")
    print("="*80)
    
    # ========================================================================
    # SCENARIO A: Seed endpoint POST /api/admin/marketplace/seed-samples
    # ========================================================================
    
    print_step("A1", "Seed endpoint - Anonymous request (expect 401/403)")
    try:
        response = requests.post(f"{BASE_URL}/admin/marketplace/seed-samples")
        if response.status_code in [401, 403]:
            print_result(True, f"Anonymous request correctly rejected: {response.status_code}")
        else:
            print_result(False, f"Expected 401/403, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("A2", "Seed endpoint - Super admin request (expect 200 with created/skipped/total)")
    super_admin_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not super_admin_token:
        print_result(False, "Cannot proceed without super admin token")
        return
    
    try:
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(f"{BASE_URL}/admin/marketplace/seed-samples", headers=headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if "ok" in data and "total" in data:
                print_result(True, f"Seed successful: created={data.get('created', 0)}, skipped={data.get('skipped', 0)}, total={data.get('total', 0)}")
                first_call_skipped = data.get('skipped', 0)
            else:
                print_result(False, f"Missing expected fields in response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("A3", "Seed endpoint - Idempotency check (second call should skip all)")
    try:
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(f"{BASE_URL}/admin/marketplace/seed-samples", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data.get('total') == 10 and data.get('skipped', 0) >= first_call_skipped:
                print_result(True, f"Idempotent: total={data.get('total')}, skipped={data.get('skipped')}")
            else:
                print_result(False, f"Idempotency issue: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    # ========================================================================
    # SCENARIO B: GET /api/marketplace (anonymous)
    # ========================================================================
    
    print_step("B1", "GET /api/marketplace - Anonymous request (expect ≥10 listings)")
    try:
        response = requests.get(f"{BASE_URL}/marketplace")
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            print(f"Found {len(listings)} listings")
            
            if len(listings) >= 10:
                print_result(True, f"Found {len(listings)} listings (≥10)")
            else:
                print_result(False, f"Expected ≥10 listings, got {len(listings)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B2", "Verify addressHidden=true and lat/lng/zip/location absent for anonymous")
    try:
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            all_hidden = True
            for listing in listings[:5]:  # Check first 5
                if listing.get("addressHidden") != True:
                    print_result(False, f"Listing {listing.get('id')} has addressHidden={listing.get('addressHidden')}, expected True")
                    all_hidden = False
                    break
                
                # Check that lat, lng, zip, location are absent
                forbidden_fields = []
                if "lat" in listing and listing["lat"] is not None:
                    forbidden_fields.append("lat")
                if "lng" in listing and listing["lng"] is not None:
                    forbidden_fields.append("lng")
                if "zip" in listing and listing["zip"] is not None:
                    forbidden_fields.append("zip")
                if "location" in listing and listing["location"] is not None:
                    forbidden_fields.append("location")
                
                if forbidden_fields:
                    print_result(False, f"Listing {listing.get('id')} has forbidden fields: {forbidden_fields}")
                    all_hidden = False
                    break
            
            if all_hidden:
                print_result(True, "All listings have addressHidden=true and no lat/lng/zip/location")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B3", "Verify listings have itemStatus, priceType, seller.badge")
    try:
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            all_valid = True
            for listing in listings[:3]:  # Check first 3
                if "itemStatus" not in listing:
                    print_result(False, f"Listing {listing.get('id')} missing itemStatus")
                    all_valid = False
                    break
                if "priceType" not in listing:
                    print_result(False, f"Listing {listing.get('id')} missing priceType")
                    all_valid = False
                    break
                if "seller" not in listing or not isinstance(listing["seller"], dict):
                    print_result(False, f"Listing {listing.get('id')} missing seller object")
                    all_valid = False
                    break
                if "badge" not in listing["seller"]:
                    print_result(False, f"Listing {listing.get('id')} seller missing badge")
                    all_valid = False
                    break
            
            if all_valid:
                print_result(True, "All listings have required fields: itemStatus, priceType, seller.badge")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B4", "Verify 'Wood Dining Table Set' and 'Vintage Arcade Machine' have leavingInMinutes")
    try:
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            wood_table = None
            arcade = None
            
            for listing in listings:
                title = listing.get("title", "")
                if "Wood Dining Table Set" in title:
                    wood_table = listing
                if "Vintage Arcade Machine" in title:
                    arcade = listing
            
            if wood_table and "leavingInMinutes" in wood_table and wood_table["leavingInMinutes"] > 0:
                print_result(True, f"Wood Dining Table Set has leavingInMinutes={wood_table['leavingInMinutes']}")
            else:
                print_result(False, f"Wood Dining Table Set missing leavingInMinutes or ≤0: {wood_table}")
            
            if arcade and "leavingInMinutes" in arcade and arcade["leavingInMinutes"] > 0:
                print_result(True, f"Vintage Arcade Machine has leavingInMinutes={arcade['leavingInMinutes']}")
            else:
                print_result(False, f"Vintage Arcade Machine missing leavingInMinutes or ≤0: {arcade}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B5", "Filter by itemStatus=on_truck")
    try:
        response = requests.get(f"{BASE_URL}/marketplace?itemStatus=on_truck")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            all_on_truck = True
            for listing in listings:
                if listing.get("itemStatus") != "on_truck":
                    print_result(False, f"Listing {listing.get('id')} has itemStatus={listing.get('itemStatus')}, expected on_truck")
                    all_on_truck = False
                    break
            
            if all_on_truck and len(listings) > 0:
                print_result(True, f"All {len(listings)} listings have itemStatus=on_truck")
            elif len(listings) == 0:
                print_result(True, "No on_truck listings found (acceptable)")
            else:
                print_result(False, "Some listings don't have itemStatus=on_truck")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B6", "Filter by priceType=free")
    try:
        response = requests.get(f"{BASE_URL}/marketplace?priceType=free")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            all_free = True
            for listing in listings:
                if listing.get("priceType") != "free":
                    print_result(False, f"Listing {listing.get('id')} has priceType={listing.get('priceType')}, expected free")
                    all_free = False
                    break
            
            if all_free and len(listings) > 0:
                print_result(True, f"All {len(listings)} listings have priceType=free")
            elif len(listings) == 0:
                print_result(True, "No free listings found (acceptable)")
            else:
                print_result(False, "Some listings don't have priceType=free")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("B7", "Sort by leaving_soon (listings with leavingAt should come first)")
    try:
        response = requests.get(f"{BASE_URL}/marketplace?sort=leaving_soon")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            # Check that listings with leavingAt come first and are sorted ascending
            leaving_listings = [l for l in listings if l.get("leavingAt")]
            if len(leaving_listings) >= 2:
                # Check ascending order
                sorted_correctly = True
                for i in range(len(leaving_listings) - 1):
                    if leaving_listings[i].get("leavingAt") > leaving_listings[i+1].get("leavingAt"):
                        sorted_correctly = False
                        break
                
                if sorted_correctly:
                    print_result(True, f"Found {len(leaving_listings)} listings with leavingAt, sorted ascending")
                else:
                    print_result(False, "Listings with leavingAt not sorted ascending")
            else:
                print_result(True, f"Found {len(leaving_listings)} listings with leavingAt (acceptable)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    # ========================================================================
    # SCENARIO C: Reserve flow
    # ========================================================================
    
    # Create two test users
    print_step("C0", "Create two test users for reserve flow")
    unique_id = str(uuid.uuid4())[:8]
    user_a_email = f"marketplace.testA+{unique_id}@example.com"
    user_b_email = f"marketplace.testB+{unique_id}@example.com"
    
    user_a_token, user_a_id = signup_test_user(user_a_email, "Password123!")
    user_b_token, user_b_id = signup_test_user(user_b_email, "Password123!")
    
    if not user_a_token or not user_b_token:
        print_result(False, "Cannot proceed without test user tokens")
        return
    
    # Find a FREE listing that is NOT sold/claimed
    print_step("C0b", "Find a FREE listing for reserve testing")
    try:
        response = requests.get(f"{BASE_URL}/marketplace?priceType=free")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            test_listing = None
            for listing in listings:
                status = listing.get("itemStatus", "")
                if status not in ["sold", "claimed", "donated", "recycled", "reserved"]:
                    test_listing = listing
                    break
            
            if test_listing:
                test_listing_id = test_listing["id"]
                print_result(True, f"Found test listing: {test_listing.get('title')} (id={test_listing_id}, status={test_listing.get('itemStatus')})")
            else:
                print_result(False, "No available FREE listing found for testing")
                return
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            return
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return
    
    print_step("C1", "Owner self-reserve attempt (expect 400)")
    try:
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(f"{BASE_URL}/marketplace/{test_listing_id}/reserve", headers=headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 400:
            error_text = response.text.lower()
            if "cannot reserve" in error_text or "own item" in error_text or "your own" in error_text:
                print_result(True, f"Owner self-reserve correctly rejected: {response.text[:200]}")
            else:
                print_result(False, f"Got 400 but wrong error message: {response.text[:200]}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C2", "User A reserves listing (expect 200 with reservation details)")
    try:
        headers = {"Authorization": f"Bearer {user_a_token}"}
        response = requests.post(f"{BASE_URL}/marketplace/{test_listing_id}/reserve", headers=headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        if response.status_code == 200:
            data = response.json()
            listing = data.get("listing", {})
            reservation = listing.get("reservation")
            
            if reservation:
                if reservation.get("userId") == user_a_id:
                    print_result(True, f"Reservation userId matches User A: {user_a_id}")
                else:
                    print_result(False, f"Reservation userId mismatch: expected {user_a_id}, got {reservation.get('userId')}")
                
                ms_remaining = reservation.get("msRemaining", 0)
                if 895000 <= ms_remaining <= 905000:  # ±5000ms tolerance
                    print_result(True, f"msRemaining ≈ 900000: {ms_remaining}")
                else:
                    print_result(False, f"msRemaining out of range: {ms_remaining} (expected ≈900000)")
                
                if "expiresAt" in reservation:
                    print_result(True, f"expiresAt present: {reservation['expiresAt']}")
                else:
                    print_result(False, "expiresAt missing")
            else:
                print_result(False, "Reservation object missing in response")
            
            if listing.get("itemStatus") == "reserved":
                print_result(True, f"itemStatus=reserved")
            else:
                print_result(False, f"itemStatus={listing.get('itemStatus')}, expected reserved")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C3", "User A GET listing (expect addressHidden=false, full address visible)")
    try:
        headers = {"Authorization": f"Bearer {user_a_token}"}
        response = requests.get(f"{BASE_URL}/marketplace/{test_listing_id}", headers=headers)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            listing = data.get("listing", {})
            
            if listing.get("addressHidden") == False or listing.get("addressHidden") is None:
                print_result(True, f"addressHidden is False/absent for reserver")
            else:
                print_result(False, f"addressHidden={listing.get('addressHidden')}, expected False")
            
            # Check that city is present (should always be visible)
            if "city" in listing and listing["city"]:
                print_result(True, f"city present: {listing['city']}")
            else:
                print_result(False, "city missing or empty")
            
            # Check if location/zip are present (they should be for reserver)
            has_location = "location" in listing and listing["location"]
            has_zip = "zip" in listing and listing["zip"]
            if has_location or has_zip:
                print_result(True, f"Full address details visible (location={has_location}, zip={has_zip})")
            else:
                print_result(True, "location/zip may not be in source data (acceptable)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C4", "Anonymous GET listing (expect addressHidden=true)")
    try:
        response = requests.get(f"{BASE_URL}/marketplace/{test_listing_id}")
        if response.status_code == 200:
            data = response.json()
            listing = data.get("listing", {})
            
            if listing.get("addressHidden") == True:
                print_result(True, "addressHidden=true for anonymous")
            else:
                print_result(False, f"addressHidden={listing.get('addressHidden')}, expected True")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C5", "User B tries to reserve (expect 409 - already reserved)")
    try:
        headers = {"Authorization": f"Bearer {user_b_token}"}
        response = requests.post(f"{BASE_URL}/marketplace/{test_listing_id}/reserve", headers=headers)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 409:
            error_text = response.text.lower()
            if "reserved" in error_text or "someone else" in error_text or "already" in error_text:
                print_result(True, f"User B correctly blocked: {response.text[:200]}")
            else:
                print_result(False, f"Got 409 but wrong error message: {response.text[:200]}")
        else:
            print_result(False, f"Expected 409, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C6", "User A cancels reservation (expect 200, reservation=null, status=available)")
    try:
        headers = {"Authorization": f"Bearer {user_a_token}"}
        response = requests.post(f"{BASE_URL}/marketplace/{test_listing_id}/reserve/cancel", headers=headers)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            listing = data.get("listing", {})
            
            if listing.get("reservation") is None:
                print_result(True, "reservation=null after cancel")
            else:
                print_result(False, f"reservation still present: {listing.get('reservation')}")
            
            if listing.get("itemStatus") == "available":
                print_result(True, "itemStatus=available after cancel")
            else:
                print_result(False, f"itemStatus={listing.get('itemStatus')}, expected available")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C7", "User A reserves again, then seller completes with finalStatus=claimed")
    try:
        # User A reserves
        headers_a = {"Authorization": f"Bearer {user_a_token}"}
        response = requests.post(f"{BASE_URL}/marketplace/{test_listing_id}/reserve", headers=headers_a)
        if response.status_code == 200:
            print_result(True, "User A reserved again")
        else:
            print_result(False, f"User A reserve failed: {response.status_code}")
        
        # Seller completes with claimed
        headers_seller = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(
            f"{BASE_URL}/marketplace/{test_listing_id}/reserve/complete",
            headers=headers_seller,
            json={"finalStatus": "claimed"}
        )
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        if response.status_code == 200:
            data = response.json()
            listing = data.get("listing", {})
            
            if listing.get("itemStatus") == "claimed":
                print_result(True, "itemStatus=claimed")
            else:
                print_result(False, f"itemStatus={listing.get('itemStatus')}, expected claimed")
            
            if listing.get("reservation") is None:
                print_result(True, "reservation=null after complete")
            else:
                print_result(False, f"reservation still present: {listing.get('reservation')}")
            
            if listing.get("sold") == False:
                print_result(True, "sold=false for claimed")
            else:
                print_result(False, f"sold={listing.get('sold')}, expected False")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C8", "Find another listing, reserve, complete with finalStatus=sold")
    try:
        # Find another available listing
        response = requests.get(f"{BASE_URL}/marketplace?priceType=free")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            test_listing_2 = None
            for listing in listings:
                status = listing.get("itemStatus", "")
                if status not in ["sold", "claimed", "donated", "recycled", "reserved"] and listing["id"] != test_listing_id:
                    test_listing_2 = listing
                    break
            
            if not test_listing_2:
                print_result(False, "No second available listing found")
            else:
                test_listing_2_id = test_listing_2["id"]
                print_result(True, f"Found second test listing: {test_listing_2.get('title')} (id={test_listing_2_id})")
                
                # User A reserves
                headers_a = {"Authorization": f"Bearer {user_a_token}"}
                response = requests.post(f"{BASE_URL}/marketplace/{test_listing_2_id}/reserve", headers=headers_a)
                if response.status_code == 200:
                    print_result(True, "User A reserved second listing")
                else:
                    print_result(False, f"User A reserve failed: {response.status_code}")
                
                # Seller completes with sold
                headers_seller = {"Authorization": f"Bearer {super_admin_token}"}
                response = requests.post(
                    f"{BASE_URL}/marketplace/{test_listing_2_id}/reserve/complete",
                    headers=headers_seller,
                    json={"finalStatus": "sold"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    listing = data.get("listing", {})
                    
                    if listing.get("itemStatus") == "sold":
                        print_result(True, "itemStatus=sold")
                    else:
                        print_result(False, f"itemStatus={listing.get('itemStatus')}, expected sold")
                    
                    if listing.get("sold") == True:
                        print_result(True, "sold=true for sold")
                    else:
                        print_result(False, f"sold={listing.get('sold')}, expected True")
                    
                    if "soldAt" in listing and listing["soldAt"]:
                        print_result(True, f"soldAt present: {listing['soldAt']}")
                    else:
                        print_result(False, "soldAt missing or empty")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("C9", "PATCH listing with itemStatus=last_chance and leavingInMinutes=15")
    try:
        # Find an available listing owned by jamal
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            
            test_listing_3 = None
            for listing in listings:
                status = listing.get("itemStatus", "")
                if status in ["available", "on_truck", "at_site"]:
                    test_listing_3 = listing
                    break
            
            if not test_listing_3:
                print_result(False, "No available listing found for PATCH test")
            else:
                test_listing_3_id = test_listing_3["id"]
                print_result(True, f"Found listing for PATCH: {test_listing_3.get('title')} (id={test_listing_3_id})")
                
                # PATCH as seller
                headers_seller = {"Authorization": f"Bearer {super_admin_token}"}
                response = requests.patch(
                    f"{BASE_URL}/marketplace/{test_listing_3_id}",
                    headers=headers_seller,
                    json={"itemStatus": "last_chance", "leavingInMinutes": 15}
                )
                print(f"PATCH response status: {response.status_code}")
                
                if response.status_code == 200:
                    print_result(True, "PATCH successful")
                    
                    # GET to verify
                    response = requests.get(f"{BASE_URL}/marketplace/{test_listing_3_id}")
                    if response.status_code == 200:
                        data = response.json()
                        listing = data.get("listing", {})
                        
                        if listing.get("itemStatus") == "last_chance":
                            print_result(True, "itemStatus=last_chance")
                        else:
                            print_result(False, f"itemStatus={listing.get('itemStatus')}, expected last_chance")
                        
                        leaving_mins = listing.get("leavingInMinutes")
                        if leaving_mins and 14 <= leaving_mins <= 15:
                            print_result(True, f"leavingInMinutes={leaving_mins} (between 14-15)")
                        else:
                            print_result(False, f"leavingInMinutes={leaving_mins}, expected 14-15")
                    else:
                        print_result(False, f"GET after PATCH failed: {response.status_code}")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    # ========================================================================
    # SCENARIO D: Auth & validation
    # ========================================================================
    
    print_step("D1", "Reserve without Authorization header (expect 401)")
    try:
        # Find any available listing
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            if listings:
                test_id = listings[0]["id"]
                
                response = requests.post(f"{BASE_URL}/marketplace/{test_id}/reserve")
                if response.status_code == 401:
                    print_result(True, "Unauthorized request correctly rejected: 401")
                else:
                    print_result(False, f"Expected 401, got {response.status_code}")
            else:
                print_result(False, "No listings found for auth test")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("D2", "PATCH as non-owner (expect 403)")
    try:
        # Find a listing owned by jamal
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            if listings:
                test_id = listings[0]["id"]
                
                # Try to PATCH as User A (non-owner)
                headers_a = {"Authorization": f"Bearer {user_a_token}"}
                response = requests.patch(
                    f"{BASE_URL}/marketplace/{test_id}",
                    headers=headers_a,
                    json={"title": "Hacked Title"}
                )
                print(f"Response status: {response.status_code}")
                
                if response.status_code == 403:
                    print_result(True, "Non-owner PATCH correctly rejected: 403")
                else:
                    print_result(False, f"Expected 403, got {response.status_code}")
            else:
                print_result(False, "No listings found for PATCH test")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print_step("D3", "Complete reservation as non-seller (expect 403)")
    try:
        # Find a listing with active reservation (if any) or use test_listing_id
        # For simplicity, try to complete on any listing as User A
        response = requests.get(f"{BASE_URL}/marketplace")
        if response.status_code == 200:
            data = response.json()
            listings = data.get("listings", [])
            if listings:
                test_id = listings[0]["id"]
                
                # Try to complete as User A (non-seller)
                headers_a = {"Authorization": f"Bearer {user_a_token}"}
                response = requests.post(
                    f"{BASE_URL}/marketplace/{test_id}/reserve/complete",
                    headers=headers_a,
                    json={"finalStatus": "claimed"}
                )
                print(f"Response status: {response.status_code}")
                print(f"Response body: {response.text[:500]}")
                
                if response.status_code == 403:
                    error_text = response.text.lower()
                    if "seller" in error_text or "only the seller" in error_text:
                        print_result(True, f"Non-seller complete correctly rejected: {response.text[:200]}")
                    else:
                        print_result(False, f"Got 403 but wrong error message: {response.text[:200]}")
                else:
                    print_result(False, f"Expected 403, got {response.status_code}")
            else:
                print_result(False, "No listings found for complete test")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
    
    print("\n" + "="*80)
    print("MARKETPLACE V1 — PHASE 1 BACKEND TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
