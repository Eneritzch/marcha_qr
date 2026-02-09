from core.models import ConfiguracionCertificado
from rest_framework.test import APIRequestFactory
from core.certificate_views import CertificateConfigView
import os

print("Starting Verification...")

try:
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
    
    if response.status_code == 200:
        keys = response.data.keys()
        print(f"GET Data keys: {list(keys)}")
        
        print(f"Left Logo URL: {response.data.get('logo_izquierda')}")
        print(f"Center Logo URL: {response.data.get('logo_centro')}")
        print(f"Right Logo URL: {response.data.get('logo_derecha')}")

        if response.data.get('logo_izquierda') == '/static/img/muc.png':
            print("SUCCESS: Left logo default is correct.")
        else:
            print(f"FAILURE: Left logo default is {response.data.get('logo_izquierda')}")

    else:
        print("FAILURE: GET request failed.")

except Exception as e:
    print(f"EXCEPTION: {e}")
