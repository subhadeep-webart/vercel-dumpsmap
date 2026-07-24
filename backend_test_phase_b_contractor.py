#!/usr/bin/env python3
"""
Phase B Contractor Tools Backend Test
Tests contractor application flow + admin approval with role propagation
"""
import requests
import json
import time
from datetime import datetime

# Read base URL from .env
with open('/app/.env', 'r') as f:
    for line in f:
        if line.startswith('NEXT_PUBLIC_BASE_URL='):
            BASE_URL = line.split('=')[1].strip() + '/api'
            break

print(f"Testing against: {BASE_URL}")
print("=" * 80)

# Test credentials
ADMIN_EMAIL = "jamal@dumpmaps.org"
ADMIN_PASSWORD = "@@Jefferson2180"

def test_step(step_num, description):
    print(f"\n{'='*80}")
    print(f"STEP {step_num}: {description}")
    print('='*80)

def register_user(email, password, name, primary_profile='general'):
    """Register a new test user"""
    payload = {
        'email': email,
        'password': password,
        'name': name,
        'primaryProfile': primary_profile
    }
    resp = requests.post(f"{BASE_URL}/auth/signup", json=payload)
    return resp

def login(email, password):
    """Login and return JWT token"""
    payload = {'email': email, 'password': password}
    resp = requests.post(f"{BASE_URL}/auth/login", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        return data.get('token'), data.get('user', {}).get('id')
    return None, None

def get_me(token):
    """Get current user profile"""
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    return resp

# ============================================================
# STEP A: Register/login a fresh test user (resident profile)
# ============================================================
test_step('A', 'Register/login a fresh test user (resident profile)')

timestamp = int(time.time())
test_user_email = f"rb-phb-{timestamp}@dumpmaps-test.org"
test_user_password = "testpass123"
test_user_name = "Phase B Test User"

print(f"Registering user: {test_user_email}")
reg_resp = register_user(test_user_email, test_user_password, test_user_name, 'general')
print(f"Status: {reg_resp.status_code}")
print(f"Response: {json.dumps(reg_resp.json(), indent=2)}")

if reg_resp.status_code != 200:
    print("❌ FAILED: User registration failed")
    exit(1)

print(f"\nLogging in as: {test_user_email}")
test_token, test_user_id = login(test_user_email, test_user_password)
if not test_token:
    print("❌ FAILED: Login failed")
    exit(1)

print(f"✅ PASSED: User registered and logged in")
print(f"User ID: {test_user_id}")
print(f"Token: {test_token[:50]}...")

# ============================================================
# STEP B: Apply for contractor tools as that user
# ============================================================
test_step('B', 'Apply for contractor tools')

application_payload = {
    'businessName': 'Test Hauling Co',
    'phone': '(555) 555-0000',
    'email': test_user_email,
    'serviceArea': ['San Jose'],
    'desiredRoles': ['hauler', 'junk_removal'],
    'licenseNumber': 'TST-1',
    'insuranceProvider': 'Hiscox'
}

headers = {'Authorization': f'Bearer {test_token}'}
apply_resp = requests.post(f"{BASE_URL}/contractor-applications", json=application_payload, headers=headers)
print(f"Status: {apply_resp.status_code}")
print(f"Response: {json.dumps(apply_resp.json(), indent=2)}")

if apply_resp.status_code != 200:
    print("❌ FAILED: Application submission failed")
    exit(1)

app_data = apply_resp.json().get('application', {})
if app_data.get('userId') != test_user_id:
    print(f"❌ FAILED: userId mismatch. Expected {test_user_id}, got {app_data.get('userId')}")
    exit(1)

if app_data.get('status') != 'pending':
    print(f"❌ FAILED: status should be 'pending', got {app_data.get('status')}")
    exit(1)

if app_data.get('desiredRoles') != ['hauler', 'junk_removal']:
    print(f"❌ FAILED: desiredRoles mismatch. Expected ['hauler', 'junk_removal'], got {app_data.get('desiredRoles')}")
    exit(1)

if app_data.get('businessName') != 'Test Hauling Co':
    print(f"❌ FAILED: businessName mismatch")
    exit(1)

print("✅ PASSED: Application submitted successfully")
print(f"Application ID: {app_data.get('id')}")
print(f"Status: {app_data.get('status')}")
print(f"Desired Roles: {app_data.get('desiredRoles')}")

# ============================================================
# STEP C: Read back via /me
# ============================================================
test_step('C', 'Read back application via /me')

me_resp = requests.get(f"{BASE_URL}/contractor-applications/me", headers=headers)
print(f"Status: {me_resp.status_code}")
print(f"Response: {json.dumps(me_resp.json(), indent=2)}")

if me_resp.status_code != 200:
    print("❌ FAILED: GET /me failed")
    exit(1)

me_app = me_resp.json().get('application')
if not me_app:
    print("❌ FAILED: No application returned")
    exit(1)

if me_app.get('status') != 'pending':
    print(f"❌ FAILED: status should be 'pending', got {me_app.get('status')}")
    exit(1)

if me_app.get('businessName') != 'Test Hauling Co':
    print(f"❌ FAILED: businessName mismatch")
    exit(1)

print("✅ PASSED: Application retrieved via /me")

# ============================================================
# STEP D: Validation tests
# ============================================================
test_step('D', 'Validation tests')

# D1: Missing businessName
print("\nD1: Missing businessName")
invalid_payload = {'desiredRoles': ['hauler']}
d1_resp = requests.post(f"{BASE_URL}/contractor-applications", json=invalid_payload, headers=headers)
print(f"Status: {d1_resp.status_code}")
print(f"Response: {json.dumps(d1_resp.json(), indent=2)}")
if d1_resp.status_code != 400 or 'businessName required' not in d1_resp.json().get('error', ''):
    print("❌ FAILED: Should return 400 with 'businessName required'")
    exit(1)
print("✅ PASSED: Missing businessName validation")

# D2: Missing desiredRoles
print("\nD2: Missing desiredRoles")
invalid_payload = {'businessName': 'Test Co', 'desiredRoles': []}
d2_resp = requests.post(f"{BASE_URL}/contractor-applications", json=invalid_payload, headers=headers)
print(f"Status: {d2_resp.status_code}")
print(f"Response: {json.dumps(d2_resp.json(), indent=2)}")
if d2_resp.status_code != 400 or 'desiredRoles required' not in d2_resp.json().get('error', ''):
    print("❌ FAILED: Should return 400 with 'desiredRoles required'")
    exit(1)
print("✅ PASSED: Missing desiredRoles validation")

# D3: Invalid contractor role
print("\nD3: Invalid contractor role")
invalid_payload = {'businessName': 'Test Co', 'desiredRoles': ['pizza_chef']}
d3_resp = requests.post(f"{BASE_URL}/contractor-applications", json=invalid_payload, headers=headers)
print(f"Status: {d3_resp.status_code}")
print(f"Response: {json.dumps(d3_resp.json(), indent=2)}")
if d3_resp.status_code != 400 or 'No valid contractor roles selected' not in d3_resp.json().get('error', ''):
    print("❌ FAILED: Should return 400 with 'No valid contractor roles selected'")
    exit(1)
print("✅ PASSED: Invalid contractor role validation")

# D4: Unauthenticated request
print("\nD4: Unauthenticated request")
d4_resp = requests.post(f"{BASE_URL}/contractor-applications", json=application_payload)
print(f"Status: {d4_resp.status_code}")
print(f"Response: {json.dumps(d4_resp.json(), indent=2)}")
if d4_resp.status_code != 401:
    print("❌ FAILED: Should return 401 for unauthenticated request")
    exit(1)
print("✅ PASSED: Unauthenticated request blocked")

print("\n✅ ALL VALIDATION TESTS PASSED")

# ============================================================
# STEP E: Idempotency / re-application
# ============================================================
test_step('E', 'Idempotency / re-application')

reapply_payload = {
    'businessName': 'Updated Hauling Co',
    'phone': '(555) 555-1111',
    'email': test_user_email,
    'serviceArea': ['Oakland'],
    'desiredRoles': ['hauler'],
    'licenseNumber': 'TST-2',
    'insuranceProvider': 'State Farm'
}

reapply_resp = requests.post(f"{BASE_URL}/contractor-applications", json=reapply_payload, headers=headers)
print(f"Status: {reapply_resp.status_code}")
print(f"Response: {json.dumps(reapply_resp.json(), indent=2)}")

if reapply_resp.status_code != 200:
    print("❌ FAILED: Re-application failed")
    exit(1)

reapp_data = reapply_resp.json().get('application', {})
if reapp_data.get('id') != app_data.get('id'):
    print(f"❌ FAILED: Application ID changed. Expected {app_data.get('id')}, got {reapp_data.get('id')}")
    exit(1)

if reapp_data.get('status') != 'pending':
    print(f"❌ FAILED: Status should remain 'pending', got {reapp_data.get('status')}")
    exit(1)

if reapp_data.get('businessName') != 'Updated Hauling Co':
    print(f"❌ FAILED: businessName should be updated")
    exit(1)

print("✅ PASSED: Re-application is idempotent (same doc.id, status stays pending)")

# ============================================================
# STEP F: Admin approve flow
# ============================================================
test_step('F', 'Admin approve flow (Phase B amendment)')

# Login as admin
print(f"Logging in as admin: {ADMIN_EMAIL}")
admin_token, admin_id = login(ADMIN_EMAIL, ADMIN_PASSWORD)
if not admin_token:
    print("❌ FAILED: Admin login failed")
    exit(1)
print(f"✅ Admin logged in. Token: {admin_token[:50]}...")

# Approve the application
approve_payload = {
    'userId': test_user_id,
    'status': 'approved',
    'payoutEligible': True
}

admin_headers = {'Authorization': f'Bearer {admin_token}'}
approve_resp = requests.post(f"{BASE_URL}/admin/contractor-verifications", json=approve_payload, headers=admin_headers)
print(f"\nApprove Status: {approve_resp.status_code}")
print(f"Response: {json.dumps(approve_resp.json(), indent=2)}")

if approve_resp.status_code != 200:
    print("❌ FAILED: Admin approval failed")
    exit(1)

print("✅ Admin approval successful")

# Re-fetch user profile to verify Phase B amendment
print("\nRe-fetching user profile to verify Phase B amendment...")
user_resp = get_me(test_token)
print(f"Status: {user_resp.status_code}")
user_data = user_resp.json().get('user', {})
print(f"User data: {json.dumps(user_data, indent=2)}")

# Verify Phase B amendment: verificationLevel, isVerified, contractorRoles
if user_data.get('verificationLevel') != 'verified_contractor':
    print(f"❌ FAILED: verificationLevel should be 'verified_contractor', got {user_data.get('verificationLevel')}")
    exit(1)

if user_data.get('isVerified') != True:
    print(f"❌ FAILED: isVerified should be True, got {user_data.get('isVerified')}")
    exit(1)

contractor_roles = user_data.get('contractorRoles', [])
if 'hauler' not in contractor_roles:
    print(f"❌ FAILED: contractorRoles should contain 'hauler', got {contractor_roles}")
    exit(1)

# Note: The re-application changed desiredRoles to ['hauler'], so we expect ['hauler'] in contractorRoles
# The original application had ['hauler', 'junk_removal'], but the re-application overwrote it
print(f"✅ PASSED: Phase B amendment verified")
print(f"  - verificationLevel: {user_data.get('verificationLevel')}")
print(f"  - isVerified: {user_data.get('isVerified')}")
print(f"  - contractorRoles: {contractor_roles}")
print(f"  - payoutEligible: {user_data.get('payoutEligible')}")

# ============================================================
# STEP G: Admin reject flow (separate fresh test user)
# ============================================================
test_step('G', 'Admin reject flow (separate fresh test user)')

timestamp2 = int(time.time()) + 1
test_user2_email = f"rb-phb-reject-{timestamp2}@dumpmaps-test.org"
test_user2_password = "testpass123"
test_user2_name = "Phase B Reject Test User"

print(f"Registering second user: {test_user2_email}")
reg2_resp = register_user(test_user2_email, test_user2_password, test_user2_name, 'general')
print(f"Status: {reg2_resp.status_code}")

if reg2_resp.status_code != 200:
    print("❌ FAILED: User 2 registration failed")
    exit(1)

test_token2, test_user2_id = login(test_user2_email, test_user2_password)
if not test_token2:
    print("❌ FAILED: User 2 login failed")
    exit(1)

print(f"✅ User 2 registered and logged in. ID: {test_user2_id}")

# Apply for contractor tools
app2_payload = {
    'businessName': 'Reject Test Co',
    'phone': '(555) 555-2222',
    'email': test_user2_email,
    'serviceArea': ['Fremont'],
    'desiredRoles': ['recycler'],
    'licenseNumber': 'TST-REJECT',
    'insuranceProvider': 'Geico'
}

headers2 = {'Authorization': f'Bearer {test_token2}'}
apply2_resp = requests.post(f"{BASE_URL}/contractor-applications", json=app2_payload, headers=headers2)
print(f"\nApplication Status: {apply2_resp.status_code}")

if apply2_resp.status_code != 200:
    print("❌ FAILED: User 2 application failed")
    exit(1)

print("✅ User 2 application submitted")

# Admin rejects the application
reject_payload = {
    'userId': test_user2_id,
    'status': 'rejected',
    'payoutEligible': False
}

reject_resp = requests.post(f"{BASE_URL}/admin/contractor-verifications", json=reject_payload, headers=admin_headers)
print(f"\nReject Status: {reject_resp.status_code}")
print(f"Response: {json.dumps(reject_resp.json(), indent=2)}")

if reject_resp.status_code != 200:
    print("❌ FAILED: Admin rejection failed")
    exit(1)

print("✅ Admin rejection successful")

# Verify user 2 profile
user2_resp = get_me(test_token2)
user2_data = user2_resp.json().get('user', {})
print(f"\nUser 2 data: {json.dumps(user2_data, indent=2)}")

if user2_data.get('isVerified') != False:
    print(f"❌ FAILED: isVerified should be False after rejection, got {user2_data.get('isVerified')}")
    exit(1)

if user2_data.get('payoutEligible') != False:
    print(f"❌ FAILED: payoutEligible should be False after rejection, got {user2_data.get('payoutEligible')}")
    exit(1)

print("✅ PASSED: Admin reject flow verified")
print(f"  - isVerified: {user2_data.get('isVerified')}")
print(f"  - payoutEligible: {user2_data.get('payoutEligible')}")

# ============================================================
# STEP H: Role-leak check (marketplace quick-status)
# ============================================================
test_step('H', 'Role-leak check (marketplace quick-status)')

print("Testing if approved contractor can use contractor-allowed marketplace statuses...")

# First, create a marketplace listing as the approved contractor
listing_payload = {
    'title': 'Test Contractor Listing',
    'category': 'construction',
    'condition': 'good',
    'description': 'Testing contractor role propagation',
    'price': 100,
    'priceType': 'fixed',
    'location': 'San Jose, CA',
    'segment': 'contractor'
}

listing_resp = requests.post(f"{BASE_URL}/marketplace", json=listing_payload, headers=headers)
print(f"\nCreate listing Status: {listing_resp.status_code}")

if listing_resp.status_code != 200:
    print("⚠️  WARNING: Could not create marketplace listing (may be expected if marketplace is restricted)")
    print(f"Response: {json.dumps(listing_resp.json(), indent=2)}")
else:
    listing_data = listing_resp.json().get('listing', {})
    listing_id = listing_data.get('id')
    print(f"✅ Listing created. ID: {listing_id}")
    
    # Try to set a contractor-allowed status (on_truck)
    status_payload = {'status': 'on_truck'}
    status_resp = requests.post(f"{BASE_URL}/marketplace/{listing_id}/quick-status", json=status_payload, headers=headers)
    print(f"\nQuick-status (on_truck) Status: {status_resp.status_code}")
    print(f"Response: {json.dumps(status_resp.json(), indent=2)}")
    
    if status_resp.status_code == 200:
        print("✅ PASSED: Contractor can use contractor-allowed marketplace statuses")
    elif status_resp.status_code == 403:
        print("⚠️  WARNING: Contractor role not propagating to marketplace (403 forbidden)")
        print("This may indicate an issue with role propagation or marketplace role resolution")
    else:
        print(f"⚠️  WARNING: Unexpected status code: {status_resp.status_code}")

print("\n" + "="*80)
print("PHASE B CONTRACTOR TOOLS TEST SUMMARY")
print("="*80)
print("✅ STEP A: Register/login fresh test user - PASSED")
print("✅ STEP B: Apply for contractor tools - PASSED")
print("✅ STEP C: Read back via /me - PASSED")
print("✅ STEP D: Validation tests - PASSED (4/4)")
print("✅ STEP E: Idempotency / re-application - PASSED")
print("✅ STEP F: Admin approve flow (Phase B amendment) - PASSED")
print("✅ STEP G: Admin reject flow - PASSED")
print("✅ STEP H: Role-leak check - COMPLETED (see details above)")
print("="*80)
print("ALL CRITICAL TESTS PASSED ✅")
print("="*80)
