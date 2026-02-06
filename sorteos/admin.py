from django.contrib import admin
from .models import ParticipanteSorteo, Ganador


@admin.register(ParticipanteSorteo)
class ParticipanteSorteoAdmin(admin.ModelAdmin):
    list_display = ['nombre_completo', 'cedula', 'email', 'activo', 'fecha_copiado']
    list_filter = ['activo', 'fecha_copiado']
    search_fields = ['nombre_completo', 'cedula', 'email']
    readonly_fields = ['fecha_copiado']


@admin.register(Ganador)
class GanadorAdmin(admin.ModelAdmin):
    list_display = ['numero_premio', 'tipo_sorteo', 'participante', 'descripcion_premio', 'fecha_sorteo']
    list_filter = ['tipo_sorteo', 'fecha_sorteo']
    search_fields = ['participante__nombre_completo', 'participante__cedula']
    readonly_fields = ['fecha_sorteo']
