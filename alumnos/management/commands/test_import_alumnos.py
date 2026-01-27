from django.core.management.base import BaseCommand
from core.data_importer import AlumnosDataImporter
import pandas as pd
import os

class Command(BaseCommand):
    help = 'Test the Smart Data Importer with an Excel file'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the Excel file to test')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']

        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"El archivo no existe: {file_path}"))
            return

        self.stdout.write(f"Procesando archivo con SmartDataImporter: {file_path}")

        importer = AlumnosDataImporter(file_path=file_path)
        
        # Paso 1: Cargar
        if not importer.load_file():
            self.stdout.write(self.style.ERROR("Error al cargar el archivo."))
            for err in importer.errors:
                self.stdout.write(f" - {err}")
            return

        # Paso 2: Detectar Header
        if importer.find_header_row():
            self.stdout.write(self.style.SUCCESS(f"¡Header detectado en la fila: {importer.header_row_index}!"))
        else:
            self.stdout.write(self.style.WARNING("No se detectó header automáticamente (usando fila 0 por defecto o fallará)."))

        # Paso 3: Normalizar y Extraer
        success, data = importer.process()

        if success:
            self.stdout.write(self.style.SUCCESS(f"Importación simulada exitosa. Se encontraron {len(data)} registros válidos."))
            
            self.stdout.write("\n--- Muestra de primeros 3 registros ---")
            for i, record in enumerate(data[:3]):
                self.stdout.write(f"Registro {i+1}:")
                for k, v in record.items():
                    self.stdout.write(f"  {k}: {v}")
            self.stdout.write("---------------------------------------")
            
            # Mostrar columnas originales vs mapeadas si es posible
            if importer.df is not None:
                self.stdout.write("\nColumnas finales en el DataFrame procesado:")
                self.stdout.write(", ".join(importer.df.columns))

        else:
            self.stdout.write(self.style.ERROR("Falló el proceso de importación."))
            for err in importer.errors:
                self.stdout.write(f" - {err}")
