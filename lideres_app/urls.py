from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LiderViewSet, DashboardStatsView, LeaderLoginView, LeaderExcelUploadView, RedistribuirAlumnosView, FaseEscaneoView

router = DefaultRouter()
router.register(r'lideres', LiderViewSet)

urlpatterns = [
    path('', include(router.urls)),

    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('login/', LeaderLoginView.as_view(), name='leader-login'),
    path('upload-excel/', LeaderExcelUploadView.as_view(), name='leader-upload-excel'),

    path('redistribuir/', RedistribuirAlumnosView.as_view(), name='redistribuir-alumnos'),
    path('config-escaneo/', FaseEscaneoView.as_view(), name='config-escaneo'),
]

