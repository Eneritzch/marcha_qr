import pandas as pd
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from lideres_app.models import Lider
import os

class Command(BaseCommand):
    help = 'Import leaders from Excel with specific credentials'

    def handle(self, *args, **options):
        # Use absolute path as provided by user
        file_path = r'C:\Users\karel\OneDrive\Desktop\asistencias\static\data\_Fiesta de gala 25 años UNEMI (respuestas).xlsx'
        
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        try:
            # Read excel
            df = pd.read_excel(file_path)
            
            # Based on inspection:
            # Index 1: Name
            # Index 2: Email
            name_col = df.columns[1]
            email_col = df.columns[2]
            
            self.stdout.write(f"Using columns: '{name_col}' for names and '{email_col}' for emails.")

            # Deduplicate by name and email
            initial_count = len(df)
            df = df.drop_duplicates(subset=[name_col, email_col])
            self.stdout.write(f"Removed {initial_count - len(df)} duplicate rows from Excel.")

            count = 0
            skipped = 0
            
            for index, row in df.iterrows():
                name = str(row[name_col]).strip()
                email = str(row[email_col]).strip().lower()
                
                if not email or email == 'nan' or '@' not in email:
                    skipped += 1
                    continue
                
                # Check for existing user or leader
                if User.objects.filter(email=email).exists() or Lider.objects.filter(email=email).exists():
                    self.stdout.write(self.style.WARNING(f"Skipping {name} ({email}) - Already exists"))
                    skipped += 1
                    continue
                
                try:
                    # Create Lider (the updated save() method handles user creation with email as username and 'mucunemi25' as password)
                    lider = Lider(
                        nombre_completo=name,
                        email=email,
                        grupo=1 # Default group, user will change it later
                    )
                    lider.save()
                    
                    count += 1
                    self.stdout.write(self.style.SUCCESS(f"Imported: {name} ({email})"))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error importing {name}: {e}"))
                    skipped += 1

            self.stdout.write(self.style.SUCCESS(f"\nFinal Summary:"))
            self.stdout.write(self.style.SUCCESS(f"- Successfully imported: {count}"))
            self.stdout.write(self.style.WARNING(f"- Skipped: {skipped}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Critical error: {e}"))
