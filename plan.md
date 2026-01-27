# 📋 PLAN DE TRABAJO ACTUALIZADO: Sistema Marcha UNEMI con Líderes y Grupos

## 🎯 NUEVOS REQUERIMIENTOS

### **Cambios Principales:**
1. ✅ Sistema de **Líderes y Grupos** (4 grupos)
2. ✅ Cada alumno debe **seleccionar quién lo invitó** (líder)
3. ✅ Alumno se asigna automáticamente al **grupo del líder**
4. ✅ **27 líderes predefinidos** editables por admin
5. ✅ Nuevo módulo: **"Mis Credenciales"** para recuperar QR
6. ✅ Alumno ingresa su **cédula** → regenera y descarga QR
7. ✅ QR temporal (se genera, se descarga, se elimina)

---

## 🏗️ ARQUITECTURA ACTUALIZADA

### **Nuevos Componentes del Sistema**

```
FRONTEND (Web Móvil)
├── Página Principal
│   ├── [REGISTRARME] → Formulario de registro
│   ├── [MIS CREDENCIALES] → Recuperar QR
│   └── [SOY LÍDER] → Login de líderes
│
├── Registro (3 FASES)
│   ├── FASE 1: Datos personales + académicos
│   ├── FASE 1.5: Selección de líder que lo invitó ⭐ NUEVO
│   └── FASE 2: Datos bancarios (opcional)
│
└── Mis Credenciales ⭐ NUEVO
    ├── Ingreso de cédula
    ├── Validación y búsqueda
    ├── Regeneración de QR
    └── Descarga PDF/PNG

BACKEND
├── Modelo: Líder ⭐ NUEVO
│   ├── Nombre
│   ├── Grupo (1, 2, 3, 4)
│   ├── Activo/Inactivo
│   └── Contador de invitados
│
├── Modelo: Alumno (MODIFICADO)
│   ├── ... campos existentes
│   ├── lider_invitador_id (FK → Líder) ⭐ NUEVO
│   └── grupo (heredado del líder) ⭐ NUEVO
│
└── Módulo: Recuperación de Credenciales ⭐ NUEVO
    ├── Vista de búsqueda por cédula
    ├── Generación temporal de QR
    └── Auto-eliminación tras descarga

ADMINISTRACIÓN
└── Django Admin: Gestión de 27 Líderes
    ├── Crear líderes iniciales
    ├── Editar información
    ├── Asignar a grupos
    └── Activar/desactivar
```

---

## 🗃️ MODELOS DE BASE DE DATOS ACTUALIZADOS

### **NUEVA TABLA: Líder**

```sql
┌──────────────────────────────────────────────────────┐
│ Lider                                                │
├──────────────────────────────────────────────────────┤
│ id (PK)                  │ AutoField                 │
│                          │                           │
│ ═══ INFORMACIÓN PERSONAL ═══                         │
│ nombre_completo          │ CharField(150)            │
│ cedula                   │ CharField(10, unique)     │
│ email                    │ EmailField(null=True)     │
│ telefono                 │ CharField(10, null=True)  │
│                          │                           │
│ ═══ GRUPO Y ESTADO ═══                               │
│ grupo                    │ IntegerField()            │ ← 1, 2, 3, 4
│                          │   Choices:                │
│                          │   - GRUPO_1               │
│                          │   - GRUPO_2               │
│                          │   - GRUPO_3               │
│                          │   - GRUPO_4               │
│ activo                   │ BooleanField()            │ ← True/False
│                          │                           │
│ ═══ ESTADÍSTICAS ═══                                 │
│ total_invitados          │ IntegerField(default=0)   │ ← Calculado
│ fecha_creacion           │ DateTimeField()           │
│                          │                           │
│ ═══ ORDEN Y DISPLAY ═══                              │
│ orden                    │ IntegerField(default=0)   │ ← Para ordenar
│ visible_en_registro      │ BooleanField(default=True)│ ← Mostrar/ocultar
└──────────────────────────────────────────────────────┘

Índices:
- cedula (UNIQUE)
- grupo (INDEX) → Filtros rápidos
- activo (INDEX) → Solo mostrar activos
- orden (INDEX) → Ordenamiento en select

Métodos:
- contar_invitados() → Cuenta alumnos asociados
- __str__() → "Ronny Pérez - Grupo 2"
```

### **TABLA MODIFICADA: Alumno**

```sql
┌──────────────────────────────────────────────────────┐
│ Alumno (ACTUALIZADO)                                 │
├──────────────────────────────────────────────────────┤
│ ... [campos existentes] ...                          │
│                                                      │
│ ═══ NUEVOS CAMPOS ═══                                │
│ lider_invitador_id (FK)  │ ForeignKey → Lider       │ ⭐ NUEVO
│ grupo                    │ IntegerField()            │ ⭐ NUEVO
│                          │   (copiado del líder)     │
│                          │                           │
│ ═══ CAMPOS EXISTENTES ═══                            │
│ codigo_qr                │ CharField(10) UNIQUE      │
│ nombre_completo          │ CharField(150)            │
│ cedula                   │ CharField(10) UNIQUE      │
│ email                    │ EmailField()              │
│ telefono                 │ CharField(10)             │
│ modalidad                │ CharField(20)             │
│ facultad                 │ CharField(100, null)      │
│ carrera                  │ CharField(150)            │
│ asistio                  │ BooleanField()            │
│ fecha_registro           │ DateTimeField()           │
│ fecha_asistencia         │ DateTimeField(null)       │
│ registrado_por           │ CharField(50, null)       │
│ cuenta_bancaria_id (FK)  │ OneToOne → CuentaBancaria │
└──────────────────────────────────────────────────────┘

Restricciones:
- lider_invitador_id es OBLIGATORIO
- grupo se asigna automáticamente del líder
- grupo debe coincidir con grupo del líder

Métodos:
- asignar_grupo() → Copia grupo del líder
- get_nombre_lider() → Retorna nombre del líder
- get_grupo_display() → "Grupo 2"
```

### **NUEVA TABLA: QRTemporal** ⭐ (OPCIONAL - Para limpieza)

```sql
┌──────────────────────────────────────────────────────┐
│ QRTemporal (OPCIONAL)                                │
├──────────────────────────────────────────────────────┤
│ id (PK)                  │ AutoField                 │
│ alumno_id (FK)           │ ForeignKey → Alumno       │
│ archivo_path             │ CharField(255)            │
│ fecha_generacion         │ DateTimeField()           │
│ descargado               │ BooleanField(default=False)│
│ fecha_descarga           │ DateTimeField(null=True)  │
└──────────────────────────────────────────────────────┘

Uso:
- Registrar QRs generados temporalmente
- Limpiar archivos antiguos (>24 horas)
- Comando cron: python manage.py limpiar_qrs_temporales
```

---

## 🎨 FLUJOS DE USUARIO ACTUALIZADOS

### **FLUJO 1: Página Principal (HOME)**

```
┌──────────────────────────────────────────────────────┐
│            🎓 MARCHA UNEMI 25 AÑOS 🎓               │
│                                                      │
│                  [Logo UNEMI]                        │
│                                                      │
│        ¡Únete a la celebración histórica!           │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🆕 ¿AÚN NO TE HAS REGISTRADO?                      │
│                                                      │
│     📝 [REGISTRARME AHORA]                          │
│        Completa tu registro en 2 pasos              │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  ✅ ¿YA ESTÁS REGISTRADO?                           │
│                                                      │
│     🎫 [MIS CREDENCIALES] ⭐ NUEVO                   │
│        Recupera tu código QR                        │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  👥 ¿ERES LÍDER?                                    │
│                                                      │
│     🔐 [ACCESO DE LÍDERES]                          │
│        Panel de control y scanner                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### **FLUJO 2: Registro ACTUALIZADO (Ahora 3 fases efectivas)**

#### **FASE 1: Datos Personales y Académicos (SIN CAMBIOS)**

```
[Igual que antes]
- Nombre completo
- Cédula
- Email
- Teléfono
- Modalidad → Facultad (si aplica) → Carrera

Botón: [Continuar →]
```

#### **FASE 1.5: Selección de Líder** ⭐ NUEVO

```
Al hacer clic en "Continuar" de Fase 1 → Aparece:

┌──────────────────────────────────────────────────────┐
│  REGISTRO - PASO 2 DE 3                              │
│  ¿Quién te invitó a participar?                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  👥 SELECCIONA TU LÍDER                              │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  Líder que te invitó: [▼ Seleccione...] *          │
│                                                      │
│  [Lista de 27 líderes agrupados por grupo]          │
│                                                      │
│  ┌─────────────────────────────────────────┐        │
│  │ GRUPO 1                                 │        │
│  │ ├─ Ronny Pérez                          │        │
│  │ ├─ María González                       │        │
│  │ └─ Carlos Ruiz                          │        │
│  │                                         │        │
│  │ GRUPO 2                                 │        │
│  │ ├─ Andrea López                         │        │
│  │ ├─ Juan Martínez                        │        │
│  │ └─ ...                                  │        │
│  │                                         │        │
│  │ GRUPO 3                                 │        │
│  │ └─ ...                                  │        │
│  │                                         │        │
│  │ GRUPO 4                                 │        │
│  │ └─ ...                                  │        │
│  └─────────────────────────────────────────┘        │
│                                                      │
│  ℹ️  Serás asignado automáticamente al grupo        │
│     de tu líder.                                    │
│                                                      │
│  ← [Regresar]    [Continuar a datos bancarios →]   │
│                                                      │
└──────────────────────────────────────────────────────┘

Lógica del Select:
─────────────────────────────────────────────────────
<select id="lider" name="lider" required>
  <option value="">Seleccione quién lo invitó...</option>
  
  <optgroup label="━━━ GRUPO 1 ━━━">
    <option value="1">Ronny Pérez - Grupo 1</option>
    <option value="2">María González - Grupo 1</option>
    <option value="3">Carlos Ruiz - Grupo 1</option>
  </optgroup>
  
  <optgroup label="━━━ GRUPO 2 ━━━">
    <option value="8">Andrea López - Grupo 2</option>
    <option value="9">Juan Martínez - Grupo 2</option>
  </optgroup>
  
  <optgroup label="━━━ GRUPO 3 ━━━">
    <option value="15">Luis Morales - Grupo 3</option>
  </optgroup>
  
  <optgroup label="━━━ GRUPO 4 ━━━">
    <option value="22">Patricia Vega - Grupo 4</option>
  </optgroup>
</select>

JavaScript:
───────────
- Select agrupado con <optgroup>
- Solo muestra líderes activos (visible_en_registro=True)
- Ordenados por grupo y luego por nombre
- Al seleccionar, guarda en sesión:
  * lider_id
  * grupo (heredado automáticamente)
```

#### **FASE 2: Datos Bancarios (SIN CAMBIOS)**

```
[Igual que antes]
- Opcional
- Datos del titular
- Banco, tipo de cuenta, número
- Es mi cuenta / Es de un familiar

Botón: [FINALIZAR REGISTRO]
```

#### **Guardado Final**

```
Al hacer clic en "FINALIZAR REGISTRO":

1. Recupera datos de todas las fases desde sesión
2. Crea registro en tabla Alumno:
   - Genera código único: UNM2025001
   - Asigna lider_invitador_id
   - Copia grupo del líder → alumno.grupo
3. Si registró cuenta, crea CuentaBancaria
4. Actualiza contador: lider.total_invitados += 1
5. Redirige a página de éxito con QR
```

---

### **FLUJO 3: MIS CREDENCIALES (Recuperación de QR)** ⭐ NUEVO

```
1. Usuario hace clic en "MIS CREDENCIALES" desde home

2. Aparece formulario simple:

┌──────────────────────────────────────────────────────┐
│  🎫 MIS CREDENCIALES                                 │
│  Recupera tu código QR                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📋 INGRESA TU INFORMACIÓN                           │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  Cédula: [__________] *                             │
│          (10 dígitos)                                │
│                                                      │
│  [🔍 BUSCAR MIS CREDENCIALES]                       │
│                                                      │
│  ℹ️  Ingresa la cédula que usaste al registrarte    │
│                                                      │
│  ← [Volver al inicio]                               │
│                                                      │
└──────────────────────────────────────────────────────┘

3. Usuario ingresa cédula y hace clic en "BUSCAR"

4. BACKEND valida:
   ✓ Cédula válida (10 dígitos)
   ✓ Busca en BD: Alumno.objects.get(cedula=cedula)

5. CASO A: Alumno NO encontrado
   
   ┌──────────────────────────────────────────────┐
   │  ❌ NO ENCONTRADO                            │
   ├──────────────────────────────────────────────┤
   │  No encontramos ningún registro con la       │
   │  cédula ingresada.                           │
   │                                              │
   │  ¿Quizás aún no te has registrado?          │
   │                                              │
   │  [Registrarme ahora]  [Intentar de nuevo]   │
   └──────────────────────────────────────────────┘

6. CASO B: Alumno ENCONTRADO
   
   Redirige a: /credenciales/mostrar/<cedula>/
   
   ┌──────────────────────────────────────────────────┐
   │  ✅ ¡CREDENCIALES ENCONTRADAS!                   │
   ├──────────────────────────────────────────────────┤
   │                                                  │
   │  👤 Juan Pérez Gómez                             │
   │  🎓 Ing. en Software - FACI                      │
   │  👥 Líder: Ronny Pérez (Grupo 2)                │
   │  🆔 Código: UNM2025001                           │
   │                                                  │
   │  ┌────────────────┐                              │
   │  │                │                              │
   │  │   [QR CODE]    │ ← Generado dinámicamente    │
   │  │   UNM2025001   │                              │
   │  │                │                              │
   │  └────────────────┘                              │
   │                                                  │
   │  📥 DESCARGA TU CÓDIGO QR:                       │
   │                                                  │
   │  📄 [Descargar PDF]                              │
   │  🖼️  [Descargar Imagen PNG]                     │
   │                                                  │
   │  ⚠️  IMPORTANTE:                                 │
   │  • Este código QR es temporal                   │
   │  • Descárgalo ahora si lo necesitas             │
   │  • Podrás volver a generarlo cuando quieras     │
   │                                                  │
   │  [← Volver al inicio]                           │
   │                                                  │
   └──────────────────────────────────────────────────┘

7. Lógica de QR Temporal:
   
   Opción A (SIMPLE - RECOMENDADA):
   ───────────────────────────────────
   - NO guardar archivo en servidor
   - Generar QR on-the-fly cada vez
   - Servir directamente en HTTP response
   - No hay limpieza necesaria
   
   Proceso:
   1. Usuario solicita PDF/PNG
   2. Backend genera QR en memoria (BytesIO)
   3. Retorna archivo como descarga
   4. No se guarda nada en disco
   
   Opción B (CON LIMPIEZA):
   ───────────────────────────────────
   - Guardar en /media/qr_temporal/
   - Crear registro en tabla QRTemporal
   - Comando cron limpia archivos >24h:
     python manage.py limpiar_qrs_viejos
   - Ejecutar diariamente en Railway

8. Usuario descarga y cierra:
   - Puede volver cuando quiera
   - Ingresa cédula nuevamente
   - Genera nuevo QR temporal
```

---

### **FLUJO 4: Panel de Líderes (ACTUALIZADO)**

```
Dashboard ahora incluye:

┌──────────────────────────────────────────────────────┐
│  🎯 PANEL DE CONTROL - LÍDER                         │
│  Usuario: admin (Líder de sistema)                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 ESTADÍSTICAS GENERALES                           │
│  ──────────────────────────────────────────────────  │
│  ┌──────────┬──────────┬──────────┐                 │
│  │ TOTAL    │ ASISTIÓ  │ PENDIENTE│                 │
│  │ 2,847    │ 1,523    │ 1,324    │                 │
│  └──────────┴──────────┴──────────┘                 │
│                                                      │
│  📊 POR GRUPO ⭐ NUEVO                               │
│  ──────────────────────────────────────────────────  │
│  ┌─────────┬────────┬──────────┬─────────┐          │
│  │ GRUPO   │ TOTAL  │ ASISTIÓ  │ % ASIST │          │
│  ├─────────┼────────┼──────────┼─────────┤          │
│  │ Grupo 1 │ 850    │ 450      │ 52.9%   │          │
│  │ Grupo 2 │ 720    │ 380      │ 52.7%   │          │
│  │ Grupo 3 │ 680    │ 350      │ 51.5%   │          │
│  │ Grupo 4 │ 597    │ 343      │ 57.5%   │          │
│  └─────────┴────────┴──────────┴─────────┘          │
│                                                      │
│  👥 RANKING DE LÍDERES ⭐ NUEVO                      │
│  ──────────────────────────────────────────────────  │
│  🥇 Ronny Pérez (G2): 156 invitados                 │
│  🥈 María González (G1): 142 invitados              │
│  🥉 Andrea López (G2): 128 invitados                │
│                                                      │
│  [Ver ranking completo →]                           │
│                                                      │
│  ⚡ ACCIONES RÁPIDAS                                 │
│  ──────────────────────────────────────────────────  │
│  📱 [ESCANEAR QR]                                    │
│  📋 [VER LISTA]                                      │
│  👥 [GESTIONAR LÍDERES] ⭐ NUEVO                     │
│  💾 [EXPORTAR DATOS]                                 │
│                                                      │
└──────────────────────────────────────────────────────┘

Nueva sección: GESTIONAR LÍDERES
─────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────┐
│  👥 GESTIÓN DE LÍDERES                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [➕ Agregar nuevo líder]                           │
│                                                      │
│  Filtrar por grupo: [▼ Todos] [🔍 Buscar...]       │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ GRUPO 1 (7 líderes)                       │     │
│  ├────────────────────────────────────────────┤     │
│  │ 1. Ronny Pérez                             │     │
│  │    📧 ronny@unemi.edu.ec                   │     │
│  │    📱 0987654321                           │     │
│  │    📊 156 invitados                        │     │
│  │    ✅ Activo                               │     │
│  │    [✏️ Editar] [👁️ Ver detalle]            │     │
│  ├────────────────────────────────────────────┤     │
│  │ 2. María González                          │     │
│  │    ... (similar)                           │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ GRUPO 2 (8 líderes)                       │     │
│  │ ... (similar)                              │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS ACTUALIZADA

```
marcha-unemi/
│
├── alumnos/
│   ├── models.py                 
│   │   ├── Alumno (modificado - añadir lider, grupo)
│   │   └── CuentaBancaria (sin cambios)
│   │
│   ├── views.py
│   │   ├── registro_fase1 (sin cambios)
│   │   ├── registro_fase1_5 (líder) ⭐ NUEVO
│   │   ├── registro_fase2 (sin cambios)
│   │   ├── exito (sin cambios)
│   │   ├── recuperar_credenciales ⭐ NUEVO
│   │   ├── mostrar_credenciales ⭐ NUEVO
│   │   ├── descargar_pdf (sin cambios)
│   │   └── descargar_png (sin cambios)
│   │
│   ├── forms.py
│   │   ├── AlumnoFase1Form (sin cambios)
│   │   ├── SeleccionLiderForm ⭐ NUEVO
│   │   ├── DatosBancariosForm (sin cambios)
│   │   └── RecuperarCredencialesForm ⭐ NUEVO
│   │
│   └── urls.py (actualizar rutas)
│
├── lideres_app/ ⭐ NUEVA APP
│   ├── models.py
│   │   └── Lider ⭐ NUEVO
│   │
│   ├── views.py
│   │   ├── login (sin cambios)
│   │   ├── dashboard (modificado - stats por grupo)
│   │   ├── gestionar_lideres ⭐ NUEVO
│   │   ├── agregar_lider ⭐ NUEVO
│   │   ├── editar_lider ⭐ NUEVO
│   │   ├── detalle_lider ⭐ NUEVO
│   │   ├── ranking_lideres ⭐ NUEVO
│   │   └── exportar_por_grupo ⭐ NUEVO
│   │
│   ├── admin.py ⭐ NUEVO
│   │   └── LiderAdmin (gestión de 27 líderes)
│   │
│   └── management/
│       └── commands/
│           └── cargar_lideres_iniciales.py ⭐ NUEVO
│               (Script para crear 27 líderes)
│
├── templates/
│   ├── home.html (modificado - añadir botón credenciales)
│   │
│   ├── alumnos/
│   │   ├── registro_fase1.html (sin cambios)
│   │   ├── registro_fase1_5_lider.html ⭐ NUEVO
│   │   ├── registro_fase2.html (sin cambios)
│   │   ├── exito.html (modificado - mostrar líder y grupo)
│   │   ├── recuperar_credenciales.html ⭐ NUEVO
│   │   └── mostrar_credenciales.html ⭐ NUEVO
│   │
│   └── lideres/
│       ├── dashboard.html (modificado - stats por grupo)
│       ├── gestionar_lideres.html ⭐ NUEVO
│       ├── agregar_lider.html ⭐ NUEVO
│       ├── editar_lider.html ⭐ NUEVO
│       ├── detalle_lider.html ⭐ NUEVO
│       └── ranking_lideres.html ⭐ NUEVO
│
└── static/
    └── js/
        └── seleccion_lider.js ⭐ NUEVO
            (Lógica para select agrupado de líderes)
```

---

## 🌐 RUTAS ACTUALIZADAS

```
┌────────────────────────────────────────────────────────┐
│ RUTAS PÚBLICAS (Alumnos)                               │
├────────────────────────────────────────────────────────┤
│ /                                 → Home (3 botones)   │
│                                                        │
│ REGISTRO                                               │
│ /registro/                        → Fase 1 (personal)  │
│ /registro/lider/                  → Fase 1.5 (líder) ⭐│
│ /registro/cuenta-bancaria/        → Fase 2 (banco)     │
│ /exito/<codigo>/                  → Confirmación       │
│ /descargar-pdf/<codigo>/          → PDF                │
│ /descargar-png/<codigo>/          → PNG                │
│                                                        │
│ MIS CREDENCIALES ⭐ NUEVO                               │
│ /credenciales/                    → Formulario cédula  │
│ /credenciales/buscar/             → POST búsqueda      │
│ /credenciales/mostrar/<cedula>/   → Mostrar QR         │
│ /credenciales/pdf/<cedula>/       → Descargar PDF      │
│ /credenciales/png/<cedula>/       → Descargar PNG      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ RUTAS PRIVADAS (Líderes de Sistema)                    │
├────────────────────────────────────────────────────────┤
│ /lideres/login/                   → Login              │
│ /lideres/dashboard/               → Panel (con grupos) │
│ /lideres/scanner/                 → Escáner QR         │
│ /lideres/lista/                   → Lista asistencia   │
│                                                        │
│ GESTIÓN DE LÍDERES ⭐ NUEVO                             │
│ /lideres/gestionar/               → Lista de líderes   │
│ /lideres/agregar/                 → Crear líder        │
│ /lideres/editar/<id>/             → Editar líder       │
│ /lideres/detalle/<id>/            → Ver invitados      │
│ /lideres/ranking/                 → Ranking completo   │
│                                                        │
│ EXPORTACIÓN                                            │
│ /lideres/exportar/                → Menú exportación   │
│ /lideres/exportar/grupo/<num>/    → CSV por grupo ⭐   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ API ENDPOINTS                                          │
├────────────────────────────────────────────────────────┤
│ GET  /api/lideres/activos/        → Lista líderes ⭐   │
│ GET  /api/lideres/por-grupo/<n>/  → Líderes de grupo ⭐│
│ GET  /api/estadisticas/grupos/    → Stats por grupo ⭐ │
│ POST /api/validar-cedula/         → Validar cédula     │
│ POST /api/marcar-asistencia/      → Registrar QR       │
└────────────────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **1. Modelo Lider**

```python
# lideres_app/models.py

from django.db import models

class Lider(models.Model):
    GRUPOS = [
        (1, 'Grupo 1'),
        (2, 'Grupo 2'),
        (3, 'Grupo 3'),
        (4, 'Grupo 4'),
    ]
    
    # Información personal
    nombre_completo = models.CharField(max_length=150)
    cedula = models.CharField(max_length=10, unique=True)
    email = models.EmailField(null=True, blank=True)
    telefono = models.CharField(max_length=10, null=True, blank=True)
    
    # Grupo y estado
    grupo = models.IntegerField(choices=GRUPOS)
    activo = models.BooleanField(default=True)
    visible_en_registro = models.BooleanField(default=True)
    
    # Orden y organización
    orden = models.IntegerField(default=0)
    
    # Auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Líder"
        verbose_name_plural = "Líderes"
        ordering = ['grupo', 'orden', 'nombre_completo']
    
    def __str__(self):
        return f"{self.nombre_completo} - Grupo {self.grupo}"
    
    def contar_invitados(self):
        """Cuenta cuántos alumnos invitó este líder"""
        return self.alumnos.count()
    
    def contar_asistencias(self):
        """Cuenta cuántos de sus invitados asistieron"""
        return self.alumnos.filter(asistio=True).count()
    
    def porcentaje_asistencia(self):
        """Calcula % de asistencia de sus invitados"""
        total = self.contar_invitados()
        if total == 0:
            return 0
        return (self.contar_asistencias() / total) * 100
```

### **2. Actualización Modelo Alumno**

```python
# alumnos/models.py (agregar campos)

class Alumno(models.Model):
    # ... campos existentes ...
    
    # NUEVOS CAMPOS
    lider_invitador = models.ForeignKey(
        'lideres_app.Lider',
        on_delete=models.PROTECT,  # No permitir borrar líder con invitados
        related_name='alumnos'
    )
    grupo = models.IntegerField()  # Se copia del líder automáticamente
    
    def save(self, *args, **kwargs):
        # Auto-asignar grupo del líder
        if self.lider_invitador and not self.grupo:
            self.grupo = self.lider_invitador.grupo
        super().save(*args, **kwargs)
    
    def get_nombre_lider(self):
        return self.lider_invitador.nombre_completo
    
    def get_grupo_display(self):
        return f"Grupo {self.grupo}"
```

### **3. Form de Selección de Líder**

```python
# alumnos/forms.py

class SeleccionLiderForm(forms.Form):
    lider = forms.ModelChoiceField(
        queryset=Lider.objects.filter(activo=True, visible_en_registro=True),
        empty_label="Seleccione quién lo invitó...",
        label="Líder que te invitó",
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': True
        })
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Agrupar opciones por grupo
        self.fields['lider'].queryset = self.fields['lider'].queryset.order_by(
            'grupo', 'nombre_completo'
        )
```

### **4. Vista Recuperar Credenciales**

```python
# alumnos/views.py

def recuperar_credenciales(request):
    """Formulario para buscar por cédula"""
    if request.method == 'POST':
        cedula = request.POST.get('cedula', '').strip()
        
        # Validar formato
        if len(cedula) != 10 or not cedula.isdigit():
            messages.error(request, 'Cédula inválida. Debe tener 10 dígitos.')
            return render(request, 'alumnos/recuperar_credenciales.html')
        
        # Buscar alumno
        try:
            alumno = Alumno.objects.get(cedula=cedula)
            return redirect('mostrar_credenciales', cedula=cedula)
        except Alumno.DoesNotExist:
            messages.error(request, 'No se encontró ningún registro con esta cédula.')
            return render(request, 'alumnos/recuperar_credenciales.html')
    
    return render(request, 'alumnos/recuperar_credenciales.html')


def mostrar_credenciales(request, cedula):
    """Muestra información y QR del alumno"""
    try:
        alumno = Alumno.objects.select_related('lider_invitador').get(cedula=cedula)
    except Alumno.DoesNotExist:
        messages.error(request, 'Credencial no encontrada.')
        return redirect('recuperar_credenciales')
    
    context = {
        'alumno': alumno,
        'lider': alumno.lider_invitador,
        'grupo': alumno.grupo,
        'qr_data': alumno.codigo_qr,  # Para generar QR en template
    }
    return render(request, 'alumnos/mostrar_credenciales.html', context)


def descargar_credencial_pdf(request, cedula):
    """Genera y descarga PDF con QR - TEMPORAL"""
    try:
        alumno = Alumno.objects.get(cedula=cedula)
    except Alumno.DoesNotExist:
        return HttpResponse('Alumno no encontrado', status=404)
    
    # Generar QR en memoria (NO guardar en disco)
    buffer = BytesIO()
    
    # ... código para generar PDF con QR ...
    # (similar al existente pero usando BytesIO)
    
    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="qr_{alumno.codigo_qr}.pdf"'
    return response
```

### **5. Script para Cargar 27 Líderes Iniciales**

```python
# lideres_app/management/commands/cargar_lideres_iniciales.py

from django.core.management.base import BaseCommand
from lideres_app.models import Lider

class Command(BaseCommand):
    help = 'Carga los 27 líderes iniciales con nombres placeholder'

    def handle(self, *args, **kwargs):
        lideres_iniciales = [
            # GRUPO 1 (7 líderes)
            {'nombre': 'Líder 1.1', 'cedula': '0900000001', 'grupo': 1, 'orden': 1},
            {'nombre': 'Líder 1.2', 'cedula': '0900000002', 'grupo': 1, 'orden': 2},
            {'nombre': 'Líder 1.3', 'cedula': '0900000003', 'grupo': 1, 'orden': 3},
            {'nombre': 'Líder 1.4', 'cedula': '0900000004', 'grupo': 1, 'orden': 4},
            {'nombre': 'Líder 1.5', 'cedula': '0900000005', 'grupo': 1, 'orden': 5},
            {'nombre': 'Líder 1.6', 'cedula': '0900000006', 'grupo': 1, 'orden': 6},
            {'nombre': 'Líder 1.7', 'cedula': '0900000007', 'grupo': 1, 'orden': 7},
            
            # GRUPO 2 (7 líderes)
            {'nombre': 'Líder 2.1', 'cedula': '0900000008', 'grupo': 2, 'orden': 1},
            {'nombre': 'Líder 2.2', 'cedula': '0900000009', 'grupo': 2, 'orden': 2},
            {'nombre': 'Líder 2.3', 'cedula': '0900000010', 'grupo': 2, 'orden': 3},
            {'nombre': 'Líder 2.4', 'cedula': '0900000011', 'grupo': 2, 'orden': 4},
            {'nombre': 'Líder 2.5', 'cedula': '0900000012', 'grupo': 2, 'orden': 5},
            {'nombre': 'Líder 2.6', 'cedula': '0900000013', 'grupo': 2, 'orden': 6},
            {'nombre': 'Líder 2.7', 'cedula': '0900000014', 'grupo': 2, 'orden': 7},
            
            # GRUPO 3 (7 líderes)
            {'nombre': 'Líder 3.1', 'cedula': '0900000015', 'grupo': 3, 'orden': 1},
            {'nombre': 'Líder 3.2', 'cedula': '0900000016', 'grupo': 3, 'orden': 2},
            {'nombre': 'Líder 3.3', 'cedula': '0900000017', 'grupo': 3, 'orden': 3},
            {'nombre': 'Líder 3.4', 'cedula': '0900000018', 'grupo': 3, 'orden': 4},
            {'nombre': 'Líder 3.5', 'cedula': '0900000019', 'grupo': 3, 'orden': 5},
            {'nombre': 'Líder 3.6', 'cedula': '0900000020', 'grupo': 3, 'orden': 6},
            {'nombre': 'Líder 3.7', 'cedula': '0900000021', 'grupo': 3, 'orden': 7},
            
            # GRUPO 4 (6 líderes) - Total = 27
            {'nombre': 'Líder 4.1', 'cedula': '0900000022', 'grupo': 4, 'orden': 1},
            {'nombre': 'Líder 4.2', 'cedula': '0900000023', 'grupo': 4, 'orden': 2},
            {'nombre': 'Líder 4.3', 'cedula': '0900000024', 'grupo': 4, 'orden': 3},
            {'nombre': 'Líder 4.4', 'cedula': '0900000025', 'grupo': 4, 'orden': 4},
            {'nombre': 'Líder 4.5', 'cedula': '0900000026', 'grupo': 4, 'orden': 5},
            {'nombre': 'Líder 4.6', 'cedula': '0900000027', 'grupo': 4, 'orden': 6},
        ]
        
        for lider_data in lideres_iniciales:
            Lider.objects.get_or_create(
                cedula=lider_data['cedula'],
                defaults={
                    'nombre_completo': lider_data['nombre'],
                    'grupo': lider_data['grupo'],
                    'orden': lider_data['orden'],
                    'activo': True,
                    'visible_en_registro': True
                }
            )
        
        self.stdout.write(
            self.style.SUCCESS('✓ 27 líderes cargados exitosamente')
        )
```

### **6. Admin para Gestión de Líderes**

```python
# lideres_app/admin.py

from django.contrib import admin
from .models import Lider

@admin.register(Lider)
class LiderAdmin(admin.ModelAdmin):
    list_display = [
        'nombre_completo', 
        'cedula', 
        'grupo', 
        'total_invitados_display',
        'activo', 
        'visible_en_registro'
    ]
    list_filter = ['grupo', 'activo', 'visible_en_registro']
    search_fields = ['nombre_completo', 'cedula', 'email']
    ordering = ['grupo', 'orden', 'nombre_completo']
    
    fieldsets = (
        ('Información Personal', {
            'fields': ('nombre_completo', 'cedula', 'email', 'telefono')
        }),
        ('Grupo y Configuración', {
            'fields': ('grupo', 'orden', 'activo', 'visible_en_registro')
        }),
    )
    
    def total_invitados_display(self, obj):
        return obj.contar_invitados()
    total_invitados_display.short_description = 'Invitados'
```

---

## 📊 DASHBOARD ACTUALIZADO (Estadísticas)

### **Nuevas Métricas**

```python
# lideres/views.py - Dashboard

def dashboard(request):
    # Estadísticas generales (existentes)
    total_registrados = Alumno.objects.count()
    total_asistieron = Alumno.objects.filter(asistio=True).count()
    
    # NUEVAS ESTADÍSTICAS POR GRUPO
    stats_grupos = []
    for grupo_num in [1, 2, 3, 4]:
        total_grupo = Alumno.objects.filter(grupo=grupo_num).count()
        asistieron_grupo = Alumno.objects.filter(
            grupo=grupo_num, 
            asistio=True
        ).count()
        porcentaje = (asistieron_grupo / total_grupo * 100) if total_grupo > 0 else 0
        
        stats_grupos.append({
            'numero': grupo_num,
            'total': total_grupo,
            'asistieron': asistieron_grupo,
            'pendientes': total_grupo - asistieron_grupo,
            'porcentaje': round(porcentaje, 1)
        })
    
    # RANKING DE LÍDERES (Top 10)
    ranking_lideres = Lider.objects.all().annotate(
        num_invitados=Count('alumnos')
    ).order_by('-num_invitados')[:10]
    
    context = {
        'total_registrados': total_registrados,
        'total_asistieron': total_asistieron,
        'stats_grupos': stats_grupos,
        'ranking_lideres': ranking_lideres,
        # ... otros datos ...
    }
    
    return render(request, 'lideres/dashboard.html', context)
```

---

## 📱 JAVASCRIPT: Select Agrupado de Líderes

```javascript
// static/js/seleccion_lider.js

// Estructura de datos (generada desde Django)
const LIDERES_POR_GRUPO = {
    1: [
        {id: 1, nombre: 'Ronny Pérez'},
        {id: 2, nombre: 'María González'},
        // ... más líderes grupo 1
    ],
    2: [
        {id: 8, nombre: 'Andrea López'},
        // ... más líderes grupo 2
    ],
    3: [/* ... */],
    4: [/* ... */]
};

// Generar select agrupado
function generarSelectLideres() {
    const select = document.getElementById('lider');
    select.innerHTML = '<option value="">Seleccione quién lo invitó...</option>';
    
    for (let grupo = 1; grupo <= 4; grupo++) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `━━━ GRUPO ${grupo} ━━━`;
        
        LIDERES_POR_GRUPO[grupo].forEach(lider => {
            const option = document.createElement('option');
            option.value = lider.id;
            option.textContent = `${lider.nombre} - Grupo ${grupo}`;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    }
}

// Mostrar info del grupo seleccionado
document.getElementById('lider').addEventListener('change', function() {
    const liderId = this.value;
    if (liderId) {
        // Buscar grupo del líder
        let grupoSeleccionado = null;
        for (let grupo in LIDERES_POR_GRUPO) {
            const lider = LIDERES_POR_GRUPO[grupo].find(l => l.id == liderId);
            if (lider) {
                grupoSeleccionado = grupo;
                break;
            }
        }
        
        // Mostrar mensaje informativo
        const infoDiv = document.getElementById('info-grupo');
        infoDiv.innerHTML = `
            <div class="alert alert-info">
                ℹ️ Serás asignado al <strong>Grupo ${grupoSeleccionado}</strong>
            </div>
        `;
    }
});

// Inicializar al cargar página
document.addEventListener('DOMContentLoaded', generarSelectLideres);
```

---

## 📤 EXPORTACIÓN POR GRUPO

```python
# lideres/views.py

def exportar_por_grupo(request, numero_grupo):
    """Exporta CSV de alumnos de un grupo específico"""
    alumnos = Alumno.objects.filter(grupo=numero_grupo).select_related(
        'lider_invitador', 'cuenta_bancaria'
    )
    
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = f'attachment; filename="grupo_{numero_grupo}.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Código', 'Nombre', 'Cédula', 'Email', 'Carrera',
        'Líder', 'Asistió', 'Fecha Asistencia',
        'Tiene Cuenta Bancaria'
    ])
    
    for alumno in alumnos:
        writer.writerow([
            alumno.codigo_qr,
            alumno.nombre_completo,
            alumno.cedula,
            alumno.email,
            alumno.carrera,
            alumno.lider_invitador.nombre_completo,
            'Sí' if alumno.asistio else 'No',
            alumno.fecha_asistencia.strftime('%Y-%m-%d %H:%M') if alumno.fecha_asistencia else '',
            'Sí' if hasattr(alumno, 'cuenta_bancaria') else 'No'
        ])
    
    return response
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **SPRINT 1: Modelo de Líderes (Día 1)**
- [ ] Crear app `lideres_app`
- [ ] Crear modelo `Lider`
- [ ] Crear migraciones
- [ ] Crear comando `cargar_lideres_iniciales`
- [ ] Ejecutar comando para crear 27 líderes
- [ ] Configurar Django Admin para Lider
- [ ] Editar los 27 líderes con nombres reales

### **SPRINT 2: Actualizar Modelo Alumno (Día 1)**
- [ ] Agregar campo `lider_invitador` (FK)
- [ ] Agregar campo `grupo`
- [ ] Crear migración
- [ ] Actualizar método `save()` para auto-asignar grupo
- [ ] Agregar métodos helper (get_nombre_lider, etc.)

### **SPRINT 3: Registro con Líder (Día 2)**
- [ ] Crear `SeleccionLiderForm`
- [ ] Crear vista `registro_fase1_5`
- [ ] Crear template `registro_fase1_5_lider.html`
- [ ] JavaScript para select agrupado
- [ ] Actualizar flujo de sesión (3 fases)
- [ ] Modificar vista `finalizar_registro` para guardar líder

### **SPRINT 4: Mis Credenciales (Día 3)**
- [ ] Crear `RecuperarCredencialesForm`
- [ ] Crear vista `recuperar_credenciales`
- [ ] Crear vista `mostrar_credenciales`
- [ ] Crear template `recuperar_credenciales.html`
- [ ] Crear template `mostrar_credenciales.html`
- [ ] Actualizar funciones de descarga (PDF/PNG) para credenciales
- [ ] Generar QR en memoria (BytesIO) - sin guardar disco

### **SPRINT 5: Actualizar Home (Día 3)**
- [ ] Modificar `home.html` con 3 botones:
  - [ ] REGISTRARME
  - [ ] MIS CREDENCIALES (nuevo)
  - [ ] SOY LÍDER
- [ ] Mejorar diseño responsive
- [ ] Agregar iconos

### **SPRINT 6: Dashboard con Grupos (Día 4)**
- [ ] Agregar stats por grupo en dashboard
- [ ] Crear sección "Ranking de Líderes"
- [ ] Modificar template `dashboard.html`
- [ ] Agregar gráficos (opcional con Chart.js)

### **SPRINT 7: Gestión de Líderes (Día 4-5)**
- [ ] Crear vista `gestionar_lideres`
- [ ] Crear vista `agregar_lider`
- [ ] Crear vista `editar_lider`
- [ ] Crear vista `detalle_lider` (ver invitados)
- [ ] Crear vista `ranking_lideres`
- [ ] Crear templates correspondientes
- [ ] Agregar menú en dashboard

### **SPRINT 8: Exportación por Grupo (Día 5)**
- [ ] Crear vista `exportar_por_grupo`
- [ ] Agregar botón en dashboard
- [ ] Actualizar menú de exportación

### **SPRINT 9: Pruebas (Día 6)**
- [ ] Registrar alumno con selección de líder
- [ ] Verificar que se asigna grupo correctamente
- [ ] Probar "Mis Credenciales"
- [ ] Verificar descarga de QR temporal
- [ ] Probar dashboard con stats de grupos
- [ ] Probar ranking de líderes
- [ ] Probar gestión de líderes
- [ ] Probar exportación por grupo

### **SPRINT 10: Deployment (Día 7)**
- [ ] Actualizar requirements.txt
- [ ] Hacer migraciones en Railway
- [ ] Ejecutar comando cargar_lideres_iniciales en Railway
- [ ] Editar 27 líderes con datos reales en admin
- [ ] Crear usuarios líderes de sistema
- [ ] Pruebas finales en producción

---

## 🎯 RESUMEN DE CAMBIOS

### **Nuevas Funcionalidades:**
1. ✅ **Sistema de Líderes**: 27 líderes en 4 grupos
2. ✅ **Selección de Líder**: Alumno elige quién lo invitó (Fase 1.5)
3. ✅ **Asignación Automática**: Grupo heredado del líder
4. ✅ **Mis Credenciales**: Recuperación de QR por cédula
5. ✅ **QR Temporal**: Se genera on-the-fly, no se guarda
6. ✅ **Dashboard Mejorado**: Stats por grupo + ranking
7. ✅ **Gestión de Líderes**: CRUD completo para admin
8. ✅ **Exportación por Grupo**: CSV filtrado

### **Modificaciones:**
- ✅ Home ahora tiene 3 botones (+ Mis Credenciales)
- ✅ Registro pasa de 2 a 3 fases (+ selección líder)
- ✅ Modelo Alumno tiene 2 campos nuevos
- ✅ Dashboard muestra estadísticas de grupos
- ✅ Exportación incluye información de líder y grupo

### **No Cambia:**
- ✅ Sistema de carreras por modalidad (intacto)
- ✅ Sistema de cuentas bancarias (intacto)
- ✅ Generación de QR original (intacto)
- ✅ Scanner y asistencia (intacto)

---

## 💾 COMANDOS ÚTILES

```bash
# Crear 27 líderes iniciales
python manage.py cargar_lideres_iniciales

# Actualizar contadores de líderes (si es necesario)
python manage.py shell
>>> from lideres_app.models import Lider
>>> for lider in Lider.objects.all():
...     print(f"{lider.nombre_completo}: {lider.contar_invitados()} invitados")

# Estadísticas por grupo
>>> from alumnos.models import Alumno
>>> for grupo in [1,2,3,4]:
...     total = Alumno.objects.filter(grupo=grupo).count()
...     print(f"Grupo {grupo}: {total} alumnos")
```

---

## 📊 EJEMPLO DE DATOS

```
GRUPO 1:
├─ Líder 1: Ronny Pérez (156 invitados)
├─ Líder 2: María González (142 invitados)
└─ ... (5 más)
   Total Grupo 1: 850 alumnos

GRUPO 2:
├─ Líder 8: Andrea López (128 invitados)
└─ ... (6 más)
   Total Grupo 2: 720 alumnos

GRUPO 3:
└─ ... (7 líderes)
   Total Grupo 3: 680 alumnos

GRUPO 4:
└─ ... (6 líderes)
   Total Grupo 4: 597 alumnos

────────────────────────────────────
TOTAL: 27 líderes, 2,847 alumnos
```

---

**¿TODO CLARO? ¿PROCEDEMOS A CREAR EL CÓDIGO COMPLETO?** 🚀

Este plan contempla:
✅ Sistema de 27 líderes editables
✅ 4 grupos claramente diferenciados
✅ Registro con selección de líder (fase 1.5)
✅ Asignación automática de grupo
✅ Módulo "Mis Credenciales" completo
✅ QR temporal sin almacenamiento
✅ Dashboard con estadísticas de grupos
✅ Gestión completa de líderes
✅ Exportación por grupo
✅ Todo compatible con Railway