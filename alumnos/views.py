from rest_framework import viewsets, status, views, permissions, authentication
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import Alumno
from .serializers import AlumnoSerializer
from lideres_app.models import Lider
from core.utils import QRGenerator
from core.excel_processor import ExcelProcessor
from core.validators import validar_cedula_ecuatoriana

class IsAdmin(permissions.BasePermission):
    """Custom permission to only allow admin/superuser access."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff

class IsLeader(permissions.BasePermission):
    """Custom permission to only allow leaders to access their own data."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'lider_profile')

class AlumnoViewSet(viewsets.ModelViewSet):
    queryset = Alumno.objects.all()
    serializer_class = AlumnoSerializer
    lookup_field = 'cedula'
    authentication_classes = [authentication.TokenAuthentication] # Use token, skip session/csrf

    def destroy(self, request, *args, **kwargs):
        # Custom destroy to handle potential whitespace issues in cedula
        cedula = kwargs.get('cedula')
        print(f"DEBUG: Intentando eliminar alumno con cédula: '{cedula}'")
        
        try:
            # First try standard lookup
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except:
            # Fallback: Try searching with trimmed cedula or filtered in queryset
            # This is blocked by get_object using the queryset filter
            try:
                # Bypass get_object to inspect if it exists at all for this user
                qs = self.get_queryset()
                # Try exact text match in queryset
                instance = qs.get(cedula=cedula)
                self.perform_destroy(instance)
                return Response(status=status.HTTP_204_NO_CONTENT)
            except Alumno.DoesNotExist:
                # Try stripping whitespace
                if cedula:
                    try:
                        clean_cedula = cedula.strip()
                        print(f"DEBUG: Reintentando con cédula limpia: '{clean_cedula}'")
                        instance = qs.get(cedula=clean_cedula)
                        self.perform_destroy(instance)
                        return Response(status=status.HTTP_204_NO_CONTENT)
                    except Alumno.DoesNotExist:
                        pass
                
                print(f"DEBUG: No se encontró el alumno en el queryset del usuario.")
                return Response({"error": "No encontrado"}, status=status.HTTP_404_NOT_FOUND)

    def get_permissions(self):
        # Use getattr to be safe during early lifecycle calls
        action = getattr(self, 'action', None)
        if action in ['validar_cedula', 'create']:
            return [permissions.AllowAny()]
        if action == 'destroy':
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    @property
    def pagination_class(self):
        """Disable pagination if requested for offline sync."""
        if self.request.query_params.get('nopaginate') == 'true':
            return None
        return self.settings.DEFAULT_PAGINATION_CLASS

    def get_queryset(self):
        """Filter students for leaders, allow all for public validation/creation."""
        user = self.request.user
        action = getattr(self, 'action', None)
        
        if action in ['validar_cedula', 'create']:
            return Alumno.objects.all()
        
        # FINAL PERMISSION LOGIC
        if user.is_staff or user.is_superuser:
            return Alumno.objects.all().select_related('lider_invitador')
        
        if hasattr(user, 'lider_profile'):
            return Alumno.objects.filter(lider_invitador=user.lider_profile).select_related('lider_invitador')
            
        return Alumno.objects.none()

    @action(detail=False, methods=['get'], url_path='validar-cedula')
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

class RegistroManualAlumnoView(views.APIView):
    """API view for manual student registration by admins only."""
    permission_classes = [IsAdmin]

    def post(self, request):
        """Register a new student manually - Admin only."""
        # Verify user is admin/staff (this is also checked by permission class)
        if not request.user.is_staff:
            return Response({"error": "Solo administradores pueden registrar alumnos manualmente."}, status=status.HTTP_403_FORBIDDEN)
        
        # Get and validate cedula
        cedula = request.data.get('cedula', '').strip()
        if not cedula or len(cedula) != 10:
            return Response({"error": "Cédula inválida. Debe tener 10 dígitos."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate cedula format
        if not validar_cedula_ecuatoriana(cedula):
            return Response({"error": "La cédula proporcionada no es válida según el registro civil."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if cedula already exists
        if Alumno.objects.filter(cedula=cedula).exists():
            return Response({"error": "Esta cédula ya se encuentra registrada en el sistema."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate email uniqueness
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({"error": "El correo electrónico es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        
        if Alumno.objects.filter(email=email).exists():
            return Response({"error": "Este correo electrónico ya se encuentra registrado."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get required fields
        nombre_completo = request.data.get('nombre_completo', '').strip()
        if not nombre_completo:
            return Response({"error": "El nombre completo es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        
        telefono = request.data.get('telefono', '').strip()
        if not telefono:
            return Response({"error": "El teléfono es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Optional academic fields
        modalidad = request.data.get('modalidad') or None
        facultad = request.data.get('facultad') or None
        carrera = request.data.get('carrera') or None
        es_externo = request.data.get('es_externo', False)
        
        # Optional leader selection - if not provided, use smart distribution
        lider_invitador_id = request.data.get('lider_invitador')
        if lider_invitador_id:
            try:
                lider_invitador = Lider.objects.get(id=lider_invitador_id)
            except Lider.DoesNotExist:
                return Response({"error": "Líder seleccionado no encontrado."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Smart distribution: assign to any active leader with least students
            lider_invitador = self.get_least_loaded_leader()
        
        try:
            # Create the student with assigned leader
            alumno = Alumno.objects.create(
                cedula=cedula,
                nombre_completo=nombre_completo,
                email=email,
                telefono=telefono,
                modalidad=modalidad,
                facultad=facultad,
                carrera=carrera,
                es_externo=es_externo,
                lider_invitador=lider_invitador,
                registrado_por=request.user.get_full_name() or request.user.username
            )
            
            serializer = AlumnoSerializer(alumno)
            return Response({
                "message": "Alumno registrado exitosamente",
                "alumno": serializer.data
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({"error": f"Error al registrar el alumno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_least_loaded_leader(self):
        """Get any active leader with the least assigned students."""
        from django.db.models import Count
        
        leaders = Lider.objects.filter(
            activo=True
        ).annotate(
            alumno_count=Count('alumno_invitados')
        ).order_by('alumno_count')
        
        if leaders.exists():
            return leaders.first()
        
        # Fallback: just return any active leader
        return Lider.objects.filter(activo=True).first()

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
    permission_classes = [permissions.AllowAny]

    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        serializer = AlumnoSerializer(alumno)
        return Response(serializer.data)

from core.credentials import CredentialGenerator

class CredentialDownloadView(views.APIView):
    """Generates and serves the PDF credential."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        pdf_buffer = CredentialGenerator.generate_pdf(alumno)
        
        response = HttpResponse(pdf_buffer, content_type="application/pdf")
        response['Content-Disposition'] = f'attachment; filename="credencial_{alumno.cedula}.pdf"'
        return response

class QRDownloadView(views.APIView):
    """Generates and serves the QR code for a student on-the-fly."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, cedula):
        alumno = get_object_or_404(Alumno, cedula=cedula)
        qr_bytes = QRGenerator.generate_qr_bytes(alumno.codigo_qr)
        
        response = HttpResponse(qr_bytes, content_type="image/png")
        response['Content-Disposition'] = f'attachment; filename="qr_{alumno.codigo_qr}.png"'
        return response

class MarcarAsistenciaView(views.APIView):
    """Marks attendance for a student given their ID (cedula) based on system phase."""
    permission_classes = [permissions.IsAuthenticated] # Leaders only

    def post(self, request):
        from lideres_app.models import ConfiguracionEscaneo
        from django.utils import timezone
        
        # 1. Get current phase
        config = ConfiguracionEscaneo.objects.first()
        if not config:
            # Pre-emptive creation of config if it doesn't exist
            config = ConfiguracionEscaneo.objects.create(fase_actual='CERRADO')
            
        fase = config.fase_actual
        
        if fase == 'CERRADO':
            return Response({"error": "El escaneo no se encuentra habilitado en este momento. Espere instrucciones del administrador."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        codigo = request.data.get('cedula') # Frontend sends scanned text here
        if not codigo:
            return Response({"error": "Código o Cédula requerida"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Look up by QR Code OR Cedula
            from django.db.models import Q
            alumno = Alumno.objects.get(Q(cedula=codigo) | Q(codigo_qr=codigo))
            
            now = timezone.now()
            
            if fase == 'INICIO':
                # Check if already started
                if alumno.ha_iniciado:
                     return Response({
                        "message": "Ya fue registrado en esta etapa (Inicio). Intente nuevamente escanear a otro estudiante.",
                        "alumno": {
                            "nombre": alumno.nombre_completo,
                            "cedula": alumno.cedula,
                            "grupo": alumno.grupo,
                            "hora": alumno.fecha_inicio.strftime("%H:%M:%S")
                        }
                    }, status=status.HTTP_200_OK)

                # Mark start
                alumno.ha_iniciado = True
                alumno.fecha_inicio = now
                # We don't mark 'asistio' as True yet, only after FIN phase
                # alumno.asistio = True 
                if not alumno.fecha_asistencia:
                    alumno.fecha_asistencia = now
                
                msg = "¡Inicio registrado correctamente!"

            elif fase == 'FIN':
                # Check if already finished
                if alumno.ha_finalizado:
                     return Response({
                        "message": "Ya fue registrado en esta etapa (Fin). Intente nuevamente escanear a otro estudiante.",
                        "alumno": {
                            "nombre": alumno.nombre_completo,
                            "cedula": alumno.cedula,
                            "grupo": alumno.grupo,
                            "hora": alumno.fecha_fin.strftime("%H:%M:%S")
                        }
                    }, status=status.HTTP_200_OK)
                
                # IMPORTANT: Must have started first
                if not alumno.ha_iniciado:
                    return Response({"error": f"El estudiante {alumno.nombre_completo} NO registró su inicio de marcha. No se puede registrar su llegada."}, 
                                    status=status.HTTP_400_BAD_REQUEST)

                # Mark finish
                alumno.ha_finalizado = True
                alumno.fecha_fin = now
                alumno.asistio = True # Final confirmation
                msg = "¡Llegada registrada correctamente!"

            # Auditoría
            if request.user.is_authenticated:
                alumno.registrado_por = request.user.get_full_name() or request.user.username
            
            alumno.save()

            return Response({
                "message": msg,
                "alumno": {
                    "nombre": alumno.nombre_completo,
                    "cedula": alumno.cedula,
                    "grupo": alumno.grupo,
                    "fase": fase
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
        valid_types = ['registros']
        if data_type not in valid_types:
             return Response({"error": f"Tipo de exportación inválido. Opciones: {', '.join(valid_types)}"}, 
                             status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().select_related('lider_invitador')
        
        data = []
        if data_type == 'registros':
            for alumno in queryset.iterator():
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
