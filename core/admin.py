from django.contrib import admin
from .certificate_config import ConfiguracionCertificado

@admin.register(ConfiguracionCertificado)
class ConfiguracionCertificadoAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'titulo_certificado', 'ultima_actualizacion')
    fieldsets = (
        ("Información General", {
            "fields": ("titulo_certificado", "subtitulo", "texto_cuerpo")
        }),
        ("Logos", {
            "fields": ("logo_izquierda", "logo_centro", "logo_derecha"),
            "description": "Sube las imágenes para cada posición. Si se deja vacío, se usará la imagen por defecto."
        }),
        ("Colores", {
            "fields": ("color_primario", "color_secundario")
        }),
        ("Firma 1 (Izquierda)", {
            "fields": ("firma_1_nombre", "firma_1_cargo", "firma_1_imagen")
        }),
        ("Firma 2 (Centro)", {
            "fields": ("firma_2_nombre", "firma_2_cargo", "firma_2_imagen")
        }),
        ("Firma 3 (Derecha)", {
            "fields": ("firma_3_nombre", "firma_3_cargo", "firma_3_imagen")
        }),
    )

    def has_add_permission(self, request):
        # Limit to one instance
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)
