#!/usr/bin/env python3
"""
Backend test for DumpMaps Marketplace - Two Feature Clusters:
  CLUSTER A: Persistent Image Uploads (/api/upload + /api/files/[name])
  CLUSTER B: Role-Aware Marketplace Status Validation
"""

import requests
import io
import os
import time
from PIL import Image

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}

# Role configurations for CLUSTER B
ROLE_CONFIGS = {
    "resident": {
        "email": f"resident-rolesplit-{int(time.time())}@dumpmaps-test.org",
        "password": "testpass123",
        "profile": "general",
        "allowed": ["available", "reserved", "sold", "donated"],
        "disallowed": ["on_truck", "at_site", "last_chance", "claimed", "recycled", "pickup_scheduled", "disposed", "accepted", "processed"]
    },
    "contractor": {
        "email": f"contractor-rolesplit-{int(time.time())}@dumpmaps-test.org",
        "password": "testpass123",
        "profile": "hauler",
        "allowed": ["available", "on_truck", "at_site", "last_chance", "claimed", "sold", "donated", "recycled"],
        "disallowed": ["reserved", "pickup_scheduled", "disposed", "accepted", "processed"]
    },
    "property_manager": {
        "email": f"pm-rolesplit-{int(time.time())}@dumpmaps-test.org",
        "password": "testpass123",
        "profile": "property_manager",
        "allowed": ["available", "pickup_scheduled", "reserved", "claimed", "donated", "disposed"],
        "disallowed": ["on_truck", "at_site", "last_chance", "sold", "recycled", "accepted", "processed"]
    },
    "facility": {
        "email": f"facility-rolesplit-{int(time.time())}@dumpmaps-test.org",
        "password": "testpass123",
        "profile": "facility_owner",
        "allowed": ["available", "accepted", "processed", "recycled"],
        "disallowed": ["on_truck", "at_site", "last_chance", "reserved", "pickup_scheduled", "claimed", "sold", "donated", "disposed"]
    }
}

def create_test_png():
    """Create a small in-memory PNG (valid, < 8MB)"""
    img = Image.new('RGB', (100, 100), color='red')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"✅ Login successful: {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def register_user(email, password, profile):
    """Register a new user with specific profile"""
    try:
        payload = {
            "email": email,
            "password": password,
            "name": f"Test {profile.title()}",
            "primaryProfile": profile,
            "profileTypes": [profile]
        }
        resp = requests.post(f"{API_BASE}/auth/signup", json=payload, timeout=10)
        if resp.status_code in [200, 201]:
            print(f"✅ User registered: {email} (profile: {profile})")
            return True
        else:
            print(f"❌ Registration failed for {email}: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Registration exception for {email}: {e}")
        return False

print("=" * 80)
print("CLUSTER A — PERSISTENT IMAGE UPLOADS")
print("=" * 80)

# Step 1: Login as super-admin
print("\n[CLUSTER A - Step 1] Login as super-admin")
admin_token = login(SUPER_ADMIN["email"], SUPER_ADMIN["password"])
if not admin_token:
    print("❌ CLUSTER A FAILED: Cannot login as super-admin")
    exit(1)

# Step 2: Upload a small PNG
print("\n[CLUSTER A - Step 2] Upload a small PNG via POST /api/upload")
try:
    png_buf = create_test_png()
    files = {"file": ("test.png", png_buf, "image/png")}
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{API_BASE}/upload", files=files, headers=headers, timeout=15)
    
    if resp.status_code == 200:
        data = resp.json()
        if "uploads" in data and len(data["uploads"]) > 0:
            upload = data["uploads"][0]
            upload_id = upload.get("id")
            upload_url = upload.get("url")
            upload_size = upload.get("size")
            upload_mime = upload.get("mime")
            
            print(f"✅ Upload successful: {upload}")
            
            # Verify URL format
            if upload_url and upload_url.startswith("/api/files/") and upload_url.endswith(".png"):
                print(f"✅ URL format correct: {upload_url}")
            else:
                print(f"❌ URL format incorrect: {upload_url}")
            
            # Verify file exists on disk
            filename = os.path.basename(upload_url)
            disk_path = f"/data/uploads/{filename}"
            if os.path.exists(disk_path):
                file_size = os.path.getsize(disk_path)
                print(f"✅ File exists on disk: {disk_path} ({file_size} bytes)")
            else:
                print(f"❌ File NOT found on disk: {disk_path}")
        else:
            print(f"❌ Upload response missing 'uploads' array: {data}")
            exit(1)
    else:
        print(f"❌ Upload failed: {resp.status_code} - {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Upload exception: {e}")
    exit(1)

# Step 3: GET the uploaded file
print("\n[CLUSTER A - Step 3] GET uploaded file via /api/files/<name>")
try:
    file_url = f"{BASE_URL}{upload_url}"
    resp = requests.get(file_url, timeout=10)
    
    if resp.status_code == 200:
        print(f"✅ File served successfully: HTTP 200")
        
        # Check Content-Type
        content_type = resp.headers.get("Content-Type", "")
        if content_type == "image/png":
            print(f"✅ Content-Type correct: {content_type}")
        else:
            print(f"❌ Content-Type incorrect: {content_type}")
        
        # Check Content-Length
        content_length = resp.headers.get("Content-Length")
        if content_length:
            print(f"✅ Content-Length present: {content_length} bytes")
        
        # Check Cache-Control
        cache_control = resp.headers.get("Cache-Control", "")
        if "immutable" in cache_control:
            print(f"✅ Cache-Control includes 'immutable': {cache_control}")
        else:
            print(f"❌ Cache-Control missing 'immutable': {cache_control}")
    else:
        print(f"❌ File GET failed: {resp.status_code}")
        exit(1)
except Exception as e:
    print(f"❌ File GET exception: {e}")
    exit(1)

# Step 4: Security tests
print("\n[CLUSTER A - Step 4] Security tests (path traversal, dotfiles, nonexistent)")
try:
    # Path traversal
    resp = requests.get(f"{BASE_URL}/api/files/..%2Fetc%2Fpasswd", timeout=10)
    if resp.status_code == 404:
        print(f"✅ Path traversal blocked: 404")
    else:
        print(f"❌ Path traversal NOT blocked: {resp.status_code}")
    
    # Dotfiles
    resp = requests.get(f"{BASE_URL}/api/files/.hidden", timeout=10)
    if resp.status_code == 404:
        print(f"✅ Dotfiles blocked: 404")
    else:
        print(f"❌ Dotfiles NOT blocked: {resp.status_code}")
    
    # Nonexistent file
    resp = requests.get(f"{BASE_URL}/api/files/nonexistent.png", timeout=10)
    if resp.status_code == 404:
        print(f"✅ Nonexistent file returns 404")
    else:
        print(f"❌ Nonexistent file returns: {resp.status_code}")
except Exception as e:
    print(f"❌ Security test exception: {e}")

# Step 5: Legacy file compatibility
print("\n[CLUSTER A - Step 5] Legacy file compatibility")
try:
    legacy_url = f"{BASE_URL}/api/files/29314ef1-20fa-4b13-92f8-750e9bd37184.png"
    resp = requests.get(legacy_url, timeout=10)
    
    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type", "")
        if content_type == "image/png":
            print(f"✅ Legacy file served: HTTP 200, Content-Type: {content_type}")
        else:
            print(f"❌ Legacy file wrong Content-Type: {content_type}")
    else:
        print(f"❌ Legacy file GET failed: {resp.status_code}")
except Exception as e:
    print(f"❌ Legacy file exception: {e}")

# Step 6: End-to-end with a listing
print("\n[CLUSTER A - Step 6] End-to-end with marketplace listing")
try:
    listing_payload = {
        "title": "Image Upload Test",
        "category": "Furniture",
        "condition": "good",
        "priceType": "free",
        "price": 0,
        "city": "Test City",
        "state": "CA",
        "photos": [upload_url]
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{API_BASE}/marketplace", json=listing_payload, headers=headers, timeout=10)
    
    if resp.status_code in [200, 201]:
        data = resp.json()
        listing = data.get("listing", {})
        listing_id = listing.get("id")
        listing_photos = listing.get("photos", [])
        
        if listing_photos and listing_photos[0] == upload_url:
            print(f"✅ Listing created with photo: {listing_id}")
            print(f"✅ Listing photos[0] matches upload URL: {listing_photos[0]}")
            
            # GET the listing
            resp = requests.get(f"{API_BASE}/marketplace/{listing_id}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                listing = data.get("listing", {})
                if listing.get("photos", [])[0] == upload_url:
                    print(f"✅ GET listing photos[0] still matches: {listing.get('photos', [])[0]}")
                else:
                    print(f"❌ GET listing photos mismatch")
            
            # Clean up: DELETE listing
            resp = requests.delete(f"{API_BASE}/marketplace/{listing_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                print(f"✅ Listing deleted: {listing_id}")
            else:
                print(f"⚠️  Listing delete returned: {resp.status_code}")
        else:
            print(f"❌ Listing photos mismatch: {listing_photos}")
    else:
        print(f"❌ Listing creation failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"❌ Listing test exception: {e}")

# Step 7: DELETE the uploaded file
print("\n[CLUSTER A - Step 7] DELETE uploaded file via DELETE /api/upload/:id")
try:
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.delete(f"{API_BASE}/upload/{upload_id}", headers=headers, timeout=10)
    
    if resp.status_code == 200:
        print(f"✅ Upload deleted: {upload_id}")
        
        # Verify file removed from disk
        disk_path = f"/data/uploads/{filename}"
        if not os.path.exists(disk_path):
            print(f"✅ File removed from disk: {disk_path}")
        else:
            print(f"❌ File still exists on disk: {disk_path}")
        
        # Verify GET returns 404
        file_url = f"{BASE_URL}{upload_url}"
        resp = requests.get(file_url, timeout=10)
        if resp.status_code == 404:
            print(f"✅ GET after DELETE returns 404")
        else:
            print(f"❌ GET after DELETE returns: {resp.status_code}")
    else:
        print(f"❌ Upload delete failed: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"❌ Upload delete exception: {e}")

print("\n" + "=" * 80)
print("CLUSTER B — ROLE-AWARE MARKETPLACE STATUS VALIDATION")
print("=" * 80)

# Test each role
for role_name, config in ROLE_CONFIGS.items():
    print(f"\n{'=' * 80}")
    print(f"Testing Role: {role_name.upper()}")
    print(f"{'=' * 80}")
    
    # Step 1: Register user
    print(f"\n[{role_name} - Step 1] Register user with profile: {config['profile']}")
    if not register_user(config["email"], config["password"], config["profile"]):
        print(f"❌ {role_name} FAILED: Cannot register user")
        continue
    
    # Step 2: Login
    print(f"\n[{role_name} - Step 2] Login as {role_name}")
    token = login(config["email"], config["password"])
    if not token:
        print(f"❌ {role_name} FAILED: Cannot login")
        continue
    
    # Step 3: Create a listing
    print(f"\n[{role_name} - Step 3] Create marketplace listing")
    try:
        listing_payload = {
            "title": f"{role_name.title()} Role Test Listing",
            "category": "Furniture",
            "condition": "good",
            "priceType": "free",
            "price": 0,
            "city": "Test City",
            "state": "CA",
            "photos": []
        }
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(f"{API_BASE}/marketplace", json=listing_payload, headers=headers, timeout=10)
        
        if resp.status_code in [200, 201]:
            data = resp.json()
            listing = data.get("listing", {})
            listing_id = listing.get("id")
            print(f"✅ Listing created: {listing_id}")
        else:
            print(f"❌ Listing creation failed: {resp.status_code} - {resp.text}")
            continue
    except Exception as e:
        print(f"❌ Listing creation exception: {e}")
        continue
    
    # Step 4: Test ALLOWED statuses via quick-status
    print(f"\n[{role_name} - Step 4] Test ALLOWED statuses via POST /api/marketplace/:id/quick-status")
    for status in config["allowed"]:
        try:
            payload = {"itemStatus": status}
            resp = requests.post(f"{API_BASE}/marketplace/{listing_id}/quick-status", json=payload, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                listing = data.get("listing", {})
                if listing.get("itemStatus") == status:
                    print(f"  ✅ {status}: 200, itemStatus={status}")
                else:
                    print(f"  ❌ {status}: itemStatus mismatch: {listing.get('itemStatus')}")
            else:
                print(f"  ❌ {status}: {resp.status_code} - {resp.text[:100]}")
        except Exception as e:
            print(f"  ❌ {status}: exception: {e}")
    
    # Step 5: Test DISALLOWED statuses via quick-status
    print(f"\n[{role_name} - Step 5] Test DISALLOWED statuses via POST /api/marketplace/:id/quick-status")
    for status in config["disallowed"][:3]:  # Test first 3 to save time
        try:
            payload = {"itemStatus": status}
            resp = requests.post(f"{API_BASE}/marketplace/{listing_id}/quick-status", json=payload, headers=headers, timeout=10)
            
            if resp.status_code == 403:
                data = resp.json()
                if "error" in data and "allowedStatuses" in data and "role" in data:
                    print(f"  ✅ {status}: 403 with error, allowedStatuses, role")
                else:
                    print(f"  ❌ {status}: 403 but missing fields: {data}")
                
                # Verify listing status didn't change
                resp_get = requests.get(f"{API_BASE}/marketplace/{listing_id}", timeout=10)
                if resp_get.status_code == 200:
                    listing = resp_get.json().get("listing", {})
                    if listing.get("itemStatus") != status:
                        print(f"  ✅ {status}: listing status unchanged (not {status})")
                    else:
                        print(f"  ❌ {status}: listing status changed to {status} despite 403!")
            else:
                print(f"  ❌ {status}: Expected 403, got {resp.status_code} - {resp.text[:100]}")
        except Exception as e:
            print(f"  ❌ {status}: exception: {e}")
    
    # Step 6: Test DISALLOWED statuses via PATCH
    print(f"\n[{role_name} - Step 6] Test DISALLOWED statuses via PATCH /api/marketplace/:id")
    if config["disallowed"]:
        disallowed_status = config["disallowed"][0]
        try:
            payload = {"itemStatus": disallowed_status}
            resp = requests.patch(f"{API_BASE}/marketplace/{listing_id}", json=payload, headers=headers, timeout=10)
            
            if resp.status_code == 403:
                data = resp.json()
                if "error" in data and "allowedStatuses" in data and "role" in data:
                    print(f"  ✅ PATCH {disallowed_status}: 403 with error, allowedStatuses, role")
                else:
                    print(f"  ❌ PATCH {disallowed_status}: 403 but missing fields: {data}")
                
                # Verify listing status didn't change
                resp_get = requests.get(f"{API_BASE}/marketplace/{listing_id}", timeout=10)
                if resp_get.status_code == 200:
                    listing = resp_get.json().get("listing", {})
                    if listing.get("itemStatus") != disallowed_status:
                        print(f"  ✅ PATCH {disallowed_status}: listing status unchanged")
                    else:
                        print(f"  ❌ PATCH {disallowed_status}: listing status changed despite 403!")
            else:
                print(f"  ❌ PATCH {disallowed_status}: Expected 403, got {resp.status_code} - {resp.text[:100]}")
        except Exception as e:
            print(f"  ❌ PATCH {disallowed_status}: exception: {e}")
    
    # Step 7: Grandfathering test (set status outside allowed set, then move to allowed)
    print(f"\n[{role_name} - Step 7] Grandfathering test")
    if config["disallowed"]:
        # Use admin to set a disallowed status
        disallowed_status = config["disallowed"][0]
        try:
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            payload = {"itemStatus": disallowed_status}
            resp = requests.post(f"{API_BASE}/marketplace/{listing_id}/quick-status", json=payload, headers=admin_headers, timeout=10)
            
            if resp.status_code == 200:
                print(f"  ✅ Admin set status to {disallowed_status}")
                
                # Now as the seller, move to an allowed status
                allowed_status = config["allowed"][0]
                payload = {"itemStatus": allowed_status}
                resp = requests.post(f"{API_BASE}/marketplace/{listing_id}/quick-status", json=payload, headers=headers, timeout=10)
                
                if resp.status_code == 200:
                    data = resp.json()
                    listing = data.get("listing", {})
                    if listing.get("itemStatus") == allowed_status:
                        print(f"  ✅ Grandfathering works: moved from {disallowed_status} to {allowed_status}")
                    else:
                        print(f"  ❌ Grandfathering: status mismatch: {listing.get('itemStatus')}")
                else:
                    print(f"  ❌ Grandfathering: Expected 200, got {resp.status_code} - {resp.text[:100]}")
            else:
                print(f"  ⚠️  Admin couldn't set disallowed status: {resp.status_code}")
        except Exception as e:
            print(f"  ❌ Grandfathering exception: {e}")
    
    # Step 8: Staff bypass test
    print(f"\n[{role_name} - Step 8] Staff bypass test")
    if config["disallowed"]:
        disallowed_status = config["disallowed"][0]
        try:
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            payload = {"itemStatus": disallowed_status}
            resp = requests.patch(f"{API_BASE}/marketplace/{listing_id}", json=payload, headers=admin_headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                listing = data.get("listing", {})
                if listing.get("itemStatus") == disallowed_status:
                    print(f"  ✅ Staff bypass works: admin set {disallowed_status}")
                else:
                    print(f"  ❌ Staff bypass: status mismatch: {listing.get('itemStatus')}")
            else:
                print(f"  ❌ Staff bypass: Expected 200, got {resp.status_code} - {resp.text[:100]}")
        except Exception as e:
            print(f"  ❌ Staff bypass exception: {e}")

print("\n" + "=" * 80)
print("ALL TESTS COMPLETE")
print("=" * 80)
