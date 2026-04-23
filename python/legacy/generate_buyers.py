import json
import random
import datetime
import math

# Constants
FUTURES_PRICE = 4.4475  # ZCH6 Mar 2026
USDA_CASH_ANCHOR_CA = 6.02  # Modesto/Tulare
USDA_CASH_ANCHOR_ID = 5.95  # Estimated slightly lower
USDA_CASH_ANCHOR_WA = 6.10  # Export premium

# Regions and Buyers
REGIONS = {
    "California": {
        "Modesto": [
            {"name": "MCA Farms", "type": "elevator"},
            {"name": "Red Barn Equipment", "type": "elevator"},
            {"name": "Penny Newman Grain", "type": "processor"},
            {"name": "Central Valley Ag", "type": "elevator"},
            {"name": "Modesto Grain Hub", "type": "elevator"},
            {"name": "Stanislaus Feed", "type": "feedlot"},
            {"name": "Valley Protein", "type": "processor"}
        ],
        "Tulare": [
            {"name": "Central Valley Ag Exports", "type": "export"},
            {"name": "Heiskell's Feed", "type": "feedlot"},
            {"name": "Valov & Sons", "type": "feedlot"},
            {"name": "Tulare Grain Exchange", "type": "elevator"},
            {"name": "Visalia Feed & Grain", "type": "feedlot"},
            {"name": "Kings County Feeders", "type": "feedlot"}
        ],
        "Fresno": [
            {"name": "Pacific Grain & Foods", "type": "processor"},
            {"name": "Fresno Cooperative", "type": "elevator"},
            {"name": "San Joaquin Grain", "type": "elevator"},
            {"name": "Westside Feed", "type": "feedlot"}
        ],
        "Bakersfield": [
            {"name": "Kern County Grain", "type": "elevator"},
            {"name": "Bakersfield Feed", "type": "feedlot"},
            {"name": "Golden Empire Grain", "type": "processor"}
        ]
    },
    "Idaho": {
        "Jerome": [
            {"name": "The Andersons", "type": "elevator"},
            {"name": "Scoular", "type": "elevator"},
            {"name": "Pioneer Commodities", "type": "feedlot"},
            {"name": "Simplot Grower Solutions", "type": "processor"},
            {"name": "Magic Valley Grain", "type": "elevator"},
            {"name": "Snake River Feed", "type": "feedlot"}
        ],
        "Twin Falls": [
            {"name": "Twin Falls Grain", "type": "elevator"},
            {"name": "Gem State Processing", "type": "processor"},
            {"name": "Idaho Feed & Grain", "type": "feedlot"}
        ],
        "Burley": [
            {"name": "Burley Grain Growers", "type": "elevator"},
            {"name": "Cassia County Feed", "type": "feedlot"}
        ]
    },
    "Washington": {
        "Yakima": [
            {"name": "CHS Inc.", "type": "elevator"},
            {"name": "Pomeroy Grain Growers", "type": "elevator"},
            {"name": "Northwest Grain Growers", "type": "elevator"},
            {"name": "Yakima Valley Grain", "type": "elevator"},
            {"name": "Central Washington Grain", "type": "export"}
        ],
        "Pasco": [
            {"name": "Tri-Cities Grain", "type": "export"},
            {"name": "CHS SunBasin Growers", "type": "elevator"},
            {"name": "Columbia River Grain", "type": "export"},
            {"name": "Pasco Processing", "type": "processor"}
        ],
        "Walla Walla": [
            {"name": "Walla Walla Grain Growers", "type": "elevator"},
            {"name": "Blue Mountain Grain", "type": "elevator"}
        ]
    },
    "Midwest": {
        "Iowa": [
            {"name": "Big River Resources", "type": "ethanol"},
            {"name": "Cargill Cedar Rapids", "type": "processor"},
            {"name": "ADM Des Moines", "type": "processor"},
            {"name": "Lincolnway Energy", "type": "ethanol"},
            {"name": "Heartland Co-op", "type": "elevator"},
            {"name": "Landus Cooperative", "type": "elevator"}
        ],
        "Nebraska": [
            {"name": "Valero Albion", "type": "ethanol"},
            {"name": "Green Plains", "type": "ethanol"},
            {"name": "Aurora Coop", "type": "elevator"},
            {"name": "KAAPA Ethanol", "type": "ethanol"},
            {"name": "Husker Ag", "type": "ethanol"},
            {"name": "CPI Grain", "type": "elevator"}
        ],
        "Illinois": [
            {"name": "ADM Decatur", "type": "processor"},
            {"name": "Marquis Energy", "type": "ethanol"},
            {"name": "Topflight Grain", "type": "elevator"},
            {"name": "Consolidated Grain & Barge", "type": "river"}
        ],
        "Minnesota": [
            {"name": "CHS Mankato", "type": "processor"},
            {"name": "Crystal Valley", "type": "elevator"},
            {"name": "Gevo", "type": "ethanol"}
        ],
        "North Dakota": [
            {"name": "Tharaldson Ethanol", "type": "ethanol"},
            {"name": "Alton Grain Terminal", "type": "shuttle"},
            {"name": "Red River Grain", "type": "elevator"}
        ],
        "South Dakota": [
            {"name": "POET Chancellor", "type": "ethanol"},
            {"name": "Dakota Ethanol", "type": "ethanol"},
            {"name": "Agtegra", "type": "elevator"}
        ],
        "Ohio": [
            {"name": "The Andersons Maumee", "type": "shuttle"},
            {"name": "POET Fostoria", "type": "ethanol"},
            {"name": "Heritage Cooperative", "type": "elevator"}
        ]
    },
    "Canada": {
        "Manitoba": [
            {"name": "Viterra Winnipeg", "type": "elevator"},
            {"name": "Richardson Pioneer", "type": "elevator"},
            {"name": "Paterson Grain", "type": "elevator"},
            {"name": "G3 Canada", "type": "shuttle"}
        ],
        "Saskatchewan": [
            {"name": "Viterra Regina", "type": "elevator"},
            {"name": "Cargill Clavet", "type": "processor"},
            {"name": "AGT Foods", "type": "processor"},
            {"name": "P&H Milling", "type": "processor"}
        ]
    }
}

# Coordinates (approximate)
COORDS = {
    "Modesto": {"lat": 37.6391, "lng": -120.9969},
    "Tulare": {"lat": 36.2077, "lng": -119.3473},
    "Fresno": {"lat": 36.7378, "lng": -119.7871},
    "Bakersfield": {"lat": 35.3733, "lng": -119.0187},
    "Jerome": {"lat": 42.7241, "lng": -114.5186},
    "Twin Falls": {"lat": 42.5628, "lng": -114.4609},
    "Burley": {"lat": 42.5357, "lng": -113.7928},
    "Yakima": {"lat": 46.6021, "lng": -120.5059},
    "Pasco": {"lat": 46.2396, "lng": -119.1006},
    "Walla Walla": {"lat": 46.0646, "lng": -118.3430},
    "Iowa": {"lat": 41.8780, "lng": -93.0977},
    "Nebraska": {"lat": 41.2565, "lng": -95.9345},
    "Illinois": {"lat": 40.6331, "lng": -89.3985},
    "Minnesota": {"lat": 44.1636, "lng": -93.9994},
    "North Dakota": {"lat": 46.8772, "lng": -96.7898},
    "South Dakota": {"lat": 43.5446, "lng": -96.7311},
    "Ohio": {"lat": 41.565, "lng": -83.650},
    "Manitoba": {"lat": 49.8951, "lng": -97.1384},
    "Saskatchewan": {"lat": 50.4452, "lng": -104.6189}
}

def generate_buyers():
    buyers = []
    count = 1
    
    current_time = datetime.datetime.now().isoformat()
    
    for region_name, subregions in REGIONS.items():
        for subregion_name, buyer_list in subregions.items():
            base_lat = COORDS.get(subregion_name, {}).get("lat", 40.0)
            base_lng = COORDS.get(subregion_name, {}).get("lng", -100.0)
            
            # Determine regional anchor price
            if region_name == "California":
                anchor = USDA_CASH_ANCHOR_CA
                freight_base = -0.25 # Expensive trucking
            elif region_name == "Idaho":
                anchor = USDA_CASH_ANCHOR_ID
                freight_base = -0.35 # Remote
            elif region_name == "Washington":
                anchor = USDA_CASH_ANCHOR_WA
                freight_base = -0.15 # Near river/port
            else:
                anchor = 4.60 # Midwest base
                freight_base = -0.10
                
            for buyer in buyer_list:
                # Jitter location slightly
                lat = base_lat + (random.random() - 0.5) * 0.1
                lng = base_lng + (random.random() - 0.5) * 0.1
                
                # Calculate prices
                # Cash price within $0.10 of anchor
                cash_variation = (random.random() * 0.20) - 0.10
                cash_price = round(anchor + cash_variation, 2)
                
                # Basis = Cash - Futures
                basis = round(cash_price - FUTURES_PRICE, 4)
                
                # Freight
                freight_variation = (random.random() * 0.10) - 0.05
                freight_cost = round(freight_base + freight_variation, 2)
                
                # Net Price = Cash + Freight (Freight is negative cost)
                net_price = round(cash_price + freight_cost, 2)
                
                # Confidence
                confidence = random.randint(85, 99)
                
                record = {
                    "id": f"b{count}",
                    "name": buyer["name"],
                    "type": buyer["type"],
                    "cashPrice": cash_price,
                    "basis": basis,
                    "freightCost": freight_cost,
                    "netPrice": net_price,
                    "city": subregion_name,
                    "state": "CA" if region_name == "California" else ("ID" if region_name == "Idaho" else ("WA" if region_name == "Washington" else "IA")), # Simplified state logic
                    "region": f"{subregion_name} Valley" if region_name == "California" else subregion_name,
                    "lat": lat,
                    "lng": lng,
                    "railAccessible": random.choice([True, False]),
                    "nearTransload": random.choice([True, False]),
                    "contactName": "Grain Desk",
                    "contactPhone": f"555-{random.randint(100,999)}-{random.randint(1000,9999)}",
                    "website": f"https://www.{buyer['name'].lower().replace(' ', '').replace('&', '').replace('.', '')}.com",
                    "lastUpdated": current_time,
                    "confidenceScore": confidence,
                    "verified": True
                }
                
                # Fix state for Midwest and Canada
                if region_name == "Midwest":
                    if subregion_name == "Nebraska":
                        record["state"] = "NE"
                    elif subregion_name == "Iowa":
                        record["state"] = "IA"
                    elif subregion_name == "Illinois":
                        record["state"] = "IL"
                    elif subregion_name == "Minnesota":
                        record["state"] = "MN"
                    elif subregion_name == "North Dakota":
                        record["state"] = "ND"
                    elif subregion_name == "South Dakota":
                        record["state"] = "SD"
                    elif subregion_name == "Ohio":
                        record["state"] = "OH"
                elif region_name == "Canada":
                    if subregion_name == "Manitoba":
                        record["state"] = "MB"
                    elif subregion_name == "Saskatchewan":
                        record["state"] = "SK"
                        
                buyers.append(record)
                count += 1
                
    return buyers

if __name__ == "__main__":
    data = generate_buyers()
    with open("src/data/buyers.json", "w") as f:
        json.dump(data, f, indent=4)
    print(f"Generated {len(data)} buyer records.")
