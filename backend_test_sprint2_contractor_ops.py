#!/usr/bin/env python3
"""
Sprint 2 — Contractor Ops Full (B2) Backend Testing
Test ONLY the new + extended endpoints in this sprint.

Auth credentials:
- super_admin: jamal@dumpmaps.org / @@Jefferson2180 (has contractor access via STAFF_ROLES)

Base URL: http://localhost:3000
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000"

# Test credentials
SUPER_ADMIN_EMAIL = "jamal@dumpmaps.org"
SUPER_ADMIN_PASSWORD = "@@Jefferson2180"

def login(email, password):
    """Login and return auth token"""
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")
        else:
            print(f"❌ Login failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def signup_user(email, password, name="Test User"):
    """Create a new user"""
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email,
            "password": password,
            "name": name
        }, timeout=10)
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data.get("token")
        else:
            print(f"❌ Signup failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Signup error: {e}")
        return None

def test_batch_upload(token):
    """Test 1: POST /api/receipts/batch — batch upload (max 10)"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/receipts/batch — batch upload (max 10)")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    created_ids = []
    
    # Test 1a: Valid 2-item batch with confirm=true
    print("\n✓ Test 1a: Valid 2-item batch with confirm=true")
    batch_data = {
        "confirm": True,
        "receipts": [
            {
                "facilityName": "Test Facility A",
                "dateOf": datetime.now().strftime("%Y-%m-%d"),
                "grossLb": 5000,
                "tareLb": 1000,
                "pricePerTon": 50,
                "materialType": "Concrete",
                "vehicleNumber": "Truck #1",
                "jobName": "Job Alpha"
            },
            {
                "facilityName": "Test Facility A",
                "dateOf": datetime.now().strftime("%Y-%m-%d"),
                "grossLb": 6000,
                "tareLb": 1000,
                "pricePerTon": 50,
                "materialType": "Concrete",
                "vehicleNumber": "Truck #1",
                "jobName": "Job Alpha"
            }
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json=batch_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            batch_id = data.get("batchId")
            count = data.get("count")
            receipts = data.get("receipts", [])
            
            if count == 2 and len(receipts) == 2:
                # Check all receipts share same batchId
                batch_ids = [r.get("batchId") for r in receipts]
                if all(bid == batch_id for bid in batch_ids):
                    print(f"  ✅ Batch created: batchId={batch_id}, count={count}")
                    print(f"  ✅ All receipts share same batchId")
                    created_ids.extend([r["id"] for r in receipts])
                else:
                    print(f"  ❌ Not all receipts share same batchId: {batch_ids}")
            else:
                print(f"  ❌ Expected count=2, got {count}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 1b: Boundary - 10 valid receipts
    print("\n✓ Test 1b: Boundary - 10 valid receipts with confirm=true")
    batch_10 = {
        "confirm": True,
        "receipts": [
            {
                "facilityName": f"Facility {i}",
                "dateOf": datetime.now().strftime("%Y-%m-%d"),
                "grossLb": 5000 + i*100,
                "tareLb": 1000,
                "pricePerTon": 50,
                "materialType": "Concrete"
            } for i in range(10)
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json=batch_10, headers=headers, timeout=10)
        if resp.status_code == 201:
            data = resp.json()
            if data.get("count") == 10:
                print(f"  ✅ 10 receipts created successfully")
                created_ids.extend([r["id"] for r in data.get("receipts", [])])
            else:
                print(f"  ❌ Expected count=10, got {data.get('count')}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 1c: Over-boundary - 11 receipts
    print("\n✓ Test 1c: Over-boundary - 11 receipts → 400")
    batch_11 = {
        "confirm": True,
        "receipts": [{"facilityName": f"Facility {i}", "grossLb": 5000, "tareLb": 1000, "pricePerTon": 50} for i in range(11)]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json=batch_11, headers=headers, timeout=10)
        if resp.status_code == 400 and "Maximum 10 receipts per batch" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - Maximum 10 receipts per batch")
        else:
            print(f"  ❌ Expected 400 with 'Maximum 10 receipts per batch', got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 1d: confirm=false
    print("\n✓ Test 1d: confirm=false (or omitted) → 400")
    batch_no_confirm = {
        "confirm": False,
        "receipts": [{"facilityName": "Test", "grossLb": 5000, "tareLb": 1000, "pricePerTon": 50}]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json=batch_no_confirm, headers=headers, timeout=10)
        if resp.status_code == 400 and "Confirmation required" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - Confirmation required")
        else:
            print(f"  ❌ Expected 400 with 'Confirmation required', got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 1e: Empty receipts array
    print("\n✓ Test 1e: Empty receipts array → 400")
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json={"confirm": True, "receipts": []}, headers=headers, timeout=10)
        if resp.status_code == 400 and "No receipts in batch" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - No receipts in batch")
        else:
            print(f"  ❌ Expected 400 with 'No receipts in batch', got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 1f: Missing facilityName AND facilityId
    print("\n✓ Test 1f: One row missing facilityName AND facilityId → 400 with row index")
    batch_missing = {
        "confirm": True,
        "receipts": [
            {"facilityName": "Valid Facility", "grossLb": 5000, "tareLb": 1000, "pricePerTon": 50},
            {"grossLb": 5000, "tareLb": 1000, "pricePerTon": 50}  # Missing facilityName
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts/batch", json=batch_missing, headers=headers, timeout=10)
        if resp.status_code == 400 and "facilityName or facilityId" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - {resp.json().get('error')}")
        else:
            print(f"  ❌ Expected 400 with 'facilityName or facilityId', got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    return created_ids

def test_extended_stats(token):
    """Test 2: GET /api/receipts/stats — extended v2 fields"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/receipts/stats — extended v2 fields")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    created_ids = []
    
    # Create test data
    print("\n✓ Creating test receipts for stats...")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # 3 trips at Facility A
    facility_a_receipts = [
        {
            "facilityName": "Facility A",
            "dateOf": today,
            "grossLb": 2100,
            "tareLb": 100,
            "totalCost": 100,
            "materialType": "Concrete",
            "vehicleNumber": "Truck #1",
            "jobName": "Job Alpha"
        },
        {
            "facilityName": "Facility A",
            "dateOf": today,
            "grossLb": 2200,
            "tareLb": 200,
            "totalCost": 110,
            "materialType": "Concrete",
            "vehicleNumber": "Truck #1",
            "jobName": "Job Alpha"
        },
        {
            "facilityName": "Facility A",
            "dateOf": today,
            "grossLb": 2000,
            "tareLb": 200,
            "totalCost": 90,
            "materialType": "Concrete",
            "vehicleNumber": "Truck #1",
            "jobName": "Job Alpha"
        }
    ]
    
    # 3 trips at Facility B
    facility_b_receipts = [
        {
            "facilityName": "Facility B",
            "dateOf": today,
            "grossLb": 2100,
            "tareLb": 100,
            "totalCost": 200,
            "materialType": "Wood",
            "vehicleNumber": "Truck #2",
            "jobName": "Job Beta"
        },
        {
            "facilityName": "Facility B",
            "dateOf": today,
            "grossLb": 2200,
            "tareLb": 200,
            "totalCost": 220,
            "materialType": "Wood",
            "vehicleNumber": "Truck #2",
            "jobName": "Job Beta"
        },
        {
            "facilityName": "Facility B",
            "dateOf": today,
            "grossLb": 2000,
            "tareLb": 200,
            "totalCost": 180,
            "materialType": "Wood",
            "vehicleNumber": "Truck #2",
            "jobName": "Job Beta"
        }
    ]
    
    all_receipts = facility_a_receipts + facility_b_receipts
    
    for receipt in all_receipts:
        try:
            resp = requests.post(f"{BASE_URL}/api/receipts", json=receipt, headers=headers, timeout=10)
            if resp.status_code == 201:
                created_ids.append(resp.json()["receipt"]["id"])
        except Exception as e:
            print(f"  ❌ Error creating receipt: {e}")
    
    print(f"  ✅ Created {len(created_ids)} test receipts")
    
    # Get stats
    print("\n✓ Testing GET /api/receipts/stats...")
    try:
        resp = requests.get(f"{BASE_URL}/api/receipts/stats", headers=headers, timeout=10)
        if resp.status_code == 200:
            stats = resp.json()
            
            # Test 2a: mostUsedFacility
            most_used = stats.get("mostUsedFacility")
            if most_used and most_used.get("trips") == 3:
                print(f"  ✅ mostUsedFacility: {most_used.get('facilityName')} with {most_used.get('trips')} trips")
            else:
                print(f"  ⚠️  mostUsedFacility: {most_used}")
            
            # Test 2b: cheapestFacility (Facility A avg $/ton = 100)
            cheapest = stats.get("cheapestFacility")
            if cheapest:
                print(f"  ✅ cheapestFacility: {cheapest.get('facilityName')} at ${cheapest.get('avgCostPerTon')}/ton")
                if cheapest.get("facilityName") == "Facility A" and cheapest.get("avgCostPerTon") == 100:
                    print(f"    ✅ Correct: Facility A is cheapest at $100/ton")
                else:
                    print(f"    ⚠️  Expected Facility A at $100/ton")
            else:
                print(f"  ⚠️  cheapestFacility: {cheapest}")
            
            # Test 2c: mostExpensiveFacility (Facility B avg $/ton = 200)
            expensive = stats.get("mostExpensiveFacility")
            if expensive:
                print(f"  ✅ mostExpensiveFacility: {expensive.get('facilityName')} at ${expensive.get('avgCostPerTon')}/ton")
                if expensive.get("facilityName") == "Facility B" and expensive.get("avgCostPerTon") == 200:
                    print(f"    ✅ Correct: Facility B is most expensive at $200/ton")
                else:
                    print(f"    ⚠️  Expected Facility B at $200/ton")
            else:
                print(f"  ⚠️  mostExpensiveFacility: {expensive}")
            
            # Test 2d: materialBreakdown
            material_breakdown = stats.get("materialBreakdown", [])
            if len(material_breakdown) >= 2:
                print(f"  ✅ materialBreakdown: {len(material_breakdown)} entries")
                for mat in material_breakdown:
                    if mat.get("material") in ["Concrete", "Wood"]:
                        print(f"    ✅ {mat.get('material')}: {mat.get('trips')} trips, {mat.get('totalNetTons')} tons")
            else:
                print(f"  ⚠️  materialBreakdown: {material_breakdown}")
            
            # Test 2e: vehicleBreakdownThisMonth
            vehicle_breakdown = stats.get("vehicleBreakdownThisMonth", [])
            if len(vehicle_breakdown) >= 2:
                print(f"  ✅ vehicleBreakdownThisMonth: {len(vehicle_breakdown)} entries")
                for veh in vehicle_breakdown:
                    if veh.get("vehicleNumber") in ["Truck #1", "Truck #2"]:
                        print(f"    ✅ {veh.get('vehicleNumber')}: {veh.get('trips')} trips")
            else:
                print(f"  ⚠️  vehicleBreakdownThisMonth: {vehicle_breakdown}")
            
            # Test 2f: jobBreakdownThisMonth
            job_breakdown = stats.get("jobBreakdownThisMonth", [])
            if len(job_breakdown) >= 2:
                print(f"  ✅ jobBreakdownThisMonth: {len(job_breakdown)} entries")
                for job in job_breakdown:
                    if job.get("jobName") in ["Job Alpha", "Job Beta"]:
                        print(f"    ✅ {job.get('jobName')}: {job.get('trips')} trips")
            else:
                print(f"  ⚠️  jobBreakdownThisMonth: {job_breakdown}")
            
            # Test 2g: monthlyTrend (chronological - oldest first)
            monthly_trend = stats.get("monthlyTrend", [])
            if len(monthly_trend) >= 1:
                print(f"  ✅ monthlyTrend: {len(monthly_trend)} entries")
                # Check chronological order
                months = [m.get("month") for m in monthly_trend]
                if months == sorted(months):
                    print(f"    ✅ Chronological order verified (oldest first)")
                else:
                    print(f"    ⚠️  Not chronological: {months}")
            else:
                print(f"  ⚠️  monthlyTrend: {monthly_trend}")
            
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    return created_ids

def test_by_vehicle(token):
    """Test 3: GET /api/receipts/by-vehicle/:vehicleNumber"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/receipts/by-vehicle/:vehicleNumber")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    created_ids = []
    
    # Test 3a: Create 2 receipts with vehicleNumber="Truck #99"
    print("\n✓ Test 3a: Create 2 receipts with vehicleNumber='Truck #99'")
    vehicle_number = "Truck #99"
    
    for i in range(2):
        receipt = {
            "facilityName": "Test Facility",
            "dateOf": datetime.now().strftime("%Y-%m-%d"),
            "grossLb": 5000 + i*100,
            "tareLb": 1000,
            "pricePerTon": 50,
            "vehicleNumber": vehicle_number
        }
        try:
            resp = requests.post(f"{BASE_URL}/api/receipts", json=receipt, headers=headers, timeout=10)
            if resp.status_code == 201:
                created_ids.append(resp.json()["receipt"]["id"])
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print(f"  ✅ Created {len(created_ids)} receipts for {vehicle_number}")
    
    # Test 3b: GET by vehicle (URL-encoded)
    print(f"\n✓ Test 3b: GET /api/receipts/by-vehicle/{vehicle_number} (URL-encoded)")
    encoded_vehicle = vehicle_number.replace(" ", "%20").replace("#", "%23")
    
    try:
        resp = requests.get(f"{BASE_URL}/api/receipts/by-vehicle/{encoded_vehicle}", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            
            # Test 3c: lifetime.trips == 2
            lifetime = data.get("lifetime", {})
            if lifetime.get("trips") == 2:
                print(f"  ✅ lifetime.trips == 2")
            else:
                print(f"  ❌ Expected lifetime.trips=2, got {lifetime.get('trips')}")
            
            # Test 3d: recent[0].vehicleNumber == "Truck #99"
            recent = data.get("recent", [])
            if recent and recent[0].get("vehicleNumber") == vehicle_number:
                print(f"  ✅ recent[0].vehicleNumber == '{vehicle_number}'")
            else:
                print(f"  ❌ Expected vehicleNumber='{vehicle_number}', got {recent[0].get('vehicleNumber') if recent else 'empty'}")
            
            print(f"  ✅ Response structure: thisMonth, lifetime, recent")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 3e: Empty vehicleNumber path
    print("\n✓ Test 3e: Empty vehicleNumber path → 400")
    try:
        resp = requests.get(f"{BASE_URL}/api/receipts/by-vehicle/", headers=headers, timeout=10)
        if resp.status_code in [400, 404]:
            print(f"  ✅ Correctly rejected: {resp.status_code}")
        else:
            print(f"  ⚠️  Expected 400/404, got {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    return created_ids

def test_vehicle_inspections(token):
    """Test 4: Vehicle Inspections — full CRUD"""
    print("\n" + "="*80)
    print("TEST 4: Vehicle Inspections — full CRUD")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    created_ids = []
    
    # Test 4a: POST with minimal required fields
    print("\n✓ Test 4a: POST /api/vehicle-inspections with minimal required fields")
    inspection_data = {
        "vehicleNumber": "Truck #1",
        "driverName": "John Doe",
        "date": datetime.now().strftime("%Y-%m-%d")
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json=inspection_data, headers=headers, timeout=10)
        if resp.status_code == 201:
            inspection = resp.json().get("inspection", {})
            inspection_id = inspection.get("id")
            created_ids.append(inspection_id)
            print(f"  ✅ Inspection created: {inspection_id}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4b: POST without vehicleNumber
    print("\n✓ Test 4b: POST without vehicleNumber → 400")
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json={"driverName": "John"}, headers=headers, timeout=10)
        if resp.status_code == 400 and "vehicleNumber required" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - vehicleNumber required")
        else:
            print(f"  ❌ Expected 400 with 'vehicleNumber required', got {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4c: POST without driverName
    print("\n✓ Test 4c: POST without driverName → 400")
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json={"vehicleNumber": "Truck #1"}, headers=headers, timeout=10)
        if resp.status_code == 400 and "driverName required" in resp.text:
            print(f"  ✅ Correctly rejected: 400 - driverName required")
        else:
            print(f"  ❌ Expected 400 with 'driverName required', got {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4d: Create with damage reported
    print("\n✓ Test 4d: Create with damageReported:true → issuesFlag must be true")
    damage_inspection = {
        "vehicleNumber": "Truck #2",
        "driverName": "Jane Doe",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "damageReported": True,
        "damageDescription": "test dent",
        "damageLocations": ["front", "driver_side"],
        "damagePhotos": []
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json=damage_inspection, headers=headers, timeout=10)
        if resp.status_code == 201:
            inspection = resp.json().get("inspection", {})
            if inspection.get("issuesFlag") == True:
                print(f"  ✅ issuesFlag=true (damage reported)")
                created_ids.append(inspection.get("id"))
            else:
                print(f"  ❌ Expected issuesFlag=true, got {inspection.get('issuesFlag')}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4e: Create with all checklist:true and no damage/lights
    print("\n✓ Test 4e: Create with all checklist:true and no damage → issuesFlag false")
    clean_inspection = {
        "vehicleNumber": "Truck #3",
        "driverName": "Bob Smith",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "checklist": {
            "tires": True,
            "lights": True,
            "brakes": True,
            "mirrors": True,
            "backupCamera": True,
            "liftgate": True,
            "registration": True,
            "safetyEquipment": True,
            "firstAid": True,
            "strapsTools": True
        }
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json=clean_inspection, headers=headers, timeout=10)
        if resp.status_code == 201:
            inspection = resp.json().get("inspection", {})
            if inspection.get("issuesFlag") == False:
                print(f"  ✅ issuesFlag=false (all checks passed)")
                created_ids.append(inspection.get("id"))
            else:
                print(f"  ❌ Expected issuesFlag=false, got {inspection.get('issuesFlag')}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4f: Create with one checklist:false
    print("\n✓ Test 4f: Create with one checklist:false (tires:false) → issuesFlag true")
    failed_inspection = {
        "vehicleNumber": "Truck #4",
        "driverName": "Alice Johnson",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "checklist": {
            "tires": False,  # Failed item
            "lights": True,
            "brakes": True,
            "mirrors": True,
            "backupCamera": True,
            "liftgate": True,
            "registration": True,
            "safetyEquipment": True,
            "firstAid": True,
            "strapsTools": True
        }
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json=failed_inspection, headers=headers, timeout=10)
        if resp.status_code == 201:
            inspection = resp.json().get("inspection", {})
            if inspection.get("issuesFlag") == True:
                print(f"  ✅ issuesFlag=true (checklist item failed)")
                created_ids.append(inspection.get("id"))
            else:
                print(f"  ❌ Expected issuesFlag=true, got {inspection.get('issuesFlag')}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4g: PATCH adding mileageEnd
    print("\n✓ Test 4g: PATCH adding mileageEnd → milesDriven recomputes")
    pre_shift_inspection = {
        "vehicleNumber": "Truck #5",
        "driverName": "Charlie Brown",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "phase": "pre_shift",
        "mileageStart": 10000
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/vehicle-inspections", json=pre_shift_inspection, headers=headers, timeout=10)
        if resp.status_code == 201:
            inspection_id = resp.json().get("inspection", {}).get("id")
            created_ids.append(inspection_id)
            
            # PATCH with mileageEnd
            patch_data = {"mileageEnd": 10250}
            resp2 = requests.patch(f"{BASE_URL}/api/vehicle-inspections/{inspection_id}", json=patch_data, headers=headers, timeout=10)
            if resp2.status_code == 200:
                updated = resp2.json().get("inspection", {})
                miles_driven = updated.get("milesDriven")
                if miles_driven == 250:
                    print(f"  ✅ milesDriven recomputed: {miles_driven} miles (10250 - 10000)")
                else:
                    print(f"  ❌ Expected milesDriven=250, got {miles_driven}")
            else:
                print(f"  ❌ PATCH failed: {resp2.status_code} - {resp2.text}")
        else:
            print(f"  ❌ POST failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4h: GET with date filter
    print("\n✓ Test 4h: GET /api/vehicle-inspections?date=YYYY-MM-DD filters correctly")
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        resp = requests.get(f"{BASE_URL}/api/vehicle-inspections?date={today}", headers=headers, timeout=10)
        if resp.status_code == 200:
            inspections = resp.json().get("inspections", [])
            print(f"  ✅ Found {len(inspections)} inspections for {today}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4i: GET with vehicleNumber filter
    print("\n✓ Test 4i: GET /api/vehicle-inspections?vehicleNumber=X filters")
    try:
        resp = requests.get(f"{BASE_URL}/api/vehicle-inspections?vehicleNumber=Truck%20%231", headers=headers, timeout=10)
        if resp.status_code == 200:
            inspections = resp.json().get("inspections", [])
            print(f"  ✅ Found {len(inspections)} inspections for Truck #1")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4j: GET with issuesOnly filter
    print("\n✓ Test 4j: GET /api/vehicle-inspections?issuesOnly=1 returns only issuesFlag:true")
    try:
        resp = requests.get(f"{BASE_URL}/api/vehicle-inspections?issuesOnly=1", headers=headers, timeout=10)
        if resp.status_code == 200:
            inspections = resp.json().get("inspections", [])
            all_have_issues = all(i.get("issuesFlag") == True for i in inspections)
            if all_have_issues:
                print(f"  ✅ All {len(inspections)} inspections have issuesFlag=true")
            else:
                print(f"  ❌ Some inspections don't have issuesFlag=true")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4k: GET /api/vehicle-inspections/stats
    print("\n✓ Test 4k: GET /api/vehicle-inspections/stats")
    try:
        resp = requests.get(f"{BASE_URL}/api/vehicle-inspections/stats", headers=headers, timeout=10)
        if resp.status_code == 200:
            stats = resp.json()
            print(f"  ✅ Stats: completed={stats.get('completed')}, missing={stats.get('missing')}, issues={stats.get('issues')}")
            print(f"  ✅ knownVehicles: {len(stats.get('knownVehicles', []))} vehicles")
            print(f"  ✅ todayInspections: {len(stats.get('todayInspections', []))} inspections")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 4l: GET by ID (owner-scoped)
    print("\n✓ Test 4l: GET /api/vehicle-inspections/:id → owner-scoped")
    if created_ids:
        try:
            resp = requests.get(f"{BASE_URL}/api/vehicle-inspections/{created_ids[0]}", headers=headers, timeout=10)
            if resp.status_code == 200:
                print(f"  ✅ Retrieved inspection: {created_ids[0]}")
            else:
                print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    # Test 4m: DELETE (soft delete)
    print("\n✓ Test 4m: DELETE /api/vehicle-inspections/:id → soft delete")
    if created_ids:
        delete_id = created_ids[0]
        try:
            resp = requests.delete(f"{BASE_URL}/api/vehicle-inspections/{delete_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                # Verify it's excluded from list
                resp2 = requests.get(f"{BASE_URL}/api/vehicle-inspections/{delete_id}", headers=headers, timeout=10)
                if resp2.status_code == 404:
                    print(f"  ✅ Soft deleted: {delete_id} (404 on subsequent GET)")
                else:
                    print(f"  ⚠️  Deleted but still accessible: {resp2.status_code}")
            else:
                print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    return created_ids

def test_admin_contractor_ops(token):
    """Test 5: Admin Contractor Ops endpoints"""
    print("\n" + "="*80)
    print("TEST 5: Admin Contractor Ops endpoints")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 5b: GET /api/admin/receipts
    print("\n✓ Test 5b: GET /api/admin/receipts?limit=10")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/receipts?limit=10", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            receipts = data.get("receipts", [])
            print(f"  ✅ Retrieved {len(receipts)} receipts")
            
            # Check enrichment
            if receipts:
                first = receipts[0]
                if "userEmail" in first and "userName" in first and "userRole" in first:
                    print(f"  ✅ Enriched with userEmail, userName, userRole")
                else:
                    print(f"  ⚠️  Missing enrichment fields")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 5c: Create suspicious receipt (>$2000)
    print("\n✓ Test 5c: Create receipt with totalCost:5000 (>2000 threshold)")
    suspicious_receipt = {
        "facilityName": "Expensive Facility",
        "dateOf": datetime.now().strftime("%Y-%m-%d"),
        "grossLb": 10000,
        "tareLb": 0,
        "totalCost": 5000
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/receipts", json=suspicious_receipt, headers=headers, timeout=10)
        if resp.status_code == 201:
            suspicious_id = resp.json()["receipt"]["id"]
            print(f"  ✅ Created suspicious receipt: {suspicious_id}")
            
            # Test 5c: GET with suspicious filter
            resp2 = requests.get(f"{BASE_URL}/api/admin/receipts?suspicious=1", headers=headers, timeout=10)
            if resp2.status_code == 200:
                receipts = resp2.json().get("receipts", [])
                found = any(r.get("id") == suspicious_id for r in receipts)
                if found:
                    print(f"  ✅ Suspicious receipt appears in ?suspicious=1 results")
                else:
                    print(f"  ⚠️  Suspicious receipt not found in filtered results")
            else:
                print(f"  ❌ Failed: {resp2.status_code} - {resp2.text}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 5d: GET /api/admin/receipts/stats
    print("\n✓ Test 5d: GET /api/admin/receipts/stats")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/receipts/stats", headers=headers, timeout=10)
        if resp.status_code == 200:
            stats = resp.json()
            print(f"  ✅ Stats retrieved:")
            print(f"    - thisMonth: {stats.get('thisMonth')}")
            print(f"    - flagged: {len(stats.get('flagged', []))} receipts")
            print(f"    - recentBatches: {len(stats.get('recentBatches', []))} batches")
            print(f"    - manualCount: {stats.get('manualCount')}")
            print(f"    - totalReceiptsInWindow: {stats.get('totalReceiptsInWindow')}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 5e: GET /api/admin/vehicle-inspections?issuesOnly=1
    print("\n✓ Test 5e: GET /api/admin/vehicle-inspections?issuesOnly=1")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/vehicle-inspections?issuesOnly=1", headers=headers, timeout=10)
        if resp.status_code == 200:
            inspections = resp.json().get("inspections", [])
            print(f"  ✅ Retrieved {len(inspections)} inspections with issues")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 5f: GET /api/admin/vehicle-inspections/stats
    print("\n✓ Test 5f: GET /api/admin/vehicle-inspections/stats")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/vehicle-inspections/stats", headers=headers, timeout=10)
        if resp.status_code == 200:
            stats = resp.json()
            print(f"  ✅ Stats retrieved:")
            print(f"    - todayCompleted: {stats.get('todayCompleted')}")
            print(f"    - todayWithIssues: {stats.get('todayWithIssues')}")
            print(f"    - totalWithIssues: {stats.get('totalWithIssues')}")
            print(f"    - recentDamageReports: {len(stats.get('recentDamageReports', []))}")
            print(f"    - recentDashLightReports: {len(stats.get('recentDashLightReports', []))}")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def test_rbac_non_contractor(token):
    """Test 6: RBAC sanity — non-contractor signup"""
    print("\n" + "="*80)
    print("TEST 6: RBAC sanity — non-contractor signup")
    print("="*80)
    
    # Create a fresh user with default role
    print("\n✓ Creating fresh user with default role (normal_user)...")
    timestamp = int(datetime.now().timestamp())
    test_email = f"testuser_{timestamp}@test.com"
    test_password = "testpass123"
    
    user_token = signup_user(test_email, test_password, "Test User")
    
    if not user_token:
        print("  ❌ Failed to create test user")
        return
    
    print(f"  ✅ Created user: {test_email}")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    # Test all contractor endpoints return 403
    endpoints = [
        ("POST", "/api/receipts", {"facilityName": "Test", "grossLb": 5000, "tareLb": 1000, "pricePerTon": 50}),
        ("POST", "/api/receipts/batch", {"confirm": True, "receipts": [{"facilityName": "Test", "grossLb": 5000}]}),
        ("GET", "/api/receipts", None),
        ("GET", "/api/receipts/stats", None),
        ("GET", "/api/receipts/by-vehicle/Any", None),
        ("POST", "/api/vehicle-inspections", {"vehicleNumber": "Test", "driverName": "Test"}),
        ("GET", "/api/vehicle-inspections", None),
        ("GET", "/api/vehicle-inspections/stats", None),
    ]
    
    print("\n✓ Testing all contractor endpoints return 403...")
    all_403 = True
    
    for method, endpoint, data in endpoints:
        try:
            if method == "POST":
                resp = requests.post(f"{BASE_URL}{endpoint}", json=data, headers=headers, timeout=10)
            else:
                resp = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
            
            if resp.status_code == 403:
                print(f"  ✅ {method} {endpoint} → 403")
            else:
                print(f"  ❌ {method} {endpoint} → {resp.status_code} (expected 403)")
                all_403 = False
        except Exception as e:
            print(f"  ❌ {method} {endpoint} → Error: {e}")
            all_403 = False
    
    if all_403:
        print("\n  ✅ ALL contractor endpoints correctly return 403 for non-contractor user")
    else:
        print("\n  ❌ Some endpoints did not return 403")

def cleanup_receipts(token, receipt_ids):
    """Cleanup created receipts"""
    if not receipt_ids:
        return
    
    print(f"\n✓ Cleaning up {len(receipt_ids)} receipts...")
    headers = {"Authorization": f"Bearer {token}"}
    
    for receipt_id in receipt_ids:
        try:
            requests.delete(f"{BASE_URL}/api/receipts/{receipt_id}", headers=headers, timeout=10)
        except:
            pass
    
    print(f"  ✅ Cleanup complete")

def cleanup_inspections(token, inspection_ids):
    """Cleanup created inspections"""
    if not inspection_ids:
        return
    
    print(f"\n✓ Cleaning up {len(inspection_ids)} inspections...")
    headers = {"Authorization": f"Bearer {token}"}
    
    for inspection_id in inspection_ids:
        try:
            requests.delete(f"{BASE_URL}/api/vehicle-inspections/{inspection_id}", headers=headers, timeout=10)
        except:
            pass
    
    print(f"  ✅ Cleanup complete")

def main():
    print("\n" + "="*80)
    print("SPRINT 2 — CONTRACTOR OPS FULL (B2) BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Auth: {SUPER_ADMIN_EMAIL}")
    print("="*80)
    
    # Login as super_admin (has contractor access via STAFF_ROLES)
    print("\n✓ Logging in as super_admin...")
    token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    if not token:
        print("❌ Failed to login. Exiting.")
        return
    
    print(f"✅ Logged in successfully")
    
    all_receipt_ids = []
    all_inspection_ids = []
    
    try:
        # Test 1: Batch upload
        receipt_ids = test_batch_upload(token)
        all_receipt_ids.extend(receipt_ids)
        
        # Test 2: Extended stats
        receipt_ids = test_extended_stats(token)
        all_receipt_ids.extend(receipt_ids)
        
        # Test 3: By-vehicle endpoint
        receipt_ids = test_by_vehicle(token)
        all_receipt_ids.extend(receipt_ids)
        
        # Test 4: Vehicle inspections
        inspection_ids = test_vehicle_inspections(token)
        all_inspection_ids.extend(inspection_ids)
        
        # Test 5: Admin contractor ops
        test_admin_contractor_ops(token)
        
        # Test 6: RBAC non-contractor
        test_rbac_non_contractor(token)
        
    finally:
        # Cleanup
        cleanup_receipts(token, all_receipt_ids)
        cleanup_inspections(token, all_inspection_ids)
    
    print("\n" + "="*80)
    print("SPRINT 2 CONTRACTOR OPS B2 TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
