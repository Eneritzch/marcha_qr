from rest_framework import serializers
from .models import ParticipanteSorteo, Ganador


class ParticipanteSorteoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParticipanteSorteo
        fields = ['id', 'nombre_completo', 'cedula', 'email', 'telefono', 'activo', 'fecha_copiado']


class GanadorSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(source='participante.nombre_completo', read_only=True)
    cedula = serializers.CharField(source='participante.cedula', read_only=True)
    email = serializers.CharField(source='participante.email', read_only=True)
    telefono = serializers.CharField(source='participante.telefono', read_only=True)
    grupo = serializers.IntegerField(source='participante.alumno.grupo', read_only=True, default=0)
    tipo_sorteo_display = serializers.CharField(source='get_tipo_sorteo_display', read_only=True)

    class Meta:
        model = Ganador
        fields = [
            'id', 'numero_premio', 'tipo_sorteo', 'tipo_sorteo_display',
            'descripcion_premio', 'fecha_sorteo',
            'nombre_completo', 'cedula', 'email', 'telefono', 'grupo'
        ]

