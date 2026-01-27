from django.core.management.base import BaseCommand
from lideres_app.models import Lider

class Command(BaseCommand):
    help = 'Carga los 27 líderes iniciales con nombres placeholder'

    def handle(self, *args, **kwargs):
        lideres_iniciales = [
            # GRUPO 1 (7 líderes)
            {'nombre': 'Líder 1.1', 'cedula': '0900000001', 'grupo': 1, 'orden': 1},
            {'nombre': 'Líder 1.2', 'cedula': '0900000002', 'grupo': 1, 'orden': 2},
            {'nombre': 'Líder 1.3', 'cedula': '0900000003', 'grupo': 1, 'orden': 3},
            {'nombre': 'Líder 1.4', 'cedula': '0900000004', 'grupo': 1, 'orden': 4},
            {'nombre': 'Líder 1.5', 'cedula': '0900000005', 'grupo': 1, 'orden': 5},
            {'nombre': 'Líder 1.6', 'cedula': '0900000006', 'grupo': 1, 'orden': 6},
            {'nombre': 'Líder 1.7', 'cedula': '0900000007', 'grupo': 1, 'orden': 7},
            
            # GRUPO 2 (7 líderes)
            {'nombre': 'Líder 2.1', 'cedula': '0900000008', 'grupo': 2, 'orden': 1},
            {'nombre': 'Líder 2.2', 'cedula': '0900000009', 'grupo': 2, 'orden': 2},
            {'nombre': 'Líder 2.3', 'cedula': '0900000010', 'grupo': 2, 'orden': 3},
            {'nombre': 'Líder 2.4', 'cedula': '0900000011', 'grupo': 2, 'orden': 4},
            {'nombre': 'Líder 2.5', 'cedula': '0900000012', 'grupo': 2, 'orden': 5},
            {'nombre': 'Líder 2.6', 'cedula': '0900000013', 'grupo': 2, 'orden': 6},
            {'nombre': 'Líder 2.7', 'cedula': '0900000014', 'grupo': 2, 'orden': 7},
            
            # GRUPO 3 (7 líderes)
            {'nombre': 'Líder 3.1', 'cedula': '0900000015', 'grupo': 3, 'orden': 1},
            {'nombre': 'Líder 3.2', 'cedula': '0900000016', 'grupo': 3, 'orden': 2},
            {'nombre': 'Líder 3.3', 'cedula': '0900000017', 'grupo': 3, 'orden': 3},
            {'nombre': 'Líder 3.4', 'cedula': '0900000018', 'grupo': 3, 'orden': 4},
            {'nombre': 'Líder 3.5', 'cedula': '0900000019', 'grupo': 3, 'orden': 5},
            {'nombre': 'Líder 3.6', 'cedula': '0900000020', 'grupo': 3, 'orden': 6},
            {'nombre': 'Líder 3.7', 'cedula': '0900000021', 'grupo': 3, 'orden': 7},
            
            # GRUPO 4 (6 líderes) - Total = 27
            {'nombre': 'Líder 4.1', 'cedula': '0900000022', 'grupo': 4, 'orden': 1},
            {'nombre': 'Líder 4.2', 'cedula': '0900000023', 'grupo': 4, 'orden': 2},
            {'nombre': 'Líder 4.3', 'cedula': '0900000024', 'grupo': 4, 'orden': 3},
            {'nombre': 'Líder 4.4', 'cedula': '0900000025', 'grupo': 4, 'orden': 4},
            {'nombre': 'Líder 4.5', 'cedula': '0900000026', 'grupo': 4, 'orden': 5},
            {'nombre': 'Líder 4.6', 'cedula': '0900000027', 'grupo': 4, 'orden': 6},
        ]
        
        for lider_data in lideres_iniciales:
            Lider.objects.get_or_create(
                cedula=lider_data['cedula'],
                defaults={
                    'nombre_completo': lider_data['nombre'],
                    'grupo': lider_data['grupo'],
                    'orden': lider_data['orden'],
                    'activo': True,
                    'visible_en_registro': True
                }
            )
        
        self.stdout.write(
            self.style.SUCCESS('✓ 27 líderes cargados exitosamente')
        )
