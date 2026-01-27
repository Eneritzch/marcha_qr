from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AlumnoViewSet, CredentialRecoveryView,
    QRDownloadView, ExcelUploadView, MarcarAsistenciaView, CredentialDownloadView
)

router = DefaultRouter()
router.register(r'alumnos', AlumnoViewSet)

urlpatterns = [
    # Explicit Action Routing (Prioritized over DefaultRouter to avoid lookup collision)
    path('validar-cedula/', AlumnoViewSet.as_view({'post': 'validar_cedula'}), name='alumno-validar-cedula'),
    
    path('', include(router.urls)),
    path('recuperar/<str:cedula>/', CredentialRecoveryView.as_view(), name='recover-credential'),
    path('marcar-asistencia/', MarcarAsistenciaView.as_view(), name='marcar-asistencia'),
    path('descargar-qr/<str:cedula>/', QRDownloadView.as_view(), name='descargar-qr'),
    path('descargar-credencial/<str:cedula>/', CredentialDownloadView.as_view(), name='descargar-credencial'),
    path('upload-excel/', ExcelUploadView.as_view(), name='excel-upload'),
]
