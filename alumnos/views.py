from rest_framework import viewsets, status, views, permissions, authentication
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import Alumno
from .serializers import AlumnoSerializer
from core.utils import QRGenerator
from core.excel_processor import ExcelProcessor
from core.validators import validar_cedula_ecuatoriana

class IsLeader(permissions.BasePermission):
    """Custom permission to only allow leaders to access their own data."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'lider_profile')

class AlumnoViewSet(viewsets.ModelViewSet):
    queryset = Alumno.objects.all()
    serializer_class = AlumnoSerializer
    lookup_field = 'cedula'
    authentication_classes = [authentication.TokenAuthentication] # Use token, skip session/csrf

    def get_permissions(self):
        # Use getattr to be safe during early lifecycle calls
        action = getattr(self, 'action', None)
        if action in ['validar_cedula', 'create']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """Filter students for leaders, allow all for public validation/creation."""
        user = self.request.user
        action = getattr(self, 'action', None)
        
        if action in ['validar_cedula', 'create']:
            return Alumno.objects.all()
        
        if user.is_staff:
            return Alumno.objects.all()
        if hasattr(user, 'lider_profile'):
            return Alumno.objects.filter(lider_invitador=user.lider_profile)
        return Alumno.objects.none()

    @action(detail=False, methods=['post'], url_path='validar-cedula')
    def validar_cedula(self, request):
        """Validates cedula for step transitions."""
        cedula = request.data.get('cedula')
        if not cedula:
             return Response({"valid": False, "error": "Cédula requerida"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Validate Algorithm
        if not validar_cedula_ecuatoriana(cedula):
             return Response({"valid": False, "error": "La cédula proporcionada no es válida según el registro civil."}, status=status.HTTP_200_OK)

        # 2. Check Uniqueness
        if Alumno.objects.filter(cedula=cedula).exists():
             return Response({"valid": False, "error": "Esta cédula ya se encuentra registrada en el sistema."}, status=status.HTTP_200_OK)

        return Response({"valid": True}, status=status.HTTP_200_OK)

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

from core.credentials import CredentialGenerator

class CredentialDownloadView(views.APIView):
    """Generates and serves the PDF credential."""
    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        pdf_buffer = CredentialGenerator.generate_pdf(alumno)
        
        response = HttpResponse(pdf_buffer, content_type="application/pdf")
        response['Content-Disposition'] = f'attachment; filename="credencial_{alumno.cedula}.pdf"'
        return response

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
        codigo = request.data.get('cedula') # Frontend sends scanned text here
        if not codigo:
            return Response({"error": "Código o Cédula requerida"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Look up by QR Code OR Cedula
            from django.db.models import Q
            alumno = Alumno.objects.get(Q(cedula=codigo) | Q(codigo_qr=codigo))
            
            # Check if already attended
            if alumno.asistio:
                 return Response({
                    "message": "Asistencia ya registrada previamente",
                    "alumno": {
                        "nombre": alumno.nombre_completo,
                        "cedula": alumno.cedula,
                        "asistio": True
                    }
                })

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
            return Response({"error": f"Estudiante no encontrado: {codigo}"}, status=status.HTTP_404_NOT_FOUND)
