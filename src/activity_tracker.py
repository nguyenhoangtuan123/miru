
class ActivityTracker:
    def __init__(self, supabase, db_manager):
        self.supabase = supabase
        self.db_manager = db_manager
        print("[MOCK] ActivityTracker initialized")

    def log_activity(self, user_id, activity_type):
        print(f"[MOCK] Logging activity: {activity_type} for user {user_id}")
        return f"Activity {activity_type} logged (MOCK)"

    def calculate_last_sleep_duration(self, user_id):
        print(f"[MOCK] Calculating sleep for user {user_id}")
        return {"duration": "8h (MOCK)", "status": "Good"}
