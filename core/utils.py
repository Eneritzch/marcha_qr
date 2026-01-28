import qrcode
from io import BytesIO
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont
import os

class QRGenerator:
    @staticmethod
    def generate_qr_bytes(data):
        """Generates a Dual-Tone QR code: Blue Body, Orange Eyes."""
        # 1. Generate QR
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(data)
        qr.make(fit=True)

        # 2. Custom Coloring Logic
        # We need to access the matrix to color eyes differently
        matrix = qr.get_matrix()
        qr_size = len(matrix)
        
        # Create blank image
        box_size = 10
        border = 2
        img_size = (qr_size + border * 2) * box_size
        img = Image.new("RGB", (img_size, img_size), "white")
        draw = ImageDraw.Draw(img)

        # Colors
        BLUE = "#0F1E4B"
        ORANGE = "#EF7D00"

        # Helper to check if pixel is part of finder pattern (Eye)
        # Eyes are 7x7 at corners. Structure:
        # Outer 7x7 Ring (Black/Blue)
        # Inner 5x5 Ring (White)
        # Center 3x3 Box (Black/Blue - ORANGE here)
        
        def get_pixel_color(r, c):
             # Check if in top-left, top-right, or bottom-left 7x7 zone
             in_top_left = r < 7 and c < 7
             in_top_right = r < 7 and c >= qr_size - 7
             in_bottom_left = r >= qr_size - 7 and c < 7
             
             if in_top_left or in_top_right or in_bottom_left:
                 # We are in an Eye Zone.
                 # Normalize coordinates to 0..6 inside the eye
                 if in_top_left: nr, nc = r, c
                 elif in_top_right: nr, nc = r, c - (qr_size - 7)
                 elif in_bottom_left: nr, nc = r - (qr_size - 7), c
                 
                 # Logic for 7x7 Finder Pattern:
                 # 0 and 6 are Borders (Outer Ring) -> BLUE
                 # 1 and 5 are White Spacers -> WHITE (Handled by matrix=0 usually, but if 1, force BLUE/ORANGE?)
                 # 2, 3, 4 are Inner Box -> ORANGE
                 
                 if 2 <= nr <= 4 and 2 <= nc <= 4:
                     return ORANGE # Center Pupil
                 
                 return BLUE # Outer Ring
             
             return BLUE # Normal Data Module

        for r in range(qr_size):
            for c in range(qr_size):
                if matrix[r][c]: # If pixel is black (data)
                    x = (c + border) * box_size
                    y = (r + border) * box_size
                    color = get_pixel_color(r, c)
                    draw.rectangle([x, y, x + box_size - 1, y + box_size - 1], fill=color)

        img_qr = img
        
        # 3. Embed Logo
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'icono.webp')
        
        if os.path.exists(logo_path):
            try:
                logo = Image.open(logo_path)
                
                # Calculate size (reduced to 12% for maximum scan speed/reliability)
                logo_size = int(img_qr.size[0] * 0.12)
                logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
                
                # Calculate position (Center)
                pos = ((img_qr.size[0] - logo.size[0]) // 2, (img_qr.size[1] - logo.size[1]) // 2)
                
                # Create a whitespace background for the logo
                bg_size = (logo.size[0] + 6, logo.size[1] + 6)
                logo_bg = Image.new('RGB', bg_size, 'white')
                bg_pos = (pos[0] - 3, pos[1] - 3)
                
                img_qr.paste(logo_bg, bg_pos)
                
                # Paste logo (handle transparency if PNG)
                if logo.mode == 'RGBA':
                     img_qr.paste(logo, pos, mask=logo)
                else:
                     img_qr.paste(logo, pos)
            except Exception as e:
                print(f"Error loading logo: {e}")

        # 4. Save to Buffer
        buffer = BytesIO()
        img_qr.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer
