release: python manage.py migrate
web: gunicorn config.wsgi --workers 4 --worker-class gthread --threads 100 --worker-tmp-dir /dev/shm --log-file - --timeout 120

