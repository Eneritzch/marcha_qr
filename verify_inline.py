from django.test import RequestFactory
from core.certificate_views import CertificateDescargarView
from alumnos.models import Alumno
from django.urls import reverse
import os
import django

# Setup (if run standalone, though shell is better)
# But we will run via manage.py shell
print("Verifying PDF Content-Disposition...")

try:
    # 1. Create a dummy request
    factory = RequestFactory()
    request = factory.get('/fake-url')
    
    # 2. Get a real student
    alumno = Alumno.objects.first()
    if not alumno:
        print("WARNING: No students found. Creating dummy.")
        try:
             alumno = Alumno.objects.create(cedula='9999999999', nombre_completo='Test User', email='test@test.com')
        except:
             pass

    if alumno:
        view = CertificateDescargarView.as_view()
        response = view(request, cedula=alumno.cedula)
        
        disp = response.get('Content-Disposition', '')
        print(f"Content-Disposition: {disp}")
        
        if 'inline' in disp:
             print("SUCCESS: Header contains 'inline'")
        else:
             print("FAILURE: Header does NOT contain 'inline'")
    else:
        print("FAILURE: Could not test without student.")

except Exception as e:
    print(f"ERROR: {e}")
