# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Profesionales vinculados y autorizados por un centro educativo, que asignan cuestionarios a sus grupos, supervisan sesiones y revisan resultados y alertas.
- Alumnado de 9 a 16 años, que responde cuestionarios adaptados a su tramo de edad en un entorno comprensible y acompañado.
- Familias vinculadas al alumnado, que revisan consentimientos y reciben avisos mínimos cuando el menor solicita ayuda.
- Centros y administradores, que gestionan estructura, usuarios, permisos y condiciones operativas del piloto.

## Product Purpose

Proyecto Unicornio ayuda a centros educativos a realizar cribados preventivos de bienestar emocional en menores mediante cuestionarios estructurados, consentimiento familiar, supervisión profesional y una vía visible para solicitar ayuda.

El éxito del piloto consiste en completar de forma trazable el flujo centro-grupo-profesional, consentimiento por campaña, sesión supervisada, respuesta del alumno, puntuación orientativa y revisión humana, sin presentar resultados automáticos como diagnósticos.

## Positioning

La propuesta combina identidad y lenguaje adaptados a menores con organización escolar, consentimiento familiar, cuestionarios por edad, acompañamiento visual de Unicornio y escalado humano de solicitudes de ayuda.

## Operating Context

- Piloto controlado en centros educativos de España.
- Administración de cuestionarios en sesiones supervisadas por el profesional responsable.
- Los contenidos iniciales proceden de `CUESTIONARIOS UNICORNIO.docx`.
- El primer módulo funcional cubre estado de ánimo y sintomatología depresiva para 9-12 y 13-16 años.

## Capabilities and Constraints

- Aplicación Node.js y Express con frontend HTML, CSS y JavaScript sin framework.
- PostgreSQL es obligatorio para cuestionarios, respuestas, resultados, alertas y auditoría.
- El piloto está desactivado por defecto y no debe usarse con datos reales sin revisión clínica, jurídica, de propiedad intelectual y protección de datos.
- Los cuestionarios iniciales son instrumentos experimentales propios de cribado preventivo; no son diagnósticos ni deben presentarse como BYI-2 o como pruebas validadas.
- Centro o administrador autoriza la vinculación del profesional a centros y grupos.
- Cada campaña solicita consentimiento familiar; solo el alumnado con consentimiento aceptado puede responder.
- La versión se selecciona automáticamente por edad el día de la sesión: 9–12 infantil y 13–16 adolescente. Fuera de 9–16 el participante queda bloqueado, sin adaptar textos por cuenta propia.
- Las alertas y notificaciones se entregan únicamente dentro de la aplicación durante el piloto supervisado. Se consultan cada cinco segundos mientras la aplicación está abierta y persisten para el siguiente acceso, pero no garantizan una entrega urgente fuera de la aplicación.
- Alumno y familia no reciben puntuaciones ni interpretaciones clínicas automáticas.
- Centro y administrador pueden consultar el estado operativo, pero no acceden ordinariamente a respuestas, resultados ni interpretaciones clínicas.
- Las alertas automáticas por resultado o ítem centinela se dirigen solo al profesional. La familia recibe únicamente un aviso mínimo cuando el alumno pulsa «Pedir ayuda», sin identidad clínica, respuestas, puntuación ni banda.
- Pedir ayuda intenta guardar la respuesta actual, bloquea el intento para impedir su reanudación automática, crea una alerta auditada y mantiene al alumno en una pantalla de acompañamiento. Si no se confirma la entrega, la interfaz lo indica con calma, permite volver a pedir ayuda y orienta al alumno para acercarse al profesional presente.
- El profesional debe confirmar la recepción, registrar la actuación y resolver o transferir cada alerta; todas estas acciones quedan auditadas.

## Brand Commitments

- Nombre: Proyecto Unicornio.
- Conservar el sistema visual, logotipos, paleta violeta y compañeros Nico, Luna, Orion y Sol existentes.
- El lenguaje dirigido a menores debe ser claro, cercano, no culpabilizador y adecuado a la edad.
- El acompañamiento visual nunca sustituye la actuación de una persona formada.

## Evidence on Hand

- Cuestionarios, instrucciones, puntuaciones y reglas provisionales en `CUESTIONARIOS UNICORNIO.docx`.
- Identidad gráfica y personajes disponibles en `public/assets`.
- Arquitectura, roles, centros, grupos, asignaciones y consentimiento inicial ya implementados en el repositorio.
- No existe todavía validación psicométrica o clínica aportada para los instrumentos propios.
- No existe todavía autorización documentada para presentar el contenido como una adaptación licenciada de BYI-2.

## Product Principles

- Una señal automática orienta; una persona formada valora y actúa.
- Ningún cuestionario se abre sin consentimiento y capacidad real de respuesta.
- Recoger y mostrar solo la información necesaria para cada rol.
- Mantener al alumno informado, acompañado y capaz de pedir ayuda en cualquier momento.
- Versionar contenido, reglas y textos legales para que cada resultado sea reproducible y auditable.

## Accessibility & Inclusion

- Interfaz en español, responsive y utilizable con teclado y lector de pantalla.
- No depender únicamente del color para estados, progreso o alertas.
- Adaptar textos al tramo de edad y ofrecer instrucciones breves, mensajes de error útiles y recuperación tras desconexión.
