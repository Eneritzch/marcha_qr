from PIL import Image, ImageOps
import os

def create_pwa_icon():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'static', 'img', 'icono-orange.png')
    output_path = os.path.join(base_dir, 'static', 'img', 'pwa-icon.png')
    
    # UNEMI Colors
    BLUE = "#0F1E4B"
    # ORANGE = "#EF7D00" 

    try:
        # Load Logo
        logo = Image.open(input_path).convert("RGBA")
        
        # Create Background
        # Standard PWA size is 512x512
        icon_size = (512, 512)
        background = Image.new("RGBA", icon_size, BLUE)
        
        # Resize logo to fit nicely (e.g., 85% of the icon size - Larger as requested)
        logo_ratio = logo.width / logo.height
        target_h = int(icon_size[1] * 0.85)
        target_w = int(target_h * logo_ratio)
        
        logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Center the logo
        offset = ((icon_size[0] - target_w) // 2, (icon_size[1] - target_h) // 2)
        
        # Paste logo onto background (using alpha channel as mask)
        background.paste(logo, offset, logo)
        
        # Save
        background.save(output_path, "PNG")
        print(f"Successfully created PWA icon at: {output_path}")
        
    except Exception as e:
        print(f"Error creating icon: {e}")

if __name__ == "__main__":
    create_pwa_icon()
