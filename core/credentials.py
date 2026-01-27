from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from io import BytesIO
import os
from django.conf import settings
from .utils import QRGenerator

class CredentialGenerator:
    @staticmethod
    def generate_pdf(alumno):
        """Generates a professional PDF credential for the student."""
        buffer = BytesIO()
        
        # Card Size (A6 is good for phone/print)
        width, height = A6 # 105mm x 148mm
        c = canvas.Canvas(buffer, pagesize=A6)
        
        # Colors
        UNEMI_BLUE = HexColor("#0F1E4B")
        UNEMI_ORANGE = HexColor("#EF7D00")
        
        # --- Background ---
        # Top Header Background
        c.setFillColor(UNEMI_ORANGE)
        c.rect(0, height - 40*mm, width, 40*mm, stroke=0, fill=1)
        
        # --- Header Content ---
        logo_path = os.path.join(settings.MEDIA_ROOT, 'icono.png')
        if os.path.exists(logo_path):
            # Logo header
            c.drawImage(logo_path, width/2 - 15*mm, height - 32*mm, width=30*mm, height=30*mm, mask='auto', preserveAspectRatio=True)
        
        # --- Title ---
        c.setFillColor(UNEMI_BLUE)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(width/2, height - 50*mm, "CREDENCIAL DE ASISTENCIA")
        
        # --- Student Info ---
        c.setFillColor(UNEMI_BLUE)
        
        # Name (Bold, Large)
        c.setFont("Helvetica-Bold", 14)
        name_y = height - 58*mm
        if len(alumno.nombre_completo) > 25:
            names = alumno.nombre_completo.split(' ')
            mid = len(names) // 2
            line1 = " ".join(names[:mid])
            line2 = " ".join(names[mid:])
            c.drawCentredString(width/2, name_y, line1)
            c.drawCentredString(width/2, name_y - 6*mm, line2)
            current_y = name_y - 12*mm
        else:
            c.drawCentredString(width/2, name_y, alumno.nombre_completo)
            current_y = name_y - 8*mm
            
        # Meta Info (Moved Up)
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#64748b")) # Slate 500
        c.drawCentredString(width/2, current_y, alumno.cedula)
        
        if alumno.carrera:
             c.setFont("Helvetica", 8)
             c.drawCentredString(width/2, current_y - 4*mm, alumno.carrera[:45])
        
        # --- Group Info (Prominent) ---
        if alumno.grupo:
            group_y = current_y - 12*mm
            c.setFont("Helvetica-Bold", 18)
            c.setFillColor(UNEMI_ORANGE)
            c.drawCentredString(width/2, group_y, f"GRUPO {alumno.grupo}")
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(UNEMI_BLUE)
            c.drawCentredString(width/2, group_y - 4*mm, "UBICA A TU LÍDER")
        
        # --- QR Code (Moved down to avoid overlap) ---
        qr_size = 48*mm
        qr_y = 12*mm # Closer to bottom
        
        # Generate QR Image Buffer
        qr_img_buffer = QRGenerator.generate_qr_bytes(alumno.codigo_qr)
        qr_image = ImageReader(qr_img_buffer)
        
        # Draw QR Centered
        c.drawImage(qr_image, (width - qr_size)/2, qr_y, width=qr_size, height=qr_size)
        
        # --- Footer ---
        c.setFont("Helvetica", 7)
        c.setFillColor(UNEMI_BLUE)
        c.drawCentredString(width/2, 6*mm, "Presenta este código para registrar tu asistencia")
        
        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer
