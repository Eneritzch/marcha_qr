from PIL import Image
import os

def make_logo_orange():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'static', 'img', 'icono.webp')
    output_path = os.path.join(base_dir, 'static', 'img', 'icono-orange.png')
    
    # UNEMI Orange
    ORANGE = (239, 125, 0, 255) # #EF7D00 in RGBA

    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        new_data = []
        for item in datas:
            # Change all non-transparent pixels to Orange
            if item[3] > 0:
                new_data.append(ORANGE)
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Successfully created orange logo at: {output_path}")

    except Exception as e:
        print(f"Error creating orange logo: {e}")

if __name__ == "__main__":
    make_logo_orange()
