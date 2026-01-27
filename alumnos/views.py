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
                        "codigo_qr": alumno.codigo_qr,
                        "hora": alumno.fecha_asistencia.strftime("%H:%M:%S")
                    }
                }, status=status.HTTP_200_OK)

            # Mark attendance
            from django.utils import timezone
            alumno.asistio = True
            alumno.fecha_asistencia = timezone.now()
            # If logged in user is marking
            if request.user.is_authenticated:
                alumno.registrado_por = request.user.get_full_name() or request.user.username
            alumno.save()

            return Response({
                "message": "Asistencia registrada correctamente",
                "alumno": {
                    "nombre": alumno.nombre_completo,
                    "cedula": alumno.cedula,
                    "grupo": alumno.grupo
                }
            }, status=status.HTTP_200_OK)

        except Alumno.DoesNotExist:
             return Response({"error": "Estudiante no encontrado"}, status=status.HTTP_404_NOT_FOUND)

import pandas as pd
from datetime import datetime

class ExportDataView(views.APIView):
    """
    Exports data (alumnos or bancos) to Excel.
    """
    permission_classes = [IsLeader]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Alumno.objects.all()
        if hasattr(user, 'lider_profile'):
            return Alumno.objects.filter(lider_invitador=user.lider_profile)
        return Alumno.objects.none()

    def get(self, request, data_type):
        valid_types = ['registros', 'bancos']
        if data_type not in valid_types:
             return Response({"error": f"Tipo de exportación inválido. Opciones: {', '.join(valid_types)}"}, 
                             status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset()
        
        data = []
        if data_type == 'registros':
            for alumno in queryset:
                data.append({
                    'Nombre Completo': alumno.nombre_completo,
                    'Cédula': alumno.cedula,
                    'Email': alumno.email,
                    'Teléfono': alumno.telefono,
                    'Modalidad': alumno.get_modalidad_display(),
                    'Facultad': alumno.facultad,
                    'Carrera': alumno.carrera,
                    'Grupo': alumno.grupo,
                    'Código QR': alumno.codigo_qr,
                    'Asistió': 'SÍ' if alumno.asistio else 'NO',
                    'Líder': alumno.lider_invitador.nombre if alumno.lider_invitador else 'N/A'
                })
            filename = f"Alumnos_MarchaUNEMI_{datetime.now().strftime('%Y%m%d')}.xlsx"

        elif data_type == 'bancos':
            # Filter students who have bank accounts
            for alumno in queryset:
                if hasattr(alumno, 'cuenta_bancaria'):
                    cuenta = alumno.cuenta_bancaria
                    data.append({
                        'Alumno': alumno.nombre_completo,
                        'Cédula Alumno': alumno.cedula,
                        'Titular Cuenta': cuenta.titular_nombre,
                        'Cédula Titular': cuenta.titular_cedula,
                        'Banco': cuenta.get_banco_display(),
                        'Tipo Cuenta': cuenta.get_tipo_cuenta_display(),
                        'Número Cuenta': cuenta.numero_cuenta,
                        'Es Propia': 'SÍ' if cuenta.es_propia else 'NO'
                    })
            filename = f"Bancos_MarchaUNEMI_{datetime.now().strftime('%Y%m%d')}.xlsx"

        if not data:
             return Response({"error": "No hay datos para exportar."}, status=status.HTTP_404_NOT_FOUND)

        # Create DataFrame
        df = pd.DataFrame(data)

        # Create Http Response with Excel file
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        # Use pandas to write to the response buffer
        with pd.ExcelWriter(response, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Datos')
        
        return response
