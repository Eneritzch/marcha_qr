from django.db import models


class ParticipanteSorteo(models.Model):
    """Copia de participantes elegibles para sorteos (completaron inicio Y fin)"""
    alumno = models.OneToOneField(
        'alumnos.Alumno', 
        on_delete=models.CASCADE,
        related_name='participante_sorteo'
    )
    nombre_completo = models.CharField(max_length=150, verbose_name="Nombre Completo")
    cedula = models.CharField(max_length=10, verbose_name="Cédula")
    email = models.EmailField(verbose_name="Email")
    telefono = models.CharField(max_length=15, verbose_name="Teléfono")
    fecha_copiado = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")
    activo = models.BooleanField(default=True, db_index=True, verbose_name="Activo para Sorteos")

    class Meta:
        verbose_name = "Participante de Sorteo"
        verbose_name_plural = "Participantes de Sorteo"
        ordering = ['nombre_completo']

    def __str__(self):
        return f"{self.nombre_completo} - {self.cedula}"


class Ganador(models.Model):
    """Registro de ganadores de sorteos"""
    TIPO_SORTEO = [
        ('PREMIO', 'Premio Regular'),
        ('IPHONE', 'iPhone'),
    ]
    
    participante = models.ForeignKey(
        ParticipanteSorteo, 
        on_delete=models.PROTECT,
        related_name='premios_ganados'
    )
    tipo_sorteo = models.CharField(
        max_length=10, 
        choices=TIPO_SORTEO, 
        db_index=True,
        verbose_name="Tipo de Sorteo"
    )
    numero_premio = models.IntegerField(verbose_name="Número de Premio")
    descripcion_premio = models.CharField(
        max_length=200, 
        blank=True, 
        null=True,
        verbose_name="Descripción del Premio"
    )
    fecha_sorteo = models.DateTimeField(auto_now_add=True, verbose_name="Fecha del Sorteo")

    class Meta:
        verbose_name = "Ganador"
        verbose_name_plural = "Ganadores"
        ordering = ['tipo_sorteo', 'numero_premio']
        unique_together = [['tipo_sorteo', 'numero_premio']]

    def __str__(self):
        return f"Premio #{self.numero_premio} ({self.get_tipo_sorteo_display()}) - {self.participante.nombre_completo}"
