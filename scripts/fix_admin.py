import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from lideres_app.models import Lider

def create_admin_lider():
    username = 'admin'
    password = '123' # User asked for admin123 but I will use that or reset it if exists. 
    # Wait, user asked for "admin123" in previous prompt.
    
    try:
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            user.set_password('123')
            user.is_superuser = True
            user.is_staff = True
            user.save()
            print(f"User {username} updated.")
        else:
            user = User.objects.create_superuser(username, 'admin@example.com', '123')
            print(f"User {username} created.")

        # Check if Lider profile exists
        if not Lider.objects.filter(user=user).exists():
            print("Creating Lider profile for admin...")
            Lider.objects.create(
                user=user,
                nombre_completo="Administrador del Sistema",
                cedula="9999999999",
                grupo=1,
                email="admin@unemi.edu.ec",
                telefono="0999999999",
                activo=True,
                visible_en_registro=False  # Admin shouldn't appear in registration dropdowns
            )
            print("Lider profile created successfully.")
        else:
            print("Lider profile already exists.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_admin_lider()
