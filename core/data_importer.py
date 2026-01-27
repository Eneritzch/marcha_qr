import pandas as pd
import logging
from django.utils.text import slugify

logger = logging.getLogger(__name__)

class BaseSmartImporter:
    """
    Base generic importer for Excel files with inconsistent formats.
    """
    
    # Subclasses must define these
    COLUMN_MAPPING = {} 
    REQUIRED_FIELDS = []

    def __init__(self, file_path=None, file_obj=None):
        self.file_path = file_path
        self.file_obj = file_obj
        self.df = None
        self.header_row_index = 0
        self.errors = []

    def load_file(self):
        """Loads the file into a raw DataFrame."""
        try:
            source = self.file_obj if self.file_obj else self.file_path
            # Read without header initially to search for it manually
            self.df = pd.read_excel(source, header=None)
            return True
        except Exception as e:
            self.errors.append(f"Error al leer el archivo: {str(e)}")
            return False

    def find_header_row(self, max_scan_rows=20):
        """
        Scans the first few rows to find the one that best matches the expected headers.
        """
        if self.df is None or self.df.empty:
            self.errors.append("El archivo está vacío o no se ha cargado.")
            return False

        best_match_count = 0
        best_row_index = -1
        
        # Iterate over the first few rows
        for index, row in self.df.head(max_scan_rows).iterrows():
            # Convert row to clean strings
            row_values = [str(val).strip().lower() for val in row.values if pd.notna(val)]
            match_count = 0
            
            # Check how many of our target columns appear in this row (by alias)
            for target_col, aliases in self.COLUMN_MAPPING.items():
                for val in row_values:
                    # Normalize cell value for comparison
                    val_clean = val.replace('.', '').replace('_', ' ')
                    if val_clean in aliases:
                        match_count += 1
                        break # Found this target_col in this row
            
            if match_count > best_match_count:
                best_match_count = match_count
                best_row_index = index

        # Minimum threshold: at least 2 columns identified or majority
        if best_match_count >= 2: 
            self.header_row_index = best_row_index
            return True
        
        self.errors.append("No se pudo detectar automáticamente la fila de encabezados.")
        return False

    def normalize_columns(self):
        """
        Renames DataFrame columns based on detected header row and alias mapping.
        """
        try:
            source = self.file_obj if self.file_obj else self.file_path
            # Re-read using the detected row as header
            self.df = pd.read_excel(source, header=self.header_row_index)
            self.df.columns = self.df.columns.astype(str).str.strip()
        except Exception as e:
            self.errors.append(f"Error al recargar con header detectado: {str(e)}")
            return False
            
        # Rename map: {OriginalName: StandardName}
        rename_map = {}
        
        for col_name in self.df.columns:
            col_lower = str(col_name).strip().lower().replace('.', '').replace('_', ' ')
            
            match_found = False
            for target_field, aliases in self.COLUMN_MAPPING.items():
                if col_lower in aliases:
                    rename_map[col_name] = target_field
                    match_found = True
                    break
            
            if not match_found:
                # Extra attempt: Tokenization
                import re
                tokens = re.split(r'[\s/._-]+', col_lower)
                for target_field, aliases in self.COLUMN_MAPPING.items():
                    for alias in aliases:
                        if alias in tokens: 
                            rename_map[col_name] = target_field
                            match_found = True
                            break
                    if match_found: break

            if not match_found:
                # Final attempt: 'contains' for long aliases
                for target_field, aliases in self.COLUMN_MAPPING.items():
                    for alias in aliases:
                        if len(alias) > 3 and alias in col_lower:
                            rename_map[col_name] = target_field
                            match_found = True
                            break
                    if match_found: break

        if not rename_map:
            self.errors.append("No se pudieron mapear columnas conocidas a partir de los encabezados.")
            return False

        # Rename columns
        self.df.rename(columns=rename_map, inplace=True)
        
        # Check required columns
        missing = [req for req in self.REQUIRED_FIELDS if req not in self.df.columns]
        if missing:
            self.errors.append(f"Faltan columnas obligatorias detectadas: {', '.join(missing)}")
            return False
            
        return True

    def clean_row(self, row_data):
        """
        Override this method to perform specific cleaning on a row dictionary.
        Must return the cleaned dictionary or None to discard the row.
        """
        return row_data

    def get_data(self):
        """
        Returns a list of dictionaries with clean data.
        """
        if self.df is None:
            return []
            
        data = []
        for index, row in self.df.iterrows():
            if row.isnull().all():
                continue
                
            clean_row = {}
            
            # Extract only mapped columns
            for field in self.COLUMN_MAPPING.keys():
                if field in self.df.columns:
                    val = row[field]
                    if pd.isna(val):
                        val = ""
                    clean_row[field] = val
            
            # Apply specific cleaning logic
            final_row = self.clean_row(clean_row)
            
            if final_row:
                data.append(final_row)
            
        return data

    def process(self):
        """Main method to execute the flow."""
        if not self.load_file():
            return False, self.errors
            
        if not self.find_header_row():
            self.header_row_index = 0
            self.errors.append("Advertencia: No se detectó header seguro, usando primera fila.")
            
        if not self.normalize_columns():
            return False, self.errors
            
        data = self.get_data()
        return True, data


class AlumnosDataImporter(BaseSmartImporter):
    """
    Specific importer for Alumnos data.
    """
    COLUMN_MAPPING = {
        'nombre_completo': [
            'nombre', 'nombres', 'apellidos', 'nombre completo', 'nombre del estudiante', 
            'alumno', 'cliente', 'participante', 'nombres y apellidos'
        ],
        'cedula': [
            'cedula', 'cédula', 'ci', 'dni', 'identificacion', 'identificación', 
            'ruc', 'documento', 'id'
        ],
        'email': [
            'email', 'e-mail', 'correo', 'correo electronico', 'correo electrónico', 
            'mail', 'direccion de correo'
        ],
        'telefono': [
            'telefono', 'teléfono', 'celular', 'movil', 'móvil', 'whatsapp', 
            'contacto', 'tlf', 'cel'
        ],
        'modalidad': [
            'modalidad', 'tipo', 'forma', 'metodo'
        ],
        'carrera': [
            'carrera', 'profesion', 'profesión', 'programa', 'curso'
        ],
        'facultad': [
            'facultad', 'area', 'departamento'
        ]
    }

    REQUIRED_FIELDS = ['nombre_completo', 'cedula']

    def clean_row(self, row_data):
        # Validation
        cedula = str(row_data.get('cedula', '')).strip()
        if not cedula or cedula.lower() in ['nan', 'none', '']:
            return None # Skip invalid rows
            
        # Specific cleaning
        row_data['cedula'] = cedula.zfill(10) # Ecuador standard
        row_data['telefono'] = str(row_data.get('telefono', '')).replace('.0', '')
        
        return row_data

# Alias for backward compatibility if needed, though we will update usages
SmartDataImporter = AlumnosDataImporter

