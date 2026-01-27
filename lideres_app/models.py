from django.db import models
from django.contrib.auth.models import User

class Lider(models.Model):
    GRUPOS = [
        (1, 'Grupo 1'),
        (2, 'Grupo 2'),
        (3, 'Grupo 3'),
        (4, 'Grupo 4'),
    ]
    
    # Vinculación con Usuario del Sistema
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lider_profile', verbose_name="Usuario de Sistema")
    
    # Información personal

    nombre_completo = models.CharField(max_length=150, verbose_name="Nombre Completo")
    cedula = models.CharField(max_length=10, unique=True, verbose_name="Cédula")
    email = models.EmailField(null=True, blank=True, verbose_name="Email")
    telefono = models.CharField(max_length=15, null=True, blank=True, verbose_name="Teléfono")
    
    # Grupo y estado
    grupo = models.IntegerField(choices=GRUPOS, verbose_name="Grupo")
    activo = models.BooleanField(default=True, verbose_name="Activo")
    visible_en_registro = models.BooleanField(default=True, verbose_name="Visible en Registro")
    
    # Orden y organización
    orden = models.IntegerField(default=0, verbose_name="Orden de visualización")
    
    # Auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")
    
    class Meta:
        verbose_name = "Líder"
        verbose_name_plural = "Líderes"
        ordering = ['grupo', 'orden', 'nombre_completo']
    
    def __str__(self):
        return f"{self.nombre_completo} - Grupo {self.grupo}"
    
    def generate_username(self):
        """Generates username: first letter of name + first surname + first letter of second surname."""
        parts = self.nombre_completo.lower().split()
        if not parts:
            return "user"
            
        # Logic: rarellanou (r + arellano + u)
        # Assuming format: [Name1] [Name2] [Surname1] [Surname2]
        # Or: [Name1] [Surname1] [Surname2]
        
        base = ""
        if len(parts) >= 3:
            # First name[0] + First Surname + Second Surname[0]
            # In Ecuador, if 4 parts: parts[0], parts[1], parts[2], parts[3]
            # Usually parts[2] is the father's surname.
            if len(parts) >= 4:
                base = f"{parts[0][0]}{parts[2]}{parts[3][0]}"
            else:
                base = f"{parts[0][0]}{parts[1]}{parts[2][0]}"
        elif len(parts) == 2:
            base = f"{parts[0][0]}{parts[1]}"
        else:
            base = parts[0]

        # Handle duplicates
        final_username = base
        counter = 2
        
        def exists(uname):
            qs = User.objects.filter(username=uname)
            if self.pk:
                qs = qs.exclude(lider_profile=self)
            return qs.exists()

        while exists(final_username):
            final_username = f"{base}{counter}"
            counter += 1
            
        return final_username


    def save(self, *args, **kwargs):
        # Check if this is an update and if the name has changed
        if self.pk:
            old_instance = Lider.objects.get(pk=self.pk)
            name_changed = old_instance.nombre_completo != self.nombre_completo
        else:
            name_changed = True

        if not self.user:
            username = self.generate_username()
            new_user = User.objects.create_user(
                username=username,
                password=username,
                email=self.email or '',
                first_name=self.nombre_completo.split()[0] if self.nombre_completo else ''
            )
            self.user = new_user
        elif name_changed:
            # Re-generate username and password if name changed
            # CRITICAL FIX: Do NOT change username/password for Superusers (like admin)
            if self.user.is_superuser:
                 self.user.first_name = self.nombre_completo.split()[0] if self.nombre_completo else ''
                 self.user.email = self.email or ''
                 self.user.save()
            else:
                new_username = self.generate_username()
                self.user.username = new_username
                self.user.set_password(new_username)
                self.user.first_name = self.nombre_completo.split()[0] if self.nombre_completo else ''
                self.user.email = self.email or ''
                self.user.save()
        else:
            # Just update email and other basic fields if name didn't change
            self.user.email = self.email or ''
            self.user.save()
            
        super().save(*args, **kwargs)


    @property

    def total_invitados(self):
        """Cuenta cuántos alumnos invitó este líder"""
        return self.alumnos.count()
    
    @property
    def total_asistencias(self):
        """Cuenta cuántos de sus invitados asistieron"""
        return self.alumnos.filter(asistio=True).count()
    
    def porcentaje_asistencia(self):
        """Calcula % de asistencia de sus invitados"""
        total = self.total_invitados
        if total == 0:
            return 0
        return (self.total_asistencias / total) * 100
