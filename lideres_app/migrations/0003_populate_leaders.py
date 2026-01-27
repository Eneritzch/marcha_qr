import os
import pandas as pd
from django.db import migrations
from django.conf import settings
from django.contrib.auth.models import User

def populate_leaders_from_excel(apps, schema_editor):
    Lider = apps.get_model('lideres_app', 'Lider')
    User = apps.get_model('auth', 'User')
    
    # Path to Excel file
    excel_path = os.path.join(settings.BASE_DIR, 'static', 'data', '_Fiesta de gala 25 años UNEMI (respuestas).xlsx')
    
    if not os.path.exists(excel_path):
        print(f"Excel file not found at {excel_path}. Skipping initial population.")
        return

    try:
        df = pd.read_excel(excel_path)
        # Using column indices based on previous inspection
        # Col 1: Name, Col 2: Email
        
        for index, row in df.iterrows():
            name = str(row.iloc[1]).strip()
            email = str(row.iloc[2]).strip().lower() # Normalize to lowercase
            
            if not name or not email or '@' not in email:
                continue
                
            # Check for existing user or leader (case-insensitive via lowercase)
            if User.objects.filter(username=email).exists() or Lider.objects.filter(email=email).exists():
                continue
                
            # Create user
            user = User.objects.create_user(
                username=email,
                email=email,
                password='mucunemi25'
            )
            
            # Create leader profile
            Lider.objects.get_or_create(
                user=user,
                defaults={
                    'nombre_completo': name,
                    'cedula': '', # Will be updated later by them
                    'email': email,
                    'grupo': 1, # Default
                    'activo': True,
                    'visible_en_registro': True
                }
            )
        print("Successfully auto-populated leaders from Excel.")
    except Exception as e:
        print(f"Error during initial population: {e}")

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0002_alter_lider_cedula'),
    ]

    operations = [
        migrations.RunPython(populate_leaders_from_excel),
    ]
