from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LiderViewSet, ActiveLiderListView, DashboardStatsView, LeaderLoginView, LeaderExcelUploadView, RandomLeaderView, RedistribuirAlumnosView

router = DefaultRouter()
router.register(r'lideres', LiderViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('activos/', ActiveLiderListView.as_view(), name='active-lideres'),
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('login/', LeaderLoginView.as_view(), name='leader-login'),
    path('upload-excel/', LeaderExcelUploadView.as_view(), name='leader-upload-excel'),
    path('random/', RandomLeaderView.as_view(), name='random-leader'),
    path('redistribuir/', RedistribuirAlumnosView.as_view(), name='redistribuir-alumnos'),
]

