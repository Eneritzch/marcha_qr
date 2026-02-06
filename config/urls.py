from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from alumnos.excel_import_export_views import ExcelImportExportView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API V1
    path('api/v1/alumnos/', include('alumnos.urls')),
    path('api/v1/lideres/', include('lideres_app.urls')),
    path('api/v1/sorteos/', include('sorteos.urls')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Frontend Views (Clean Architecture)
    path('login/', TemplateView.as_view(template_name='lideres/login.html'), name='login'),
    path('dashboard/', TemplateView.as_view(template_name='lideres/dashboard.html'), name='dashboard'),
    path('importar-exportar/', ExcelImportExportView.as_view(), name='importar-exportar'),
    # path('registro/', TemplateView.as_view(template_name='alumnos/registro_cerrado.html'), name='registro'),
    # path('recuperar/', TemplateView.as_view(template_name='alumnos/recuperar.html'), name='recuperar'),
    path('', TemplateView.as_view(template_name='alumnos/landing.html'), name='home'),
    
    # PWA Service Worker & Manifest served from root
    path('sw.js', TemplateView.as_view(template_name='sw.js', content_type='application/javascript'), name='sw.js'),
    path('manifest.json', TemplateView.as_view(template_name='manifest.json', content_type='application/json'), name='manifest.json'),
]




if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
