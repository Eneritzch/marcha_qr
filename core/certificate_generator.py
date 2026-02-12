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
import textwrap
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
        
        # === COLORS ===
        PRIMARY = HexColor("#0F1E4B")   # Azul UNEMI
        ACCENT = HexColor("#D4AF37")    # Dorado/Naranja (Ribbon)
        RIBBON_COLOR = HexColor("#E39C42") # Color aproximado del ribbon en la imagen
        TEXT = HexColor("#000000")
        MUTED = HexColor("#333333")
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
        
        # === DECORATIVE ELEMENTS (CLASSIC ELEGANT STYLE) ===
        
        # 1. Ribbon Background (Top Right Design Element)
        c.saveState()
        c.translate(width - 60*mm, height - 40*mm) 
        c.rotate(18)
        c.setFillColor(PRIMARY, alpha=0.08) 
        c.roundRect(-110*mm, -60*mm, 220*mm, 120*mm, 30*mm, fill=1, stroke=0)
        c.setFillColor(ACCENT, alpha=0.05) 
        c.roundRect(-110*mm, -60*mm, 220*mm, 120*mm, 30*mm, fill=1, stroke=0)
        c.restoreState()

        # 2. Frames (Refined Double Border)
        # Outer frame - primary color
        # 2. Frames (Refined Double Border - Reduced Margins)
        # Outer frame - primary color
        margin_frame = 6*mm # Reduced from 10mm
        frame_w = width - 2 * margin_frame
        frame_h = height - 2 * margin_frame
        
        c.saveState()
        c.setStrokeColor(PRIMARY, alpha=0.55)
        c.setLineWidth(3)
        c.roundRect(margin_frame, margin_frame, frame_w, frame_h, 3*mm, fill=0, stroke=1)
        
        # Inner frame - gold, elegant 
        margin_inner = 12*mm # Reduced from 16mm
        inner_w = width - 2 * margin_inner
        inner_h = height - 2 * margin_inner
        c.setStrokeColor(ACCENT, alpha=0.7)
        c.setLineWidth(1.5)
        c.roundRect(margin_inner, margin_inner, inner_w, inner_h, 2.5*mm, fill=0, stroke=1)
        c.restoreState()
        
        # 3. Corner Diamond Ornaments
        c.saveState()
        diamond_size = 4*mm
        # Coordinates for corners of the inner frame
        corners = [
            (margin_inner, margin_inner), 
            (width - margin_inner, margin_inner),
            (margin_inner, height - margin_inner),
            (width - margin_inner, height - margin_inner),
        ]
        
        for cx_d, cy_d in corners:
            # Outer Diamond Part
            c.setFillColor(ACCENT)
            p = c.beginPath()
            p.moveTo(cx_d, cy_d + diamond_size)
            p.lineTo(cx_d + diamond_size, cy_d)
            p.lineTo(cx_d, cy_d - diamond_size)
            p.lineTo(cx_d - diamond_size, cy_d)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
            
            # Inner Diamond Part
            inner_d = diamond_size * 0.5
            c.setFillColor(PRIMARY)
            p2 = c.beginPath()
            p2.moveTo(cx_d, cy_d + inner_d)
            p2.lineTo(cx_d + inner_d, cy_d)
            p2.lineTo(cx_d, cy_d - inner_d)
            p2.lineTo(cx_d - inner_d, cy_d)
            p2.close()
            c.drawPath(p2, fill=1, stroke=0)
        c.restoreState()
        
        # === HEADER CONTENT (ALIGNED LOGOS) ===
        
        # User feedback: "los 4 logos deben estar arriba el de 25 sale mas abjo que el reesto"
        # Meaning the '25' logo is LOWER than the others.
        # I need to raise the '25' logo more, or lower the others?
        # "el 25 subelo mas" -> Raise 25.
        # "los 4 logos deben estar arriba" -> All high up.
        
        # User feedback: "EL LOGO DE 25 CALAJO ARREGLALO PONLO ARRIBA ARRIBA... O SEA EL 25 SUBELO MAS"
        # "UNE MAS LOS OTROS 3"
        # "REUBICA TODOS LOS DEMAS LOGOS ... LOS 4 ALLA ARRIBA"
        
        # 1. Raising the 25 banner significantly.
        # It likely has top whitespace. 
        # I will start drawing it at y_top_alignment + 15mm.
        
        # User feedback: "se fue muy arriba el logo del 25... ponlo mas a la izquierda"
        # 1. Lower banner from +60mm to +45mm.
        # 2. Shift content center to the left.
        
        y_top_alignment = height - margin_inner
        
        # 4. Left Sidebar (Vertical Banner with 25 Años Logo)
        sidebar_width = 45*mm
        banner_x = margin_inner 
        # Lowered to +32mm per "un poco mas abajo del borde para abajo"
        banner_y_top = y_top_alignment + 32*mm 
        banner_w = 40*mm
        banner_h = 130*mm 
        
        logo_25_path = os.path.join(settings.BASE_DIR, 'static', 'img', '25.png')
        if os.path.exists(logo_25_path):
             c.drawImage(logo_25_path, banner_x, banner_y_top - banner_h, width=banner_w, height=banner_h, mask='auto', preserveAspectRatio=True)


        # 5. Header Logos (UNEMI - MUC - FEUE)
        # Content Area available for logos (Header follows sidebar indentation)
        header_content_start_x = margin_inner + banner_w + 5*mm
        header_content_width = (width - margin_inner) - header_content_start_x
        
        logo_h = 22*mm 
        
        # Specific widths to organize them better
        logo_w_muc = 50*mm
        logo_w_unemi = 50*mm * 0.85 # The reduced size
        logo_w_feue = 50*mm
        
        # User reported MUC-UNEMI is too tight, UNEMI-FEUE is wide.
        # "mueve muc mas a la izquierda".
        # We increase the gap between MUC and UNEMI.
        gap_1 = 15*mm # Increased from 5mm to push MUC left relative to UNEMI
        gap_2 = 5*mm  # Keep this tight as user said it looked "more space" (maybe fine, or reduce if needed, but user focused on MUC)
        
        # Group logos in header space using ACTUAL widths + specific gaps
        group_total_width = logo_w_muc + logo_w_unemi + logo_w_feue + gap_1 + gap_2
        
        # User: "ubica bien los logos centardos... salen muy a la derecha"
        # Previously we centered in `header_content_width`.
        # But `center_x` (body text center) is shifted left by 15mm relative to that geometric center 
        # to visually balance against the sidebar/banner.
        # Let's use `center_x` as the anchor for the group center.
        # We need to calculate `center_x` earlier or just re-calculate it here.
        
        # Re-calc center_x logic from line 230:
        visual_center_x = (header_content_start_x + header_content_width / 2) - 15*mm
        
        group_start_x = visual_center_x - (group_total_width / 2)
        
        logos_y = y_top_alignment - logo_h - 2*mm
        
        # Draw Logos
        # Calculate centers
        x_muc = group_start_x + logo_w_muc/2
        x_unemi = group_start_x + logo_w_muc + gap_1 + logo_w_unemi/2
        x_feue = group_start_x + logo_w_muc + gap_1 + logo_w_unemi + gap_2 + logo_w_feue/2
        
        # MUC (Left)
        logo_muc_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'muc.png')
        if config.logo_izquierda: logo_muc_path = config.logo_izquierda.path 
        if os.path.exists(logo_muc_path):
             c.drawImage(logo_muc_path, x_muc, logos_y, width=logo_w_muc, height=logo_h, mask='auto', preserveAspectRatio=True, anchor='c')

        # UNEMI (Center) - Reduced Size
        logo_unemi_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'logo-unemi-removebg-preview.png')
        if config.logo_centro: logo_unemi_path = config.logo_centro.path
        if os.path.exists(logo_unemi_path):
            unemi_h = logo_h * 0.85
            c.drawImage(logo_unemi_path, x_unemi, logos_y, width=logo_w_unemi, height=unemi_h, mask='auto', preserveAspectRatio=True, anchor='c')

        # FEUE (Right)
        logo_feue_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'feue.png')
        if config.logo_derecha: logo_feue_path = config.logo_derecha.path
        if os.path.exists(logo_feue_path):
             c.drawImage(logo_feue_path, x_feue, logos_y, width=logo_w_feue, height=logo_h, mask='auto', preserveAspectRatio=True, anchor='c')


        # === CENTER X FOR BODY TEXT ===
        # User: "este contenido ponlo mas a la izquierda"
        # Shift center line left by 15mm.
        center_x = (header_content_start_x + header_content_width / 2) - 15*mm

        # === TITLE (CLASSIC TEXT STYLE) ===
        # Position Title below logos
        title_y = logos_y - 25*mm
        
        # Main Title - "CERTIFICADO DE PARTICIPACIÓN" (Correct Attribute: titulo_certificado)
        main_title = config.titulo_certificado if config.titulo_certificado else "CERTIFICADO"
        
        c.setFont("Times-Bold", 42)
        c.setFillColor(ACCENT) # Gold
        # Check title length to adjust font size?
        if len(main_title) > 20: 
             c.setFont("Times-Bold", 32)
        c.drawCentredString(center_x, title_y, main_title.upper())
        
        # Subtitle
        subtitle_text = config.subtitulo if config.subtitulo else "Se certifica a:"
        
        c.setFont(SANS_FONT, 14) 
        c.setFillColor(TEXT)
        c.drawCentredString(center_x, title_y - 12*mm, subtitle_text)
        
        # === NAME ===
        name_y = title_y - 35*mm
        name_font_size = 50 if SCRIPT_FONT == 'GreatVibes' else 40 # Increased size
        c.setFont(SCRIPT_FONT, name_font_size) 
        c.setFillColor(TEXT)
        nombre = alumno.nombre_completo.title()
        c.drawCentredString(center_x, name_y, nombre)
        
        # Separator Line
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.line(center_x - 70*mm, name_y - 4*mm, center_x + 70*mm, name_y - 4*mm)
        
        # === BODY TEXT ===
        # User: "el cuerpo del texto del certificado no dejalo com estaba"
        # "ponlo mas grande" -> Likely means the wrapping was too wide/overflowing or font was weird.
        # I used divisor 3.5 which allows TOO MANY chars for 14pt font.
        # 14pt font avg char width is ~7pt. Text width in pt / 7 = chars.
        # So divisor should be ~7. Let's use 6 to be safe (slightly wider lines than 7).
        # "fuente mas bonita" -> Times-Roman. "letra mas grande" -> 16pt.
        # "ocupe mas espacio para abajo" -> Increase leading.
        
        body_y = name_y - 20*mm # Lower start
        c.setFont("Times-Roman", 16) # Changed from Helvetica 14 to Times 16
        c.setFillColor(TEXT)
        
        # Body wrapping
        text_width = header_content_width - 20*mm # More margin "que no se mezcle con el borde"
        line_height = 8*mm # Increased spacing
        
        text_template = custom_body_text if custom_body_text else config.texto_cuerpo
        
        # Construct message using replace for safety
        body_text = text_template.replace("{nombre}", nombre)
        if hasattr(alumno, 'grupo'):
             body_text = body_text.replace("{grupo}", str(alumno.grupo))
        
        # Correct wrapping for 14pt font
        # Width roughly 170mm = 480pt. 480/6 = 80 chars.
        # Times-Roman 16pt avg char width ~8pt?
        # Width ~160mm = 450pt. 450/8 = 56 chars?
        # Let's try divisor 5.5
        lines = textwrap.wrap(body_text, width=int(text_width/6.0)) # Keeping 6.0 for now, times is narrower than helvetica?
        
        current_y = body_y
        for line in lines:
            c.drawCentredString(center_x, current_y, line)
            current_y -= line_height
            
        # Date (Right aligned)
        # "fecha horrible... cortada" -> Move it away from edge.
        # date_y = current_y - 15*mm # Removed
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(TEXT) 
        date_text = "MILAGRO, 06 Febrero 2026" 
        # c.drawRightString(width - margin_inner - 10*mm, date_y, date_text) # Removed
        # Verify if Date should be strictly right aligned in content or full page?
        # Let's keep it in HEADER alignment for now (indent) or full? 
        # User accepted signature changes (full). Date usually goes with signatures.
        # I'll put Date with signatures below.
        
        # === SIGNATURES ===
        # User: "usa mas espacio a la izquierda" -> Full Width.
        
        sig_y_line = 32*mm 
        
        # Full width for signatures
        sig_area_start_x = margin_inner
        sig_area_width = width - 2*margin_inner
        
        # 3 Columns in full width
        col_width = sig_area_width / 3
        
        # Centers for columns
        x_sig_1 = sig_area_start_x + col_width/2  # Left (Rector)
        x_sig_2 = sig_area_start_x + col_width*1.5 # Center (MUC)
        x_sig_3 = sig_area_start_x + col_width*2.5 # Right (FEUE)
        
        # Draw Signature Block Helper
        def draw_signature_block(x_center, name, cargo, image_field, image_offset_y=0):
            # Draw Image
            if image_field:
                try:
                    img_path = image_field.path
                    if os.path.exists(img_path):
                        # User requested larger signature and "sobre la linea"
                        img_w = 60*mm # Increased from 40mm
                        img_h = 30*mm # Increased from 20mm
                        # Draw slightly lower to sit "on" the line firmly (overlapping slightly if needed)
                        # The line is at sig_y_line. We draw image bottom at sig_y_line - 10mm to create overlap/grounding
                        # assuming signature images have some whitespace. 
                        # Or just sig_y_line if we want it strictly above.
                        # User said "sobre la linea" -> usually implies strictly above or resting on it.
                        # But also "que se redimensione".
                        # Let's align bottom of image with the line roughly.
                        c.drawImage(img_path, x_center - img_w/2, sig_y_line - image_offset_y, width=img_w, height=img_h, mask='auto', preserveAspectRatio=True, anchor='c')
                except Exception:
                    pass
            
            # Line
            # User: "mas grandes esas lineas"
            c.setStrokeColor(ACCENT)
            c.setLineWidth(1.5)
            line_w = 55*mm 
            c.line(x_center - line_w/2, sig_y_line, x_center + line_w/2, sig_y_line) 
            
            # Dots
            c.setFillColor(ACCENT)
            c.circle(x_center - line_w/2, sig_y_line, 1.5*mm, fill=1, stroke=0)
            c.circle(x_center + line_w/2, sig_y_line, 1.5*mm, fill=1, stroke=0)
            
            # Name
            c.setFont("Times-Bold", 11) 
            c.setFillColor(TEXT)
            c.drawCentredString(x_center, sig_y_line - 5*mm, name)
            
            # Cargo
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(TEXT)
            cargo_lines = cargo.split('\n')
            cy = sig_y_line - 10*mm 
            for cline in cargo_lines:
                c.drawCentredString(x_center, cy, cline)
                cy -= 4*mm

        # Draw 3 blocks
        draw_signature_block(x_sig_1, config.firma_1_nombre, config.firma_1_cargo, config.firma_1_imagen)
        draw_signature_block(x_sig_2, config.firma_2_nombre, config.firma_2_cargo, config.firma_2_imagen)
        draw_signature_block(x_sig_3, config.firma_3_nombre, config.firma_3_cargo, config.firma_3_imagen, image_offset_y=8*mm)

        # Draw date near signatures?
        # User: "la fecha debe salir asi al lado derecho y sobre la firma"
        # Align with the 3rd signature (Right/FEUE)
        # Position slightly above the signature image.
        # Signature image max height is 30mm starting at sig_y_line.
        date_y = sig_y_line + 32*mm 
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(x_sig_3, date_y, date_text)

        c.showPage()
        c.save()
        buffer.seek(0)
        
        return buffer
