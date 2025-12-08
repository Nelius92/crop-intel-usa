import json

# Researched Market Values (Dec 2025)
# Basis is relative to ZCH6 (Mar '26) or ZCZ5 (Dec '25) - simplified to single reference
MARKET_DATA = {
    "California": {
        "basis": 1.55,      # Strong dairy demand premium
        "freight": 1.25,    # BNSF Shuttle Rate (Nebraska -> CA)
        "regions": ["Modesto Valley", "Tulare Valley", "Fresno Valley", "Bakersfield Valley"]
    },
    "Washington": {
        "basis": 1.24,      # PNW Export Premium
        "freight": 1.15,    # BNSF Shuttle Rate (Nebraska -> PNW)
        "regions": ["Yakima", "Pasco", "Walla Walla"]
    },
    "Idaho": {
        "basis": 1.35,      # Dairy demand, slightly less than CA
        "freight": 1.10,    # Slightly closer than CA
        "regions": ["Jerome", "Twin Falls", "Burley"]
    },
    "Texas": {
        "basis": 1.00,      # Feedlot demand
        "freight": 0.80,    # Shorter haul
        "regions": ["Amarillo", "Hereford", "Lubbock", "Dalhart"] # Note: Current data might not have all these, but good to have logic
    },
    "Midwest": {
        "basis": -0.20,     # Local basis (weak)
        "freight": 0.10,    # Local trucking only
        "regions": ["Iowa", "Nebraska", "Illinois", "Minnesota", "North Dakota", "South Dakota", "Ohio"]
    },
    "Canada": {
        "basis": 0.10,
        "freight": 0.20,
        "regions": ["Manitoba", "Saskatchewan"]
    }
}

def update_basis():
    with open("src/data/buyers.json", "r") as f:
        buyers = json.load(f)
    
    updated_count = 0
    
    for buyer in buyers:
        region = buyer.get("region", "")
        state = buyer.get("state", "")
        
        # Determine Market Profile
        profile = None
        if state == "CA":
            profile = MARKET_DATA["California"]
        elif state == "WA":
            profile = MARKET_DATA["Washington"]
        elif state == "ID":
            profile = MARKET_DATA["Idaho"]
        elif state in ["TX", "OK", "KS"]: # Southern Plains
             # If we don't have explicit TX profile logic in JSON yet, we might skip or default
             # But let's check if we have any TX buyers. Current JSON might not.
             # If not, we'll add logic if we expand. For now, focus on existing.
             pass
        elif state in ["IA", "NE", "IL", "MN", "ND", "SD", "OH"]:
            profile = MARKET_DATA["Midwest"]
        elif state in ["MB", "SK"]:
            profile = MARKET_DATA["Canada"]
            
        if profile:
            # Apply Hardcoded "Truth"
            buyer["basis"] = profile["basis"]
            buyer["freightCost"] = -profile["freight"] # Freight is a cost (negative)
            
            # Recalculate Net Price (assuming static cash for now, but dynamic app will override cash)
            # Net = Cash + Freight. 
            # In the app: Cash = Futures + Basis. Net = Futures + Basis - Freight.
            # We will update the static cash/net here just so the JSON looks consistent.
            # Assuming Futures = 4.48 (from marketDataService)
            futures = 4.48
            buyer["cashPrice"] = round(futures + profile["basis"], 2)
            buyer["netPrice"] = round(buyer["cashPrice"] - profile["freight"], 2)
            
            updated_count += 1

    with open("src/data/buyers.json", "w") as f:
        json.dump(buyers, f, indent=4)
        
    print(f"Updated {updated_count} buyers with BNSF market data.")

if __name__ == "__main__":
    update_basis()
