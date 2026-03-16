import urllib.request
import urllib.error
import json

payload = {
    "cell_id": 1, 
    "energie_cible_wh": 1000.0,
    "tension_cible_v": 400.0, 
    "courant_cible_a": 200.0, 
    "housing_l": 1500.0, 
    "housing_l_small": 1000.0, 
    "housing_h": 250.0, 
    "marge_mm": 15.0, 
    "depth_of_discharge": 80.0
}

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/calculate', 
    data=json.dumps(payload).encode(), 
    headers={'Content-Type': 'application/json'}
)

try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode())
    print("Response Keys:", list(data.keys()))
    if 'energie_reelle_wh' in data:
        print("energie_reelle_wh:", data['energie_reelle_wh'])
    else:
        print("energie_reelle_wh MISSING")
    
    if 'electrical' in data:
        print("Total Energy Wh (nested):", data['electrical']['total_energy_wh'])
        print("Usable Energy Wh (nested):", data['electrical']['usable_energy_wh'])
    
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}:")
    print(e.read().decode())
