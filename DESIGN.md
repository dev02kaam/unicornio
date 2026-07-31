---
name: Proyecto Unicornio — Constelación serena
description: Sistema visual sereno, humano y trazable para experiencias educativas y de bienestar supervisado.
colors:
  night: "#0F1833"
  night-soft: "#1A2852"
  canvas: "#EDF1F7"
  surface: "#FFFFFF"
  surface-strong: "#F0EDFB"
  surface-soft: "#F8F9FC"
  text: "#17203B"
  muted: "#5B647B"
  primary: "#5943B7"
  primary-strong: "#43308F"
  border: "#17203B1F"
  focus-ring: "#1470FF61"
  success: "#167345"
  warning: "#9A5A00"
  danger: "#B4232C"
typography:
  display:
    fontFamily: "Trebuchet MS, Aptos Display, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.night}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.night}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    height: "44px"
  surface-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "24px"
  answer-choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.night}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px"
    height: "56px"
  alert-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "16px"
---

# Design System: Proyecto Unicornio

## Overview

**Creative North Star: "Constelación serena"**

Unicornio se siente como un espacio educativo sereno, humano y confiable. La metáfora cósmica organiza la información como una constelación: el estado principal ocupa el centro, las acciones y participantes orbitan alrededor y las alertas permanecen visibles sin convertir la experiencia en una pantalla clínica.

La interfaz prioriza una acción principal por contexto, trazabilidad explícita y acompañamiento sin interferencia. En escritorio, el monitor profesional se divide en campañas, sesión y alertas; en móvil conserva el orden sesión, participantes, alertas y acciones. Los personajes acompañan acceso, estados vacíos, petición de apoyo y finalización, nunca resultados ni alertas profesionales.

**Key Characteristics:**

- Serena y luminosa, sin infantilizar.
- Cósmica en identidad, sobria en las tareas sensibles.
- Responsive, navegable por teclado y comprensible con lector de pantalla.
- Objetivos táctiles de al menos 44 px y movimiento reducido respetado.
- Una señal automática orienta; una persona formada siempre valora y actúa.

## Colors

La paleta combina azul noche estructural, superficies luminosas y violeta contenido. Los estados reservan verde para correcto, ámbar para pendiente y rojo exclusivamente para ayuda o alerta.

### Primary

- **Violeta órbita**: acción principal, progreso y selección, con la variante intensa para hover y énfasis.
- **Noche profunda**: encabezados, navegación y controles de máxima jerarquía.

### Neutral

- **Lienzo frío**: fondo general que separa las superficies sin ruido.
- **Superficie lunar**: paneles, formularios y filas accionables.
- **Tinta serena**: texto principal; el tono atenuado se reserva para contexto secundario.

**The Human Signal Rule.** Nunca se comunica prioridad, estado o interpretación únicamente mediante color; siempre se añade una etiqueta textual.

**The Red Is Urgency Rule.** Pedir ayuda comienza con violeta sereno y lenguaje de acompañamiento. El rojo se reserva para una urgencia confirmada, un fallo de entrega o una alerta que requiere atención; nunca se usa como decoración ni para resultados automáticos.

## Typography

**Display Font:** Trebuchet MS, con Aptos Display y Segoe UI como alternativas.  
**Body Font:** Aptos, con Segoe UI y `system-ui` como alternativas.

**Character:** títulos compactos y cálidos; lectura neutra, directa y estable. Los textos dirigidos a menores mantienen un mínimo de 16 px.

### Hierarchy

- **Display** (800, fluido, 1.1): títulos de acceso y finalización.
- **Headline** (800, fluido, 1.2): títulos de campaña, sesión y pregunta.
- **Body** (400, 16 px, 1.5): instrucciones, respuestas y contexto operativo.
- **Label** (700, 13 px, 0.08 em): etiquetas breves; nunca bloques completos en mayúsculas.

**The Plain Language Rule.** Se habla de “respuestas”, “revisión profesional” y “pedir ayuda”; nunca de diagnósticos. Todo error explica qué ocurrió y qué puede hacer la persona a continuación.

## Elevation

La profundidad es tonal por defecto: lienzo, superficies y bordes finos organizan la jerarquía. Las sombras ambientales aparecen solo en contenedores principales, diálogos y controles que flotan sobre el contenido.

### Shadow Vocabulary

- **Superficie ambiental** (`0 22px 60px rgba(15, 24, 51, 0.08)`): workspace principal.
- **Diálogo elevado** (`0 30px 90px rgba(15, 24, 51, 0.24)`): confirmaciones modales.
- **Apoyo del alumno**: superficie violeta suave, borde contenido y retrato del compañero; sin sombra de alarma ni rojo preventivo.

**The Calm Surface Rule.** Ninguna animación decorativa compite con una pregunta o alerta. Las transiciones de estado duran entre 160 y 420 ms y desaparecen con `prefers-reduced-motion`.

## Components

### Buttons

- **Shape:** píldora moderada; altura mínima de 44 px.
- **Primary:** azul noche con texto blanco y una única acción dominante por contexto.
- **Secondary:** superficie clara con borde sutil; mantiene la misma altura táctil.
- **Hover / Focus:** cambio tonal breve y anillo de foco visible; nunca se elimina el `outline` sin sustituto.

### Cards / Containers

- **Corner Style:** redondeo amplio de 24 px para workspaces y 16 px para unidades accionables.
- **Background:** superficie blanca sobre lienzo frío.
- **Shadow Strategy:** tonal y plana por defecto; solo se eleva según la sección anterior.
- **Internal Padding:** 16–24 px; las listas densas usan filas y divisores en vez de rejillas de tarjetas.

### Inputs / Fields

- **Style:** fondo blanco, borde fino y radio de 12 px.
- **Focus:** anillo azul visible de 3 px.
- **Error / Disabled:** texto explicativo y estado semántico; nunca solo un cambio de color.

### Navigation

La cabecera es compacta y estable. La ruta activa combina texto y subrayado; en móvil las acciones pasan a una columna fluida sin alterar el orden semántico.

### Companion Avatars

Los avatares circulares usan retratos cuadrados dedicados de alta resolución, con rostro, cuerno y orejas dentro de una zona segura central. Nunca se recortan de las fichas de personaje ni conservan rótulos, paneles o texto incrustado. Las ilustraciones verticales completas se reservan para escenas amplias como el acceso. El retrato permanece estable: los estados animan la luz y el halo exterior, nunca desplazan o escalan la imagen dentro de su máscara circular.

### Question Runner

Una pregunta ocupa el foco de cada pantalla. El enunciado ocupa todo el ancho disponible del formulario y solo parte línea cuando el viewport lo exige. Las respuestas son radios grandes, la barra incluye valor textual y `aria-valuenow`, cada cambio de pregunta mueve el foco al enunciado y el botón «Pedir ayuda» permanece separado de la navegación.

### Help and Alert Lifecycle

Al confirmar ayuda se intenta guardar la respuesta actual, se detiene el intento y se crea una alerta. La pantalla de apoyo reconoce la valentía del alumno, explica que el profesional se hará cargo de escucharle y mantiene presente al compañero Unicornio. Si la entrega no se confirma, la interfaz no afirma que alguien fue avisado: orienta al alumno para acercarse al profesional presente y permite volver a pedir ayuda.

El monitor profesional expresa tipo, prioridad, estado, hora y alumno con texto. Sus acciones significan: confirmar recepción, registrar la actuación y resolver, o transferir a otro circuito. Cada lectura de resultados y actuación sensible queda auditada.

### Notifications

Las notificaciones son filas persistentes. El sondeo ocurre cada cinco segundos solo mientras la aplicación está abierta; una región viva dedicada anuncia únicamente novedades reales. El sello «Actualizado a las…» no es una región viva.

## Do's and Don'ts

### Do:

- **Do** mantener el botón de ayuda accesible y ofrecer una alternativa clara ante un fallo de red.
- **Do** combinar color, texto y semántica para estados, prioridades y progreso.
- **Do** reservar las respuestas y puntuaciones para el profesional asignado.
- **Do** mantener objetivos táctiles de 44 px, foco visible, teclado completo y orden responsive estable.
- **Do** usar el compañero para comunicar presencia en acceso, vacío, petición de apoyo y finalización.

### Don't:

- **Don't** presentar los cuestionarios experimentales como diagnósticos, BYI-2 o pruebas validadas.
- **Don't** mostrar puntuaciones, bandas, respuestas ni interpretaciones al alumno, familia, centro o administrador.
- **Don't** afirmar que una alerta fue entregada cuando la API no lo ha confirmado.
- **Don't** usar rojo, movimiento o personajes como decoración en resultados y alertas.
- **Don't** convertir listas operativas densas en una rejilla de tarjetas repetitivas.
