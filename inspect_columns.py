import pandas as pd

file_path = r'C:\Users\karel\OneDrive\Desktop\asistencias\static\data\_Fiesta de gala 25 años UNEMI (respuestas).xlsx'

try:
    df = pd.read_excel(file_path)
    print("--- COLUMNS BY INDEX ---")
    for i, col in enumerate(df.columns):
        print(f"Column {i}: '{col}'")
    
    print("\n--- FIRST ROW DATA ---")
    if len(df) > 0:
        for i, val in enumerate(df.iloc[0]):
            print(f"Index {i}: {val}")

except Exception as e:
    print(f"Error: {e}")
