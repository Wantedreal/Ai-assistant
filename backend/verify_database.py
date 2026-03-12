"""Verification script to check SQLite database contents"""
from app.db.database import SessionLocal
from app.models.cellule import Cellule
import statistics

def verify_database():
    """Verify the imported data in SQLite database"""
    
    db = SessionLocal()
    
    try:
        # Get total count
        total = db.query(Cellule).count()
        print("=" * 140)
        print("🗄️  SQLite Database Verification Report")
        print("=" * 140)
        print(f"\n✅ Total cells in database: {total}\n")
        
        if total == 0:
            print("❌ No data found in database!")
            return
        
        # Get all cells
        cells = db.query(Cellule).all()
        
        # Statistics by type
        types = {}
        for cell in cells:
            types[cell.type_cellule] = types.get(cell.type_cellule, 0) + 1
        
        print("📊 Distribution by Cell Type:")
        for cell_type, count in sorted(types.items()):
            pct = (count / total) * 100
            print(f"  • {cell_type:15s}: {count:4d} cells ({pct:5.1f}%)")
        
        # Electrical stats
        capacities = [c.capacite_ah for c in cells]
        voltages = [c.tension_nominale for c in cells]
        currents = [c.courant_max_a for c in cells]
        
        print(f"\n⚡ Electrical Specifications:")
        print(f"  Capacity (Ah):")
        print(f"    • Min:  {min(capacities):7.2f} Ah")
        print(f"    • Mean: {statistics.mean(capacities):7.2f} Ah")
        print(f"    • Max:  {max(capacities):7.2f} Ah")
        
        print(f"  Voltage (V):")
        print(f"    • Min:  {min(voltages):7.2f} V")
        print(f"    • Mean: {statistics.mean(voltages):7.2f} V")
        print(f"    • Max:  {max(voltages):7.2f} V")
        
        print(f"  Max Discharge Current (A):")
        print(f"    • Min:  {min(currents):7.2f} A")
        print(f"    • Mean: {statistics.mean(currents):7.2f} A")
        print(f"    • Max:  {max(currents):7.2f} A")
        
        # Physical specs
        lengths = [c.longueur_mm for c in cells]
        widths = [c.largeur_mm for c in cells]
        heights = [c.hauteur_mm for c in cells]
        masses = [c.masse_g for c in cells]
        
        print(f"\n📐 Physical Dimensions:")
        print(f"  Length (mm): {min(lengths):6.1f} - {max(lengths):6.1f} mm")
        print(f"  Width (mm):  {min(widths):6.1f} - {max(widths):6.1f} mm")
        print(f"  Height (mm): {min(heights):6.1f} - {max(heights):6.1f} mm")
        print(f"  Mass (g):    {min(masses):6.1f} - {max(masses):6.1f} g")
        
        # Sample records
        print(f"\n📋 Sample Records (random 5):")
        print("─" * 140)
        samples = db.query(Cellule).limit(5).all()
        for cell in samples:
            print(f" ID: {cell.id:3d} | {cell.nom:25s} | {cell.longueur_mm:6.1f}×{cell.largeur_mm:6.1f}×{cell.hauteur_mm:6.1f}mm | "
                  f"Mass: {cell.masse_g:6.1f}g | {cell.tension_nominale:5.2f}V @ {cell.capacite_ah:6.1f}Ah | "
                  f"I_max: {cell.courant_max_a:7.1f}A | Type: {cell.type_cellule:12s} | Swell: {cell.taux_swelling_pct:5.2f}%")
        print("─" * 140)
        
        print(f"\n✅ Database verification completed!\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    verify_database()
