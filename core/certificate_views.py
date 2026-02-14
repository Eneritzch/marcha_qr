from django.http import HttpResponse
from django.utils import timezone
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from alumnos.models import Alumno
from lideres_app.models import Lider
from .certificate_config import ConfiguracionCertificado
from .certificate_generator import CertificateGenerator


class CertificateBuscarView(views.APIView):
    """Search for a participant by cedula to check certificate eligibility."""
    permission_classes = [AllowAny]
    
    def get(self, request, cedula):
        try:
            alumno = Alumno.objects.get(cedula=cedula)
            return Response({
                'encontrado': True,
                'nombre_completo': alumno.nombre_completo,
                'cedula': alumno.cedula,
                'carrera': alumno.carrera or 'No especificada',
                'grupo': alumno.grupo,
                'elegible': True
            })
        except Alumno.DoesNotExist:
            # Try searching for Leader by Email
        except Alumno.DoesNotExist:
            # Try searching for Leader by Email
            try:
                # Case-insensitive email search - Use filter().first() to avoid MultipleObjectsReturned
                lider = Lider.objects.filter(email__iexact=cedula).first()
                
                if lider:
                    return Response({
                        'encontrado': True,
                        'nombre_completo': lider.nombre_completo,
                        'cedula': lider.email, # Return email as the identifier (instead of cedula)
                        'carrera': 'LIDERAZGO Y ORGANIZACIÓN',
                        'grupo': lider.grupo,
                        'elegible': True,
                        'es_lider': True # Flag for frontend if needed
                    })
                else:
                    return Response({
                        'encontrado': False,
                        'mensaje': 'No se encontró un participante o líder registrado con este dato (Cédula o Email).'
                    }, status=status.HTTP_404_NOT_FOUND)
            except Exception:
                return Response({
                    'encontrado': False,
                    'mensaje': 'No se encontró un participante o líder registrado con este dato (Cédula o Email).'
                }, status=status.HTTP_404_NOT_FOUND)


from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator

class CertificateDescargarView(views.APIView):
    """Generate and stream a PDF certificate (no storage)."""
    permission_classes = [AllowAny]
    
    @method_decorator(xframe_options_exempt)
    def get(self, request, cedula):
        # Support for Token Auth via Query Param (for iframes/links)
        if 'token' in request.query_params and not request.user.is_authenticated:
            from rest_framework.authtoken.models import Token
            try:
                token_key = request.query_params['token']
                token = Token.objects.get(key=token_key)
                request.user = token.user
            except:
                pass

        try:
            # Check if it's a leader or admin requesting their own certificate
            if cedula == 'mi-certificado' and request.user.is_authenticated:
                # Allow if user has lider_profile OR is superuser
                if hasattr(request.user, 'lider_profile') or request.user.is_superuser:
                    config = ConfiguracionCertificado.get_config()
                    
                    # Create a pseudo-alumno object
                    class PseudoAlumno:
                        def __init__(self, user, lider_profile=None):
                            self.id = user.id
                            if lider_profile:
                                self.nombre_completo = lider_profile.nombre_completo
                                self.cedula = lider_profile.cedula or 'LIDER'
                                self.grupo = lider_profile.grupo
                            else:
                                # Fallback for superuser without profile
                                self.nombre_completo = user.first_name + ' ' + user.last_name if user.first_name else user.username
                                self.cedula = 'ADMIN'
                                self.grupo = 0
                            
                            # Use a custom 'carrera' for leaders
                            self.carrera = "LIDERAZGO Y ORGANIZACIÓN" 
                    
                    lider_profile = getattr(request.user, 'lider_profile', None)
                    alumno = PseudoAlumno(request.user, lider_profile)
                else:
                    return HttpResponse("No autorizado", status=403)
            else:
                # Public download by ID (or Email for Leaders)
                try:
                    alumno = Alumno.objects.get(cedula=cedula)
                except Alumno.DoesNotExist:
                    # Try finding Leader by Email
                    # Use filter to avoid MultipleObjectsReturned
                    lider_qs = Lider.objects.filter(email__iexact=cedula)
                    
                    # Prioritize ACTIVE leaders
                    lider = lider_qs.filter(activo=True).first()
                    
                    # If no active leader found, try inactive (just in case) or raise error
                    if not lider:
                        lider = lider_qs.first()
                        
                    if lider:
                        # Only allow ACTIVE leaders (strict check as before)
                        if not lider.activo:
                            raise Alumno.DoesNotExist
    
                        # Use PseudoAlumno for Leader found by email
                        class PseudoLeader:
                            def __init__(self, lider):
                                self.id = lider.id
                                self.nombre_completo = lider.nombre_completo
                                self.cedula = lider.cedula or 'LIDER'
                                self.grupo = lider.grupo
                                self.carrera = "LIDERAZGO Y ORGANIZACIÓN"
                                self.es_lider_obj = True # Marker
    
                        alumno = PseudoLeader(lider)
                        
                    else:
                         raise Alumno.DoesNotExist 
 

        except Alumno.DoesNotExist:
            return Response({
                'error': 'Participante o Líder no encontrado en el sistema'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
             return Response({
                'error': f'Error al generar: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine if we need custom text (for Leaders)
        custom_body_text = None
        # Determine if we need custom text (for Leaders)
        custom_body_text = None
        
        # Check if it's "mi-certificado" OR if we found a leader via search
        is_leader_cert = (cedula == 'mi-certificado') or getattr(alumno, 'es_lider_obj', False)
        
        if is_leader_cert:
             config = ConfiguracionCertificado.get_config()
             custom_body_text = config.texto_certificado_lideres
        
        # Mark as delivered if it's a real student and hasn't been delivered yet
        if isinstance(alumno, Alumno) and not getattr(alumno, 'es_lider_obj', False):
            if not alumno.certificado_entregado:
                alumno.certificado_entregado = True
                alumno.fecha_entrega_certificado = timezone.now()
                alumno.save(update_fields=['certificado_entregado', 'fecha_entrega_certificado'])

        # Generate PDF in memory
        pdf_buffer = CertificateGenerator.generate_certificate(alumno, custom_body_text=custom_body_text)
        
        # Create streaming response
        response = HttpResponse(
            pdf_buffer.getvalue(),
            content_type='application/pdf'
        )
        
        # Sanitize filename - Use ID/Cedula to avoid encoding issues entirely
        filename = f"Certificado_UNEMI_25_{alumno.cedula}.pdf"
        
        # User feedback: "este boton nome manda a descargar directo el archivo si no que abre otra ventana"
        # If 'download=1' is passed, force attachment disposition
        force_download = request.query_params.get('download') == '1'
        disposition = 'attachment' if force_download else 'inline'
        
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        
        # PDF buffer will be garbage collected after response
        return response


class CertificateConfigView(views.APIView):
    """Admin: Get and update certificate configuration."""
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]
    
    def get(self, request):
        config = ConfiguracionCertificado.get_config()
        
        return Response({
            'titulo_certificado': config.titulo_certificado,
            'subtitulo': config.subtitulo,
            'texto_cuerpo': config.texto_cuerpo,
            # Leader Messages
            'mensaje_lideres_titulo': config.mensaje_lideres_titulo,
            'mensaje_lideres_cuerpo': config.mensaje_lideres_cuerpo,
            'texto_certificado_lideres': config.texto_certificado_lideres,
            # Signatures (URLs)
            'firma_1_nombre': config.firma_1_nombre,
            'firma_1_cargo': config.firma_1_cargo,
            'firma_1_imagen': config.firma_1_imagen.url if config.firma_1_imagen else None,
            'firma_2_nombre': config.firma_2_nombre,
            'firma_2_cargo': config.firma_2_cargo,
            'firma_2_imagen': config.firma_2_imagen.url if config.firma_2_imagen else None,
            'firma_3_nombre': config.firma_3_nombre,
            'firma_3_cargo': config.firma_3_cargo,
            'firma_3_imagen': config.firma_3_imagen.url if config.firma_3_imagen else None,
            # Logos (URLs)
            'logo_izquierda': config.logo_izquierda.url if config.logo_izquierda else '/static/img/muc.png',
            'logo_centro': config.logo_centro.url if config.logo_centro else '/static/img/icono.webp',
            'logo_derecha': config.logo_derecha.url if config.logo_derecha else '/static/img/feue.png',
            'color_primario': config.color_primario,
            'color_secundario': config.color_secundario,
        })
    
    def put(self, request):
        config = ConfiguracionCertificado.get_config()
        
        # Update text fields
        if 'titulo_certificado' in request.data:
            config.titulo_certificado = request.data['titulo_certificado']
        if 'subtitulo' in request.data:
            config.subtitulo = request.data['subtitulo']
        if 'texto_cuerpo' in request.data:
            config.texto_cuerpo = request.data['texto_cuerpo']
            
        # Update Leader Messages
        if 'mensaje_lideres_titulo' in request.data:
            config.mensaje_lideres_titulo = request.data['mensaje_lideres_titulo']
        if 'mensaje_lideres_cuerpo' in request.data:
            config.mensaje_lideres_cuerpo = request.data['mensaje_lideres_cuerpo']
        if 'texto_certificado_lideres' in request.data:
            config.texto_certificado_lideres = request.data['texto_certificado_lideres']
        
        # Firmas Text
        if 'firma_1_nombre' in request.data:
            config.firma_1_nombre = request.data['firma_1_nombre']
        if 'firma_1_cargo' in request.data:
            config.firma_1_cargo = request.data['firma_1_cargo']
        if 'firma_2_nombre' in request.data:
            config.firma_2_nombre = request.data['firma_2_nombre']
        if 'firma_2_cargo' in request.data:
            config.firma_2_cargo = request.data['firma_2_cargo']
        if 'firma_3_nombre' in request.data:
            config.firma_3_nombre = request.data['firma_3_nombre']
        if 'firma_3_cargo' in request.data:
            config.firma_3_cargo = request.data['firma_3_cargo']

        # Colors
        if 'color_primario' in request.data:
            config.color_primario = request.data['color_primario']
        if 'color_secundario' in request.data:
            config.color_secundario = request.data['color_secundario']
        
        # Handle file uploads (Signatures -> ImageField)
        for i in range(1, 4):
            key = f'firma_{i}_imagen'
            if key in request.FILES:
                setattr(config, key, request.FILES[key])

        # Handle file uploads (Logos -> ImageField)
        if 'logo_izquierda' in request.FILES:
            config.logo_izquierda = request.FILES['logo_izquierda']
        if 'logo_centro' in request.FILES:
            config.logo_centro = request.FILES['logo_centro']
        if 'logo_derecha' in request.FILES:
            config.logo_derecha = request.FILES['logo_derecha']
        
        config.save()
        return Response({'message': 'Configuración actualizada correctamente'})

class LeaderCertificateInfoView(views.APIView):
    """Returns the message configuration for leaders."""
    permission_classes = [IsAuthenticated] # Leaders/Admin

    def get(self, request):
        config = ConfiguracionCertificado.get_config()
        
        # Get identifier (Email for leaders, 'mi-certificado' as fallback for superusers)
        identifier = 'mi-certificado'
        has_cedula = False
        
        if hasattr(request.user, 'lider_profile') and request.user.lider_profile:
            # Only if active
            if request.user.lider_profile.activo:
                identifier = request.user.lider_profile.email
                has_cedula = True
        elif request.user.is_superuser:
            has_cedula = True
            
        return Response({
            'titulo': config.mensaje_lideres_titulo,
            'cuerpo': config.mensaje_lideres_cuerpo,
            'has_cedula': has_cedula,
            'identifier': identifier
        })


