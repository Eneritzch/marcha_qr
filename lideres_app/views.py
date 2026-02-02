import os
import pandas as pd
from rest_framework import viewsets, views, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from django.db.models import Count, Q
from django.contrib.auth.models import User
from .models import Lider
from .serializers import LiderSerializer, LiderPublicSerializer
from alumnos.models import Alumno

class LiderViewSet(viewsets.ModelViewSet):
    queryset = Lider.objects.all()
    serializer_class = LiderSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

class ActiveLiderListView(views.APIView):
    """Returns a list of active leaders grouped by their group for the registration form."""
    def get(self, request):
        lideres = Lider.objects.filter(activo=True, visible_en_registro=True)
        serializer = LiderPublicSerializer(lideres, many=True)
        
        # Group by group number
        grouped_data = {}
        for item in serializer.data:
            g = item['grupo']
            if g not in grouped_data:
                grouped_data[g] = []
            grouped_data[g].append(item)
            
        return Response(grouped_data)

from django.contrib.auth import authenticate, login
from rest_framework.authtoken.models import Token

class LeaderLoginView(views.APIView):
    """Custom login for leaders using their generated usernames."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = [] # Disable Auth checks (CSRF) for login endpoint

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({"error": "Debe proporcionar usuario y contraseña"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = authenticate(username=username, password=password)
        
        if user is not None:
            # Auto-provision profile for Superusers if missing
            if user.is_superuser and not hasattr(user, 'lider_profile'):
                Lider.objects.create(
                    user=user,
                    nombre_completo="Administrador del Sistema",
                    cedula="9999999999",
                    grupo=1,
                    activo=True,
                    visible_en_registro=False
                )
                # Refresh user to load the new profile relationship
                user.refresh_from_db()

            if hasattr(user, 'lider_profile'):
                login(request, user)
                token, _ = Token.objects.get_or_create(user=user)
                lider = user.lider_profile
                return Response({
                    "token": token.key,
                    "username": user.username,
                    "nombre": lider.nombre_completo,
                    "grupo": lider.grupo,
                    "is_superuser": user.is_superuser
                })
            return Response({"error": "El usuario no tiene un perfil de líder"}, status=status.HTTP_403_FORBIDDEN)
            
        return Response({"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

class DashboardStatsView(views.APIView):

    """General statistics for the dashboard."""
    def get(self, request):
        total_registrados = Alumno.objects.count()
        total_asistieron = Alumno.objects.filter(asistio=True).count()
        
        # Optimized aggregation: 1 query instead of 15
        from django.db.models import Sum, Case, When, IntegerField
        
        # Initialize stats for all groups to 0
        stats_map = {g: {'grupo': g, 'total': 0, 'asistieron': 0, 'porcentaje': 0} for g in range(1, 16)}

        # Aggregate counts by group
        qs = Alumno.objects.values('grupo').annotate(
            total=Count('id'),
            asistencia=Count(Case(When(asistio=True, then=1), output_field=IntegerField()))
        ).order_by('grupo')

        for entry in qs:
            g = entry['grupo']
            if g in stats_map:
                total = entry['total']
                asistieron = entry['asistencia']
                stats_map[g]['total'] = total
                stats_map[g]['asistieron'] = asistieron
                stats_map[g]['porcentaje'] = round((asistieron / total * 100), 1) if total > 0 else 0
        
        stats_grupos = list(stats_map.values())

        return Response({
            'total_registrados': total_registrados,
            'total_asistieron': total_asistieron,
            'stats_grupos': stats_grupos
        })

class LeaderExcelUploadView(views.APIView):
    """Processes manual Excel uploads to import new leaders."""
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.data.get('file')
        if not file_obj:
            return Response({"error": "No se subió ningún archivo"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            df = pd.read_excel(file_obj)
            count_new = 0
            
            for index, row in df.iterrows():
                # Format: Name (Col 1), Email (Col 2)
                # Note: iloc[1] is Name, iloc[2] is Email based on previous script observations
                try:
                    name = str(row.iloc[1]).strip()
                    email = str(row.iloc[2]).strip().lower() # Normalize to lowercase
                except:
                    continue
                
                if not name or not email or '@' not in email:
                    continue
                    
                # Skip if leader with this email already exists
                if Lider.objects.filter(email=email).exists() or User.objects.filter(username=email).exists():
                    continue
                    
                # Create user
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password='mucunemi25'
                )
                
                # Create leader
                Lider.objects.create(
                    user=user,
                    nombre_completo=name,
                    email=email,
                    grupo=1,
                    activo=True,
                    visible_en_registro=True
                )
                count_new += 1
                
            return Response({"message": f"Importación completada. {count_new} nuevos líderes agregados."}, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"Error al procesar el archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RandomLeaderView(views.APIView):
    """Returns a random active leader for automatic assignment."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import random
        lideres_activos = list(Lider.objects.filter(activo=True))
        
        if not lideres_activos:
             return Response({"error": "No hay líderes activos disponibles"}, status=status.HTTP_404_NOT_FOUND)
             
        lider = random.choice(lideres_activos)
        return Response({
            "id": lider.id,
            "nombre_completo": lider.nombre_completo,
            "grupo": lider.grupo
        })


class RedistribuirAlumnosView(views.APIView):
    """Redistribuye equitativamente los alumnos entre los líderes del mismo grupo."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        grupo = request.data.get('grupo')  # None = todos los grupos
        dry_run = request.data.get('dry_run', False)

        try:
            # Determinar qué grupos procesar
            if grupo:
                grupos = [grupo]
            else:
                grupos = list(Lider.objects.values_list('grupo', flat=True).distinct().order_by('grupo'))

            resultados_por_grupo = []
            total_cambios_globales = 0

            for grupo_num in grupos:
                # Obtener líderes activos en este grupo
                lideres = list(Lider.objects.filter(grupo=grupo_num, activo=True).order_by('nombre_completo'))

                if len(lideres) <= 1:
                    resultados_por_grupo.append({
                        'grupo': grupo_num,
                        'estado': 'sin_cambios',
                        'razon': 'Solo hay 1 líder o no hay líderes en este grupo',
                        'cambios': 0,
                        'distribucion_anterior': {},
                        'distribucion_nueva': {}
                    })
                    continue

                # Obtener todos los alumnos de este grupo
                alumnos = list(Alumno.objects.filter(grupo=grupo_num).order_by('fecha_registro'))

                if not alumnos:
                    resultados_por_grupo.append({
                        'grupo': grupo_num,
                        'estado': 'sin_cambios',
                        'razon': 'No hay alumnos en este grupo',
                        'cambios': 0,
                        'distribucion_anterior': {},
                        'distribucion_nueva': {}
                    })
                    continue

                # Calcular distribución actual
                distribucion_anterior = {}
                for lider in lideres:
                    count = lider.alumnos.filter(grupo=grupo_num).count()
                    distribucion_anterior[lider.id] = {
                        'nombre': lider.nombre_completo,
                        'cantidad': count
                    }

                # Calcular nueva distribución
                total_alumnos = len(alumnos)
                num_lideres = len(lideres)
                alumnos_por_lider = total_alumnos // num_lideres
                alumnos_extras = total_alumnos % num_lideres

                nueva_distribucion = {}
                for lider in lideres:
                    nueva_distribucion[lider.id] = {
                        'nombre': lider.nombre_completo,
                        'cantidad': alumnos_por_lider + (1 if list(lideres).index(lider) < alumnos_extras else 0)
                    }

                # Crear asignaciones
                cambios = 0
                nuevas_asignaciones = []
                idx_lider = 0
                alumnos_asignados_por_lider = {lider.id: 0 for lider in lideres}

                for idx, alumno in enumerate(alumnos):
                    lider_nuevo = lideres[idx_lider]

                    if alumno.lider_invitador != lider_nuevo:
                        cambios += 1
                        nuevas_asignaciones.append({
                            'alumno_id': alumno.id,
                            'alumno_nombre': alumno.nombre_completo,
                            'lider_anterior': alumno.lider_invitador.nombre_completo if alumno.lider_invitador else 'Sin asignar',
                            'lider_nuevo': lider_nuevo.nombre_completo
                        })

                    # Contar cuántos alumnos ya asignamos a este líder
                    alumnos_asignados_por_lider[lider_nuevo.id] += 1
                    cantidad_para_lider = nueva_distribucion[lider_nuevo.id]['cantidad']

                    if alumnos_asignados_por_lider[lider_nuevo.id] >= cantidad_para_lider and idx_lider < len(lideres) - 1:
                        idx_lider += 1

                # Ejecutar cambios si no es dry_run
                if not dry_run and cambios > 0:
                    idx_lider = 0
                    alumnos_asignados_por_lider = {lider.id: 0 for lider in lideres}
                    
                    for idx, alumno in enumerate(alumnos):
                        lider_nuevo = lideres[idx_lider]
                        alumno.lider_invitador = lider_nuevo
                        alumno.grupo = lider_nuevo.grupo
                        alumno.save()

                        # Contar cuántos alumnos ya asignamos a este líder
                        alumnos_asignados_por_lider[lider_nuevo.id] += 1
                        cantidad_para_lider = nueva_distribucion[lider_nuevo.id]['cantidad']

                        if alumnos_asignados_por_lider[lider_nuevo.id] >= cantidad_para_lider and idx_lider < len(lideres) - 1:
                            idx_lider += 1

                resultados_por_grupo.append({
                    'grupo': grupo_num,
                    'estado': 'completado' if cambios > 0 else 'sin_cambios',
                    'cambios': cambios,
                    'distribucion_anterior': distribucion_anterior,
                    'distribucion_nueva': nueva_distribucion,
                    'detalles_cambios': nuevas_asignaciones[:10]  # Mostrar primeros 10 cambios
                })

                total_cambios_globales += cambios

            return Response({
                'exito': True,
                'modo': 'simulacion' if dry_run else 'ejecucion',
                'total_cambios': total_cambios_globales,
                'resultados_por_grupo': resultados_por_grupo
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'exito': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
