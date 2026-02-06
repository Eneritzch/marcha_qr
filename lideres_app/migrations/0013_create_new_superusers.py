from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_superusers(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    
    users_to_create = [
        {'username': 'admin2', 'password': 'mucunemi25'},
        {'username': 'adminjc', 'password': 'mucunemi25'},
    ]

    for user_data in users_to_create:
        if not User.objects.filter(username=user_data['username']).exists():
            User.objects.create(
                username=user_data['username'],
                password=make_password(user_data['password']),
                is_superuser=True,
                is_staff=True,
                email=f"{user_data['username']}@example.com" # Placeholder email
            )
            print(f"Superuser '{user_data['username']}' created successfully.")
        else:
            print(f"Superuser '{user_data['username']}' already exists.")

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0012_configuracionescaneo'), 
    ]

    operations = [
        migrations.RunPython(create_superusers),
    ]
