
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.certificate_generator import CertificateGenerator
from core.certificate_config import ConfiguracionCertificado
from alumnos.models import Alumno

def verify_final_layout():
    print("Verifying Final Layout...")
    alumno, _ = Alumno.objects.get_or_create(cedula="9999999999", defaults={"nombre_completo": "Test Final Layout", "email": "final@test.com", "grupo": 1})
    config = ConfiguracionCertificado.get_config()
    
    try:
        pdf = CertificateGenerator.generate_certificate(alumno, config)
        output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_final_layout.pdf")
        with open(output_path, "wb") as f:
            f.write(pdf.getbuffer())
        print(f"Success! Saved test_final_layout.pdf ({os.path.getsize(output_path)} bytes)")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_final_layout()
