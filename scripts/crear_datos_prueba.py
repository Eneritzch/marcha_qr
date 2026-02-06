"""
Script para crear 100 registros de prueba para el sistema de sorteos.
Ejecutar con: python manage.py shell < scripts/crear_datos_prueba.py
O también: python scripts/crear_datos_prueba.py
"""
import os
import sys
import django
import random
from datetime import datetime, timedelta

# Setup Django si se ejecuta como script independiente
if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

from alumnos.models import Alumno

# Datos de prueba
NOMBRES = [
    "Juan", "María", "Carlos", "Ana", "Pedro", "Laura", "Miguel", "Sofía", 
    "José", "Carmen", "Luis", "Elena", "Fernando", "Isabel", "Ricardo", "Paula",
    "Andrés", "Gabriela", "Diego", "Valentina", "Roberto", "Daniela", "Alejandro", "Camila",
    "Eduardo", "Natalia", "Francisco", "Andrea", "Sergio", "Lucía"
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez", "Sánchez",
    "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Reyes", "Cruz",
    "Morales", "Ortiz", "Gutiérrez", "Chávez", "Ramos", "Vargas", "Castillo", "Jiménez",
    "Mendoza", "Ruiz", "Álvarez", "Romero", "Herrera", "Medina"
]

CARRERAS = [
    "Ingeniería en Sistemas", "Medicina", "Derecho", "Psicología", "Administración",
    "Contabilidad", "Enfermería", "Comunicación Social", "Ingeniería Civil", "Arquitectura"
]

def generar_cedula():
    """Genera cédula ecuatoriana aleatoria válida (10 dígitos)"""
    provincia = random.randint(1, 24)
    resto = random.randint(1000000, 9999999)
    return f"{provincia:02d}{resto}"

def crear_registros_prueba(cantidad=100):
    """Crea registros de prueba para el sorteo"""
    
    print(f"\n🎲 Creando {cantidad} registros de prueba para sorteos...\n")
    
    creados = 0
    existentes = 0
    
    for i in range(cantidad):
        nombre = random.choice(NOMBRES)
        apellido1 = random.choice(APELLIDOS)
        apellido2 = random.choice(APELLIDOS)
        nombre_completo = f"{nombre} {apellido1} {apellido2}"
        
        # Generar cédula única
        while True:
            cedula = generar_cedula()
            if not Alumno.objects.filter(cedula=cedula).exists():
                break
        
        email = f"{nombre.lower()}.{apellido1.lower()}{random.randint(1, 999)}@test.com"
        telefono = f"09{random.randint(10000000, 99999999)}"
        
        # Fechas de inicio y fin
        fecha_base = datetime.now() - timedelta(hours=random.randint(1, 48))
        fecha_inicio = fecha_base
        fecha_fin = fecha_base + timedelta(hours=random.randint(1, 4))
        
        try:
            alumno = Alumno.objects.create(
                cedula=cedula,
                nombre_completo=nombre_completo,
                email=email,
                telefono=telefono,
                carrera=random.choice(CARRERAS),
                es_externo=random.random() < 0.2,  # 20% externos
                grupo=random.randint(1, 15),
                ha_iniciado=True,
                ha_finalizado=True,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin
            )
            creados += 1
            if creados % 10 == 0:
                print(f"  ✅ Creados: {creados}/{cantidad}")
        except Exception as e:
            print(f"  ⚠️ Error creando registro: {e}")
            existentes += 1
    
    print(f"\n" + "="*50)
    print(f"✅ Registros creados: {creados}")
    print(f"⚠️ Errores/Existentes: {existentes}")
    print(f"📊 Total alumnos en BD: {Alumno.objects.count()}")
    print(f"🎯 Elegibles para sorteo: {Alumno.objects.filter(ha_iniciado=True, ha_finalizado=True).count()}")
    print("="*50 + "\n")

if __name__ == "__main__":
    crear_registros_prueba(100)
