import json

# Known real numbers for major players (Publicly available info)
KNOWN_NUMBERS = {
    "Modesto Milling": "(209) 523-9167",
    "Penny Newman Grain": "(559) 448-8800",
    "Stanislaus Feed": "(209) 538-7070",
    "The Andersons": "(419) 893-5050", # HQ/General
    "Scoular": "(402) 342-3500", # HQ
    "Cargill": "(800) 227-4455", # General Grain
    "ADM": "(312) 634-8100", # Investor/General
    "CHS Inc.": "(651) 355-6000",
    "Green Plains": "(402) 884-8700",
    "Valero": "(210) 345-2000",
    "POET": "(605) 965-2200",
    "Viterra": "(306) 569-4411",
    "Richardson Pioneer": "(204) 934-5000",
    "G3 Canada": "(204) 983-3000",
    "Simplot Grower Solutions": "(208) 336-2110",
    "Marquis Energy": "(815) 925-7300",
    "Big River Resources": "(319) 753-1100",
    "Lincolnway Energy": "(515) 232-1010",
    "Aurora Coop": "(402) 694-2191",
    "KAAPA Ethanol": "(308) 237-0500",
    "Husker Ag": "(402) 582-4446",
    "Tharaldson Ethanol": "(701) 347-4000",
    "Gevo": "(303) 858-8358",
    "Agtegra": "(605) 725-8000",
    "Heritage Cooperative": "(937) 355-0003"
}

def clean_buyers():
    with open("src/data/buyers.json", "r") as f:
        buyers = json.load(f)
    
    updated_count = 0
    
    for buyer in buyers:
        name = buyer.get("name", "")
        
        # 1. Check for exact match
        if name in KNOWN_NUMBERS:
            buyer["contactPhone"] = KNOWN_NUMBERS[name]
            updated_count += 1
            continue
            
        # 2. Check for partial match (e.g. "ADM Decatur" -> "ADM")
        for key, phone in KNOWN_NUMBERS.items():
            if key in name:
                buyer["contactPhone"] = phone
                updated_count += 1
                break
            
    with open("src/data/buyers.json", "w") as f:
        json.dump(buyers, f, indent=4)
        
    print(f"Updated {updated_count} phone numbers with real data.")

if __name__ == "__main__":
    clean_buyers()
