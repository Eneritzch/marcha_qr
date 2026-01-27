from rest_framework import viewsets, views, permissions, status
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Lider
from .serializers import LiderSerializer, LiderPublicSerializer
from alumnos.models import Alumno

class LiderViewSet(viewsets.ModelViewSet):
    queryset = Lider.objects.all()
    serializer_class = LiderSerializer

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
                    "grupo": lider.grupo
                })
            return Response({"error": "El usuario no tiene un perfil de líder"}, status=status.HTTP_403_FORBIDDEN)
            
        return Response({"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

class DashboardStatsView(views.APIView):

    """General statistics for the dashboard."""
    def get(self, request):
        total_registrados = Alumno.objects.count()
        total_asistieron = Alumno.objects.filter(asistio=True).count()
        
        stats_grupos = []
        for grupo_num in [1, 2, 3, 4]:
            grupo_alumnos = Alumno.objects.filter(grupo=grupo_num)
            total_grupo = grupo_alumnos.count()
            asistieron_grupo = grupo_alumnos.filter(asistio=True).count()
            
            stats_grupos.append({
                'grupo': grupo_num,
                'total': total_grupo,
                'asistieron': asistieron_grupo,
                'porcentaje': round((asistieron_grupo / total_grupo * 100), 1) if total_grupo > 0 else 0
            })

        return Response({
            'total_registrados': total_registrados,
            'total_asistieron': total_asistieron,
            'stats_grupos': stats_grupos
        })
