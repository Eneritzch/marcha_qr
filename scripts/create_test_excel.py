import pandas as pd
import os

def create_messy_excel():
    data = [
        ["Universidad XYZ", "", "", "", ""],
        ["Reporte de Inscritos", "", "", "", ""],
        ["", "", "", "", ""], # Empty row
        # Messy Header
        ["Nombres y Apellidos", "C.I.", "Correo Electronico", "Celular", "Carrera"],
        # Data
        ["Juan Perez", "0912345678", "juan@test.com", "0991234567", "Software"],
        ["Maria Lopez", "1205432109", "maria@test.com", "0987654321", "Industrial"],
        ["Pedro Picapiedra", "1111111111", "pedro@rock.com", "0911111111", "Mecanica"],
        ["", "", "", "", ""], # Empty row
        ["Ana Gump", "1712345678", "ana@run.com", "0999999999", "Software"], # Valid
    ]
    
    df = pd.DataFrame(data)
    
    # Save to file
    file_path = "test_messy_alumnos.xlsx"
    df.to_excel(file_path, index=False, header=False)
    print(f"Created {file_path}")

if __name__ == "__main__":
    create_messy_excel()
