import pandas as pd
import json
from rest_framework import views, status, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import render
from django.http import HttpResponse
from django.db import transaction
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from datetime import datetime
from .models import Alumno
from lideres_app.models import Lider
import io


class IsLeaderOrAdmin(permissions.BasePermission):
    """Custom permission to allow leaders and admin users"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_staff or hasattr(request.user, 'lider_profile')
        )


class ExcelImportExportView(LoginRequiredMixin, TemplateView):
    """Main page view for Excel import/export interface"""
    template_name = 'alumnos/importar_exportar.html'
    login_url = '/login/'
    
    def dispatch(self, request, *args, **kwargs):
        # Allow both admin users and leaders
        if not (request.user.is_staff or hasattr(request.user, 'lider_profile')):
            return HttpResponse('Acceso denegado. Solo administradores y líderes pueden acceder.', status=403)
        return super().dispatch(request, *args, **kwargs)


class ExcelAnalyzeView(views.APIView):
    """Analyzes uploaded Excel file and returns structure for mapping"""
    permission_classes = [IsLeaderOrAdmin]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        file_obj = request.data.get('file')
        if not file_obj:
            return Response({
                "error": "Debe proporcionar un archivo Excel (.xlsx)"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read Excel file
            df = pd.read_excel(file_obj, header=None)
            
            if df.empty:
                return Response({
                    "error": "El archivo está vacío"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Detect if first row is header
            first_row = df.iloc[0].tolist()
            has_header = self._detect_header(first_row)
            
            if has_header:
                df.columns = df.iloc[0]
                df = df[1:]
                detected_columns = [str(col) for col in df.columns]
            else:
                detected_columns = [f"Columna {i+1}" for i in range(len(df.columns))]
                df.columns = detected_columns
            
            # Get preview data (first 5 rows)
            preview_data = []
            for idx, row in df.head(5).iterrows():
                preview_data.append([str(val) if pd.notna(val) else '' for val in row])
            
            # Suggest mappings based on column names
            suggested_mappings = self._suggest_mappings(detected_columns)
            
            # Required fields for Alumno model (matching registration form)
            required_fields = {
                'nombre_completo': 'Nombre Completo *',
                'cedula': 'Cédula de Identidad *',
                'email': 'Correo Electrónico *',
                'telefono': 'Celular/WhatsApp *',
                'modalidad': 'Modalidad de Estudios *',
                'carrera': 'Carrera *',
                'facultad': 'Facultad (Opcional)'
            }
            
            return Response({
                "success": True,
                "has_header": has_header,
                "columns": detected_columns,
                "preview": preview_data,
                "total_rows": len(df),
                "suggested_mappings": suggested_mappings,
                "required_fields": required_fields
            })
            
        except Exception as e:
            return Response({
                "error": f"Error al analizar el archivo: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _detect_header(self, first_row):
        """Detect if first row contains headers"""
        # Check if first row contains mostly strings and common header keywords
        header_keywords = [
            'nombre', 'cedula', 'cédula', 'email', 'correo', 'telefono', 'teléfono',
            'celular', 'carrera', 'facultad', 'modalidad'
        ]
        
        string_count = sum(1 for val in first_row if isinstance(val, str))
        keyword_matches = sum(
            1 for val in first_row 
            if isinstance(val, str) and any(kw in str(val).lower() for kw in header_keywords)
        )
        
        return string_count > len(first_row) * 0.5 or keyword_matches > 0
    
    def _suggest_mappings(self, columns):
        """Suggest field mappings based on column names with enhanced detection"""
        mappings = {}
        
        # Enhanced mapping rules with more variations
        mapping_rules = {
            'nombre_completo': [
                'nombre', 'nombre completo', 'nombres', 'estudiante', 'alumno', 
                'participante', 'apellidos y nombres', 'nombres y apellidos',
                'nombre del estudiante', 'nombre del alumno', 'full name', 'name'
            ],
            'cedula': [
                'cedula', 'cédula', 'ci', 'identificacion', 'identificación',
                'documento', 'dni', 'ruc', 'id', 'numero de cedula', 'número de cédula',
                'cedula de identidad', 'cédula de identidad', 'identification'
            ],
            'email': [
                'email', 'correo', 'mail', 'e-mail', 'correo electronico',
                'correo electrónico', 'email institucional', 'correo institucional',
                'correo personal', 'email personal', 'electronic mail'
            ],
            'telefono': [
                'telefono', 'teléfono', 'celular', 'movil', 'móvil', 'phone',
                'whatsapp', 'contacto', 'numero', 'número', 'cel', 'telf',
                'telefono celular', 'teléfono celular', 'numero de contacto'
            ],
            'modalidad': [
                'modalidad', 'tipo', 'modo', 'forma', 'modalidad de estudios',
                'tipo de modalidad', 'presencial', 'online', 'virtual', 'semipresencial'
            ],
            'carrera': [
                'carrera', 'programa', 'especialidad', 'profesion', 'profesión',
                'carrera universitaria', 'programa academico', 'programa académico',
                'curso', 'major', 'degree'
            ],
            'facultad': [
                'facultad', 'escuela', 'departamento', 'unidad academica',
                'unidad académica', 'instituto', 'college', 'school', 'faculty'
            ]
        }
        
        # Try to match each column to a field
        for field, keywords in mapping_rules.items():
            for col in columns:
                col_lower = str(col).lower().strip()
                # Remove special characters for better matching
                col_clean = col_lower.replace('_', ' ').replace('-', ' ').replace('.', ' ')
                
                # Check for exact or partial matches
                if any(kw in col_clean for kw in keywords):
                    mappings[field] = col
                    break
        
        return mappings


class ExcelProcessImportView(views.APIView):
    """Process mapped Excel data and create Alumno records"""
    permission_classes = [IsLeaderOrAdmin]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        file_obj = request.data.get('file')
        mappings_json = request.data.get('mappings')
        has_header = request.data.get('has_header', 'true') == 'true'
        
        if not file_obj or not mappings_json:
            return Response({
                "error": "Faltan datos requeridos"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            mappings = json.loads(mappings_json)
            
            # Get lider - if admin, get first active lider or None
            if hasattr(request.user, 'lider_profile'):
                lider = request.user.lider_profile
            else:
                # Admin user - assign to first active lider or create without lider
                lider = Lider.objects.filter(activo=True).first()
                if not lider:
                    return Response({
                        "error": "No hay líderes activos. Por favor crea un líder primero."
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Read Excel
            df = pd.read_excel(file_obj, header=None)
            
            if has_header:
                df.columns = df.iloc[0]
                df = df[1:]
            else:
                df.columns = [f"Columna {i+1}" for i in range(len(df.columns))]
            
            results = {
                'total': len(df),
                'created': 0,
                'errors': [],
                'skipped': 0
            }
            
            # Process row by row
            for idx, row in df.iterrows():
                row_num = idx + 2 if has_header else idx + 1
                
                try:
                    # Extract mapped data
                    data = {}
                    for field, column in mappings.items():
                        if column and column in df.columns:
                            value = row[column]
                            data[field] = str(value).strip() if pd.notna(value) else ''
                    
                    # Validate required fields
                    validation_error = self._validate_row(data, row_num)
                    if validation_error:
                        results['errors'].append(validation_error)
                        results['skipped'] += 1
                        continue
                    
                    # Check if cedula already exists
                    cedula = data['cedula'].zfill(10)
                    if Alumno.objects.filter(cedula=cedula).exists():
                        results['errors'].append(
                            f"Fila {row_num}: Cédula {cedula} ya existe en el sistema"
                        )
                        results['skipped'] += 1
                        continue
                    
                    # Normalize modalidad
                    modalidad = self._normalize_modalidad(data.get('modalidad', ''))
                    
                    # Create Alumno with bank data if provided
                    with transaction.atomic():
                        alumno = Alumno.objects.create(
                            nombre_completo=data['nombre_completo'],
                            cedula=cedula,
                            email=data['email'],
                            telefono=data['telefono'],
                            modalidad=modalidad,
                            carrera=data.get('carrera', 'NO ESPECIFICADA'),
                            facultad=data.get('facultad', ''),
                            lider_invitador=lider
                        )
                        
                        results['created'] += 1
                
                except Exception as e:
                    results['errors'].append(f"Fila {row_num}: {str(e)}")
                    results['skipped'] += 1
            
            return Response({
                "success": True,
                "results": results
            })
            
        except Exception as e:
            return Response({
                "error": f"Error al procesar importación: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _validate_row(self, data, row_num):
        """Validate row data"""
        required = ['nombre_completo', 'cedula', 'email', 'telefono']
        
        for field in required:
            if not data.get(field):
                return f"Fila {row_num}: Campo '{field}' es requerido"
        
        # Validate cedula format
        cedula = data['cedula'].strip()
        
        # Check if it looks like an email (common mapping error)
        if '@' in cedula:
            return f"Fila {row_num}: La columna de Cédula contiene un email ('{cedula}'). Verifica el mapeo de columnas."
        
        # Check if it's numeric
        if not cedula.isdigit():
            return f"Fila {row_num}: Cédula debe contener solo números. Recibido: '{cedula}'"
        
        # Check length
        if len(cedula) > 10:
            return f"Fila {row_num}: Cédula no puede tener más de 10 dígitos. Recibido: '{cedula}' ({len(cedula)} dígitos)"
        
        # Validate email format
        email = data['email'].strip()
        if '@' not in email:
            return f"Fila {row_num}: Email inválido '{email}'"
        
        return None
    
    def _normalize_modalidad(self, value):
        """Normalize modalidad value"""
        value_lower = str(value).lower().strip()
        
        if 'presencial' in value_lower and 'semi' not in value_lower:
            return 'PRESENCIAL'
        elif 'linea' in value_lower or 'online' in value_lower:
            return 'EN_LINEA'
        elif 'semi' in value_lower or 'hibrido' in value_lower or 'híbrido' in value_lower:
            return 'SEMIPRESENCIAL'
        
        return 'PRESENCIAL'  # Default


class ExcelTemplateDownloadView(views.APIView):
    """Generate and download Excel template with examples"""
    permission_classes = [IsLeaderOrAdmin]
    
    def get(self, request):
        # Create template data
        template_data = {
            'Nombre Completo': [
                'Juan Pérez García',
                'María López Rodríguez',
                'Carlos Sánchez Mora'
            ],
            'Cédula': ['0912345678', '0923456789', '0934567890'],
            'Email': [
                'juan.perez@example.com',
                'maria.lopez@example.com',
                'carlos.sanchez@example.com'
            ],
            'Teléfono': ['0987654321', '0976543210', '0965432109'],
            'Modalidad': ['Presencial', 'En Línea', 'Semipresencial'],
            'Carrera': [
                'Ingeniería en Sistemas',
                'Administración de Empresas',
                'Contabilidad y Auditoría'
            ],
            'Facultad': [
                'Facultad de Ciencias de la Ingeniería',
                'Facultad de Ciencias Administrativas',
                'Facultad de Ciencias Económicas'
            ]
        }
        
        df = pd.DataFrame(template_data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Alumnos')
            
            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Alumnos']
            
            # Style headers
            from openpyxl.styles import Font, PatternFill, Alignment
            header_fill = PatternFill(start_color='0F1E4B', end_color='0F1E4B', fill_type='solid')
            header_font = Font(color='FFFFFF', bold=True)
            
            for cell in worksheet[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center')
            
            # Auto-adjust column widths
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(cell.value)
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="Plantilla_Alumnos_UNEMI_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        
        return response

# === EXPORT VIEWS ===

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

def export_alumnos_view(request):
    """Export all students to Excel"""
    # Manual authentication check - don't redirect, return error
    if not request.user.is_authenticated:
        return HttpResponse('No autenticado. Por favor inicia sesión.', status=401)
    
    # Check permissions
    if not (request.user.is_staff or hasattr(request.user, 'lider_profile')):
        return HttpResponse('Acceso denegado. Solo administradores y líderes pueden exportar.', status=403)
    
    try:
        # Get all alumnos for the current user
        if hasattr(request.user, 'lider_profile'):
            # Leader: only their students
            alumnos = Alumno.objects.filter(lider_invitador=request.user.lider_profile)
        else:
            # Admin: all students
            alumnos = Alumno.objects.all()
        
        # Check if there's data to export
        if not alumnos.exists():
            return HttpResponse('No hay datos para exportar', status=404)
        
        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = 'Alumnos'
        
        # Define headers
        headers = ['Cédula', 'Nombre Completo', 'Email', 'Teléfono', 'Modalidad', 
                   'Facultad', 'Carrera', 'Grupo', 'Asistió', 'Líder', 'Fecha Registro']
        
        # Write headers
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.value = header
            cell.font = Font(color='FFFFFF', bold=True, size=11)
            cell.fill = PatternFill(start_color='0F1E4B', end_color='0F1E4B', fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')
        
        # Write data
        for row_num, alumno in enumerate(alumnos, 2):
            ws.cell(row=row_num, column=1, value=alumno.cedula)
            ws.cell(row=row_num, column=2, value=alumno.nombre_completo)
            ws.cell(row=row_num, column=3, value=alumno.email)
            ws.cell(row=row_num, column=4, value=alumno.telefono)
            ws.cell(row=row_num, column=5, value=alumno.modalidad)
            ws.cell(row=row_num, column=6, value=alumno.facultad or '')
            ws.cell(row=row_num, column=7, value=alumno.carrera)
            ws.cell(row=row_num, column=8, value=alumno.grupo or '')
            ws.cell(row=row_num, column=9, value='Sí' if alumno.asistio else 'No')
            ws.cell(row=row_num, column=10, value=alumno.lider_invitador.nombre_completo if alumno.lider_invitador else '')
            ws.cell(row=row_num, column=11, value=alumno.fecha_registro.strftime('%Y-%m-%d %H:%M') if alumno.fecha_registro else '')
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if cell.value and len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Create response
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        filename = f'Alumnos_UNEMI_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        response['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error en exportación: {error_details}")
        return HttpResponse(f'Error al exportar: {str(e)}', status=500, content_type='text/plain')




