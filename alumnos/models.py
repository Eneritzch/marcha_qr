import uuid
from django.db import models
from django.core.exceptions import ValidationError

class Alumno(models.Model):
    MODALIDADES = [
        ('PRESENCIAL', 'Presencial'),
        ('EN_LINEA', 'En Línea'),
        ('SEMIPRESENCIAL', 'Semipresencial'),
        ('EGRESADO', 'Egresado'),
        ('POSGRADO', 'Posgrado'),
    ]

    # Información Personal y Académica
    nombre_completo = models.CharField(max_length=150, verbose_name="Nombre Completo")
    cedula = models.CharField(max_length=10, unique=True, verbose_name="Cédula")
    email = models.EmailField(unique=True, verbose_name="Email")
    telefono = models.CharField(max_length=15, verbose_name="Teléfono")

    modalidad = models.CharField(max_length=20, choices=MODALIDADES, null=True, blank=True, verbose_name="Modalidad")
    facultad = models.CharField(max_length=100, null=True, blank=True, verbose_name="Facultad")
    carrera = models.CharField(max_length=150, null=True, blank=True, verbose_name="Carrera")
    es_externo = models.BooleanField(default=False, verbose_name="¿Es externo a UNEMI?")
    
    # Código QR y Seguimiento
    codigo_qr = models.CharField(max_length=20, unique=True, editable=False, verbose_name="Código QR")
    asistio = models.BooleanField(default=False, db_index=True, verbose_name="Asistió")
    fecha_registro = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")
    fecha_asistencia = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de Asistencia")
    registrado_por = models.CharField(max_length=50, null=True, blank=True, verbose_name="Registrado por")

    # NUEVO: Seguimiento de Doble Fase
    ha_iniciado = models.BooleanField(default=False, db_index=True, verbose_name="¿Inició Marcha?")
    ha_finalizado = models.BooleanField(default=False, db_index=True, verbose_name="¿Finalizó Marcha?")
    fecha_inicio = models.DateTimeField(null=True, blank=True, verbose_name="Fecha/Hora de Inicio")
    fecha_fin = models.DateTimeField(null=True, blank=True, verbose_name="Fecha/Hora de Fin")
    
    # Relación con Líder y Grupo (NUEVO)
    lider_invitador = models.ForeignKey(
        'lideres_app.Lider',
        on_delete=models.SET_NULL, # Don't delete student if leader is deleted
        null=True, 
        blank=True,
        related_name='alumnos',
        verbose_name="Líder que lo invitó"
    )
    grupo = models.IntegerField(default=0, db_index=True, verbose_name="Grupo asignado (Heredado)")

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
        elif not self.lider_invitador:
            self.grupo = 0

    def save(self, *args, **kwargs):
        # Generar código QR único si no existe
        if not self.codigo_qr:
            self.codigo_qr = f"UNM-{uuid.uuid4().hex[:8].upper()}"
        
        # Validación de Líder Aleatorio
        # Si no tiene líder asignado, seleccionamos uno aleatorio
        if not self.lider_invitador:
            from lideres_app.models import Lider
            import random
            
            # Buscar líderes activos que sean visibles en registro
            lideres_activos = list(Lider.objects.filter(activo=True))
            
            if lideres_activos:
                líder_aleatorio = random.choice(lideres_activos)
                self.lider_invitador = líder_aleatorio
                self.grupo = líder_aleatorio.grupo
            else:
                # Fallback: Si no hay líderes activos, asignar grupo 0
                if self.grupo is None:
                     self.grupo = 0
        else:
            # Sincronizar grupo con el líder
            self.grupo = self.lider_invitador.grupo
            
        super().save(*args, **kwargs)



