
from django.db import migrations

def fix_group_3_link(apps, schema_editor):
    GrupoConfig = apps.get_model('lideres_app', 'GrupoConfig')
    
    # Force update Group 3 with the specific link provided by user
    link = "https://chat.whatsapp.com/H14k1Ss5p4o9NVQJZzDIcC"
    
    GrupoConfig.objects.update_or_create(
        numero=3,
        defaults={'whatsapp_link': link}
    )

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0008_fix_group_5_link'),
    ]

    operations = [
        migrations.RunPython(fix_group_3_link),
    ]
