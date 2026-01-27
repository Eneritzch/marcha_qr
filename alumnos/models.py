import uuid
from django.db import models
from django.core.exceptions import ValidationError

class Alumno(models.Model):
    MODALIDADES = [
        ('PRESENCIAL', 'Presencial'),
        ('EN_LINEA', 'En Línea'),
        ('SEMIPRESENCIAL', 'Semipresencial'),
    ]

    # Información Personal y Académica
    nombre_completo = models.CharField(max_length=150, verbose_name="Nombre Completo")
    cedula = models.CharField(max_length=10, unique=True, verbose_name="Cédula")
    email = models.EmailField(unique=True, verbose_name="Email")
    telefono = models.CharField(max_length=15, verbose_name="Teléfono")

    modalidad = models.CharField(max_length=20, choices=MODALIDADES, verbose_name="Modalidad")
    facultad = models.CharField(max_length=100, null=True, blank=True, verbose_name="Facultad")
    carrera = models.CharField(max_length=150, verbose_name="Carrera")
    
    # Código QR y Seguimiento
    codigo_qr = models.CharField(max_length=20, unique=True, editable=False, verbose_name="Código QR")
    asistio = models.BooleanField(default=False, verbose_name="Asistió")
    fecha_registro = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")
    fecha_asistencia = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de Asistencia")
    registrado_por = models.CharField(max_length=50, null=True, blank=True, verbose_name="Registrado por")
    
    # Relación con Líder y Grupo (NUEVO)
    lider_invitador = models.ForeignKey(
        'lideres_app.Lider',
        on_delete=models.PROTECT,
        related_name='alumnos',
        verbose_name="Líder que lo invitó"
    )
    grupo = models.IntegerField(verbose_name="Grupo asignado (Heredado)")

    class Meta:
        verbose_name = "Alumno"
        verbose_name_plural = "Alumnos"
        ordering = ['-fecha_registro']

    def __str__(self):
        return f"{self.nombre_completo} - {self.codigo_qr}"

    def clean(self):
        # Asegurar que el grupo coincida con el del líder
        if self.lider_invitador and self.grupo != self.lider_invitador.grupo:
            self.grupo = self.lider_invitador.grupo

    def save(self, *args, **kwargs):
        # Generar código QR único si no existe
        if not self.codigo_qr:
            self.codigo_qr = f"UNM-{uuid.uuid4().hex[:8].upper()}"
        
        # Sincronizar grupo con el líder
        if self.lider_invitador:
            self.grupo = self.lider_invitador.grupo
            
        super().save(*args, **kwargs)


class CuentaBancaria(models.Model):
    TIPOS_CUENTA = [
        ('AHORROS', 'Ahorros'),
        ('CORRIENTE', 'Corriente'),
    ]

    BANCOS = [
        ('PACIFICO', 'Banco Pacífico'),
        ('PICHINCHA', 'Banco Pichincha'),
        ('GUAYAQUIL', 'Banco Guayaquil'),
    ]
    
    alumno = models.OneToOneField(
        Alumno, 
        on_delete=models.CASCADE, 
        related_name='cuenta_bancaria',
        verbose_name="Alumno"
    )
    titular_nombre = models.CharField(max_length=150, verbose_name="Nombre del Titular")
    titular_cedula = models.CharField(max_length=10, verbose_name="Cédula del Titular")
    banco = models.CharField(max_length=100, choices=BANCOS, verbose_name="Banco")
    tipo_cuenta = models.CharField(max_length=20, choices=TIPOS_CUENTA, verbose_name="Tipo de Cuenta")
    numero_cuenta = models.CharField(max_length=30, verbose_name="Número de Cuenta")
    es_propia = models.BooleanField(default=True, verbose_name="Es cuenta propia")


    class Meta:
        verbose_name = "Cuenta Bancaria"
        verbose_name_plural = "Cuentas Bancarias"

    def __str__(self):
        return f"Cuenta de {self.titular_nombre} ({self.banco})"
