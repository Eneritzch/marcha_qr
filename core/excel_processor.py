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
        """Parses an Excel file and creates Alumno records using SmartDataImporter."""
        from core.data_importer import AlumnosDataImporter

        try:
            # Inicializar importador inteligente
            importer = AlumnosDataImporter(file_obj=file_obj)
            
            # Ejecutar proceso de extracción y limpieza
            success, raw_data = importer.process()
            
            if not success:
               return False, f"Falló la lectura del archivo: {', '.join(importer.errors)}"

            lider = Lider.objects.get(id=lider_id)
            results = {'created': 0, 'errors': []}

            with transaction.atomic():
                for index, row in enumerate(raw_data):
                    # Nota: row ya es un diccionario limpio gracias a SmartDataImporter
                    
                    cedula = row['cedula'] # Ya viene limpio y zfilled
                    
                    if Alumno.objects.filter(cedula=cedula).exists():
                        results['errors'].append(f"Registro {index+1}: Cédula {cedula} ya existe.")
                        continue

                    try:
                        alumno = Alumno.objects.create(
                            nombre_completo=row['nombre_completo'],
                            cedula=cedula,
                            email=row['email'],
                            telefono=row['telefono'],
                            modalidad=row.get('modalidad', 'PRESENCIAL'), # Default si falta
                            carrera=row.get('carrera', 'NINGUNA'),
                            facultad=row.get('facultad', ''),
                            lider_invitador=lider
                        )
                        
                        # Handle optional bank data not yet implemented in SmartImporter normalization fully
                        # but we can try to access if available in original DF if needed. 
                        # For now, we focus on student data as per user request.
                        
                        results['created'] += 1
                    except Exception as e:
                        results['errors'].append(f"Registro {index+1}: Error al guardar - {str(e)}")

            if importer.errors:
                 results['errors'].extend([f"Importador Warn: {e}" for e in importer.errors])

            return True, results
        except Exception as e:
            logger.error(f"Error processing Excel: {str(e)}")
            return False, f"Error crítico al procesar el archivo: {str(e)}"
