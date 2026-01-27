import pandas as pd
from django.db import transaction
from alumnos.models import Alumno, CuentaBancaria
from lideres_app.models import Lider
import logging

logger = logging.getLogger(__name__)

class ExcelProcessor:
    REQUIRED_COLUMNS = [
        'nombre_completo', 'cedula', 'email', 'telefono', 
        'modalidad', 'carrera'
    ]

    @staticmethod
    def process_alumnos_excel(file_obj, lider_id):
        """Parses an Excel file and creates Alumno records."""
        try:
            df = pd.read_excel(file_obj)
            
            # Basic validation
            missing_cols = [col for col in ExcelProcessor.REQUIRED_COLUMNS if col not in df.columns]
            if missing_cols:
                return False, f"Faltan las siguientes columnas: {', '.join(missing_cols)}"

            lider = Lider.objects.get(id=lider_id)
            results = {'created': 0, 'errors': []}

            with transaction.atomic():
                for index, row in df.iterrows():
                    cedula = str(row['cedula']).strip().zfill(10)
                    
                    if Alumno.objects.filter(cedula=cedula).exists():
                        results['errors'].append(f"Fila {index+2}: Cédula {cedula} ya existe.")
                        continue

                    try:
                        alumno = Alumno.objects.create(
                            nombre_completo=row['nombre_completo'],
                            cedula=cedula,
                            email=row['email'],
                            telefono=str(row['telefono']),
                            modalidad=row['modalidad'],
                            carrera=row['carrera'],
                            facultad=row.get('facultad', ''),
                            lider_invitador=lider
                        )
                        
                        # Handle optional bank data if present
                        if 'banco' in df.columns and pd.notnull(row['banco']):
                            CuentaBancaria.objects.create(
                                alumno=alumno,
                                titular_nombre=row.get('titular_nombre', row['nombre_completo']),
                                titular_cedula=row.get('titular_cedula', cedula),
                                banco=row['banco'],
                                tipo_cuenta=row.get('tipo_cuenta', 'AHORROS'),
                                numero_cuenta=str(row['numero_cuenta']),
                                es_propia=row.get('es_propia', True)
                            )
                        
                        results['created'] += 1
                    except Exception as e:
                        results['errors'].append(f"Fila {index+2}: Error - {str(e)}")

            return True, results
        except Exception as e:
            logger.error(f"Error processing Excel: {str(e)}")
            return False, f"Error crítico al procesar el archivo: {str(e)}"
