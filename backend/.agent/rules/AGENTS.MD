---
trigger: manual
---


**Formula**: 
- Target Energy (Wh) = s*P * Vn * Cap * DoD
- P = I target / I max
- S = E / Vn * * Cap * DoD * P
- Actual Voltage = S * Cell Nominal Voltage
- Actual Capacity = P * Cell Capacity
- Cellule Volume = L * l * h * N_cellules 
- Total Pack Weight (kg) = (S * P * Cell Mass (g)) / 1000
- Taux d'occupation = (Volume_totale_cellules/Volume_pack)*100
- Dimension_gonflés = Dim_cellule * (1 + Taux_gonflement/100)
- Margin par cote = (Dim_housing - Dim_gonflés) / 2