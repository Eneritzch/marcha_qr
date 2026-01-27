from django.contrib import admin
from .models import Lider

@admin.register(Lider)
class LiderAdmin(admin.ModelAdmin):
    list_display = ['nombre_completo', 'cedula', 'grupo', 'activo', 'orden', 'total_invitados']
    list_filter = ['grupo', 'activo', 'visible_en_registro']
    search_fields = ['nombre_completo', 'cedula', 'email']
    ordering = ['orden', 'nombre_completo']
    readonly_fields = ['user']
    fieldsets = (
        ('Personal Info', {
            'fields': ('nombre_completo', 'cedula', 'email', 'telefono')
        }),
        ('System Config', {
            'fields': ('user', 'grupo', 'orden', 'activo', 'visible_en_registro')
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        # Si es un líder, solo puede verse a sí mismo (opcional, depende de requerimiento)
        if hasattr(request.user, 'lider_profile'):
            return qs.filter(id=request.user.lider_profile.id)
        return qs.none()
