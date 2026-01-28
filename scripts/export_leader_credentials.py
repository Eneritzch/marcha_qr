from lideres_app.models import Lider
import os

output_file = 'lista_lideres.txt'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(f"{'NOMBRE':<40} | {'USUARIO (EMAIL)':<40} | {'PASSWORD'}\n")
    f.write("-" * 100 + "\n")
    for l in Lider.objects.all():
        f.write(f"{l.nombre_completo:<40} | {l.user.username:<40} | mucunemi25\n")

print(f"Lista generada en {output_file}")
