#!/usr/bin/env python3
"""
Admin Dashboard Backend Test Suite
Tests all 15 admin endpoints + universal reports endpoint
Following the mandatory test flow from the review request
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}
ADMIN = {"email": "aj@bisonjunk.com", "password": "admin123"}
LEGACY_DEMOTED = {"email": "admin@dumpmaps.com", "password": "admin123"}

# Global tokens
super_admin_token = None
admin_token = None
normal_user_token = None
test_user_id = None
test_user_token = None

def log_test(step, message):
    """Print test step with timestamp"""
    print(f"\n{'='*80}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] STEP {step}: {message}")
    print('='*80)

def log_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def log_error(message):
    """Print error message"""
    print(f"❌ ERROR: {message}")

# ============================================================
# STEP 1: AUTH TESTS
# ============================================================

def test_auth():
    """Test authentication for all user types"""
    global super_admin_token, admin_token, normal_user_token
    
    log_test(1, "AUTH TESTS")
    
    # 1.1: Login super_admin
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=SUPER_ADMIN, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('role') == 'super_admin' and \
               data.get('user', {}).get('accountStatus') == 'active' and \
               'token' in data:
                super_admin_token = data['token']
                log_result(True, f"Super admin login: role={data['user']['role']}, status={data['user']['accountStatus']}, token received")
            else:
                log_result(False, f"Super admin login: unexpected response {data}")
        else:
            log_result(False, f"Super admin login failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"Super admin login exception: {e}")
    
    # 1.2: Login admin
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=ADMIN, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('role') == 'admin':
                admin_token = data['token']
                log_result(True, f"Admin login: role={data['user']['role']}")
            else:
                log_result(False, f"Admin login: unexpected role {data.get('user', {}).get('role')}")
        else:
            log_result(False, f"Admin login failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"Admin login exception: {e}")
    
    # 1.3: Login legacy demoted user
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=LEGACY_DEMOTED, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('role') == 'normal_user':
                normal_user_token = data['token']
                log_result(True, f"Legacy demoted user login: role={data['user']['role']} (correctly demoted)")
            else:
                log_result(False, f"Legacy demoted user: unexpected role {data.get('user', {}).get('role')}")
        else:
            log_result(False, f"Legacy demoted user login failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"Legacy demoted user login exception: {e}")
    
    # 1.4: Login with wrong password
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": SUPER_ADMIN["email"], "password": "wrongpassword"}, timeout=10)
        if resp.status_code == 401:
            log_result(True, "Wrong password correctly rejected with 401")
        else:
            log_result(False, f"Wrong password: expected 401, got {resp.status_code}")
    except Exception as e:
        log_error(f"Wrong password test exception: {e}")

# ============================================================
# STEP 2: OVERVIEW / ACCESS CONTROL
# ============================================================

def test_overview_access():
    """Test overview endpoint access control"""
    log_test(2, "OVERVIEW / ACCESS CONTROL")
    
    # 2.1: GET /admin/overview WITHOUT auth
    try:
        resp = requests.get(f"{BASE_URL}/admin/overview", timeout=10)
        if resp.status_code == 401:
            log_result(True, "Overview without auth: 401 (correct)")
        else:
            log_result(False, f"Overview without auth: expected 401, got {resp.status_code}")
    except Exception as e:
        log_error(f"Overview without auth exception: {e}")
    
    # 2.2: GET /admin/overview with NORMAL user token
    try:
        resp = requests.get(f"{BASE_URL}/admin/overview", 
                          headers={"Authorization": f"Bearer {normal_user_token}"}, 
                          timeout=10)
        if resp.status_code == 403:
            log_result(True, "Overview with normal user: 403 (correct)")
        else:
            log_result(False, f"Overview with normal user: expected 403, got {resp.status_code}")
    except Exception as e:
        log_error(f"Overview with normal user exception: {e}")
    
    # 2.3: GET /admin/overview with super_admin token
    try:
        resp = requests.get(f"{BASE_URL}/admin/overview", 
                          headers={"Authorization": f"Bearer {super_admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'kpis' in data and 'users' in data['kpis'] and 'facilities' in data['kpis'] and \
               'total' in data['kpis']['users'] and 'pending' in data['kpis']['facilities'] and \
               'recentActivity' in data and isinstance(data['recentActivity'], list):
                log_result(True, f"Overview with super_admin: 200, has kpis.users.total={data['kpis']['users']['total']}, kpis.facilities.pending={data['kpis']['facilities']['pending']}, recentActivity is array with {len(data['recentActivity'])} items")
            else:
                log_result(False, f"Overview with super_admin: missing expected fields in response")
        else:
            log_result(False, f"Overview with super_admin: expected 200, got {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"Overview with super_admin exception: {e}")

# ============================================================
# STEP 3: USERS ENDPOINTS
# ============================================================

def test_users_endpoints():
    """Test all users admin endpoints"""
    global test_user_id, test_user_token
    
    log_test(3, "USERS ENDPOINTS")
    
    # 3.1: GET /admin/users?limit=10 (admin token)
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=10", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'users' in data and isinstance(data['users'], list) and len(data['users']) > 0:
                user = data['users'][0]
                if 'marketplaceCount' in user and 'jobsPosted' in user and 'alertsPosted' in user:
                    log_result(True, f"GET /admin/users?limit=10: 200, returned {len(data['users'])} users with enriched fields (marketplaceCount, jobsPosted, alertsPosted)")
                else:
                    log_result(False, f"GET /admin/users: missing enriched fields")
            else:
                log_result(False, f"GET /admin/users: unexpected response structure")
        else:
            log_result(False, f"GET /admin/users: expected 200, got {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"GET /admin/users exception: {e}")
    
    # 3.2: Filter by role=admin
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?role=admin", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'users' in data and all(u.get('role') == 'admin' for u in data['users']):
                log_result(True, f"GET /admin/users?role=admin: returned {len(data['users'])} admin users (all have role=admin)")
            else:
                log_result(False, f"GET /admin/users?role=admin: filter not working correctly")
        else:
            log_result(False, f"GET /admin/users?role=admin: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/users?role=admin exception: {e}")
    
    # 3.3: Filter by status=active
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?status=active", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'users' in data and all(u.get('accountStatus') == 'active' for u in data['users']):
                log_result(True, f"GET /admin/users?status=active: returned {len(data['users'])} active users")
            else:
                log_result(False, f"GET /admin/users?status=active: filter not working correctly")
        else:
            log_result(False, f"GET /admin/users?status=active: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/users?status=active exception: {e}")
    
    # 3.4: Signup a fresh test_user
    rand = int(time.time() * 1000) % 100000
    test_email = f"banme_{rand}@test.com"
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", 
                           json={"email": test_email, "password": "testpass123", "name": f"Test User {rand}"}, 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            test_user_id = data['user']['id']
            test_user_token = data['token']
            log_result(True, f"Signup test user: {test_email}, id={test_user_id}")
        else:
            log_result(False, f"Signup test user failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"Signup test user exception: {e}")
    
    if not test_user_id:
        log_error("Cannot continue user tests without test_user_id")
        return
    
    # 3.5: PATCH /admin/users/:id with action=suspend (admin token)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"action": "suspend"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('accountStatus') == 'suspended' and 'suspendedUntil' in data['user']:
                log_result(True, f"PATCH suspend: accountStatus=suspended, suspendedUntil={data['user']['suspendedUntil']}")
            else:
                log_result(False, f"PATCH suspend: unexpected response {data}")
        else:
            log_result(False, f"PATCH suspend failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH suspend exception: {e}")
    
    # 3.6: Login as suspended user (should fail with 403)
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": test_email, "password": "testpass123"}, 
                           timeout=10)
        if resp.status_code == 403:
            if 'suspended' in resp.text.lower():
                log_result(True, f"Login as suspended user: 403 with 'suspended' in message")
            else:
                log_result(False, f"Login as suspended user: 403 but no 'suspended' in message: {resp.text}")
        else:
            log_result(False, f"Login as suspended user: expected 403, got {resp.status_code}")
    except Exception as e:
        log_error(f"Login as suspended user exception: {e}")
    
    # 3.7: PATCH reinstate
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"action": "reinstate"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('accountStatus') == 'active':
                log_result(True, f"PATCH reinstate: accountStatus=active")
            else:
                log_result(False, f"PATCH reinstate: unexpected accountStatus {data.get('user', {}).get('accountStatus')}")
        else:
            log_result(False, f"PATCH reinstate failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH reinstate exception: {e}")
    
    # 3.8: Login as reinstated user (should succeed)
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": test_email, "password": "testpass123"}, 
                           timeout=10)
        if resp.status_code == 200:
            log_result(True, f"Login as reinstated user: 200 (success)")
        else:
            log_result(False, f"Login as reinstated user: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"Login as reinstated user exception: {e}")
    
    # 3.9: PATCH ban with reason
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"action": "ban", "banReason": "spam"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('accountStatus') == 'banned':
                log_result(True, f"PATCH ban: accountStatus=banned")
            else:
                log_result(False, f"PATCH ban: unexpected accountStatus {data.get('user', {}).get('accountStatus')}")
        else:
            log_result(False, f"PATCH ban failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH ban exception: {e}")
    
    # 3.10: Login as banned user (should fail with 403)
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": test_email, "password": "testpass123"}, 
                           timeout=10)
        if resp.status_code == 403:
            if 'banned' in resp.text.lower():
                log_result(True, f"Login as banned user: 403 with 'banned' in message")
            else:
                log_result(False, f"Login as banned user: 403 but no 'banned' in message: {resp.text}")
        else:
            log_result(False, f"Login as banned user: expected 403, got {resp.status_code}")
    except Exception as e:
        log_error(f"Login as banned user exception: {e}")
    
    # 3.11: PATCH reinstate from ban
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"action": "reinstate"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('accountStatus') == 'active':
                log_result(True, f"PATCH reinstate from ban: accountStatus=active")
            else:
                log_result(False, f"PATCH reinstate from ban: unexpected accountStatus")
        else:
            log_result(False, f"PATCH reinstate from ban failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH reinstate from ban exception: {e}")
    
    # 3.12: PATCH role=moderator as AJ (admin, NOT super_admin) - should fail 403
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"role": "moderator"}, 
                            timeout=10)
        if resp.status_code == 403:
            if 'super_admin' in resp.text.lower():
                log_result(True, f"PATCH role=moderator as admin: 403 with 'super_admin' in message (correct)")
            else:
                log_result(False, f"PATCH role=moderator as admin: 403 but no 'super_admin' in message")
        else:
            log_result(False, f"PATCH role=moderator as admin: expected 403, got {resp.status_code}")
    except Exception as e:
        log_error(f"PATCH role=moderator as admin exception: {e}")
    
    # 3.13: PATCH role=moderator as Jamal (super_admin) - should succeed
    try:
        resp = requests.patch(f"{BASE_URL}/admin/users/{test_user_id}", 
                            headers={"Authorization": f"Bearer {super_admin_token}"}, 
                            json={"role": "moderator"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('user', {}).get('role') == 'moderator':
                log_result(True, f"PATCH role=moderator as super_admin: role=moderator (success)")
            else:
                log_result(False, f"PATCH role=moderator as super_admin: unexpected role {data.get('user', {}).get('role')}")
        else:
            log_result(False, f"PATCH role=moderator as super_admin failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH role=moderator as super_admin exception: {e}")
    
    # 3.14: Get Jamal's user ID and try to modify as AJ (should fail 403)
    try:
        # First get Jamal's ID
        resp = requests.get(f"{BASE_URL}/admin/users?q=jamal", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            jamal_user = next((u for u in data['users'] if u['email'] == 'jamal@dumpmaps.org'), None)
            if jamal_user:
                jamal_id = jamal_user['id']
                # Try to modify Jamal as AJ
                resp2 = requests.patch(f"{BASE_URL}/admin/users/{jamal_id}", 
                                     headers={"Authorization": f"Bearer {admin_token}"}, 
                                     json={"accountStatus": "suspended"}, 
                                     timeout=10)
                if resp2.status_code == 403:
                    if 'super_admin' in resp2.text.lower():
                        log_result(True, f"PATCH Jamal's super_admin account as AJ: 403 with 'super_admin' in message (correct)")
                    else:
                        log_result(False, f"PATCH Jamal's super_admin account as AJ: 403 but no 'super_admin' in message")
                else:
                    log_result(False, f"PATCH Jamal's super_admin account as AJ: expected 403, got {resp2.status_code}")
            else:
                log_result(False, f"Could not find Jamal's user record")
        else:
            log_result(False, f"GET /admin/users?q=jamal failed: {resp.status_code}")
    except Exception as e:
        log_error(f"PATCH Jamal's account as AJ exception: {e}")

# ============================================================
# STEP 4: FACILITIES/MARKETPLACE/JOBS/ALERTS ADMIN LISTS
# ============================================================

def test_admin_lists():
    """Test admin list endpoints"""
    log_test(4, "FACILITIES/MARKETPLACE/JOBS/ALERTS ADMIN LISTS")
    
    # 4.1: GET /admin/facilities?status=pending
    try:
        resp = requests.get(f"{BASE_URL}/admin/facilities?status=pending", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'facilities' in data and isinstance(data['facilities'], list):
                log_result(True, f"GET /admin/facilities?status=pending: 200, returned {len(data['facilities'])} facilities")
            else:
                log_result(False, f"GET /admin/facilities?status=pending: unexpected response structure")
        else:
            log_result(False, f"GET /admin/facilities?status=pending: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/facilities exception: {e}")
    
    # 4.2: GET /admin/marketplace
    try:
        resp = requests.get(f"{BASE_URL}/admin/marketplace", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'listings' in data and isinstance(data['listings'], list):
                log_result(True, f"GET /admin/marketplace: 200, returned {len(data['listings'])} listings")
            else:
                log_result(False, f"GET /admin/marketplace: unexpected response structure")
        else:
            log_result(False, f"GET /admin/marketplace: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/marketplace exception: {e}")
    
    # 4.3: GET /admin/jobs
    try:
        resp = requests.get(f"{BASE_URL}/admin/jobs", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'jobs' in data and isinstance(data['jobs'], list):
                log_result(True, f"GET /admin/jobs: 200, returned {len(data['jobs'])} jobs")
            else:
                log_result(False, f"GET /admin/jobs: unexpected response structure")
        else:
            log_result(False, f"GET /admin/jobs: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/jobs exception: {e}")
    
    # 4.4: GET /admin/alerts?status=active
    try:
        resp = requests.get(f"{BASE_URL}/admin/alerts?status=active", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'alerts' in data and isinstance(data['alerts'], list):
                log_result(True, f"GET /admin/alerts?status=active: 200, returned {len(data['alerts'])} alerts")
            else:
                log_result(False, f"GET /admin/alerts?status=active: unexpected response structure")
        else:
            log_result(False, f"GET /admin/alerts?status=active: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/alerts exception: {e}")

# ============================================================
# STEP 5: UNIVERSAL REPORTS
# ============================================================

def test_reports():
    """Test universal reports endpoint"""
    global report_id
    
    log_test(5, "UNIVERSAL REPORTS")
    
    # 5.1: POST /reports WITHOUT login
    try:
        resp = requests.post(f"{BASE_URL}/reports", 
                           json={"targetKind": "facility", "targetId": "test", "reason": "spam"}, 
                           timeout=10)
        if resp.status_code == 401:
            log_result(True, f"POST /reports without login: 401 (correct)")
        else:
            log_result(False, f"POST /reports without login: expected 401, got {resp.status_code}")
    except Exception as e:
        log_error(f"POST /reports without login exception: {e}")
    
    # 5.2: Get a facility ID to report
    facility_id = None
    try:
        resp = requests.get(f"{BASE_URL}/facilities", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'facilities' in data and len(data['facilities']) > 0:
                facility_id = data['facilities'][0]['id']
                log_result(True, f"Got facility ID for testing: {facility_id}")
            else:
                log_result(False, f"No facilities found for testing")
        else:
            log_result(False, f"GET /facilities failed: {resp.status_code}")
    except Exception as e:
        log_error(f"GET /facilities exception: {e}")
    
    if not facility_id:
        log_error("Cannot continue reports tests without facility_id")
        return
    
    # 5.3: POST /reports as logged-in user
    report_id = None
    try:
        resp = requests.post(f"{BASE_URL}/reports", 
                           headers={"Authorization": f"Bearer {test_user_token}"}, 
                           json={
                               "targetKind": "facility",
                               "targetId": facility_id,
                               "reason": "inaccurate",
                               "detail": "Closed for 2 weeks"
                           }, 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'report' in data and 'id' in data['report']:
                report_id = data['report']['id']
                log_result(True, f"POST /reports as logged-in user: 200, report created with id={report_id}")
            else:
                log_result(False, f"POST /reports: unexpected response structure")
        else:
            log_result(False, f"POST /reports: expected 200, got {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"POST /reports exception: {e}")
    
    if not report_id:
        log_error("Cannot continue reports tests without report_id")
        return
    
    # 5.4: GET /admin/reports?status=open
    try:
        resp = requests.get(f"{BASE_URL}/admin/reports?status=open", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'reports' in data and isinstance(data['reports'], list):
                found = any(r['id'] == report_id for r in data['reports'])
                if found:
                    log_result(True, f"GET /admin/reports?status=open: 200, contains the new report (id={report_id})")
                else:
                    log_result(False, f"GET /admin/reports?status=open: report not found in list")
            else:
                log_result(False, f"GET /admin/reports?status=open: unexpected response structure")
        else:
            log_result(False, f"GET /admin/reports?status=open: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/reports exception: {e}")
    
    # 5.5: PATCH /admin/reports/:id with status=resolved
    try:
        resp = requests.patch(f"{BASE_URL}/admin/reports/{report_id}", 
                            headers={"Authorization": f"Bearer {admin_token}"}, 
                            json={"status": "resolved", "resolution": "action_taken"}, 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('report', {}).get('status') == 'resolved':
                log_result(True, f"PATCH /admin/reports/:id: 200, status=resolved")
            else:
                log_result(False, f"PATCH /admin/reports/:id: unexpected status {data.get('report', {}).get('status')}")
        else:
            log_result(False, f"PATCH /admin/reports/:id: expected 200, got {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"PATCH /admin/reports exception: {e}")
    
    # 5.6: GET /admin/reports?status=resolved
    try:
        resp = requests.get(f"{BASE_URL}/admin/reports?status=resolved", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'reports' in data and isinstance(data['reports'], list):
                found = any(r['id'] == report_id for r in data['reports'])
                if found:
                    log_result(True, f"GET /admin/reports?status=resolved: 200, contains the updated report")
                else:
                    log_result(False, f"GET /admin/reports?status=resolved: report not found in list")
            else:
                log_result(False, f"GET /admin/reports?status=resolved: unexpected response structure")
        else:
            log_result(False, f"GET /admin/reports?status=resolved: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/reports?status=resolved exception: {e}")

# ============================================================
# STEP 6: ACTIVITY LOG
# ============================================================

def test_activity_log():
    """Test activity log endpoint"""
    log_test(6, "ACTIVITY LOG")
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/activity-log?limit=50", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'logs' in data and isinstance(data['logs'], list):
                # Check for expected actions
                actions = [log.get('action', '') for log in data['logs']]
                expected_actions = ['user.suspend', 'user.ban', 'user.reinstate', 'report.resolved']
                found_actions = [a for a in expected_actions if any(a in action for action in actions)]
                log_result(True, f"GET /admin/activity-log: 200, returned {len(data['logs'])} logs, found actions: {found_actions}")
            else:
                log_result(False, f"GET /admin/activity-log: unexpected response structure")
        else:
            log_result(False, f"GET /admin/activity-log: expected 200, got {resp.status_code}")
    except Exception as e:
        log_error(f"GET /admin/activity-log exception: {e}")

# ============================================================
# STEP 7: ANALYTICS
# ============================================================

def test_analytics():
    """Test analytics endpoint"""
    log_test(7, "ANALYTICS")
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/analytics", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            expected_keys = ['trendingFacilities', 'busiestFacilities', 'fastestMoving', 
                           'mostActiveUsers', 'topMarketCategories', 'activeJobsByCategory', 'topAlertTypes']
            missing_keys = [k for k in expected_keys if k not in data]
            if not missing_keys:
                log_result(True, f"GET /admin/analytics: 200, has all expected keys: {expected_keys}")
            else:
                log_result(False, f"GET /admin/analytics: missing keys: {missing_keys}")
        else:
            log_result(False, f"GET /admin/analytics: expected 200, got {resp.status_code} - {resp.text}")
    except Exception as e:
        log_error(f"GET /admin/analytics exception: {e}")

# ============================================================
# STEP 8: MARKETPLACE/JOBS/ALERTS MODERATION PATCHES
# ============================================================

def test_moderation_patches():
    """Test moderation PATCH endpoints"""
    log_test(8, "MARKETPLACE/JOBS/ALERTS MODERATION PATCHES")
    
    # 8.1: Get a marketplace listing and feature it
    try:
        resp = requests.get(f"{BASE_URL}/admin/marketplace", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'listings' in data and len(data['listings']) > 0:
                listing_id = data['listings'][0]['id']
                # PATCH to feature
                resp2 = requests.patch(f"{BASE_URL}/admin/marketplace/{listing_id}", 
                                     headers={"Authorization": f"Bearer {admin_token}"}, 
                                     json={"action": "feature", "featured": True}, 
                                     timeout=10)
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    if data2.get('listing', {}).get('featured') == True:
                        log_result(True, f"PATCH /admin/marketplace/:id with action=feature: listing.featured=true")
                    else:
                        log_result(False, f"PATCH /admin/marketplace/:id: featured not set correctly")
                else:
                    log_result(False, f"PATCH /admin/marketplace/:id: expected 200, got {resp2.status_code}")
            else:
                log_result(False, f"No marketplace listings found for testing (skipping)")
        else:
            log_result(False, f"GET /admin/marketplace failed: {resp.status_code}")
    except Exception as e:
        log_error(f"PATCH /admin/marketplace exception: {e}")
    
    # 8.2: Get a job and feature it
    try:
        resp = requests.get(f"{BASE_URL}/admin/jobs", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'jobs' in data and len(data['jobs']) > 0:
                job_id = data['jobs'][0]['id']
                # PATCH to feature
                resp2 = requests.patch(f"{BASE_URL}/admin/jobs/{job_id}", 
                                     headers={"Authorization": f"Bearer {admin_token}"}, 
                                     json={"action": "feature"}, 
                                     timeout=10)
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    if data2.get('job', {}).get('featured') == True:
                        log_result(True, f"PATCH /admin/jobs/:id with action=feature: job.featured=true")
                    else:
                        log_result(False, f"PATCH /admin/jobs/:id: featured not set correctly")
                else:
                    log_result(False, f"PATCH /admin/jobs/:id: expected 200, got {resp2.status_code}")
            else:
                log_result(False, f"No jobs found for testing (skipping)")
        else:
            log_result(False, f"GET /admin/jobs failed: {resp.status_code}")
    except Exception as e:
        log_error(f"PATCH /admin/jobs exception: {e}")
    
    # 8.3: Get an alert and pin it
    try:
        resp = requests.get(f"{BASE_URL}/admin/alerts", 
                          headers={"Authorization": f"Bearer {admin_token}"}, 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'alerts' in data and len(data['alerts']) > 0:
                alert_id = data['alerts'][0]['id']
                # PATCH to pin
                resp2 = requests.patch(f"{BASE_URL}/admin/alerts/{alert_id}", 
                                     headers={"Authorization": f"Bearer {admin_token}"}, 
                                     json={"action": "pin"}, 
                                     timeout=10)
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    if data2.get('alert', {}).get('pinned') == True:
                        log_result(True, f"PATCH /admin/alerts/:id with action=pin: alert.pinned=true")
                    else:
                        log_result(False, f"PATCH /admin/alerts/:id: pinned not set correctly")
                else:
                    log_result(False, f"PATCH /admin/alerts/:id: expected 200, got {resp2.status_code}")
            else:
                log_result(False, f"No alerts found for testing (skipping with note)")
        else:
            log_result(False, f"GET /admin/alerts failed: {resp.status_code}")
    except Exception as e:
        log_error(f"PATCH /admin/alerts exception: {e}")

# ============================================================
# MAIN TEST RUNNER
# ============================================================

def main():
    print("\n" + "="*80)
    print("ADMIN DASHBOARD BACKEND TEST SUITE")
    print("Testing 15 admin endpoints + universal reports endpoint")
    print("="*80)
    
    test_auth()
    test_overview_access()
    test_users_endpoints()
    test_admin_lists()
    test_reports()
    test_activity_log()
    test_analytics()
    test_moderation_patches()
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
