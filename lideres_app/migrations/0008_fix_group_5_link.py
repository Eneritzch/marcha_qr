
from django.db import migrations

def fix_group_5_link(apps, schema_editor):
    GrupoConfig = apps.get_model('lideres_app', 'GrupoConfig')
    
    # Force update Group 5 with the specific link provided by user
    # ensuring no hidden chars or older expiration
    link = "https://chat.whatsapp.com/FGvYNGzHOMoLnG9adQQogU"
    
    GrupoConfig.objects.update_or_create(
        numero=5,
        defaults={'whatsapp_link': link}
    )

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0007_alter_lider_activo_alter_lider_grupo'),
    ]

    operations = [
        migrations.RunPython(fix_group_5_link),
    ]
