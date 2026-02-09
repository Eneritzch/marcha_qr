from django.urls import path
from .certificate_views import (
    CertificateBuscarView,
    CertificateDescargarView,
    CertificateConfigView,
    LeaderCertificateInfoView,
)

urlpatterns = [
    path('buscar/<str:cedula>/', CertificateBuscarView.as_view(), name='certificate-search'),
    path('descargar/<str:cedula>/', CertificateDescargarView.as_view(), name='certificate-download'),
    path('config/', CertificateConfigView.as_view(), name='certificate-config'),
    path('leader-info/', LeaderCertificateInfoView.as_view(), name='certificate-leader-info'),
]
