import os
import shutil
from datetime import datetime
import glob

# Configuration
DB_PATH = os.path.join(os.path.dirname(__file__), 'learning.db')
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')
MAX_BACKUPS = 7

def perform_backup():
    """Creates a timestamped backup of the learning database."""
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    # Ensure backup directory exists
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        print(f"Created backup directory at {BACKUP_DIR}")

    # Create timestamped filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"learning_backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    # Perform the copy
    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"Successfully backed up database to: {backup_filename}")
    except Exception as e:
        print(f"Failed to backup database: {e}")
        return

    # Clean up old backups (keep only the 'MAX_BACKUPS' most recent files)
    all_backups = glob.glob(os.path.join(BACKUP_DIR, "learning_backup_*.db"))
    # Sort by modification time, oldest first
    all_backups.sort(key=os.path.getmtime)
    
    if len(all_backups) > MAX_BACKUPS:
        backups_to_delete = all_backups[:-MAX_BACKUPS]
        for old_backup in backups_to_delete:
            try:
                os.remove(old_backup)
                print(f"Deleted old backup: {os.path.basename(old_backup)}")
            except Exception as e:
                print(f"Failed to delete old backup {old_backup}: {e}")

if __name__ == "__main__":
    print(f"--- Starting Database Backup: {datetime.now()} ---")
    perform_backup()
    print("--- Backup Finished ---\n")
