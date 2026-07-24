#!/usr/bin/env python3
"""
PR-2a Community Ecosystem Backend Test
Tests newly added Community Groups, Cities, and Admin Community endpoints.
"""

import requests
import json
import sys

BASE_URL = "https://dumpmaps-pilot.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}
ADMIN = {"email": "aj@bisonjunk.com", "password": "admin123"}
REGULAR_USER = {"email": "claimtest@test.com", "password": "pass1234"}

# Global state
tokens = {}
test_data = {}

def login(creds, label):
    """Login and return token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            user = data.get("user")
            print(f"✅ {label} login successful: {user.get('email')} (role: {user.get('role')})")
            return token
        else:
            print(f"❌ {label} login failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ {label} login error: {e}")
        return None

def signup_if_needed(creds, label):
    """Try to signup if user doesn't exist"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": creds["email"],
            "password": creds["password"],
            "name": label
        }, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ {label} signup successful")
            return data.get("token")
        else:
            # User might already exist, try login
            return login(creds, label)
    except Exception as e:
        print(f"❌ {label} signup error: {e}")
        return None

def test_step(step_num, description):
    """Print test step header"""
    print(f"\n{'='*80}")
    print(f"STEP {step_num}: {description}")
    print('='*80)

def main():
    print("PR-2a Community Ecosystem Backend Test")
    print("="*80)
    
    # Setup: Login all users
    test_step(0, "Setup - Login users")
    tokens["super_admin"] = login(SUPER_ADMIN, "Super Admin")
    tokens["admin"] = login(ADMIN, "Admin")
    tokens["regular"] = signup_if_needed(REGULAR_USER, "Regular User")
    
    if not all([tokens["super_admin"], tokens["regular"]]):
        print("\n❌ CRITICAL: Failed to authenticate required users")
        sys.exit(1)
    
    # Test 1: Create test group as super admin
    test_step(1, "POST /api/community/groups - Create test group (jamal)")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={
                "name": "PR2a Test Group",
                "category": "haulers",
                "description": "Test group for PR-2a backend testing",
                "city": "Hayward",
                "state": "CA",
                "tags": ["test", "haulers", "backend"],
                "isPublic": True,
                "rules": ["Be respectful", "No spam"]
            },
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            test_data["group_id"] = group.get("id")
            test_data["group_slug"] = group.get("slug")
            print(f"✅ Group created: {group.get('name')} (id: {group.get('id')}, slug: {group.get('slug')})")
            print(f"   Creator role: {group.get('myRole')} (expected: group_admin)")
            print(f"   Member count: {group.get('memberCount')} (expected: 1)")
            if group.get("myRole") != "group_admin":
                print(f"❌ FAIL: Creator should be group_admin, got {group.get('myRole')}")
            if group.get("memberCount") != 1:
                print(f"❌ FAIL: Member count should be 1, got {group.get('memberCount')}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        sys.exit(1)
    
    # Test 2: Regular user joins the group
    test_step(2, "POST /api/community/groups/:id/join - Regular user joins (claimtest)")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups/{test_data['group_id']}/join",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ User joined successfully, role: {data.get('role')}")
            if data.get("role") != "member":
                print(f"❌ FAIL: Expected role 'member', got {data.get('role')}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 3: Verify member count increased
    test_step(3, "GET /api/community/groups/:id - Verify member count = 2")
    try:
        resp = requests.get(
            f"{BASE_URL}/community/groups/{test_data['group_id']}",
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            print(f"✅ Group fetched: {group.get('name')}")
            print(f"   Member count: {group.get('memberCount')} (expected: 2)")
            print(f"   Owner: {group.get('owner', {}).get('name')}")
            print(f"   Recent members: {len(group.get('recentMembers', []))} members")
            if group.get("memberCount") != 2:
                print(f"❌ FAIL: Expected memberCount 2, got {group.get('memberCount')}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 4: Regular user leaves the group
    test_step(4, "POST /api/community/groups/:id/leave - Regular user leaves")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups/{test_data['group_id']}/leave",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"✅ User left successfully")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 5: Verify member count decreased
    test_step(5, "GET /api/community/groups/:id - Verify member count = 1")
    try:
        resp = requests.get(
            f"{BASE_URL}/community/groups/{test_data['group_id']}",
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            print(f"✅ Member count: {group.get('memberCount')} (expected: 1)")
            if group.get("memberCount") != 1:
                print(f"❌ FAIL: Expected memberCount 1, got {group.get('memberCount')}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 6: Regular user tries to PATCH the group (should fail)
    test_step(6, "PATCH /api/community/groups/:id - Non-member tries to edit (should 403)")
    try:
        resp = requests.patch(
            f"{BASE_URL}/community/groups/{test_data['group_id']}",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            json={"description": "Hacked description"},
            timeout=10
        )
        if resp.status_code == 403:
            print(f"✅ Correctly blocked non-member edit (403)")
        else:
            print(f"❌ FAIL: Expected 403, got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 7: Owner (jamal) PATCHes the group successfully
    test_step(7, "PATCH /api/community/groups/:id - Owner edits description")
    try:
        resp = requests.patch(
            f"{BASE_URL}/community/groups/{test_data['group_id']}",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"description": "Updated description by owner"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            print(f"✅ Group updated: {group.get('description')}")
            if group.get("description") != "Updated description by owner":
                print(f"❌ FAIL: Description not updated correctly")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 8: Regular user joins again, then create a post with groupId
    test_step(8, "Regular user joins again + creates post with groupId")
    try:
        # Join
        resp = requests.post(
            f"{BASE_URL}/community/groups/{test_data['group_id']}/join",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"✅ User rejoined")
        
        # Create post
        resp = requests.post(
            f"{BASE_URL}/community/posts",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            json={
                "category": "general",
                "title": "Test post in group",
                "body": "This is a test post for PR-2a",
                "groupId": test_data['group_id'],
                "city": "Hayward",
                "state": "CA"
            },
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            post = data.get("post")
            test_data["post_id"] = post.get("id")
            print(f"✅ Post created: {post.get('title')} (id: {post.get('id')})")
        else:
            print(f"❌ FAIL: Post creation failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 9: GET group posts
    test_step(9, "GET /api/community/groups/:id/posts - Verify post appears")
    try:
        resp = requests.get(
            f"{BASE_URL}/community/groups/{test_data['group_id']}/posts",
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            posts = data.get("posts", [])
            print(f"✅ Group posts fetched: {len(posts)} post(s)")
            if len(posts) > 0:
                post = posts[0]
                print(f"   Post: {post.get('title')}")
                print(f"   Author: {post.get('author', {}).get('name')} (profileType: {post.get('author', {}).get('profileType')})")
            else:
                print(f"❌ FAIL: Expected at least 1 post, got {len(posts)}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 10: Owner kicks the regular user
    test_step(10, "DELETE /api/community/groups/:id/members/:userId - Owner kicks member")
    try:
        # First get the regular user's ID
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            timeout=10
        )
        if resp.status_code == 200:
            regular_user_id = resp.json().get("user", {}).get("id")
            
            # Now kick
            resp = requests.delete(
                f"{BASE_URL}/community/groups/{test_data['group_id']}/members/{regular_user_id}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
            if resp.status_code == 200:
                print(f"✅ Member kicked successfully")
                
                # Verify member count
                resp = requests.get(
                    f"{BASE_URL}/community/groups/{test_data['group_id']}",
                    timeout=10
                )
                if resp.status_code == 200:
                    group = resp.json().get("group")
                    print(f"   Member count after kick: {group.get('memberCount')} (expected: 1)")
                    if group.get("memberCount") != 1:
                        print(f"❌ FAIL: Expected memberCount 1, got {group.get('memberCount')}")
            else:
                print(f"❌ FAIL: {resp.status_code} - {resp.text}")
        else:
            print(f"❌ FAIL: Could not get regular user ID")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 11: Owner tries to leave own group (should fail)
    test_step(11, "POST /api/community/groups/:id/leave - Owner tries to leave (should 400)")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups/{test_data['group_id']}/leave",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            timeout=10
        )
        if resp.status_code == 400:
            data = resp.json()
            print(f"✅ Correctly blocked owner from leaving (400): {data.get('error')}")
            if "transfer ownership" not in data.get("error", "").lower():
                print(f"❌ FAIL: Expected 'transfer ownership' message")
        else:
            print(f"❌ FAIL: Expected 400, got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 12: GET /api/community/cities
    test_step(12, "GET /api/community/cities - Verify predefined CA cities + counts")
    try:
        resp = requests.get(f"{BASE_URL}/community/cities", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            cities = data.get("cities", [])
            print(f"✅ Cities fetched: {len(cities)} cities")
            
            # Check for predefined cities
            predefined = ["Hayward", "San Jose", "Milpitas", "Oakland", "Fremont", "Santa Clara", 
                         "Gilroy", "Monterey", "Santa Cruz", "Sacramento", "Fresno", "San Francisco"]
            found_predefined = [c.get("name") for c in cities if c.get("name") in predefined]
            print(f"   Predefined cities found: {len(found_predefined)}/12")
            
            # Check Hayward has counts (we created a group there)
            hayward = next((c for c in cities if c.get("name") == "Hayward"), None)
            if hayward:
                print(f"   Hayward: posts={hayward.get('posts')}, groups={hayward.get('groups')}")
                if hayward.get("groups") < 1:
                    print(f"❌ FAIL: Hayward should have at least 1 group")
            else:
                print(f"❌ FAIL: Hayward not found in cities list")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 13: GET /api/admin/community/stats (super_admin)
    test_step(13, "GET /api/admin/community/stats - Super admin gets stats")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/community/stats",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Stats fetched:")
            print(f"   Posts: total={data.get('posts', {}).get('total')}, last7={data.get('posts', {}).get('last7')}, last30={data.get('posts', {}).get('last30')}")
            print(f"   Comments: total={data.get('comments', {}).get('total')}")
            print(f"   Reactions: total={data.get('reactions', {}).get('total')}")
            print(f"   Groups: total={data.get('groups', {}).get('total')}, members={data.get('groups', {}).get('members')}")
            print(f"   Categories: {len(data.get('categories', []))} categories")
            print(f"   Top groups: {len(data.get('topGroups', []))} groups")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 14: PATCH /api/admin/community/groups/:id - Feature the group
    test_step(14, "PATCH /api/admin/community/groups/:id - Admin features group")
    try:
        resp = requests.patch(
            f"{BASE_URL}/admin/community/groups/{test_data['group_id']}",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"action": "feature"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            print(f"✅ Group featured: featured={group.get('featured')}")
            if not group.get("featured"):
                print(f"❌ FAIL: Group should be featured")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 15: Regular user tries to access admin endpoints (should 403)
    test_step(15, "GET /api/admin/community/groups - Regular user (should 403)")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/community/groups",
            headers={"Authorization": f"Bearer {tokens['regular']}"},
            timeout=10
        )
        if resp.status_code == 403:
            print(f"✅ Correctly blocked regular user from admin endpoint (403)")
        else:
            print(f"❌ FAIL: Expected 403, got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 16: Owner DELETEs the group (soft delete)
    test_step(16, "DELETE /api/community/groups/:id - Owner soft-deletes group")
    try:
        resp = requests.delete(
            f"{BASE_URL}/community/groups/{test_data['group_id']}",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            timeout=10
        )
        if resp.status_code == 200:
            print(f"✅ Group soft-deleted")
            
            # Verify it's removed
            resp = requests.get(
                f"{BASE_URL}/community/groups/{test_data['group_id']}",
                timeout=10
            )
            if resp.status_code == 404:
                print(f"✅ Group correctly returns 404 after soft delete")
            else:
                print(f"❌ FAIL: Expected 404, got {resp.status_code}")
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 17: Test slug lookup
    test_step(17, "Create new group and test slug lookup")
    try:
        # Create group with same name to test slug uniqueness
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={
                "name": "PR2a Test Group",
                "category": "cleanup",
                "city": "San Jose"
            },
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            group = data.get("group")
            slug = group.get("slug")
            print(f"✅ New group created with slug: {slug}")
            
            # Test slug lookup
            resp = requests.get(f"{BASE_URL}/community/groups/{slug}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                fetched_group = data.get("group")
                print(f"✅ Group fetched by slug: {fetched_group.get('name')}")
                if fetched_group.get("id") != group.get("id"):
                    print(f"❌ FAIL: Slug lookup returned wrong group")
            else:
                print(f"❌ FAIL: Slug lookup failed: {resp.status_code}")
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/community/groups/{group.get('id')}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
        else:
            print(f"❌ FAIL: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 18: Test invalid category
    test_step(18, "POST /api/community/groups - Invalid category (should 400)")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={
                "name": "Invalid Category Group",
                "category": "invalid_category"
            },
            timeout=10
        )
        if resp.status_code == 400:
            print(f"✅ Correctly rejected invalid category (400)")
        else:
            print(f"❌ FAIL: Expected 400, got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 19: Test missing required fields
    test_step(19, "POST /api/community/groups - Missing name (should 400)")
    try:
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"category": "haulers"},
            timeout=10
        )
        if resp.status_code == 400:
            print(f"✅ Correctly rejected missing name (400)")
        else:
            print(f"❌ FAIL: Expected 400, got {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 20: Test GET /api/community/groups with filters
    test_step(20, "GET /api/community/groups - Test filters (city, category, q, limit)")
    try:
        # Create test groups
        test_groups = []
        for i, cat in enumerate(["haulers", "cleanup", "reuse"]):
            resp = requests.post(
                f"{BASE_URL}/community/groups",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                json={
                    "name": f"Filter Test {cat.title()}",
                    "category": cat,
                    "city": "Oakland" if i == 0 else "Fremont",
                    "tags": ["filter-test"]
                },
                timeout=10
            )
            if resp.status_code == 200:
                test_groups.append(resp.json().get("group"))
        
        print(f"✅ Created {len(test_groups)} test groups")
        
        # Test city filter
        resp = requests.get(f"{BASE_URL}/community/groups?city=Oakland", timeout=10)
        if resp.status_code == 200:
            groups = resp.json().get("groups", [])
            oakland_groups = [g for g in groups if g.get("city") == "Oakland"]
            print(f"✅ City filter: {len(oakland_groups)} Oakland groups")
        
        # Test category filter
        resp = requests.get(f"{BASE_URL}/community/groups?category=haulers", timeout=10)
        if resp.status_code == 200:
            groups = resp.json().get("groups", [])
            hauler_groups = [g for g in groups if g.get("category") == "haulers"]
            print(f"✅ Category filter: {len(hauler_groups)} hauler groups")
        
        # Test search query
        resp = requests.get(f"{BASE_URL}/community/groups?q=Filter+Test", timeout=10)
        if resp.status_code == 200:
            groups = resp.json().get("groups", [])
            print(f"✅ Search query: {len(groups)} groups matching 'Filter Test'")
        
        # Test limit
        resp = requests.get(f"{BASE_URL}/community/groups?limit=2", timeout=10)
        if resp.status_code == 200:
            groups = resp.json().get("groups", [])
            print(f"✅ Limit filter: {len(groups)} groups (limit=2)")
            if len(groups) > 2:
                print(f"❌ FAIL: Expected max 2 groups, got {len(groups)}")
        
        # Cleanup
        for group in test_groups:
            requests.delete(
                f"{BASE_URL}/community/groups/{group.get('id')}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 21: Test member role promotion
    test_step(21, "PATCH /api/community/groups/:id/members/:userId/role - Promote member")
    try:
        # Create new group
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"name": "Role Test Group", "category": "general", "city": "Hayward"},
            timeout=10
        )
        if resp.status_code == 200:
            group = resp.json().get("group")
            group_id = group.get("id")
            
            # Regular user joins
            resp = requests.post(
                f"{BASE_URL}/community/groups/{group_id}/join",
                headers={"Authorization": f"Bearer {tokens['regular']}"},
                timeout=10
            )
            
            # Get regular user ID
            resp = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {tokens['regular']}"},
                timeout=10
            )
            regular_user_id = resp.json().get("user", {}).get("id")
            
            # Owner promotes member to group_admin
            resp = requests.patch(
                f"{BASE_URL}/community/groups/{group_id}/members/{regular_user_id}/role",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                json={"role": "group_admin"},
                timeout=10
            )
            if resp.status_code == 200:
                print(f"✅ Member promoted to group_admin")
                
                # Verify role
                resp = requests.get(
                    f"{BASE_URL}/community/groups/{group_id}/members",
                    timeout=10
                )
                if resp.status_code == 200:
                    members = resp.json().get("members", [])
                    promoted_member = next((m for m in members if m.get("id") == regular_user_id), None)
                    if promoted_member and promoted_member.get("role") == "group_admin":
                        print(f"✅ Role verified: {promoted_member.get('role')}")
                    else:
                        print(f"❌ FAIL: Role not updated correctly")
            else:
                print(f"❌ FAIL: {resp.status_code} - {resp.text}")
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/community/groups/{group_id}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 22: Test invalid role value
    test_step(22, "PATCH /api/community/groups/:id/members/:userId/role - Invalid role (should 400)")
    try:
        # Create new group
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"name": "Invalid Role Test", "category": "general"},
            timeout=10
        )
        if resp.status_code == 200:
            group_id = resp.json().get("group", {}).get("id")
            
            # Try to set invalid role
            resp = requests.patch(
                f"{BASE_URL}/community/groups/{group_id}/members/fake-user-id/role",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                json={"role": "super_admin"},
                timeout=10
            )
            if resp.status_code == 400:
                print(f"✅ Correctly rejected invalid role (400)")
            else:
                print(f"❌ FAIL: Expected 400, got {resp.status_code}")
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/community/groups/{group_id}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # Test 23: Test cannot kick owner
    test_step(23, "DELETE /api/community/groups/:id/members/:ownerId - Cannot kick owner (should 400)")
    try:
        # Create new group
        resp = requests.post(
            f"{BASE_URL}/community/groups",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"},
            json={"name": "Kick Owner Test", "category": "general"},
            timeout=10
        )
        if resp.status_code == 200:
            group = resp.json().get("group")
            group_id = group.get("id")
            
            # Get owner ID
            resp = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
            owner_id = resp.json().get("user", {}).get("id")
            
            # Try to kick owner
            resp = requests.delete(
                f"{BASE_URL}/community/groups/{group_id}/members/{owner_id}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
            if resp.status_code == 400:
                data = resp.json()
                print(f"✅ Correctly blocked kicking owner (400): {data.get('error')}")
            else:
                print(f"❌ FAIL: Expected 400, got {resp.status_code}")
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/community/groups/{group_id}",
                headers={"Authorization": f"Bearer {tokens['super_admin']}"},
                timeout=10
            )
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    print("\n" + "="*80)
    print("PR-2a Community Ecosystem Backend Test Complete")
    print("="*80)

if __name__ == "__main__":
    main()
