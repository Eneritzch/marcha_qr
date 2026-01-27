from rest_framework import serializers
from .models import Alumno, CuentaBancaria
from core.validators import validar_cedula_ecuatoriana

class CuentaBancariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaBancaria
        fields = [
            'titular_nombre', 'titular_cedula', 'banco', 
            'tipo_cuenta', 'numero_cuenta', 'es_propia'
        ]

class AlumnoSerializer(serializers.ModelSerializer):
    cuenta_bancaria = CuentaBancariaSerializer(required=False)
    lider_nombre = serializers.CharField(source='lider_invitador.nombre_completo', read_only=True)

    
    class Meta:
        model = Alumno
        fields = [
            'id', 'nombre_completo', 'cedula', 'email', 'telefono',
            'modalidad', 'facultad', 'carrera', 'codigo_qr',
            'asistio', 'fecha_registro', 'lider_invitador', 
            'lider_nombre', 'grupo', 'cuenta_bancaria'
        ]
        read_only_fields = ['codigo_qr', 'grupo', 'asistio', 'fecha_registro']

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

        cuenta_data = validated_data.pop('cuenta_bancaria', None)
        alumno = Alumno.objects.create(**validated_data)
        if cuenta_data:
            CuentaBancaria.objects.create(alumno=alumno, **cuenta_data)
        return alumno
