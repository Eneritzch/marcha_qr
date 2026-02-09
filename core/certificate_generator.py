from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
import os
import datetime
from django.conf import settings


class CertificateGenerator:
    """Generates certificates matching the certificad.html design."""
    
    _fonts_registered = False
    
    @classmethod
    def _register_fonts(cls):
        """Register custom fonts once."""
        if cls._fonts_registered:
            return
        try:
            # Attempt to register specific fonts if they exist, otherwise fallback to standard
            font_dir = os.path.join(settings.BASE_DIR, 'static', 'fonts')
            
            # Register GreatVibes (Script)
            greatvibes_path = os.path.join(font_dir, 'GreatVibes-Regular.ttf')
            if os.path.exists(greatvibes_path):
                pdfmetrics.registerFont(TTFont('GreatVibes', greatvibes_path))

            cls._fonts_registered = True
        except Exception:
            # If standard fonts fail, we will fallback to Helvetica/Times in the drawing code
            cls._fonts_registered = True
    
    @staticmethod
    def generate_certificate(alumno, config=None, custom_body_text=None):
        from .certificate_config import ConfiguracionCertificado
        
        CertificateGenerator._register_fonts()
        
        if config is None:
            config = ConfiguracionCertificado.get_config()
        
        buffer = BytesIO()
        # A4 Landscape: 297mm x 210mm
        width, height = landscape(A4) 
        c = canvas.Canvas(buffer, pagesize=landscape(A4))
        
        # === COLORS (from css :root) ===
        PRIMARY = HexColor("#0B3D91")   # Azul institucional
        ACCENT = HexColor("#D4AF37")    # Dorado
        TEXT = HexColor("#1c1c1c")
        MUTED = HexColor("#666666")
        PAPER = HexColor("#ffffff")
        
        # Define Fonts
        TITLE_FONT = "Times-Bold"
        BODY_FONT = "Times-Roman"
        SANS_FONT = "Helvetica"
        SANS_BOLD = "Helvetica-Bold"
        
        SCRIPT_FONT = "Times-BoldItalic" # Default fallback
        try:
            pdfmetrics.getFont('GreatVibes')
            SCRIPT_FONT = 'GreatVibes'
        except:
            pass

        # Background
        c.setFillColor(PAPER)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        
        # === DECORATIVE ELEMENTS ===
        
        # 1. Ribbon Background (Top Right)
        c.saveState()
        c.translate(width - 60*mm, height - 40*mm) 
        c.rotate(18)
        c.setFillColor(PRIMARY, alpha=0.08) 
        c.roundRect(-110*mm, -60*mm, 220*mm, 120*mm, 30*mm, fill=1, stroke=0)
        c.setFillColor(ACCENT, alpha=0.05) 
        c.roundRect(-110*mm, -60*mm, 220*mm, 120*mm, 30*mm, fill=1, stroke=0)
        c.restoreState()

        # 2. Seal (Top Left) - REMOVED

        # 3. Frames
        margin_frame = 12*mm
        frame_w = width - 2 * margin_frame
        frame_h = height - 2 * margin_frame
        
        c.saveState()
        c.setStrokeColor(PRIMARY, alpha=0.35)
        c.setLineWidth(2)
        c.roundRect(margin_frame, margin_frame, frame_w, frame_h, 3*mm, fill=0, stroke=1)
        
        margin_inner = 18*mm
        inner_w = width - 2 * margin_inner
        inner_h = height - 2 * margin_inner
        c.setStrokeColor(ACCENT, alpha=0.55)
        c.setLineWidth(1)
        c.roundRect(margin_inner, margin_inner, inner_w, inner_h, 2.5*mm, fill=0, stroke=1)
        c.restoreState()

        # === HEADER CONTENT (3 LOGOS) ===
        
        header_y_top = height - 16*mm 
        
        # Sizes
        side_logo_size = 50*mm 
        center_logo_size = 35*mm 
        
        # Left Logo
        logo1_x = 30*mm 
        # Default fallback
        logo1_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'muc.png')
        if config.logo_izquierda:
            logo1_path = config.logo_izquierda.path
            
        if os.path.exists(logo1_path):
            c.drawImage(logo1_path, logo1_x, header_y_top - side_logo_size, width=side_logo_size, height=side_logo_size, mask='auto', preserveAspectRatio=True)
            
        # Center Logo
        logo2_x = width/2 - center_logo_size/2
        logo2_y_offset = 8*mm 
        logo2_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'icono.webp')
        if config.logo_centro:
            logo2_path = config.logo_centro.path
            
        if os.path.exists(logo2_path):
             c.drawImage(logo2_path, logo2_x, header_y_top - center_logo_size - logo2_y_offset, width=center_logo_size, height=center_logo_size, mask='auto', preserveAspectRatio=True)
             
        # Right Logo
        logo3_x = width - 30*mm - side_logo_size
        logo3_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'feue.png')
        if config.logo_derecha:
            logo3_path = config.logo_derecha.path
            
        if os.path.exists(logo3_path):
             c.drawImage(logo3_path, logo3_x, header_y_top - side_logo_size, width=side_logo_size, height=side_logo_size, mask='auto', preserveAspectRatio=True)


        # Meta Info (Below header)
        c.setFont(SANS_FONT, 8)
        c.setFillColor(MUTED)
        
        fecha_str = datetime.date.today().strftime("%d/%m/%Y")
        codigo = f"CERT-{alumno.id}-{datetime.date.today().year}"
        
        # Adjust meta position based on largest logo
        # meta_y = header_y_top - side_logo_size - 4*mm
        # c.drawRightString(width - 25*mm, meta_y, f"Código: {codigo}")
        # c.drawRightString(width - 25*mm, meta_y - 10, f"Fecha: {fecha_str}")
        
        # === MAIN CONTENT ===
        main_y_start = height - 75*mm # Adjusted for larger header
        center_x = width / 2
        
        # TITLE
        c.setFont(TITLE_FONT, 32)
        c.setFillColor(PRIMARY)
        c.drawCentredString(center_x, main_y_start, config.titulo_certificado)
        
        # SUBTITLE
        c.setFont(SANS_BOLD, 9)
        c.setFillColor(HexColor("#1c1c1cb8")) 
        c.drawCentredString(center_x, main_y_start - 8*mm, config.subtitulo)
        
        # PRESENTED TO
        c.setFont(BODY_FONT, 12)
        c.setFillColor(HexColor("#1c1c1cc7")) 
        c.drawCentredString(center_x, main_y_start - 20*mm, "Se otorga el presente certificado a:")
        
        # PERSON NAME (Script Font)
        name_font_size = 42 if SCRIPT_FONT == 'GreatVibes' else 28
        c.setFont(SCRIPT_FONT, name_font_size) 
        c.setFillColor(TEXT)
        name_y = main_y_start - 35*mm
        nombre = alumno.nombre_completo.title()
        c.drawCentredString(center_x, name_y, nombre)
        
        # DESCRIPTION
        desc_y = name_y - 18*mm
        c.setFont(BODY_FONT, 12)
        c.setFillColor(HexColor("#1c1c1cd1")) 
        
        # Construct text - Use config.texto_cuerpo
        # Note: The original code had hardcoded text construction.
        # We should try to use the placeholder from config if possible, 
        # or stick to the specific format requested earlier. 
        # The user said "el mensaje... desde alla", implying dynamic text.
        # But for now, let's keep the structured "Por haber X..." format but maybe use config parts if they exist?
        # Actually, let's enable full body text from config if it contains placeholder, 
        # otherwise use the hardcoded logic?
        # The prompt says "mensaje... desde alla". 
        # So we should use `config.texto_cuerpo`.
        
        # Custom Body Text Logic
        text_template = custom_body_text if custom_body_text else config.texto_cuerpo
        
        # Replacements
        body = text_template.replace("{nombre}", nombre)
        if hasattr(alumno, 'grupo'):
             body = body.replace("{grupo}", str(alumno.grupo))
        # If body is just one long string, we might need to wrap it.
        # Simple wrap:
        from textwrap import wrap
        lines = wrap(body, width=85) # Adjust width
        
        y_text = desc_y
        for line in lines:
            c.drawCentredString(center_x, y_text, line)
            y_text -= 6*mm
        
        # === FOOTER (3 SIGNATURES) ===
        footer_y = 35*mm
        sig_y_line = footer_y + 10*mm
        
        # Col centers:
        col_w = width / 3
        c1_x = col_w * 0.5
        c2_x = col_w * 1.5
        c3_x = col_w * 2.5
        
        # Helper to draw signature
        def draw_sig(x, name, role, img_field):
            # Draw Image if exists
            if img_field:
                try:
                    sig_path = img_field.path
                    if os.path.exists(sig_path):
                         c.drawImage(sig_path, x - 20*mm, sig_y_line + 2*mm, width=40*mm, height=15*mm, mask='auto', preserveAspectRatio=True)
                except:
                    pass

            # Line
            c.setStrokeColor(TEXT, alpha=0.35)
            c.setLineWidth(1)
            c.line(x - 22*mm, sig_y_line, x + 22*mm, sig_y_line)
            
            # Text
            c.setFont(SANS_BOLD, 9)
            c.setFillColor(TEXT)
            c.drawCentredString(x, sig_y_line - 5*mm, name)
            
            c.setFont(SANS_FONT, 7)
            c.setFillColor(MUTED)
            c.drawCentredString(x, sig_y_line - 9*mm, role)

        # 1. Left (Firma 1)
        draw_sig(c1_x, config.firma_1_nombre, config.firma_1_cargo, config.firma_1_imagen)
        
        # 2. Center (Firma 2)
        draw_sig(c2_x, config.firma_2_nombre, config.firma_2_cargo, config.firma_2_imagen)
        
        # 3. Right (Firma 3)
        draw_sig(c3_x, config.firma_3_nombre, config.firma_3_cargo, config.firma_3_imagen)
        
        # QR Code - REMOVED
        
        c.showPage()
        c.save()
        buffer.seek(0)
        
        return buffer
