from django.core.management.base import BaseCommand
from django.core.files.uploadedfile import SimpleUploadedFile
from core.excel_processor import ExcelProcessor
from lideres_app.models import Lider
import os
import random

class Command(BaseCommand):
    help = 'Import alumnos from an Excel file'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the Excel file')
        # Made lider-id optional
        parser.add_argument('--lider-id', type=int, required=False, help='ID of the leader to assign. If omitted, a random active leader will be selected.')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']
        lider_id = kwargs['lider_id']

        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"El archivo no existe: {file_path}"))
            return

        # If no leader ID provided, pick a random active one
        if lider_id is None:
            active_leaders = list(Lider.objects.filter(activo=True))
            if not active_leaders:
                self.stderr.write(self.style.ERROR("No existen líderes activos en la base de datos para asignar aleatoriamente."))
                return
            
            selected_leader = random.choice(active_leaders)
            lider_id = selected_leader.id
            self.stdout.write(self.style.WARNING(f"⚠️ No se especificó ID de líder. Asignando aleatoriamente a: {selected_leader.nombre_completo} (ID: {lider_id})"))
        else:
            self.stdout.write(f"Asignando a líder ID: {lider_id}")

        self.stdout.write(f"Procesando archivo: {file_path}")

        try:
            with open(file_path, 'rb') as f:
                success, result = ExcelProcessor.process_alumnos_excel(f, lider_id)

            if success:
                self.stdout.write(self.style.SUCCESS(f"Importación exitosa."))
                self.stdout.write(f"Creados: {result['created']}")
                if result['errors']:
                    self.stdout.write(self.style.WARNING("Advertencias/Errores no bloqueantes:"))
                    for error in result['errors']:
                        self.stdout.write(f" - {error}")
            else:
                self.stdout.write(self.style.ERROR(f"Falló la importación: {result}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error inesperado: {str(e)}"))
