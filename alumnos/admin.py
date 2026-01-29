from django.contrib import admin
from .models import Alumno

@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display = ['nombre_completo', 'cedula', 'email', 'lider_invitador', 'grupo', 'asistio']
    list_filter = ['grupo', 'asistio', 'modalidad']
    search_fields = ['nombre_completo', 'cedula', 'email']
    readonly_fields = ['codigo_qr', 'grupo']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'lider_profile'):
            return qs.filter(lider_invitador=request.user.lider_profile)
        return qs.none()

    def save_model(self, request, obj, form, change):
        # Si un líder crea un alumno manualmente, se asigna a sí mismo
        if not request.user.is_superuser and hasattr(request.user, 'lider_profile'):
            obj.lider_invitador = request.user.lider_profile
        super().save_model(request, obj, form, change)
