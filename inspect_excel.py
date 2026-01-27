import pandas as pd

file_path = r'C:\Users\karel\OneDrive\Desktop\asistencias\static\data\_Fiesta de gala 25 años UNEMI (respuestas).xlsx'

try:
    df = pd.read_excel(file_path)
    print("COLUMNS:")
    print(df.columns.tolist())
    print("\nSAMPLE ROW:")
    if not df.empty:
        print(df.iloc[0].to_dict())
except Exception as e:
    print(f"Error reading excel: {e}")
