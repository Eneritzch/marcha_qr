import os
import django

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from lideres_app.models import Lider

def ensure_user(username, password, nombre):
    try:
        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        
        action = "created" if created else "updated"
        print(f"User '{username}' {action} with password '{password}'")
        
        # Ensure Lider profile
        lider, l_created = Lider.objects.get_or_create(
            user=user,
            defaults={
                'nombre_completo': nombre,
                'cedula': f"999{username}",  # unique fake cedula
                'grupo': 1,
                'email': f"{username}@test.com",
                'telefono': "0999999999",
                'activo': True,
                'visible_en_registro': True
            }
        )
        if not l_created:
             lider.activo = True
             lider.visible_en_registro = True
             lider.grupo = 1
             lider.save()
             print(f"Lider profile for '{username}' updated.")
        else:
             print(f"Lider profile for '{username}' created.")
             
    except Exception as e:
        print(f"Error processing {username}: {e}")

if __name__ == "__main__":
    print("--- STARTING USER FIX ---")
    ensure_user('admin', '123', 'Administrador Admin')
    ensure_user('prueba', '123', 'Usuario Prueba')
    print("--- DONE ---")
