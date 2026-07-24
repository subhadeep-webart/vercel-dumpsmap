#!/usr/bin/env python3
"""
PR-2b Backend Test Suite
Tests four new task suites:
1. DM (Direct Messages)
2. Community Group Chat
3. Reviews & Recommendations
4. Unified Inbox unread-count
"""

import requests
import json
import os
import time
from datetime import datetime

# Load base URL from .env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://dumpmaps-pilot.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
SUPER_ADMIN = {"email": "jamal@dumpmaps.org", "password": "@@Jefferson2180"}
ADMIN = {"email": "aj@bisonjunk.com", "password": "admin123"}
REGULAR = {"email": "claimtest@test.com", "password": "pass1234"}

# Global tokens
tokens = {}
users = {}

def login(creds, label):
    """Login and store token"""
    try:
        resp = requests.post(f"{API_URL}/auth/login", json=creds, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            tokens[label] = data.get('token')
            users[label] = data.get('user', {})
            print(f"✅ {label} login successful (user: {users[label].get('name', 'Unknown')})")
            return True
        else:
            print(f"❌ {label} login failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ {label} login error: {e}")
        return False

def signup_user(email, password, name):
    """Create a new user"""
    try:
        resp = requests.post(f"{API_URL}/auth/signup", json={
            "email": email,
            "password": password,
            "name": name
        }, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ User signup successful: {name} ({email})")
            return data.get('user', {})
        else:
            print(f"❌ User signup failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ User signup error: {e}")
        return None

def headers(label):
    """Get auth headers for a user"""
    return {"Authorization": f"Bearer {tokens.get(label, '')}"} if tokens.get(label) else {}

def test_dm_suite():
    """Test DM (Direct Messages) suite"""
    print("\n" + "="*80)
    print("TEST SUITE 1: DM (DIRECT MESSAGES)")
    print("="*80)
    
    # Create two test users for DM testing
    timestamp = int(time.time())
    user_a_email = f"dm_user_a_{timestamp}@test.com"
    user_b_email = f"dm_user_b_{timestamp}@test.com"
    
    print("\n--- Step 1: Create two test users (A & B) ---")
    user_a = signup_user(user_a_email, "password123", "DM User A")
    user_b = signup_user(user_b_email, "password123", "DM User B")
    
    if not user_a or not user_b:
        print("❌ Failed to create test users")
        return False
    
    # Login both users
    if not login({"email": user_a_email, "password": "password123"}, "user_a"):
        return False
    if not login({"email": user_b_email, "password": "password123"}, "user_b"):
        return False
    
    user_a_id = users['user_a']['id']
    user_b_id = users['user_b']['id']
    
    print("\n--- Step 2: POST /api/dm/threads (A creates thread with B) ---")
    try:
        resp = requests.post(f"{API_URL}/dm/threads", 
                           json={"userId": user_b_id}, 
                           headers=headers("user_a"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            thread_id = data['thread']['threadId']
            # Verify deterministic threadId format: dm_<min>_<max>
            expected_tid = f"dm_{min(user_a_id, user_b_id)}_{max(user_a_id, user_b_id)}"
            if thread_id == expected_tid:
                print(f"✅ Thread created with deterministic ID: {thread_id}")
            else:
                print(f"❌ Thread ID mismatch. Expected: {expected_tid}, Got: {thread_id}")
                return False
        else:
            print(f"❌ Create thread failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Create thread error: {e}")
        return False
    
    print("\n--- Step 3: Self-DM validation (should return 400) ---")
    try:
        resp = requests.post(f"{API_URL}/dm/threads", 
                           json={"userId": user_a_id}, 
                           headers=headers("user_a"), 
                           timeout=10)
        if resp.status_code == 400:
            print(f"✅ Self-DM correctly rejected (400): {resp.json().get('error')}")
        else:
            print(f"❌ Self-DM should return 400, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Self-DM test error: {e}")
        return False
    
    print("\n--- Step 4: Unknown user validation (should return 404) ---")
    try:
        resp = requests.post(f"{API_URL}/dm/threads", 
                           json={"userId": "nonexistent-user-id-12345"}, 
                           headers=headers("user_a"), 
                           timeout=10)
        if resp.status_code == 404:
            print(f"✅ Unknown user correctly rejected (404): {resp.json().get('error')}")
        else:
            print(f"❌ Unknown user should return 404, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Unknown user test error: {e}")
        return False
    
    print("\n--- Step 5: No auth validation (should return 401) ---")
    try:
        resp = requests.post(f"{API_URL}/dm/threads", 
                           json={"userId": user_b_id}, 
                           timeout=10)
        if resp.status_code == 401:
            print(f"✅ No auth correctly rejected (401): {resp.json().get('error')}")
        else:
            print(f"❌ No auth should return 401, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ No auth test error: {e}")
        return False
    
    print("\n--- Step 6: POST messages from A → B ---")
    try:
        # Message 1 from A
        resp1 = requests.post(f"{API_URL}/dm/threads/{thread_id}/messages", 
                            json={"body": "Hello from A, message 1"}, 
                            headers=headers("user_a"), 
                            timeout=10)
        if resp1.status_code != 200:
            print(f"❌ Message 1 failed: {resp1.status_code} - {resp1.text}")
            return False
        
        time.sleep(0.5)
        
        # Message 2 from A
        resp2 = requests.post(f"{API_URL}/dm/threads/{thread_id}/messages", 
                            json={"body": "Hello from A, message 2"}, 
                            headers=headers("user_a"), 
                            timeout=10)
        if resp2.status_code != 200:
            print(f"❌ Message 2 failed: {resp2.status_code} - {resp2.text}")
            return False
        
        print(f"✅ Two messages sent from A to B")
    except Exception as e:
        print(f"❌ Send messages error: {e}")
        return False
    
    print("\n--- Step 7: GET messages as B (should return both in chronological order) ---")
    try:
        resp = requests.get(f"{API_URL}/dm/threads/{thread_id}/messages", 
                          headers=headers("user_b"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get('messages', [])
            if len(messages) == 2:
                if messages[0]['body'] == "Hello from A, message 1" and messages[1]['body'] == "Hello from A, message 2":
                    print(f"✅ Both messages returned in chronological order")
                    print(f"   Message 1: {messages[0]['body']}")
                    print(f"   Message 2: {messages[1]['body']}")
                else:
                    print(f"❌ Messages not in expected order")
                    return False
            else:
                print(f"❌ Expected 2 messages, got {len(messages)}")
                return False
        else:
            print(f"❌ Get messages failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Get messages error: {e}")
        return False
    
    print("\n--- Step 8: Verify B's GET marked messages as read ---")
    try:
        # GET threads as A (sender) - should show 0 unread
        resp_a = requests.get(f"{API_URL}/dm/threads", 
                            headers=headers("user_a"), 
                            timeout=10)
        if resp_a.status_code == 200:
            data_a = resp_a.json()
            threads_a = data_a.get('threads', [])
            if threads_a:
                unread_a = threads_a[0].get('unread', -1)
                if unread_a == 0:
                    print(f"✅ A (sender) shows 0 unread messages (correct)")
                else:
                    print(f"❌ A (sender) should show 0 unread, got {unread_a}")
                    return False
            else:
                print(f"❌ A has no threads")
                return False
        else:
            print(f"❌ Get threads as A failed: {resp_a.status_code}")
            return False
        
        # GET threads as B (receiver) - should show 0 unread after reading
        resp_b = requests.get(f"{API_URL}/dm/threads", 
                            headers=headers("user_b"), 
                            timeout=10)
        if resp_b.status_code == 200:
            data_b = resp_b.json()
            threads_b = data_b.get('threads', [])
            if threads_b:
                unread_b = threads_b[0].get('unread', -1)
                if unread_b == 0:
                    print(f"✅ B (receiver) shows 0 unread after reading (correct)")
                else:
                    print(f"❌ B (receiver) should show 0 unread after reading, got {unread_b}")
                    return False
            else:
                print(f"❌ B has no threads")
                return False
        else:
            print(f"❌ Get threads as B failed: {resp_b.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify read status error: {e}")
        return False
    
    print("\n--- Step 9: Foreign threadId validation (should return 403) ---")
    try:
        # Create a third user
        user_c_email = f"dm_user_c_{timestamp}@test.com"
        user_c = signup_user(user_c_email, "password123", "DM User C")
        if not user_c:
            print("❌ Failed to create user C")
            return False
        login({"email": user_c_email, "password": "password123"}, "user_c")
        
        # Try to access A-B thread as C
        resp = requests.get(f"{API_URL}/dm/threads/{thread_id}/messages", 
                          headers=headers("user_c"), 
                          timeout=10)
        if resp.status_code == 403:
            print(f"✅ Foreign threadId correctly rejected (403): {resp.json().get('error')}")
        else:
            print(f"❌ Foreign threadId should return 403, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Foreign threadId test error: {e}")
        return False
    
    print("\n--- Step 10: Empty body and photos validation (should return 400) ---")
    try:
        resp = requests.post(f"{API_URL}/dm/threads/{thread_id}/messages", 
                           json={"body": "", "photos": []}, 
                           headers=headers("user_a"), 
                           timeout=10)
        if resp.status_code == 400:
            print(f"✅ Empty body/photos correctly rejected (400): {resp.json().get('error')}")
        else:
            print(f"❌ Empty body/photos should return 400, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Empty validation test error: {e}")
        return False
    
    print("\n✅ DM SUITE: ALL TESTS PASSED")
    return True

def test_group_chat_suite():
    """Test Community Group Chat suite"""
    print("\n" + "="*80)
    print("TEST SUITE 2: COMMUNITY GROUP CHAT")
    print("="*80)
    
    # Login super admin and regular user
    if not login(SUPER_ADMIN, "super_admin"):
        return False
    if not login(REGULAR, "regular"):
        return False
    
    # Create a third user for non-member testing
    timestamp = int(time.time())
    non_member_email = f"non_member_{timestamp}@test.com"
    non_member = signup_user(non_member_email, "password123", "Non Member User")
    if not non_member:
        print("❌ Failed to create non-member user")
        return False
    login({"email": non_member_email, "password": "password123"}, "non_member")
    
    print("\n--- Step 1: Super admin creates a community group ---")
    try:
        group_data = {
            "name": f"PR2b Test Group {timestamp}",
            "description": "Test group for PR2b group chat testing",
            "category": "haulers",
            "city": "Hayward"
        }
        resp = requests.post(f"{API_URL}/community/groups", 
                           json=group_data, 
                           headers=headers("super_admin"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            group_id = data['group']['id']
            print(f"✅ Group created: {data['group']['name']} (ID: {group_id})")
        else:
            print(f"❌ Create group failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Create group error: {e}")
        return False
    
    print("\n--- Step 2: Regular user joins the group ---")
    try:
        resp = requests.post(f"{API_URL}/community/groups/{group_id}/join", 
                           headers=headers("regular"), 
                           timeout=10)
        if resp.status_code == 200:
            print(f"✅ Regular user joined the group")
        else:
            print(f"❌ Join group failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Join group error: {e}")
        return False
    
    print("\n--- Step 3: Non-member GET chat (should return 403) ---")
    try:
        resp = requests.get(f"{API_URL}/community/groups/{group_id}/chat", 
                          headers=headers("non_member"), 
                          timeout=10)
        if resp.status_code == 403:
            print(f"✅ Non-member correctly rejected (403): {resp.json().get('error')}")
        else:
            print(f"❌ Non-member should return 403, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Non-member test error: {e}")
        return False
    
    print("\n--- Step 4: Member GET chat (should return 200 with empty array) ---")
    try:
        resp = requests.get(f"{API_URL}/community/groups/{group_id}/chat", 
                          headers=headers("regular"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get('messages', [])
            if len(messages) == 0:
                print(f"✅ Member GET chat returned empty array (correct)")
            else:
                print(f"❌ Expected empty array, got {len(messages)} messages")
                return False
        else:
            print(f"❌ Member GET chat failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Member GET chat error: {e}")
        return False
    
    print("\n--- Step 5: Member POST message (should return 200 with enriched author) ---")
    try:
        resp = requests.post(f"{API_URL}/community/groups/{group_id}/chat", 
                           json={"body": "Hello from regular user"}, 
                           headers=headers("regular"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            message = data.get('message', {})
            author = message.get('author', {})
            if author.get('id') and author.get('name'):
                print(f"✅ Message posted with enriched author: {author.get('name')}")
                msg_id_regular = message.get('id')
            else:
                print(f"❌ Author not enriched properly")
                return False
        else:
            print(f"❌ POST message failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ POST message error: {e}")
        return False
    
    print("\n--- Step 6: Super admin posts a message ---")
    try:
        resp = requests.post(f"{API_URL}/community/groups/{group_id}/chat", 
                           json={"body": "Hello from super admin"}, 
                           headers=headers("super_admin"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            msg_id_admin = data['message']['id']
            print(f"✅ Super admin message posted (ID: {msg_id_admin})")
        else:
            print(f"❌ Super admin POST failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Super admin POST error: {e}")
        return False
    
    print("\n--- Step 7: Author DELETE their own message (should succeed) ---")
    try:
        resp = requests.delete(f"{API_URL}/community/groups/chat/{msg_id_regular}", 
                             headers=headers("regular"), 
                             timeout=10)
        if resp.status_code == 200:
            print(f"✅ Author successfully deleted their own message")
        else:
            print(f"❌ Author DELETE failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Author DELETE error: {e}")
        return False
    
    print("\n--- Step 8: Verify soft delete (message no longer in GET) ---")
    try:
        resp = requests.get(f"{API_URL}/community/groups/{group_id}/chat", 
                          headers=headers("regular"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get('messages', [])
            # Should only have admin's message now
            if len(messages) == 1 and messages[0]['body'] == "Hello from super admin":
                print(f"✅ Soft delete verified: deleted message not returned")
            else:
                print(f"❌ Expected 1 message (admin's), got {len(messages)}")
                return False
        else:
            print(f"❌ GET chat failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify soft delete error: {e}")
        return False
    
    print("\n--- Step 9: Non-author non-staff DELETE (should return 403) ---")
    try:
        # Regular user tries to delete admin's message
        resp = requests.delete(f"{API_URL}/community/groups/chat/{msg_id_admin}", 
                             headers=headers("regular"), 
                             timeout=10)
        if resp.status_code == 403:
            print(f"✅ Non-author non-staff DELETE correctly rejected (403)")
        else:
            print(f"❌ Non-author DELETE should return 403, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Non-author DELETE test error: {e}")
        return False
    
    print("\n--- Step 10: Staff DELETE (should succeed) ---")
    try:
        # Super admin deletes their own message (staff can delete any)
        resp = requests.delete(f"{API_URL}/community/groups/chat/{msg_id_admin}", 
                             headers=headers("super_admin"), 
                             timeout=10)
        if resp.status_code == 200:
            print(f"✅ Staff successfully deleted message")
        else:
            print(f"❌ Staff DELETE failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Staff DELETE error: {e}")
        return False
    
    print("\n--- Step 11: GET on removed group (should return 404) ---")
    try:
        # First, delete the group
        resp_del = requests.delete(f"{API_URL}/community/groups/{group_id}", 
                                  headers=headers("super_admin"), 
                                  timeout=10)
        if resp_del.status_code != 200:
            print(f"⚠️  Group deletion returned: {resp_del.status_code}")
        
        # Now try to GET chat
        resp = requests.get(f"{API_URL}/community/groups/{group_id}/chat", 
                          headers=headers("regular"), 
                          timeout=10)
        if resp.status_code == 404:
            print(f"✅ GET on removed group correctly returned 404")
        else:
            print(f"❌ GET on removed group should return 404, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Removed group test error: {e}")
        return False
    
    print("\n--- Step 12: Empty body and photos validation (should return 400) ---")
    # Create a new group for this test
    try:
        group_data2 = {
            "name": f"PR2b Test Group 2 {timestamp}",
            "description": "Test group for validation",
            "category": "cleanup",
            "city": "San Jose"
        }
        resp = requests.post(f"{API_URL}/community/groups", 
                           json=group_data2, 
                           headers=headers("super_admin"), 
                           timeout=10)
        if resp.status_code == 200:
            group_id2 = resp.json()['group']['id']
            
            # Try to post empty message
            resp_empty = requests.post(f"{API_URL}/community/groups/{group_id2}/chat", 
                                     json={"body": "", "photos": []}, 
                                     headers=headers("super_admin"), 
                                     timeout=10)
            if resp_empty.status_code == 400:
                print(f"✅ Empty body/photos correctly rejected (400): {resp_empty.json().get('error')}")
            else:
                print(f"❌ Empty body/photos should return 400, got: {resp_empty.status_code}")
                return False
        else:
            print(f"❌ Create test group 2 failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Empty validation test error: {e}")
        return False
    
    print("\n✅ GROUP CHAT SUITE: ALL TESTS PASSED")
    return True

def test_reviews_suite():
    """Test Reviews & Recommendations suite"""
    print("\n" + "="*80)
    print("TEST SUITE 3: REVIEWS & RECOMMENDATIONS")
    print("="*80)
    
    # Create test users
    timestamp = int(time.time())
    reviewer_email = f"reviewer_{timestamp}@test.com"
    contractor_email = f"contractor_{timestamp}@test.com"
    other_user_email = f"other_user_{timestamp}@test.com"
    
    print("\n--- Step 1: Create test users (reviewer, contractor, other) ---")
    reviewer = signup_user(reviewer_email, "password123", "Reviewer User")
    contractor = signup_user(contractor_email, "password123", "Contractor User")
    other_user = signup_user(other_user_email, "password123", "Other User")
    
    if not reviewer or not contractor or not other_user:
        print("❌ Failed to create test users")
        return False
    
    login({"email": reviewer_email, "password": "password123"}, "reviewer")
    login({"email": contractor_email, "password": "password123"}, "contractor")
    login({"email": other_user_email, "password": "password123"}, "other_user")
    
    reviewer_id = users['reviewer']['id']
    contractor_id = users['contractor']['id']
    other_user_id = users['other_user']['id']
    
    print("\n--- Step 2: POST review (reviewer → contractor, rating=5) ---")
    try:
        resp = requests.post(f"{API_URL}/reviews/contractor", 
                           json={
                               "contractorUserId": contractor_id,
                               "rating": 5,
                               "text": "Great work, very professional!"
                           }, 
                           headers=headers("reviewer"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            review_id = data['review']['id']
            print(f"✅ Review created (ID: {review_id}, rating: 5)")
        else:
            print(f"❌ POST review failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ POST review error: {e}")
        return False
    
    print("\n--- Step 3: Verify contractor rating updated ---")
    try:
        resp = requests.get(f"{API_URL}/recommendations/contractors/{contractor_id}", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            contractor_data = data.get('contractor', {})
            rating = contractor_data.get('contractorRating', 0)
            review_count = contractor_data.get('contractorReviewCount', 0)
            if rating == 5.0 and review_count == 1:
                print(f"✅ Contractor rating updated: {rating} ({review_count} review)")
            else:
                print(f"❌ Expected rating=5.0, count=1, got rating={rating}, count={review_count}")
                return False
        else:
            print(f"❌ GET contractor failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify rating error: {e}")
        return False
    
    print("\n--- Step 4: Re-POST review (upsert, rating=3) ---")
    try:
        resp = requests.post(f"{API_URL}/reviews/contractor", 
                           json={
                               "contractorUserId": contractor_id,
                               "rating": 3,
                               "text": "Updated review - decent work"
                           }, 
                           headers=headers("reviewer"), 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            updated_review_id = data['review']['id']
            if updated_review_id == review_id:
                print(f"✅ Review upserted (same ID: {review_id}, new rating: 3)")
            else:
                print(f"❌ Expected same review ID, got different: {updated_review_id}")
                return False
        else:
            print(f"❌ Re-POST review failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Re-POST review error: {e}")
        return False
    
    print("\n--- Step 5: Verify rating updated to 3 ---")
    try:
        resp = requests.get(f"{API_URL}/recommendations/contractors/{contractor_id}", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            contractor_data = data.get('contractor', {})
            rating = contractor_data.get('contractorRating', 0)
            review_count = contractor_data.get('contractorReviewCount', 0)
            if rating == 3.0 and review_count == 1:
                print(f"✅ Contractor rating updated: {rating} ({review_count} review)")
            else:
                print(f"❌ Expected rating=3.0, count=1, got rating={rating}, count={review_count}")
                return False
        else:
            print(f"❌ GET contractor failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify updated rating error: {e}")
        return False
    
    print("\n--- Step 6: GET reviews (should return 1 review, aggregate correct) ---")
    try:
        resp = requests.get(f"{API_URL}/reviews?target=contractor&targetId={contractor_id}", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            reviews = data.get('reviews', [])
            aggregate = data.get('aggregate', {})
            if len(reviews) == 1 and aggregate.get('count') == 1 and aggregate.get('average') == 3.0:
                print(f"✅ GET reviews returned 1 review, aggregate: count=1, average=3.0")
            else:
                print(f"❌ Expected 1 review with avg=3.0, got {len(reviews)} reviews, avg={aggregate.get('average')}")
                return False
        else:
            print(f"❌ GET reviews failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET reviews error: {e}")
        return False
    
    print("\n--- Step 7: Self-review validation (should return 400) ---")
    try:
        resp = requests.post(f"{API_URL}/reviews/contractor", 
                           json={
                               "contractorUserId": reviewer_id,
                               "rating": 5,
                               "text": "I'm great!"
                           }, 
                           headers=headers("reviewer"), 
                           timeout=10)
        if resp.status_code == 400:
            print(f"✅ Self-review correctly rejected (400): {resp.json().get('error')}")
        else:
            print(f"❌ Self-review should return 400, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Self-review test error: {e}")
        return False
    
    print("\n--- Step 8: Missing fields validation (should return 400) ---")
    try:
        resp = requests.post(f"{API_URL}/reviews/contractor", 
                           json={"contractorUserId": contractor_id}, 
                           headers=headers("reviewer"), 
                           timeout=10)
        if resp.status_code == 400:
            print(f"✅ Missing fields correctly rejected (400): {resp.json().get('error')}")
        else:
            print(f"❌ Missing fields should return 400, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Missing fields test error: {e}")
        return False
    
    print("\n--- Step 9: No auth validation (should return 401) ---")
    try:
        resp = requests.post(f"{API_URL}/reviews/contractor", 
                           json={
                               "contractorUserId": contractor_id,
                               "rating": 5,
                               "text": "Great!"
                           }, 
                           timeout=10)
        if resp.status_code == 401:
            print(f"✅ No auth correctly rejected (401): {resp.json().get('error')}")
        else:
            print(f"❌ No auth should return 401, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ No auth test error: {e}")
        return False
    
    print("\n--- Step 10: PATCH review as author (should succeed) ---")
    try:
        resp = requests.patch(f"{API_URL}/reviews/{review_id}", 
                            json={"rating": 4, "text": "Updated to 4 stars"}, 
                            headers=headers("reviewer"), 
                            timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            updated_rating = data['review']['rating']
            if updated_rating == 4:
                print(f"✅ Review updated by author (new rating: 4)")
            else:
                print(f"❌ Expected rating=4, got {updated_rating}")
                return False
        else:
            print(f"❌ PATCH review failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ PATCH review error: {e}")
        return False
    
    print("\n--- Step 11: PATCH review as different non-staff user (should return 403) ---")
    try:
        resp = requests.patch(f"{API_URL}/reviews/{review_id}", 
                            json={"rating": 5}, 
                            headers=headers("other_user"), 
                            timeout=10)
        if resp.status_code == 403:
            print(f"✅ Non-author PATCH correctly rejected (403)")
        else:
            print(f"❌ Non-author PATCH should return 403, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Non-author PATCH test error: {e}")
        return False
    
    print("\n--- Step 12: DELETE review (should succeed) ---")
    try:
        resp = requests.delete(f"{API_URL}/reviews/{review_id}", 
                             headers=headers("reviewer"), 
                             timeout=10)
        if resp.status_code == 200:
            print(f"✅ Review deleted successfully")
        else:
            print(f"❌ DELETE review failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ DELETE review error: {e}")
        return False
    
    print("\n--- Step 13: Verify aggregate recomputed (count=0, rating=0) ---")
    try:
        resp = requests.get(f"{API_URL}/reviews?target=contractor&targetId={contractor_id}", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            aggregate = data.get('aggregate', {})
            if aggregate.get('count') == 0 and aggregate.get('average') == 0:
                print(f"✅ Aggregate recomputed: count=0, average=0")
            else:
                print(f"❌ Expected count=0, avg=0, got count={aggregate.get('count')}, avg={aggregate.get('average')}")
                return False
        else:
            print(f"❌ GET reviews failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Verify aggregate error: {e}")
        return False
    
    print("\n--- Step 14: GET /api/recommendations/contractors (should return 200) ---")
    try:
        resp = requests.get(f"{API_URL}/recommendations/contractors", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            contractors = data.get('contractors', [])
            print(f"✅ GET contractors list returned 200 ({len(contractors)} contractors)")
        else:
            print(f"❌ GET contractors failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET contractors error: {e}")
        return False
    
    print("\n--- Step 15: GET /api/recommendations/contractors/:id (should return 200) ---")
    try:
        resp = requests.get(f"{API_URL}/recommendations/contractors/{contractor_id}", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'contractor' in data and 'reviews' in data and 'aggregate' in data:
                print(f"✅ GET contractor detail returned 200 with contractor + reviews + aggregate")
            else:
                print(f"❌ Response missing expected fields")
                return False
        else:
            print(f"❌ GET contractor detail failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET contractor detail error: {e}")
        return False
    
    print("\n--- Step 16: GET /api/recommendations/facilities (should return 200) ---")
    try:
        resp = requests.get(f"{API_URL}/recommendations/facilities?minRating=0", 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            facilities = data.get('facilities', [])
            print(f"✅ GET facilities list returned 200 ({len(facilities)} facilities)")
        else:
            print(f"❌ GET facilities failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET facilities error: {e}")
        return False
    
    print("\n✅ REVIEWS & RECOMMENDATIONS SUITE: ALL TESTS PASSED")
    return True

def test_inbox_unread_suite():
    """Test Unified Inbox unread-count suite"""
    print("\n" + "="*80)
    print("TEST SUITE 4: UNIFIED INBOX UNREAD-COUNT")
    print("="*80)
    
    print("\n--- Step 1: No auth (should return 200 with all zeros) ---")
    try:
        resp = requests.get(f"{API_URL}/inbox/unread-count", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if (data.get('count') == 0 and data.get('dm') == 0 and 
                data.get('marketplace') == 0 and data.get('jobs') == 0 and 
                data.get('groups') == 0):
                print(f"✅ No auth returned 200 with all zeros: {data}")
            else:
                print(f"❌ Expected all zeros, got: {data}")
                return False
        else:
            print(f"❌ No auth should return 200, got: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ No auth test error: {e}")
        return False
    
    # Create two test users for inbox testing
    timestamp = int(time.time())
    inbox_user_a_email = f"inbox_user_a_{timestamp}@test.com"
    inbox_user_b_email = f"inbox_user_b_{timestamp}@test.com"
    
    print("\n--- Step 2: Create two test users (A & B) ---")
    inbox_user_a = signup_user(inbox_user_a_email, "password123", "Inbox User A")
    inbox_user_b = signup_user(inbox_user_b_email, "password123", "Inbox User B")
    
    if not inbox_user_a or not inbox_user_b:
        print("❌ Failed to create inbox test users")
        return False
    
    login({"email": inbox_user_a_email, "password": "password123"}, "inbox_a")
    login({"email": inbox_user_b_email, "password": "password123"}, "inbox_b")
    
    inbox_a_id = users['inbox_a']['id']
    inbox_b_id = users['inbox_b']['id']
    
    print("\n--- Step 3: A sends DM to B ---")
    try:
        # Create thread
        resp_thread = requests.post(f"{API_URL}/dm/threads", 
                                   json={"userId": inbox_b_id}, 
                                   headers=headers("inbox_a"), 
                                   timeout=10)
        if resp_thread.status_code != 200:
            print(f"❌ Create thread failed: {resp_thread.status_code}")
            return False
        
        thread_id = resp_thread.json()['thread']['threadId']
        
        # Send message
        resp_msg = requests.post(f"{API_URL}/dm/threads/{thread_id}/messages", 
                               json={"body": "Hello B, this is A"}, 
                               headers=headers("inbox_a"), 
                               timeout=10)
        if resp_msg.status_code == 200:
            print(f"✅ A sent DM to B")
        else:
            print(f"❌ Send DM failed: {resp_msg.status_code}")
            return False
    except Exception as e:
        print(f"❌ Send DM error: {e}")
        return False
    
    print("\n--- Step 4: B checks unread-count (dm should be > 0) ---")
    try:
        resp = requests.get(f"{API_URL}/inbox/unread-count", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            dm_unread = data.get('dm', 0)
            total_count = data.get('count', 0)
            if dm_unread > 0 and total_count > 0:
                print(f"✅ B has unread DM: dm={dm_unread}, count={total_count}")
            else:
                print(f"❌ Expected dm > 0, got: {data}")
                return False
        else:
            print(f"❌ GET unread-count failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Check unread error: {e}")
        return False
    
    print("\n--- Step 5: B fetches DM messages (should mark as read) ---")
    try:
        resp = requests.get(f"{API_URL}/dm/threads/{thread_id}/messages", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            print(f"✅ B fetched DM messages")
        else:
            print(f"❌ Fetch messages failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Fetch messages error: {e}")
        return False
    
    print("\n--- Step 6: B checks unread-count again (dm should be 0) ---")
    try:
        resp = requests.get(f"{API_URL}/inbox/unread-count", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            dm_unread = data.get('dm', -1)
            if dm_unread == 0:
                print(f"✅ B's DM unread count is now 0 (messages marked read)")
            else:
                print(f"❌ Expected dm=0, got: {data}")
                return False
        else:
            print(f"❌ GET unread-count failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Check unread after read error: {e}")
        return False
    
    print("\n--- Step 7: Create group and have both users join ---")
    try:
        # Login super admin to create group
        if not login(SUPER_ADMIN, "super_admin"):
            return False
        
        group_data = {
            "name": f"Inbox Test Group {timestamp}",
            "description": "Test group for inbox unread testing",
            "category": "general",
            "city": "San Jose"
        }
        resp = requests.post(f"{API_URL}/community/groups", 
                           json=group_data, 
                           headers=headers("super_admin"), 
                           timeout=10)
        if resp.status_code != 200:
            print(f"❌ Create group failed: {resp.status_code}")
            return False
        
        inbox_group_id = resp.json()['group']['id']
        print(f"✅ Group created (ID: {inbox_group_id})")
        
        # A joins
        resp_a = requests.post(f"{API_URL}/community/groups/{inbox_group_id}/join", 
                             headers=headers("inbox_a"), 
                             timeout=10)
        if resp_a.status_code != 200:
            print(f"❌ A join failed: {resp_a.status_code}")
            return False
        
        # B joins
        resp_b = requests.post(f"{API_URL}/community/groups/{inbox_group_id}/join", 
                             headers=headers("inbox_b"), 
                             timeout=10)
        if resp_b.status_code != 200:
            print(f"❌ B join failed: {resp_b.status_code}")
            return False
        
        print(f"✅ Both A and B joined the group")
    except Exception as e:
        print(f"❌ Group setup error: {e}")
        return False
    
    print("\n--- Step 8: A posts in group ---")
    try:
        resp = requests.post(f"{API_URL}/community/groups/{inbox_group_id}/chat", 
                           json={"body": "Hello group from A"}, 
                           headers=headers("inbox_a"), 
                           timeout=10)
        if resp.status_code == 200:
            print(f"✅ A posted in group")
        else:
            print(f"❌ A post failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ A post error: {e}")
        return False
    
    print("\n--- Step 9: B checks unread-count (groups should be > 0) ---")
    try:
        resp = requests.get(f"{API_URL}/inbox/unread-count", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            groups_unread = data.get('groups', 0)
            group_breakdown = data.get('groupBreakdown', [])
            if groups_unread > 0:
                print(f"✅ B has unread group messages: groups={groups_unread}")
                # Check if groupBreakdown contains the group
                group_ids = [g['groupId'] for g in group_breakdown]
                if inbox_group_id in group_ids:
                    print(f"✅ groupBreakdown contains the test group")
                else:
                    print(f"❌ groupBreakdown missing test group: {group_breakdown}")
                    return False
            else:
                print(f"❌ Expected groups > 0, got: {data}")
                return False
        else:
            print(f"❌ GET unread-count failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Check group unread error: {e}")
        return False
    
    print("\n--- Step 10: B fetches group chat (should mark as read) ---")
    try:
        resp = requests.get(f"{API_URL}/community/groups/{inbox_group_id}/chat", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            print(f"✅ B fetched group chat")
        else:
            print(f"❌ Fetch group chat failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Fetch group chat error: {e}")
        return False
    
    print("\n--- Step 11: B checks unread-count again (groups should be 0 for that group) ---")
    try:
        resp = requests.get(f"{API_URL}/inbox/unread-count", 
                          headers=headers("inbox_b"), 
                          timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            groups_unread = data.get('groups', -1)
            group_breakdown = data.get('groupBreakdown', [])
            # Check if the test group is no longer in breakdown (or has 0 unread)
            test_group_unread = next((g['unread'] for g in group_breakdown if g['groupId'] == inbox_group_id), 0)
            if test_group_unread == 0:
                print(f"✅ B's group unread count is now 0 for test group (messages marked read)")
            else:
                print(f"❌ Expected test group unread=0, got: {test_group_unread}")
                return False
        else:
            print(f"❌ GET unread-count failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Check group unread after read error: {e}")
        return False
    
    print("\n✅ UNIFIED INBOX UNREAD-COUNT SUITE: ALL TESTS PASSED")
    return True

def main():
    """Run all PR-2b test suites"""
    print("\n" + "="*80)
    print("PR-2b BACKEND TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    results = {
        "DM Suite": False,
        "Group Chat Suite": False,
        "Reviews Suite": False,
        "Inbox Unread Suite": False
    }
    
    try:
        results["DM Suite"] = test_dm_suite()
    except Exception as e:
        print(f"\n❌ DM Suite crashed: {e}")
    
    try:
        results["Group Chat Suite"] = test_group_chat_suite()
    except Exception as e:
        print(f"\n❌ Group Chat Suite crashed: {e}")
    
    try:
        results["Reviews Suite"] = test_reviews_suite()
    except Exception as e:
        print(f"\n❌ Reviews Suite crashed: {e}")
    
    try:
        results["Inbox Unread Suite"] = test_inbox_unread_suite()
    except Exception as e:
        print(f"\n❌ Inbox Unread Suite crashed: {e}")
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    for suite, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{suite}: {status}")
    
    all_passed = all(results.values())
    print("\n" + "="*80)
    if all_passed:
        print("🎉 ALL PR-2b TEST SUITES PASSED")
    else:
        print("⚠️  SOME TEST SUITES FAILED")
    print("="*80)
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
