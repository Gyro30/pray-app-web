# Publicación de los textos legales

Los HTML contienen Jerónimo Sánchez, Perú y jero7sb@gmail.com. El sitio no requiere login, cookies, JavaScript ni una clave de Supabase. La solicitud externa de eliminación se hace por correo y requiere verificación de titularidad; nunca se solicita contraseña.

Publica todos los archivos HTML y legal.css juntos en un hosting HTTPS. Para GitHub Pages, usa un repositorio de sitio y copia el contenido de esta carpeta a la raíz; activa Pages desde la rama principal y carpeta raíz. El repositorio de la app puede seguir siendo privado. Verifica desde una ventana sin sesión que privacy.html y account-deletion.html abren correctamente. Usa sus URLs finales en Play Console y en la ficha de soporte.

Supabase sigue procesando el borrado con la Edge Function delete-account. En los dominios compartidos de Supabase, Storage devuelve HTML como texto plano y las Edge Functions estándar reescriben text/html a text/plain. Supabase permite respuestas HTML/XHTML de sus APIs y funciones con un Custom Domain configurado; esa ruta exige configurar el dominio y una función que sirva las páginas. Esta carpeta también puede publicarse directamente en un hosting estático separado.

Referencias oficiales: [Supabase Storage](https://supabase.com/docs/guides/storage/quickstart), [Supabase Edge Functions](https://supabase.com/docs/guides/functions/http-methods).

Repositorio público: https://github.com/Gyro30/pray-app-web. Configurar Pages desde `main` y `/(root)`. URL base de este repositorio: https://gyro30.github.io/pray-app-web/. Verificar que responde antes de introducir `privacy.html` y `account-deletion.html` en Play Console. El archivo `.nojekyll` sirve las páginas sin procesamiento Jekyll. Cuando cambies el correo, actualiza todos los HTML, Pages/LegalPage.xaml.cs y la ficha de Play.

Excepción de dominio propio: [Supabase — HTML/XHTML y Custom Domains](https://supabase.com/changelog/29633-xhtml-responses-are-only-allowed-with-a-custom-domain-enabled).
