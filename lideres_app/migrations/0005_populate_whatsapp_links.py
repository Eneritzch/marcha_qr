from django.db import migrations

def populate_whatsapp_links(apps, schema_editor):
    GrupoConfig = apps.get_model('lideres_app', 'GrupoConfig')
    
    links = {
        1: "https://chat.whatsapp.com/HbYYngvGGCF9hxpTCOrLNk?mode=gi_t",
        2: "https://chat.whatsapp.com/IN5SRnaE7mC5XLtefVyDnq",
        3: "https://chat.whatsapp.com/H14k1Ss5p4o9NVQJZzDIcC",
        4: "https://chat.whatsapp.com/HF20TpiGWAB4jQNW9lrDcy",
        5: "https://chat.whatsapp.com/FGvYNGzHOMoLnG9adQQogU",
        6: "https://chat.whatsapp.com/Cz6PDOssA3N2N35qCIGBaW?mode=gi_t",
        7: "https://chat.whatsapp.com/LRZ8PFF65unDRgAcvjrbGL",
        8: "https://chat.whatsapp.com/Bnhxa08c7oMB4yBMiReChp?mode=gi_t",
        9: "https://chat.whatsapp.com/GmZEA5HAjiH4xkTVPdEWtk",
        10: "https://chat.whatsapp.com/GKpA6veGvLTCnqfAU3I066",
        11: "https://chat.whatsapp.com/BQbK2FbUsNAAvE0cq7c4AU",
        12: "https://chat.whatsapp.com/JLpqR4UAuig6Tirkr6oL6r",
        13: "https://chat.whatsapp.com/FVLzra0wbju9Vj0oEsZlNw",
        14: "https://chat.whatsapp.com/JmlGSJD2xGb1Sn45GOj0uX",
        15: "https://chat.whatsapp.com/EiSZvJ9eozn9nxPTg1LlFM",
    }
    
    for numero, link in links.items():
        GrupoConfig.objects.update_or_create(
            numero=numero,
            defaults={'whatsapp_link': link}
        )

def remove_whatsapp_links(apps, schema_editor):
    GrupoConfig = apps.get_model('lideres_app', 'GrupoConfig')
    GrupoConfig.objects.all().delete()

class Migration(migrations.Migration):

    dependencies = [
        ('lideres_app', '0004_grupoconfig_alter_lider_grupo'),
    ]

    operations = [
        migrations.RunPython(populate_whatsapp_links, remove_whatsapp_links),
    ]
