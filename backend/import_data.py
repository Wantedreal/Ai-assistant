"""Script to import battery cell data from Excel to SQLite database"""
import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, init_db
from app.models.cellule import Cellule

def import_data():
    """Import battery cell data from Excel file to database"""
    
    # Initialize database (create tables)
    init_db()
    
    # ============================================================================
    # CHOOSE YOUR DATA SOURCE HERE - Switch between these two options:
    # ============================================================================
    # Option 1: Full dataset (384 battery cells) - PRODUCTION
    excel_file = Path(__file__).parent / "Battery_Cells_Data_Randomized.xlsx"
    
    # Option 2: Reference test dataset (10 cells only) - TESTING
    # excel_file = Path(__file__).parent / "Reference_Battery_Cells_10_Test.xlsx"
    # ============================================================================
    
    if not excel_file.exists():
        print(f"[ERROR] Excel file not found at {excel_file}")
        return
    
    print(f"[INFO] Reading Excel file: {excel_file}")
    
    # Read Excel file - automatically detect sheet name
    xls = pd.ExcelFile(excel_file)
    sheet_name = xls.sheet_names[0]  # Use first sheet
    print(f"  Sheet name: {sheet_name}")
    
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    print(f"[OK] Loaded {len(df)} rows from Excel\n")
    
    # Get database session
    db: Session = SessionLocal()
    
    try:
        # Clear existing data (optional)
        db.query(Cellule).delete()
        db.commit()
        print("[CLEAR] Cleared existing data from database\n")
        
        # Import each row
        imported_count = 0
        for index, row in df.iterrows():
            cell_type = str(row['type_cellule'])
            cellule = Cellule(
                nom=row['nom'],
                longueur_mm=float(row['longueur_mm']),
                largeur_mm=float(row['largeur_mm']),
                hauteur_mm=float(row['hauteur_mm']),
                masse_g=float(row['masse_g']),
                tension_nominale=float(row['tension_nominale']),
                capacite_ah=float(row['capacite_ah']),
                courant_max_a=float(row['courant_max_a']),
                type_cellule=cell_type,
                taux_swelling_pct=float(row['taux_swelling_pct']),
                diameter_mm=float(row['longueur_mm']) if cell_type == "Cylindrical" else None
            )
            db.add(cellule)
            imported_count += 1
            
            # Commit every 50 rows for performance
            if imported_count % 50 == 0:
                db.commit()
                print(f"[OK] Imported {imported_count} cells...")
        
        # Final commit
        db.commit()
        
        print(f"\n[SUCCESS] Successfully imported {imported_count} battery cells!\n")
        
        # Display statistics
        total_count = db.query(Cellule).count()
        pouch_count = db.query(Cellule).filter(Cellule.type_cellule == "Pouch").count()
        cylindrical_count = db.query(Cellule).filter(Cellule.type_cellule == "Cylindrical").count()
        prismatic_count = db.query(Cellule).filter(Cellule.type_cellule == "Prismatic").count()
        
        print("[STATS] Database Statistics:")
        print(f"  Total cells: {total_count}")
        print(f"  Pouch cells: {pouch_count}")
        print(f"  Cylindrical cells: {cylindrical_count}")
        print(f"  Prismatic cells: {prismatic_count}\n")
        
        # Display first 5 cells
        print("[INFO] First 5 imported cells:")
        print("-" * 120)
        first_cells = db.query(Cellule).limit(5).all()
        for cell in first_cells:
            print(f"  ID: {cell.id:3d} | {cell.nom:30s} | {cell.longueur_mm:6.1f}x{cell.largeur_mm:6.1f}x{cell.hauteur_mm:6.1f}mm | "
                  f"{cell.tension_nominale:5.2f}V | {cell.capacite_ah:6.1f}Ah | Type: {cell.type_cellule:12s} | Dia: {cell.diameter_mm}")
        
        print("-" * 120)
        print("\n[COMPLETE] Data import completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error during import: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import_data()
