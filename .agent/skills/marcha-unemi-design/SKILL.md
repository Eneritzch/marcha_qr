---
name: marcha-unemi-design
description: Design system and backend integration rules for the Marcha UNEMI project, focusing on UNEMI brand aesthetics and lightweight performance.
---

# Marcha UNEMI Design Skill

This skill provides the aesthetic and technical foundation for building the frontend of "Marcha UNEMI" using **Django Templates**, **Vanilla JavaScript**, and **Tailwind CSS (via CDN)**. It ensures consistency with the UNEMI brand and high performance for low-connectivity environments.

## Visual Identity (UNEMI Colors)

Based on official university materials, the palette is:
- **Primary (Navy Blue):** `#0F1E4B` - Used for headers, primary buttons, and deep backgrounds.
- **Secondary (Orange):** `#EF7D00` - Used for accents, notifications, and call-to-actions.
- **Background (Light Slate):** `#F8FAFC` - Main background color for a clean, light look.
- **Cards/White:** `#FFFFFF` - Containers for information.
- **Text (Dark Gray):** `#1E293B` - Content readability.

## UI/UX Principles (Lightweight & Premium)

1. **Vanilla Simplicity:** No build steps. Use standard HTML5 and ES6+ JavaScript.
2. **Tailwind via CDN:** Use the script tag configuration to define custom colors on the fly.
3. **Icons:** Use **Lucide Icons** via CDN (`<script src="https://unpkg.com/lucide@latest"></script>`).
4. **Immediate Feedback:** Use the Orange accent for hover states and loading indicators.
5. **Responsiveness:** All components must be mobile-first.

## Backend Integration Rules

### 1. Authentication
- Login URL: `/api/v1/lideres/login/`
- Username: `rarellanou` (generated logic).
- Token: Store in `localStorage` or `sessionStorage` and inject into API calls (Axios/Fetch).

### 2. Template Structure
- **base.html:** Contains the `<head>` with Tailwind/Icon CDNs, the navbar, and the footer.
- **Scripts:** Place logic in `{% block extra_js %}` or separate `.js` files in `static/js/`.
- **API Calls:** Use `fetch()` or a lightweight `axios` CDN to communicate with the specialized DRF endpoints.

### 3. Critical Endpoints
- **QR Download:** `/api/v1/alumnos/descargar-qr/{cedula}/`
- **Credential Recovery:** `/api/v1/alumnos/recuperar/{cedula}/`
- **Bulk Upload:** `/api/v1/alumnos/upload-excel/`

## Tailwind Configuration (Script Tag)

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          unemi: {
            blue: '#0F1E4B',
            orange: '#EF7D00',
            bg: '#F8FAFC',
            text: '#1E293B'
          }
        }
      }
    }
  }
</script>
```

