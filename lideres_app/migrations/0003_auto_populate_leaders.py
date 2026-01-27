import os
import pandas as pd
from django.db import migrations
from django.conf import settings
from django.contrib.auth.hashers import make_password

def reset_and_populate(apps, schema_editor):
    Lider = apps.get_model('lideres_app', 'Lider')
    Alumno = apps.get_model('alumnos', 'Alumno')
    User = apps.get_model('auth', 'User')
    
    print("Flushing Alumnos and Lideres to prepare for clean slate...")
    # 1. Delete all Alumnos
    Alumno.objects.all().delete()
    
    # 2. Delete all Lideres
    Lider.objects.all().delete()
    
    # 3. Create Superuser (Admin)
    if not User.objects.filter(username='admin').exists():
        User.objects.create(
            username='admin',
            email='admin@unemi.edu.ec',
            password=make_password('mucunemi25'), # Hashed password
            is_superuser=True,
            is_staff=True
        )
        print("Superuser 'admin' created.")
    else:
        print("Superuser 'admin' already exists.")

    # 4. Populate Leaders from Excel
    excel_path = os.path.join(settings.BASE_DIR, 'static', 'data', '_Fiesta de gala 25 años UNEMI (respuestas).xlsx')
    
    if not os.path.exists(excel_path):
        print(f"Excel file not found at {excel_path}. Skipping population.")
        return

    try:
        df = pd.read_excel(excel_path)
        count = 0
        for index, row in df.iterrows():
            try:
                name = str(row.iloc[1]).strip()
                email = str(row.iloc[2]).strip().lower()
                
                if not name or not email or '@' not in email:
                    continue
                    
                # Get or Create User
                if User.objects.filter(username=email).exists():
                    user = User.objects.get(username=email)
                else:
                    user = User.objects.create(
                        username=email,
                        email=email,
                        password=make_password('mucunemi25')
                    )
                
                # Create Leader only if not exists for this user
                if not Lider.objects.filter(user=user).exists():
                    Lider.objects.create(
                        user=user,
                        nombre_completo=name,
                        cedula=None, 
                        email=email,
                        grupo=1,
                        activo=True,
                        visible_en_registro=True
                    )
                    count += 1
                else:
                    print(f"Skipping duplicate leader profile for {email}")

            except Exception as row_err:
                # Log but verify if it's the specific constraint
                continue

        print(f"Clean slate population: {count} leaders created.")
    except Exception as e:
        print(f"Population error: {e}")

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0002_alter_lider_cedula'),
        ('alumnos', '0001_initial'), # Ensure Alumno model is available
    ]

    operations = [
        migrations.RunPython(reset_and_populate),
    ]
