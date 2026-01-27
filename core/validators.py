def validar_cedula_ecuatoriana(cedula):
    """
    Algoritmo de validación de cédula ecuatoriana (módulo 10).
    Retorna True si es válida, False en caso contrario.
    """
    if not cedula.isdigit() or len(cedula) != 10:
        return False
    
    provincia = int(cedula[0:2])
    if provincia < 1 or provincia > 24:
        return False
    
    tercer_digito = int(cedula[2])
    if tercer_digito > 5:
        return False
    
    # Coeficientes: 2 1 2 1 2 1 2 1 2
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    suma = 0
    for i in range(9):
        valor = int(cedula[i]) * coeficientes[i]
        if valor >= 10:
            valor -= 9
        suma += valor
    
    digito_verificador = int(cedula[9])
    decena_superior = ((suma // 10) + 1) * 10
    if suma % 10 == 0:
        decena_superior = suma
    
    return (decena_superior - suma) == digito_verificador
