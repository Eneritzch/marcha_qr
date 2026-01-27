import pandas as pd

file_path = r'C:\Users\karel\OneDrive\Desktop\asistencias\static\data\_Fiesta de gala 25 años UNEMI (respuestas).xlsx'

try:
    df = pd.read_excel(file_path)
    print("--- COLUMNS START ---")
    for i, col in enumerate(df.columns):
        print(f"{i}: {col}")
    print("--- COLUMNS END ---")
    
    print("\n--- FIRST ROW START ---")
    row = df.iloc[0]
    for i, val in enumerate(row):
        print(f"{i}: {val}")
    print("--- FIRST ROW END ---")

except Exception as e:
    print(f"Error: {e}")
