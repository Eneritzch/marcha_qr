from rest_framework import viewsets, status, views, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import Alumno
from .serializers import AlumnoSerializer
from core.utils import QRGenerator
from core.excel_processor import ExcelProcessor

class IsLeader(permissions.BasePermission):
    """Custom permission to only allow leaders to access their own data."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'lider_profile')

class AlumnoViewSet(viewsets.ModelViewSet):
    queryset = Alumno.objects.all()
    serializer_class = AlumnoSerializer
    lookup_field = 'cedula'

    def get_queryset(self):
        """Filter students by the logged-in leader."""
        user = self.request.user
        if user.is_staff:
            return Alumno.objects.all()
        if hasattr(user, 'lider_profile'):
            return Alumno.objects.filter(lider_invitador=user.lider_profile)
        return Alumno.objects.none()

    def create(self, request, *args, **kwargs):
        # ... (keep existing create logic or simplify)
        return super().create(request, *args, **kwargs)

class ExcelUploadView(views.APIView):
    """API view for bulk student upload via Excel."""
    permission_classes = [IsLeader]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        file_obj = request.data.get('file')
        if not file_obj:
            return Response({"error": "Debe proporcionar un archivo (.xlsx)"}, status=status.HTTP_400_BAD_REQUEST)

        success, result = ExcelProcessor.process_alumnos_excel(file_obj, request.user.lider_profile.id)
        
        if success:
            return Response(result, status=status.HTTP_201_CREATED)
        else:
            return Response({"error": result}, status=status.HTTP_400_BAD_REQUEST)

class CredentialRecoveryView(views.APIView):

    """View to recover student data by cédula."""
    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        serializer = AlumnoSerializer(alumno)
        return Response(serializer.data)

class QRDownloadView(views.APIView):
    """Generates and serves the QR code for a student on-the-fly."""
    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        qr_bytes = QRGenerator.generate_qr_bytes(alumno.codigo_qr)
        
        response = HttpResponse(qr_bytes, content_type="image/png")
        response['Content-Disposition'] = f'attachment; filename="qr_{alumno.codigo_qr}.png"'
        return response

class MarcarAsistenciaView(views.APIView):
    """Marks attendance for a student given their ID (cedula)."""
    permission_classes = [permissions.IsAuthenticated] # Leaders only

    def post(self, request):
        cedula = request.data.get('cedula')
        if not cedula:
            return Response({"error": "Cédula requerida"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            alumno = Alumno.objects.get(cedula=cedula)
            
            # Update attendance
            alumno.asistio = True
            alumno.save()
            
            return Response({
                "message": "Asistencia registrada",
                "alumno": {
                    "nombre": alumno.nombre_completo,
                    "cedula": alumno.cedula,
                    "asistio": True
                }
            })
        except Alumno.DoesNotExist:
            return Response({"error": "Estudiante no encontrado"}, status=status.HTTP_404_NOT_FOUND)
