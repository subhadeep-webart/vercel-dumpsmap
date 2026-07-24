#!/usr/bin/env python3
"""
TIME CLOCK 2.0 Backend Test Suite
Tests all new endpoints: settings, manual entries, rounding, auto-break, 
duplicate, CSV export, email payload, manager queue, approve/reject
"""

import requests
import json
from datetime import datetime, timedelta
import sys

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
EMAIL = "jamal@dumpmaps.org"
PASSWORD = "@@Jefferson2180"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_login():
    """Login and get auth token"""
    log("TEST: Login")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data, "No token in response"
    log("✅ Login successful")
    return data["token"]

def test_settings_get(token):
    """Test GET /api/time-clock/settings - should return defaults"""
    log("\n=== TEST 1: GET /api/time-clock/settings (defaults) ===")
    r = requests.get(f"{BASE_URL}/time-clock/settings", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"GET settings failed: {r.status_code} {r.text}"
    data = r.json()
    assert "settings" in data, "No settings in response"
    s = data["settings"]
    log(f"Settings: roundToMinutes={s.get('roundToMinutes')}, roundDirection={s.get('roundDirection')}, autoBreakMinutes={s.get('autoBreakMinutes')}")
    assert s.get("roundToMinutes") in [1, 5, 10, 15, 30], f"Invalid roundToMinutes: {s.get('roundToMinutes')}"
    assert s.get("roundDirection") in ["nearest", "up", "down"], f"Invalid roundDirection: {s.get('roundDirection')}"
    log("✅ GET settings returns valid defaults")
    return s

def test_settings_patch_valid(token):
    """Test PATCH /api/time-clock/settings with valid values"""
    log("\n=== TEST 2: PATCH /api/time-clock/settings (valid values) ===")
    payload = {
        "roundToMinutes": 15,
        "roundDirection": "nearest",
        "autoBreakMinutes": 30,
        "defaultRate": 25,
        "managerEmail": "manager@test.com"
    }
    r = requests.patch(f"{BASE_URL}/time-clock/settings", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
    data = r.json()
    s = data["settings"]
    assert s["roundToMinutes"] == 15, f"roundToMinutes not updated: {s['roundToMinutes']}"
    assert s["roundDirection"] == "nearest", f"roundDirection not updated: {s['roundDirection']}"
    assert s["autoBreakMinutes"] == 30, f"autoBreakMinutes not updated: {s['autoBreakMinutes']}"
    assert s["defaultRate"] == 25, f"defaultRate not updated: {s['defaultRate']}"
    assert s["managerEmail"] == "manager@test.com", f"managerEmail not updated: {s['managerEmail']}"
    log("✅ PATCH settings with valid values successful")
    return s

def test_settings_patch_invalid_round(token):
    """Test PATCH with invalid roundToMinutes (should fallback to 1)"""
    log("\n=== TEST 3: PATCH /api/time-clock/settings (invalid roundToMinutes=7) ===")
    r = requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundToMinutes": 7}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
    s = r.json()["settings"]
    assert s["roundToMinutes"] == 1, f"Expected fallback to 1, got {s['roundToMinutes']}"
    log("✅ Invalid roundToMinutes falls back to 1")

def test_settings_patch_invalid_direction(token):
    """Test PATCH with invalid roundDirection (should fallback to 'nearest')"""
    log("\n=== TEST 4: PATCH /api/time-clock/settings (invalid roundDirection='random') ===")
    r = requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundDirection": "random"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"PATCH settings failed: {r.status_code} {r.text}"
    s = r.json()["settings"]
    assert s["roundDirection"] == "nearest", f"Expected fallback to 'nearest', got {s['roundDirection']}"
    log("✅ Invalid roundDirection falls back to 'nearest'")

def test_rounding_up(token):
    """Test rounding with roundDirection='up'"""
    log("\n=== TEST 5: Rounding rules - roundDirection='up' ===")
    # Set rounding: 15min, up
    requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundToMinutes": 15, "roundDirection": "up"}, headers={"Authorization": f"Bearer {token}"})
    
    # Create manual entry: 10:00 -> 10:23 (23 minutes)
    now = datetime.now()
    clock_in = now.replace(hour=10, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=10, minute=23, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    entry_id = entry["id"]
    
    log(f"Entry created: netMinutesRaw={entry.get('netMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    assert entry.get("netMinutesRaw") == 23, f"Expected netMinutesRaw=23, got {entry.get('netMinutesRaw')}"
    assert entry.get("netMinutes") == 30, f"Expected netMinutes=30 (rounded up), got {entry.get('netMinutes')}"
    log("✅ Rounding up: 23 minutes -> 30 minutes")
    return entry_id

def test_rounding_down(token, entry_id):
    """Test rounding with roundDirection='down'"""
    log("\n=== TEST 6: Rounding rules - roundDirection='down' ===")
    # Change rounding to 'down'
    requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundDirection": "down"}, headers={"Authorization": f"Bearer {token}"})
    
    # Fetch the same entry - should recompute with new rounding
    r = requests.get(f"{BASE_URL}/time-clock/entries/{entry_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"GET entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    log(f"Entry after rounding change: netMinutesRaw={entry.get('netMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    assert entry.get("netMinutes") == 15, f"Expected netMinutes=15 (rounded down), got {entry.get('netMinutes')}"
    log("✅ Rounding down: 23 minutes -> 15 minutes")

def test_rounding_nearest(token, entry_id):
    """Test rounding with roundDirection='nearest'"""
    log("\n=== TEST 7: Rounding rules - roundDirection='nearest' ===")
    # Change rounding to 'nearest'
    requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundDirection": "nearest"}, headers={"Authorization": f"Bearer {token}"})
    
    # Fetch the same entry
    r = requests.get(f"{BASE_URL}/time-clock/entries/{entry_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"GET entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    log(f"Entry after rounding change: netMinutesRaw={entry.get('netMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    # 23 rounds to 30 (nearest 15-min interval, since 22.5 is midpoint)
    assert entry.get("netMinutes") == 30, f"Expected netMinutes=30 (rounded nearest), got {entry.get('netMinutes')}"
    log("✅ Rounding nearest: 23 minutes -> 30 minutes")

def test_rounding_none(token, entry_id):
    """Test with roundToMinutes=1 (no rounding)"""
    log("\n=== TEST 8: Rounding rules - roundToMinutes=1 (no rounding) ===")
    # Change rounding to 1 (no rounding)
    requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundToMinutes": 1}, headers={"Authorization": f"Bearer {token}"})
    
    # Fetch the same entry
    r = requests.get(f"{BASE_URL}/time-clock/entries/{entry_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"GET entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    log(f"Entry after rounding change: netMinutesRaw={entry.get('netMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    assert entry.get("netMinutes") == 23, f"Expected netMinutes=23 (no rounding), got {entry.get('netMinutes')}"
    log("✅ No rounding: 23 minutes -> 23 minutes")

def test_auto_break_long_shift(token):
    """Test auto-break for 8-hour shift"""
    log("\n=== TEST 9: Auto-break - 8-hour shift ===")
    # Set auto-break to 30 minutes
    requests.patch(f"{BASE_URL}/time-clock/settings", json={"roundToMinutes": 1, "autoBreakMinutes": 30}, headers={"Authorization": f"Bearer {token}"})
    
    # Create manual entry: 09:00 -> 17:00 (8 hours = 480 minutes)
    now = datetime.now()
    clock_in = now.replace(hour=9, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=17, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    log(f"8-hour entry: totalMinutesRaw={entry.get('totalMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    assert entry.get("totalMinutesRaw") == 480, f"Expected totalMinutesRaw=480, got {entry.get('totalMinutesRaw')}"
    assert entry.get("netMinutes") == 450, f"Expected netMinutes=450 (480-30), got {entry.get('netMinutes')}"
    log("✅ Auto-break applied: 480 minutes -> 450 minutes (30-min break deducted)")
    return entry["id"]

def test_auto_break_short_shift(token):
    """Test auto-break NOT applied for short shift (<60 min)"""
    log("\n=== TEST 10: Auto-break - short shift (45 minutes) ===")
    # Auto-break still set to 30 minutes
    
    # Create manual entry: 10:00 -> 10:45 (45 minutes)
    now = datetime.now()
    clock_in = now.replace(hour=10, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=10, minute=45, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    log(f"45-min entry: totalMinutesRaw={entry.get('totalMinutesRaw')}, netMinutes={entry.get('netMinutes')}")
    assert entry.get("totalMinutesRaw") == 45, f"Expected totalMinutesRaw=45, got {entry.get('totalMinutesRaw')}"
    assert entry.get("netMinutes") == 45, f"Expected netMinutes=45 (no auto-break), got {entry.get('netMinutes')}"
    log("✅ Auto-break NOT applied for short shift: 45 minutes -> 45 minutes")
    return entry["id"]

def test_manual_entry_validation_no_body(token):
    """Test POST /api/time-clock/entries with no body"""
    log("\n=== TEST 11: Manual entry validation - no body ===")
    r = requests.post(f"{BASE_URL}/time-clock/entries", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    data = r.json()
    assert "clockInAt and clockOutAt" in data.get("error", ""), f"Expected error message about clockInAt/clockOutAt, got: {data.get('error')}"
    log("✅ Manual entry without clockInAt/clockOutAt rejected with 400")

def test_manual_entry_validation_clockout_before_clockin(token):
    """Test POST with clockOutAt <= clockInAt"""
    log("\n=== TEST 12: Manual entry validation - clockOut <= clockIn ===")
    now = datetime.now()
    clock_in = now.replace(hour=10, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=9, minute=0, second=0, microsecond=0)  # Before clock_in
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    data = r.json()
    assert "clockOutAt must be after clockInAt" in data.get("error", ""), f"Expected error about clockOutAt, got: {data.get('error')}"
    log("✅ Manual entry with clockOut <= clockIn rejected with 400")

def test_manual_entry_with_work_fields(token):
    """Test POST with all work fields"""
    log("\n=== TEST 13: Manual entry with all work fields ===")
    now = datetime.now()
    clock_in = now.replace(hour=8, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=12, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat(),
        "jobLabel": "Demolition Project",
        "workOrderLabel": "WO-12345",
        "vehicleLabel": "Truck #7",
        "facilityName": "Zanker Recycling",
        "notes": "Hauled 5 loads of concrete"
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    assert entry.get("jobLabel") == "Demolition Project", f"jobLabel not persisted"
    assert entry.get("workOrderLabel") == "WO-12345", f"workOrderLabel not persisted"
    assert entry.get("vehicleLabel") == "Truck #7", f"vehicleLabel not persisted"
    assert entry.get("facilityName") == "Zanker Recycling", f"facilityName not persisted"
    assert entry.get("notes") == "Hauled 5 loads of concrete", f"notes not persisted"
    log("✅ Manual entry with all work fields persisted correctly")
    return entry["id"]

def test_patch_editing_completed_entry(token, entry_id):
    """Test PATCH editing a completed entry"""
    log("\n=== TEST 14: PATCH editing completed entry ===")
    now = datetime.now()
    new_clock_in = now.replace(hour=7, minute=30, second=0, microsecond=0)
    new_clock_out = now.replace(hour=11, minute=30, second=0, microsecond=0)
    
    payload = {
        "clockInAt": new_clock_in.isoformat(),
        "clockOutAt": new_clock_out.isoformat(),
        "notes": "Updated notes"
    }
    r = requests.patch(f"{BASE_URL}/time-clock/entries/{entry_id}", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"PATCH entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    assert entry.get("notes") == "Updated notes", f"notes not updated"
    assert "editHistory" in entry, "editHistory not present"
    assert len(entry["editHistory"]) > 0, "editHistory is empty"
    log(f"✅ PATCH editing successful, editHistory has {len(entry['editHistory'])} entries")

def test_patch_editing_with_breaks(token, entry_id):
    """Test PATCH adding breaks array"""
    log("\n=== TEST 15: PATCH adding breaks array ===")
    now = datetime.now()
    break_start = now.replace(hour=10, minute=0, second=0, microsecond=0)
    break_end = now.replace(hour=10, minute=15, second=0, microsecond=0)
    
    payload = {
        "breaks": [
            {
                "startAt": break_start.isoformat(),
                "endAt": break_end.isoformat(),
                "reason": "Lunch"
            }
        ]
    }
    r = requests.patch(f"{BASE_URL}/time-clock/entries/{entry_id}", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"PATCH entry failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    
    assert "breaks" in entry, "breaks not present"
    assert len(entry["breaks"]) > 0, "breaks array is empty"
    log(f"✅ PATCH with breaks successful, breakMinutes={entry.get('breakMinutes')}")

def test_patch_active_entry_blocked(token):
    """Test PATCH clock times on active entry (should be blocked)"""
    log("\n=== TEST 16: PATCH clock times on active entry (should fail) ===")
    # Clock in first
    r = requests.post(f"{BASE_URL}/time-clock/clock-in", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Clock in failed: {r.status_code} {r.text}"
    entry = r.json()["entry"]
    entry_id = entry["id"]
    
    # Try to PATCH clockInAt
    now = datetime.now()
    new_clock_in = now.replace(hour=8, minute=0, second=0, microsecond=0)
    payload = {"clockInAt": new_clock_in.isoformat()}
    r = requests.patch(f"{BASE_URL}/time-clock/entries/{entry_id}", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    data = r.json()
    assert "Clock out before editing times" in data.get("error", ""), f"Expected error about clocking out, got: {data.get('error')}"
    log("✅ PATCH clock times on active entry blocked with 400")
    
    # Clock out to clean up
    requests.post(f"{BASE_URL}/time-clock/clock-out", json={}, headers={"Authorization": f"Bearer {token}"})
    return entry_id

def test_patch_approved_entry_blocked(token):
    """Test PATCH on approved entry (should be blocked)"""
    log("\n=== TEST 17: PATCH approved entry (should fail) ===")
    # Create a manual entry
    now = datetime.now()
    clock_in = now.replace(hour=9, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=10, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry_id = r.json()["entry"]["id"]
    
    # Submit it
    r = requests.post(f"{BASE_URL}/time-clock/entries/{entry_id}/submit", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Submit failed: {r.status_code} {r.text}"
    
    # Approve it (as manager)
    r = requests.post(f"{BASE_URL}/time-clock/manager/{entry_id}/approve", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Approve failed: {r.status_code} {r.text}"
    
    # Try to PATCH it
    r = requests.patch(f"{BASE_URL}/time-clock/entries/{entry_id}", json={"notes": "Try to edit"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    data = r.json()
    assert "Approved entries cannot be edited" in data.get("error", ""), f"Expected error about approved entries, got: {data.get('error')}"
    log("✅ PATCH approved entry blocked with 400")
    return entry_id

def test_duplicate_entry(token):
    """Test POST /api/time-clock/entries/:id/duplicate"""
    log("\n=== TEST 18: Duplicate entry ===")
    # Create a manual entry
    now = datetime.now()
    clock_in = now.replace(hour=9, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=12, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat(),
        "jobLabel": "Original Job",
        "notes": "Original notes"
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    original_id = r.json()["entry"]["id"]
    
    # Duplicate to tomorrow
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r = requests.post(f"{BASE_URL}/time-clock/entries/{original_id}/duplicate", json={"targetDate": tomorrow}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Duplicate failed: {r.status_code} {r.text}"
    dup_entry = r.json()["entry"]
    
    assert dup_entry["id"] != original_id, "Duplicate has same ID as original"
    assert dup_entry.get("jobLabel") == "Original Job", "jobLabel not copied"
    assert dup_entry.get("notes") == "Original notes", "notes not copied"
    assert dup_entry.get("isManualEntry") == True, "isManualEntry not set to true"
    assert dup_entry.get("status") == "completed", "status not reset to completed"
    assert dup_entry.get("approvedBy") is None, "approvedBy not cleared"
    log(f"✅ Duplicate entry created with new ID, date={dup_entry.get('date')}")
    return original_id, dup_entry["id"]

def test_csv_export(token):
    """Test GET /api/time-clock/export.csv"""
    log("\n=== TEST 19: CSV export ===")
    r = requests.get(f"{BASE_URL}/time-clock/export.csv", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"CSV export failed: {r.status_code} {r.text}"
    
    content_type = r.headers.get("Content-Type", "")
    assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
    
    content_disposition = r.headers.get("Content-Disposition", "")
    assert "attachment" in content_disposition, f"Expected attachment, got {content_disposition}"
    assert "timeclock_" in content_disposition, f"Expected filename with timeclock_, got {content_disposition}"
    
    csv_text = r.text
    lines = csv_text.split("\n")
    assert len(lines) > 0, "CSV is empty"
    header = lines[0]
    assert "Date" in header and "Clock In" in header and "Clock Out" in header, f"CSV header missing expected columns: {header}"
    log(f"✅ CSV export successful, {len(lines)} lines, Content-Type={content_type}")

def test_email_payload(token):
    """Test GET /api/time-clock/email-payload"""
    log("\n=== TEST 20: Email payload ===")
    r = requests.get(f"{BASE_URL}/time-clock/email-payload", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Email payload failed: {r.status_code} {r.text}"
    data = r.json()
    
    assert "to" in data, "Missing 'to' field"
    assert "subject" in data, "Missing 'subject' field"
    assert "body" in data, "Missing 'body' field"
    assert "entries" in data, "Missing 'entries' field"
    assert "totalNetMinutes" in data, "Missing 'totalNetMinutes' field"
    
    # Check that body contains bullet lines
    assert "•" in data["body"] or data["entries"] == 0, "Body should contain bullet lines (or no entries)"
    log(f"✅ Email payload successful, to={data['to']}, entries={data['entries']}, totalNetMinutes={data['totalNetMinutes']}")

def test_manager_queue(token):
    """Test GET /api/time-clock/manager/queue"""
    log("\n=== TEST 21: Manager queue ===")
    # Create and submit an entry first
    now = datetime.now()
    clock_in = now.replace(hour=9, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=10, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat(),
        "notes": "Test entry for manager queue"
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry_id = r.json()["entry"]["id"]
    
    # Submit it
    r = requests.post(f"{BASE_URL}/time-clock/entries/{entry_id}/submit", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Submit failed: {r.status_code} {r.text}"
    
    # Get manager queue
    r = requests.get(f"{BASE_URL}/time-clock/manager/queue?status=submitted", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Manager queue failed: {r.status_code} {r.text}"
    data = r.json()
    
    assert "entries" in data, "Missing 'entries' field"
    entries = data["entries"]
    assert len(entries) > 0, "Manager queue is empty"
    
    # Check that entries have author enrichment
    found = False
    for e in entries:
        if e["id"] == entry_id:
            found = True
            assert "author" in e, "Missing 'author' field"
            author = e["author"]
            assert "id" in author, "Missing author.id"
            assert "name" in author, "Missing author.name"
            assert "email" in author, "Missing author.email"
            log(f"✅ Manager queue successful, found entry with author: {author['name']} ({author['email']})")
            break
    
    assert found, f"Submitted entry {entry_id} not found in manager queue"
    return entry_id

def test_manager_approve(token, entry_id):
    """Test POST /api/time-clock/manager/:id/approve"""
    log("\n=== TEST 22: Manager approve ===")
    r = requests.post(f"{BASE_URL}/time-clock/manager/{entry_id}/approve", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Approve failed: {r.status_code} {r.text}"
    data = r.json()
    
    entry = data["entry"]
    assert entry["status"] == "approved", f"Status not updated to approved: {entry['status']}"
    assert entry.get("approvedBy") is not None, "approvedBy not set"
    assert entry.get("approverName") is not None, "approverName not set"
    assert entry.get("approvedAt") is not None, "approvedAt not set"
    log(f"✅ Manager approve successful, approvedBy={entry['approvedBy']}, approverName={entry['approverName']}")

def test_manager_reject(token):
    """Test POST /api/time-clock/manager/:id/reject"""
    log("\n=== TEST 23: Manager reject ===")
    # Create and submit another entry
    now = datetime.now()
    clock_in = now.replace(hour=14, minute=0, second=0, microsecond=0)
    clock_out = now.replace(hour=15, minute=0, second=0, microsecond=0)
    
    payload = {
        "clockInAt": clock_in.isoformat(),
        "clockOutAt": clock_out.isoformat()
    }
    r = requests.post(f"{BASE_URL}/time-clock/entries", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create manual entry failed: {r.status_code} {r.text}"
    entry_id = r.json()["entry"]["id"]
    
    # Submit it
    r = requests.post(f"{BASE_URL}/time-clock/entries/{entry_id}/submit", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Submit failed: {r.status_code} {r.text}"
    
    # Reject it
    r = requests.post(f"{BASE_URL}/time-clock/manager/{entry_id}/reject", json={"reason": "Hours don't match work order"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Reject failed: {r.status_code} {r.text}"
    data = r.json()
    
    entry = data["entry"]
    assert entry["status"] == "rejected", f"Status not updated to rejected: {entry['status']}"
    assert entry.get("rejectionReason") == "Hours don't match work order", f"rejectionReason not set correctly: {entry.get('rejectionReason')}"
    log(f"✅ Manager reject successful, rejectionReason={entry['rejectionReason']}")
    return entry_id

def test_existing_regression(token):
    """Test existing flows: clock-in, clock-out, break, summary, submit, delete"""
    log("\n=== TEST 24: Existing regression - clock-in/out/break/summary/submit/delete ===")
    
    # Clock in
    r = requests.post(f"{BASE_URL}/time-clock/clock-in", json={"notes": "Regression test"}, headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 409:
        # Already clocked in, clock out first
        requests.post(f"{BASE_URL}/time-clock/clock-out", json={}, headers={"Authorization": f"Bearer {token}"})
        r = requests.post(f"{BASE_URL}/time-clock/clock-in", json={"notes": "Regression test"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Clock in failed: {r.status_code} {r.text}"
    entry_id = r.json()["entry"]["id"]
    log("  ✅ Clock in successful")
    
    # Get current
    r = requests.get(f"{BASE_URL}/time-clock/current", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Get current failed: {r.status_code} {r.text}"
    assert r.json()["entry"]["id"] == entry_id, "Current entry ID mismatch"
    log("  ✅ Get current successful")
    
    # Start break
    r = requests.post(f"{BASE_URL}/time-clock/break/start", json={"reason": "Lunch"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Break start failed: {r.status_code} {r.text}"
    log("  ✅ Break start successful")
    
    # End break
    r = requests.post(f"{BASE_URL}/time-clock/break/end", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Break end failed: {r.status_code} {r.text}"
    log("  ✅ Break end successful")
    
    # Clock out
    r = requests.post(f"{BASE_URL}/time-clock/clock-out", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Clock out failed: {r.status_code} {r.text}"
    log("  ✅ Clock out successful")
    
    # Get summary
    r = requests.get(f"{BASE_URL}/time-clock/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Summary failed: {r.status_code} {r.text}"
    data = r.json()
    assert "today" in data and "week" in data and "byJob" in data, "Summary missing expected fields"
    log("  ✅ Summary successful")
    
    # Submit
    r = requests.post(f"{BASE_URL}/time-clock/entries/{entry_id}/submit", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Submit failed: {r.status_code} {r.text}"
    log("  ✅ Submit successful")
    
    # Soft delete (can't delete submitted, so reject it first)
    requests.post(f"{BASE_URL}/time-clock/manager/{entry_id}/reject", json={"reason": "Test cleanup"}, headers={"Authorization": f"Bearer {token}"})
    r = requests.delete(f"{BASE_URL}/time-clock/entries/{entry_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Delete failed: {r.status_code} {r.text}"
    log("  ✅ Soft delete successful")
    
    log("✅ Existing regression tests passed")

def test_cleanup(token):
    """Cleanup: reset settings to defaults and delete test entries"""
    log("\n=== CLEANUP: Reset settings and delete test entries ===")
    
    # Reset settings
    payload = {
        "roundToMinutes": 1,
        "roundDirection": "nearest",
        "autoBreakMinutes": 0,
        "defaultRate": 0,
        "managerEmail": ""
    }
    r = requests.patch(f"{BASE_URL}/time-clock/settings", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Reset settings failed: {r.status_code} {r.text}"
    log("✅ Settings reset to defaults")
    
    # Get all entries and soft-delete test entries
    r = requests.get(f"{BASE_URL}/time-clock/entries?limit=500", headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 200:
        entries = r.json().get("entries", [])
        deleted_count = 0
        for entry in entries:
            # Delete entries that are not already deleted and are in completed/rejected status
            if entry.get("status") in ["completed", "rejected"] and not entry.get("deleted"):
                r = requests.delete(f"{BASE_URL}/time-clock/entries/{entry['id']}", headers={"Authorization": f"Bearer {token}"})
                if r.status_code == 200:
                    deleted_count += 1
        log(f"✅ Deleted {deleted_count} test entries")
    else:
        log("⚠️ Could not fetch entries for cleanup")

def main():
    try:
        log("=" * 80)
        log("TIME CLOCK 2.0 BACKEND TEST SUITE")
        log("=" * 80)
        
        token = test_login()
        
        # Settings tests
        test_settings_get(token)
        test_settings_patch_valid(token)
        test_settings_patch_invalid_round(token)
        test_settings_patch_invalid_direction(token)
        
        # Rounding tests
        entry_id = test_rounding_up(token)
        test_rounding_down(token, entry_id)
        test_rounding_nearest(token, entry_id)
        test_rounding_none(token, entry_id)
        
        # Auto-break tests
        test_auto_break_long_shift(token)
        test_auto_break_short_shift(token)
        
        # Manual entry validation tests
        test_manual_entry_validation_no_body(token)
        test_manual_entry_validation_clockout_before_clockin(token)
        work_entry_id = test_manual_entry_with_work_fields(token)
        
        # PATCH editing tests
        test_patch_editing_completed_entry(token, work_entry_id)
        test_patch_editing_with_breaks(token, work_entry_id)
        test_patch_active_entry_blocked(token)
        test_patch_approved_entry_blocked(token)
        
        # Duplicate test
        test_duplicate_entry(token)
        
        # CSV export test
        test_csv_export(token)
        
        # Email payload test
        test_email_payload(token)
        
        # Manager tests
        manager_entry_id = test_manager_queue(token)
        test_manager_approve(token, manager_entry_id)
        test_manager_reject(token)
        
        # Existing regression test
        test_existing_regression(token)
        
        # Cleanup
        test_cleanup(token)
        
        log("\n" + "=" * 80)
        log("✅ ALL TIME CLOCK 2.0 TESTS PASSED")
        log("=" * 80)
        return 0
        
    except AssertionError as e:
        log(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        log(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
