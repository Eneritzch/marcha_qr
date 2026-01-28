from django.db import migrations

def populate_whatsapp_links(apps, schema_editor):
    GrupoConfig = apps.get_model('lideres_app', 'GrupoConfig')
    
    links = {
        1: "https://chat.whatsapp.com/GB2eq17U275CYl2KFkxrvH?mode=gi_t",
        2: "https://chat.whatsapp.com/IN5SRnaE7mC5XLtefVyDnq?mode=gi_t",
        3: "https://chat.whatsapp.com/Ku9fEG1IYyrHvhqhMyXuqM?mode=gi_t",
        4: "https://chat.whatsapp.com/HF20TpiGWAB4jQNW9lrDcy?mode=gi_t",
        5: "https://chat.whatsapp.com/Jg4hqvQ5XBhCekP9sRjhcv?mode=gi_t",
        6: "https://chat.whatsapp.com/Cz6PDOssA3N2N35qCIGBaW?mode=gi_t",
        7: "https://chat.whatsapp.com/K1ofEW3cCrO2p2mrq3WSYF?mode=gi_t",
        8: "https://chat.whatsapp.com/Bnhxa08c7oMB4yBMiReChp?mode=gi_t",
        9: "https://chat.whatsapp.com/GmZEA5HAjiH4xkTVPdEWtk?mode=gi_t",
        10: "https://chat.whatsapp.com/GKpA6veGvLTCnqfAU3I066?mode=gi_t",
        11: "https://chat.whatsapp.com/HbYYngvGGCF9hxpTCOrLNk?mode=gi_t",
        12: "https://chat.whatsapp.com/Ga5wW4KmDJgA3PAWPtbHJx?mode=gi_t",
        13: "https://chat.whatsapp.com/FVLzra0wbju9Vj0oEsZlNw?mode=gi_t",
        14: "https://chat.whatsapp.com/LakAcpvtO681Jlf1dQypLn?mode=gi_t",
        15: "https://chat.whatsapp.com/K5fzxG0IV7S4UqZl3XqmXS?mode=gi_t",
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
