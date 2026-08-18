# Matriz deny-by-default

| Rol | Puede | No puede |
|---|---|---|
| STUDENT | Perfil propio seguro, cuestionarios asignados, estado minimo de consentimiento | Cambiar centro/grupo/rol, leer resultados o perfiles ajenos |
| FAMILY | Alumnado vinculado y decisiones de consentimiento | Respuestas, puntuaciones, otros alumnos o centros |
| TEACHER | Estructura de grupos asignados y estado operativo minimo | Resultados, respuestas o alertas clinicas |
| PROFESSIONAL | Campañas, resultados y alertas de grupos asignados directamente | Grupos no asignados; escribir tras transferir una alerta |
| SCHOOL | Estructura y estado operativo de su centro, invitaciones dentro de ambito | Respuestas, resultados o notas clinicas |
| ADMIN | Administracion, identidad y textos legales | Acceso clinico ordinario |

Los recursos fuera de ambito responden 404. Las asignaciones relacionales activas son la unica fuente de permisos; los campos historicos `schoolId`, `groupId` y `linkedStudentId` no autorizan.
