from django.db import models
from django.core.validators import RegexValidator


class ConfiguracionCertificado(models.Model):
    """Configuración singleton para estilo de certificados PDF."""
    
    # Textos del certificado
    titulo_certificado = models.CharField(
        max_length=200, 
        default="CERTIFICADO DE PARTICIPACIÓN",
        verbose_name="Título del Certificado"
    )
    subtitulo = models.CharField(
        max_length=300, 
        default="Marcha por los 25 Años de UNEMI",
        verbose_name="Subtítulo"
    )
    texto_cuerpo = models.TextField(
        default="Se certifica que {nombre} participó en la Marcha conmemorativa por los 25 años de vida institucional de la Universidad Estatal de Milagro, realizada el 8 de febrero de 2026.",
        help_text="Usa {nombre} como placeholder para el nombre del participante",
        verbose_name="Texto del Certificado"
    )

    # Mensaje para Líderes (Dashboard)
    mensaje_lideres_titulo = models.CharField(
        max_length=200,
        default="¡Gracias por tu Liderazgo!",
        verbose_name="Título Mensaje Líderes"
    )
    mensaje_lideres_cuerpo = models.TextField(
        default="Gracias por tu apoyo y esfuerzo por ser parte de esta lucha y hacer que todo salga bien.",
        verbose_name="Cuerpo Mensaje Líderes"
    )

    # Texto Específico para Certificado de Líderes
    texto_certificado_lideres = models.TextField(
        default="Se certifica que {nombre} participó como LÍDER del GIRO {grupo} en la Marcha conmemorativa por los 25 años de vida institucional de la Universidad Estatal de Milagro.",
        help_text="Usa {nombre} y {grupo} como placeholders.",
        verbose_name="Texto Certificado Líderes"
    )
    
    # Firmas (PNG)
    # Logos
    logo_izquierda = models.ImageField(
        upload_to='certificados/logos/',
        null=True,
        blank=True,
        verbose_name="Logo Izquierda (MUC)"
    )
    logo_centro = models.ImageField(
        upload_to='certificados/logos/',
        null=True,
        blank=True,
        verbose_name="Logo Centro (25 Años)"
    )
    logo_derecha = models.ImageField(
        upload_to='certificados/logos/',
        null=True,
        blank=True,
        verbose_name="Logo Derecha (FEUE)"
    )

    # Firmas (PNG)
    # Firma 1 (Izquierda - Directora)
    firma_1_imagen = models.ImageField(
        upload_to='certificados/firmas/', 
        null=True, 
        blank=True,
        verbose_name="Firma 1 (Izquierda - P. Palacios)"
    )
    firma_1_nombre = models.CharField(
        max_length=150, 
        blank=True, 
        default="Paola Palacios",
        verbose_name="Nombre Firmante 1"
    )
    firma_1_cargo = models.CharField(
        max_length=150, 
        blank=True, 
        default="DIRECTORA DE MARCHA",
        verbose_name="Cargo Firmante 1"
    )
    
    # Firma 2 (Centro - Rector)
    firma_2_imagen = models.ImageField(
        upload_to='certificados/firmas/', 
        null=True, 
        blank=True,
        verbose_name="Firma 2 (Centro - Rector)"
    )
    firma_2_nombre = models.CharField(
        max_length=150, 
        blank=True, 
        default="Fabricio Guevara Viejó",
        verbose_name="Nombre Firmante 2"
    )
    firma_2_cargo = models.CharField(
        max_length=150, 
        blank=True, 
        default="RECTOR UNEMI",
        verbose_name="Cargo Firmante 2"
    )

    # Firma 3 (Derecha - Coordinadora)
    firma_3_imagen = models.ImageField(
        upload_to='certificados/firmas/', 
        null=True, 
        blank=True,
        verbose_name="Firma 3 (Derecha - R. Jurado)"
    )
    firma_3_nombre = models.CharField(
        max_length=150, 
        blank=True, 
        default="Roxana Jurado",
        verbose_name="Nombre Firmante 3"
    )
    firma_3_cargo = models.CharField(
        max_length=150, 
        blank=True, 
        default="COORDINADORA",
        verbose_name="Cargo Firmante 3"
    )
    
    # Colores (hex)
    color_hex_validator = RegexValidator(
        regex=r'^#[0-9A-Fa-f]{6}$',
        message="El color debe ser formato hexadecimal (#RRGGBB)"
    )
    color_primario = models.CharField(
        max_length=7, 
        default="#0F1E4B",
        validators=[color_hex_validator],
        verbose_name="Color Primario (Azul UNEMI)"
    )
    color_secundario = models.CharField(
        max_length=7, 
        default="#EF7D00",
        validators=[color_hex_validator],
        verbose_name="Color Secundario (Naranja UNEMI)"
    )
    
    # Metadata
    ultima_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Configuración de Certificado"
        verbose_name_plural = "Configuración de Certificados"
    
    def __str__(self):
        return "Configuración de Certificados PDF"
    
    def save(self, *args, **kwargs):
        # Singleton pattern - only one configuration allowed
        if not self.pk and ConfiguracionCertificado.objects.exists():
            existing = ConfiguracionCertificado.objects.first()
            self.pk = existing.pk
        super().save(*args, **kwargs)
    
    @classmethod
    def get_config(cls):
        """Get or create the singleton configuration."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config
