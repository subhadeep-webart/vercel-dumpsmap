#!/usr/bin/env python3
"""
OCR Receipt Scanner Backend Test Suite
Tests POST /api/receipts/scan with Gemini 2.5 Flash via Emergent LLM key.

Test credentials:
- Super admin: jamal@dumpmaps.org / @@Jefferson2180
"""

import requests
import os
import io
from PIL import Image, ImageDraw, ImageFont

# Load environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

# Test results
passed = 0
failed = 0

def print_test(num, desc):
    print(f"\n{'='*80}")
    print(f"TEST {num}: {desc}")
    print('='*80)

def print_pass(msg):
    global passed
    passed += 1
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    global failed
    failed += 1
    print(f"❌ FAIL: {msg}")

def generate_receipt_image(text_lines, width=600, height=800):
    """Generate a synthetic receipt image with PIL"""
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except:
        font = ImageFont.load_default()
        font_bold = ImageFont.load_default()
    
    y = 30
    for i, line in enumerate(text_lines):
        if i == 0:  # First line (facility name) in bold
            draw.text((20, y), line, fill='black', font=font_bold)
        else:
            draw.text((20, y), line, fill='black', font=font)
        y += 25
    
    return img

def image_to_bytes(img, format='PNG'):
    """Convert PIL image to bytes"""
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.read()

def login(email, password):
    """Login and return JWT token"""
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": email,
        "password": password
    })
    if resp.status_code == 200:
        data = resp.json()
        return data.get('token')
    return None

# ============================================================================
# TEST 1: POST /api/receipts/scan (no auth) → 401
# ============================================================================
print_test(1, "POST /api/receipts/scan (no auth) → 401")
try:
    resp = requests.post(f"{API_BASE}/receipts/scan")
    if resp.status_code == 401:
        body = resp.json()
        if 'error' in body:
            print_pass(f"401 with error key: {body.get('error')}")
        else:
            print_fail(f"401 but no 'error' key in body: {body}")
    else:
        print_fail(f"Expected 401, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")

# ============================================================================
# TEST 2: Login as jamal@dumpmaps.org → get JWT token
# ============================================================================
print_test(2, "Login as super admin (jamal@dumpmaps.org)")
try:
    token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if token:
        print_pass(f"Login successful, token: {token[:20]}...")
        headers = {"Authorization": f"Bearer {token}"}
    else:
        print_fail("Login failed, no token returned")
        headers = {}
except Exception as e:
    print_fail(f"Exception: {e}")
    headers = {}

# ============================================================================
# TEST 3: POST /api/receipts/scan (auth=jamal, NO file) → 400
# ============================================================================
print_test(3, "POST /api/receipts/scan (auth, empty multipart) → 400")
try:
    # Send empty multipart/form-data
    resp = requests.post(f"{API_BASE}/receipts/scan", headers=headers, files={})
    if resp.status_code == 400:
        body = resp.json()
        error_msg = body.get('error', '')
        if 'multipart' in error_msg.lower() or 'no file' in error_msg.lower():
            print_pass(f"400 with expected error: {error_msg}")
        else:
            print_pass(f"400 (acceptable): {error_msg}")
    else:
        print_fail(f"Expected 400, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")

# ============================================================================
# TEST 4: POST /api/receipts/scan (auth=jamal, with synthetic receipt PNG)
# ============================================================================
print_test(4, "POST /api/receipts/scan (auth, synthetic receipt PNG) → 200")
try:
    # Generate synthetic receipt
    receipt_lines = [
        "SUNSHINE TRANSFER STATION",
        "1234 Recycle Way",
        "Oakland, CA 94601",
        "",
        "Date: 2026-06-05",
        "Time In: 10:32",
        "Time Out: 10:47",
        "Ticket #: 778921",
        "",
        "Vehicle: TRUCK-12  LP: 8FAB123",
        "",
        "Gross Weight:   8,240 lb",
        "Tare Weight:    4,120 lb",
        "Net Weight:     4,120 lb",
        "Net Tons:       2.06",
        "",
        "Material: C&D (Construction Debris)",
        "Price/Ton: $58.00",
        "",
        "TOTAL DUE:    $119.48",
        "Payment: VISA  XXXX-4242",
    ]
    
    img = generate_receipt_image(receipt_lines)
    img_bytes = image_to_bytes(img, 'PNG')
    
    files = {'file': ('receipt.png', img_bytes, 'image/png')}
    resp = requests.post(f"{API_BASE}/receipts/scan", headers=headers, files=files)
    
    if resp.status_code == 200:
        body = resp.json()
        print(f"Response body keys: {list(body.keys())}")
        
        # Check response shape
        if body.get('ok') == True:
            print_pass("Response has ok=true")
        else:
            print_fail(f"Expected ok=true, got: {body.get('ok')}")
        
        # Check draft
        draft = body.get('draft', {})
        if draft:
            print_pass(f"Draft present with {len(draft)} fields")
            
            # Check required keys
            required_keys = ['facilityName', 'dateOf', 'grossLb', 'tareLb', 'netLb', 
                           'netTons', 'totalCost', 'paymentMethod', 'materialType', 
                           'loadType', 'ticketNumber', 'vehicleNumber']
            missing = [k for k in required_keys if k not in draft]
            if not missing:
                print_pass(f"All required draft keys present: {required_keys}")
            else:
                print_fail(f"Missing draft keys: {missing}")
            
            # Check facilityName contains "SUNSHINE"
            facility_name = draft.get('facilityName', '')
            if 'sunshine' in facility_name.lower():
                print_pass(f"facilityName contains 'SUNSHINE': {facility_name}")
            else:
                print_fail(f"facilityName doesn't contain 'SUNSHINE': {facility_name}")
            
            # Check totalCost approximately 119.48 (within ±5)
            total_cost = draft.get('totalCost', 0)
            if abs(total_cost - 119.48) <= 5:
                print_pass(f"totalCost approximately 119.48: {total_cost}")
            else:
                print_fail(f"totalCost not close to 119.48: {total_cost}")
        else:
            print_fail("No draft in response")
        
        # Check ocr metadata
        ocr = body.get('ocr', {})
        if ocr:
            print_pass(f"OCR metadata present")
            
            # Check provider
            if ocr.get('provider') == 'emergent/gemini':
                print_pass(f"provider: {ocr.get('provider')}")
            else:
                print_fail(f"Expected provider 'emergent/gemini', got: {ocr.get('provider')}")
            
            # Check model
            if ocr.get('model') == 'gemini/gemini-2.5-flash':
                print_pass(f"model: {ocr.get('model')}")
            else:
                print_fail(f"Expected model 'gemini/gemini-2.5-flash', got: {ocr.get('model')}")
            
            # Check confidence (0-100)
            confidence = ocr.get('confidence', -1)
            if 0 <= confidence <= 100:
                print_pass(f"confidence in range [0-100]: {confidence}")
            else:
                print_fail(f"confidence out of range: {confidence}")
            
            # Check elapsedMs < 30000
            elapsed_ms = ocr.get('elapsedMs', 999999)
            if elapsed_ms < 30000:
                print_pass(f"elapsedMs < 30000: {elapsed_ms} ms")
            else:
                print_fail(f"elapsedMs >= 30000: {elapsed_ms} ms")
            
            # Check photoUrl starts with '/api/files/'
            photo_url = ocr.get('photoUrl', '')
            if photo_url.startswith('/api/files/'):
                print_pass(f"photoUrl starts with '/api/files/': {photo_url}")
                # Save for later tests
                global saved_photo_url
                saved_photo_url = photo_url
            else:
                print_fail(f"photoUrl doesn't start with '/api/files/': {photo_url}")
        else:
            print_fail("No ocr metadata in response")
    else:
        print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:500]}")
except Exception as e:
    print_fail(f"Exception: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 5: POST /api/receipts/scan (text file pretending to be image) → 415 or 400
# ============================================================================
print_test(5, "POST /api/receipts/scan (text file as image) → 415 or 400")
try:
    text_content = b"This is not an image, just plain text"
    files = {'file': ('fake.txt', text_content, 'text/plain')}
    resp = requests.post(f"{API_BASE}/receipts/scan", headers=headers, files=files)
    
    if resp.status_code in [415, 400]:
        print_pass(f"{resp.status_code} (expected): {resp.json().get('error', '')}")
    else:
        print_fail(f"Expected 415 or 400, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")

# ============================================================================
# TEST 6: POST /api/receipts/scan (oversized file > 8 MB) → 413
# ============================================================================
print_test(6, "POST /api/receipts/scan (oversized file > 8 MB) → 413")
try:
    # Generate a large PNG (> 8 MB)
    large_img = Image.new('RGB', (3000, 3000), color='white')
    large_bytes = image_to_bytes(large_img, 'PNG')
    
    # If not large enough, pad it
    if len(large_bytes) < 8 * 1024 * 1024:
        large_bytes = large_bytes + b'\x00' * (8 * 1024 * 1024 + 1000)
    
    print(f"Generated file size: {len(large_bytes) / (1024*1024):.2f} MB")
    
    files = {'file': ('large.png', large_bytes, 'image/png')}
    resp = requests.post(f"{API_BASE}/receipts/scan", headers=headers, files=files)
    
    if resp.status_code == 413:
        print_pass(f"413 (expected): {resp.json().get('error', '')}")
    else:
        print_fail(f"Expected 413, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")

# ============================================================================
# TEST 7: GET /api/admin/feature-flags (auth=jamal) → verify ocrReceiptScanner
# ============================================================================
print_test(7, "GET /api/admin/feature-flags → verify ocrReceiptScanner")
try:
    resp = requests.get(f"{API_BASE}/admin/feature-flags", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        
        # Handle both list and dict responses
        if isinstance(data, dict):
            flags = data.get('flags', [data])  # Might be wrapped or single object
        else:
            flags = data
        
        ocr_flag = None
        for f in flags:
            if isinstance(f, dict) and f.get('key') == 'ocrReceiptScanner':
                ocr_flag = f
                break
        
        if ocr_flag:
            print_pass(f"Found ocrReceiptScanner flag")
            
            # Check globalStatus='beta'
            if ocr_flag.get('globalStatus') == 'beta':
                print_pass(f"globalStatus='beta'")
            else:
                print_fail(f"Expected globalStatus='beta', got: {ocr_flag.get('globalStatus')}")
            
            # Check requiredMembershipTier
            if ocr_flag.get('requiredMembershipTier') == 'verified_commercial':
                print_pass(f"requiredMembershipTier='verified_commercial'")
            else:
                print_fail(f"Expected requiredMembershipTier='verified_commercial', got: {ocr_flag.get('requiredMembershipTier')}")
        else:
            print_fail(f"ocrReceiptScanner flag not found. Response type: {type(data)}, flags: {flags[:2] if isinstance(flags, list) else 'not a list'}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 8: GET /api/me/feature-access (auth=jamal) → verify ocrReceiptScanner allowed
# ============================================================================
print_test(8, "GET /api/me/feature-access → verify ocrReceiptScanner allowed")
try:
    resp = requests.get(f"{API_BASE}/me/feature-access", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        access = data.get('access', {})
        ocr_access = access.get('ocrReceiptScanner', {})
        
        if ocr_access:
            print_pass(f"Found ocrReceiptScanner access")
            
            # Check allowed=true
            if ocr_access.get('allowed') == True:
                print_pass(f"allowed=true (super_admin bypass)")
            else:
                print_fail(f"Expected allowed=true, got: {ocr_access.get('allowed')}")
        else:
            print_fail("ocrReceiptScanner access not found")
    else:
        print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print_fail(f"Exception: {e}")

# ============================================================================
# TEST 9: Create non-admin user and test 403 (SKIP if signup complex)
# ============================================================================
print_test(9, "Non-admin user POST /api/receipts/scan → 403 (SKIP if signup complex)")
try:
    # Try to create a test user
    test_email = f"test_ocr_{os.urandom(4).hex()}@test.com"
    test_password = "testpass123"
    
    signup_resp = requests.post(f"{API_BASE}/auth/signup", json={
        "email": test_email,
        "password": test_password,
        "name": "Test OCR User"
    })
    
    if signup_resp.status_code in [200, 201]:
        # Login as test user
        test_token = login(test_email, test_password)
        if test_token:
            test_headers = {"Authorization": f"Bearer {test_token}"}
            
            # Try to scan receipt
            img = generate_receipt_image(["Test Receipt"])
            img_bytes = image_to_bytes(img, 'PNG')
            files = {'file': ('test.png', img_bytes, 'image/png')}
            
            scan_resp = requests.post(f"{API_BASE}/receipts/scan", headers=test_headers, files=files)
            
            if scan_resp.status_code == 403:
                body = scan_resp.json()
                reason = body.get('reason', '')
                if 'beta' in reason.lower() or 'grant' in reason.lower() or 'tier' in reason.lower():
                    print_pass(f"403 with expected reason: {reason}")
                else:
                    print_pass(f"403 (acceptable): {reason}")
            else:
                print_fail(f"Expected 403, got {scan_resp.status_code}: {scan_resp.text[:200]}")
        else:
            print_fail("Test user login failed")
    else:
        print(f"⚠️  SKIP: Signup failed or requires verification ({signup_resp.status_code})")
        print(f"   This is acceptable - calling it out as requested")
except Exception as e:
    print(f"⚠️  SKIP: Exception during non-admin test: {e}")
    print(f"   This is acceptable - calling it out as requested")

# ============================================================================
# TEST 10: Verify ocr_scans collection has a row from test 4
# ============================================================================
print_test(10, "Verify ocr_scans MongoDB collection has scan record")
try:
    from pymongo import MongoClient
    
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'dumpmaps')
    
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    # Find most recent ocr_scan
    scan = db.ocr_scans.find_one(sort=[('createdAt', -1)])
    
    if scan:
        print_pass(f"Found ocr_scan record: id={scan.get('id')}")
        
        # Check fields
        if scan.get('model') == 'gemini/gemini-2.5-flash':
            print_pass(f"model: {scan.get('model')}")
        else:
            print_fail(f"Expected model 'gemini/gemini-2.5-flash', got: {scan.get('model')}")
        
        if scan.get('provider') == 'emergent/gemini':
            print_pass(f"provider: {scan.get('provider')}")
        else:
            print_fail(f"Expected provider 'emergent/gemini', got: {scan.get('provider')}")
        
        if scan.get('ok') == True:
            print_pass(f"ok=true")
        else:
            print_fail(f"Expected ok=true, got: {scan.get('ok')}")
        
        elapsed_ms = scan.get('elapsedMs', 999999)
        if elapsed_ms < 30000:
            print_pass(f"elapsedMs < 30000: {elapsed_ms} ms")
        else:
            print_fail(f"elapsedMs >= 30000: {elapsed_ms} ms")
        
        if scan.get('userId'):
            print_pass(f"userId present: {scan.get('userId')}")
        else:
            print_fail("userId missing")
    else:
        print_fail("No ocr_scan records found in MongoDB")
    
    client.close()
except Exception as e:
    print_fail(f"Exception: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*80)
print("TEST SUMMARY")
print("="*80)
print(f"✅ PASSED: {passed}")
print(f"❌ FAILED: {failed}")
print(f"TOTAL: {passed + failed}")
print("="*80)

if failed == 0:
    print("\n🎉 ALL TESTS PASSED!")
else:
    print(f"\n⚠️  {failed} test(s) failed")

exit(0 if failed == 0 else 1)
