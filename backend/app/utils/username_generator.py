# backend/app/utils/username_generator.py
import random

# List of 200 English adjectives
ADJECTIVES = [
    "Brave", "Clever", "Swift", "Mighty", "Bold", "Wise", "Gentle", "Fierce", "Calm", "Wild",
    "Bright", "Dark", "Quick", "Slow", "Strong", "Weak", "Happy", "Sad", "Angry", "Peaceful",
    "Loyal", "Tricky", "Honest", "Sneaky", "Kind", "Cruel", "Smart", "Dumb", "Fast", "Lazy",
    "Tall", "Short", "Big", "Small", "Hot", "Cold", "Wet", "Dry", "Rich", "Poor",
    "Young", "Old", "New", "Ancient", "Clean", "Dirty", "Easy", "Hard", "Soft", "Rough",
    "Smooth", "Sharp", "Dull", "Light", "Heavy", "Thin", "Thick", "Wide", "Narrow", "Deep",
    "Shallow", "High", "Low", "Near", "Far", "Left", "Right", "Front", "Back",
    "Inside", "Outside", "Above", "Below", "Round", "Square", "Straight", "Curved", "Flat", "Bumpy",
    "Sweet", "Sour", "Bitter", "Salty", "Spicy", "Mild", "Fresh", "Stale", "Warm", "Cool",
    "Loud", "Quiet", "Noisy", "Silent", "Busy", "Free", "Full", "Empty", "Open", "Closed",
    "Safe", "Dangerous", "Healthy", "Sick", "Alive", "Dead", "Real", "Fake", "True", "False",
    "Good", "Bad", "Better", "Best", "Worse", "Worst", "First", "Last", "Next", "Previous",
    "Early", "Late", "Soon", "Later", "Now", "Then", "Here", "There", "Everywhere", "Nowhere",
    "All", "Some", "Many", "Few", "Most", "Least", "More", "Less", "Enough", "Too",
    "Much", "Little", "Great", "Small", "Large", "Tiny", "Huge", "Mini", "Giant", "Dwarf",
    "Long", "Short", "Wide", "Narrow", "Thick", "Thin", "Heavy", "Light", "Hard", "Soft",
    "Rough", "Smooth", "Sharp", "Blunt", "Pointed", "Flat", "Round", "Square", "Oval", "Triangular",
    "Circular", "Rectangular", "Straight", "Curved", "Bent", "Twisted", "Broken", "Whole", "Intact", "Damaged",
    "New", "Old", "Modern", "Ancient", "Classic", "Contemporary", "Traditional", "Innovative", "Creative", "Destructive",
    "Constructive", "Positive", "Negative", "Neutral", "Active", "Passive", "Dynamic", "Static", "Moving", "Still",
    "Fast", "Slow", "Quick", "Gradual", "Sudden", "Steady", "Unsteady", "Stable", "Unstable", "Balanced",
    "Unbalanced", "Equal", "Unequal", "Same", "Different", "Similar", "Dissimilar", "Identical", "Unique", "Common",
    "Rare", "Frequent", "Occasional", "Regular", "Irregular", "Normal", "Abnormal", "Usual", "Unusual", "Typical",
    "Atypical", "Standard", "Nonstandard", "Official", "Unofficial", "Formal", "Informal", "Serious", "Funny",
    "Humorous", "Silly", "Wise", "Foolish", "Intelligent", "Stupid", "Clever", "Dull", "Bright", "Dim"
]

# List of 200 English nouns
NOUNS = [
    "Tiger", "Eagle", "Wolf", "Phoenix", "Lion", "Bear", "Shark", "Falcon", "Panther", "Hawk",
    "Dragon", "Unicorn", "Griffin", "Sphinx", "Centaur", "Minotaur", "Cyclops", "Titan", "Giant", "Dwarf",
    "Knight", "Warrior", "Mage", "Archer", "Thief", "Priest", "Paladin", "Rogue", "Barbarian", "Sorcerer",
    "Castle", "Tower", "Fortress", "Village", "City", "Kingdom", "Empire", "Realm", "World", "Universe",
    "Mountain", "River", "Forest", "Desert", "Ocean", "Lake", "Island", "Cave", "Valley", "Canyon",
    "Star", "Moon", "Sun", "Planet", "Galaxy", "Comet", "Asteroid", "Meteor", "Nebula", "Blackhole",
    "Sword", "Shield", "Bow", "Arrow", "Axe", "Hammer", "Spear", "Dagger", "Staff", "Wand",
    "Potion", "Elixir", "Scroll", "Book", "Map", "Key", "Chest", "Treasure", "Gold", "Silver",
    "Diamond", "Ruby", "Emerald", "Sapphire", "Pearl", "Crystal", "Gem", "Jewel", "Crown", "Ring",
    "Armor", "Helmet", "Gauntlet", "Boot", "Cloak", "Robe", "Mask", "Cape", "Belt", "Glove",
    "Horse", "Wolf", "Eagle", "Raven", "Owl", "Fox", "Deer", "Bear", "Boar", "Stag",
    "Tree", "Flower", "Leaf", "Root", "Branch", "Seed", "Fruit", "Berry", "Nut", "Vine",
    "Fire", "Water", "Earth", "Air", "Wind", "Storm", "Rain", "Snow", "Ice", "Lightning",
    "Shadow", "Light", "Dawn", "Dusk", "Night", "Day", "Time", "Space", "Void", "Chaos",
    "Order", "Balance", "Harmony", "Discord", "Peace", "War", "Love", "Hate", "Hope", "Fear",
    "Courage", "Wisdom", "Strength", "Agility", "Endurance", "Luck", "Fate", "Destiny", "Dream", "Nightmare",
    "Spirit", "Soul", "Ghost", "Phantom", "Wraith", "Specter", "Angel", "Demon", "God", "Devil",
    "Hero", "Villain", "Sage", "Fool", "King", "Queen", "Prince", "Princess", "Lord", "Lady",
    "Master", "Apprentice", "Teacher", "Student", "Guide", "Follower", "Leader", "Servant", "Friend", "Enemy",
    "Brother", "Sister", "Parent", "Child", "Family", "Clan", "Tribe", "Nation", "People", "Crowd",
    "Army", "Fleet", "Ship", "Boat", "Carriage", "Wagon", "Bridge", "Gate", "Wall", "Road",
    "Path", "Trail", "Journey", "Quest", "Adventure", "Mission", "Task", "Challenge", "Trial", "Test",
    "Victory", "Defeat", "Success", "Failure", "Glory", "Shame", "Honor", "Dishonor", "Pride", "Humility",
    "Joy", "Sorrow", "Pleasure", "Pain", "Comfort", "Suffering", "Health", "Disease", "Life", "Death"
]


def generate_username() -> str:
    """
    Generates a random username in the format: AdjectiveNounNumber
    where Adjective and Noun are capitalized, and Number is between 1 and 999.
    Ensures the generated username does not exceed 24 characters.

    Returns:
        A string representing the generated username (max 24 characters).
    """
    while True:
        adjective = random.choice(ADJECTIVES)
        noun = random.choice(NOUNS)
        number = random.randint(1, 999)
        username = f"{adjective}{noun}{number}"
        if len(username) <= 24:
            return username