
import os
import django
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from lideres_app.models import Lider

def generate_pdf():
    output_filename = "credenciales_lideres.pdf"
    c = canvas.Canvas(output_filename, pagesize=A4)
    width, height = A4
    
    # Layout Config
    margin_x = 30
    margin_y = 30
    card_width = (width - 3 * margin_x) / 2
    card_height = (height - 3 * margin_y) / 4
    
    # Colors
    c_orange = HexColor("#EF7D00")
    c_blue = HexColor("#004070") # Dark Blue UNEMI-ish
    c_bg = HexColor("#f8fafc")   # Slate-50

    # Fonts
    # Using standard ReportLab fonts for simplicity (Helvetica)
    
    lideres = Lider.objects.filter(activo=True).select_related('user').order_by('grupo', 'nombre_completo')
    
    # Grid Logic
    x_positions = [margin_x, margin_x * 2 + card_width]
    y_positions = [
        height - margin_y - card_height,
        height - margin_y * 2 - card_height * 2,
        height - margin_y * 3 - card_height * 3,
        height - margin_y * 4 - card_height * 4
    ]
    
    idx = 0
    page_count = 0 
    
    for lider in lideres:
        # Page break check
        if idx >= 8: # 4 rows * 2 cols = 8 cards per page
            c.showPage()
            idx = 0
            page_count += 1
            
        col = idx % 2
        row = idx // 2
        
        x = x_positions[col]
        y = y_positions[row]
        
        # Draw Card Background
        c.setFillColor(c_bg)
        c.setStrokeColor(c_blue)
        c.setLineWidth(1)
        c.roundRect(x, y, card_width, card_height, 10, fill=1, stroke=1)
        
        # Header (Orange Bar)
        c.setFillColor(c_orange)
        c.roundRect(x, y + card_height - 30, card_width, 30, 10, fill=1, stroke=0)
        # Fix top corners only... simpler just to draw a rect over the top part 
        # but roundRect is fine for now.
        
        # Title "CREDENCIAL DE ACCESO"
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(x + card_width / 2, y + card_height - 20, "CREDENCIAL DE LÍDER MUC")
        
        # Logo (if exists)
        logo_path = "static/img/icono-orange.png"
        if os.path.exists(logo_path):
             c.drawImage(logo_path, x + 10, y + card_height - 85, width=50, height=50, mask='auto', preserveAspectRatio=True)

        # Leader Name
        c.setFillColor(c_blue)
        c.setFont("Helvetica-Bold", 11)
        text_y = y + card_height - 50
        # Wrap name if too long?
        name = lider.nombre_completo.upper()
        if len(name) > 30:
            name_parts = name.split()
            half = len(name_parts) // 2
            line1 = " ".join(name_parts[:half])
            line2 = " ".join(name_parts[half:])
            c.drawCentredString(x + card_width / 2 + 15, text_y, line1)
            c.drawCentredString(x + card_width / 2 + 15, text_y - 12, line2)
            content_start_y = text_y - 35
        else:
            c.drawCentredString(x + card_width / 2 + 15, text_y, name)
            content_start_y = text_y - 25

        # Group Badge
        c.setFillColor(c_orange)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(x + card_width / 2 + 15, content_start_y, f"GRUPO {lider.grupo}")
        
        # Credentials Box
        box_y = y + 45
        c.setFillColor(HexColor("#e2e8f0"))
        c.roundRect(x + 20, box_y, card_width - 40, 50, 5, fill=1, stroke=0)
        
        c.setFillColor(c_blue)
        c.setFont("Helvetica", 9)
        
        if lider.user:
            username = lider.user.username
            # We assume default password if no custom one logic available.
            # Migration says "mucunemi25".
            password = "**************" # Security practice: don't print passwords? 
            # User explicit request implicates "access credential", usually contains user/pass if generated.
            # Given the context of "generating for passing to them", and default passwords being used...
            # I will print the default password 'mucunemi25' as a hint, or instructions.
            # Let's verify migration again. Migration 3 used 'mucunemi25'.
            # I will print it explicitly.
            password_text = "mucunemi25"
            
            c.drawString(x + 30, box_y + 30, "Usuario:")
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x + 80, box_y + 30, username)
            
            c.setFont("Helvetica", 9)
            c.drawString(x + 30, box_y + 15, "Clave:")
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x + 80, box_y + 15, password_text)
        else:
            c.drawString(x + 30, box_y + 22, "Sin usuario asignado")

        # URL
        c.setFillColor(c_orange)
        c.setFont("Helvetica-Bold", 8)
        url = "marcha-unemi-25.up.railway.app/login/"
        c.drawCentredString(x + card_width / 2, y + 20, url)
        
        idx += 1
        
    c.save()
    print(f"PDF generado exitosamente: {output_filename}")

if __name__ == "__main__":
    generate_pdf()
