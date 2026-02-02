from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from .views import (
    AlumnoViewSet, CredentialRecoveryView,
    QRDownloadView, ExcelUploadView, MarcarAsistenciaView, CredentialDownloadView
)
from .models import Alumno
from .excel_import_export_views import (
    ExcelImportExportView, ExcelAnalyzeView, 
    ExcelProcessImportView, ExcelTemplateDownloadView,
    export_alumnos_view
)

# Simple view for total count
class TotalAlumnosView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        total = Alumno.objects.count()
        return Response({"total": total, "mensaje": f"¡Gracias! Somos {total} estudiantes registrados"})

router = DefaultRouter()
router.register(r'alumnos', AlumnoViewSet)

urlpatterns = [
    # Total count endpoint
    path('total_registrados/', TotalAlumnosView.as_view(), name='total-registrados'),
    
    # Explicit Action Routing (Prioritized over DefaultRouter to avoid lookup collision)
    path('validar-cedula/', AlumnoViewSet.as_view({'post': 'validar_cedula'}), name='alumno-validar-cedula'),
    
    path('', include(router.urls)),
    path('recuperar/<str:cedula>/', CredentialRecoveryView.as_view(), name='recover-credential'),
    path('marcar-asistencia/', MarcarAsistenciaView.as_view(), name='marcar-asistencia'),
    path('descargar-qr/<str:cedula>/', QRDownloadView.as_view(), name='descargar-qr'),
    path('descargar-credencial/<str:cedula>/', CredentialDownloadView.as_view(), name='descargar-credencial'),
    path('upload-excel/', ExcelUploadView.as_view(), name='excel-upload'),
    
    # Excel Import/Export Module
    path('importar-exportar/', ExcelImportExportView.as_view(), name='importar-exportar'),
    path('analizar-excel/', ExcelAnalyzeView.as_view(), name='analizar-excel'),
    path('procesar-importacion/', ExcelProcessImportView.as_view(), name='procesar-importacion'),
    path('descargar-plantilla/', ExcelTemplateDownloadView.as_view(), name='descargar-plantilla'),
    
    # Export Routes (function-based views)
    path('export/registros/', export_alumnos_view, name='export-alumnos'),

]