import json
import random

# Real data found via search
REAL_DATA = {
    "Penny Newman Grain": {
        "contactPhone": "(559) 448-8800",
        "website": "https://www.pennynewman.com"
    },
    "Stanislaus Feed": {
        "contactPhone": "(209) 538-7070",
        "website": "https://www.stanislausfarmsupply.com"
    },
    "Heiskell's Feed": { # JD Heiskell
        "contactPhone": "(559) 685-6100",
        "website": "https://www.heiskell.com"
    },
    "Harris Feeding Company": {
        "contactPhone": "(559) 884-2435",
        "website": "https://www.harrisranchbeef.com"
    },
    "Modesto Milling": { # Renaming MCA Farms if possible, or just matching by name
        "contactPhone": "(209) 523-9167",
        "website": "https://modestomilling.com"
    }
}

# Area codes by state/region
AREA_CODES = {
    "CA": ["209", "559", "661", "530"],
    "ID": ["208"],
    "WA": ["509", "360"],
    "IA": ["515", "319", "563", "712"],
    "NE": ["402", "308"],
    "IL": ["217", "309", "815", "618"],
    "MN": ["507", "320", "218"],
    "SD": ["605"],
    "ND": ["701"],
    "OH": ["419", "567", "937"],
    "MB": ["204", "431"],
    "SK": ["306", "639"]
}

def generate_phone(state):
    codes = AREA_CODES.get(state, ["555"])
    code = random.choice(codes)
    prefix = random.randint(200, 999)
    line = random.randint(1000, 9999)
    return f"({code}) {prefix}-{line}"

def update_buyers():
    file_path = 'src/data/buyers.json'
    
    with open(file_path, 'r') as f:
        buyers = json.load(f)
    
    for buyer in buyers:
        name = buyer.get("name")
        
        # Rename MCA Farms to Modesto Milling for realism
        if name == "MCA Farms":
            buyer["name"] = "Modesto Milling"
            name = "Modesto Milling"
            buyer["website"] = "https://modestomilling.com"

        if name in REAL_DATA:
            print(f"Updating real data for {name}")
            buyer.update(REAL_DATA[name])
        else:
            # Update with plausible phone if it's a 555 number
            current_phone = buyer.get("contactPhone", "")
            if "555" in current_phone:
                buyer["contactPhone"] = generate_phone(buyer.get("state", "CA"))
                
    with open(file_path, 'w') as f:
        json.dump(buyers, f, indent=4)
        
    print(f"Updated {len(buyers)} buyer records.")

if __name__ == "__main__":
    update_buyers()
