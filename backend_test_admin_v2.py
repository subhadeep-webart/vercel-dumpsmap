#!/usr/bin/env python3
"""
Backend test for Admin v2 — Platform Owner Tools
Tests new endpoints: platform-settings, integrations, email-settings, warnings, fraud-flags, disputes, contractor-verifications, facility-owner-flags
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"
ADMIN_EMAIL = "aj@bisonjunk.com"
ADMIN_PASSWORD = "admin123"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login(email, password):
    """Login and return token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log(f"✅ Login successful: {email} (role: {data.get('user', {}).get('role', 'unknown')})")
            return data.get('token')
        else:
            log(f"❌ Login failed for {email}: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        log(f"❌ Login exception for {email}: {e}")
        return None

def test_platform_settings(super_admin_token, normal_user_token):
    """Test platform settings endpoints"""
    log("\n=== TEST 1: Platform Settings (singleton + maintenance mode) ===")
    
    # 1.1 GET /api/admin/platform-settings as super_admin
    try:
        resp = requests.get(f"{BASE_URL}/admin/platform-settings", 
                           headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get('settings', {})
            log(f"✅ GET /admin/platform-settings → 200")
            
            # Verify structure
            if settings.get('id') == 'singleton':
                log(f"  ✅ settings.id = 'singleton'")
            else:
                log(f"  ❌ settings.id = {settings.get('id')} (expected 'singleton')")
            
            if 'maintenanceMode' in settings:
                log(f"  ✅ maintenanceMode present: {settings['maintenanceMode']}")
            else:
                log(f"  ❌ maintenanceMode missing")
            
            # Check modules
            modules = settings.get('modules', {})
            required_modules = ['marketplaceEnabled', 'jobsEnabled', 'chatEnabled', 'paymentsEnabled', 
                              'facilitySubmissionsEnabled', 'mapEnabled', 'communityEnabled']
            missing = [m for m in required_modules if m not in modules]
            if not missing:
                log(f"  ✅ All required modules present: {list(modules.keys())}")
            else:
                log(f"  ❌ Missing modules: {missing}")
            
            # Check facilityOwnerFeatures
            if 'facilityOwnerFeatures' in settings:
                log(f"  ✅ facilityOwnerFeatures present: {list(settings['facilityOwnerFeatures'].keys())}")
            else:
                log(f"  ❌ facilityOwnerFeatures missing")
        else:
            log(f"❌ GET /admin/platform-settings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/platform-settings exception: {e}")
        return False
    
    # 1.2 GET /api/platform-settings/public WITHOUT auth
    try:
        resp = requests.get(f"{BASE_URL}/platform-settings/public", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log(f"✅ GET /platform-settings/public (no auth) → 200")
            if 'settings' in data:
                log(f"  ✅ Settings echoed in public endpoint")
            else:
                log(f"  ❌ Settings not in response")
        else:
            log(f"❌ GET /platform-settings/public → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /platform-settings/public exception: {e}")
        return False
    
    # 1.3 PATCH /api/admin/platform-settings as super_admin (enable maintenance)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/platform-settings",
                             headers={"Authorization": f"Bearer {super_admin_token}"},
                             json={"maintenanceMode": True, "maintenanceMessage": "Brief maintenance window"},
                             timeout=10)
        if resp.status_code == 200:
            log(f"✅ PATCH /admin/platform-settings (maintenanceMode=true) → 200")
            
            # Verify persistence
            resp2 = requests.get(f"{BASE_URL}/admin/platform-settings",
                               headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
            if resp2.status_code == 200:
                settings = resp2.json().get('settings', {})
                if settings.get('maintenanceMode') == True and settings.get('maintenanceMessage') == "Brief maintenance window":
                    log(f"  ✅ Maintenance mode persisted correctly")
                else:
                    log(f"  ❌ Maintenance mode not persisted: {settings.get('maintenanceMode')}, {settings.get('maintenanceMessage')}")
            else:
                log(f"  ❌ Failed to verify persistence: {resp2.status_code}")
        else:
            log(f"❌ PATCH /admin/platform-settings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/platform-settings exception: {e}")
        return False
    
    # 1.4 PATCH as normal user → 403
    try:
        resp = requests.patch(f"{BASE_URL}/admin/platform-settings",
                             headers={"Authorization": f"Bearer {normal_user_token}"},
                             json={"maintenanceMode": False},
                             timeout=10)
        if resp.status_code == 403:
            log(f"✅ PATCH /admin/platform-settings as normal user → 403 (correct)")
        else:
            log(f"❌ PATCH /admin/platform-settings as normal user → {resp.status_code} (expected 403)")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/platform-settings (normal user) exception: {e}")
        return False
    
    # 1.5 PATCH modules (disable marketplace, verify merge)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/platform-settings",
                             headers={"Authorization": f"Bearer {super_admin_token}"},
                             json={"modules": {"marketplaceEnabled": False}},
                             timeout=10)
        if resp.status_code == 200:
            settings = resp.json().get('settings', {})
            modules = settings.get('modules', {})
            if modules.get('marketplaceEnabled') == False:
                log(f"✅ PATCH modules.marketplaceEnabled=false → persisted")
                # Check other modules preserved
                if modules.get('jobsEnabled') == True and modules.get('chatEnabled') == True:
                    log(f"  ✅ Other modules preserved by merge")
                else:
                    log(f"  ❌ Other modules not preserved: {modules}")
            else:
                log(f"❌ modules.marketplaceEnabled not updated: {modules.get('marketplaceEnabled')}")
                return False
        else:
            log(f"❌ PATCH modules → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH modules exception: {e}")
        return False
    
    # 1.6 RESET: restore maintenanceMode=false and marketplaceEnabled=true
    try:
        resp = requests.patch(f"{BASE_URL}/admin/platform-settings",
                             headers={"Authorization": f"Bearer {super_admin_token}"},
                             json={"maintenanceMode": False, "modules": {"marketplaceEnabled": True}},
                             timeout=10)
        if resp.status_code == 200:
            log(f"✅ RESET: maintenanceMode=false, marketplaceEnabled=true")
        else:
            log(f"⚠️  RESET failed: {resp.status_code}")
    except Exception as e:
        log(f"⚠️  RESET exception: {e}")
    
    return True

def test_integrations(super_admin_token, normal_user_token):
    """Test integrations endpoints"""
    log("\n=== TEST 2: Integrations ===")
    
    # 2.1 GET /api/admin/integrations
    try:
        resp = requests.get(f"{BASE_URL}/admin/integrations",
                           headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            integrations = data.get('integrations', [])
            log(f"✅ GET /admin/integrations → 200, count: {len(integrations)}")
            
            if len(integrations) == 10:
                log(f"  ✅ 10 integrations returned")
            else:
                log(f"  ❌ Expected 10 integrations, got {len(integrations)}")
            
            # Check required integrations
            keys = [i.get('key') for i in integrations]
            required = ['stripe', 'google_maps', 'cloudinary', 'aws_s3', 'sendgrid', 'resend', 
                       'twilio', 'scale_software', 'zapier', 'webhooks']
            missing = [k for k in required if k not in keys]
            if not missing:
                log(f"  ✅ All required integrations present")
            else:
                log(f"  ❌ Missing integrations: {missing}")
            
            # Check stripe entry
            stripe = next((i for i in integrations if i.get('key') == 'stripe'), None)
            if stripe:
                if stripe.get('status') == 'coming_soon':
                    log(f"  ✅ Stripe status: coming_soon")
                else:
                    log(f"  ❌ Stripe status: {stripe.get('status')} (expected coming_soon)")
                
                if stripe.get('envPresent') == False:
                    log(f"  ✅ Stripe envPresent: false")
                else:
                    log(f"  ❌ Stripe envPresent: {stripe.get('envPresent')} (expected false)")
            else:
                log(f"  ❌ Stripe integration not found")
            
            # Check scale_software and webhooks (empty envVars should NOT show connected)
            scale = next((i for i in integrations if i.get('key') == 'scale_software'), None)
            webhooks = next((i for i in integrations if i.get('key') == 'webhooks'), None)
            
            if scale and scale.get('status') != 'connected':
                log(f"  ✅ scale_software not showing 'connected' (status: {scale.get('status')})")
            elif scale:
                log(f"  ❌ scale_software showing 'connected' (should be not_connected)")
            
            if webhooks and webhooks.get('status') != 'connected':
                log(f"  ✅ webhooks not showing 'connected' (status: {webhooks.get('status')})")
            elif webhooks:
                log(f"  ❌ webhooks showing 'connected' (should be not_connected)")
        else:
            log(f"❌ GET /admin/integrations → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/integrations exception: {e}")
        return False
    
    # 2.2 PATCH /api/admin/integrations/stripe (update notes)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/integrations/stripe",
                             headers={"Authorization": f"Bearer {super_admin_token}"},
                             json={"notes": "awaiting test keys"},
                             timeout=10)
        if resp.status_code == 200:
            log(f"✅ PATCH /admin/integrations/stripe → 200")
            
            # Verify persistence
            resp2 = requests.get(f"{BASE_URL}/admin/integrations",
                               headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
            if resp2.status_code == 200:
                integrations = resp2.json().get('integrations', [])
                stripe = next((i for i in integrations if i.get('key') == 'stripe'), None)
                if stripe and stripe.get('notes') == "awaiting test keys":
                    log(f"  ✅ Stripe notes updated and persisted")
                else:
                    log(f"  ❌ Stripe notes not persisted: {stripe.get('notes') if stripe else 'not found'}")
            else:
                log(f"  ❌ Failed to verify persistence: {resp2.status_code}")
        else:
            log(f"❌ PATCH /admin/integrations/stripe → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/integrations/stripe exception: {e}")
        return False
    
    # 2.3 PATCH as normal user → 403
    try:
        resp = requests.patch(f"{BASE_URL}/admin/integrations/stripe",
                             headers={"Authorization": f"Bearer {normal_user_token}"},
                             json={"notes": "should fail"},
                             timeout=10)
        if resp.status_code == 403:
            log(f"✅ PATCH /admin/integrations/stripe as normal user → 403 (correct)")
        else:
            log(f"❌ PATCH /admin/integrations/stripe as normal user → {resp.status_code} (expected 403)")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/integrations/stripe (normal user) exception: {e}")
        return False
    
    return True

def test_email_settings(super_admin_token):
    """Test email settings endpoints"""
    log("\n=== TEST 3: Email Settings ===")
    
    # 3.1 GET /api/admin/email-settings
    try:
        resp = requests.get(f"{BASE_URL}/admin/email-settings",
                           headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get('settings', {})
            log(f"✅ GET /admin/email-settings → 200")
            
            if settings.get('id') == 'singleton':
                log(f"  ✅ settings.id = 'singleton'")
            else:
                log(f"  ❌ settings.id = {settings.get('id')}")
            
            if settings.get('provider') == 'none':
                log(f"  ✅ provider = 'none'")
            else:
                log(f"  ⚠️  provider = {settings.get('provider')} (expected 'none' initially)")
            
            if settings.get('from') == 'no-reply@dumpmaps.org':
                log(f"  ✅ from = 'no-reply@dumpmaps.org'")
            else:
                log(f"  ❌ from = {settings.get('from')}")
            
            # Check triggers
            triggers = settings.get('triggers', {})
            required_triggers = ['newFacility', 'newListing', 'newJob', 'reportedContent', 'paymentEvent', 'claimRequest']
            missing = [t for t in required_triggers if t not in triggers]
            if not missing:
                log(f"  ✅ All required triggers present: {list(triggers.keys())}")
            else:
                log(f"  ❌ Missing triggers: {missing}")
        else:
            log(f"❌ GET /admin/email-settings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/email-settings exception: {e}")
        return False
    
    # 3.2 PATCH /api/admin/email-settings (update provider and trigger)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/email-settings",
                             headers={"Authorization": f"Bearer {super_admin_token}"},
                             json={
                                 "provider": "sendgrid",
                                 "triggers": {
                                     "newFacility": {
                                         "enabled": True,
                                         "recipients": "custom",
                                         "custom": "alerts@dumpmaps.org"
                                     }
                                 }
                             },
                             timeout=10)
        if resp.status_code == 200:
            log(f"✅ PATCH /admin/email-settings → 200")
            
            # Verify persistence and merge
            resp2 = requests.get(f"{BASE_URL}/admin/email-settings",
                               headers={"Authorization": f"Bearer {super_admin_token}"}, timeout=10)
            if resp2.status_code == 200:
                settings = resp2.json().get('settings', {})
                if settings.get('provider') == 'sendgrid':
                    log(f"  ✅ provider updated to 'sendgrid'")
                else:
                    log(f"  ❌ provider not updated: {settings.get('provider')}")
                
                triggers = settings.get('triggers', {})
                newFacility = triggers.get('newFacility', {})
                if newFacility.get('custom') == 'alerts@dumpmaps.org':
                    log(f"  ✅ newFacility trigger updated")
                else:
                    log(f"  ❌ newFacility trigger not updated: {newFacility}")
                
                # Check other triggers preserved
                if 'newListing' in triggers and 'reportedContent' in triggers:
                    log(f"  ✅ Other triggers preserved by merge")
                else:
                    log(f"  ❌ Other triggers not preserved")
            else:
                log(f"  ❌ Failed to verify persistence: {resp2.status_code}")
        else:
            log(f"❌ PATCH /admin/email-settings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/email-settings exception: {e}")
        return False
    
    return True

def test_warnings(admin_token):
    """Test warnings endpoints"""
    log("\n=== TEST 4: Warnings ===")
    
    # First, get a user ID to issue warning to
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=1",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            if users:
                user_id = users[0].get('id')
                user_email = users[0].get('email')
                log(f"  Using user: {user_email} (id: {user_id})")
            else:
                log(f"❌ No users found to test warnings")
                return False
        else:
            log(f"❌ Failed to get users: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Failed to get users: {e}")
        return False
    
    # 4.1 POST /api/admin/warnings
    try:
        resp = requests.post(f"{BASE_URL}/admin/warnings",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            json={
                                "userId": user_id,
                                "reason": "spam comments",
                                "severity": "warning"
                            },
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            warning = data.get('warning', {})
            warning_id = warning.get('id')
            log(f"✅ POST /admin/warnings → 200, warning_id: {warning_id}")
        else:
            log(f"❌ POST /admin/warnings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ POST /admin/warnings exception: {e}")
        return False
    
    # 4.2 GET /api/admin/warnings (list all)
    try:
        resp = requests.get(f"{BASE_URL}/admin/warnings",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            warnings = data.get('warnings', [])
            log(f"✅ GET /admin/warnings → 200, count: {len(warnings)}")
            
            # Check if our warning is in the list
            found = any(w.get('id') == warning_id for w in warnings)
            if found:
                log(f"  ✅ New warning found in list")
            else:
                log(f"  ❌ New warning not found in list")
        else:
            log(f"❌ GET /admin/warnings → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/warnings exception: {e}")
        return False
    
    # 4.3 GET /api/admin/warnings?userId=<id>
    try:
        resp = requests.get(f"{BASE_URL}/admin/warnings?userId={user_id}",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            warnings = data.get('warnings', [])
            log(f"✅ GET /admin/warnings?userId={user_id} → 200, count: {len(warnings)}")
            
            # All warnings should be for this user
            all_match = all(w.get('userId') == user_id for w in warnings)
            if all_match:
                log(f"  ✅ All warnings are for the specified user")
            else:
                log(f"  ❌ Some warnings are for other users")
        else:
            log(f"❌ GET /admin/warnings?userId → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/warnings?userId exception: {e}")
        return False
    
    # 4.4 Verify user.warningCount incremented
    try:
        resp = requests.get(f"{BASE_URL}/admin/users/{user_id}",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            user = resp.json().get('user', {})
            warning_count = user.get('warningCount', 0)
            if warning_count > 0:
                log(f"✅ User warningCount incremented: {warning_count}")
            else:
                log(f"⚠️  User warningCount not incremented: {warning_count}")
        else:
            log(f"⚠️  Failed to verify warningCount: {resp.status_code}")
    except Exception as e:
        log(f"⚠️  Failed to verify warningCount: {e}")
    
    return True

def test_fraud_flags(admin_token):
    """Test fraud flags endpoints"""
    log("\n=== TEST 5: Fraud Flags ===")
    
    # Get a user ID for testing
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=1",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            if users:
                user_id = users[0].get('id')
                log(f"  Using user_id: {user_id}")
            else:
                log(f"❌ No users found")
                return False
        else:
            log(f"❌ Failed to get users: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Failed to get users: {e}")
        return False
    
    # 5.1 POST /api/admin/fraud-flags
    try:
        resp = requests.post(f"{BASE_URL}/admin/fraud-flags",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            json={
                                "targetKind": "user",
                                "targetId": user_id,
                                "type": "suspicious_activity",
                                "severity": "high",
                                "note": "multiple chargebacks"
                            },
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            flag = data.get('flag', {})
            flag_id = flag.get('id')
            log(f"✅ POST /admin/fraud-flags → 200, flag_id: {flag_id}")
        else:
            log(f"❌ POST /admin/fraud-flags → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ POST /admin/fraud-flags exception: {e}")
        return False
    
    # 5.2 GET /api/admin/fraud-flags (open by default)
    try:
        resp = requests.get(f"{BASE_URL}/admin/fraud-flags",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            flags = data.get('flags', [])
            log(f"✅ GET /admin/fraud-flags (open) → 200, count: {len(flags)}")
            
            # Check if our flag is in the list
            found = any(f.get('id') == flag_id for f in flags)
            if found:
                log(f"  ✅ New flag found in open list")
            else:
                log(f"  ❌ New flag not found in open list")
        else:
            log(f"❌ GET /admin/fraud-flags → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/fraud-flags exception: {e}")
        return False
    
    # 5.3 PATCH /api/admin/fraud-flags/<id> (resolve)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/fraud-flags/{flag_id}",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             json={"resolution": "cleared after review"},
                             timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            flag = data.get('flag', {})
            log(f"✅ PATCH /admin/fraud-flags/{flag_id} → 200")
            
            if flag.get('resolvedAt'):
                log(f"  ✅ flag.resolvedAt set: {flag.get('resolvedAt')}")
            else:
                log(f"  ❌ flag.resolvedAt not set")
            
            if flag.get('resolution') == "cleared after review":
                log(f"  ✅ flag.resolution set correctly")
            else:
                log(f"  ❌ flag.resolution not set: {flag.get('resolution')}")
        else:
            log(f"❌ PATCH /admin/fraud-flags/{flag_id} → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/fraud-flags exception: {e}")
        return False
    
    # 5.4 GET /api/admin/fraud-flags?resolved=true
    try:
        resp = requests.get(f"{BASE_URL}/admin/fraud-flags?resolved=true",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            flags = data.get('flags', [])
            log(f"✅ GET /admin/fraud-flags?resolved=true → 200, count: {len(flags)}")
            
            # Check if our resolved flag is in the list
            found = any(f.get('id') == flag_id for f in flags)
            if found:
                log(f"  ✅ Resolved flag found in resolved list")
            else:
                log(f"  ❌ Resolved flag not found in resolved list")
        else:
            log(f"❌ GET /admin/fraud-flags?resolved=true → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/fraud-flags?resolved=true exception: {e}")
        return False
    
    return True

def test_disputes(admin_token):
    """Test disputes endpoints"""
    log("\n=== TEST 6: Disputes ===")
    
    # Get two user IDs for testing
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=2",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            if len(users) >= 2:
                user1_id = users[0].get('id')
                user2_id = users[1].get('id')
                log(f"  Using user1_id: {user1_id}, user2_id: {user2_id}")
            else:
                log(f"❌ Need at least 2 users for dispute test")
                return False
        else:
            log(f"❌ Failed to get users: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Failed to get users: {e}")
        return False
    
    # 6.1 POST /api/admin/disputes
    try:
        resp = requests.post(f"{BASE_URL}/admin/disputes",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            json={
                                "kind": "job",
                                "relatedId": "job123",
                                "partyAUserId": user1_id,
                                "partyBUserId": user2_id,
                                "note": "job not completed"
                            },
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            dispute = data.get('dispute', {})
            dispute_id = dispute.get('id')
            log(f"✅ POST /admin/disputes → 200, dispute_id: {dispute_id}")
            
            if dispute.get('status') == 'open':
                log(f"  ✅ dispute.status = 'open'")
            else:
                log(f"  ❌ dispute.status = {dispute.get('status')} (expected 'open')")
        else:
            log(f"❌ POST /admin/disputes → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ POST /admin/disputes exception: {e}")
        return False
    
    # 6.2 GET /api/admin/disputes?status=open
    try:
        resp = requests.get(f"{BASE_URL}/admin/disputes?status=open",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            disputes = data.get('disputes', [])
            log(f"✅ GET /admin/disputes?status=open → 200, count: {len(disputes)}")
            
            # Check if our dispute is in the list
            found = any(d.get('id') == dispute_id for d in disputes)
            if found:
                log(f"  ✅ New dispute found in open list")
            else:
                log(f"  ❌ New dispute not found in open list")
        else:
            log(f"❌ GET /admin/disputes?status=open → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/disputes?status=open exception: {e}")
        return False
    
    # 6.3 PATCH /api/admin/disputes/<id> (resolve)
    try:
        resp = requests.patch(f"{BASE_URL}/admin/disputes/{dispute_id}",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             json={
                                 "status": "resolved",
                                 "resolution": "partial refund"
                             },
                             timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            dispute = data.get('dispute', {})
            log(f"✅ PATCH /admin/disputes/{dispute_id} → 200")
            
            if dispute.get('status') == 'resolved':
                log(f"  ✅ dispute.status = 'resolved'")
            else:
                log(f"  ❌ dispute.status = {dispute.get('status')}")
            
            if dispute.get('resolution') == 'partial refund':
                log(f"  ✅ dispute.resolution set correctly")
            else:
                log(f"  ❌ dispute.resolution = {dispute.get('resolution')}")
        else:
            log(f"❌ PATCH /admin/disputes/{dispute_id} → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/disputes exception: {e}")
        return False
    
    return True

def test_contractor_verifications(admin_token):
    """Test contractor verifications endpoints"""
    log("\n=== TEST 7: Contractor Verifications ===")
    
    # Get a user ID for testing
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=1",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            if users:
                user_id = users[0].get('id')
                user_email = users[0].get('email')
                log(f"  Using user: {user_email} (id: {user_id})")
            else:
                log(f"❌ No users found")
                return False
        else:
            log(f"❌ Failed to get users: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Failed to get users: {e}")
        return False
    
    # 7.1 POST /api/admin/contractor-verifications (approved)
    try:
        resp = requests.post(f"{BASE_URL}/admin/contractor-verifications",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            json={
                                "userId": user_id,
                                "licenseNumber": "C-12345",
                                "insuranceProvider": "State Farm",
                                "businessName": "Acme Hauling",
                                "serviceArea": ["San Jose", "Sunnyvale"],
                                "status": "approved",
                                "payoutEligible": True
                            },
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            verification = data.get('verification', {})
            log(f"✅ POST /admin/contractor-verifications (approved) → 200")
        else:
            log(f"❌ POST /admin/contractor-verifications → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ POST /admin/contractor-verifications exception: {e}")
        return False
    
    # 7.2 Verify user document updated
    try:
        resp = requests.get(f"{BASE_URL}/admin/users/{user_id}",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            user = resp.json().get('user', {})
            log(f"✅ GET /admin/users/{user_id} → 200")
            
            if user.get('verificationLevel') == 'verified_contractor':
                log(f"  ✅ user.verificationLevel = 'verified_contractor'")
            else:
                log(f"  ❌ user.verificationLevel = {user.get('verificationLevel')} (expected 'verified_contractor')")
            
            if user.get('isVerified') == True:
                log(f"  ✅ user.isVerified = true")
            else:
                log(f"  ❌ user.isVerified = {user.get('isVerified')}")
            
            if user.get('payoutEligible') == True:
                log(f"  ✅ user.payoutEligible = true")
            else:
                log(f"  ❌ user.payoutEligible = {user.get('payoutEligible')}")
        else:
            log(f"❌ GET /admin/users/{user_id} → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/users/{user_id} exception: {e}")
        return False
    
    # 7.3 GET /api/admin/contractor-verifications?status=approved
    try:
        resp = requests.get(f"{BASE_URL}/admin/contractor-verifications?status=approved",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            verifications = data.get('verifications', [])
            log(f"✅ GET /admin/contractor-verifications?status=approved → 200, count: {len(verifications)}")
            
            # Check if our verification is in the list
            found = any(v.get('userId') == user_id for v in verifications)
            if found:
                log(f"  ✅ Verification found in approved list")
            else:
                log(f"  ❌ Verification not found in approved list")
        else:
            log(f"❌ GET /admin/contractor-verifications?status=approved → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/contractor-verifications?status=approved exception: {e}")
        return False
    
    # 7.4 POST again with status=rejected (upsert test)
    try:
        resp = requests.post(f"{BASE_URL}/admin/contractor-verifications",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            json={
                                "userId": user_id,
                                "status": "rejected",
                                "payoutEligible": False
                            },
                            timeout=10)
        if resp.status_code == 200:
            log(f"✅ POST /admin/contractor-verifications (rejected) → 200 (upsert)")
            
            # Verify user document updated
            resp2 = requests.get(f"{BASE_URL}/admin/users/{user_id}",
                               headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
            if resp2.status_code == 200:
                user = resp2.json().get('user', {})
                if user.get('isVerified') == False:
                    log(f"  ✅ user.isVerified = false (after rejection)")
                else:
                    log(f"  ❌ user.isVerified = {user.get('isVerified')} (expected false)")
                
                if user.get('payoutEligible') == False:
                    log(f"  ✅ user.payoutEligible = false (after rejection)")
                else:
                    log(f"  ❌ user.payoutEligible = {user.get('payoutEligible')} (expected false)")
            else:
                log(f"  ❌ Failed to verify user update: {resp2.status_code}")
        else:
            log(f"❌ POST /admin/contractor-verifications (rejected) → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ POST /admin/contractor-verifications (rejected) exception: {e}")
        return False
    
    return True

def test_facility_owner_flags(admin_token, normal_user_token):
    """Test facility-owner flags endpoints"""
    log("\n=== TEST 8: Facility-Owner Flags ===")
    
    # Get a user ID for testing
    try:
        resp = requests.get(f"{BASE_URL}/admin/users?limit=1",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get('users', [])
            if users:
                user_id = users[0].get('id')
                log(f"  Using user_id: {user_id}")
            else:
                log(f"❌ No users found")
                return False
        else:
            log(f"❌ Failed to get users: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Failed to get users: {e}")
        return False
    
    # 8.1 PATCH /api/admin/facility-owner-flags/<userId> as admin
    try:
        resp = requests.patch(f"{BASE_URL}/admin/facility-owner-flags/{user_id}",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             json={
                                 "claimListing": True,
                                 "updatePricing": True,
                                 "postClosures": False
                             },
                             timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            user = data.get('user', {})
            log(f"✅ PATCH /admin/facility-owner-flags/{user_id} → 200")
            
            flags = user.get('facilityOwnerFlags', {})
            if flags.get('claimListing') == True:
                log(f"  ✅ facilityOwnerFlags.claimListing = true")
            else:
                log(f"  ❌ facilityOwnerFlags.claimListing = {flags.get('claimListing')}")
            
            if flags.get('updatePricing') == True:
                log(f"  ✅ facilityOwnerFlags.updatePricing = true")
            else:
                log(f"  ❌ facilityOwnerFlags.updatePricing = {flags.get('updatePricing')}")
            
            if flags.get('postClosures') == False:
                log(f"  ✅ facilityOwnerFlags.postClosures = false")
            else:
                log(f"  ❌ facilityOwnerFlags.postClosures = {flags.get('postClosures')}")
        else:
            log(f"❌ PATCH /admin/facility-owner-flags/{user_id} → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/facility-owner-flags exception: {e}")
        return False
    
    # 8.2 PATCH as normal user → 403
    try:
        resp = requests.patch(f"{BASE_URL}/admin/facility-owner-flags/{user_id}",
                             headers={"Authorization": f"Bearer {normal_user_token}"},
                             json={"claimListing": False},
                             timeout=10)
        if resp.status_code == 403:
            log(f"✅ PATCH /admin/facility-owner-flags as normal user → 403 (correct)")
        else:
            log(f"❌ PATCH /admin/facility-owner-flags as normal user → {resp.status_code} (expected 403)")
            return False
    except Exception as e:
        log(f"❌ PATCH /admin/facility-owner-flags (normal user) exception: {e}")
        return False
    
    return True

def test_activity_log_audit_trail(admin_token):
    """Test activity log contains new Admin v2 actions"""
    log("\n=== TEST 9: Activity Log Audit Trail ===")
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/activity-log?limit=100",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            logs = data.get('logs', [])  # Fixed: endpoint returns 'logs' not 'activities'
            log(f"✅ GET /admin/activity-log → 200, count: {len(logs)}")
            
            # Check for new Admin v2 actions
            actions = [a.get('action') for a in logs]
            expected_actions = [
                'settings.update',
                'integration.update',
                'email_settings.update',
                'user.warning',
                'fraud.flag',
                'fraud.resolve',
                'dispute.open',
                'dispute.resolved',
                'contractor.approved',
                'contractor.rejected',
                'facility_owner.flags'
            ]
            
            found_actions = [action for action in expected_actions if action in actions]
            missing_actions = [action for action in expected_actions if action not in actions]
            
            log(f"  ✅ Found actions: {found_actions}")
            if missing_actions:
                log(f"  ⚠️  Missing actions (may not have been triggered): {missing_actions}")
            else:
                log(f"  ✅ All expected Admin v2 actions present in activity log")
        else:
            log(f"❌ GET /admin/activity-log → {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ GET /admin/activity-log exception: {e}")
        return False
    
    return True

def main():
    log("=" * 80)
    log("ADMIN V2 — PLATFORM OWNER TOOLS BACKEND TEST")
    log("=" * 80)
    
    # Login
    log("\n=== AUTHENTICATION ===")
    super_admin_token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    if not super_admin_token or not admin_token:
        log("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
        sys.exit(1)
    
    # Create a normal user for testing access control
    log("\n=== CREATE NORMAL USER FOR ACCESS CONTROL TESTS ===")
    try:
        test_email = f"normaluser_{datetime.now().timestamp()}@test.com"
        resp = requests.post(f"{BASE_URL}/auth/signup", 
                           json={"email": test_email, "password": "test123", "name": "Normal User"}, 
                           timeout=10)
        if resp.status_code == 200:
            normal_user_token = resp.json().get('token')
            log(f"✅ Normal user created: {test_email}")
        else:
            log(f"❌ Failed to create normal user: {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        log(f"❌ Failed to create normal user: {e}")
        sys.exit(1)
    
    # Run tests
    results = []
    
    results.append(("Platform Settings", test_platform_settings(super_admin_token, normal_user_token)))
    results.append(("Integrations", test_integrations(super_admin_token, normal_user_token)))
    results.append(("Email Settings", test_email_settings(super_admin_token)))
    results.append(("Warnings", test_warnings(admin_token)))
    results.append(("Fraud Flags", test_fraud_flags(admin_token)))
    results.append(("Disputes", test_disputes(admin_token)))
    results.append(("Contractor Verifications", test_contractor_verifications(admin_token)))
    results.append(("Facility-Owner Flags", test_facility_owner_flags(admin_token, normal_user_token)))
    results.append(("Activity Log Audit Trail", test_activity_log_audit_trail(admin_token)))
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{status}: {test_name}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL ADMIN V2 TESTS PASSED!")
        sys.exit(0)
    else:
        log(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
