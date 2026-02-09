import os
import sys
import django
from datetime import date

# Setup Django environment
sys.path.append('C:\\Users\\karel\\OneDrive\\Desktop\\asistencias')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.certificate_generator import CertificateGenerator

class DummyAlumno:
    def __init__(self):
        self.id = 12345
        self.nombre_completo = "Juan Perez Estudiante"

def test_generation():
    print("Generating certificate for dummy student...")
    alumno = DummyAlumno()
    
    try:
        buffer = CertificateGenerator.generate_certificate(alumno)
        output_path = 'test_certificate.pdf'
        with open(output_path, 'wb') as f:
            f.write(buffer.getvalue())
        print(f"Success! Certificate saved to {output_path}")
    except Exception as e:
        print(f"Error generating certificate: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_generation()
