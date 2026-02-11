from rest_framework import serializers
from .models import Lider

class LiderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lider
        fields = [
            'id', 'nombre_completo', 'cedula', 'email', 
            'telefono', 'grupo', 'activo', 'visible_en_registro', 
            'orden', 'total_invitados', 'total_asistencias'
        ]
        read_only_fields = ['total_invitados', 'total_asistencias']


