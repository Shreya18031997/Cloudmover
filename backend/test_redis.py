#!/usr/bin/env python3
"""
Test script for Redis functionality in CloudMover
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.redis_client import redis_client
from google.oauth2.credentials import Credentials

def test_redis_operations():
    print("🧪 Testing Redis operations...")
    
    # Test basic connection
    try:
        sessions = redis_client.list_active_sessions()
        print(f"✅ Redis connection successful. Active sessions: {len(sessions)}")
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return False
    
    # Test storing and retrieving mock credentials
    try:
        # Create mock credentials
        mock_credentials = Credentials(
            token="test_token_123",
            refresh_token="refresh_123",
            id_token="id_123",
            token_uri="https://oauth2.googleapis.com/token",
            client_id="test_client_id",
            client_secret="test_client_secret",
            scopes=["https://www.googleapis.com/auth/drive"]
        )
        
        # Store credentials
        result = redis_client.store_credentials("test_token_123", mock_credentials, "test")
        if result:
            print("✅ Credentials stored successfully")
        else:
            print("❌ Failed to store credentials")
            return False
        
        # Retrieve credentials
        retrieved_creds = redis_client.get_credentials_by_token("test_token_123")
        if retrieved_creds and retrieved_creds.token == "test_token_123":
            print("✅ Credentials retrieved successfully")
        else:
            print("❌ Failed to retrieve credentials")
            return False
        
        # Test session type retrieval
        type_creds = redis_client.get_credentials_by_type("test")
        if type_creds and type_creds.token == "test_token_123":
            print("✅ Credentials retrieved by type successfully")
        else:
            print("❌ Failed to retrieve credentials by type")
            return False
        
        # Clean up test data
        redis_client.delete_credentials("test_token_123")
        print("✅ Test cleanup completed")
        
        return True
        
    except Exception as e:
        print(f"❌ Redis operations test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_redis_operations()
    if success:
        print("\n🎉 All Redis tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Redis tests failed!")
        sys.exit(1)
