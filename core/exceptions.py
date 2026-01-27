from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # If an unexpected error occurs (500)
    if response is None:
        logger.error(f"Error no manejado: {str(exc)}", exc_info=True)
        return Response({
            'error': 'Ocurrió un error inesperado en el servidor. Por favor, intente más tarde.',
            'detail': str(exc) if True else None  # Set False for hard production
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Standardize error message format for the client
    if response is not None:
        custom_data = {
            'status': 'error',
            'errors': response.data
        }
        
        # Flatten simple validation errors for easier UI display
        if response.status_code == 400:
            custom_data['message'] = "Los datos proporcionados no son válidos."
        
        response.data = custom_data

    return response
