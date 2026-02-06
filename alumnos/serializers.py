from rest_framework import serializers
from .models import Alumno
from core.validators import validar_cedula_ecuatoriana
from lideres_app.models import Lider, GrupoConfig



class AlumnoSerializer(serializers.ModelSerializer):
    lider_nombre = serializers.CharField(source='lider_invitador.nombre_completo', read_only=True)
    whatsapp_link = serializers.SerializerMethodField()

    class Meta:
        model = Alumno
        fields = [
            'id', 'nombre_completo', 'cedula', 'email', 'telefono',
            'modalidad', 'facultad', 'carrera', 'es_externo', 'codigo_qr',
            'asistio', 'ha_iniciado', 'ha_finalizado', 'fecha_inicio', 'fecha_fin',
            'fecha_registro', 'lider_invitador', 
            'lider_nombre', 'grupo', 'whatsapp_link'
        ]
        read_only_fields = ['codigo_qr', 'grupo', 'asistio', 'ha_iniciado', 'ha_finalizado', 'fecha_registro', 'whatsapp_link']
        extra_kwargs = {
            'lider_invitador': {'required': False, 'allow_null': True}
        }

    def get_whatsapp_link(self, obj):
        if obj.grupo:
            config = GrupoConfig.objects.filter(numero=obj.grupo).first()
            return config.whatsapp_link if config else None
        return None

    def validate_cedula(self, value):
        """Robust validation for Ecuadorian Cédula."""
        if not validar_cedula_ecuatoriana(value):
            raise serializers.ValidationError("La cédula proporcionada no es válida según el registro civil.")
        
        # Check for uniqueness
        alumno_id = self.instance.id if self.instance else None
        if Alumno.objects.exclude(id=alumno_id).filter(cedula=value).exists():
            raise serializers.ValidationError("Esta cédula ya se encuentra registrada en el sistema.")
            
        return value

    def validate_email(self, value):
        """Validate email uniqueness."""
        alumno_id = self.instance.id if self.instance else None
        if Alumno.objects.exclude(id=alumno_id).filter(email=value).exists():
            raise serializers.ValidationError("Este correo electrónico ya se encuentra registrado.")
        return value


    def create(self, validated_data):
        alumno = Alumno.objects.create(**validated_data)
        return alumno
