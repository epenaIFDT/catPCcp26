# Catálogo VASTEC

Sitio estático (sin backend, sin build step) que muestra un catálogo de
computadoras con login por código de acceso, filtros, selección múltiple y
compartir por WhatsApp / copiar resumen.

**Publicado en:** https://epenaifdt.github.io/catPCcp26/

## Qué contiene este repositorio

Este repositorio público contiene únicamente el catálogo que ve el cliente
final: `index.html`, `catalogo.html`, `css/`, `js/` y `data/*.enc.json`. La
herramienta de gestión (carga de Excel, glosario de simplificaciones,
códigos de acceso, publicación) es un panel de administración de uso
exclusivamente local que **no** forma parte de este repositorio ni es
necesario para ver o servir el catálogo publicado.

## Cómo funciona

- Sin backend ni paso de build: HTML/CSS/JS puro, servido por GitHub Pages.
- El catálogo de productos viaja **cifrado** (`data/productos.enc.json`,
  AES-GCM-256, Web Crypto API nativa) y solo se desencripta en el navegador
  con un código de acceso válido.
- Cada código activo "envuelve" la misma clave de datos mediante una clave
  derivada por PBKDF2 (`data/keys.enc.json`). Un código inválido
  simplemente falla al desenvolver la clave — no hay validación contra un
  servidor ni códigos guardados en texto plano.
- La sesión persiste 90 días en `localStorage` (las sesiones con rol admin
  no vencen).
- Opcionalmente, una encuesta obligatoria (`data/encuesta.json`, sin
  cifrar) puede bloquear el acceso al catálogo hasta que el usuario la
  responda una vez.

## Estructura

```
index.html              Login: pide el código de acceso y desencripta el catálogo
catalogo.html            Catálogo: filtros, WhatsApp, copiar resumen, encuesta opcional
css/styles.css           Estilos compartidos
data/
  productos.enc.json     Catálogo cifrado
  keys.enc.json           Claves envueltas por código de acceso
  encuesta.json           Encuesta activa, sin cifrar (opcional)
js/
  crypto.js               PBKDF2 / AES-GCM / base64 (Web Crypto API)
  auth.js                 login() / getSession() / logout() / requireAuth()
  filters.js               Estado de filtros, selección, paginación
  export.js                WhatsApp, copiar resumen
  render.js                Renderizado de las tarjetas de producto
  encuesta-gate.js         Bloqueo opcional de encuesta antes del catálogo
  app.js                    Bootstrap de la página
```

## Correr en local

`fetch()` requiere `http://`, no sirve abrir los archivos directamente
(`file://`). Cualquier servidor estático simple funciona, por ejemplo:

```
python -m http.server 3000
```

Y abrir `http://localhost:3000/`.

## Sobre este proyecto

Herramienta interna desarrollada para VASTEC — no está pensada como
plantilla de uso general.
