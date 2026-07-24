#!/usr/bin/env python3
"""
P5 Contractor Time Clock Backend Test
Tests all time clock endpoints with contractor access gating
"""

import requests
import time
import json
from datetime import datetime

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials - super admin has contractor access via role
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def login(email, password):
    """Login and return auth token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("token")

def headers(token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {token}"}

print("=" * 80)
print("P5 CONTRACTOR TIME CLOCK BACKEND TEST")
print("=" * 80)

# ============================================================================
# TEST 1: Auth gating
# ============================================================================
print("\n✅ TEST 1: Auth gating")

# No auth header
resp = requests.get(f"{BASE_URL}/time-clock/current")
if resp.status_code == 401:
    print("  ✅ No auth → 401 'Auth required'")
else:
    print(f"  ❌ Expected 401, got {resp.status_code}: {resp.text}")

# Login as super admin (has contractor access)
token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
if not token:
    print("❌ CRITICAL: Cannot login as super admin")
    exit(1)
print(f"  ✅ Logged in as super admin")

# ============================================================================
# TEST 2: Clock in / out happy path
# ============================================================================
print("\n✅ TEST 2: Clock in / out happy path")

# Step 1: GET /current → should return { entry: null } for fresh state
resp = requests.get(f"{BASE_URL}/time-clock/current", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    if data.get("entry") is None or data.get("entry", {}).get("status") != "active":
        print("  ✅ Step 1: GET /current → no active entry")
    else:
        # Clean up leftover active entry
        entry_id = data["entry"]["id"]
        print(f"  ⚠️  Found leftover active entry {entry_id}, clocking out...")
        requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
        print("  ✅ Step 1: Cleaned up leftover entry")
else:
    print(f"  ❌ Step 1 failed: {resp.status_code} {resp.text}")

# Step 2: POST /clock-in
clock_in_data = {
    "jobLabel": "Demo cleanout — 3rd & Main",
    "notes": "backend test",
    "location": {"lat": 37.3382, "lng": -121.8863, "accuracy": 10}
}
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json=clock_in_data)
if resp.status_code == 201:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("status") == "active" and entry.get("clockInAt") and entry.get("clockOutAt") is None:
        entry_id = entry["id"]
        print(f"  ✅ Step 2: POST /clock-in → 201, entry.status='active', clockInAt set, clockOutAt=null")
        print(f"     Entry ID: {entry_id}")
    else:
        print(f"  ❌ Step 2: Unexpected entry state: {entry}")
else:
    print(f"  ❌ Step 2 failed: {resp.status_code} {resp.text}")
    exit(1)

# Step 3: POST /clock-in again → 409 "Already clocked in"
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json=clock_in_data)
if resp.status_code == 409:
    data = resp.json()
    if "Already clocked in" in data.get("error", ""):
        print("  ✅ Step 3: POST /clock-in again → 409 'Already clocked in'")
    else:
        print(f"  ❌ Step 3: Wrong error message: {data}")
else:
    print(f"  ❌ Step 3 failed: Expected 409, got {resp.status_code} {resp.text}")

# Step 4: GET /current → returns active entry with totalMinutes >= 0
resp = requests.get(f"{BASE_URL}/time-clock/current", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("status") == "active" and "totalMinutes" in entry:
        print(f"  ✅ Step 4: GET /current → active entry with totalMinutes={entry['totalMinutes']}")
    else:
        print(f"  ❌ Step 4: Unexpected entry: {entry}")
else:
    print(f"  ❌ Step 4 failed: {resp.status_code} {resp.text}")

# Step 5: Wait 2-3 seconds
print("  ⏳ Step 5: Waiting 3 seconds...")
time.sleep(3)

# Step 6: POST /clock-out
clock_out_data = {"notes": "test complete", "location": {"lat": 37.3382, "lng": -121.8863}}
resp = requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json=clock_out_data)
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("status") == "completed" and entry.get("clockOutAt") and "netMinutes" in entry:
        net_minutes = entry.get("netMinutes", 0)
        print(f"  ✅ Step 6: POST /clock-out → 200, status='completed', clockOutAt set, netMinutes={net_minutes}")
    else:
        print(f"  ❌ Step 6: Unexpected entry state: {entry}")
else:
    print(f"  ❌ Step 6 failed: {resp.status_code} {resp.text}")

# Step 7: POST /clock-out again → 404 "Not clocked in"
resp = requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
if resp.status_code == 404:
    data = resp.json()
    if "Not clocked in" in data.get("error", ""):
        print("  ✅ Step 7: POST /clock-out again → 404 'Not clocked in'")
    else:
        print(f"  ❌ Step 7: Wrong error message: {data}")
else:
    print(f"  ❌ Step 7 failed: Expected 404, got {resp.status_code} {resp.text}")

# ============================================================================
# TEST 3: Break flow
# ============================================================================
print("\n✅ TEST 3: Break flow")

# Step 1: POST /clock-in (fresh)
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"jobLabel": "Break test job"})
if resp.status_code == 201:
    data = resp.json()
    entry_id = data["entry"]["id"]
    print(f"  ✅ Step 1: POST /clock-in → 201, entry ID: {entry_id}")
else:
    print(f"  ❌ Step 1 failed: {resp.status_code} {resp.text}")
    exit(1)

# Step 2: POST /break/start with reason
resp = requests.post(f"{BASE_URL}/time-clock/break/start", headers=headers(token), json={"reason": "lunch"})
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    breaks = entry.get("breaks", [])
    if len(breaks) == 1 and breaks[0].get("endAt") is None and breaks[0].get("reason") == "lunch":
        print("  ✅ Step 2: POST /break/start → 200, break added with reason='lunch', endAt=null")
    else:
        print(f"  ❌ Step 2: Unexpected breaks: {breaks}")
else:
    print(f"  ❌ Step 2 failed: {resp.status_code} {resp.text}")

# Step 3: POST /break/start again → 409 "Break already in progress"
resp = requests.post(f"{BASE_URL}/time-clock/break/start", headers=headers(token), json={"reason": "another"})
if resp.status_code == 409:
    data = resp.json()
    if "Break already in progress" in data.get("error", ""):
        print("  ✅ Step 3: POST /break/start again → 409 'Break already in progress'")
    else:
        print(f"  ❌ Step 3: Wrong error message: {data}")
else:
    print(f"  ❌ Step 3 failed: Expected 409, got {resp.status_code} {resp.text}")

# Step 4: POST /break/end
resp = requests.post(f"{BASE_URL}/time-clock/break/end", headers=headers(token), json={})
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    breaks = entry.get("breaks", [])
    if len(breaks) == 1 and breaks[0].get("endAt") is not None:
        print("  ✅ Step 4: POST /break/end → 200, break endAt set")
    else:
        print(f"  ❌ Step 4: Unexpected breaks: {breaks}")
else:
    print(f"  ❌ Step 4 failed: {resp.status_code} {resp.text}")

# Step 5: POST /break/end again → 409 "No break in progress"
resp = requests.post(f"{BASE_URL}/time-clock/break/end", headers=headers(token), json={})
if resp.status_code == 409:
    data = resp.json()
    if "No break in progress" in data.get("error", ""):
        print("  ✅ Step 5: POST /break/end again → 409 'No break in progress'")
    else:
        print(f"  ❌ Step 5: Wrong error message: {data}")
else:
    print(f"  ❌ Step 5 failed: Expected 409, got {resp.status_code} {resp.text}")

# Step 6: POST /break/start (second break)
resp = requests.post(f"{BASE_URL}/time-clock/break/start", headers=headers(token), json={"reason": "coffee"})
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    breaks = entry.get("breaks", [])
    if len(breaks) == 2:
        print("  ✅ Step 6: POST /break/start (second break) → 200, 2 breaks total")
    else:
        print(f"  ❌ Step 6: Expected 2 breaks, got {len(breaks)}")
else:
    print(f"  ❌ Step 6 failed: {resp.status_code} {resp.text}")

# Step 7: POST /clock-out while on break → auto-close break
resp = requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    breaks = entry.get("breaks", [])
    if entry.get("status") == "completed" and len(breaks) == 2:
        # Check if last break is closed
        last_break = breaks[-1]
        clock_out_at = entry.get("clockOutAt")
        if last_break.get("endAt") is not None:
            print("  ✅ Step 7: POST /clock-out while on break → auto-closed break, status='completed'")
        else:
            print(f"  ❌ Step 7: Last break not auto-closed: {last_break}")
    else:
        print(f"  ❌ Step 7: Unexpected state: status={entry.get('status')}, breaks={len(breaks)}")
else:
    print(f"  ❌ Step 7 failed: {resp.status_code} {resp.text}")

# ============================================================================
# TEST 4: Entries list & filters
# ============================================================================
print("\n✅ TEST 4: Entries list & filters")

# Step 1: POST /clock-in then POST /clock-out (creates 1 completed entry)
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"jobLabel": "Filter test"})
if resp.status_code == 201:
    time.sleep(1)
    resp = requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
    if resp.status_code == 200:
        print("  ✅ Step 1: Created completed entry")
    else:
        print(f"  ❌ Step 1 clock-out failed: {resp.status_code}")
else:
    print(f"  ❌ Step 1 clock-in failed: {resp.status_code}")

# Step 2: GET /entries → array contains entries, sorted by clockInAt desc
resp = requests.get(f"{BASE_URL}/time-clock/entries", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    if len(entries) > 0:
        print(f"  ✅ Step 2: GET /entries → {len(entries)} entries returned")
    else:
        print(f"  ❌ Step 2: No entries returned")
else:
    print(f"  ❌ Step 2 failed: {resp.status_code} {resp.text}")

# Step 3: GET /entries?status=completed → only completed
resp = requests.get(f"{BASE_URL}/time-clock/entries?status=completed", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    all_completed = all(e.get("status") == "completed" for e in entries)
    if all_completed:
        print(f"  ✅ Step 3: GET /entries?status=completed → {len(entries)} completed entries")
    else:
        print(f"  ❌ Step 3: Not all entries are completed")
else:
    print(f"  ❌ Step 3 failed: {resp.status_code} {resp.text}")

# Step 4: GET /entries?status=active → empty (we just clocked out)
resp = requests.get(f"{BASE_URL}/time-clock/entries?status=active", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    if len(entries) == 0:
        print("  ✅ Step 4: GET /entries?status=active → empty")
    else:
        print(f"  ❌ Step 4: Expected empty, got {len(entries)} entries")
else:
    print(f"  ❌ Step 4 failed: {resp.status_code} {resp.text}")

# Step 5: GET /entries?from=2099-01-01 → empty
resp = requests.get(f"{BASE_URL}/time-clock/entries?from=2099-01-01", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    if len(entries) == 0:
        print("  ✅ Step 5: GET /entries?from=2099-01-01 → empty")
    else:
        print(f"  ❌ Step 5: Expected empty, got {len(entries)} entries")
else:
    print(f"  ❌ Step 5 failed: {resp.status_code} {resp.text}")

# Step 6: GET /entries?limit=1 → array length ≤ 1
resp = requests.get(f"{BASE_URL}/time-clock/entries?limit=1", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    if len(entries) <= 1:
        print(f"  ✅ Step 6: GET /entries?limit=1 → {len(entries)} entries")
    else:
        print(f"  ❌ Step 6: Expected ≤1, got {len(entries)} entries")
else:
    print(f"  ❌ Step 6 failed: {resp.status_code} {resp.text}")

# ============================================================================
# TEST 5: Single entry, edit, delete
# ============================================================================
print("\n✅ TEST 5: Single entry, edit, delete")

# Get an entry id from list
resp = requests.get(f"{BASE_URL}/time-clock/entries?limit=1", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    entries = data.get("entries", [])
    if len(entries) > 0:
        test_entry_id = entries[0]["id"]
        print(f"  ✅ Using entry ID: {test_entry_id}")
    else:
        print("  ❌ No entries to test with")
        exit(1)
else:
    print(f"  ❌ Failed to get entries: {resp.status_code}")
    exit(1)

# Step 1: GET /entries/:id → 200
resp = requests.get(f"{BASE_URL}/time-clock/entries/{test_entry_id}", headers=headers(token))
if resp.status_code == 200:
    print("  ✅ Step 1: GET /entries/:id → 200")
else:
    print(f"  ❌ Step 1 failed: {resp.status_code} {resp.text}")

# Step 2: PATCH /entries/:id with notes and jobLabel
patch_data = {"notes": "updated note", "jobLabel": "New label"}
resp = requests.patch(f"{BASE_URL}/time-clock/entries/{test_entry_id}", headers=headers(token), json=patch_data)
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("notes") == "updated note" and entry.get("jobLabel") == "New label":
        print("  ✅ Step 2: PATCH /entries/:id → 200, fields updated")
    else:
        print(f"  ❌ Step 2: Fields not updated correctly: {entry}")
else:
    print(f"  ❌ Step 2 failed: {resp.status_code} {resp.text}")

# Step 3: PATCH /entries/:id with empty body → 400 "No editable fields provided"
resp = requests.patch(f"{BASE_URL}/time-clock/entries/{test_entry_id}", headers=headers(token), json={})
if resp.status_code == 400:
    data = resp.json()
    if "No editable fields provided" in data.get("error", ""):
        print("  ✅ Step 3: PATCH with {} → 400 'No editable fields provided'")
    else:
        print(f"  ❌ Step 3: Wrong error message: {data}")
else:
    print(f"  ❌ Step 3 failed: Expected 400, got {resp.status_code} {resp.text}")

# Step 4: POST /entries/:id/submit → 200, status="submitted"
resp = requests.post(f"{BASE_URL}/time-clock/entries/{test_entry_id}/submit", headers=headers(token), json={})
if resp.status_code == 200:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("status") == "submitted":
        print("  ✅ Step 4: POST /entries/:id/submit → 200, status='submitted'")
    else:
        print(f"  ❌ Step 4: Expected status='submitted', got {entry.get('status')}")
else:
    print(f"  ❌ Step 4 failed: {resp.status_code} {resp.text}")

# Step 5: POST /entries/:id/submit on active entry → 400 "Clock out before submitting"
# First create an active entry
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"jobLabel": "Active test"})
if resp.status_code == 201:
    active_entry_id = resp.json()["entry"]["id"]
    resp = requests.post(f"{BASE_URL}/time-clock/entries/{active_entry_id}/submit", headers=headers(token), json={})
    if resp.status_code == 400:
        data = resp.json()
        if "Clock out before submitting" in data.get("error", ""):
            print("  ✅ Step 5: POST submit on active entry → 400 'Clock out before submitting'")
        else:
            print(f"  ❌ Step 5: Wrong error message: {data}")
    else:
        print(f"  ❌ Step 5 failed: Expected 400, got {resp.status_code} {resp.text}")
    # Clean up
    requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
else:
    print(f"  ❌ Step 5 setup failed: {resp.status_code}")

# Step 6: DELETE /entries/:id → 200, then GET → 404
resp = requests.delete(f"{BASE_URL}/time-clock/entries/{test_entry_id}", headers=headers(token))
if resp.status_code == 200:
    # Verify it's deleted
    resp = requests.get(f"{BASE_URL}/time-clock/entries/{test_entry_id}", headers=headers(token))
    if resp.status_code == 404:
        print("  ✅ Step 6: DELETE /entries/:id → 200, then GET → 404")
    else:
        print(f"  ❌ Step 6: Expected 404 after delete, got {resp.status_code}")
else:
    print(f"  ❌ Step 6 failed: {resp.status_code} {resp.text}")

# ============================================================================
# TEST 6: Summary
# ============================================================================
print("\n✅ TEST 6: Summary")

# Create at least one ~1-minute entry
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"jobLabel": "Summary test"})
if resp.status_code == 201:
    time.sleep(2)
    resp = requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
    if resp.status_code == 200:
        print("  ✅ Created test entry for summary")
    else:
        print(f"  ❌ Clock-out failed: {resp.status_code}")
else:
    print(f"  ❌ Clock-in failed: {resp.status_code}")

# GET /summary
resp = requests.get(f"{BASE_URL}/time-clock/summary", headers=headers(token))
if resp.status_code == 200:
    data = resp.json()
    today = data.get("today", {})
    week = data.get("week", {})
    by_job = data.get("byJob", [])
    
    # Verify shape
    required_today = ["date", "total", "net", "breaks", "entries"]
    required_week = ["from", "to", "total", "net", "breaks", "daysWorked", "entries"]
    
    has_today = all(k in today for k in required_today)
    has_week = all(k in week for k in required_week)
    
    if has_today and has_week:
        print(f"  ✅ GET /summary → correct shape")
        print(f"     today.entries={today.get('entries')}, week.entries={week.get('entries')}")
        print(f"     byJob count={len(by_job)}")
        
        if today.get("entries", 0) >= 1 and week.get("entries", 0) >= 1:
            print("  ✅ today.entries >= 1, week.entries >= 1")
        else:
            print(f"  ⚠️  today.entries={today.get('entries')}, week.entries={week.get('entries')}")
        
        if len(by_job) > 0:
            print(f"  ✅ byJob contains {len(by_job)} job(s)")
        else:
            print("  ⚠️  byJob is empty")
    else:
        print(f"  ❌ Missing required fields in summary")
        print(f"     today: {today}")
        print(f"     week: {week}")
else:
    print(f"  ❌ GET /summary failed: {resp.status_code} {resp.text}")

# ============================================================================
# TEST 7: Validation edge cases
# ============================================================================
print("\n✅ TEST 7: Validation edge cases")

# Step 1: POST /clock-in with invalid location (lat: "abc") → location ignored, locationIn=null
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"location": {"lat": "abc"}})
if resp.status_code == 201:
    data = resp.json()
    entry = data.get("entry", {})
    if entry.get("locationIn") is None:
        print("  ✅ Step 1: Invalid location → locationIn=null (no 500)")
    else:
        print(f"  ⚠️  Step 1: locationIn={entry.get('locationIn')} (expected null)")
    # Clean up
    requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
else:
    print(f"  ❌ Step 1 failed: {resp.status_code} {resp.text}")

# Step 2: POST /clock-in with extremely long jobLabel (1000 chars) → truncated to 160
long_label = "A" * 1000
resp = requests.post(f"{BASE_URL}/time-clock/clock-in", headers=headers(token), json={"jobLabel": long_label})
if resp.status_code == 201:
    data = resp.json()
    entry = data.get("entry", {})
    job_label = entry.get("jobLabel", "")
    if len(job_label) == 160:
        print("  ✅ Step 2: Long jobLabel → truncated to 160 chars")
    else:
        print(f"  ⚠️  Step 2: jobLabel length={len(job_label)} (expected 160)")
    # Clean up
    requests.post(f"{BASE_URL}/time-clock/clock-out", headers=headers(token), json={})
else:
    print(f"  ❌ Step 2 failed: {resp.status_code} {resp.text}")

# Step 3: POST /entries/:id/submit on non-existent id → 404
resp = requests.post(f"{BASE_URL}/time-clock/entries/nonexistent-id-12345/submit", headers=headers(token), json={})
if resp.status_code == 404:
    print("  ✅ Step 3: Submit non-existent entry → 404")
else:
    print(f"  ❌ Step 3 failed: Expected 404, got {resp.status_code} {resp.text}")

print("\n" + "=" * 80)
print("✅ ALL P5 TIME CLOCK TESTS COMPLETE")
print("=" * 80)
