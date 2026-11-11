// Spanish interface for the student portal (added 2026-11-10).
//
// How it works: the app's own code stays in English. This file translates the text the student SEES, after it is on the page, by matching each piece of
// text against the dictionary below (and a few number patterns such as "3 lessons"). A MutationObserver translates anything the app draws later, so
// every screen is covered without touching the rest of the code. Switching back to English restores the original text exactly.
//
// What is deliberately NOT translated: the lesson text itself (.lesson-text-content; the quiz, buttons and menus around it ARE translated), the chat messages themselves (the tutor already writes Spanish and the
// student's own words stay as typed), form fields the student types in, and every admin screen (Aaron works in English).
//
// To add or fix a translation, edit ES (exact text -> Spanish) or PATTERNS (text with numbers). Text that is not found is left in English, never broken.
(function () {
    'use strict';
    const KEY = 'uiLang';

    // ------------------------------------------------------------------ dictionary (English text exactly as shown -> Spanish)
    const ES = {
        // sign in / create account / reset
        "Aaron's Student Portal": 'Portal de estudiantes de Aaron',
        'Taking longer than usual. Check your connection.': 'Está tardando más de lo normal. Revisa tu conexión.',
        'Try again': 'Intentar de nuevo',
        'Sign In': 'Iniciar sesión',
        'Create Account': 'Crear cuenta',
        'Welcome back! Sign in to continue.': '¡Qué bueno verte de nuevo! Inicia sesión para continuar.',
        'Email': 'Correo electrónico',
        'Password': 'Contraseña',
        'Remember me': 'Recordarme',
        'Forgot password?': '¿Olvidaste tu contraseña?',
        "Enter your email and we'll send you a link to reset your password.": 'Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña.',
        'Send Reset Link': 'Enviar enlace',
        'Check your email': 'Revisa tu correo',
        'We sent a password reset link to': 'Enviamos un enlace para restablecer tu contraseña a',
        "Don't see it? Check your spam folder.": '¿No lo ves? Revisa tu carpeta de spam.',
        '← Back to Sign In': '← Volver a iniciar sesión',
        'Choose a new password for your account.': 'Elige una contraseña nueva para tu cuenta.',
        'New Password': 'Contraseña nueva',
        'Confirm New Password': 'Confirmar contraseña nueva',
        'Set New Password': 'Guardar contraseña nueva',
        'Create your free account to access resources, practice Spanish, and more.': 'Crea tu cuenta gratis para acceder a recursos, practicar español y más.',
        'Your Name': 'Tu nombre',
        "I'm interested in...": 'Me interesa...',
        'Select a subject': 'Elige una materia',
        'Spanish Lessons': 'Clases de español',
        'Music Lessons': 'Clases de música',
        'Almost there!': '¡Casi listo!',
        'We sent a confirmation email to': 'Enviamos un correo de confirmación a',
        '📬 Next steps:': '📬 Próximos pasos:',
        'Open the email from': 'Abre el correo de',
        'Click the': 'Toca el enlace',
        'Confirm your email': 'Confirma tu correo',
        'link': '',
        "You'll be logged in automatically": 'Iniciarás sesión automáticamente',
        'Already confirmed? Sign In': '¿Ya confirmaste? Inicia sesión',
        'you@example.com': 'tu@ejemplo.com',
        'Your password': 'Tu contraseña',
        'Choose a password (min. 6 characters)': 'Elige una contraseña (mínimo 6 caracteres)',
        'Type it again': 'Escríbela otra vez',
        'Enter your name': 'Escribe tu nombre',
        'Please fill in all fields.': 'Por favor, completa todos los campos.',
        'Passwords do not match.': 'Las contraseñas no coinciden.',
        'Something went wrong. Please try again.': 'Algo salió mal. Inténtalo de nuevo.',
        'Signing in…': 'Iniciando sesión…',
        'Loading': 'Cargando',
        'Loading...': 'Cargando...',
        'Loading courses…': 'Cargando cursos…',
        'Trying again…': 'Intentando de nuevo…',
        'Trying now…': 'Intentando ahora…',
        'Try again now': 'Intentar ahora',
        'Sign in with a different account': 'Iniciar sesión con otra cuenta',

        // resources page
        'Verb Conjugator': 'Conjugador de verbos',
        'All tenses': 'Todos los tiempos',
        'Type a verb in Spanish or English, then pick any tense to see its full conjugation.': 'Escribe un verbo en español o en inglés y elige cualquier tiempo para ver su conjugación completa.',
        'Music & Listening': 'Música y audio',
        'Spanish Spotify Playlist': 'Lista de Spotify en español',
        'Spanish YouTube Playlist': 'Lista de YouTube en español',
        'Movies & TV Shows': 'Películas y series',
        'Movies & TV': 'Películas y series',
        'Watch in SPANISH with SPANISH subtitles': 'Míralas en ESPAÑOL con subtítulos en ESPAÑOL',
        'Deep / Dark but Amazing': 'Profundas / Oscuras pero increíbles',
        'Deep / Less Dark': 'Profundas / Menos oscuras',
        'TV Shows': 'Series',
        'FILM': 'PELÍCULA',
        'TV': 'SERIE',
        'Instagram Profiles': 'Perfiles de Instagram',
        'Follow for daily Spanish immersion at native speed': 'Síguelos para una inmersión diaria en español a velocidad nativa',
        'Street interviews': 'Entrevistas callejeras',
        'Skits, young, unfiltered': 'Sketches, jóvenes, sin filtro',
        'Aggressive, great for vocab': 'Agresivo, genial para vocabulario',
        'More subtle and witty': 'Más sutil e ingenioso',
        'Beginner': 'Principiante',
        'Intermediate': 'Intermedio',
        'Advanced': 'Avanzado',
        'Connect with fellow Spanish students — practice, ask questions, share tips!': 'Conéctate con otros estudiantes de español: practica, haz preguntas y comparte consejos.',

        // add to home screen nudge + guide
        'Put the portal on your Home Screen: it opens like an app and lets you turn on practice reminders.': 'Pon el portal en tu pantalla de inicio: se abre como una app y te permite activar los recordatorios de práctica.',
        'Show me how': 'Muéstrame cómo',
        'Keep it on your Home Screen': 'Ténlo en tu pantalla de inicio',
        'It opens in one tap like an app, and you can turn on practice reminders.': 'Se abre con un toque, como una app, y puedes activar los recordatorios de práctica.',
        'Add the portal to your Home Screen': 'Añade el portal a tu pantalla de inicio',
        'It opens in one tap like an app, and it lets you turn on practice reminders.': 'Se abre con un toque, como una app, y te permite activar los recordatorios de práctica.',
        'Install now': 'Instalar ahora',
        'I added it': 'Ya lo añadí',
        'Share': 'Compartir',
        'Open the new icon on your Home Screen and sign in once. From then on it opens like an app.': 'Abre el nuevo icono en tu pantalla de inicio e inicia sesión una vez. Desde entonces se abre como una app.',

        // guide steps (whole HTML strings, looked up by i18n.t() when the guide is built)
        '<li><i class="fas fa-compass"></i><span>This page is open inside another app. Tap <b>⋯</b> or the share icon and choose <b>Open in Safari</b> first.</span></li>': '<li><i class="fas fa-compass"></i><span>Esta página está abierta dentro de otra app. Toca <b>⋯</b> o el icono de compartir y elige <b>Abrir en Safari</b> primero.</span></li>',
        '<li><i class="fas fa-compass"></i><span>This works best in <b>Safari</b>. If you do not see the option below, open this page in Safari.</span></li>': '<li><i class="fas fa-compass"></i><span>Esto funciona mejor en <b>Safari</b>. Si no ves la opción de abajo, abre esta página en Safari.</span></li>',
        '<li><i class="fas fa-arrow-up-from-bracket"></i><span>Tap the <b>Share</b> button (the square with an arrow). On newer iPhones it is inside the <b>≡</b> menu at the bottom of Safari.</span></li>': '<li><i class="fas fa-arrow-up-from-bracket"></i><span>Toca el botón <b>Compartir</b> (el cuadrado con una flecha). En los iPhone más nuevos está dentro del menú <b>≡</b>, en la parte inferior de Safari.</span></li>',
        '<li><i class="fas fa-square-plus"></i><span>Tap <b>View More</b> if you see it, then tap <b>Add to Home Screen</b>.</span></li>': '<li><i class="fas fa-square-plus"></i><span>Toca <b>Ver más</b> si aparece y luego toca <b>Añadir a pantalla de inicio</b>.</span></li>',
        '<li><i class="fas fa-check"></i><span>Tap <b>Add</b> in the top corner.</span></li>': '<li><i class="fas fa-check"></i><span>Toca <b>Añadir</b> en la esquina superior.</span></li>',
        '<li><i class="fas fa-graduation-cap"></i><span>Open the new icon on your Home Screen and sign in once. From then on it opens like an app.</span></li>': '<li><i class="fas fa-graduation-cap"></i><span>Abre el nuevo icono en tu pantalla de inicio e inicia sesión una vez. Desde entonces se abre como una app.</span></li>',
        '<li><i class="fas fa-ellipsis-vertical"></i><span>Tap the <b>⋮</b> menu in the top corner of your browser.</span></li>': '<li><i class="fas fa-ellipsis-vertical"></i><span>Toca el menú <b>⋮</b> en la esquina superior de tu navegador.</span></li>',
        '<li><i class="fas fa-square-plus"></i><span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li>': '<li><i class="fas fa-square-plus"></i><span>Toca <b>Instalar app</b> o <b>Añadir a pantalla de inicio</b>.</span></li>',
        '<li><i class="fas fa-check"></i><span>Tap <b>Install</b>.</span></li>': '<li><i class="fas fa-check"></i><span>Toca <b>Instalar</b>.</span></li>',

        // header and navigation
        'Spanish student': 'Estudiante de español',
        'Music student': 'Estudiante de música',
        'Admin': 'Administrador',
        'Tutoring Portal': 'Portal de clases',
        'Welcome!': '¡Bienvenido!',
        'Logout': 'Cerrar sesión',
        'Log out': 'Cerrar sesión',
        'Courses': 'Cursos',
        'Resources': 'Recursos',
        'Your Space': 'Tu espacio',
        'Speaking & Writing Practice': 'Práctica de conversación y escritura',
        'Practice': 'Práctica',
        'Community': 'Comunidad',
        'Book a lesson': 'Reservar una clase',
        'Book Your Next Lesson': 'Reserva tu próxima clase',
        'Sections': 'Secciones',
        'Menu': 'Menú',
        'Close': 'Cerrar',
        'Open menu': 'Abrir menú',
        'Help': 'Ayuda',
        'Language': 'Idioma',

        // courses, lessons, quiz
        'Your Student Folder': 'Tu carpeta de estudiante',
        'Access your personal learning materials, notes, and documents': 'Accede a tus materiales, notas y documentos personales',
        'Access your personal learning materials, lesson notes, and assignments': 'Accede a tus materiales, notas de clase y tareas personales',
        'Your Personal Learning Space': 'Tu espacio personal de aprendizaje',
        'Your personal folder is being set up. Check back soon!': 'Tu carpeta personal se está preparando. ¡Vuelve pronto!',
        'My Courses': 'Mis cursos',
        'Pick up where you left off, or start something new': 'Continúa donde lo dejaste o empieza algo nuevo',
        'No courses yet — Aaron will add them here soon!': 'Aún no hay cursos: ¡Aaron los añadirá aquí pronto!',
        'All Courses': 'Todos los cursos',
        '0% complete': '0% completado',
        'No resources available yet.': 'Aún no hay recursos disponibles.',
        'Coming Soon': 'Próximamente',
        'Resources are being curated for you. Check back soon!': 'Estamos preparando recursos para ti. ¡Vuelve pronto!',
        'Lesson Notes': 'Notas de la lección',
        'Quick Quiz': 'Quiz rápido',
        'Correct!': '¡Correcto!',
        'Video': 'Video',
        'Notes': 'Notas',
        'Audio': 'Audio',
        'Tense': 'Tiempo verbal',
        'Select a verb above.': 'Elige un verbo arriba.',
        'This Week from Aaron': 'Esta semana, de parte de Aaron',
        '📌 This Week': '📌 Esta semana',
        'Student Community': 'Comunidad de estudiantes',
        'Connect with fellow students': 'Conéctate con otros estudiantes',
        'Just now': 'Justo ahora',
        'Use this space to ask questions, share tips, and connect with fellow students.': 'Usa este espacio para hacer preguntas, compartir consejos y conectar con otros estudiantes.',
        'Fellow Student': 'Compañero/a de estudios',
        'Search a verb… (e.g. tener, or "to have")': 'Busca un verbo… (p. ej. tener, o "to have")',

        // app update / install / generic
        'A new version of the portal is ready.': 'Hay una nueva versión del portal.',
        'Update': 'Actualizar',
        'Later': 'Más tarde',
        'Got it': 'Entendido',
        'Share': 'Compartir',
        'Add to Home Screen': 'Añadir a pantalla de inicio',
        'Keep this portal on your home screen: tap': 'Ten este portal en tu pantalla de inicio: toca',
        ', then': ', luego',
        'Cancel': 'Cancelar',
        'Send': 'Enviar',
        'Save': 'Guardar',
        'Delete': 'Eliminar',
        'Edit': 'Editar',
        'Next': 'Siguiente',
        'Back': 'Atrás',
        'Today': 'Hoy',
        'Listen': 'Escuchar',
        'Type': 'Escribir',
        'End': 'Terminar',
        'End session': 'Terminar sesión',
        'Update available': 'Actualización disponible',

        // practice: header, plan, modes
        'Preparing your session…': 'Preparando tu sesión…',
        'Session ended. Come back any time to practise again.': 'Sesión terminada. Vuelve cuando quieras a practicar.',
        'Practice again': 'Practicar otra vez',
        'Practising today': 'Practicando hoy',
        'Practising today:': 'Practicando hoy:',
        'On the plan': 'En el plan',
        'On the plan:': 'En el plan:',
        'Nothing to fix': 'Nada que corregir',
        'Your tutor found no mistakes in this message.': 'Tu tutor no encontró errores en este mensaje.',
        'Grammar': 'Gramática',
        'You wrote': 'Escribiste',
        'Example': 'Ejemplo',
        'Skill mastered': 'Habilidad dominada',
        'Mission complete': 'Misión cumplida',
        'chatted in Spanish': 'chateaste en español',
        'Your recap': 'Tu resumen',
        'Wrapping up your session…': 'Terminando tu sesión…',
        'Nice work today': 'Buen trabajo hoy',
        'YOU WROTE': 'ESCRIBISTE',
        'PERFECT': 'PERFECTO',
        'RESPONSE': 'RESPUESTA',
        'Went well': 'Salió bien',
        'Work on': 'A trabajar',
        'Tip': 'Consejo',
        'words': 'palabras',
        'Transcribing…': 'Transcribiendo…',

        // reminders
        'Want a reminder?': '¿Quieres un recordatorio?',
        'Turn on reminders': 'Activar recordatorios',
        'Not now': 'Ahora no',
        'Reminders are on 🎉': 'Los recordatorios están activados 🎉',
        'You can change the time or turn them off in the ⚙ settings.': 'Puedes cambiar la hora o desactivarlos en los ajustes ⚙.',
        'Reminders are blocked': 'Los recordatorios están bloqueados',
        'Your browser blocked notifications. You can allow them in the site settings.': 'Tu navegador bloqueó las notificaciones. Puedes permitirlas en los ajustes del sitio.',
        'Could not turn on reminders': 'No se pudieron activar los recordatorios',
        'Try again from the ⚙ settings.': 'Inténtalo de nuevo desde los ajustes ⚙.',
        'Practice reminders': 'Recordatorios de práctica',
        'Remind me around': 'Recuérdame hacia las',
        'Send me a test': 'Envíame una prueba',
        'Sent! Check your notifications': '¡Enviado! Revisa tus notificaciones',
        'Could not send. Try again in a minute': 'No se pudo enviar. Inténtalo en un minuto',
        'Sending…': 'Enviando…',
        'One reminder a day at most, only when it helps your streak.': 'Como máximo un recordatorio al día, solo cuando ayuda a tu racha.',
        'Notifications are blocked for this site. Allow them in your browser settings to use reminders.': 'Las notificaciones están bloqueadas para este sitio. Permítelas en los ajustes del navegador para usar los recordatorios.',
        'Could not turn on reminders on this device.': 'No se pudieron activar los recordatorios en este dispositivo.',
        'On iPhone, add the portal to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on reminders.': 'En iPhone, primero añade el portal a tu pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrelo desde ahí para activar los recordatorios.',

        // tutor style (adults)
        'Tutor style': 'Estilo del tutor',
        'Friendly': 'Amable',
        'Direct': 'Directo',
        'Unfiltered': 'Sin filtro',
        'Unfiltered means swearing, insults, flirting and rude role-play when you ask for it. Nothing explicit, hateful or threatening.': 'Sin filtro significa palabrotas, insultos, coqueteo y juegos de rol groseros cuando lo pidas. Nada explícito, de odio ni amenazante.',
        'Anything else? e.g. Be a rude taxi driver in Madrid and insult me when I get it wrong.': '¿Algo más? Por ejemplo: Sé un taxista grosero de Madrid y insúltame cuando me equivoque.',

        // practice: streak, XP, missions, path, weekly recap
        'Start this week': 'Empezar esta semana',
        'Mastered this week': 'Dominado esta semana',
        'From your tutor': 'De tu tutor',
        'Next up:': 'Lo siguiente:',
        'of 7 days': 'de 7 días',
        'Daily goal done': 'Meta diaria cumplida',
        'day streak': 'días de racha',
        'Keep going': 'Sigue así',
        'Streak freeze used': 'Congelación de racha usada',
        'YOUR PATH': 'TU RUTA',
        'See my path': 'Ver mi ruta',
        'No path yet. Your teacher will set up the units of your course here.': 'Aún no hay ruta. Tu profesor pondrá aquí las unidades de tu curso.',
        'Practise this unit': 'Practicar esta unidad',
        'Unit complete': 'Unidad completada',
        'TODAY': 'HOY',
        'Do it now': 'Hazlo ahora',
        'Your focus areas': 'Tus áreas de enfoque',
        'Weekly XP': 'XP semanal',
        'DID YOU KNOW': '¿SABÍAS QUE?',
        'best streak': 'mejor racha',
        'practice days': 'días de práctica',
        'messages sent': 'mensajes enviados',
        'words written': 'palabras escritas',
        'saved words': 'palabras guardadas',
        'minutes practising': 'minutos practicando',
        'focus-area uses done right': 'usos correctos de áreas de enfoque',
        'words saved': 'palabras guardadas',
        'XP earned': 'XP ganado',
        'Your week': 'Tu semana',
        'Mastered': 'Dominado',
        'Saved on this device.': 'Guardado en este dispositivo.',
        'No saved words yet.': 'Aún no tienes palabras guardadas.',
        'Tap a word in a tutor message, then the bookmark, and it will be kept here.': 'Toca una palabra en un mensaje del tutor y luego el marcador, y se guardará aquí.',
        'Practise these words': 'Practicar estas palabras',
        'My progress': 'Mi progreso',
        'Your practice': 'Tu práctica',
        'My words': 'Mis palabras',
        'Words you save from the chat': 'Palabras que guardas del chat',
        'Tap and just talk: it sends by itself': 'Toca y habla: se envía solo',

        // practice chat: activities, mission, milestones, recap, voice
        "Today's mission": 'Misión de hoy',
        'Use': 'Usa',
        'correctly': 'correctamente',
        'You used': 'Usaste',
        'three times. Well done!': 'tres veces. ¡Muy bien!',
        'Done:': 'Hecho:',
        'Mission complete!': '¡Misión cumplida!',
        'Daily mission complete': 'Misión diaria cumplida',
        'Not yet': 'Todavía no',
        'Almost: use it on another day': 'Casi: úsalo otro día',
        'Tap any word to see what it means': 'Toca cualquier palabra para ver qué significa',
        'My practice plan': 'Mi plan de práctica',
        'Work on what you are focusing on': 'Trabaja en lo que estás practicando',
        'Roleplay': 'Juego de rol',
        'Describe a picture': 'Describe una imagen',
        'Describe a scene in your own words': 'Describe una escena con tus propias palabras',
        'Grammar drill': 'Práctica de gramática',
        'Short, game-like exercises': 'Ejercicios cortos, como un juego',
        'Free chat': 'Charla libre',
        'Talk about anything you like': 'Habla de lo que quieras',
        'Show in English': 'Mostrar en inglés',
        'Listen again': 'Escuchar otra vez',
        'Listen slowly': 'Escuchar despacio',
        'Feedback on your message': 'Comentarios sobre tu mensaje',
        'Listen to the example': 'Escuchar el ejemplo',
        'Remove from my words': 'Quitar de mis palabras',
        'Save this word': 'Guardar esta palabra',
        'Days practised': 'Días practicados',
        'days in a row': 'días seguidos',
        'Keep it going.': 'Sigue así.',
        'Three days in a row': 'Tres días seguidos',
        'The hardest part of any habit is the first few days. You are through them.': 'Lo más difícil de cualquier hábito son los primeros días. Ya los pasaste.',
        'A full week': 'Una semana completa',
        'Seven days of Spanish. This is starting to stick.': 'Siete días de español. Esto empieza a quedarse.',
        'Two weeks strong': 'Dos semanas con fuerza',
        'Two weeks of showing up. Your Spanish is better for every one of them.': 'Dos semanas apareciendo. Tu español mejora con cada una.',
        'One month': 'Un mes',
        'Thirty days. This is not a streak any more, it is a habit.': 'Treinta días. Ya no es una racha, es un hábito.',
        'Sixty days': 'Sesenta días',
        'Two months of steady practice. Few people get this far.': 'Dos meses de práctica constante. Pocas personas llegan tan lejos.',
        'One hundred days': 'Cien días',
        'A hundred days of Spanish. Remarkable.': 'Cien días de español. Extraordinario.',
        'Path complete': 'Ruta completada',
        'You have finished every unit. Well done.': 'Terminaste todas las unidades. ¡Bien hecho!',
        'You have finished your whole path.': 'Terminaste toda tu ruta.',
        'Streak freeze ready: if you miss one day, your streak is safe.': 'Congelación de racha lista: si te saltas un día, tu racha está a salvo.',
        'Did you know': '¿Sabías que',
        'The last 7 days': 'Los últimos 7 días',
        "Today's goal is done — nice work.": 'La meta de hoy está cumplida: buen trabajo.',
        'Lesson progress': 'Progreso de la lección',
        'My progress and daily streak': 'Mi progreso y racha diaria',
        'Voice conversation: tap while it speaks to answer now': 'Conversación de voz: toca mientras habla para responder ya',
        'Cancel this recording': 'Cancelar esta grabación',
        'Talk: hold to speak and let go to send, or tap to start and tap again to send': 'Habla: mantén para hablar y suelta para enviar, o toca para empezar y vuelve a tocar para enviar',
        'slide to cancel': 'desliza para cancelar',
        'hold to talk': 'mantén para hablar',
        'One moment, I am still answering.': 'Un momento, todavía estoy respondiendo.',
        'Getting ready…': 'Preparando…',
        'Release to cancel': 'Suelta para cancelar',
        'Release to send': 'Suelta para enviar',
        'Tap to send': 'Toca para enviar',
        'Reply coming…': 'Respuesta en camino…',
        'Listening… just talk': 'Escuchando… solo habla',
        'Speaking… tap the circle to answer': 'Hablando… toca el círculo para responder',
        '(microphone not open)': '(micrófono cerrado)',
        'Something went wrong — tap the mic to try again': 'Algo salió mal: toca el micrófono para intentarlo de nuevo',
        'Paused — tap the mic to keep talking': 'En pausa: toca el micrófono para seguir hablando',
        'No microphone found — connect one and tap the mic': 'No se encontró micrófono: conecta uno y toca el micrófono',
        'Could not open the microphone — tap the mic to try again': 'No se pudo abrir el micrófono: toca el micrófono para intentarlo de nuevo',
        "I can't hear you. Check that the right microphone is selected and not muted.": 'No te oigo. Revisa que el micrófono correcto esté seleccionado y no silenciado.',
        'NEW HIGH SCORE': 'NUEVO RÉCORD',
        'Come back tomorrow and start a streak 🔥': 'Vuelve mañana y empieza una racha 🔥',
        'Continue': 'Continuar',
        'Done': 'Listo',
        'Accuracy': 'Precisión',
        'Streak': 'Racha',
        'XP': 'XP',

        // progress sheet, recap
        'Not quite — the right answer is': 'Casi: la respuesta correcta es',
        'Completed!': '¡Completada!',
        'Mark as Complete': 'Marcar como completada',
        'Trouble playing the video? Open it in a new tab': '¿Problemas para reproducir el video? Ábrelo en una pestaña nueva',
        'UNTIL TOMORROW\'S PRACTICE': 'HASTA LA PRÁCTICA DE MAÑANA',
        'Perfect response': 'Respuesta perfecta',
        'NO CORRECTIONS': 'SIN CORRECCIONES',
        'A clean use is a message your tutor found completely correct that used the focus area. Up to 2 count per day, so mastering one takes at least 3 days.': 'Un uso limpio es un mensaje que tu tutor encontró totalmente correcto y que usó el área de enfoque. Cuentan hasta 2 por día, así que dominar un área toma al menos 3 días.',
        "Last week's recap": 'Resumen de la semana pasada',
        'You have written': 'Has escrito',
        'in Spanish this week.': 'en español esta semana.',
        '% of the way': '% del camino',
        'Not yet started': 'Sin empezar',
        'Words': 'Palabras',

        // chat: settings, dock, help
        'Voice': 'Voz',
        'Tutor voice': 'Voz del tutor',
        'Backup voice (this device)': 'Voz de respaldo (este dispositivo)',
        'Not available here': 'No disponible aquí',
        'Automatic': 'Automática',
        'Pace': 'Ritmo',
        'Normal': 'Normal',
        'Slow': 'Lento',
        'Sound effects': 'Efectos de sonido',
        'Vibration': 'Vibración',
        'Hands-free conversation': 'Conversación sin manos',
        '(beta)': '(beta)',
        'Microphone problems?': '¿Problemas con el micrófono?',
        'Copy diagnostics': 'Copiar diagnóstico',
        'Hint': 'Pista',
        'Explain in English': 'Explicar en inglés',
        'Say it simpler': 'Decirlo más fácil',
        'Slide to cancel': 'Desliza para cancelar',
        'Hold to talk': 'Mantén para hablar',
        'Need a hand?': '¿Necesitas ayuda?',
        'A nudge for what to say': 'Una pista de qué decir',
        'What the tutor just said': 'Lo que acaba de decir el tutor',
        'Easier Spanish, same idea': 'Español más fácil, misma idea',
        'Switch activity': 'Cambiar de actividad',
        'Voice settings': 'Ajustes de voz',
        'Cancel this voice note': 'Cancelar esta nota de voz',
        'Send this voice note': 'Enviar esta nota de voz',
        'Stop talking and type instead': 'Dejar de hablar y escribir',
        'End the voice conversation': 'Terminar la conversación de voz',
        'Help: hint, explain, say it simpler': 'Ayuda: pista, explicar, decirlo más fácil',
        'Activities, progress and words': 'Actividades, progreso y palabras',
        'Type instead': 'Escribir en su lugar',
        'Talk instead': 'Hablar en su lugar',
        'Basic recognition (your browser)': 'Reconocimiento básico (tu navegador)',
        'Voice note': 'Nota de voz',
        'Your message': 'Tu mensaje',
        'Tap and just talk': 'Toca y habla',
        'Start a voice conversation': 'Iniciar una conversación de voz',
        'Read the replies aloud': 'Leer las respuestas en voz alta',
        'End this practice session': 'Terminar esta sesión de práctica',
        'Type your message here...': 'Escribe tu mensaje aquí...',
        'Escribe en español…': 'Escribe en español…',
        'Reading pace': 'Ritmo de lectura',

        // quiz
        'Not quite': 'Casi',
        'Question': 'Pregunta',
        'Submit': 'Enviar',
        'Check': 'Comprobar',
        'Next question': 'Siguiente pregunta',
        'Try again.': 'Inténtalo de nuevo.',
    };

    // ------------------------------------------------------------------ number patterns (checked after the exact dictionary)
    const pl = (n, one, many) => (+n === 1 ? one : many);
    const PATTERNS = [
        [/^(\d+) different words · longest message (\d+) words$/, m => `${m[1]} palabras distintas · el mensaje más largo tiene ${m[2]} palabras`],
        [/^(\d+) messages? sent$/, m => `${m[1]} ${pl(m[1], 'mensaje enviado', 'mensajes enviados')}`],
        [/^(\d+) with no corrections$/, m => `${m[1]} sin correcciones`],
        [/^(\d+) perfect responses?$/, m => `${m[1]} ${pl(m[1], 'respuesta perfecta', 'respuestas perfectas')}`],
        [/^(\d+) XP to level (\d+)$/, m => `${m[1]} XP para el nivel ${m[2]}`],
        [/^\+(\d+) XP today · (\d+) XP to level (\d+)$/, m => `+${m[1]} XP hoy · ${m[2]} XP para el nivel ${m[3]}`],
        [/^(\d+)% of the way$/, m => `${m[1]}% del camino`],
        [/^Unit (\d+) of (\d+):$/, m => `Unidad ${m[1]} de ${m[2]}:`],
        [/^(\d+) times in your messages\.$/, m => `${m[1]} veces en tus mensajes.`],
        [/^correctly (\d+) times in your messages\.$/, m => `correctamente ${m[1]} veces en tus mensajes.`],
        [/^Send (\d+) more messages? today to keep your streak going\.$/, m => `Envía ${m[1]} ${pl(m[1], 'mensaje más', 'mensajes más')} hoy para mantener tu racha.`],
        [/^(\d+) of (\d+) clean uses$/, m => `${m[1]} de ${m[2]} usos limpios`],
        [/^(\d+) words$/, m => `${m[1]} palabras`],
        [/^(\d+)-day streak — today's goal is done$/, m => `Racha de ${m[1]} ${pl(m[1], 'día', 'días')}: la meta de hoy está cumplida`],
        [/^(\d+)-day streak — (\d+) more messages? today keeps it going$/, m => `Racha de ${m[1]} ${pl(m[1], 'día', 'días')}: ${m[2]} ${pl(m[2], 'mensaje más', 'mensajes más')} hoy la mantienen`],
        [/^Today's mission: complete$/, () => 'Misión de hoy: cumplida'],
        [/^Today's mission: (\d+) of (\d+)$/, m => `Misión de hoy: ${m[1]} de ${m[2]}`],
        [/^Welcome, (.+)!$/, m => `¡Hola, ${m[1]}!`],
        [/^(.+)'s Folder$/, m => `Carpeta de ${m[1]}`],
        [/^Level (\d+)!$/, m => `¡Nivel ${m[1]}!`],
        [/^Level (\d+)$/, m => `Nivel ${m[1]}`],
        [/^(\d+) XP so far\. (\d+) to level (\d+)\.$/, m => `${m[1]} XP hasta ahora. Faltan ${m[2]} para el nivel ${m[3]}.`],
        [/^(\d+) lessons?$/, m => `${m[1]} ${pl(m[1], 'lección', 'lecciones')}`],
        [/^(.+) · (\d+) lessons?$/, m => `${m[1]} · ${m[2]} ${pl(m[2], 'lección', 'lecciones')}`],
        [/^(\d+)\/(\d+) complete$/, m => `${m[1]}/${m[2]} completado`],
        [/^(\d+)% complete$/, m => `${m[1]}% completado`],
        [/^Question (\d+)$/, m => `Pregunta ${m[1]}`],
        [/^Quiz \((\d+)\)$/, m => `Quiz (${m[1]})`],
        [/^Why not ([A-Z])\?$/, m => `¿Por qué no ${m[1]}?`],
        [/^Why ([A-Z])\?$/, m => `¿Por qué ${m[1]}?`],
        [/^(\d+) messages?$/, m => `${m[1]} ${pl(m[1], 'mensaje', 'mensajes')}`],
        [/^(\d+) \/ (\d+) messages$/, m => `${m[1]} / ${m[2]} mensajes`],
        [/^(\d+) words?$/, m => `${m[1]} ${pl(m[1], 'palabra', 'palabras')}`],
        [/^(\d+) days?$/, m => `${m[1]} ${pl(m[1], 'día', 'días')}`],
        [/^\((\d+) to go\)$/, m => `(faltan ${m[1]})`],
        [/^(\d+) messages? with no mistakes at all$/, m => `${m[1]} ${pl(m[1], 'mensaje', 'mensajes')} sin ningún error`],
        [/^(\d+)-day streak$/, m => `racha de ${m[1]} ${pl(m[1], 'día', 'días')}`],
        [/^(\d+) of (\d+) days?$/, m => `${m[1]} de ${m[2]} días`],
        [/^(\d+) of (\d+)$/, m => `${m[1]} de ${m[2]}`],
        [/^Up from (\d+) messages? the week before\.$/, m => `Subiste desde ${m[1]} ${pl(m[1], 'mensaje', 'mensajes')} la semana anterior.`],
        [/^Come back tomorrow to make it a$/, () => 'Vuelve mañana y consigue una'],
        [/^A streak freeze covered (a day|\d+ days) this week\. Best so far: (\d+)\.$/, m => `Una congelación de racha cubrió ${m[1] === 'a day' ? 'un día' : m[1].replace(' days', ' días')} esta semana. Mejor hasta ahora: ${m[2]}.`],
        [/^Best so far: (\d+)\.$/, m => `Mejor hasta ahora: ${m[1]}.`],
        [/^No practice that week\. Today is a fresh start: (\d+) messages begins a new streak\.$/, m => `No practicaste esa semana. Hoy es un nuevo comienzo: ${m[1]} mensajes inician una racha nueva.`],
        [/^(\d+)% of the way to mastering this$/, m => `${m[1]}% del camino para dominar esto`],
        [/^(\d+) out of (\d+)$/, m => `${m[1]} de ${m[2]}`],
        [/^Remind me around (\d+):00 ?(AM|PM)$/, m => `${m[1]}:00 ${m[2]}`],
    ];

    // ------------------------------------------------------------------ the engine
    const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    // Never translated: scripts, typed text, lesson content, the chat messages, and the admin screens.
    const SKIP = 'script,style,textarea,pre,code,[data-no-i18n],.lesson-text-content,.lesson-view-title,.ai-bubble p,.ai-translation,.ai-user-text,.msg-text,[id^="admin"],[class*="admin-"],.practice-card,.practice-body';
    const norm = s => String(s).replace(/\s+/g, ' ').trim();
    const nodes = new Map();   // text node -> original text, for restoring English
    const attrs = new Map();   // element -> { attr: original }
    let lang = 'en';
    let busy = false;
    let observer = null;

    // Dates such as "OCT 19–25", "Nov 2 – Nov 8" or "Mon, 3 Nov": only text made purely of month/weekday names, numbers and punctuation is changed.
    const DATE_WORDS = { jan: 'ene', feb: 'feb', mar: 'mar', apr: 'abr', may: 'may', jun: 'jun', jul: 'jul', aug: 'ago', sep: 'sep', sept: 'sep', oct: 'oct', nov: 'nov', dec: 'dic',
        january: 'enero', february: 'febrero', march: 'marzo', april: 'abril', june: 'junio', july: 'julio', august: 'agosto', september: 'septiembre', october: 'octubre', november: 'noviembre', december: 'diciembre',
        mon: 'lun', tue: 'mar', wed: 'mié', thu: 'jue', fri: 'vie', sat: 'sáb', sun: 'dom', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo' };
    const DATE_ONLY = /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?|[\d–\-\s:,.])+$/i;
    function dateText(n) {
        if (!DATE_ONLY.test(n) || !/[a-z]{3}/i.test(n)) return null;
        let changed = false;
        const out = n.replace(/[A-Za-z]+/g, w => { const r = DATE_WORDS[w.toLowerCase()]; if (r === undefined) return w; changed = true; return w === w.toUpperCase() ? r.toUpperCase() : r; });
        return changed ? out : null;
    }
    function lookup(text) {
        const n = norm(text);
        if (!n) return null;
        if (Object.prototype.hasOwnProperty.call(ES, n)) return ES[n];
        for (const [re, fn] of PATTERNS) { const m = n.match(re); if (m) return fn(m); }
        return dateText(n);
    }
    function translate(text) {
        const es = lookup(text);
        if (es === null) return text;
        const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
        return lead + es + trail;
    }
    function skipped(el) { return !el || (el.closest && !!el.closest(SKIP)); }

    function doText(node) {
        const p = node.parentNode;
        if (!p || skipped(p.nodeType === 1 ? p : p.parentElement)) return;
        const known = nodes.get(node);
        const cur = node.nodeValue;
        if (known !== undefined && cur === translate(known)) return;   // already our translation
        const out = translate(cur);
        if (out !== cur) { nodes.set(node, cur); node.nodeValue = out; }
        else if (known !== undefined) nodes.delete(node);              // the app wrote new text over ours
    }
    function doAttrs(el) {
        if (!el.getAttribute || skipped(el)) return;
        for (const a of ATTRS) {
            const v = el.getAttribute(a);
            if (!v) continue;
            const rec = attrs.get(el);
            if (rec && rec[a] !== undefined && v === translate(rec[a])) continue;
            const out = translate(v);
            if (out !== v) { const r = rec || {}; r[a] = v; attrs.set(el, r); el.setAttribute(a, out); }
            else if (rec && rec[a] !== undefined) delete rec[a];
        }
    }
    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) { doText(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1) { if (skipped(root)) return; doAttrs(root); }
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let n = tw.nextNode();
        while (n) {
            if (n.nodeType === 3) doText(n);
            else if (n.nodeType === 1) {
                if (skipped(n)) { n = nextSkipping(tw, n); continue; }
                doAttrs(n);
            }
            n = tw.nextNode();
        }
    }
    function nextSkipping(tw, el) {
        // jump past a skipped subtree
        let last = el;
        while (last.lastChild) last = last.lastChild;
        tw.currentNode = last;
        return tw.nextNode();
    }
    function restore() {
        nodes.forEach((orig, node) => { if (node.isConnected) node.nodeValue = orig; });
        attrs.forEach((rec, el) => { if (el.isConnected) Object.keys(rec).forEach(a => el.setAttribute(a, rec[a])); });
        nodes.clear(); attrs.clear();
    }

    function onMutations(list) {
        if (busy || lang !== 'es') return;
        busy = true;
        try {
            for (const m of list) {
                if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
                else if (m.type === 'characterData') doText(m.target);
                else if (m.type === 'attributes') doAttrs(m.target);
            }
            ensureToggles();
        } finally { observer.takeRecords(); busy = false; }
    }
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(onMutations);
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }

    // ------------------------------------------------------------------ the language switch
    // Three places: a pill on the sign-in screen, one in the header (desktop), and one in the phone menu drawer.
    function pillHtml() {
        return `<button type="button" data-lang="en" aria-label="English"${lang === 'en' ? ' aria-pressed="true"' : ''}>EN</button><button type="button" data-lang="es" aria-label="Español"${lang === 'es' ? ' aria-pressed="true"' : ''}>ES</button>`;
    }
    function makePill(cls) {
        const d = document.createElement('div');
        d.className = 'lang-pill ' + cls;
        d.setAttribute('data-no-i18n', '');
        d.setAttribute('role', 'group');
        d.innerHTML = pillHtml();
        return d;
    }
    function ensureToggles() {
        if (!document.body) return;
        if (!document.getElementById('langPillLogin')) { const p = makePill('lang-pill-login'); p.id = 'langPillLogin'; document.body.appendChild(p); }
        const ui = document.querySelector('#mainApp .user-info');
        if (ui && !ui.querySelector('.lang-pill')) ui.insertBefore(makePill('lang-pill-header'), ui.firstChild);
        const foot = document.querySelector('#navDrawer .nav-foot');
        if (foot && !foot.querySelector('.lang-pill')) foot.insertBefore(makePill('lang-pill-nav'), foot.firstChild);
    }
    function refreshPills() {
        document.querySelectorAll('.lang-pill button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'));
    }
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('.lang-pill button');
        if (b) { e.preventDefault(); e.stopPropagation(); set(b.dataset.lang, { user: true }); }
    }, true);

    // The phone menu drawer copies its labels from the tab buttons when it is built, so it is rebuilt from English text before translating
    // and again after restoring English (otherwise it keeps whatever language the tabs had when it was drawn).
    function rebuildNav() {
        try { if (document.getElementById('navDrawer') && typeof window.navRender === 'function') window.navRender(); } catch (e) {}
    }

    // opts.user: the student picked it just now (remember WHEN, so the newest choice wins across devices; script.js saves it to the student's synced progress).
    // opts.at: a choice that came from another device (keeps that device's time).
    function set(next, opts) {
        opts = opts || {};
        next = next === 'es' ? 'es' : 'en';
        lang = next;
        try {
            localStorage.setItem(KEY, next);
            if (opts.user) localStorage.setItem(KEY + 'T', String(Date.now()));
            else if (opts.at) localStorage.setItem(KEY + 'T', String(opts.at));
        } catch (e) {}
        document.documentElement.lang = next;
        busy = true;
        try {
            if (next === 'es') { rebuildNav(); walk(document.body); } else { restore(); rebuildNav(); }
        } finally { if (observer) observer.takeRecords(); busy = false; }
        ensureToggles(); refreshPills();
        try { document.dispatchEvent(new CustomEvent('uilangchange', { detail: { lang: next, user: !!opts.user, at: choiceTime() } })); } catch (e) {}
    }

    // For the app's own code: translate one string on demand (returns it unchanged in English or when unknown).
    function t(text) { return lang === 'es' ? translate(text) : text; }

    function choiceTime() { try { return +localStorage.getItem(KEY + 'T') || 0; } catch (e) { return 0; } }
    window.i18n = { set, get: () => lang, t, ES, PATTERNS, lookup, nodes, choiceTime };

    function init() {
        startObserver();
        let saved = 'en';
        try { saved = localStorage.getItem(KEY) || 'en'; } catch (e) {}
        lang = 'en';
        ensureToggles();
        set(saved);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
