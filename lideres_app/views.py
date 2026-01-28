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
        
        stats_grupos = []
        for grupo_num in range(1, 16):
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
