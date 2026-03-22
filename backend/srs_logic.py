from datetime import datetime, timedelta
from typing import Optional, Tuple
from .models import UserProgress

# Default settings
STARTING_EASE = 2.5
EASE_BONUS = 0.15
EASE_PENALTY = 0.15 # Reduced from 0.20 to align with Anki
INTERVAL_MODIFIER = 1.0
HARD_INTERVAL = 1.2

# Steps in minutes for learning phase
LEARNING_STEPS = [1, 10] # 1 min, 10 min
GRADUATING_INTERVAL = 1 # 1 day
EASY_INTERVAL = 4 # 4 days

def calculate_review(item: UserProgress, quality: int) -> UserProgress:
    """
    Quality: 0=Again, 1=Hard, 2=Good, 3=Easy
    """
    now = datetime.utcnow()
    
    if item.is_learning:
        return _calculate_learning(item, quality, now)
    else:
        return _calculate_review(item, quality, now)

def _calculate_learning(item: UserProgress, quality: int, now: datetime) -> UserProgress:
    # Logic for learning phase
    step_index = 0
    # Try to determine current step index based on interval (approximate)
    # This is a simplification. Usually we store step_index in history or extra field.
    # For now, let's look at consecutive_correct.
    
    if quality == 0: # Again
        item.consecutive_correct = 0
        new_interval_minutes = LEARNING_STEPS[0]
        item.next_review_due = now + timedelta(minutes=new_interval_minutes)
        return item
        
    if quality == 3: # Easy -> Graduate immediately
        item.is_learning = False
        item.interval = EASY_INTERVAL
        item.next_review_due = now + timedelta(days=item.interval)
        return item
        
    # Good or Easy
    item.consecutive_correct += 1
    
    if item.consecutive_correct >= len(LEARNING_STEPS):
        # Graduate
        item.is_learning = False
        item.interval = GRADUATING_INTERVAL if quality < 3 else EASY_INTERVAL
        item.next_review_due = now + timedelta(days=item.interval)
        return item
        
    new_interval_minutes = LEARNING_STEPS[item.consecutive_correct]
    item.next_review_due = now + timedelta(minutes=new_interval_minutes)
    return item

def _calculate_review(item: UserProgress, quality: int, now: datetime) -> UserProgress:
    # Standard SM-2 algorithm

    if quality == 0: # Again
        item.consecutive_correct = 0
        item.interval = 0 # Return to learning phase behavior
        item.is_learning = True
        item.ease_factor = max(1.3, item.ease_factor - 0.20)
        item.next_review_due = now + timedelta(minutes=LEARNING_STEPS[0])
        return item

    # Ease factor update (one adjustment only)
    if quality == 3:   # Easy
        item.ease_factor += 0.15 # Consistent with standard Anki
    elif quality == 1: # Hard
        item.ease_factor -= 0.15 # Standard Anki penalty for Hard
    # Good (2): no change
    item.ease_factor = max(1.3, item.ease_factor)

    item.consecutive_correct += 1

    # Interval calculation - Safety: ensure interval is at least 1 day if graduated
    if item.interval <= 0:
        item.interval = 1.0

    if quality == 1: # Hard
        item.interval = item.interval * HARD_INTERVAL
    elif quality == 2: # Good
        new_interval = item.interval * item.ease_factor * INTERVAL_MODIFIER
        # Ensure we always progress at least 1 day if Good is pressed
        item.interval = max(item.interval + 1.0, new_interval)
    elif quality == 3: # Easy
        new_interval = item.interval * item.ease_factor * INTERVAL_MODIFIER * 1.3
        item.interval = max(item.interval + 2.0, new_interval)

    item.next_review_due = now + timedelta(days=item.interval)
    return item

def get_review_intervals(item_in: UserProgress) -> dict:
    """
    Returns a dict mapping quality (0-3) to a human readable interval string.
    e.g. {0: "1m", 1: "10m", 2: "1d", 3: "4d"}
    """
    intervals = {}
    now = datetime.utcnow()
    
    for q in [0, 1, 2, 3]:
        # Copy to avoid mutating original during simulation
        # SQLModel .model_copy() relies on Pydantic
        temp_item = item_in.model_copy()
        
        updated = calculate_review(temp_item, q)
        delta = updated.next_review_due - now
        
        # Format delta
        total_seconds = delta.total_seconds()
        if total_seconds < 60:
            s = "<1m"
        elif total_seconds < 3600:
            s = f"{int(total_seconds // 60)}m"
        elif total_seconds < 86400:
            s = f"{int(total_seconds // 3600)}h"
        elif total_seconds < 2592000: # 30 days
            s = f"{round(total_seconds / 86400, 1)}d"
            if s.endswith(".0d"): s = s[:-3] + "d"
        else:
            s = f"{round(total_seconds / 2592000, 1)}mo"
            
        intervals[q] = s
        
    return intervals
