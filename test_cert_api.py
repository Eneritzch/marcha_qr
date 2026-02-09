import requests
import json
import os
import sys
import django
from django.conf import settings

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import ConfiguracionCertificado
from rest_framework.test import APIRequestFactory
from core.certificate_views import CertificateConfigView

def test_api():
    # Ensure a config exists
    config = ConfiguracionCertificado.get_config()
    print(f"Current Config Title: {config.titulo_certificado}")

    factory = APIRequestFactory()
    view = CertificateConfigView.as_view()

    # Test GET
    print("Testing GET...")
    request = factory.get('/api/v1/certificados/config/')
    response = view(request)
    print(f"GET Status: {response.status_code}")
    print(f"GET Data keys: {response.data.keys()}")
    
    if 'firma_3_nombre' in response.data:
        print("SUCCESS: firma_3_nombre is in response")
    else:
        print("FAILURE: firma_3_nombre missing")

    # Test PUT (Text update)
    print("\nTesting PUT (Text)...")
    data = {'titulo_certificado': 'New Title Test'}
    request = factory.put('/api/v1/certificados/config/', data, format='multipart')
    response = view(request)
    print(f"PUT Status: {response.status_code}")
    
    config.refresh_from_db()
    print(f"New Config Title: {config.titulo_certificado}")
    
    if config.titulo_certificado == 'New Title Test':
        print("SUCCESS: Title updated")
    else:
        print("FAILURE: Title not updated")

    # Revert title
    config.titulo_certificado = 'CERTIFICADO DE PARTICIPACIÓN'
    config.save()

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"Error: {e}")
