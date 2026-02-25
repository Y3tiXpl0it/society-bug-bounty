import asyncio
import random
import uuid
import sys
import os

# Ensure the backend directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi_users.password import PasswordHelper
from app.core.database import async_session
from app.src.users.models import User, UserDetails, UserStats

password_helper = PasswordHelper()
dummy_hash = password_helper.hash("Test1234!")

async def seed():
    async with async_session() as session:
        print("Starting seeding process...")
        for i in range(1, 126):
            user_id = uuid.uuid4()
            username = f"hacker_bot_{i}_{random.randint(100, 999)}"
            email = f"{username}@example.com"
            
            # Create the main user record
            user = User(
                id=user_id,
                email=email,
                hashed_password=dummy_hash,
                is_active=True,
                is_verified=True,
                is_superuser=False,
                is_temporary=False
            )
            
            # Create user details
            details = UserDetails(
                user_id=user_id,
                username=username,
                email_notifications_enabled=True,
                in_app_notifications_enabled=True
            )
            
            # Generate random stats
            crit = random.randint(0, 5)
            high = random.randint(0, 15)
            med = random.randint(0, 25)
            low = random.randint(0, 40)
            
            total_cases = crit + high + med + low
            # Basic score calculation logic (approximate)
            total_score = round((crit * 9.5) + (high * 7.5) + (med * 5.0) + (low * 2.0), 1)
            
            stats = UserStats(
                user_id=user_id,
                total_score=total_score,
                total_reports=total_cases,
                critical_bugs=crit,
                high_bugs=high,
                medium_bugs=med,
                low_bugs=low
            )
            
            session.add_all([user, details, stats])
        
        await session.commit()
        print("Successfully seeded 125 users for leaderboard testing!")
        print("You can log in with any of the emails like 'hacker_bot_1_XXX@example.com' and password 'Test1234!' if needed.")

if __name__ == "__main__":
    asyncio.run(seed())
