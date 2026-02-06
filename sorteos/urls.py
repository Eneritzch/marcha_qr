from django.urls import path
from .views import (
    SorteoStatsView,
    InicializarPoolView,
    EjecutarSorteoView,
    ListaGanadoresView,
    ExportarGanadoresView,
    ResetSorteoView,
)

urlpatterns = [
    path('stats/', SorteoStatsView.as_view(), name='sorteo-stats'),
    path('inicializar/', InicializarPoolView.as_view(), name='sorteo-inicializar'),
    path('ejecutar/', EjecutarSorteoView.as_view(), name='sorteo-ejecutar'),
    path('ganadores/', ListaGanadoresView.as_view(), name='sorteo-ganadores'),
    path('exportar/', ExportarGanadoresView.as_view(), name='sorteo-exportar'),
    path('reset/', ResetSorteoView.as_view(), name='sorteo-reset'),
]