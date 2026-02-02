from django.db import migrations


def noop(apps, schema_editor):
    """
    Migración de marcador - No ejecuta redistribución automática.
    La redistribución se hace manualmente a través del dashboard o CLI.
    """
    pass


def noop_reverse(apps, schema_editor):
    """Reversión de no-op"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0010_force_update_all_links'),
    ]

    operations = [
        migrations.RunPython(noop, noop_reverse),
    ]
