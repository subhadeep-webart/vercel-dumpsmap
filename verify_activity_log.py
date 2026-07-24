#!/usr/bin/env python3
"""Quick verification of activity log"""

import requests

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"
ADMIN_EMAIL = "aj@bisonjunk.com"
ADMIN_PASSWORD = "admin123"

# Login
resp = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
admin_token = resp.json().get('token')

# Get activity log
resp = requests.get(f"{BASE_URL}/admin/activity-log?limit=100",
                   headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)

if resp.status_code == 200:
    data = resp.json()
    print(f"Response keys: {data.keys()}")
    
    # Check both 'logs' and 'activities' keys
    logs = data.get('logs', [])
    activities = data.get('activities', [])
    
    print(f"\nLogs count: {len(logs)}")
    print(f"Activities count: {len(activities)}")
    
    if logs:
        print(f"\nRecent logs (first 5):")
        for log in logs[:5]:
            print(f"  - {log.get('action')} by {log.get('actorEmail')} at {log.get('createdAt')}")
    
    if activities:
        print(f"\nRecent activities (first 5):")
        for activity in activities[:5]:
            print(f"  - {activity.get('action')} by {activity.get('actorEmail')} at {activity.get('createdAt')}")
else:
    print(f"Error: {resp.status_code} {resp.text}")
