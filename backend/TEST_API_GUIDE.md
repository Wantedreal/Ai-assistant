# 🧪 API Testing Guide — Battery Pack Pre-Design Assistant

## ✅ Server Status

**Last Verified:** ✅ API is **RUNNING** and **RESPONDING**
- Terminal logs show all endpoints returning **200 OK**
- Database: **10 reference cells loaded** (SQLite)
- Port: **8000** (default)

---

## 📊 Quick Test Summary

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/api/v1/health` | GET | 200 ✅ | `{"status":"ok","version":"1.0.0",...}` |
| `/api/v1/cells` | GET | 200 ✅ | Array of 10 cells with full specs |
| `/api/v1/calculate` | POST | 200 ✅ | CalculationResult with verdict |

---

## 🌐 Testing Methods

### Method 1: **Swagger UI (Easiest - Recommended)**

1. **Open in browser:**
   ```
   http://localhost:8000/docs
   ```

2. **Test GET /api/v1/health:**
   - Click the "GET /api/v1/health" card
   - Click the blue **"Try it out"** button
   - Click **"Execute"**
   - See JSON response below

3. **Test GET /api/v1/cells:**
   - Click "GET /api/v1/cells"
   - Click **"Try it out"** → **"Execute"**
   - Scroll down to see 10 cells (INR18650-35E, NCR21700-50E, etc.)

4. **Test POST /api/v1/calculate:**
   - Click "POST /api/v1/calculate"
   - Click **"Try it out"**
   - Paste this JSON in the request body:
   ```json
   {
     "cell_id": 1,
     "energie_cible_kwh": 10,
     "courant_cible_a": 50,
     "housing_l": 500,
     "housing_l_small": 400,
     "housing_h": 300,
     "marge_mm": 15,
     "depth_of_discharge": 80,
     "config_mode": "auto"
   }
   ```
   - Click **"Execute"**
   - See calculation result with **verdict** (ACCEPT/REJECT)

---

### Method 2: **PowerShell (Command Line)**

```powershell
# 1. Test Health
(Invoke-WebRequest -Uri "http://localhost:8000/api/v1/health" -UseBasicParsing).Content

# 2. Get All Cells (first 3)
$response = (Invoke-WebRequest -Uri "http://localhost:8000/api/v1/cells" -UseBasicParsing).Content
$response | ConvertFrom-Json | Select-Object -First 3 | Format-Table id, nom, type_cellule, capacite_ah

# 3. Test Calculation
$bodyJson = @{
    cell_id = 1
    energie_cible_kwh = 10
    courant_cible_a = 50
    housing_l = 500
    housing_l_small = 400
    housing_h = 300
    marge_mm = 15
    depth_of_discharge = 80
    config_mode = "auto"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/calculate" `
  -Method POST `
  -ContentType "application/json" `
  -Body $bodyJson `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | Format-List
```

---

### Method 3: **cURL (if installed)**

```bash
# 1. Health check
curl -s http://localhost:8000/api/v1/health | jq

# 2. Get cells
curl -s http://localhost:8000/api/v1/cells | jq '. | .[0:2]'

# 3. Calculate (POST)
curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "cell_id": 1,
    "energie_cible_kwh": 10,
    "courant_cible_a": 50,
    "housing_l": 500,
    "housing_l_small": 400,
    "housing_h": 300,
    "marge_mm": 15,
    "depth_of_discharge": 80,
    "config_mode": "auto"
  }' | jq
```

---

### Method 4: **Python (requests library)**

```python
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# 1. Health
print("🏥 Health Check:")
resp = requests.get(f"{BASE_URL}/health")
print(json.dumps(resp.json(), indent=2))

# 2. Get all cells
print("\n📦 Get Cells (first 2):")
resp = requests.get(f"{BASE_URL}/cells")
cells = resp.json()
print(f"Total cells: {len(cells)}")
for cell in cells[:2]:
    print(f"  - {cell['nom']} ({cell['type_cellule']})")

# 3. Calculate
print("\n⚙️  Calculate Pack:")
payload = {
    "cell_id": 1,
    "energie_cible_kwh": 10,
    "courant_cible_a": 50,
    "housing_l": 500,
    "housing_l_small": 400,
    "housing_h": 300,
    "marge_mm": 15,
    "depth_of_discharge": 80,
    "config_mode": "auto"
}

resp = requests.post(f"{BASE_URL}/calculate", json=payload)
result = resp.json()
print(f"Verdict: {result['verdict']}")
print(f"Series: {result['nb_serie']}, Parallel: {result['nb_parallele']}")
print(f"Array dimensions: {result['dimensions_array']}")
print(f"Energy: {result['energie_reelle_kwh']:.2f} kWh")
```

---

## 🧮 Manual Test Cases

### Test Case 1: Small Pack (Should ACCEPT)
```json
{
  "cell_id": 1,
  "energie_cible_kwh": 5,
  "courant_cible_a": 20,
  "housing_l": 400,
  "housing_l_small": 300,
  "housing_h": 250,
  "marge_mm": 15,
  "config_mode": "auto"
}
```
**Expected:** `"verdict": "ACCEPT"` (small dimensions fit)

---

### Test Case 2: Large Pack (May REJECT)
```json
{
  "cell_id": 1,
  "energie_cible_kwh": 100,
  "courant_cible_a": 200,
  "housing_l": 500,
  "housing_l_small": 300,
  "housing_h": 200,
  "marge_mm": 15,
  "config_mode": "auto"
}
```
**Expected:** `"verdict": "REJECT"` (too many cells, exceeds housing)

---

### Test Case 3: Pouch Cell (High Swelling)
```json
{
  "cell_id": 4,
  "energie_cible_kwh": 15,
  "courant_cible_a": 30,
  "housing_l": 600,
  "housing_l_small": 400,
  "housing_h": 300,
  "marge_mm": 15,
  "config_mode": "auto"
}
```
**Expected:** Swelling factor **8%** applied (Pouch cells expand more)

---

### Test Case 4: Prismatic Cell (Medium Swelling)
```json
{
  "cell_id": 9,
  "energie_cible_kwh": 20,
  "courant_cible_a": 75,
  "housing_l": 700,
  "housing_l_small": 500,
  "housing_h": 400,
  "marge_mm": 15,
  "config_mode": "auto"
}
```
**Expected:** Swelling factor **3%** applied (Prismatic cells expand moderately)

---

## 📈 Expected Response Format

```json
{
  "nb_serie": 8,
  "nb_parallele": 4,
  "dimensions_array": {
    "longueur_mm": 300.5,
    "largeur_mm": 250.2,
    "hauteur_mm": 145.0
  },
  "verdict": "ACCEPT",
  "justification": "Array dimensions fit within housing with 15mm margin on all faces",
  "energie_reelle_kwh": 10.50,
  "tension_totale_v": 29.04,
  "courant_total_a": 28.0,
  "masse_total_kg": 3.84,
  "densite_energetique_Wh_kg": 2734.38,
  "collisions_list": [],
  "cell_name": "INR18650-35E",
  "cell_type": "Cylindrical",
  "config_mode": "auto"
}
```

---

## 🔍 Response Fields Explained

| Field | Meaning |
|-------|---------|
| `nb_serie` | Number of cells in series (voltage multiplier) |
| `nb_parallele` | Number of parallel strings (current capacity multiplier) |
| `dimensions_array` | Physical size after adding margin + swelling |
| `verdict` | **ACCEPT** = fits, **REJECT** = exceeds housing |
| `justification` | Why verdict was issued |
| `energie_reelle_kwh` | Actual energy after S×P calculation |
| `collisions_list` | Which axes violated the housing constraint |

---

## 🛠️ Troubleshooting

### ❌ Connection Refused
```
Error: Connection refused on localhost:8000
```
**Solution:** Start the server in a terminal:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

---

### ❌ Cell Not Found (404)
```json
{"detail": "Cellule id=999 introuvable"}
```
**Solution:** Use only cell IDs 1-10 (reference dataset)
- Run `GET /api/v1/cells` to see available IDs

---

### ❌ Validation Error (422)
```json
{"detail": [{"loc": ["body", "energie_cible_kwh"], "msg": "..."}]}
```
**Solution:** Check JSON format:
- All required fields must be present
- Numbers must be valid (not strings)
- `config_mode` must be "auto" or "manual"

---

## 📋 Additional Endpoints

### GET `/api/v1/cells/{cell_id}` — Get Single Cell
```bash
curl http://localhost:8000/api/v1/cells/1
```
Response: Single cell specification

---

### GET `/docs` — Swagger UI
```
http://localhost:8000/docs
```
Auto-generated interactive documentation (recommended for testing)

---

### GET `/redoc` — ReDoc
```
http://localhost:8000/redoc
```
Alternative documentation format

---

## 🚀 Next Steps

1. ✅ **Verify API is working** (done via Swagger)
2. ⏳ **Build React frontend** to consume these endpoints
3. ⏳ **Add PDF report generation** for CalculationResult
4. ⏳ **Docker containerization** for deployment
5. ⏳ **Database switching** (toggle between 10 ref cells ↔ 384 full dataset)

---

## 📞 Support

All endpoints are documented at:
- **Swagger (Interactive):** `http://localhost:8000/docs`
- **ReDoc (Read-only):** `http://localhost:8000/redoc`
- **Source Code:** `app/main.py` (FastAPI routes)
- **Engine Logic:** `app/core/engine.py` (Sizing algorithm)
