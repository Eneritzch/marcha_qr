import random
import hashlib
from io import BytesIO
from django.http import HttpResponse
from django.db import transaction
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from openpyxl import Workbook

from alumnos.models import Alumno
from .models import ParticipanteSorteo, Ganador
from .serializers import ParticipanteSorteoSerializer, GanadorSerializer


class SorteoStatsView(views.APIView):
    """Estadísticas del sorteo"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        total_elegibles = Alumno.objects.filter(ha_iniciado=True, ha_finalizado=True).count()
        total_copiados = ParticipanteSorteo.objects.count()
        total_activos = ParticipanteSorteo.objects.filter(activo=True).count()
        total_ganadores_premio = Ganador.objects.filter(tipo_sorteo='PREMIO').count()
        total_ganadores_iphone = Ganador.objects.filter(tipo_sorteo='IPHONE').count()
        
        return Response({
            'elegibles_en_alumnos': total_elegibles,
            'copiados_a_sorteo': total_copiados,
            'activos_para_sorteo': total_activos,
            'ganadores_premio': total_ganadores_premio,
            'ganadores_iphone': total_ganadores_iphone,
            'pool_inicializado': total_copiados > 0
        })


class InicializarPoolView(views.APIView):
    """Copia participantes elegibles a la tabla de sorteos"""
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        elegibles = Alumno.objects.filter(
            ha_iniciado=True, 
            ha_finalizado=True
        ).exclude(
            participante_sorteo__isnull=False
        )
        
        nuevos = 0
        for alumno in elegibles:
            ParticipanteSorteo.objects.create(
                alumno=alumno,
                nombre_completo=alumno.nombre_completo,
                cedula=alumno.cedula,
                email=alumno.email,
                telefono=alumno.telefono
            )
            nuevos += 1
        
        total = ParticipanteSorteo.objects.filter(activo=True).count()
        
        return Response({
            'mensaje': f'Pool inicializado. {nuevos} nuevos participantes agregados.',
            'nuevos_agregados': nuevos,
            'total_activos': total
        })


class EjecutarSorteoView(views.APIView):
    """Ejecuta un sorteo aleatorio"""
    permission_classes = [IsAdminUser]

    def _aplicar_estratificacion(self, participantes, cantidad, tipo, numero_premio_actual):
        """Muestreo aleatorio simple"""
        return random.sample(participantes, cantidad)

    @transaction.atomic
    def post(self, request):
        tipo = request.data.get('tipo', 'PREMIO')
        cantidad = int(request.data.get('cantidad', 1))
        modo_prueba = request.data.get('modo_prueba', False)
        descripcion = request.data.get('descripcion', '')
        
        if tipo not in ['PREMIO', 'IPHONE']:
            return Response({'error': 'Tipo inválido'}, status=status.HTTP_400_BAD_REQUEST)
        
        participantes = list(ParticipanteSorteo.objects.filter(activo=True))
        
        if modo_prueba and len(participantes) == 0:
            alumnos = list(Alumno.objects.all()[:500])
            
            if len(alumnos) < cantidad:
                return Response({
                    'error': f'No hay suficientes alumnos para simular. Disponibles: {len(alumnos)}, Solicitados: {cantidad}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            ganadores_simulados = random.sample(alumnos, cantidad)
            ganadores_info = []
            
            for i, alumno in enumerate(ganadores_simulados):
                ganadores_info.append({
                    'numero_premio': i + 1,
                    'tipo_sorteo': tipo,
                    'nombre_completo': alumno.nombre_completo,
                    'cedula': alumno.cedula,
                    'email': alumno.email,
                    'telefono': alumno.telefono,
                    'grupo': alumno.grupo or 0,
                    'modo_prueba': True,
                    'simulado_desde_alumnos': True
                })
            
            return Response({
                'mensaje': 'Sorteo SIMULADO (sin pool inicializado - usando tabla Alumnos)',
                'modo_prueba': True,
                'ganadores': ganadores_info,
                'nota': 'Pool no inicializado. Para sorteos reales, primero inicializa el pool.'
            })
        
        if len(participantes) < cantidad:
            return Response({
                'error': f'No hay suficientes participantes. Disponibles: {len(participantes)}, Solicitados: {cantidad}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calcular el número de premio que se asignará
        ultimo_premio = Ganador.objects.filter(tipo_sorteo=tipo).order_by('-numero_premio').first()
        siguiente_numero = (ultimo_premio.numero_premio + 1) if ultimo_premio else 1
        
        ganadores_seleccionados = self._aplicar_estratificacion(participantes, cantidad, tipo, siguiente_numero)
        
        ganadores_info = []
        
        for i, participante in enumerate(ganadores_seleccionados):
            numero = siguiente_numero + i
            
            if not modo_prueba:
                ganador = Ganador.objects.create(
                    participante=participante,
                    tipo_sorteo=tipo,
                    numero_premio=numero,
                    descripcion_premio=descripcion or f"Premio #{numero}"
                )
                ganadores_info.append(GanadorSerializer(ganador).data)
            else:
                ganadores_info.append({
                    'numero_premio': numero,
                    'tipo_sorteo': tipo,
                    'nombre_completo': participante.nombre_completo,
                    'cedula': participante.cedula,
                    'email': participante.email,
                    'telefono': participante.telefono,
                    'grupo': participante.alumno.grupo if participante.alumno else 0,
                    'modo_prueba': True
                })
        
        # Desactivar participantes después de crear todos los ganadores
        if not modo_prueba:
            for participante in ganadores_seleccionados:
                participante.activo = False
                participante.save()
        
        return Response({
            'mensaje': f'Sorteo {"simulado" if modo_prueba else "realizado"} exitosamente',
            'modo_prueba': modo_prueba,
            'ganadores': ganadores_info,
            'restantes': ParticipanteSorteo.objects.filter(activo=True).count()
        })


class ListaGanadoresView(views.APIView):
    """Lista todos los ganadores"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        tipo = request.query_params.get('tipo', None)
        
        ganadores = Ganador.objects.all().select_related('participante')
        if tipo:
            ganadores = ganadores.filter(tipo_sorteo=tipo)
        
        serializer = GanadorSerializer(ganadores, many=True)
        return Response(serializer.data)


class ExportarGanadoresView(views.APIView):
    """Exporta ganadores a Excel"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        ganadores = Ganador.objects.all().select_related('participante').order_by('tipo_sorteo', 'numero_premio')
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Ganadores"
        
        headers = ['#', 'Tipo', 'Nombre Completo', 'Cédula', 'Email', 'Teléfono', 'Premio', 'Fecha']
        ws.append(headers)
        
        for g in ganadores:
            ws.append([
                g.numero_premio,
                g.get_tipo_sorteo_display(),
                g.participante.nombre_completo,
                g.participante.cedula,
                g.participante.email,
                g.participante.telefono,
                g.descripcion_premio or '',
                g.fecha_sorteo.strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=ganadores_sorteo.xlsx'
        return response


class ResetSorteoView(views.APIView):
    """Resetea todos los datos del sorteo (¡usar con cuidado!)"""
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        confirmar = request.data.get('confirmar', False)
        
        if not confirmar:
            return Response({
                'warning': 'Esto eliminará TODOS los ganadores y participantes del sorteo. Envía confirmar=true para proceder.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Eliminar ganadores
        Ganador.objects.all().delete()
        
        # Reactivar TODOS los participantes
        ParticipanteSorteo.objects.all().update(activo=True)
        
        return Response({
            'mensaje': 'Sorteo reseteado completamente.',
            'participantes_reactivados': ParticipanteSorteo.objects.filter(activo=True).count()
        })