import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from lideres_app.models import Lider

def debug_users():
    print(f"{'USERNAME':<20} | {'SUPERUSER':<10} | {'LIDER PROFILE':<30} | {'PASSWORD HASH (prefix)'}")
    print("-" * 100)
    for u in User.objects.all():
        lider_str = "None"
        if hasattr(u, 'lider_profile'):
            lider_str = f"{u.lider_profile.nombre_completo} (Grupo {u.lider_profile.grupo})"
        
        print(f"{u.username:<20} | {str(u.is_superuser):<10} | {lider_str:<30} | {u.password[:10]}...")

if __name__ == "__main__":
    debug_users()
