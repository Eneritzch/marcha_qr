from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from lideres_app.models import Lider
from alumnos.models import Alumno


class Command(BaseCommand):
    help = 'Distribuye equitativamente los alumnos entre los líderes del mismo grupo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--grupo',
            type=int,
            help='Número de grupo específico a redistribuir (opcional)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simula los cambios sin ejecutarlos',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        grupo_especifico = options.get('grupo')

        # Obtener los grupos a procesar
        if grupo_especifico:
            grupos = [grupo_especifico]
        else:
            # Obtener todos los grupos que tienen líderes
            grupos = Lider.objects.values_list('grupo', flat=True).distinct().order_by('grupo')

        total_cambios = 0

        for grupo_num in grupos:
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(f"Procesando GRUPO {grupo_num}")
            self.stdout.write('='*60)

            # Obtener líderes activos en este grupo
            lideres = Lider.objects.filter(grupo=grupo_num, activo=True).order_by('nombre_completo')

            if not lideres.exists():
                self.stdout.write(self.style.WARNING(f"No hay líderes activos en el grupo {grupo_num}"))
                continue

            if lideres.count() == 1:
                self.stdout.write(self.style.SUCCESS(f"Solo hay 1 líder en el grupo {grupo_num}, no hay redistribución necesaria"))
                continue

            # Obtener todos los alumnos de este grupo
            alumnos = Alumno.objects.filter(grupo=grupo_num).order_by('fecha_registro')

            if not alumnos.exists():
                self.stdout.write(self.style.WARNING(f"No hay alumnos en el grupo {grupo_num}"))
                continue

            total_alumnos = alumnos.count()
            num_lideres = lideres.count()
            alumnos_por_lider = total_alumnos // num_lideres
            alumnos_extras = total_alumnos % num_lideres

            self.stdout.write(f"Total de alumnos: {total_alumnos}")
            self.stdout.write(f"Total de líderes: {num_lideres}")
            self.stdout.write(f"Alumnos por líder: {alumnos_por_lider}")
            self.stdout.write(f"Alumnos adicionales a distribuir: {alumnos_extras}")

            # Mostrar distribución actual
            self.stdout.write("\n--- DISTRIBUCIÓN ACTUAL ---")
            for lider in lideres:
                count_actual = lider.alumnos.filter(grupo=grupo_num).count()
                self.stdout.write(f"  {lider.nombre_completo}: {count_actual} alumnos")

            # Crear la nueva distribución
            nueva_distribucion = []
            idx_lider = 0

            for idx, alumno in enumerate(alumnos):
                # Los primeros 'alumnos_extras' líderes reciben un alumno adicional
                cantidad_para_lider = alumnos_por_lider + (1 if idx_lider < alumnos_extras else 0)

                nueva_distribucion.append({
                    'alumno': alumno,
                    'lider_anterior': alumno.lider_invitador,
                    'lider_nuevo': lideres[idx_lider],
                    'grupo': grupo_num
                })

                # Contar cuántos alumnos ya asignamos a este líder
                alumnos_asignados = sum(1 for item in nueva_distribucion if item['lider_nuevo'] == lideres[idx_lider])

                # Pasar al siguiente líder si alcanzamos la cuota
                if alumnos_asignados >= cantidad_para_lider:
                    idx_lider += 1

            # Mostrar cambios a realizar
            self.stdout.write("\n--- DISTRIBUCIÓN NUEVA ---")
            cambios_por_lider = {}

            for item in nueva_distribucion:
                lider_nuevo = item['lider_nuevo']
                if lider_nuevo not in cambios_por_lider:
                    cambios_por_lider[lider_nuevo] = []
                cambios_por_lider[lider_nuevo].append(item['alumno'])

            for lider in lideres:
                alumnos_nuevos = cambios_por_lider.get(lider, [])
                self.stdout.write(f"  {lider.nombre_completo}: {len(alumnos_nuevos)} alumnos")

            # Mostrar cambios específicos
            self.stdout.write("\n--- CAMBIOS A REALIZAR ---")
            cambios_realizados = 0

            for item in nueva_distribucion:
                alumno = item['alumno']
                lider_anterior = item['lider_anterior']
                lider_nuevo = item['lider_nuevo']

                if lider_anterior != lider_nuevo:
                    cambios_realizados += 1
                    nombre_anterior = lider_anterior.nombre_completo if lider_anterior else "Sin asignar"
                    self.stdout.write(
                        f"  {alumno.nombre_completo}: {nombre_anterior} → {lider_nuevo.nombre_completo}"
                    )

            total_cambios += cambios_realizados

            # Ejecutar los cambios
            if not dry_run and cambios_realizados > 0:
                self.stdout.write(f"\n{self.style.SUCCESS('Aplicando cambios...')}")
                for item in nueva_distribucion:
                    alumno = item['alumno']
                    lider_nuevo = item['lider_nuevo']

                    if alumno.lider_invitador != lider_nuevo:
                        alumno.lider_invitador = lider_nuevo
                        alumno.grupo = lider_nuevo.grupo
                        alumno.save()

                self.stdout.write(self.style.SUCCESS(f"✓ Se realizaron {cambios_realizados} cambios en el grupo {grupo_num}"))
            elif dry_run:
                self.stdout.write(self.style.WARNING(f"[DRY-RUN] Se realizarían {cambios_realizados} cambios en el grupo {grupo_num}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"✓ La distribución ya es equitativa en el grupo {grupo_num}"))

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"✓ PROCESO COMPLETADO"))
        self.stdout.write(f"Total de cambios realizados: {total_cambios}")
        self.stdout.write('='*60)
