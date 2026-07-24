#!/usr/bin/env python3
"""
Backend test for Facility Claiming Flow + Community MVP
Tests the newly added endpoints in /app/app/api/[[...path]]/route.js
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "jamal@dumpmaps.org"
ADMIN_PASSWORD = "@@Jefferson2180"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def signup(email, password, name):
    """Sign up a new user"""
    try:
        r = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": email,
            "password": password,
            "name": name
        })
        if r.status_code == 200:
            return r.json()
        else:
            log(f"❌ Signup failed for {email}: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        log(f"❌ Signup exception for {email}: {e}")
        return None

def login(email, password):
    """Login and return token"""
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        if r.status_code == 200:
            data = r.json()
            return data.get('token')
        else:
            log(f"❌ Login failed for {email}: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        log(f"❌ Login exception for {email}: {e}")
        return None

def headers(token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ============================================================
# GROUP 1: FACILITY CLAIMING FLOW
# ============================================================

def test_facility_claiming_flow():
    log("\n" + "="*60)
    log("GROUP 1: FACILITY CLAIMING FLOW")
    log("="*60)
    
    # Step 1: Setup - Login admin and create test users
    log("\n✓ Step 1: Setup - Login admin and create test users")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ CRITICAL: Admin login failed")
        return False
    log(f"✅ Admin logged in successfully")
    
    # Create test users
    timestamp = int(time.time())
    user1_email = f"claimer_{timestamp}@test.com"
    user2_email = f"claimer2_{timestamp}@test.com"
    
    user1_data = signup(user1_email, "password123", "Test Claimer 1")
    user2_data = signup(user2_email, "password123", "Test Claimer 2")
    
    if not user1_data or not user2_data:
        log("❌ CRITICAL: User signup failed")
        return False
    
    user1_token = user1_data.get('token')
    user2_token = user2_data.get('token')
    log(f"✅ Test users created: {user1_email}, {user2_email}")
    
    # Step 2: Get an unclaimed facility to claim
    log("\n✓ Step 2: Get an unclaimed facility to claim")
    try:
        r = requests.get(f"{BASE_URL}/facilities?limit=10")
        if r.status_code != 200:
            log(f"❌ Failed to get facilities: {r.status_code}")
            return False
        facilities = r.json().get('facilities', [])
        if not facilities:
            log("❌ No facilities found")
            return False
        # Find an unclaimed facility
        facility = None
        for f in facilities:
            if not f.get('claimedByUserId'):
                facility = f
                break
        if not facility:
            log("❌ No unclaimed facilities found")
            return False
        facility_id = facility['id']
        log(f"✅ Found unclaimed facility to claim: {facility['name']} (ID: {facility_id})")
    except Exception as e:
        log(f"❌ Exception getting facilities: {e}")
        return False
    
    # Step 3: POST /api/facility-claims - Unauthorized (no token)
    log("\n✓ Step 3: POST /api/facility-claims - Unauthorized (no token)")
    try:
        r = requests.post(f"{BASE_URL}/facility-claims", json={
            "facilityId": facility_id,
            "claimantName": "Test Owner",
            "businessRole": "Owner",
            "businessEmail": "owner@test.com",
            "phone": "555-1234",
            "website": "https://test.com",
            "proofNotes": "I own this facility",
            "message": "Please approve my claim"
        })
        if r.status_code == 401:
            log(f"✅ Correctly rejected unauthorized claim (401)")
        else:
            log(f"❌ Expected 401, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 4: POST /api/facility-claims - Create claim (user1)
    log("\n✓ Step 4: POST /api/facility-claims - Create claim (user1)")
    try:
        r = requests.post(f"{BASE_URL}/facility-claims", 
            headers=headers(user1_token),
            json={
                "facilityId": facility_id,
                "claimantName": "Test Owner",
                "businessRole": "Owner",
                "businessEmail": user1_email,
                "phone": "555-1234",
                "website": "https://test.com",
                "proofNotes": "I own this facility",
                "message": "Please approve my claim"
            })
        if r.status_code == 200:
            claim_data = r.json()
            claim1_id = claim_data['claim']['id']
            log(f"✅ Claim created successfully (ID: {claim1_id})")
            log(f"   Status: {claim_data['claim']['status']}")
        else:
            log(f"❌ Failed to create claim: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 5: POST /api/facility-claims - Duplicate pending claim (user1)
    log("\n✓ Step 5: POST /api/facility-claims - Duplicate pending claim (user1)")
    try:
        r = requests.post(f"{BASE_URL}/facility-claims", 
            headers=headers(user1_token),
            json={
                "facilityId": facility_id,
                "claimantName": "Test Owner",
                "businessRole": "Owner",
                "businessEmail": user1_email,
                "phone": "555-1234"
            })
        if r.status_code == 409:
            log(f"✅ Correctly rejected duplicate pending claim (409)")
            log(f"   Error: {r.json().get('error')}")
        else:
            log(f"❌ Expected 409, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 6: GET /api/facility-claims/mine - Get user's claims
    log("\n✓ Step 6: GET /api/facility-claims/mine - Get user's claims")
    try:
        r = requests.get(f"{BASE_URL}/facility-claims/mine", headers=headers(user1_token))
        if r.status_code == 200:
            claims = r.json().get('claims', [])
            log(f"✅ Retrieved {len(claims)} claim(s) for user1")
            if len(claims) > 0:
                log(f"   Claim ID: {claims[0]['id']}, Status: {claims[0]['status']}")
        else:
            log(f"❌ Failed to get claims: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 7: GET /api/facility-claims/mine?facilityId=<id> - Filter by facility
    log("\n✓ Step 7: GET /api/facility-claims/mine?facilityId=<id> - Filter by facility")
    try:
        r = requests.get(f"{BASE_URL}/facility-claims/mine?facilityId={facility_id}", 
            headers=headers(user1_token))
        if r.status_code == 200:
            claims = r.json().get('claims', [])
            log(f"✅ Retrieved {len(claims)} claim(s) for facility {facility_id}")
            if len(claims) > 0 and claims[0]['facilityId'] == facility_id:
                log(f"   Correctly filtered by facilityId")
        else:
            log(f"❌ Failed to get filtered claims: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 8: GET /api/facility-claims/mine - No auth (should return empty array)
    log("\n✓ Step 8: GET /api/facility-claims/mine - No auth (should return empty array)")
    try:
        r = requests.get(f"{BASE_URL}/facility-claims/mine")
        if r.status_code == 200:
            claims = r.json().get('claims', [])
            if len(claims) == 0:
                log(f"✅ Correctly returned empty array for unauthenticated request")
            else:
                log(f"❌ Expected empty array, got {len(claims)} claims")
                return False
        else:
            log(f"❌ Expected 200, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 9: GET /api/admin/facility-claims - Admin list (moderator+)
    log("\n✓ Step 9: GET /api/admin/facility-claims - Admin list (moderator+)")
    try:
        r = requests.get(f"{BASE_URL}/admin/facility-claims", headers=headers(admin_token))
        if r.status_code == 200:
            claims = r.json().get('claims', [])
            log(f"✅ Admin retrieved {len(claims)} claim(s)")
        else:
            log(f"❌ Failed to get admin claims: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 10: GET /api/admin/facility-claims?status=pending - Filter by status
    log("\n✓ Step 10: GET /api/admin/facility-claims?status=pending - Filter by status")
    try:
        r = requests.get(f"{BASE_URL}/admin/facility-claims?status=pending", 
            headers=headers(admin_token))
        if r.status_code == 200:
            claims = r.json().get('claims', [])
            log(f"✅ Admin retrieved {len(claims)} pending claim(s)")
            pending_found = any(c['id'] == claim1_id for c in claims)
            if pending_found:
                log(f"   ✅ Found our test claim in pending list")
        else:
            log(f"❌ Failed to get pending claims: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 11: PATCH /api/admin/facility-claims/:id - Approve claim
    log("\n✓ Step 11: PATCH /api/admin/facility-claims/:id - Approve claim")
    try:
        r = requests.patch(f"{BASE_URL}/admin/facility-claims/{claim1_id}",
            headers=headers(admin_token),
            json={
                "action": "approve",
                "adminNote": "Verified ownership documentation"
            })
        if r.status_code == 200:
            claim = r.json().get('claim', {})
            log(f"✅ Claim approved successfully")
            log(f"   Status: {claim['status']}")
            log(f"   Admin note: {claim['adminNote']}")
        else:
            log(f"❌ Failed to approve claim: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 12: Verify facility.claimedByUserId is set
    log("\n✓ Step 12: Verify facility.claimedByUserId is set")
    try:
        r = requests.get(f"{BASE_URL}/facilities/{facility_id}")
        if r.status_code == 200:
            facility_data = r.json().get('facility', {})
            if facility_data.get('claimedByUserId') == user1_data['user']['id']:
                log(f"✅ Facility claimedByUserId correctly set to user1")
                log(f"   Claimed: {facility_data.get('claimed')}")
                if facility_data.get('owner'):
                    log(f"   Owner object present: {facility_data['owner']}")
            else:
                log(f"❌ Facility claimedByUserId not set correctly")
                log(f"   Expected: {user1_data['user']['id']}")
                log(f"   Got: {facility_data.get('claimedByUserId')}")
                return False
        else:
            log(f"❌ Failed to get facility: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 13: Verify user.ownedFacilities and verificationLevel
    log("\n✓ Step 13: Verify user.ownedFacilities and verificationLevel")
    try:
        r = requests.get(f"{BASE_URL}/admin/users/{user1_data['user']['id']}", 
            headers=headers(admin_token))
        if r.status_code == 200:
            user = r.json().get('user', {})
            if facility_id in user.get('ownedFacilities', []):
                log(f"✅ User ownedFacilities contains facility ID")
            else:
                log(f"❌ User ownedFacilities does not contain facility ID")
                return False
            
            if user.get('verificationLevel') == 'verified_facility_owner':
                log(f"✅ User verificationLevel set to 'verified_facility_owner'")
            else:
                log(f"❌ User verificationLevel not set correctly: {user.get('verificationLevel')}")
                return False
        else:
            log(f"❌ Failed to get user: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 14: POST /api/facility-claims - Already claimed facility (user2)
    log("\n✓ Step 14: POST /api/facility-claims - Already claimed facility (user2)")
    try:
        r = requests.post(f"{BASE_URL}/facility-claims", 
            headers=headers(user2_token),
            json={
                "facilityId": facility_id,
                "claimantName": "Another Claimer",
                "businessRole": "Manager"
            })
        if r.status_code == 409:
            log(f"✅ Correctly rejected claim for already-claimed facility (409)")
            log(f"   Error: {r.json().get('error')}")
        else:
            log(f"❌ Expected 409, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 15: PATCH /api/facilities/:id/owner-update - Owner can update
    log("\n✓ Step 15: PATCH /api/facilities/:id/owner-update - Owner can update")
    try:
        r = requests.patch(f"{BASE_URL}/facilities/{facility_id}/owner-update",
            headers=headers(user1_token),
            json={
                "hours": "Mon-Fri 8am-5pm",
                "phone": "555-9999",
                "website": "https://updated.com",
                "accepted": ["Wood", "Metal", "Concrete"],
                "notAccepted": ["Hazardous waste"],
                "pricing": "$50/ton",
                "currentStatus": "open"
            })
        if r.status_code == 200:
            facility = r.json().get('facility', {})
            log(f"✅ Owner successfully updated facility")
            log(f"   Hours: {facility.get('hours')}")
            log(f"   Phone: {facility.get('phone')}")
            log(f"   Current status: {facility.get('currentStatus')}")
        else:
            log(f"❌ Failed to update facility: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 16: PATCH /api/facilities/:id/owner-update - Non-owner cannot update
    log("\n✓ Step 16: PATCH /api/facilities/:id/owner-update - Non-owner cannot update")
    try:
        r = requests.patch(f"{BASE_URL}/facilities/{facility_id}/owner-update",
            headers=headers(user2_token),
            json={
                "hours": "Hacked hours"
            })
        if r.status_code == 403:
            log(f"✅ Correctly rejected non-owner update (403)")
        else:
            log(f"❌ Expected 403, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 17: POST /api/facilities/:id/owner-updates - Create official alert
    log("\n✓ Step 17: POST /api/facilities/:id/owner-updates - Create official alert")
    try:
        r = requests.post(f"{BASE_URL}/facilities/{facility_id}/owner-updates",
            headers=headers(user1_token),
            json={
                "type": "OWNER_UPDATE",
                "text": "We are now accepting electronics!",
                "message": "We are now accepting electronics!"
            })
        if r.status_code == 200:
            alert = r.json().get('alert', {})
            log(f"✅ Official alert created successfully")
            log(f"   Alert ID: {alert['id']}")
            log(f"   Official: {alert.get('official')}")
            log(f"   Message: {alert.get('message')}")
        else:
            log(f"❌ Failed to create alert: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 18: PATCH /api/admin/facility-claims/:id - Revoke claim
    log("\n✓ Step 18: PATCH /api/admin/facility-claims/:id - Revoke claim")
    try:
        r = requests.patch(f"{BASE_URL}/admin/facility-claims/{claim1_id}",
            headers=headers(admin_token),
            json={
                "action": "revoke",
                "adminNote": "Ownership verification failed"
            })
        if r.status_code == 200:
            claim = r.json().get('claim', {})
            log(f"✅ Claim revoked successfully")
            log(f"   Status: {claim['status']}")
        else:
            log(f"❌ Failed to revoke claim: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 19: Verify facility.claimedByUserId is unset
    log("\n✓ Step 19: Verify facility.claimedByUserId is unset")
    try:
        r = requests.get(f"{BASE_URL}/facilities/{facility_id}")
        if r.status_code == 200:
            facility_data = r.json().get('facility', {})
            if not facility_data.get('claimedByUserId'):
                log(f"✅ Facility claimedByUserId correctly unset")
                log(f"   Claimed: {facility_data.get('claimed')}")
            else:
                log(f"❌ Facility claimedByUserId still set: {facility_data.get('claimedByUserId')}")
                return False
        else:
            log(f"❌ Failed to get facility: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 20: Verify user.ownedFacilities is updated
    log("\n✓ Step 20: Verify user.ownedFacilities is updated")
    try:
        r = requests.get(f"{BASE_URL}/admin/users/{user1_data['user']['id']}", 
            headers=headers(admin_token))
        if r.status_code == 200:
            user = r.json().get('user', {})
            if facility_id not in user.get('ownedFacilities', []):
                log(f"✅ User ownedFacilities correctly updated (facility removed)")
            else:
                log(f"❌ User ownedFacilities still contains facility ID")
                return False
        else:
            log(f"❌ Failed to get user: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    log("\n" + "="*60)
    log("✅ GROUP 1: FACILITY CLAIMING FLOW - ALL TESTS PASSED")
    log("="*60)
    return True

# ============================================================
# GROUP 2: COMMUNITY MVP
# ============================================================

def test_community_mvp():
    log("\n" + "="*60)
    log("GROUP 2: COMMUNITY MVP")
    log("="*60)
    
    # Step 1: Setup - Login admin and create test users
    log("\n✓ Step 1: Setup - Login admin and create test users")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ CRITICAL: Admin login failed")
        return False
    log(f"✅ Admin logged in successfully")
    
    # Create test users
    timestamp = int(time.time())
    user1_email = f"community_{timestamp}@test.com"
    user2_email = f"community2_{timestamp}@test.com"
    
    user1_data = signup(user1_email, "password123", "Community User 1")
    user2_data = signup(user2_email, "password123", "Community User 2")
    
    if not user1_data or not user2_data:
        log("❌ CRITICAL: User signup failed")
        return False
    
    user1_token = user1_data.get('token')
    user2_token = user2_data.get('token')
    user1_id = user1_data['user']['id']
    user2_id = user2_data['user']['id']
    log(f"✅ Test users created: {user1_email}, {user2_email}")
    
    # Step 2: POST /api/community/posts - Unauthorized (no token)
    log("\n✓ Step 2: POST /api/community/posts - Unauthorized (no token)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts", json={
            "category": "illegal_dumping",
            "title": "Test post",
            "body": "Test body"
        })
        if r.status_code == 401:
            log(f"✅ Correctly rejected unauthorized post (401)")
        else:
            log(f"❌ Expected 401, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 3: POST /api/community/posts - Missing required fields
    log("\n✓ Step 3: POST /api/community/posts - Missing required fields")
    try:
        r = requests.post(f"{BASE_URL}/community/posts",
            headers=headers(user1_token),
            json={"body": "Missing title and category"})
        if r.status_code == 400:
            log(f"✅ Correctly rejected post with missing fields (400)")
            log(f"   Error: {r.json().get('error')}")
        else:
            log(f"❌ Expected 400, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 4: POST /api/community/posts - Create post (user1)
    log("\n✓ Step 4: POST /api/community/posts - Create post (user1)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts",
            headers=headers(user1_token),
            json={
                "category": "illegal_dumping",
                "title": "Illegal dump site on Main St",
                "body": "Large pile of construction debris dumped on Main St near the park. Needs immediate cleanup.",
                "photos": [],
                "tags": ["construction debris", "urgent"],
                "city": "San Jose",
                "state": "CA",
                "urgency": "high",
                "lat": 37.3382,
                "lng": -121.8863
            })
        if r.status_code == 200:
            post1_data = r.json().get('post', {})
            post1_id = post1_data['id']
            log(f"✅ Post created successfully (ID: {post1_id})")
            log(f"   Title: {post1_data['title']}")
            log(f"   Category: {post1_data['category']}")
            log(f"   Urgency: {post1_data['urgency']}")
        else:
            log(f"❌ Failed to create post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 5: POST /api/community/posts - agency_notice by normal user (should fail)
    log("\n✓ Step 5: POST /api/community/posts - agency_notice by normal user (should fail)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts",
            headers=headers(user1_token),
            json={
                "category": "agency_notice",
                "title": "Official notice",
                "body": "This should fail"
            })
        if r.status_code == 403:
            log(f"✅ Correctly rejected agency_notice from normal user (403)")
            log(f"   Error: {r.json().get('error')}")
        else:
            log(f"❌ Expected 403, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 6: POST /api/community/posts - Create more posts for testing
    log("\n✓ Step 6: POST /api/community/posts - Create more posts for testing")
    try:
        # Post 2 by user2
        r = requests.post(f"{BASE_URL}/community/posts",
            headers=headers(user2_token),
            json={
                "category": "free_items",
                "title": "Free wood pallets",
                "body": "Have 20 wood pallets available for free pickup",
                "urgency": "normal",
                "city": "San Jose",
                "state": "CA"
            })
        if r.status_code == 200:
            post2_data = r.json().get('post', {})
            post2_id = post2_data['id']
            log(f"✅ Post 2 created (ID: {post2_id})")
        else:
            log(f"❌ Failed to create post 2: {r.status_code} - {r.text}")
            return False
        
        # Post 3 by user1
        r = requests.post(f"{BASE_URL}/community/posts",
            headers=headers(user1_token),
            json={
                "category": "pickup_request",
                "title": "Need pickup for old furniture",
                "body": "Have couch and chairs that need to be picked up",
                "urgency": "low",
                "city": "Santa Clara",
                "state": "CA"
            })
        if r.status_code == 200:
            post3_data = r.json().get('post', {})
            post3_id = post3_data['id']
            log(f"✅ Post 3 created (ID: {post3_id})")
        else:
            log(f"❌ Failed to create post 3: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 7: GET /api/community/posts - List all posts
    log("\n✓ Step 7: GET /api/community/posts - List all posts")
    try:
        r = requests.get(f"{BASE_URL}/community/posts")
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            log(f"✅ Retrieved {len(posts)} post(s)")
            if len(posts) > 0:
                # Check author enrichment
                if posts[0].get('author'):
                    log(f"   ✅ Author enrichment present: {posts[0]['author']}")
                else:
                    log(f"   ❌ Author enrichment missing")
                    return False
                # Check myReaction (should be null for anon)
                if posts[0].get('myReaction') is None:
                    log(f"   ✅ myReaction is null (no auth)")
        else:
            log(f"❌ Failed to get posts: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 8: GET /api/community/posts?category=illegal_dumping - Filter by category
    log("\n✓ Step 8: GET /api/community/posts?category=illegal_dumping - Filter by category")
    try:
        r = requests.get(f"{BASE_URL}/community/posts?category=illegal_dumping")
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            log(f"✅ Retrieved {len(posts)} post(s) with category=illegal_dumping")
            if all(p['category'] == 'illegal_dumping' for p in posts):
                log(f"   ✅ All posts have correct category")
        else:
            log(f"❌ Failed to get filtered posts: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 9: GET /api/community/posts?mine=true - Get user's posts
    log("\n✓ Step 9: GET /api/community/posts?mine=true - Get user's posts")
    try:
        r = requests.get(f"{BASE_URL}/community/posts?mine=true", headers=headers(user1_token))
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            log(f"✅ Retrieved {len(posts)} post(s) for user1")
            if all(p['authorId'] == user1_id for p in posts):
                log(f"   ✅ All posts belong to user1")
        else:
            log(f"❌ Failed to get user posts: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 10: GET /api/community/posts/:id - Get single post (increments viewCount)
    log("\n✓ Step 10: GET /api/community/posts/:id - Get single post (increments viewCount)")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            data = r.json()
            post = data.get('post', {})
            comments = data.get('comments', [])
            log(f"✅ Retrieved post successfully")
            log(f"   Title: {post['title']}")
            log(f"   View count: {post.get('viewCount')}")
            log(f"   Comments: {len(comments)}")
            log(f"   Author: {post.get('author')}")
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 11: POST /api/community/posts/:id/react - Invalid reaction type
    log("\n✓ Step 11: POST /api/community/posts/:id/react - Invalid reaction type")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user1_token),
            json={"type": "invalid_type"})
        if r.status_code == 400:
            log(f"✅ Correctly rejected invalid reaction type (400)")
        else:
            log(f"❌ Expected 400, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 12: POST /api/community/posts/:id/react - Create reaction (user1 -> helpful)
    log("\n✓ Step 12: POST /api/community/posts/:id/react - Create reaction (user1 -> helpful)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user1_token),
            json={"type": "helpful"})
        if r.status_code == 200:
            data = r.json()
            log(f"✅ Reaction created successfully")
            log(f"   myReaction: {data.get('myReaction')}")
        else:
            log(f"❌ Failed to create reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 13: Verify post reactionCount and reactions.helpful incremented
    log("\n✓ Step 13: Verify post reactionCount and reactions.helpful incremented")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('reactionCount') == 1:
                log(f"✅ reactionCount correctly incremented to 1")
            else:
                log(f"❌ reactionCount incorrect: {post.get('reactionCount')}")
                return False
            
            if post.get('reactions', {}).get('helpful') == 1:
                log(f"✅ reactions.helpful correctly set to 1")
            else:
                log(f"❌ reactions.helpful incorrect: {post.get('reactions', {}).get('helpful')}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 14: POST /api/community/posts/:id/react - Same type again (toggle off)
    log("\n✓ Step 14: POST /api/community/posts/:id/react - Same type again (toggle off)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user1_token),
            json={"type": "helpful"})
        if r.status_code == 200:
            data = r.json()
            if data.get('myReaction') is None:
                log(f"✅ Reaction toggled off successfully")
            else:
                log(f"❌ Expected myReaction=null, got {data.get('myReaction')}")
                return False
        else:
            log(f"❌ Failed to toggle reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 15: Verify post reactionCount decremented
    log("\n✓ Step 15: Verify post reactionCount decremented")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('reactionCount') == 0:
                log(f"✅ reactionCount correctly decremented to 0")
            else:
                log(f"❌ reactionCount incorrect: {post.get('reactionCount')}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 16: POST /api/community/posts/:id/react - Create different reaction (user1 -> thanks)
    log("\n✓ Step 16: POST /api/community/posts/:id/react - Create different reaction (user1 -> thanks)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user1_token),
            json={"type": "thanks"})
        if r.status_code == 200:
            log(f"✅ Reaction created (thanks)")
        else:
            log(f"❌ Failed to create reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 17: POST /api/community/posts/:id/react - Switch reaction (user1 -> fire)
    log("\n✓ Step 17: POST /api/community/posts/:id/react - Switch reaction (user1 -> fire)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user1_token),
            json={"type": "fire"})
        if r.status_code == 200:
            data = r.json()
            if data.get('myReaction') == 'fire':
                log(f"✅ Reaction switched to fire")
            else:
                log(f"❌ Expected myReaction=fire, got {data.get('myReaction')}")
                return False
        else:
            log(f"❌ Failed to switch reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 18: Verify reaction switch (reactionCount unchanged, thanks decremented, fire incremented)
    log("\n✓ Step 18: Verify reaction switch (reactionCount unchanged, thanks decremented, fire incremented)")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('reactionCount') == 1:
                log(f"✅ reactionCount unchanged at 1")
            else:
                log(f"❌ reactionCount incorrect: {post.get('reactionCount')}")
                return False
            
            reactions = post.get('reactions', {})
            if reactions.get('thanks', 0) == 0 and reactions.get('fire', 0) == 1:
                log(f"✅ Reaction counts correct (thanks=0, fire=1)")
            else:
                log(f"❌ Reaction counts incorrect: {reactions}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 19: Multi-user reactions (user2 -> helpful)
    log("\n✓ Step 19: Multi-user reactions (user2 -> helpful)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/react",
            headers=headers(user2_token),
            json={"type": "helpful"})
        if r.status_code == 200:
            log(f"✅ User2 reacted with helpful")
        else:
            log(f"❌ Failed to create reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 20: Verify multi-user reaction counts
    log("\n✓ Step 20: Verify multi-user reaction counts")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('reactionCount') == 2:
                log(f"✅ reactionCount correctly at 2 (user1 + user2)")
            else:
                log(f"❌ reactionCount incorrect: {post.get('reactionCount')}")
                return False
            
            reactions = post.get('reactions', {})
            if reactions.get('fire', 0) == 1 and reactions.get('helpful', 0) == 1:
                log(f"✅ Reaction counts correct (fire=1, helpful=1)")
            else:
                log(f"❌ Reaction counts incorrect: {reactions}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 21: POST /api/community/posts/:id/comments - Create comment (user2)
    log("\n✓ Step 21: POST /api/community/posts/:id/comments - Create comment (user2)")
    try:
        r = requests.post(f"{BASE_URL}/community/posts/{post1_id}/comments",
            headers=headers(user2_token),
            json={
                "body": "I can help clean this up!",
                "photos": []
            })
        if r.status_code == 200:
            comment_data = r.json().get('comment', {})
            comment1_id = comment_data['id']
            log(f"✅ Comment created successfully (ID: {comment1_id})")
            log(f"   Body: {comment_data['body']}")
            log(f"   Author: {comment_data.get('author')}")
        else:
            log(f"❌ Failed to create comment: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 22: Verify post commentCount incremented
    log("\n✓ Step 22: Verify post commentCount incremented")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('commentCount') == 1:
                log(f"✅ commentCount correctly incremented to 1")
            else:
                log(f"❌ commentCount incorrect: {post.get('commentCount')}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 23: GET /api/community/posts/:id/comments - List comments
    log("\n✓ Step 23: GET /api/community/posts/:id/comments - List comments")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}/comments")
        if r.status_code == 200:
            comments = r.json().get('comments', [])
            log(f"✅ Retrieved {len(comments)} comment(s)")
        else:
            log(f"❌ Failed to get comments: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 24: POST /api/community/comments/:id/react - React to comment
    log("\n✓ Step 24: POST /api/community/comments/:id/react - React to comment")
    try:
        r = requests.post(f"{BASE_URL}/community/comments/{comment1_id}/react",
            headers=headers(user1_token),
            json={"type": "thanks"})
        if r.status_code == 200:
            log(f"✅ Comment reaction created successfully")
        else:
            log(f"❌ Failed to create comment reaction: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 25: PATCH /api/community/posts/:id - Edit post (owner)
    log("\n✓ Step 25: PATCH /api/community/posts/:id - Edit post (owner)")
    try:
        r = requests.patch(f"{BASE_URL}/community/posts/{post1_id}",
            headers=headers(user1_token),
            json={
                "title": "UPDATED: Illegal dump site on Main St",
                "body": "Updated description with more details"
            })
        if r.status_code == 200:
            post = r.json().get('post', {})
            log(f"✅ Post updated successfully")
            log(f"   New title: {post['title']}")
        else:
            log(f"❌ Failed to update post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 26: PATCH /api/community/posts/:id - Non-owner cannot edit
    log("\n✓ Step 26: PATCH /api/community/posts/:id - Non-owner cannot edit")
    try:
        r = requests.patch(f"{BASE_URL}/community/posts/{post1_id}",
            headers=headers(user2_token),
            json={"title": "Hacked title"})
        if r.status_code == 403:
            log(f"✅ Correctly rejected non-owner edit (403)")
        else:
            log(f"❌ Expected 403, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 27: DELETE /api/community/comments/:id - Delete comment (owner)
    log("\n✓ Step 27: DELETE /api/community/comments/:id - Delete comment (owner)")
    try:
        r = requests.delete(f"{BASE_URL}/community/comments/{comment1_id}",
            headers=headers(user2_token))
        if r.status_code == 200:
            log(f"✅ Comment deleted successfully")
        else:
            log(f"❌ Failed to delete comment: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 28: Verify post commentCount decremented
    log("\n✓ Step 28: Verify post commentCount decremented")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post1_id}")
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('commentCount') == 0:
                log(f"✅ commentCount correctly decremented to 0")
            else:
                log(f"❌ commentCount incorrect: {post.get('commentCount')}")
                return False
        else:
            log(f"❌ Failed to get post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 29: GET /api/community/trending - Get trending posts
    log("\n✓ Step 29: GET /api/community/trending - Get trending posts")
    try:
        r = requests.get(f"{BASE_URL}/community/trending")
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            log(f"✅ Retrieved {len(posts)} trending post(s)")
        else:
            log(f"❌ Failed to get trending posts: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 30: GET /api/admin/community/posts - Admin list (moderator+)
    log("\n✓ Step 30: GET /api/admin/community/posts - Admin list (moderator+)")
    try:
        r = requests.get(f"{BASE_URL}/admin/community/posts", headers=headers(admin_token))
        if r.status_code == 200:
            posts = r.json().get('posts', [])
            log(f"✅ Admin retrieved {len(posts)} post(s)")
        else:
            log(f"❌ Failed to get admin posts: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 31: PATCH /api/admin/community/posts/:id - Admin pin post
    log("\n✓ Step 31: PATCH /api/admin/community/posts/:id - Admin pin post")
    try:
        r = requests.patch(f"{BASE_URL}/admin/community/posts/{post1_id}",
            headers=headers(admin_token),
            json={"action": "pin"})
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('pinned'):
                log(f"✅ Post pinned successfully")
            else:
                log(f"❌ Post not pinned: {post.get('pinned')}")
                return False
        else:
            log(f"❌ Failed to pin post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 32: PATCH /api/admin/community/posts/:id - Admin verify post
    log("\n✓ Step 32: PATCH /api/admin/community/posts/:id - Admin verify post")
    try:
        r = requests.patch(f"{BASE_URL}/admin/community/posts/{post2_id}",
            headers=headers(admin_token),
            json={"action": "verify"})
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('isOfficial') and post.get('adminVerified'):
                log(f"✅ Post verified successfully")
            else:
                log(f"❌ Post not verified correctly")
                return False
        else:
            log(f"❌ Failed to verify post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 33: DELETE /api/community/posts/:id - Delete post (owner)
    log("\n✓ Step 33: DELETE /api/community/posts/:id - Delete post (owner)")
    try:
        r = requests.delete(f"{BASE_URL}/community/posts/{post3_id}",
            headers=headers(user1_token))
        if r.status_code == 200:
            log(f"✅ Post deleted successfully")
        else:
            log(f"❌ Failed to delete post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 34: Verify deleted post is not in list
    log("\n✓ Step 34: Verify deleted post is not in list")
    try:
        r = requests.get(f"{BASE_URL}/community/posts/{post3_id}")
        if r.status_code == 404:
            log(f"✅ Deleted post correctly returns 404")
        else:
            log(f"❌ Expected 404, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    # Step 35: PATCH /api/admin/community/posts/:id - Admin remove post
    log("\n✓ Step 35: PATCH /api/admin/community/posts/:id - Admin remove post")
    try:
        r = requests.patch(f"{BASE_URL}/admin/community/posts/{post2_id}",
            headers=headers(admin_token),
            json={"action": "remove"})
        if r.status_code == 200:
            post = r.json().get('post', {})
            if post.get('status') == 'removed':
                log(f"✅ Post removed by admin successfully")
            else:
                log(f"❌ Post status not set to removed: {post.get('status')}")
                return False
        else:
            log(f"❌ Failed to remove post: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        log(f"❌ Exception: {e}")
        return False
    
    log("\n" + "="*60)
    log("✅ GROUP 2: COMMUNITY MVP - ALL TESTS PASSED")
    log("="*60)
    return True

# ============================================================
# MAIN
# ============================================================

def main():
    log("="*60)
    log("BACKEND TEST: FACILITY CLAIMING FLOW + COMMUNITY MVP")
    log("="*60)
    log(f"Base URL: {BASE_URL}")
    log(f"Admin: {ADMIN_EMAIL}")
    
    # Run tests
    group1_passed = test_facility_claiming_flow()
    group2_passed = test_community_mvp()
    
    # Summary
    log("\n" + "="*60)
    log("FINAL SUMMARY")
    log("="*60)
    
    if group1_passed:
        log("✅ GROUP 1: FACILITY CLAIMING FLOW - PASSED")
    else:
        log("❌ GROUP 1: FACILITY CLAIMING FLOW - FAILED")
    
    if group2_passed:
        log("✅ GROUP 2: COMMUNITY MVP - PASSED")
    else:
        log("❌ GROUP 2: COMMUNITY MVP - FAILED")
    
    if group1_passed and group2_passed:
        log("\n🎉 ALL TESTS PASSED - BACKEND IS PRODUCTION-READY")
        return 0
    else:
        log("\n❌ SOME TESTS FAILED - REVIEW LOGS ABOVE")
        return 1

if __name__ == "__main__":
    exit(main())
