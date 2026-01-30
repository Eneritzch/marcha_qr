import os
import sys
import re
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from lideres_app.models import GrupoConfig

def verify_and_update_links():
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'whatsapp.txt')
    
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    print(f"Reading from {file_path}...")
    
    updated_count = 0
    created_count = 0
    verified_count = 0
    
    with open(file_path, 'r') as f:
        lines = f.readlines()

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Parse line: BLOQUE 10 https://...
        match = re.search(r'BLOQUE\s+(\d+)\s+(https://\S+)', line)
        if match:
            group_num = int(match.group(1))
            link = match.group(2)
            
            try:
                config, created = GrupoConfig.objects.get_or_create(
                    numero=group_num,
                    defaults={'whatsapp_link': link}
                )
                
                if created:
                    print(f"[CREATED] Grupo {group_num}: {link}")
                    created_count += 1
                else:
                    if config.whatsapp_link != link:
                        print(f"[UPDATE] Grupo {group_num}:")
                        print(f"  Old: {config.whatsapp_link}")
                        print(f"  New: {link}")
                        config.whatsapp_link = link
                        config.save()
                        updated_count += 1
                    else:
                        print(f"[OK] Grupo {group_num} matches.")
                        verified_count += 1
                        
            except Exception as e:
                print(f"[ERROR] processing Grupo {group_num}: {e}")
        else:
            print(f"[WARNING] Could not parse line: {line}")

    print("\nSummary:")
    print(f"Verified: {verified_count}")
    print(f"Updated: {updated_count}")
    print(f"Created: {created_count}")

if __name__ == "__main__":
    verify_and_update_links()
