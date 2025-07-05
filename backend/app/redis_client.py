# backend/app/redis_client.py
import redis
import json
import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from google.oauth2.credentials import Credentials

class RedisClient:
    def __init__(self):
        # Redis connection settings
        self.host = os.getenv('REDIS_HOST', 'localhost')
        self.port = int(os.getenv('REDIS_PORT', 6379))
        self.db = int(os.getenv('REDIS_DB', 0))
        self.password = os.getenv('REDIS_PASSWORD', None)
        
        # Initialize Redis connection
        self.redis_client = redis.Redis(
            host=self.host,
            port=self.port,
            db=self.db,
            password=self.password,
            decode_responses=True
        )
        
        # Test connection
        try:
            self.redis_client.ping()
            print("✅ Connected to Redis successfully")
        except redis.ConnectionError:
            print("❌ Failed to connect to Redis")
            raise

    def store_credentials(self, credentials: Credentials, session_type: str = "user") -> str:
        """Store Google OAuth credentials in Redis and return a unique token"""
        try:
            # Generate a unique token
            token = str(uuid.uuid4())
            
            # Create a serializable dictionary from credentials
            creds_dict = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'id_token': credentials.id_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes,
                'session_type': session_type,
                'expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                'created_at': datetime.now().isoformat()
            }
            
            # Store with expiration (24 hours)
            key = f"credentials:{token}"
            result = self.redis_client.setex(key, 86400, json.dumps(creds_dict))
            
            if result:
                # Also store by session type for backward compatibility
                type_key = f"session:{session_type}"
                self.redis_client.setex(type_key, 86400, token)
                print(f"✅ Stored credentials for session type: {session_type} with token: {token}")
                return token
            else:
                print(f"❌ Failed to store credentials in Redis")
                raise Exception("Failed to store credentials in Redis")
                
        except Exception as e:
            print(f"❌ Error storing credentials: {e}")
            raise e

    def get_credentials_by_token(self, token: str) -> Optional[Credentials]:
        """Retrieve credentials using token"""
        try:
            key = f"credentials:{token}"
            creds_data = self.redis_client.get(key)
            
            if not creds_data:
                return None
                
            creds_dict = json.loads(creds_data)
            
            # Reconstruct Credentials object
            credentials = Credentials(
                token=creds_dict['token'],
                refresh_token=creds_dict.get('refresh_token'),
                id_token=creds_dict.get('id_token'),
                token_uri=creds_dict.get('token_uri'),
                client_id=creds_dict.get('client_id'),
                client_secret=creds_dict.get('client_secret'),
                scopes=creds_dict.get('scopes')
            )
            
            return credentials
        except Exception as e:
            print(f"Error retrieving credentials: {e}")
            return None

    def get_credentials_by_type(self, session_type: str) -> Optional[Credentials]:
        """Get credentials by session type (source/destination)"""
        try:
            type_key = f"session:{session_type}"
            token = self.redis_client.get(type_key)
            
            if not token:
                return None
                
            return self.get_credentials_by_token(token)
        except Exception as e:
            print(f"Error retrieving credentials by type: {e}")
            return None

    def delete_credentials(self, token: str) -> bool:
        """Delete credentials from Redis"""
        try:
            key = f"credentials:{token}"
            result = self.redis_client.delete(key)
            return result > 0
        except Exception as e:
            print(f"Error deleting credentials: {e}")
            return False

    def list_active_sessions(self) -> Dict[str, Any]:
        """List all active sessions"""
        try:
            sessions = {}
            for key in self.redis_client.scan_iter(match="session:*"):
                session_type = key.split(":")[1]
                token = self.redis_client.get(key)
                if token:
                    sessions[session_type] = token
            return sessions
        except Exception as e:
            print(f"Error listing sessions: {e}")
            return {}

# Create a global Redis client instance
redis_client = RedisClient()
