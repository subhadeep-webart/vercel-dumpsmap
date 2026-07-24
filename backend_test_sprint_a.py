#!/usr/bin/env python3
"""
Sprint A Foundation — Backend API Testing
Tests all 27 endpoints for extended profile fields, jobs, bounties, volunteer events, and work orders.
Credentials: jamal@dumpmaps.org / @@Jefferson2180
"""

import requests
import json
import sys

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
EMAIL = "jamal@dumpmaps.org"
PASSWORD = "@@Jefferson2180"

def login():
    """Login and return auth token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Login failed: {resp.status_code} {resp.text}")
            sys.exit(1)
        data = resp.json()
        token = data.get("token")
        if not token:
            print(f"❌ No token in login response: {data}")
            sys.exit(1)
        print(f"✅ Login successful")
        return token
    except Exception as e:
        print(f"❌ Login exception: {e}")
        sys.exit(1)

def test_profile_type(token):
    """Test 1: profileType field"""
    print("\n=== TEST 1: profileType field ===")
    try:
        # Set profileType to contractor
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"profileType": "contractor"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH profileType failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        user = data.get("user", {})
        
        if user.get("profileType") != "contractor":
            print(f"❌ profileType not set correctly: {user.get('profileType')}")
            return False
        
        if not user.get("profileTypeSetAt"):
            print(f"❌ profileTypeSetAt not set")
            return False
        
        print(f"✅ TEST 1 PASSED: profileType=contractor, profileTypeSetAt={user.get('profileTypeSetAt')}")
        return True
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {e}")
        return False

def test_invalid_profile_type(token):
    """Test 2: Invalid profileType"""
    print("\n=== TEST 2: Invalid profileType ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"profileType": "alien"},
            timeout=10
        )
        if resp.status_code != 400:
            print(f"❌ Expected 400, got {resp.status_code}")
            return False
        
        error = resp.json().get("error", "")
        if "profileType must be one of" not in error:
            print(f"❌ Expected enum error, got: {error}")
            return False
        
        print(f"✅ TEST 2 PASSED: Invalid profileType rejected with 400")
        return True
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {e}")
        return False

def test_is_representative(token):
    """Test 3: isRepresentative field"""
    print("\n=== TEST 3: isRepresentative field ===")
    try:
        # Valid value
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"isRepresentative": "company_representative"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH isRepresentative failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        if user.get("isRepresentative") != "company_representative":
            print(f"❌ isRepresentative not persisted: {user.get('isRepresentative')}")
            return False
        
        # Invalid value
        resp2 = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"isRepresentative": "yes"},
            timeout=10
        )
        if resp2.status_code != 400:
            print(f"❌ Invalid isRepresentative should return 400, got {resp2.status_code}")
            return False
        
        print(f"✅ TEST 3 PASSED: isRepresentative validation working")
        return True
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {e}")
        return False

def test_business_type_ein(token):
    """Test 4: businessType + ein fields"""
    print("\n=== TEST 4: businessType + ein ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"businessType": "LLC", "ein": "12-3456789"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH businessType/ein failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        if user.get("businessType") != "LLC":
            print(f"❌ businessType not persisted: {user.get('businessType')}")
            return False
        if user.get("ein") != "12-3456789":
            print(f"❌ ein not persisted: {user.get('ein')}")
            return False
        
        print(f"✅ TEST 4 PASSED: businessType=LLC, ein=12-3456789")
        return True
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {e}")
        return False

def test_zip_codes(token):
    """Test 5: zipCodes deduplication and validation"""
    print("\n=== TEST 5: zipCodes deduplication ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"zipCodes": ["95110", "95112", "94102", "not-a-zip", "95110"]},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH zipCodes failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        zip_codes = user.get("zipCodes", [])
        
        # Should dedupe and drop invalid
        expected = ["95110", "95112", "94102"]
        if sorted(zip_codes) != sorted(expected):
            print(f"❌ zipCodes not deduped/validated correctly: {zip_codes}, expected {expected}")
            return False
        
        print(f"✅ TEST 5 PASSED: zipCodes deduped to {zip_codes}")
        return True
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {e}")
        return False

def test_preferred_zones(token):
    """Test 6: preferredZones deduplication"""
    print("\n=== TEST 6: preferredZones deduplication ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferredZones": ["Downtown San Jose", "Berryessa", "Downtown San Jose"]},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH preferredZones failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        zones = user.get("preferredZones", [])
        
        if len(zones) != 2:
            print(f"❌ preferredZones not deduped: {zones}")
            return False
        
        print(f"✅ TEST 6 PASSED: preferredZones deduped to {zones}")
        return True
    except Exception as e:
        print(f"❌ TEST 6 EXCEPTION: {e}")
        return False

def test_notifications(token):
    """Test 7: notifications object"""
    print("\n=== TEST 7: notifications ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"notifications": {"email": False, "sms": True, "newJobs": False}},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH notifications failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        notifs = user.get("notifications", {})
        
        if notifs.get("email") != False or notifs.get("sms") != True or notifs.get("newJobs") != False:
            print(f"❌ notifications not persisted correctly: {notifs}")
            return False
        
        print(f"✅ TEST 7 PASSED: notifications={notifs}")
        return True
    except Exception as e:
        print(f"❌ TEST 7 EXCEPTION: {e}")
        return False

def test_documents(token):
    """Test 8: documents array"""
    print("\n=== TEST 8: documents array ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"documents": [
                {"category": "drivers_license", "url": "/api/files/test.png", "label": "DL"},
                {"category": "insurance_certificate", "url": "/api/files/ins.pdf", "label": "Ins"}
            ]},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH documents failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        docs = user.get("documents", [])
        
        if len(docs) != 2:
            print(f"❌ Expected 2 documents, got {len(docs)}")
            return False
        
        # Check each document has required fields
        for doc in docs:
            if not all(k in doc for k in ["id", "uploadedAt", "category", "url", "label"]):
                print(f"❌ Document missing required fields: {doc}")
                return False
        
        print(f"✅ TEST 8 PASSED: documents array with 2 items, each with id/uploadedAt/category/url/label")
        return True
    except Exception as e:
        print(f"❌ TEST 8 EXCEPTION: {e}")
        return False

def test_create_job(token):
    """Test 9: POST /api/jobs"""
    print("\n=== TEST 9: POST /api/jobs ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test job", "description": "desc", "budget": 500, "jobType": "cleanup"},
            timeout=10
        )
        if resp.status_code != 201:
            print(f"❌ POST /api/jobs failed: {resp.status_code} {resp.text}")
            return False, None
        
        data = resp.json()
        job = data.get("job", {})
        
        if not job.get("id"):
            print(f"❌ Job missing id: {job}")
            return False, None
        
        if job.get("state") != "draft":
            print(f"❌ Job state should be draft, got {job.get('state')}")
            return False, None
        
        print(f"✅ TEST 9 PASSED: Job created with id={job['id']}, state=draft")
        return True, job["id"]
    except Exception as e:
        print(f"❌ TEST 9 EXCEPTION: {e}")
        return False, None

def test_list_jobs(token, job_id):
    """Test 10: GET /api/jobs?state=draft"""
    print("\n=== TEST 10: GET /api/jobs?state=draft ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/jobs?state=draft",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ GET /api/jobs failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        jobs = data.get("jobs", [])
        
        # Check if our job is in the list
        found = any(j.get("id") == job_id for j in jobs)
        if not found:
            print(f"❌ Job {job_id} not found in draft jobs list")
            return False
        
        print(f"✅ TEST 10 PASSED: Job {job_id} found in draft jobs list")
        return True
    except Exception as e:
        print(f"❌ TEST 10 EXCEPTION: {e}")
        return False

def test_get_job(token, job_id):
    """Test 11: GET /api/jobs/:id"""
    print("\n=== TEST 11: GET /api/jobs/:id ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ GET /api/jobs/:id failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        job = data.get("job", {})
        
        if job.get("id") != job_id:
            print(f"❌ Wrong job returned: {job.get('id')}")
            return False
        
        print(f"✅ TEST 11 PASSED: Job {job_id} retrieved successfully")
        return True
    except Exception as e:
        print(f"❌ TEST 11 EXCEPTION: {e}")
        return False

def test_job_state_transition_valid(token, job_id):
    """Test 12: PATCH /api/jobs/:id/state (draft → open)"""
    print("\n=== TEST 12: PATCH /api/jobs/:id/state (draft → open) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/jobs/{job_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "open"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH state failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        job = data.get("job", {})
        
        if job.get("state") != "open":
            print(f"❌ State not updated: {job.get('state')}")
            return False
        
        history = job.get("stateHistory", [])
        if len(history) < 2:
            print(f"❌ stateHistory should have 2 entries, got {len(history)}")
            return False
        
        print(f"✅ TEST 12 PASSED: Job state updated to open, stateHistory has {len(history)} entries")
        return True
    except Exception as e:
        print(f"❌ TEST 12 EXCEPTION: {e}")
        return False

def test_job_state_transition_invalid(token, job_id):
    """Test 13: PATCH /api/jobs/:id/state (open → completed - invalid)"""
    print("\n=== TEST 13: PATCH /api/jobs/:id/state (open → completed - invalid) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/jobs/{job_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "completed"},
            timeout=10
        )
        if resp.status_code != 400:
            print(f"❌ Expected 400 for invalid transition, got {resp.status_code}")
            return False
        
        data = resp.json()
        error = data.get("error", "")
        if "Invalid transition" not in error:
            print(f"❌ Expected invalid transition error, got: {error}")
            return False
        
        print(f"✅ TEST 13 PASSED: Invalid transition rejected with 400")
        return True
    except Exception as e:
        print(f"❌ TEST 13 EXCEPTION: {e}")
        return False

def test_job_state_transition_cancelled(token, job_id):
    """Test 14: PATCH /api/jobs/:id/state (open → cancelled)"""
    print("\n=== TEST 14: PATCH /api/jobs/:id/state (open → cancelled) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/jobs/{job_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "cancelled"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH state to cancelled failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        job = data.get("job", {})
        
        if job.get("state") != "cancelled":
            print(f"❌ State not updated to cancelled: {job.get('state')}")
            return False
        
        print(f"✅ TEST 14 PASSED: Job state updated to cancelled")
        return True
    except Exception as e:
        print(f"❌ TEST 14 EXCEPTION: {e}")
        return False

def test_create_bounty(token):
    """Test 15: POST /api/bounties"""
    print("\n=== TEST 15: POST /api/bounties ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/bounties",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Test bounty", "fundingGoalUsd": 1000, "issueType": "illegal_dumping"},
            timeout=10
        )
        if resp.status_code != 201:
            print(f"❌ POST /api/bounties failed: {resp.status_code} {resp.text}")
            return False, None
        
        data = resp.json()
        bounty = data.get("bounty", {})
        
        if not bounty.get("id"):
            print(f"❌ Bounty missing id: {bounty}")
            return False, None
        
        if bounty.get("state") != "draft":
            print(f"❌ Bounty state should be draft, got {bounty.get('state')}")
            return False, None
        
        if bounty.get("fundingGoalUsd") != 1000:
            print(f"❌ fundingGoalUsd should be 1000, got {bounty.get('fundingGoalUsd')}")
            return False, None
        
        if bounty.get("fundedUsd") != 0:
            print(f"❌ fundedUsd should be 0, got {bounty.get('fundedUsd')}")
            return False, None
        
        print(f"✅ TEST 15 PASSED: Bounty created with id={bounty['id']}, state=draft, fundingGoalUsd=1000, fundedUsd=0")
        return True, bounty["id"]
    except Exception as e:
        print(f"❌ TEST 15 EXCEPTION: {e}")
        return False, None

def test_list_bounties(token, bounty_id):
    """Test 16: GET /api/bounties?state=draft"""
    print("\n=== TEST 16: GET /api/bounties?state=draft ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/bounties?state=draft",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ GET /api/bounties failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        bounties = data.get("bounties", [])
        
        found = any(b.get("id") == bounty_id for b in bounties)
        if not found:
            print(f"❌ Bounty {bounty_id} not found in draft bounties list")
            return False
        
        print(f"✅ TEST 16 PASSED: Bounty {bounty_id} found in draft bounties list")
        return True
    except Exception as e:
        print(f"❌ TEST 16 EXCEPTION: {e}")
        return False

def test_bounty_state_to_funding(token, bounty_id):
    """Test 17: PATCH /api/bounties/:id/state (draft → funding)"""
    print("\n=== TEST 17: PATCH /api/bounties/:id/state (draft → funding) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/bounties/{bounty_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "funding"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH bounty state failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        bounty = data.get("bounty", {})
        
        if bounty.get("state") != "funding":
            print(f"❌ Bounty state not updated: {bounty.get('state')}")
            return False
        
        print(f"✅ TEST 17 PASSED: Bounty state updated to funding")
        return True
    except Exception as e:
        print(f"❌ TEST 17 EXCEPTION: {e}")
        return False

def test_bounty_invalid_transition(token, bounty_id):
    """Test 18: PATCH /api/bounties/:id/state (funding → verified - invalid)"""
    print("\n=== TEST 18: PATCH /api/bounties/:id/state (funding → verified - invalid) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/bounties/{bounty_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "verified"},
            timeout=10
        )
        if resp.status_code != 400:
            print(f"❌ Expected 400 for invalid transition, got {resp.status_code}")
            return False
        
        data = resp.json()
        error = data.get("error", "")
        if "Invalid transition" not in error:
            print(f"❌ Expected invalid transition error, got: {error}")
            return False
        
        print(f"✅ TEST 18 PASSED: Invalid bounty transition rejected with 400")
        return True
    except Exception as e:
        print(f"❌ TEST 18 EXCEPTION: {e}")
        return False

def test_bounty_to_expired(token, bounty_id):
    """Test 19: PATCH /api/bounties/:id/state (funding → expired)"""
    print("\n=== TEST 19: PATCH /api/bounties/:id/state (funding → expired) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/bounties/{bounty_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "expired"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH bounty state to expired failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        bounty = data.get("bounty", {})
        
        if bounty.get("state") != "expired":
            print(f"❌ Bounty state not updated to expired: {bounty.get('state')}")
            return False
        
        print(f"✅ TEST 19 PASSED: Bounty state updated to expired")
        return True
    except Exception as e:
        print(f"❌ TEST 19 EXCEPTION: {e}")
        return False

def test_create_volunteer_event(token):
    """Test 20: POST /api/volunteer-events"""
    print("\n=== TEST 20: POST /api/volunteer-events ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/volunteer-events",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Park cleanup", "scheduledFor": "2026-07-15T09:00:00Z", "pointsPerAttendee": 150},
            timeout=10
        )
        if resp.status_code != 201:
            print(f"❌ POST /api/volunteer-events failed: {resp.status_code} {resp.text}")
            return False, None
        
        data = resp.json()
        event = data.get("event", {})
        
        if not event.get("id"):
            print(f"❌ Event missing id: {event}")
            return False, None
        
        if event.get("state") != "draft":
            print(f"❌ Event state should be draft, got {event.get('state')}")
            return False, None
        
        print(f"✅ TEST 20 PASSED: Volunteer event created with id={event['id']}, state=draft")
        return True, event["id"]
    except Exception as e:
        print(f"❌ TEST 20 EXCEPTION: {e}")
        return False, None

def test_list_volunteer_events(token, event_id):
    """Test 21: GET /api/volunteer-events"""
    print("\n=== TEST 21: GET /api/volunteer-events ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/volunteer-events",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ GET /api/volunteer-events failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        events = data.get("events", [])
        
        found = any(e.get("id") == event_id for e in events)
        if not found:
            print(f"❌ Event {event_id} not found in events list")
            return False
        
        print(f"✅ TEST 21 PASSED: Event {event_id} found in events list")
        return True
    except Exception as e:
        print(f"❌ TEST 21 EXCEPTION: {e}")
        return False

def test_volunteer_event_state(token, event_id):
    """Test 22: PATCH /api/volunteer-events/:id/state (draft → scheduled)"""
    print("\n=== TEST 22: PATCH /api/volunteer-events/:id/state (draft → scheduled) ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/volunteer-events/{event_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "scheduled"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ PATCH event state failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        event = data.get("event", {})
        
        if event.get("state") != "scheduled":
            print(f"❌ Event state not updated: {event.get('state')}")
            return False
        
        print(f"✅ TEST 22 PASSED: Event state updated to scheduled")
        return True
    except Exception as e:
        print(f"❌ TEST 22 EXCEPTION: {e}")
        return False

def test_work_orders_list(token):
    """Test 23: GET /api/work-orders?as=contractor"""
    print("\n=== TEST 23: GET /api/work-orders?as=contractor ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/work-orders?as=contractor",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ GET /api/work-orders failed: {resp.status_code} {resp.text}")
            return False
        
        data = resp.json()
        work_orders = data.get("workOrders", [])
        
        # Should return empty array (no work orders auto-created yet)
        if not isinstance(work_orders, list):
            print(f"❌ workOrders should be an array, got {type(work_orders)}")
            return False
        
        print(f"✅ TEST 23 PASSED: GET /api/work-orders returned {len(work_orders)} work orders")
        return True
    except Exception as e:
        print(f"❌ TEST 23 EXCEPTION: {e}")
        return False

def test_work_order_not_found(token):
    """Test 24: GET /api/work-orders/:id (non-existent)"""
    print("\n=== TEST 24: GET /api/work-orders/:id (non-existent) ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/work-orders/non-existent-id",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if resp.status_code != 404:
            print(f"❌ Expected 404 for non-existent work order, got {resp.status_code}")
            return False
        
        print(f"✅ TEST 24 PASSED: Non-existent work order returns 404")
        return True
    except Exception as e:
        print(f"❌ TEST 24 EXCEPTION: {e}")
        return False

def test_auth_required():
    """Test 25: POST /api/jobs without auth"""
    print("\n=== TEST 25: POST /api/jobs without auth ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/jobs",
            json={"title": "Test job"},
            timeout=10
        )
        if resp.status_code != 401:
            print(f"❌ Expected 401 without auth, got {resp.status_code}")
            return False
        
        print(f"✅ TEST 25 PASSED: Unauthorized request returns 401")
        return True
    except Exception as e:
        print(f"❌ TEST 25 EXCEPTION: {e}")
        return False

def test_super_admin_bypass(token):
    """Test 26: Super admin can modify any job state"""
    print("\n=== TEST 26: Super admin bypass ===")
    try:
        # Create a new job
        resp = requests.post(
            f"{BASE_URL}/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Admin test job", "description": "test", "budget": 100, "jobType": "cleanup"},
            timeout=10
        )
        if resp.status_code != 201:
            print(f"❌ Failed to create job for admin test: {resp.status_code}")
            return False
        
        job_id = resp.json().get("job", {}).get("id")
        
        # Super admin should be able to change state
        resp2 = requests.patch(
            f"{BASE_URL}/jobs/{job_id}/state",
            headers={"Authorization": f"Bearer {token}"},
            json={"state": "open"},
            timeout=10
        )
        if resp2.status_code != 200:
            print(f"❌ Super admin state change failed: {resp2.status_code}")
            return False
        
        print(f"✅ TEST 26 PASSED: Super admin can modify job state")
        return True
    except Exception as e:
        print(f"❌ TEST 26 EXCEPTION: {e}")
        return False

def test_cleanup(token):
    """Test 27: Cleanup - restore profile to baseline"""
    print("\n=== TEST 27: Cleanup - restore profile ===")
    try:
        resp = requests.patch(
            f"{BASE_URL}/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "profileType": "super_admin",
                "documents": [],
                "zipCodes": [],
                "preferredZones": []
            },
            timeout=10
        )
        if resp.status_code != 200:
            print(f"❌ Cleanup failed: {resp.status_code} {resp.text}")
            return False
        
        user = resp.json().get("user", {})
        if user.get("profileType") != "super_admin":
            print(f"❌ profileType not restored: {user.get('profileType')}")
            return False
        
        print(f"✅ TEST 27 PASSED: Profile restored to baseline")
        return True
    except Exception as e:
        print(f"❌ TEST 27 EXCEPTION: {e}")
        return False

def main():
    print("=" * 80)
    print("SPRINT A FOUNDATION — BACKEND API TESTING")
    print("=" * 80)
    
    token = login()
    
    results = []
    
    # A. Extended Profile fields (8 tests)
    print("\n" + "=" * 80)
    print("SECTION A: EXTENDED PROFILE FIELDS")
    print("=" * 80)
    results.append(("Test 1: profileType", test_profile_type(token)))
    results.append(("Test 2: Invalid profileType", test_invalid_profile_type(token)))
    results.append(("Test 3: isRepresentative", test_is_representative(token)))
    results.append(("Test 4: businessType + ein", test_business_type_ein(token)))
    results.append(("Test 5: zipCodes", test_zip_codes(token)))
    results.append(("Test 6: preferredZones", test_preferred_zones(token)))
    results.append(("Test 7: notifications", test_notifications(token)))
    results.append(("Test 8: documents", test_documents(token)))
    
    # B. Jobs CRUD (6 tests)
    print("\n" + "=" * 80)
    print("SECTION B: JOBS CRUD")
    print("=" * 80)
    success, job_id = test_create_job(token)
    results.append(("Test 9: Create job", success))
    
    if job_id:
        results.append(("Test 10: List jobs", test_list_jobs(token, job_id)))
        results.append(("Test 11: Get job", test_get_job(token, job_id)))
        results.append(("Test 12: Job state transition (valid)", test_job_state_transition_valid(token, job_id)))
        results.append(("Test 13: Job state transition (invalid)", test_job_state_transition_invalid(token, job_id)))
        results.append(("Test 14: Job state to cancelled", test_job_state_transition_cancelled(token, job_id)))
    else:
        print("⚠️  Skipping tests 10-14 due to job creation failure")
        for i in range(10, 15):
            results.append((f"Test {i}: Skipped", False))
    
    # C. Bounties CRUD (5 tests)
    print("\n" + "=" * 80)
    print("SECTION C: BOUNTIES CRUD")
    print("=" * 80)
    success, bounty_id = test_create_bounty(token)
    results.append(("Test 15: Create bounty", success))
    
    if bounty_id:
        results.append(("Test 16: List bounties", test_list_bounties(token, bounty_id)))
        results.append(("Test 17: Bounty state to funding", test_bounty_state_to_funding(token, bounty_id)))
        results.append(("Test 18: Bounty invalid transition", test_bounty_invalid_transition(token, bounty_id)))
        results.append(("Test 19: Bounty to expired", test_bounty_to_expired(token, bounty_id)))
    else:
        print("⚠️  Skipping tests 16-19 due to bounty creation failure")
        for i in range(16, 20):
            results.append((f"Test {i}: Skipped", False))
    
    # D. Volunteer Events CRUD (3 tests)
    print("\n" + "=" * 80)
    print("SECTION D: VOLUNTEER EVENTS CRUD")
    print("=" * 80)
    success, event_id = test_create_volunteer_event(token)
    results.append(("Test 20: Create volunteer event", success))
    
    if event_id:
        results.append(("Test 21: List volunteer events", test_list_volunteer_events(token, event_id)))
        results.append(("Test 22: Event state to scheduled", test_volunteer_event_state(token, event_id)))
    else:
        print("⚠️  Skipping tests 21-22 due to event creation failure")
        for i in range(21, 23):
            results.append((f"Test {i}: Skipped", False))
    
    # E. Work Orders read-only (2 tests)
    print("\n" + "=" * 80)
    print("SECTION E: WORK ORDERS (READ-ONLY)")
    print("=" * 80)
    results.append(("Test 23: List work orders", test_work_orders_list(token)))
    results.append(("Test 24: Work order not found", test_work_order_not_found(token)))
    
    # F. Authorization checks (2 tests)
    print("\n" + "=" * 80)
    print("SECTION F: AUTHORIZATION CHECKS")
    print("=" * 80)
    results.append(("Test 25: Auth required", test_auth_required()))
    results.append(("Test 26: Super admin bypass", test_super_admin_bypass(token)))
    
    # G. Cleanup (1 test)
    print("\n" + "=" * 80)
    print("SECTION G: CLEANUP")
    print("=" * 80)
    results.append(("Test 27: Cleanup", test_cleanup(token)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("\n" + "=" * 80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("=" * 80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
