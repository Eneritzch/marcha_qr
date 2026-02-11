from django.contrib import admin
from django import forms
import base64
from .certificate_config import ConfiguracionCertificado

class ConfiguracionCertificadoForm(forms.ModelForm):
    firma_1_archivo = forms.ImageField(required=False, label="Subir Nueva Firma 1 (Reemplaza la anterior)")
    firma_2_archivo = forms.ImageField(required=False, label="Subir Nueva Firma 2 (Reemplaza la anterior)")
    firma_3_archivo = forms.ImageField(required=False, label="Subir Nueva Firma 3 (Reemplaza la anterior)")

    class Meta:
        model = ConfiguracionCertificado
        fields = '__all__'
        exclude = ('firma_1_imagen', 'firma_2_imagen', 'firma_3_imagen')

    def save(self, commit=True):
        instance = super().save(commit=False)
        
        for i in range(1, 4):
            archivo = self.cleaned_data.get(f'firma_{i}_archivo')
            if archivo:
                # Convert to Base64
                encoded = base64.b64encode(archivo.read()).decode('utf-8')
                setattr(instance, f'firma_{i}_imagen', encoded)
        
        if commit:
            instance.save()
        return instance

@admin.register(ConfiguracionCertificado)
class ConfiguracionCertificadoAdmin(admin.ModelAdmin):
    form = ConfiguracionCertificadoForm
    list_display = ('__str__', 'titulo_certificado', 'ultima_actualizacion')
    
    fieldsets = (
        ("Información General", {
            "fields": ("titulo_certificado", "subtitulo", "texto_cuerpo")
        }),
        ("Logos", {
            "fields": ("logo_izquierda", "logo_centro", "logo_derecha"),
            "description": "Sube las imágenes para cada posición."
        }),
        ("Colores", {
            "fields": ("color_primario", "color_secundario")
        }),
        ("Firma 1 (Izquierda)", {
            "fields": ("firma_1_nombre", "firma_1_cargo", "firma_1_archivo"),
            "description": "Sube una imagen PNG con fondo transparente."
        }),
        ("Firma 2 (Centro)", {
            "fields": ("firma_2_nombre", "firma_2_cargo", "firma_2_archivo"),
            "description": "Sube una imagen PNG con fondo transparente."
        }),
        ("Firma 3 (Derecha)", {
            "fields": ("firma_3_nombre", "firma_3_cargo", "firma_3_archivo"),
            "description": "Sube una imagen PNG con fondo transparente."
        }),
    )

    def has_add_permission(self, request):
        # Limit to one instance
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)
