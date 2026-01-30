import multiprocessing
import os

bind = "0.0.0.0:" + os.environ.get("PORT", "8000")
workers = 4  # Ajustado para manejo de concurrencia
threads = 4  # Hilos por worker para manejar I/O (base de datos)
timeout = 120  # Timeout aumentado para reportes largos
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
