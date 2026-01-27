from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AlumnoViewSet, CredentialRecoveryView,
    QRDownloadView, ExcelUploadView, MarcarAsistenciaView
)

router = DefaultRouter()
router.register(r'alumnos', AlumnoViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('recuperar/<str:cedula>/', CredentialRecoveryView.as_view(), name='recover-credential'),
    path('marcar-asistencia/', MarcarAsistenciaView.as_view(), name='marcar-asistencia'),
    path('descargar-qr/<str:cedula>/', QRDownloadView.as_view(), name='descargar-qr'),
    path('upload-excel/', ExcelUploadView.as_view(), name='excel-upload'),
]
