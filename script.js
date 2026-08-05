// Global variables
let currentUser = null;
let _accessToken = null;

// ============================================================
// SUPABASE CONFIG — raw fetch client, no external library
// ============================================================
const SUPABASE_URL = 'https://leqbcbtlltvinizbkiya.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWJjYnRsbHR2aW5pemJraXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTAzMzMsImV4cCI6MjA5NDgyNjMzM30.8YX3gte7d6voWCqkZAuV9BR-mAmat9ObvmTffFt3NOo';
const SESSION_STORE = 'aaron_portal_session';

function _headers(token) {
    return {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + (token || SUPABASE_KEY)
    };
}

// --- Auth ---
async function sbSignUp(email, password, name, type) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: _headers(),
        body: JSON.stringify({ email, password, data: { name, type } })
    });
    return r.json();
}

async function sbSignIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: _headers(),
        body: JSON.stringify({ email, password })
    });
    return r.json();
}

async function sbSignOut() {
    if (_accessToken) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: 'POST', headers: _headers(_accessToken)
        });
    }
    _accessToken = null;
    localStorage.removeItem(SESSION_STORE);
}

function sbSaveSession(data, rememberMe = true) {
    _accessToken = data.access_token;
    const sessionData = JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        user: data.user
    });
    if (rememberMe) {
        localStorage.setItem(SESSION_STORE, sessionData);
    } else {
        sessionStorage.setItem(SESSION_STORE, sessionData);
        localStorage.removeItem(SESSION_STORE);
    }
}

function sbLoadSession() {
    try {
        const raw = localStorage.getItem(SESSION_STORE) || sessionStorage.getItem(SESSION_STORE);
        const s = JSON.parse(raw);
        if (s && s.access_token) { _accessToken = s.access_token; return s; }
    } catch(e) {}
    return null;
}

async function sbRefreshSession(refreshToken) {
    try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST', headers: _headers(),
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        const data = await r.json();
        if (data.access_token) {
            // Preserve remember-me preference
            const inLocal = !!localStorage.getItem(SESSION_STORE);
            sbSaveSession(data, inLocal);
            return data;
        }
    } catch(e) {}
    return null;
}

// --- Database ---
async function sbGetProfile(userId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: _headers(_accessToken)
    });
    const data = await r.json();
    return Array.isArray(data) ? data[0] : null;
}

async function sbInsertProfile(profile) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: { ..._headers(_accessToken), 'Prefer': 'return=minimal' },
        body: JSON.stringify(profile)
    });
}

async function sbGetProgress(userId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${userId}&select=course_id,lesson_id`, {
        headers: _headers(_accessToken)
    });
    return r.json();
}

async function sbUpsertProgress(userId, courseId, lessonId) {
    await fetch(`${SUPABASE_URL}/rest/v1/progress`, {
        method: 'POST',
        headers: { ..._headers(_accessToken), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: userId, course_id: courseId, lesson_id: lessonId })
    });
}

async function sbDeleteProgress(userId, courseId, lessonId) {
    await fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${userId}&course_id=eq.${courseId}&lesson_id=eq.${lessonId}`, {
        method: 'DELETE', headers: _headers(_accessToken)
    });
}


// Voice input state — live speech-to-text via the Web Speech API, streamed
// straight into the chat text box (not a separate record-then-send pipeline).
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = !!SpeechRecognitionCtor;
let recognition = null;
let isListening = false;
let committedTranscript = '';

// ============================================================
// ADMIN CODE — Change this to whatever you want
// Enter this code at the login screen to open the Course Manager
// ============================================================
const ADMIN_CODE = 'ADMIN-AARON';

// ============================================================
// COURSES DATABASE
// This is the default course data. After editing courses in the
// Admin Panel, click "Export JSON" and paste the result here
// to make your changes permanent across all browsers.
// ============================================================
const defaultCourses = [
    {
        id: 'spanish-101',
        subject: 'spanish',
        title: 'Spanish 101',
        description: 'Go from zero to holding real conversations in Spanish. 7 modules covering greetings, numbers, grammar, verbs, travel phrases, weather, and free speaking.',
        level: 'Beginner',
        coverImage: '',
        lessons: [
            {
                id: 'sp101-m1',
                section: 'FOUNDATIONS',
                title: 'Module 1 — Greetings & Introductions',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🕐 Greetings by time of day</h2>
<ul>
<li><strong>Buenos días</strong> — Good morning</li>
<li><strong>Buenas tardes</strong> — Good afternoon</li>
<li><strong>Buenas noches</strong> — Good evening / Good night</li>
<li><strong>Hola</strong> — Hello (any time)</li>
<li><strong>Adiós / Chao</strong> — Goodbye</li>
</ul>
<blockquote>💡 <em>Chao</em> is used a lot in Spain — borrowed from Italian "ciao."</blockquote>
<hr>
<h2>👋 Presentarse — Introducing yourself</h2>
<p><strong>To say your name:</strong></p>
<ul>
<li><strong>Hola, me llamo ___.</strong> — Hello, my name is ___.</li>
<li><strong>Hola, soy ___.</strong> — Hello, I am ___.</li>
</ul>
<p><strong>To ask someone's name:</strong></p>
<ul><li><strong>¿Cómo te llamas?</strong> — What's your name?</li></ul>
<p><strong>To say / ask your age:</strong></p>
<ul>
<li><strong>¿Cuántos años tienes?</strong> — How old are you?</li>
<li><strong>Tengo ___ años.</strong> — I am ___ years old.</li>
</ul>
<blockquote>💡 <em>Me llamo</em> literally means "I call myself" — more idiomatic than <em>soy</em> for introductions.</blockquote>
<hr>
<h2>😊 ¿Cómo estás? — How are you?</h2>
<ul>
<li><strong>¿Cómo estás?</strong> — How are you?</li>
<li><strong>¿Qué tal?</strong> — How's it going? (very common in Spain)</li>
<li><strong>Estoy bien, gracias.</strong> — I'm well, thank you.</li>
<li><strong>No muy bien.</strong> — Not very well.</li>
<li><strong>¿Y tú?</strong> — And you? (always ask back!)</li>
</ul>
<blockquote>💡 Key vocab: <strong>bien</strong> = good · <strong>estoy</strong> = I am</blockquote>
<hr>
<h2>📍 ¿De dónde eres? ¿Dónde vives?</h2>
<ul>
<li><strong>¿De dónde eres?</strong> — Where are you from? → <strong>Soy de ___.</strong> — I'm from ___.</li>
<li><strong>¿Dónde vives?</strong> — Where do you live? → <strong>Vivo en ___.</strong> — I live in ___.</li>
</ul>
<hr>
<h2>👋 Despedirse — Saying goodbye</h2>
<ul>
<li><strong>Ha sido un placer conocerte.</strong> — It's been a pleasure meeting you.</li>
<li><strong>Cuídate.</strong> — Take care.</li>
<li><strong>Hasta pronto.</strong> — See you soon.</li>
<li><strong>Hasta luego.</strong> — See you later.</li>
</ul>
<hr>
<h2>💬 Conversación de ejemplo</h2>
<blockquote>
<strong>A:</strong> ¡Hola! ¿Cómo te llamas?<br>
<strong>B:</strong> Me llamo Sara. ¿Y tú?<br>
<strong>A:</strong> Soy Aaron. ¿Cómo estás?<br>
<strong>B:</strong> Estoy bien, gracias. ¿Cuántos años tienes?<br>
<strong>A:</strong> Tengo 25 años. ¿De dónde eres?<br>
<strong>B:</strong> Soy de México. ¿Y tú?<br>
<strong>A:</strong> Vivo en Nueva York. ¡Mucho gusto, Sara!<br>
<strong>B:</strong> ¡Igualmente! Hasta pronto.
</blockquote>
<hr>
<h2>✅ Vocabulario clave</h2>
<ul>
<li><strong>Hola</strong> — Hello</li>
<li><strong>Me llamo / Soy</strong> — My name is / I am</li>
<li><strong>¿Cómo te llamas?</strong> — What's your name?</li>
<li><strong>¿Cómo estás? / ¿Qué tal?</strong> — How are you?</li>
<li><strong>Estoy bien</strong> — I'm well</li>
<li><strong>¿Y tú?</strong> — And you?</li>
<li><strong>¿Cuántos años tienes?</strong> — How old are you?</li>
<li><strong>Tengo ___ años</strong> — I am ___ years old</li>
<li><strong>¿De dónde eres?</strong> — Where are you from?</li>
<li><strong>Soy de ___</strong> — I'm from ___</li>
<li><strong>Vivo en ___</strong> — I live in ___</li>
<li><strong>Mucho gusto / Igualmente</strong> — Nice to meet you / Likewise</li>
<li><strong>Hasta luego / Hasta pronto</strong> — See you later / See you soon</li>
</ul>`,
                quiz: [
                    { question: 'How do you say "Good afternoon" in Spanish?', options: ['Buenos días', 'Buenas noches', 'Buenas tardes', 'Hasta luego'], correct: 2 },
                    { question: 'What does "¿Cómo te llamas?" mean?', options: ['How are you?', 'Where are you from?', 'What is your name?', 'How old are you?'], correct: 2 },
                    { question: 'How do you say "I am 28 years old" in Spanish?', options: ['Soy 28 años', 'Tengo 28 años', 'Estoy 28 años', 'Me llamo 28 años'], correct: 1 }
                ]
            },
            {
                id: 'sp101-m2',
                section: 'FOUNDATIONS',
                title: 'Module 2 — Numbers, Days, Seasons & Places',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🔢 Los números — Numbers</h2>
<p>Numbers are easy to learn in groups — each group follows a system.</p>
<h3>1–10 (memorise)</h3>
<p>uno · dos · tres · cuatro · cinco · seis · siete · ocho · nueve · diez</p>
<h3>11–15 (memorise — Latin roots)</h3>
<p>once · doce · trece · catorce · quince</p>
<blockquote>💡 <strong>Spain pronunciation:</strong> the <em>c</em> before e/i and <em>z</em> make a TH sound (like <em>think</em>). Latin American Spanish uses an S instead.</blockquote>
<h3>16–20 (system: diez + number, written as one word)</h3>
<ul>
<li><strong>dieciséis</strong> — 16 (diez + seis)</li>
<li><strong>diecisiete</strong> — 17 (diez + siete)</li>
<li><strong>dieciocho</strong> — 18 (diez + ocho)</li>
<li><strong>diecinueve</strong> — 19 (diez + nueve)</li>
<li><strong>veinte</strong> — 20 (memorise)</li>
</ul>
<h3>Tens (memorise the name, then add with "y")</h3>
<ul>
<li><strong>veinte</strong> — 20 → veintiuno, veintidós, veintitrés…</li>
<li><strong>treinta</strong> — 30 → treinta y uno, treinta y dos…</li>
<li><strong>cuarenta</strong> — 40</li>
<li><strong>cincuenta</strong> — 50</li>
<li><strong>sesenta</strong> — 60</li>
<li><strong>setenta</strong> — 70</li>
<li><strong>ochenta</strong> — 80</li>
<li><strong>noventa</strong> — 90</li>
</ul>
<blockquote>💡 From 21–29 veinte blends into <strong>veinti-</strong>: veintiuno, veintidós… From 31 onwards use <strong>y</strong>: treinta <strong>y</strong> uno.</blockquote>
<h3>Big numbers</h3>
<ul>
<li><strong>cien</strong> — 100</li>
<li><strong>ciento</strong> + number — 101–199 (ciento uno, ciento veinte…)</li>
<li><strong>mil</strong> — 1,000</li>
<li><strong>un millón</strong> — 1,000,000</li>
</ul>
<p>After that just combine: dos mil, tres mil, un millón doscientos… — with this system you can say any number from 1 to 1,000,000.</p>
<hr>
<h2>📅 Días de la semana — Days of the week</h2>
<p>Every day is named after a planet or celestial body:</p>
<ul>
<li><strong>lunes</strong> — Monday · 🌙 Luna (Moon) · <em>Where "lunatic" comes from — people who live on the moon!</em></li>
<li><strong>martes</strong> — Tuesday · ♂️ Marte (Mars) · <em>The day we go fight at work</em></li>
<li><strong>miércoles</strong> — Wednesday · ☿ Mercurio (Mercury) · <em>Hump day — we want to speed up</em></li>
<li><strong>jueves</strong> — Thursday · ♃ Júpiter (Jupiter)</li>
<li><strong>viernes</strong> — Friday · ♀️ Venus · <em>The most beautiful day of the week</em></li>
<li><strong>sábado</strong> — Saturday · ♄ Saturno (Saturn) · <em>Think of the Sabbath</em></li>
<li><strong>domingo</strong> — Sunday · ☀️ Domingo (Lord's Day)</li>
</ul>
<blockquote>💡 Once you learn Spanish days, they look familiar in other Romance languages too — French: lundi, mardi, mercredi… Italian: lunedì, martedì, mercoledì…</blockquote>
<hr>
<h2>🍂 Las estaciones — Seasons</h2>
<ul>
<li><strong>el verano</strong> — Summer · Made famous by Bad Bunny's <em>Un Verano Sin Ti</em></li>
<li><strong>el otoño</strong> — Autumn / Fall</li>
<li><strong>el invierno</strong> — Winter</li>
<li><strong>la primavera</strong> — Spring</li>
</ul>
<blockquote>💡 In Spanish there is no difference between <strong>b</strong> and <strong>v</strong> — verano sounds like berano. The b is sometimes slightly softer, but barely.</blockquote>
<hr>
<h2>🗓️ Los meses — Months of the year</h2>
<p>enero · febrero · marzo · abril · mayo · junio · julio · agosto · septiembre · octubre · noviembre · diciembre</p>
<blockquote>💡 Months are <strong>not capitalised</strong> in Spanish.</blockquote>
<hr>
<h2>📍 Vocabulario de lugares — Places</h2>
<ul>
<li><strong>el hotel</strong> — the hotel</li>
<li><strong>el hospital</strong> — the hospital</li>
<li><strong>el supermercado</strong> — the supermarket</li>
<li><strong>la playa</strong> — the beach</li>
<li><strong>la piscina</strong> — the swimming pool</li>
<li><strong>el centro</strong> — the city centre</li>
<li><strong>el restaurante</strong> — the restaurant</li>
<li><strong>el gimnasio</strong> — the gym</li>
<li><strong>a cenar</strong> — to have dinner out</li>
<li><strong>a comer</strong> — to eat out</li>
<li><strong>de compras</strong> — shopping</li>
</ul>
<hr>
<h2>🗣️ Estructura clave — Key sentence structures</h2>
<h3>For days of the week → use <em>el</em></h3>
<blockquote>
<strong>El + [día] + voy a + [lugar]</strong><br><br>
<em>El lunes voy al gimnasio.</em> — On Monday I'm going to the gym.<br>
<em>El viernes voy a la playa.</em> — On Friday I'm going to the beach.<br>
<em>El miércoles voy al supermercado.</em> — On Wednesday I'm going to the supermarket.
</blockquote>
<blockquote>💡 <strong>a + el = al</strong> — always combine these: <em>voy al gimnasio</em>, never <em>voy a el gimnasio</em>. With feminine places keep separate: <em>voy a la playa</em>.</blockquote>
<h3>For months of the year → use <em>en</em></h3>
<blockquote>
<strong>En + [mes] + voy a + [actividad]</strong><br><br>
<em>En enero voy a esquiar.</em> — In January I'm going skiing.<br>
<em>En agosto voy a la playa.</em> — In August I'm going to the beach.
</blockquote>`,
                quiz: [
                    { question: 'What is the Spanish word for Wednesday?', options: ['martes', 'jueves', 'miércoles', 'viernes'], correct: 2 },
                    { question: 'How do you say "On Monday I\'m going to the beach"?', options: ['El lunes voy a la playa', 'El lunes estoy la playa', 'Lunes voy playa', 'El martes voy a la playa'], correct: 0 },
                    { question: 'Which is the correct combination of "a" + "el"?', options: ['a el', 'al', 'el a', 'ale'], correct: 1 },
                    { question: 'How do you say "In August I\'m going skiing"?', options: ['El agosto voy a esquiar', 'En agosto voy a esquiar', 'Agosto voy esquiar', 'En agosto estoy esquiar'], correct: 1 }
                ]
            },
            {
                id: 'sp101-m3',
                section: 'GRAMMAR',
                title: 'Module 3 — Articles (El, La, Un, Una)',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>📖 ¿Qué son los artículos? — What are articles?</h2>
<p>Articles are the small words we put before nouns. In English: <strong>the</strong>, <strong>a</strong>, <strong>some</strong>. In Spanish they change based on gender (masculine/feminine) and number (singular/plural).</p>
<p>Two groups:</p>
<ul>
<li><strong>Definite articles</strong> — when both speakers know which specific thing is being discussed. Equivalent to <em>the</em>.</li>
<li><strong>Indefinite articles</strong> — when the object is not specifically known between speakers. Equivalent to <em>a</em> or <em>some</em>.</li>
</ul>
<blockquote>💡 Every Spanish noun is either masculine or feminine — nothing to do with real-world gender. Think of it as Type 1 and Type 2.</blockquote>
<hr>
<h2>📌 Artículos definidos — Definite articles (<em>the</em>)</h2>
<ul>
<li><strong>el</strong> — masculine singular · <em>el niño</em> (the boy)</li>
<li><strong>los</strong> — masculine plural · <em>los niños</em> (the boys)</li>
<li><strong>la</strong> — feminine singular · <em>la niña</em> (the girl)</li>
<li><strong>las</strong> — feminine plural · <em>las niñas</em> (the girls)</li>
</ul>
<hr>
<h2>📌 Artículos indefinidos — Indefinite articles (<em>a / some</em>)</h2>
<ul>
<li><strong>un</strong> — masculine singular · <em>un niño</em> (a boy)</li>
<li><strong>unos</strong> — masculine plural · <em>unos niños</em> (some boys)</li>
<li><strong>una</strong> — feminine singular · <em>una niña</em> (a girl)</li>
<li><strong>unas</strong> — feminine plural · <em>unas niñas</em> (some girls)</li>
</ul>
<hr>
<h2>✅ Patrones clave — Key patterns</h2>
<ul>
<li>Masculine singular → <strong>el / un</strong> · el libro, un coche</li>
<li>Feminine singular → <strong>la / una</strong> · la mesa, una casa</li>
<li>Masculine plural → <strong>los / unos</strong> · los libros, unos coches</li>
<li>Feminine plural → <strong>las / unas</strong> · las mesas, unas casas</li>
<li>Masculine endings → often <strong>-o</strong> · el niñ<strong>o</strong>, el libr<strong>o</strong></li>
<li>Feminine endings → often <strong>-a</strong> · la niñ<strong>a</strong>, la mes<strong>a</strong></li>
<li>Plurals → always add <strong>-s</strong> · libro → libros, mesa → mesas</li>
</ul>
<hr>
<h2>⚠️ Tres excepciones — Three exceptions</h2>
<h3>1. Negative sentences — no article in Spanish</h3>
<p>In English: <em>I don't have a computer.</em> In Spanish the un/una disappears:</p>
<blockquote><em>No tengo ordenador.</em> ✓ &nbsp;&nbsp; <em>No tengo un ordenador.</em> ✗</blockquote>
<h3>2. Feminine words starting with stressed A — use el/un for easy pronunciation</h3>
<p>Words like <strong>agua</strong> (water) and <strong>águila</strong> (eagle) are feminine, but saying <em>una agua</em> is uncomfortable. We switch to the masculine form just for pronunciation:</p>
<blockquote><em>el agua</em> ✓ · <em>un águila</em> ✓ — still feminine, just easier to say</blockquote>
<h3>3. Professions, nationalities, religions — no article after soy</h3>
<p>In English: <em>I am a doctor.</em> In Spanish the un/una disappears — using it sounds dismissive, like "just some doctor":</p>
<blockquote>
<em>Soy médico.</em> ✓ — I am a doctor.<br>
<em>Soy ingeniera.</em> ✓ — I am an engineer.<br>
<em>Soy español.</em> ✓ — I am Spanish.
</blockquote>`,
                quiz: [
                    { question: 'What is the correct definite article for "niñas" (girls)?', options: ['el', 'los', 'la', 'las'], correct: 3 },
                    { question: 'How do you say "a boy" in Spanish?', options: ['el niño', 'un niño', 'unos niños', 'la niño'], correct: 1 },
                    { question: 'Which sentence is correct in Spanish?', options: ['Soy un doctor', 'Soy doctor', 'Estoy un doctor', 'El soy doctor'], correct: 1 },
                    { question: 'How do you say "I don\'t have a car" in Spanish?', options: ['No tengo un coche', 'No tengo coche', 'No soy un coche', 'No estoy coche'], correct: 1 }
                ]
            },
            {
                id: 'sp101-m4',
                section: 'GRAMMAR',
                title: 'Module 4 — Verb Conjugation (Present Tense)',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🔤 Los tres grupos de verbos — Three verb groups</h2>
<p>Every Spanish verb ends in <strong>-AR</strong>, <strong>-ER</strong>, or <strong>-IR</strong>. Each group uses different endings when you conjugate.</p>
<ul>
<li><strong>-AR</strong> → hablar (to speak), estudiar (to study), bailar (to dance)</li>
<li><strong>-ER</strong> → beber (to drink), comer (to eat), tener (to have)</li>
<li><strong>-IR</strong> → vivir (to live), sentir (to feel)</li>
</ul>
<h3>Step 1 — Find the stem</h3>
<p>Remove the -AR / -ER / -IR ending:</p>
<ul>
<li>habl<strong>ar</strong> → <strong>habl-</strong></li>
<li>beb<strong>er</strong> → <strong>beb-</strong></li>
<li>viv<strong>ir</strong> → <strong>viv-</strong></li>
</ul>
<h3>Step 2 — Add the correct ending for each subject</h3>
<hr>
<h2>📊 Conjugación — Present tense endings</h2>
<h3>-AR verbs (hablar)</h3>
<ul>
<li><strong>yo</strong> → habl<strong>o</strong></li>
<li><strong>tú</strong> → habl<strong>as</strong></li>
<li><strong>él/ella</strong> → habl<strong>a</strong></li>
<li><strong>nosotros</strong> → habl<strong>amos</strong></li>
<li><strong>vosotros</strong> → habl<strong>áis</strong></li>
<li><strong>ellos/ellas</strong> → habl<strong>an</strong></li>
</ul>
<h3>-ER verbs (beber)</h3>
<ul>
<li><strong>yo</strong> → beb<strong>o</strong></li>
<li><strong>tú</strong> → beb<strong>es</strong></li>
<li><strong>él/ella</strong> → beb<strong>e</strong></li>
<li><strong>nosotros</strong> → beb<strong>emos</strong></li>
<li><strong>vosotros</strong> → beb<strong>éis</strong></li>
<li><strong>ellos/ellas</strong> → beb<strong>en</strong></li>
</ul>
<h3>-IR verbs (vivir)</h3>
<ul>
<li><strong>yo</strong> → viv<strong>o</strong></li>
<li><strong>tú</strong> → viv<strong>es</strong></li>
<li><strong>él/ella</strong> → viv<strong>e</strong></li>
<li><strong>nosotros</strong> → viv<strong>imos</strong></li>
<li><strong>vosotros</strong> → viv<strong>ís</strong></li>
<li><strong>ellos/ellas</strong> → viv<strong>en</strong></li>
</ul>
<hr>
<h2>🧠 Patrones fáciles de recordar</h2>
<ul>
<li><strong>yo</strong> → always ends in <strong>-o</strong> regardless of group · hablo, bebo, vivo</li>
<li><strong>tú</strong> → always ends in vowel + <strong>-s</strong> · hablas, bebes, vives</li>
<li><strong>él/ella</strong> → just the vowel · habla (A), bebe (E), vive (E)</li>
<li><strong>nosotros</strong> → -AMOS · -EMOS · -IMOS (vowel matches the verb group)</li>
<li><strong>ellos/ellas</strong> → same as él/ella but add <strong>-n</strong> · hablan, beben, viven</li>
</ul>
<blockquote>💡 With verbs we show plural by adding <strong>-n</strong> — just like we add <strong>-s</strong> to nouns to make them plural.</blockquote>
<hr>
<h2>💬 Ejemplos en contexto</h2>
<blockquote>
<em>Yo <strong>hablo</strong> español.</em> — I speak Spanish.<br>
<em>Tú <strong>estudias</strong> mucho.</em> — You study a lot.<br>
<em>Ella <strong>vive</strong> en Madrid.</em> — She lives in Madrid.<br>
<em>Nosotros <strong>bebemos</strong> agua.</em> — We drink water.<br>
<em>Ellos <strong>comen</strong> en el restaurante.</em> — They eat at the restaurant.
</blockquote>`,
                quiz: [
                    { question: 'What is the correct "yo" form of "hablar"?', options: ['hablas', 'habla', 'hablo', 'hablamos'], correct: 2 },
                    { question: 'How do you say "She lives in Barcelona"?', options: ['Ella vivo en Barcelona', 'Ella vives en Barcelona', 'Ella vive en Barcelona', 'Ella vivir en Barcelona'], correct: 2 },
                    { question: 'Which ending do -ER verbs take for "tú"?', options: ['-as', '-es', '-is', '-os'], correct: 1 },
                    { question: 'How do you say "They eat at the restaurant"?', options: ['Ellos come en el restaurante', 'Ellos comen en el restaurante', 'Ellos comer en el restaurante', 'Ellos comemos en el restaurante'], correct: 1 }
                ]
            },
            {
                id: 'sp101-m5',
                section: 'TRAVEL & CONVERSATION',
                title: 'Module 5 — Essential Travel Expressions',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🗺️ Expresiones esenciales</h2>
<p>These phrases will take you very far in any Spanish-speaking context — trips, day-to-day situations, anywhere you need to get things done.</p>
<hr>
<h2>📍 ¿Dónde está…? — Where is…?</h2>
<p>Use <strong>está</strong> for singular, <strong>están</strong> for plural:</p>
<blockquote>
<em>¿Dónde <strong>está</strong> el supermercado?</em> — Where is the supermarket?<br>
<em>¿Dónde <strong>están</strong> los taxis?</em> — Where are the taxis?<br>
<em>¿Dónde <strong>está</strong> la playa?</em> — Where is the beach?
</blockquote>
<hr>
<h2>✋ ¿Puedo…? — Can I…?</h2>
<blockquote>
<em>¿Puedo ir al museo?</em> — Can I go to the museum?<br>
<em>¿Puedo comer esto?</em> — Can I eat this?<br>
<em>¿Puedo pagar con tarjeta?</em> — Can I pay by card?
</blockquote>
<hr>
<h2>🚀 Vamos — Let's go</h2>
<blockquote>
<em>¡Vamos a la playa!</em> — Let's go to the beach!<br>
<em>¿Vamos?</em> — Shall we go?
</blockquote>
<hr>
<h2>🙏 Necesito — I need</h2>
<blockquote>
<em>Necesito un taxi.</em> — I need a taxi.<br>
<em>Necesito ayuda.</em> — I need help.
</blockquote>
<hr>
<h2>❓ ¿Tienes…? — Do you have…?</h2>
<blockquote>
<em>¿Tienes dinero?</em> — Do you have money?<br>
<em>¿Tienes tiempo?</em> — Do you have time?
</blockquote>
<hr>
<h2>🤔 ¿Debería…? — Should I…?</h2>
<blockquote>
<em>¿Debería pagar con tarjeta?</em> — Should I pay by card?<br>
<em>¿Debería tomar un taxi?</em> — Should I take a taxi?
</blockquote>
<hr>
<h2>💚 ¿Quieres…? — Do you want…?</h2>
<blockquote>
<em>¿Quieres ir a la playa?</em> — Do you want to go to the beach?<br>
<em>¿Quieres comer algo?</em> — Do you want to eat something?
</blockquote>
<hr>
<h2>🕐 ¿Qué hora es? — What time is it?</h2>
<blockquote>
<em>¿Qué hora es?</em> — What time is it?<br>
<em>¿A qué hora es?</em> — At what time is it?
</blockquote>
<hr>
<h2>✅ Resumen completo</h2>
<ul>
<li><strong>¿Dónde está…? / ¿Dónde están…?</strong> — Where is…? / Where are…?</li>
<li><strong>¿Puedo…?</strong> — Can I…?</li>
<li><strong>Vamos (a…)</strong> — Let's go (to…)</li>
<li><strong>Necesito…</strong> — I need…</li>
<li><strong>¿Tienes…?</strong> — Do you have…?</li>
<li><strong>¿Debería…?</strong> — Should I…?</li>
<li><strong>¿Quieres…?</strong> — Do you want…?</li>
<li><strong>¿Qué hora es?</strong> — What time is it?</li>
<li><strong>¿A qué hora es?</strong> — At what time is it?</li>
</ul>
<blockquote>💡 Music is one of the best ways to make these stick. Listening to Spanish music is working for free — the words in a catchy song stay in your head and your subconscious keeps working on them.</blockquote>`,
                quiz: [
                    { question: 'How do you ask "Where is the hotel?" in Spanish?', options: ['¿Dónde está el hotel?', '¿Puedo el hotel?', '¿Tienes el hotel?', '¿Dónde es el hotel?'], correct: 0 },
                    { question: 'How do you say "Can I pay by card?"', options: ['Necesito pagar con tarjeta', '¿Debería pagar con tarjeta?', '¿Puedo pagar con tarjeta?', 'Vamos pagar con tarjeta'], correct: 2 },
                    { question: 'What does "¿Tienes tiempo?" mean?', options: ['Do you have money?', 'What time is it?', 'Do you have time?', 'Should I wait?'], correct: 2 },
                    { question: 'How do you say "Where are the taxis?"', options: ['¿Dónde está los taxis?', '¿Dónde están los taxis?', '¿Dónde son los taxis?', '¿Tienes los taxis?'], correct: 1 }
                ]
            },
            {
                id: 'sp101-m6',
                section: 'TRAVEL & CONVERSATION',
                title: 'Module 6 — The Weather',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🌤️ El tiempo — The weather</h2>
<p>In English weather uses one verb: <em>it is</em>. In Spanish we use three different verbs. Think of it as: God is making it rain, God is making it sunny.</p>
<p>All weather expressions are conjugated in the <strong>third person singular</strong>.</p>
<hr>
<h2>🔨 Hace… — It makes… / It is…</h2>
<p>Use <strong>hace</strong> for most weather conditions:</p>
<ul>
<li><strong>Hace sol.</strong> — It's sunny.</li>
<li><strong>Hace viento.</strong> — It's windy.</li>
<li><strong>Hace calor.</strong> — It's hot.</li>
<li><strong>Hace frío.</strong> — It's cold.</li>
</ul>
<hr>
<h2>🌧️ Está… — It is… (ongoing conditions)</h2>
<p>Use <strong>está</strong> for weather that feels like something is actively happening — like the English <em>-ing</em> form:</p>
<ul>
<li><strong>Está lloviendo.</strong> — It's raining.</li>
<li><strong>Está nevando.</strong> — It's snowing.</li>
<li><strong>Está nublado.</strong> — It's cloudy.</li>
</ul>
<hr>
<h2>🌫️ Hay niebla — There is fog</h2>
<p>For fog, Spanish uses <strong>hay</strong> (there is):</p>
<blockquote><em>Hay niebla.</em> — It's foggy. (literally: there is fog)</blockquote>
<hr>
<h2>🔄 Alternativas para lluvia y nieve</h2>
<p>You can also conjugate the verbs directly — both are correct:</p>
<ul>
<li><strong>Llueve.</strong> — It rains / It's raining.</li>
<li><strong>Nieva.</strong> — It snows / It's snowing.</li>
</ul>
<hr>
<h2>✅ Resumen completo</h2>
<ul>
<li><strong>Hace sol</strong> — It's sunny (hacer)</li>
<li><strong>Hace viento</strong> — It's windy (hacer)</li>
<li><strong>Hace calor</strong> — It's hot (hacer)</li>
<li><strong>Hace frío</strong> — It's cold (hacer)</li>
<li><strong>Está lloviendo</strong> — It's raining (estar)</li>
<li><strong>Está nevando</strong> — It's snowing (estar)</li>
<li><strong>Está nublado</strong> — It's cloudy (estar)</li>
<li><strong>Hay niebla</strong> — It's foggy (haber)</li>
<li><strong>Llueve</strong> — It rains (llover)</li>
<li><strong>Nieva</strong> — It snows (nevar)</li>
</ul>`,
                quiz: [
                    { question: 'How do you say "It\'s sunny" in Spanish?', options: ['Hay sol', 'Está sol', 'Hace sol', 'Es sol'], correct: 2 },
                    { question: 'Which verb do you use for "It\'s raining" (ongoing)?', options: ['hacer', 'haber', 'estar', 'tener'], correct: 2 },
                    { question: 'How do you say "It\'s foggy" in Spanish?', options: ['Hace niebla', 'Está niebla', 'Hay niebla', 'Es niebla'], correct: 2 },
                    { question: 'Which of these uses the verb "hacer"?', options: ['Está nublado', 'Hay niebla', 'Hace viento', 'Está lloviendo'], correct: 2 }
                ]
            },
            {
                id: 'sp101-m7',
                section: 'FREE SPEAKING',
                title: 'Module 7 — Free Speaking Practice',
                videoUrl: '',
                audioUrl: '',
                content: `<h2>🎉 ¡Felicidades! — Congratulations!</h2>
<p>You've made it to the last module of Spanish 101. This is the exciting one — where the real learning begins.</p>
<hr>
<h2>🖼️ La práctica de la foto — Picture description</h2>
<p>Aaron will give you a picture. Your task: <strong>describe what is happening in Spanish</strong> using everything you've learned so far.</p>
<p>This practice <strong>evolves as you progress</strong>:</p>
<ul>
<li>Right now → present tense + vocabulary from Modules 1–6</li>
<li>As you advance → more tenses, more vocabulary, higher expectations</li>
<li>Always → you speak, we keep a record, we use it to improve</li>
</ul>
<blockquote>💡 This is exactly how children learn their native language, and how adults learn fastest when immersed in a country. It's the most effective, fastest, and most rewarding method.</blockquote>
<hr>
<h2>🛠️ Todo lo que tienes — Everything you have so far</h2>
<ul>
<li><strong>Module 1</strong> — Greetings, introductions, asking questions, farewells</li>
<li><strong>Module 2</strong> — Numbers, days of the week, seasons, locations, "el lunes voy a…"</li>
<li><strong>Module 3</strong> — El / la / un / una — articles before every noun</li>
<li><strong>Module 4</strong> — Conjugated verbs: habla, come, vive, estudia, tiene…</li>
<li><strong>Module 5</strong> — ¿Dónde está?, ¿Puedo?, vamos, necesito, ¿tienes?, ¿debería?, ¿quieres?</li>
<li><strong>Module 6</strong> — Weather: hace sol, está lloviendo, hay niebla…</li>
</ul>
<hr>
<h2>❓ Preguntas guía — Guide questions for the picture</h2>
<blockquote>
<em>¿Qué ves en la imagen?</em> — What do you see in the picture?<br>
<em>¿Qué está pasando?</em> — What is happening?<br>
<em>¿Quiénes son las personas?</em> — Who are the people?<br>
<em>¿Dónde están?</em> — Where are they?<br>
<em>¿Qué tiempo hace?</em> — What's the weather like?<br>
<em>¿Qué ropa llevan?</em> — What clothes are they wearing?
</blockquote>
<hr>
<h2>📤 ¿Cómo funciona? — How it works</h2>
<ol>
<li>Look at the picture Aaron sends you</li>
<li>Write or record your description in Spanish</li>
<li>Send it to Aaron</li>
<li>Aaron corrects, improves, and gives feedback</li>
</ol>
<hr>
<h2>🚀 Lo que sigue — What comes next</h2>
<p>In <strong>Spanish 102</strong>, there will be less and less English from Aaron and more and more Spanish from you. New tenses, new vocabulary, richer picture descriptions.</p>
<p><strong>¡Hasta pronto, y enhorabuena!</strong> 🎉</p>`,
                quiz: [
                    { question: 'What is the main goal of the Module 7 speaking exercise?', options: ['Memorising new vocabulary', 'Translating written sentences', 'Describing a picture using everything learned so far', 'Writing an essay about Spain'], correct: 2 },
                    { question: 'Which would you use to describe weather in a picture?', options: ['Me llamo…', 'Hace sol / Está lloviendo', 'Voy a la playa', 'Tengo 25 años'], correct: 1 },
                    { question: 'What happens to the picture practice as you advance?', options: ['It gets easier', 'It stays exactly the same', 'It gets replaced with grammar tests', 'Expectations increase as your vocabulary grows'], correct: 3 }
                ]
            }
        ]
    }
];

let _coursesCache = null;

// Courses are stored as SEPARATE Supabase rows per subject (id='catalog' for
// spanish, id='catalog_music' for music) so a student's browser only ever
// fetches their own subject's catalog — never the other subject's data.
function _catalogRowId(subject) {
    return subject === 'music' ? 'catalog_music' : 'catalog';
}

async function _fetchCatalogRow(subject) {
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/courses_catalog?id=eq.${_catalogRowId(subject)}&select=data`, {
            headers: _headers()
        });
        const rows = await r.json();
        if (Array.isArray(rows)) {
            // A row that doesn't exist yet is a legitimate "no courses" result, not a failure —
            // must return [] (not null) here so it's never confused with a genuine fetch failure below.
            const data = rows[0]?.data || [];
            // Force-tag with this row's subject (covers legacy rows saved before the subject field existed)
            return data.map(c => ({ ...c, subject }));
        }
    } catch(e) {}
    return null; // genuine fetch failure only (network error, CORS, etc.)
}

async function initCourses() {
    // Admin manages both subjects; students only ever fetch their own.
    if (currentUser?.isAdmin) {
        const [spanish, music] = await Promise.all([_fetchCatalogRow('spanish'), _fetchCatalogRow('music')]);
        if (spanish !== null || music !== null) {
            _coursesCache = [...(spanish || []), ...(music || [])];
            return;
        }
        // Total fetch failure — fall back to this browser's last-known admin (merged) cache
        const stored = localStorage.getItem('coursesCatalog');
        _coursesCache = stored ? JSON.parse(stored) : defaultCourses;
        return;
    }

    const subject = currentUser?.type === 'music' ? 'music' : 'spanish';
    const fetched = await _fetchCatalogRow(subject);
    if (fetched !== null) {
        _coursesCache = fetched; // correctly includes the "row not created yet" empty-array case
        return;
    }
    // Genuine fetch failure — fall back to THIS subject's own last-known-good cache only,
    // never a shared/merged key, so a stale cache can never leak the other subject's courses.
    const stored = localStorage.getItem(`coursesCatalog_${subject}`);
    _coursesCache = stored ? JSON.parse(stored) : (subject === 'spanish' ? defaultCourses : []);
}

function getCourses() {
    return _coursesCache || defaultCourses;
}

async function saveCourses(courses) {
    _coursesCache = courses;
    const spanishCourses = courses.filter(c => (c.subject || 'spanish') === 'spanish');
    const musicCourses = courses.filter(c => c.subject === 'music');
    localStorage.setItem('coursesCatalog', JSON.stringify(courses)); // admin's own merged-view backup
    localStorage.setItem('coursesCatalog_spanish', JSON.stringify(spanishCourses)); // per-subject backups
    localStorage.setItem('coursesCatalog_music', JSON.stringify(musicCourses));    // used only on fetch failure
    // Save to Supabase so it persists across devices and builds — split by
    // subject so each subject's data lives in its own row.
    if (currentUser?.isAdmin) {
        await Promise.all([
            sbRpc('save_courses_admin', { admin_secret: ADMIN_SECRET, p_data: spanishCourses }),
            sbRpc('save_music_courses_admin', { admin_secret: ADMIN_SECRET, p_data: musicCourses })
        ]);
    }
}

async function getProgress() {
    // The admin pseudo-user has id 'admin' (not a real UUID), so skip the
    // progress lookup — it would 400 against the UUID user_id column.
    if (!currentUser || currentUser.id === 'admin') return {};
    const data = await sbGetProgress(currentUser.id);
    if (!Array.isArray(data)) return {};
    const progress = {};
    data.forEach(row => { progress[row.course_id + '_' + row.lesson_id] = true; });
    return progress;
}

async function markLessonComplete(courseId, lessonId) {
    if (!currentUser) return;
    await sbUpsertProgress(currentUser.id, courseId, lessonId);
}


// ============================================================
// SHARED RESOURCES (same for all students of each type)
// Update these links when you have real shared resources.
// ============================================================
const sharedResources = {
    spanish: {
        sections: [
            {
                title: 'Music & Listening',
                icon: 'fab fa-spotify',
                links: [
                    { label: 'Spanish Spotify Playlist', icon: 'fab fa-spotify', url: 'https://open.spotify.com/playlist/4xw8p0Abgm0geBg2PXwJAP?si=a57dd3a6263e4915' },
                    { label: 'Spanish YouTube Playlist', icon: 'fab fa-youtube', url: 'https://www.youtube.com/playlist?list=PLVj57CZsVNos' }
                ]
            }
        ],
        mediaContent: {
            title: 'Movies & TV Shows',
            subtitle: 'Watch in SPANISH with SPANISH subtitles',
            icon: 'fas fa-film',
            categories: [
                {
                    name: 'Deep / Dark but Amazing',
                    items: [
                        { title: 'Biutiful', director: 'A.G. Iñárritu', year: 2010, type: 'movie',
                          poster: '', wikiTitle: 'Biutiful',
                          url: 'https://www.imdb.com/title/tt1164999/' },
                        { title: 'Amores Perros', director: 'A.G. Iñárritu', year: 2000, type: 'movie',
                          poster: '', wikiTitle: 'Amores perros',
                          url: 'https://www.imdb.com/title/tt0245712/' }
                    ]
                },
                {
                    name: 'Deep / Less Dark',
                    items: [
                        { title: 'Roma', director: 'Alfonso Cuarón', year: 2018, type: 'movie',
                          poster: '', wikiTitle: 'Roma (2018 film)',
                          url: 'https://www.imdb.com/title/tt6155172/' },
                        { title: 'Babel', director: 'A.G. Iñárritu', year: 2006, type: 'movie',
                          poster: '', wikiTitle: 'Babel (2006 film)',
                          url: 'https://www.imdb.com/title/tt0449467/' },
                        { title: "Pan's Labyrinth", director: 'G. del Toro', year: 2006, type: 'movie',
                          poster: '', wikiTitle: "Pan's Labyrinth",
                          url: 'https://www.imdb.com/title/tt0457430/' }
                    ]
                },
                {
                    name: 'TV Shows',
                    items: [
                        { title: 'La Casa de Papel', director: 'Álex Pina', year: 2017, type: 'tv',
                          poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Salvador_Dal%C3%AD_mask.svg/250px-Salvador_Dal%C3%AD_mask.svg.png', wikiTitle: 'Money Heist',
                          url: 'https://www.imdb.com/title/tt6468322/' }
                    ]
                }
            ]
        },
        instagramContent: {
            title: 'Instagram Profiles',
            subtitle: 'Follow for daily Spanish immersion at native speed',
            icon: 'fab fa-instagram',
            categories: [
                {
                    name: 'Street interviews',
                    items: [
                        { handle: '@soniasuamor', url: 'https://www.instagram.com/soniasuamor/' }
                    ]
                },
                {
                    name: 'Skits, young, unfiltered',
                    items: [
                        { handle: '@adriamarcor', url: 'https://www.instagram.com/adriamarcor/' },
                        { handle: '@adriianromero__', url: 'https://www.instagram.com/adriianromero__/' },
                        { handle: '@pablogshow', url: 'https://www.instagram.com/pablogshow/' }
                    ]
                },
                {
                    name: 'Aggressive, great for vocab',
                    items: [
                        { handle: '@guillefernandez', url: 'https://www.instagram.com/guillefernandez/' }
                    ]
                },
                {
                    name: 'More subtle and witty',
                    items: [
                        { handle: '@daniel__ath', url: 'https://www.instagram.com/daniel__ath/' },
                        { handle: '@pablomeixe', url: 'https://www.instagram.com/pablomeixe/' }
                    ]
                }
            ]
        }
    },
    music: {
        sections: [
            {
                title: 'Practice & Theory',
                icon: 'fas fa-music',
                links: [
                    { label: 'Practice Tracks', icon: 'fas fa-play-circle', url: 'https://youtube.com' },
                    { label: 'Music Theory', icon: 'fas fa-book', url: 'https://youtube.com' }
                ]
            }
        ]
    }
};

// ============================================================
// VERB CONJUGATOR TOOL DATA — most frequent Spanish verbs,
// hand-verified present / preterite / future paradigms
// ============================================================
const verbConjugations = [
    { inf: "ser", en: "to be", presente: ["soy", "eres", "es", "somos", "sois", "son"], preterito: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"], imperfecto: ["era", "eras", "era", "éramos", "erais", "eran"], futuro: ["seré", "serás", "será", "seremos", "seréis", "serán"], condicional: ["sería", "serías", "sería", "seríamos", "seríais", "serían"], presentePerfecto: ["he sido", "has sido", "ha sido", "hemos sido", "habéis sido", "han sido"], pluscuamperfecto: ["había sido", "habías sido", "había sido", "habíamos sido", "habíais sido", "habían sido"], futuroPerfecto: ["habré sido", "habrás sido", "habrá sido", "habremos sido", "habréis sido", "habrán sido"], condicionalPerfecto: ["habría sido", "habrías sido", "habría sido", "habríamos sido", "habríais sido", "habrían sido"], presenteSubjuntivo: ["sea", "seas", "sea", "seamos", "seáis", "sean"], imperfectoSubjuntivo: ["fuera", "fueras", "fuera", "fuéramos", "fuerais", "fueran"], participle: "sido", note: null },
    { inf: "estar", en: "to be", presente: ["estoy", "estás", "está", "estamos", "estáis", "están"], preterito: ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"], imperfecto: ["estaba", "estabas", "estaba", "estábamos", "estabais", "estaban"], futuro: ["estaré", "estarás", "estará", "estaremos", "estaréis", "estarán"], condicional: ["estaría", "estarías", "estaría", "estaríamos", "estaríais", "estarían"], presentePerfecto: ["he estado", "has estado", "ha estado", "hemos estado", "habéis estado", "han estado"], pluscuamperfecto: ["había estado", "habías estado", "había estado", "habíamos estado", "habíais estado", "habían estado"], futuroPerfecto: ["habré estado", "habrás estado", "habrá estado", "habremos estado", "habréis estado", "habrán estado"], condicionalPerfecto: ["habría estado", "habrías estado", "habría estado", "habríamos estado", "habríais estado", "habrían estado"], presenteSubjuntivo: ["esté", "estés", "esté", "estemos", "estéis", "estén"], imperfectoSubjuntivo: ["estuviera", "estuvieras", "estuviera", "estuviéramos", "estuvierais", "estuvieran"], participle: "estado", note: null },
    { inf: "ir", en: "to go", presente: ["voy", "vas", "va", "vamos", "vais", "van"], preterito: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"], imperfecto: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"], futuro: ["iré", "irás", "irá", "iremos", "iréis", "irán"], condicional: ["iría", "irías", "iría", "iríamos", "iríais", "irían"], presentePerfecto: ["he ido", "has ido", "ha ido", "hemos ido", "habéis ido", "han ido"], pluscuamperfecto: ["había ido", "habías ido", "había ido", "habíamos ido", "habíais ido", "habían ido"], futuroPerfecto: ["habré ido", "habrás ido", "habrá ido", "habremos ido", "habréis ido", "habrán ido"], condicionalPerfecto: ["habría ido", "habrías ido", "habría ido", "habríamos ido", "habríais ido", "habrían ido"], presenteSubjuntivo: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"], imperfectoSubjuntivo: ["fuera", "fueras", "fuera", "fuéramos", "fuerais", "fueran"], participle: "ido", note: null },
    { inf: "haber", en: "to have (aux.)", presente: ["he", "has", "ha", "hemos", "habéis", "han"], preterito: ["hube", "hubiste", "hubo", "hubimos", "hubisteis", "hubieron"], imperfecto: ["había", "habías", "había", "habíamos", "habíais", "habían"], futuro: ["habré", "habrás", "habrá", "habremos", "habréis", "habrán"], condicional: ["habría", "habrías", "habría", "habríamos", "habríais", "habrían"], presentePerfecto: ["he habido", "has habido", "ha habido", "hemos habido", "habéis habido", "han habido"], pluscuamperfecto: ["había habido", "habías habido", "había habido", "habíamos habido", "habíais habido", "habían habido"], futuroPerfecto: ["habré habido", "habrás habido", "habrá habido", "habremos habido", "habréis habido", "habrán habido"], condicionalPerfecto: ["habría habido", "habrías habido", "habría habido", "habríamos habido", "habríais habido", "habrían habido"], presenteSubjuntivo: ["haya", "hayas", "haya", "hayamos", "hayáis", "hayan"], imperfectoSubjuntivo: ["hubiera", "hubieras", "hubiera", "hubiéramos", "hubierais", "hubieran"], participle: "habido", note: "Auxiliary verb — used with a past participle (he comido) or impersonally (hay)." },
    { inf: "tener", en: "to have", presente: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"], preterito: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"], imperfecto: ["tenía", "tenías", "tenía", "teníamos", "teníais", "tenían"], futuro: ["tendré", "tendrás", "tendrá", "tendremos", "tendréis", "tendrán"], condicional: ["tendría", "tendrías", "tendría", "tendríamos", "tendríais", "tendrían"], presentePerfecto: ["he tenido", "has tenido", "ha tenido", "hemos tenido", "habéis tenido", "han tenido"], pluscuamperfecto: ["había tenido", "habías tenido", "había tenido", "habíamos tenido", "habíais tenido", "habían tenido"], futuroPerfecto: ["habré tenido", "habrás tenido", "habrá tenido", "habremos tenido", "habréis tenido", "habrán tenido"], condicionalPerfecto: ["habría tenido", "habrías tenido", "habría tenido", "habríamos tenido", "habríais tenido", "habrían tenido"], presenteSubjuntivo: ["tenga", "tengas", "tenga", "tengamos", "tengáis", "tengan"], imperfectoSubjuntivo: ["tuviera", "tuvieras", "tuviera", "tuviéramos", "tuvierais", "tuvieran"], participle: "tenido", note: null },
    { inf: "hacer", en: "to do / make", presente: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"], preterito: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"], imperfecto: ["hacía", "hacías", "hacía", "hacíamos", "hacíais", "hacían"], futuro: ["haré", "harás", "hará", "haremos", "haréis", "harán"], condicional: ["haría", "harías", "haría", "haríamos", "haríais", "harían"], presentePerfecto: ["he hecho", "has hecho", "ha hecho", "hemos hecho", "habéis hecho", "han hecho"], pluscuamperfecto: ["había hecho", "habías hecho", "había hecho", "habíamos hecho", "habíais hecho", "habían hecho"], futuroPerfecto: ["habré hecho", "habrás hecho", "habrá hecho", "habremos hecho", "habréis hecho", "habrán hecho"], condicionalPerfecto: ["habría hecho", "habrías hecho", "habría hecho", "habríamos hecho", "habríais hecho", "habrían hecho"], presenteSubjuntivo: ["haga", "hagas", "haga", "hagamos", "hagáis", "hagan"], imperfectoSubjuntivo: ["hiciera", "hicieras", "hiciera", "hiciéramos", "hicierais", "hicieran"], participle: "hecho", note: null },
    { inf: "poder", en: "to be able to (can)", presente: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"], preterito: ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"], imperfecto: ["podía", "podías", "podía", "podíamos", "podíais", "podían"], futuro: ["podré", "podrás", "podrá", "podremos", "podréis", "podrán"], condicional: ["podría", "podrías", "podría", "podríamos", "podríais", "podrían"], presentePerfecto: ["he podido", "has podido", "ha podido", "hemos podido", "habéis podido", "han podido"], pluscuamperfecto: ["había podido", "habías podido", "había podido", "habíamos podido", "habíais podido", "habían podido"], futuroPerfecto: ["habré podido", "habrás podido", "habrá podido", "habremos podido", "habréis podido", "habrán podido"], condicionalPerfecto: ["habría podido", "habrías podido", "habría podido", "habríamos podido", "habríais podido", "habrían podido"], presenteSubjuntivo: ["pueda", "puedas", "pueda", "podamos", "podáis", "puedan"], imperfectoSubjuntivo: ["pudiera", "pudieras", "pudiera", "pudiéramos", "pudierais", "pudieran"], participle: "podido", note: null },
    { inf: "decir", en: "to say / tell", presente: ["digo", "dices", "dice", "decimos", "decís", "dicen"], preterito: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"], imperfecto: ["decía", "decías", "decía", "decíamos", "decíais", "decían"], futuro: ["diré", "dirás", "dirá", "diremos", "diréis", "dirán"], condicional: ["diría", "dirías", "diría", "diríamos", "diríais", "dirían"], presentePerfecto: ["he dicho", "has dicho", "ha dicho", "hemos dicho", "habéis dicho", "han dicho"], pluscuamperfecto: ["había dicho", "habías dicho", "había dicho", "habíamos dicho", "habíais dicho", "habían dicho"], futuroPerfecto: ["habré dicho", "habrás dicho", "habrá dicho", "habremos dicho", "habréis dicho", "habrán dicho"], condicionalPerfecto: ["habría dicho", "habrías dicho", "habría dicho", "habríamos dicho", "habríais dicho", "habrían dicho"], presenteSubjuntivo: ["diga", "digas", "diga", "digamos", "digáis", "digan"], imperfectoSubjuntivo: ["dijera", "dijeras", "dijera", "dijéramos", "dijerais", "dijeran"], participle: "dicho", note: null },
    { inf: "ver", en: "to see", presente: ["veo", "ves", "ve", "vemos", "veis", "ven"], preterito: ["vi", "viste", "vio", "vimos", "visteis", "vieron"], imperfecto: ["veía", "veías", "veía", "veíamos", "veíais", "veían"], futuro: ["veré", "verás", "verá", "veremos", "veréis", "verán"], condicional: ["vería", "verías", "vería", "veríamos", "veríais", "verían"], presentePerfecto: ["he visto", "has visto", "ha visto", "hemos visto", "habéis visto", "han visto"], pluscuamperfecto: ["había visto", "habías visto", "había visto", "habíamos visto", "habíais visto", "habían visto"], futuroPerfecto: ["habré visto", "habrás visto", "habrá visto", "habremos visto", "habréis visto", "habrán visto"], condicionalPerfecto: ["habría visto", "habrías visto", "habría visto", "habríamos visto", "habríais visto", "habrían visto"], presenteSubjuntivo: ["vea", "veas", "vea", "veamos", "veáis", "vean"], imperfectoSubjuntivo: ["viera", "vieras", "viera", "viéramos", "vierais", "vieran"], participle: "visto", note: null },
    { inf: "dar", en: "to give", presente: ["doy", "das", "da", "damos", "dais", "dan"], preterito: ["di", "diste", "dio", "dimos", "disteis", "dieron"], imperfecto: ["daba", "dabas", "daba", "dábamos", "dabais", "daban"], futuro: ["daré", "darás", "dará", "daremos", "daréis", "darán"], condicional: ["daría", "darías", "daría", "daríamos", "daríais", "darían"], presentePerfecto: ["he dado", "has dado", "ha dado", "hemos dado", "habéis dado", "han dado"], pluscuamperfecto: ["había dado", "habías dado", "había dado", "habíamos dado", "habíais dado", "habían dado"], futuroPerfecto: ["habré dado", "habrás dado", "habrá dado", "habremos dado", "habréis dado", "habrán dado"], condicionalPerfecto: ["habría dado", "habrías dado", "habría dado", "habríamos dado", "habríais dado", "habrían dado"], presenteSubjuntivo: ["dé", "des", "dé", "demos", "deis", "den"], imperfectoSubjuntivo: ["diera", "dieras", "diera", "diéramos", "dierais", "dieran"], participle: "dado", note: null },
    { inf: "saber", en: "to know (facts)", presente: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"], preterito: ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"], imperfecto: ["sabía", "sabías", "sabía", "sabíamos", "sabíais", "sabían"], futuro: ["sabré", "sabrás", "sabrá", "sabremos", "sabréis", "sabrán"], condicional: ["sabría", "sabrías", "sabría", "sabríamos", "sabríais", "sabrían"], presentePerfecto: ["he sabido", "has sabido", "ha sabido", "hemos sabido", "habéis sabido", "han sabido"], pluscuamperfecto: ["había sabido", "habías sabido", "había sabido", "habíamos sabido", "habíais sabido", "habían sabido"], futuroPerfecto: ["habré sabido", "habrás sabido", "habrá sabido", "habremos sabido", "habréis sabido", "habrán sabido"], condicionalPerfecto: ["habría sabido", "habrías sabido", "habría sabido", "habríamos sabido", "habríais sabido", "habrían sabido"], presenteSubjuntivo: ["sepa", "sepas", "sepa", "sepamos", "sepáis", "sepan"], imperfectoSubjuntivo: ["supiera", "supieras", "supiera", "supiéramos", "supierais", "supieran"], participle: "sabido", note: null },
    { inf: "querer", en: "to want / love", presente: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"], preterito: ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"], imperfecto: ["quería", "querías", "quería", "queríamos", "queríais", "querían"], futuro: ["querré", "querrás", "querrá", "querremos", "querréis", "querrán"], condicional: ["querría", "querrías", "querría", "querríamos", "querríais", "querrían"], presentePerfecto: ["he querido", "has querido", "ha querido", "hemos querido", "habéis querido", "han querido"], pluscuamperfecto: ["había querido", "habías querido", "había querido", "habíamos querido", "habíais querido", "habían querido"], futuroPerfecto: ["habré querido", "habrás querido", "habrá querido", "habremos querido", "habréis querido", "habrán querido"], condicionalPerfecto: ["habría querido", "habrías querido", "habría querido", "habríamos querido", "habríais querido", "habrían querido"], presenteSubjuntivo: ["quiera", "quieras", "quiera", "queramos", "queráis", "quieran"], imperfectoSubjuntivo: ["quisiera", "quisieras", "quisiera", "quisiéramos", "quisierais", "quisieran"], participle: "querido", note: null },
    { inf: "poner", en: "to put", presente: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"], preterito: ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"], imperfecto: ["ponía", "ponías", "ponía", "poníamos", "poníais", "ponían"], futuro: ["pondré", "pondrás", "pondrá", "pondremos", "pondréis", "pondrán"], condicional: ["pondría", "pondrías", "pondría", "pondríamos", "pondríais", "pondrían"], presentePerfecto: ["he puesto", "has puesto", "ha puesto", "hemos puesto", "habéis puesto", "han puesto"], pluscuamperfecto: ["había puesto", "habías puesto", "había puesto", "habíamos puesto", "habíais puesto", "habían puesto"], futuroPerfecto: ["habré puesto", "habrás puesto", "habrá puesto", "habremos puesto", "habréis puesto", "habrán puesto"], condicionalPerfecto: ["habría puesto", "habrías puesto", "habría puesto", "habríamos puesto", "habríais puesto", "habrían puesto"], presenteSubjuntivo: ["ponga", "pongas", "ponga", "pongamos", "pongáis", "pongan"], imperfectoSubjuntivo: ["pusiera", "pusieras", "pusiera", "pusiéramos", "pusierais", "pusieran"], participle: "puesto", note: null },
    { inf: "salir", en: "to leave / go out", presente: ["salgo", "sales", "sale", "salimos", "salís", "salen"], preterito: ["salí", "saliste", "salió", "salimos", "salisteis", "salieron"], imperfecto: ["salía", "salías", "salía", "salíamos", "salíais", "salían"], futuro: ["saldré", "saldrás", "saldrá", "saldremos", "saldréis", "saldrán"], condicional: ["saldría", "saldrías", "saldría", "saldríamos", "saldríais", "saldrían"], presentePerfecto: ["he salido", "has salido", "ha salido", "hemos salido", "habéis salido", "han salido"], pluscuamperfecto: ["había salido", "habías salido", "había salido", "habíamos salido", "habíais salido", "habían salido"], futuroPerfecto: ["habré salido", "habrás salido", "habrá salido", "habremos salido", "habréis salido", "habrán salido"], condicionalPerfecto: ["habría salido", "habrías salido", "habría salido", "habríamos salido", "habríais salido", "habrían salido"], presenteSubjuntivo: ["salga", "salgas", "salga", "salgamos", "salgáis", "salgan"], imperfectoSubjuntivo: ["saliera", "salieras", "saliera", "saliéramos", "salierais", "salieran"], participle: "salido", note: null },
    { inf: "venir", en: "to come", presente: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"], preterito: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"], imperfecto: ["venía", "venías", "venía", "veníamos", "veníais", "venían"], futuro: ["vendré", "vendrás", "vendrá", "vendremos", "vendréis", "vendrán"], condicional: ["vendría", "vendrías", "vendría", "vendríamos", "vendríais", "vendrían"], presentePerfecto: ["he venido", "has venido", "ha venido", "hemos venido", "habéis venido", "han venido"], pluscuamperfecto: ["había venido", "habías venido", "había venido", "habíamos venido", "habíais venido", "habían venido"], futuroPerfecto: ["habré venido", "habrás venido", "habrá venido", "habremos venido", "habréis venido", "habrán venido"], condicionalPerfecto: ["habría venido", "habrías venido", "habría venido", "habríamos venido", "habríais venido", "habrían venido"], presenteSubjuntivo: ["venga", "vengas", "venga", "vengamos", "vengáis", "vengan"], imperfectoSubjuntivo: ["viniera", "vinieras", "viniera", "viniéramos", "vinierais", "vinieran"], participle: "venido", note: null },
    { inf: "traer", en: "to bring", presente: ["traigo", "traes", "trae", "traemos", "traéis", "traen"], preterito: ["traje", "trajiste", "trajo", "trajimos", "trajisteis", "trajeron"], imperfecto: ["traía", "traías", "traía", "traíamos", "traíais", "traían"], futuro: ["traeré", "traerás", "traerá", "traeremos", "traeréis", "traerán"], condicional: ["traería", "traerías", "traería", "traeríamos", "traeríais", "traerían"], presentePerfecto: ["he traído", "has traído", "ha traído", "hemos traído", "habéis traído", "han traído"], pluscuamperfecto: ["había traído", "habías traído", "había traído", "habíamos traído", "habíais traído", "habían traído"], futuroPerfecto: ["habré traído", "habrás traído", "habrá traído", "habremos traído", "habréis traído", "habrán traído"], condicionalPerfecto: ["habría traído", "habrías traído", "habría traído", "habríamos traído", "habríais traído", "habrían traído"], presenteSubjuntivo: ["traiga", "traigas", "traiga", "traigamos", "traigáis", "traigan"], imperfectoSubjuntivo: ["trajera", "trajeras", "trajera", "trajéramos", "trajerais", "trajeran"], participle: "traído", note: null },
    { inf: "caer", en: "to fall", presente: ["caigo", "caes", "cae", "caemos", "caéis", "caen"], preterito: ["caí", "caíste", "cayó", "caímos", "caísteis", "cayeron"], imperfecto: ["caía", "caías", "caía", "caíamos", "caíais", "caían"], futuro: ["caeré", "caerás", "caerá", "caeremos", "caeréis", "caerán"], condicional: ["caería", "caerías", "caería", "caeríamos", "caeríais", "caerían"], presentePerfecto: ["he caído", "has caído", "ha caído", "hemos caído", "habéis caído", "han caído"], pluscuamperfecto: ["había caído", "habías caído", "había caído", "habíamos caído", "habíais caído", "habían caído"], futuroPerfecto: ["habré caído", "habrás caído", "habrá caído", "habremos caído", "habréis caído", "habrán caído"], condicionalPerfecto: ["habría caído", "habrías caído", "habría caído", "habríamos caído", "habríais caído", "habrían caído"], presenteSubjuntivo: ["caiga", "caigas", "caiga", "caigamos", "caigáis", "caigan"], imperfectoSubjuntivo: ["cayera", "cayeras", "cayera", "cayéramos", "cayerais", "cayeran"], participle: "caído", note: null },
    { inf: "conocer", en: "to know (people/places)", presente: ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"], preterito: ["conocí", "conociste", "conoció", "conocimos", "conocisteis", "conocieron"], imperfecto: ["conocía", "conocías", "conocía", "conocíamos", "conocíais", "conocían"], futuro: ["conoceré", "conocerás", "conocerá", "conoceremos", "conoceréis", "conocerán"], condicional: ["conocería", "conocerías", "conocería", "conoceríamos", "conoceríais", "conocerían"], presentePerfecto: ["he conocido", "has conocido", "ha conocido", "hemos conocido", "habéis conocido", "han conocido"], pluscuamperfecto: ["había conocido", "habías conocido", "había conocido", "habíamos conocido", "habíais conocido", "habían conocido"], futuroPerfecto: ["habré conocido", "habrás conocido", "habrá conocido", "habremos conocido", "habréis conocido", "habrán conocido"], condicionalPerfecto: ["habría conocido", "habrías conocido", "habría conocido", "habríamos conocido", "habríais conocido", "habrían conocido"], presenteSubjuntivo: ["conozca", "conozcas", "conozca", "conozcamos", "conozcáis", "conozcan"], imperfectoSubjuntivo: ["conociera", "conocieras", "conociera", "conociéramos", "conocierais", "conocieran"], participle: "conocido", note: null },
    { inf: "parecer", en: "to seem", presente: ["parezco", "pareces", "parece", "parecemos", "parecéis", "parecen"], preterito: ["parecí", "pareciste", "pareció", "parecimos", "parecisteis", "parecieron"], imperfecto: ["parecía", "parecías", "parecía", "parecíamos", "parecíais", "parecían"], futuro: ["pareceré", "parecerás", "parecerá", "pareceremos", "pareceréis", "parecerán"], condicional: ["parecería", "parecerías", "parecería", "pareceríamos", "pareceríais", "parecerían"], presentePerfecto: ["he parecido", "has parecido", "ha parecido", "hemos parecido", "habéis parecido", "han parecido"], pluscuamperfecto: ["había parecido", "habías parecido", "había parecido", "habíamos parecido", "habíais parecido", "habían parecido"], futuroPerfecto: ["habré parecido", "habrás parecido", "habrá parecido", "habremos parecido", "habréis parecido", "habrán parecido"], condicionalPerfecto: ["habría parecido", "habrías parecido", "habría parecido", "habríamos parecido", "habríais parecido", "habrían parecido"], presenteSubjuntivo: ["parezca", "parezcas", "parezca", "parezcamos", "parezcáis", "parezcan"], imperfectoSubjuntivo: ["pareciera", "parecieras", "pareciera", "pareciéramos", "parecierais", "parecieran"], participle: "parecido", note: null },
    { inf: "conducir", en: "to drive", presente: ["conduzco", "conduces", "conduce", "conducimos", "conducís", "conducen"], preterito: ["conduje", "condujiste", "condujo", "condujimos", "condujisteis", "condujeron"], imperfecto: ["conducía", "conducías", "conducía", "conducíamos", "conducíais", "conducían"], futuro: ["conduciré", "conducirás", "conducirá", "conduciremos", "conduciréis", "conducirán"], condicional: ["conduciría", "conducirías", "conduciría", "conduciríamos", "conduciríais", "conducirían"], presentePerfecto: ["he conducido", "has conducido", "ha conducido", "hemos conducido", "habéis conducido", "han conducido"], pluscuamperfecto: ["había conducido", "habías conducido", "había conducido", "habíamos conducido", "habíais conducido", "habían conducido"], futuroPerfecto: ["habré conducido", "habrás conducido", "habrá conducido", "habremos conducido", "habréis conducido", "habrán conducido"], condicionalPerfecto: ["habría conducido", "habrías conducido", "habría conducido", "habríamos conducido", "habríais conducido", "habrían conducido"], presenteSubjuntivo: ["conduzca", "conduzcas", "conduzca", "conduzcamos", "conduzcáis", "conduzcan"], imperfectoSubjuntivo: ["condujera", "condujeras", "condujera", "condujéramos", "condujerais", "condujeran"], participle: "conducido", note: null },
    { inf: "producir", en: "to produce", presente: ["produzco", "produces", "produce", "producimos", "producís", "producen"], preterito: ["produje", "produjiste", "produjo", "produjimos", "produjisteis", "produjeron"], imperfecto: ["producía", "producías", "producía", "producíamos", "producíais", "producían"], futuro: ["produciré", "producirás", "producirá", "produciremos", "produciréis", "producirán"], condicional: ["produciría", "producirías", "produciría", "produciríamos", "produciríais", "producirían"], presentePerfecto: ["he producido", "has producido", "ha producido", "hemos producido", "habéis producido", "han producido"], pluscuamperfecto: ["había producido", "habías producido", "había producido", "habíamos producido", "habíais producido", "habían producido"], futuroPerfecto: ["habré producido", "habrás producido", "habrá producido", "habremos producido", "habréis producido", "habrán producido"], condicionalPerfecto: ["habría producido", "habrías producido", "habría producido", "habríamos producido", "habríais producido", "habrían producido"], presenteSubjuntivo: ["produzca", "produzcas", "produzca", "produzcamos", "produzcáis", "produzcan"], imperfectoSubjuntivo: ["produjera", "produjeras", "produjera", "produjéramos", "produjerais", "produjeran"], participle: "producido", note: null },
    { inf: "traducir", en: "to translate", presente: ["traduzco", "traduces", "traduce", "traducimos", "traducís", "traducen"], preterito: ["traduje", "tradujiste", "tradujo", "tradujimos", "tradujisteis", "tradujeron"], imperfecto: ["traducía", "traducías", "traducía", "traducíamos", "traducíais", "traducían"], futuro: ["traduciré", "traducirás", "traducirá", "traduciremos", "traduciréis", "traducirán"], condicional: ["traduciría", "traducirías", "traduciría", "traduciríamos", "traduciríais", "traducirían"], presentePerfecto: ["he traducido", "has traducido", "ha traducido", "hemos traducido", "habéis traducido", "han traducido"], pluscuamperfecto: ["había traducido", "habías traducido", "había traducido", "habíamos traducido", "habíais traducido", "habían traducido"], futuroPerfecto: ["habré traducido", "habrás traducido", "habrá traducido", "habremos traducido", "habréis traducido", "habrán traducido"], condicionalPerfecto: ["habría traducido", "habrías traducido", "habría traducido", "habríamos traducido", "habríais traducido", "habrían traducido"], presenteSubjuntivo: ["traduzca", "traduzcas", "traduzca", "traduzcamos", "traduzcáis", "traduzcan"], imperfectoSubjuntivo: ["tradujera", "tradujeras", "tradujera", "tradujéramos", "tradujerais", "tradujeran"], participle: "traducido", note: null },
    { inf: "oír", en: "to hear", presente: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"], preterito: ["oí", "oíste", "oyó", "oímos", "oísteis", "oyeron"], imperfecto: ["oía", "oías", "oía", "oíamos", "oíais", "oían"], futuro: ["oiré", "oirás", "oirá", "oiremos", "oiréis", "oirán"], condicional: ["oiría", "oirías", "oiría", "oiríamos", "oiríais", "oirían"], presentePerfecto: ["he oído", "has oído", "ha oído", "hemos oído", "habéis oído", "han oído"], pluscuamperfecto: ["había oído", "habías oído", "había oído", "habíamos oído", "habíais oído", "habían oído"], futuroPerfecto: ["habré oído", "habrás oído", "habrá oído", "habremos oído", "habréis oído", "habrán oído"], condicionalPerfecto: ["habría oído", "habrías oído", "habría oído", "habríamos oído", "habríais oído", "habrían oído"], presenteSubjuntivo: ["oiga", "oigas", "oiga", "oigamos", "oigáis", "oigan"], imperfectoSubjuntivo: ["oyera", "oyeras", "oyera", "oyéramos", "oyerais", "oyeran"], participle: "oído", note: null },
    { inf: "pensar", en: "to think", presente: ["pienso", "piensas", "piensa", "pensamos", "pensáis", "piensan"], preterito: ["pensé", "pensaste", "pensó", "pensamos", "pensasteis", "pensaron"], imperfecto: ["pensaba", "pensabas", "pensaba", "pensábamos", "pensabais", "pensaban"], futuro: ["pensaré", "pensarás", "pensará", "pensaremos", "pensaréis", "pensarán"], condicional: ["pensaría", "pensarías", "pensaría", "pensaríamos", "pensaríais", "pensarían"], presentePerfecto: ["he pensado", "has pensado", "ha pensado", "hemos pensado", "habéis pensado", "han pensado"], pluscuamperfecto: ["había pensado", "habías pensado", "había pensado", "habíamos pensado", "habíais pensado", "habían pensado"], futuroPerfecto: ["habré pensado", "habrás pensado", "habrá pensado", "habremos pensado", "habréis pensado", "habrán pensado"], condicionalPerfecto: ["habría pensado", "habrías pensado", "habría pensado", "habríamos pensado", "habríais pensado", "habrían pensado"], presenteSubjuntivo: ["piense", "pienses", "piense", "pensemos", "penséis", "piensen"], imperfectoSubjuntivo: ["pensara", "pensaras", "pensara", "pensáramos", "pensarais", "pensaran"], participle: "pensado", note: null },
    { inf: "cerrar", en: "to close", presente: ["cierro", "cierras", "cierra", "cerramos", "cerráis", "cierran"], preterito: ["cerré", "cerraste", "cerró", "cerramos", "cerrasteis", "cerraron"], imperfecto: ["cerraba", "cerrabas", "cerraba", "cerrábamos", "cerrabais", "cerraban"], futuro: ["cerraré", "cerrarás", "cerrará", "cerraremos", "cerraréis", "cerrarán"], condicional: ["cerraría", "cerrarías", "cerraría", "cerraríamos", "cerraríais", "cerrarían"], presentePerfecto: ["he cerrado", "has cerrado", "ha cerrado", "hemos cerrado", "habéis cerrado", "han cerrado"], pluscuamperfecto: ["había cerrado", "habías cerrado", "había cerrado", "habíamos cerrado", "habíais cerrado", "habían cerrado"], futuroPerfecto: ["habré cerrado", "habrás cerrado", "habrá cerrado", "habremos cerrado", "habréis cerrado", "habrán cerrado"], condicionalPerfecto: ["habría cerrado", "habrías cerrado", "habría cerrado", "habríamos cerrado", "habríais cerrado", "habrían cerrado"], presenteSubjuntivo: ["cierre", "cierres", "cierre", "cerremos", "cerréis", "cierren"], imperfectoSubjuntivo: ["cerrara", "cerraras", "cerrara", "cerráramos", "cerrarais", "cerraran"], participle: "cerrado", note: null },
    { inf: "empezar", en: "to start", presente: ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"], preterito: ["empecé", "empezaste", "empezó", "empezamos", "empezasteis", "empezaron"], imperfecto: ["empezaba", "empezabas", "empezaba", "empezábamos", "empezabais", "empezaban"], futuro: ["empezaré", "empezarás", "empezará", "empezaremos", "empezaréis", "empezarán"], condicional: ["empezaría", "empezarías", "empezaría", "empezaríamos", "empezaríais", "empezarían"], presentePerfecto: ["he empezado", "has empezado", "ha empezado", "hemos empezado", "habéis empezado", "han empezado"], pluscuamperfecto: ["había empezado", "habías empezado", "había empezado", "habíamos empezado", "habíais empezado", "habían empezado"], futuroPerfecto: ["habré empezado", "habrás empezado", "habrá empezado", "habremos empezado", "habréis empezado", "habrán empezado"], condicionalPerfecto: ["habría empezado", "habrías empezado", "habría empezado", "habríamos empezado", "habríais empezado", "habrían empezado"], presenteSubjuntivo: ["empiece", "empieces", "empiece", "empecemos", "empecéis", "empiecen"], imperfectoSubjuntivo: ["empezara", "empezaras", "empezara", "empezáramos", "empezarais", "empezaran"], participle: "empezado", note: null },
    { inf: "comenzar", en: "to begin", presente: ["comienzo", "comienzas", "comienza", "comenzamos", "comenzáis", "comienzan"], preterito: ["comencé", "comenzaste", "comenzó", "comenzamos", "comenzasteis", "comenzaron"], imperfecto: ["comenzaba", "comenzabas", "comenzaba", "comenzábamos", "comenzabais", "comenzaban"], futuro: ["comenzaré", "comenzarás", "comenzará", "comenzaremos", "comenzaréis", "comenzarán"], condicional: ["comenzaría", "comenzarías", "comenzaría", "comenzaríamos", "comenzaríais", "comenzarían"], presentePerfecto: ["he comenzado", "has comenzado", "ha comenzado", "hemos comenzado", "habéis comenzado", "han comenzado"], pluscuamperfecto: ["había comenzado", "habías comenzado", "había comenzado", "habíamos comenzado", "habíais comenzado", "habían comenzado"], futuroPerfecto: ["habré comenzado", "habrás comenzado", "habrá comenzado", "habremos comenzado", "habréis comenzado", "habrán comenzado"], condicionalPerfecto: ["habría comenzado", "habrías comenzado", "habría comenzado", "habríamos comenzado", "habríais comenzado", "habrían comenzado"], presenteSubjuntivo: ["comience", "comiences", "comience", "comencemos", "comencéis", "comiencen"], imperfectoSubjuntivo: ["comenzara", "comenzaras", "comenzara", "comenzáramos", "comenzarais", "comenzaran"], participle: "comenzado", note: null },
    { inf: "entender", en: "to understand", presente: ["entiendo", "entiendes", "entiende", "entendemos", "entendéis", "entienden"], preterito: ["entendí", "entendiste", "entendió", "entendimos", "entendisteis", "entendieron"], imperfecto: ["entendía", "entendías", "entendía", "entendíamos", "entendíais", "entendían"], futuro: ["entenderé", "entenderás", "entenderá", "entenderemos", "entenderéis", "entenderán"], condicional: ["entendería", "entenderías", "entendería", "entenderíamos", "entenderíais", "entenderían"], presentePerfecto: ["he entendido", "has entendido", "ha entendido", "hemos entendido", "habéis entendido", "han entendido"], pluscuamperfecto: ["había entendido", "habías entendido", "había entendido", "habíamos entendido", "habíais entendido", "habían entendido"], futuroPerfecto: ["habré entendido", "habrás entendido", "habrá entendido", "habremos entendido", "habréis entendido", "habrán entendido"], condicionalPerfecto: ["habría entendido", "habrías entendido", "habría entendido", "habríamos entendido", "habríais entendido", "habrían entendido"], presenteSubjuntivo: ["entienda", "entiendas", "entienda", "entendamos", "entendáis", "entiendan"], imperfectoSubjuntivo: ["entendiera", "entendieras", "entendiera", "entendiéramos", "entendierais", "entendieran"], participle: "entendido", note: null },
    { inf: "perder", en: "to lose", presente: ["pierdo", "pierdes", "pierde", "perdemos", "perdéis", "pierden"], preterito: ["perdí", "perdiste", "perdió", "perdimos", "perdisteis", "perdieron"], imperfecto: ["perdía", "perdías", "perdía", "perdíamos", "perdíais", "perdían"], futuro: ["perderé", "perderás", "perderá", "perderemos", "perderéis", "perderán"], condicional: ["perdería", "perderías", "perdería", "perderíamos", "perderíais", "perderían"], presentePerfecto: ["he perdido", "has perdido", "ha perdido", "hemos perdido", "habéis perdido", "han perdido"], pluscuamperfecto: ["había perdido", "habías perdido", "había perdido", "habíamos perdido", "habíais perdido", "habían perdido"], futuroPerfecto: ["habré perdido", "habrás perdido", "habrá perdido", "habremos perdido", "habréis perdido", "habrán perdido"], condicionalPerfecto: ["habría perdido", "habrías perdido", "habría perdido", "habríamos perdido", "habríais perdido", "habrían perdido"], presenteSubjuntivo: ["pierda", "pierdas", "pierda", "perdamos", "perdáis", "pierdan"], imperfectoSubjuntivo: ["perdiera", "perdieras", "perdiera", "perdiéramos", "perdierais", "perdieran"], participle: "perdido", note: null },
    { inf: "volver", en: "to return", presente: ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"], preterito: ["volví", "volviste", "volvió", "volvimos", "volvisteis", "volvieron"], imperfecto: ["volvía", "volvías", "volvía", "volvíamos", "volvíais", "volvían"], futuro: ["volveré", "volverás", "volverá", "volveremos", "volveréis", "volverán"], condicional: ["volvería", "volverías", "volvería", "volveríamos", "volveríais", "volverían"], presentePerfecto: ["he vuelto", "has vuelto", "ha vuelto", "hemos vuelto", "habéis vuelto", "han vuelto"], pluscuamperfecto: ["había vuelto", "habías vuelto", "había vuelto", "habíamos vuelto", "habíais vuelto", "habían vuelto"], futuroPerfecto: ["habré vuelto", "habrás vuelto", "habrá vuelto", "habremos vuelto", "habréis vuelto", "habrán vuelto"], condicionalPerfecto: ["habría vuelto", "habrías vuelto", "habría vuelto", "habríamos vuelto", "habríais vuelto", "habrían vuelto"], presenteSubjuntivo: ["vuelva", "vuelvas", "vuelva", "volvamos", "volváis", "vuelvan"], imperfectoSubjuntivo: ["volviera", "volvieras", "volviera", "volviéramos", "volvierais", "volvieran"], participle: "vuelto", note: null },
    { inf: "encontrar", en: "to find", presente: ["encuentro", "encuentras", "encuentra", "encontramos", "encontráis", "encuentran"], preterito: ["encontré", "encontraste", "encontró", "encontramos", "encontrasteis", "encontraron"], imperfecto: ["encontraba", "encontrabas", "encontraba", "encontrábamos", "encontrabais", "encontraban"], futuro: ["encontraré", "encontrarás", "encontrará", "encontraremos", "encontraréis", "encontrarán"], condicional: ["encontraría", "encontrarías", "encontraría", "encontraríamos", "encontraríais", "encontrarían"], presentePerfecto: ["he encontrado", "has encontrado", "ha encontrado", "hemos encontrado", "habéis encontrado", "han encontrado"], pluscuamperfecto: ["había encontrado", "habías encontrado", "había encontrado", "habíamos encontrado", "habíais encontrado", "habían encontrado"], futuroPerfecto: ["habré encontrado", "habrás encontrado", "habrá encontrado", "habremos encontrado", "habréis encontrado", "habrán encontrado"], condicionalPerfecto: ["habría encontrado", "habrías encontrado", "habría encontrado", "habríamos encontrado", "habríais encontrado", "habrían encontrado"], presenteSubjuntivo: ["encuentre", "encuentres", "encuentre", "encontremos", "encontréis", "encuentren"], imperfectoSubjuntivo: ["encontrara", "encontraras", "encontrara", "encontráramos", "encontrarais", "encontraran"], participle: "encontrado", note: null },
    { inf: "recordar", en: "to remember", presente: ["recuerdo", "recuerdas", "recuerda", "recordamos", "recordáis", "recuerdan"], preterito: ["recordé", "recordaste", "recordó", "recordamos", "recordasteis", "recordaron"], imperfecto: ["recordaba", "recordabas", "recordaba", "recordábamos", "recordabais", "recordaban"], futuro: ["recordaré", "recordarás", "recordará", "recordaremos", "recordaréis", "recordarán"], condicional: ["recordaría", "recordarías", "recordaría", "recordaríamos", "recordaríais", "recordarían"], presentePerfecto: ["he recordado", "has recordado", "ha recordado", "hemos recordado", "habéis recordado", "han recordado"], pluscuamperfecto: ["había recordado", "habías recordado", "había recordado", "habíamos recordado", "habíais recordado", "habían recordado"], futuroPerfecto: ["habré recordado", "habrás recordado", "habrá recordado", "habremos recordado", "habréis recordado", "habrán recordado"], condicionalPerfecto: ["habría recordado", "habrías recordado", "habría recordado", "habríamos recordado", "habríais recordado", "habrían recordado"], presenteSubjuntivo: ["recuerde", "recuerdes", "recuerde", "recordemos", "recordéis", "recuerden"], imperfectoSubjuntivo: ["recordara", "recordaras", "recordara", "recordáramos", "recordarais", "recordaran"], participle: "recordado", note: null },
    { inf: "contar", en: "to count / tell", presente: ["cuento", "cuentas", "cuenta", "contamos", "contáis", "cuentan"], preterito: ["conté", "contaste", "contó", "contamos", "contasteis", "contaron"], imperfecto: ["contaba", "contabas", "contaba", "contábamos", "contabais", "contaban"], futuro: ["contaré", "contarás", "contará", "contaremos", "contaréis", "contarán"], condicional: ["contaría", "contarías", "contaría", "contaríamos", "contaríais", "contarían"], presentePerfecto: ["he contado", "has contado", "ha contado", "hemos contado", "habéis contado", "han contado"], pluscuamperfecto: ["había contado", "habías contado", "había contado", "habíamos contado", "habíais contado", "habían contado"], futuroPerfecto: ["habré contado", "habrás contado", "habrá contado", "habremos contado", "habréis contado", "habrán contado"], condicionalPerfecto: ["habría contado", "habrías contado", "habría contado", "habríamos contado", "habríais contado", "habrían contado"], presenteSubjuntivo: ["cuente", "cuentes", "cuente", "contemos", "contéis", "cuenten"], imperfectoSubjuntivo: ["contara", "contaras", "contara", "contáramos", "contarais", "contaran"], participle: "contado", note: null },
    { inf: "mostrar", en: "to show", presente: ["muestro", "muestras", "muestra", "mostramos", "mostráis", "muestran"], preterito: ["mostré", "mostraste", "mostró", "mostramos", "mostrasteis", "mostraron"], imperfecto: ["mostraba", "mostrabas", "mostraba", "mostrábamos", "mostrabais", "mostraban"], futuro: ["mostraré", "mostrarás", "mostrará", "mostraremos", "mostraréis", "mostrarán"], condicional: ["mostraría", "mostrarías", "mostraría", "mostraríamos", "mostraríais", "mostrarían"], presentePerfecto: ["he mostrado", "has mostrado", "ha mostrado", "hemos mostrado", "habéis mostrado", "han mostrado"], pluscuamperfecto: ["había mostrado", "habías mostrado", "había mostrado", "habíamos mostrado", "habíais mostrado", "habían mostrado"], futuroPerfecto: ["habré mostrado", "habrás mostrado", "habrá mostrado", "habremos mostrado", "habréis mostrado", "habrán mostrado"], condicionalPerfecto: ["habría mostrado", "habrías mostrado", "habría mostrado", "habríamos mostrado", "habríais mostrado", "habrían mostrado"], presenteSubjuntivo: ["muestre", "muestres", "muestre", "mostremos", "mostréis", "muestren"], imperfectoSubjuntivo: ["mostrara", "mostraras", "mostrara", "mostráramos", "mostrarais", "mostraran"], participle: "mostrado", note: null },
    { inf: "jugar", en: "to play", presente: ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"], preterito: ["jugué", "jugaste", "jugó", "jugamos", "jugasteis", "jugaron"], imperfecto: ["jugaba", "jugabas", "jugaba", "jugábamos", "jugabais", "jugaban"], futuro: ["jugaré", "jugarás", "jugará", "jugaremos", "jugaréis", "jugarán"], condicional: ["jugaría", "jugarías", "jugaría", "jugaríamos", "jugaríais", "jugarían"], presentePerfecto: ["he jugado", "has jugado", "ha jugado", "hemos jugado", "habéis jugado", "han jugado"], pluscuamperfecto: ["había jugado", "habías jugado", "había jugado", "habíamos jugado", "habíais jugado", "habían jugado"], futuroPerfecto: ["habré jugado", "habrás jugado", "habrá jugado", "habremos jugado", "habréis jugado", "habrán jugado"], condicionalPerfecto: ["habría jugado", "habrías jugado", "habría jugado", "habríamos jugado", "habríais jugado", "habrían jugado"], presenteSubjuntivo: ["juegue", "juegues", "juegue", "juguemos", "juguéis", "jueguen"], imperfectoSubjuntivo: ["jugara", "jugaras", "jugara", "jugáramos", "jugarais", "jugaran"], participle: "jugado", note: null },
    { inf: "dormir", en: "to sleep", presente: ["duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"], preterito: ["dormí", "dormiste", "durmió", "dormimos", "dormisteis", "durmieron"], imperfecto: ["dormía", "dormías", "dormía", "dormíamos", "dormíais", "dormían"], futuro: ["dormiré", "dormirás", "dormirá", "dormiremos", "dormiréis", "dormirán"], condicional: ["dormiría", "dormirías", "dormiría", "dormiríamos", "dormiríais", "dormirían"], presentePerfecto: ["he dormido", "has dormido", "ha dormido", "hemos dormido", "habéis dormido", "han dormido"], pluscuamperfecto: ["había dormido", "habías dormido", "había dormido", "habíamos dormido", "habíais dormido", "habían dormido"], futuroPerfecto: ["habré dormido", "habrás dormido", "habrá dormido", "habremos dormido", "habréis dormido", "habrán dormido"], condicionalPerfecto: ["habría dormido", "habrías dormido", "habría dormido", "habríamos dormido", "habríais dormido", "habrían dormido"], presenteSubjuntivo: ["duerma", "duermas", "duerma", "durmamos", "durmáis", "duerman"], imperfectoSubjuntivo: ["durmiera", "durmieras", "durmiera", "durmiéramos", "durmierais", "durmieran"], participle: "dormido", note: null },
    { inf: "morir", en: "to die", presente: ["muero", "mueres", "muere", "morimos", "morís", "mueren"], preterito: ["morí", "moriste", "murió", "morimos", "moristeis", "murieron"], imperfecto: ["moría", "morías", "moría", "moríamos", "moríais", "morían"], futuro: ["moriré", "morirás", "morirá", "moriremos", "moriréis", "morirán"], condicional: ["moriría", "morirías", "moriría", "moriríamos", "moriríais", "morirían"], presentePerfecto: ["he muerto", "has muerto", "ha muerto", "hemos muerto", "habéis muerto", "han muerto"], pluscuamperfecto: ["había muerto", "habías muerto", "había muerto", "habíamos muerto", "habíais muerto", "habían muerto"], futuroPerfecto: ["habré muerto", "habrás muerto", "habrá muerto", "habremos muerto", "habréis muerto", "habrán muerto"], condicionalPerfecto: ["habría muerto", "habrías muerto", "habría muerto", "habríamos muerto", "habríais muerto", "habrían muerto"], presenteSubjuntivo: ["muera", "mueras", "muera", "muramos", "muráis", "mueran"], imperfectoSubjuntivo: ["muriera", "murieras", "muriera", "muriéramos", "murierais", "murieran"], participle: "muerto", note: null },
    { inf: "sentir", en: "to feel", presente: ["siento", "sientes", "siente", "sentimos", "sentís", "sienten"], preterito: ["sentí", "sentiste", "sintió", "sentimos", "sentisteis", "sintieron"], imperfecto: ["sentía", "sentías", "sentía", "sentíamos", "sentíais", "sentían"], futuro: ["sentiré", "sentirás", "sentirá", "sentiremos", "sentiréis", "sentirán"], condicional: ["sentiría", "sentirías", "sentiría", "sentiríamos", "sentiríais", "sentirían"], presentePerfecto: ["he sentido", "has sentido", "ha sentido", "hemos sentido", "habéis sentido", "han sentido"], pluscuamperfecto: ["había sentido", "habías sentido", "había sentido", "habíamos sentido", "habíais sentido", "habían sentido"], futuroPerfecto: ["habré sentido", "habrás sentido", "habrá sentido", "habremos sentido", "habréis sentido", "habrán sentido"], condicionalPerfecto: ["habría sentido", "habrías sentido", "habría sentido", "habríamos sentido", "habríais sentido", "habrían sentido"], presenteSubjuntivo: ["sienta", "sientas", "sienta", "sintamos", "sintáis", "sientan"], imperfectoSubjuntivo: ["sintiera", "sintieras", "sintiera", "sintiéramos", "sintierais", "sintieran"], participle: "sentido", note: null },
    { inf: "preferir", en: "to prefer", presente: ["prefiero", "prefieres", "prefiere", "preferimos", "preferís", "prefieren"], preterito: ["preferí", "preferiste", "prefirió", "preferimos", "preferisteis", "prefirieron"], imperfecto: ["prefería", "preferías", "prefería", "preferíamos", "preferíais", "preferían"], futuro: ["preferiré", "preferirás", "preferirá", "preferiremos", "preferiréis", "preferirán"], condicional: ["preferiría", "preferirías", "preferiría", "preferiríamos", "preferiríais", "preferirían"], presentePerfecto: ["he preferido", "has preferido", "ha preferido", "hemos preferido", "habéis preferido", "han preferido"], pluscuamperfecto: ["había preferido", "habías preferido", "había preferido", "habíamos preferido", "habíais preferido", "habían preferido"], futuroPerfecto: ["habré preferido", "habrás preferido", "habrá preferido", "habremos preferido", "habréis preferido", "habrán preferido"], condicionalPerfecto: ["habría preferido", "habrías preferido", "habría preferido", "habríamos preferido", "habríais preferido", "habrían preferido"], presenteSubjuntivo: ["prefiera", "prefieras", "prefiera", "prefiramos", "prefiráis", "prefieran"], imperfectoSubjuntivo: ["prefiriera", "prefirieras", "prefiriera", "prefiriéramos", "prefirierais", "prefirieran"], participle: "preferido", note: null },
    { inf: "pedir", en: "to ask for", presente: ["pido", "pides", "pide", "pedimos", "pedís", "piden"], preterito: ["pedí", "pediste", "pidió", "pedimos", "pedisteis", "pidieron"], imperfecto: ["pedía", "pedías", "pedía", "pedíamos", "pedíais", "pedían"], futuro: ["pediré", "pedirás", "pedirá", "pediremos", "pediréis", "pedirán"], condicional: ["pediría", "pedirías", "pediría", "pediríamos", "pediríais", "pedirían"], presentePerfecto: ["he pedido", "has pedido", "ha pedido", "hemos pedido", "habéis pedido", "han pedido"], pluscuamperfecto: ["había pedido", "habías pedido", "había pedido", "habíamos pedido", "habíais pedido", "habían pedido"], futuroPerfecto: ["habré pedido", "habrás pedido", "habrá pedido", "habremos pedido", "habréis pedido", "habrán pedido"], condicionalPerfecto: ["habría pedido", "habrías pedido", "habría pedido", "habríamos pedido", "habríais pedido", "habrían pedido"], presenteSubjuntivo: ["pida", "pidas", "pida", "pidamos", "pidáis", "pidan"], imperfectoSubjuntivo: ["pidiera", "pidieras", "pidiera", "pidiéramos", "pidierais", "pidieran"], participle: "pedido", note: null },
    { inf: "seguir", en: "to follow / continue", presente: ["sigo", "sigues", "sigue", "seguimos", "seguís", "siguen"], preterito: ["seguí", "seguiste", "siguió", "seguimos", "seguisteis", "siguieron"], imperfecto: ["seguía", "seguías", "seguía", "seguíamos", "seguíais", "seguían"], futuro: ["seguiré", "seguirás", "seguirá", "seguiremos", "seguiréis", "seguirán"], condicional: ["seguiría", "seguirías", "seguiría", "seguiríamos", "seguiríais", "seguirían"], presentePerfecto: ["he seguido", "has seguido", "ha seguido", "hemos seguido", "habéis seguido", "han seguido"], pluscuamperfecto: ["había seguido", "habías seguido", "había seguido", "habíamos seguido", "habíais seguido", "habían seguido"], futuroPerfecto: ["habré seguido", "habrás seguido", "habrá seguido", "habremos seguido", "habréis seguido", "habrán seguido"], condicionalPerfecto: ["habría seguido", "habrías seguido", "habría seguido", "habríamos seguido", "habríais seguido", "habrían seguido"], presenteSubjuntivo: ["siga", "sigas", "siga", "sigamos", "sigáis", "sigan"], imperfectoSubjuntivo: ["siguiera", "siguieras", "siguiera", "siguiéramos", "siguierais", "siguieran"], participle: "seguido", note: null },
    { inf: "servir", en: "to serve", presente: ["sirvo", "sirves", "sirve", "servimos", "servís", "sirven"], preterito: ["serví", "serviste", "sirvió", "servimos", "servisteis", "sirvieron"], imperfecto: ["servía", "servías", "servía", "servíamos", "servíais", "servían"], futuro: ["serviré", "servirás", "servirá", "serviremos", "serviréis", "servirán"], condicional: ["serviría", "servirías", "serviría", "serviríamos", "serviríais", "servirían"], presentePerfecto: ["he servido", "has servido", "ha servido", "hemos servido", "habéis servido", "han servido"], pluscuamperfecto: ["había servido", "habías servido", "había servido", "habíamos servido", "habíais servido", "habían servido"], futuroPerfecto: ["habré servido", "habrás servido", "habrá servido", "habremos servido", "habréis servido", "habrán servido"], condicionalPerfecto: ["habría servido", "habrías servido", "habría servido", "habríamos servido", "habríais servido", "habrían servido"], presenteSubjuntivo: ["sirva", "sirvas", "sirva", "sirvamos", "sirváis", "sirvan"], imperfectoSubjuntivo: ["sirviera", "sirvieras", "sirviera", "sirviéramos", "sirvierais", "sirvieran"], participle: "servido", note: null },
    { inf: "repetir", en: "to repeat", presente: ["repito", "repites", "repite", "repetimos", "repetís", "repiten"], preterito: ["repetí", "repetiste", "repitió", "repetimos", "repetisteis", "repitieron"], imperfecto: ["repetía", "repetías", "repetía", "repetíamos", "repetíais", "repetían"], futuro: ["repetiré", "repetirás", "repetirá", "repetiremos", "repetiréis", "repetirán"], condicional: ["repetiría", "repetirías", "repetiría", "repetiríamos", "repetiríais", "repetirían"], presentePerfecto: ["he repetido", "has repetido", "ha repetido", "hemos repetido", "habéis repetido", "han repetido"], pluscuamperfecto: ["había repetido", "habías repetido", "había repetido", "habíamos repetido", "habíais repetido", "habían repetido"], futuroPerfecto: ["habré repetido", "habrás repetido", "habrá repetido", "habremos repetido", "habréis repetido", "habrán repetido"], condicionalPerfecto: ["habría repetido", "habrías repetido", "habría repetido", "habríamos repetido", "habríais repetido", "habrían repetido"], presenteSubjuntivo: ["repita", "repitas", "repita", "repitamos", "repitáis", "repitan"], imperfectoSubjuntivo: ["repitiera", "repitieras", "repitiera", "repitiéramos", "repitierais", "repitieran"], participle: "repetido", note: null },
    { inf: "vestir", en: "to dress", presente: ["visto", "vistes", "viste", "vestimos", "vestís", "visten"], preterito: ["vestí", "vestiste", "vistió", "vestimos", "vestisteis", "vistieron"], imperfecto: ["vestía", "vestías", "vestía", "vestíamos", "vestíais", "vestían"], futuro: ["vestiré", "vestirás", "vestirá", "vestiremos", "vestiréis", "vestirán"], condicional: ["vestiría", "vestirías", "vestiría", "vestiríamos", "vestiríais", "vestirían"], presentePerfecto: ["he vestido", "has vestido", "ha vestido", "hemos vestido", "habéis vestido", "han vestido"], pluscuamperfecto: ["había vestido", "habías vestido", "había vestido", "habíamos vestido", "habíais vestido", "habían vestido"], futuroPerfecto: ["habré vestido", "habrás vestido", "habrá vestido", "habremos vestido", "habréis vestido", "habrán vestido"], condicionalPerfecto: ["habría vestido", "habrías vestido", "habría vestido", "habríamos vestido", "habríais vestido", "habrían vestido"], presenteSubjuntivo: ["vista", "vistas", "vista", "vistamos", "vistáis", "vistan"], imperfectoSubjuntivo: ["vistiera", "vistieras", "vistiera", "vistiéramos", "vistierais", "vistieran"], participle: "vestido", note: null },
    { inf: "buscar", en: "to look for", presente: ["busco", "buscas", "busca", "buscamos", "buscáis", "buscan"], preterito: ["busqué", "buscaste", "buscó", "buscamos", "buscasteis", "buscaron"], imperfecto: ["buscaba", "buscabas", "buscaba", "buscábamos", "buscabais", "buscaban"], futuro: ["buscaré", "buscarás", "buscará", "buscaremos", "buscaréis", "buscarán"], condicional: ["buscaría", "buscarías", "buscaría", "buscaríamos", "buscaríais", "buscarían"], presentePerfecto: ["he buscado", "has buscado", "ha buscado", "hemos buscado", "habéis buscado", "han buscado"], pluscuamperfecto: ["había buscado", "habías buscado", "había buscado", "habíamos buscado", "habíais buscado", "habían buscado"], futuroPerfecto: ["habré buscado", "habrás buscado", "habrá buscado", "habremos buscado", "habréis buscado", "habrán buscado"], condicionalPerfecto: ["habría buscado", "habrías buscado", "habría buscado", "habríamos buscado", "habríais buscado", "habrían buscado"], presenteSubjuntivo: ["busque", "busques", "busque", "busquemos", "busquéis", "busquen"], imperfectoSubjuntivo: ["buscara", "buscaras", "buscara", "buscáramos", "buscarais", "buscaran"], participle: "buscado", note: null },
    { inf: "llegar", en: "to arrive", presente: ["llego", "llegas", "llega", "llegamos", "llegáis", "llegan"], preterito: ["llegué", "llegaste", "llegó", "llegamos", "llegasteis", "llegaron"], imperfecto: ["llegaba", "llegabas", "llegaba", "llegábamos", "llegabais", "llegaban"], futuro: ["llegaré", "llegarás", "llegará", "llegaremos", "llegaréis", "llegarán"], condicional: ["llegaría", "llegarías", "llegaría", "llegaríamos", "llegaríais", "llegarían"], presentePerfecto: ["he llegado", "has llegado", "ha llegado", "hemos llegado", "habéis llegado", "han llegado"], pluscuamperfecto: ["había llegado", "habías llegado", "había llegado", "habíamos llegado", "habíais llegado", "habían llegado"], futuroPerfecto: ["habré llegado", "habrás llegado", "habrá llegado", "habremos llegado", "habréis llegado", "habrán llegado"], condicionalPerfecto: ["habría llegado", "habrías llegado", "habría llegado", "habríamos llegado", "habríais llegado", "habrían llegado"], presenteSubjuntivo: ["llegue", "llegues", "llegue", "lleguemos", "lleguéis", "lleguen"], imperfectoSubjuntivo: ["llegara", "llegaras", "llegara", "llegáramos", "llegarais", "llegaran"], participle: "llegado", note: null },
    { inf: "pagar", en: "to pay", presente: ["pago", "pagas", "paga", "pagamos", "pagáis", "pagan"], preterito: ["pagué", "pagaste", "pagó", "pagamos", "pagasteis", "pagaron"], imperfecto: ["pagaba", "pagabas", "pagaba", "pagábamos", "pagabais", "pagaban"], futuro: ["pagaré", "pagarás", "pagará", "pagaremos", "pagaréis", "pagarán"], condicional: ["pagaría", "pagarías", "pagaría", "pagaríamos", "pagaríais", "pagarían"], presentePerfecto: ["he pagado", "has pagado", "ha pagado", "hemos pagado", "habéis pagado", "han pagado"], pluscuamperfecto: ["había pagado", "habías pagado", "había pagado", "habíamos pagado", "habíais pagado", "habían pagado"], futuroPerfecto: ["habré pagado", "habrás pagado", "habrá pagado", "habremos pagado", "habréis pagado", "habrán pagado"], condicionalPerfecto: ["habría pagado", "habrías pagado", "habría pagado", "habríamos pagado", "habríais pagado", "habrían pagado"], presenteSubjuntivo: ["pague", "pagues", "pague", "paguemos", "paguéis", "paguen"], imperfectoSubjuntivo: ["pagara", "pagaras", "pagara", "pagáramos", "pagarais", "pagaran"], participle: "pagado", note: null },
    { inf: "tocar", en: "to touch / play (an instrument)", presente: ["toco", "tocas", "toca", "tocamos", "tocáis", "tocan"], preterito: ["toqué", "tocaste", "tocó", "tocamos", "tocasteis", "tocaron"], imperfecto: ["tocaba", "tocabas", "tocaba", "tocábamos", "tocabais", "tocaban"], futuro: ["tocaré", "tocarás", "tocará", "tocaremos", "tocaréis", "tocarán"], condicional: ["tocaría", "tocarías", "tocaría", "tocaríamos", "tocaríais", "tocarían"], presentePerfecto: ["he tocado", "has tocado", "ha tocado", "hemos tocado", "habéis tocado", "han tocado"], pluscuamperfecto: ["había tocado", "habías tocado", "había tocado", "habíamos tocado", "habíais tocado", "habían tocado"], futuroPerfecto: ["habré tocado", "habrás tocado", "habrá tocado", "habremos tocado", "habréis tocado", "habrán tocado"], condicionalPerfecto: ["habría tocado", "habrías tocado", "habría tocado", "habríamos tocado", "habríais tocado", "habrían tocado"], presenteSubjuntivo: ["toque", "toques", "toque", "toquemos", "toquéis", "toquen"], imperfectoSubjuntivo: ["tocara", "tocaras", "tocara", "tocáramos", "tocarais", "tocaran"], participle: "tocado", note: null },
    { inf: "sacar", en: "to take out", presente: ["saco", "sacas", "saca", "sacamos", "sacáis", "sacan"], preterito: ["saqué", "sacaste", "sacó", "sacamos", "sacasteis", "sacaron"], imperfecto: ["sacaba", "sacabas", "sacaba", "sacábamos", "sacabais", "sacaban"], futuro: ["sacaré", "sacarás", "sacará", "sacaremos", "sacaréis", "sacarán"], condicional: ["sacaría", "sacarías", "sacaría", "sacaríamos", "sacaríais", "sacarían"], presentePerfecto: ["he sacado", "has sacado", "ha sacado", "hemos sacado", "habéis sacado", "han sacado"], pluscuamperfecto: ["había sacado", "habías sacado", "había sacado", "habíamos sacado", "habíais sacado", "habían sacado"], futuroPerfecto: ["habré sacado", "habrás sacado", "habrá sacado", "habremos sacado", "habréis sacado", "habrán sacado"], condicionalPerfecto: ["habría sacado", "habrías sacado", "habría sacado", "habríamos sacado", "habríais sacado", "habrían sacado"], presenteSubjuntivo: ["saque", "saques", "saque", "saquemos", "saquéis", "saquen"], imperfectoSubjuntivo: ["sacara", "sacaras", "sacara", "sacáramos", "sacarais", "sacaran"], participle: "sacado", note: null },
    { inf: "explicar", en: "to explain", presente: ["explico", "explicas", "explica", "explicamos", "explicáis", "explican"], preterito: ["expliqué", "explicaste", "explicó", "explicamos", "explicasteis", "explicaron"], imperfecto: ["explicaba", "explicabas", "explicaba", "explicábamos", "explicabais", "explicaban"], futuro: ["explicaré", "explicarás", "explicará", "explicaremos", "explicaréis", "explicarán"], condicional: ["explicaría", "explicarías", "explicaría", "explicaríamos", "explicaríais", "explicarían"], presentePerfecto: ["he explicado", "has explicado", "ha explicado", "hemos explicado", "habéis explicado", "han explicado"], pluscuamperfecto: ["había explicado", "habías explicado", "había explicado", "habíamos explicado", "habíais explicado", "habían explicado"], futuroPerfecto: ["habré explicado", "habrás explicado", "habrá explicado", "habremos explicado", "habréis explicado", "habrán explicado"], condicionalPerfecto: ["habría explicado", "habrías explicado", "habría explicado", "habríamos explicado", "habríais explicado", "habrían explicado"], presenteSubjuntivo: ["explique", "expliques", "explique", "expliquemos", "expliquéis", "expliquen"], imperfectoSubjuntivo: ["explicara", "explicaras", "explicara", "explicáramos", "explicarais", "explicaran"], participle: "explicado", note: null },
    { inf: "practicar", en: "to practice", presente: ["practico", "practicas", "practica", "practicamos", "practicáis", "practican"], preterito: ["practiqué", "practicaste", "practicó", "practicamos", "practicasteis", "practicaron"], imperfecto: ["practicaba", "practicabas", "practicaba", "practicábamos", "practicabais", "practicaban"], futuro: ["practicaré", "practicarás", "practicará", "practicaremos", "practicaréis", "practicarán"], condicional: ["practicaría", "practicarías", "practicaría", "practicaríamos", "practicaríais", "practicarían"], presentePerfecto: ["he practicado", "has practicado", "ha practicado", "hemos practicado", "habéis practicado", "han practicado"], pluscuamperfecto: ["había practicado", "habías practicado", "había practicado", "habíamos practicado", "habíais practicado", "habían practicado"], futuroPerfecto: ["habré practicado", "habrás practicado", "habrá practicado", "habremos practicado", "habréis practicado", "habrán practicado"], condicionalPerfecto: ["habría practicado", "habrías practicado", "habría practicado", "habríamos practicado", "habríais practicado", "habrían practicado"], presenteSubjuntivo: ["practique", "practiques", "practique", "practiquemos", "practiquéis", "practiquen"], imperfectoSubjuntivo: ["practicara", "practicaras", "practicara", "practicáramos", "practicarais", "practicaran"], participle: "practicado", note: null },
    { inf: "leer", en: "to read", presente: ["leo", "lees", "lee", "leemos", "leéis", "leen"], preterito: ["leí", "leíste", "leyó", "leímos", "leísteis", "leyeron"], imperfecto: ["leía", "leías", "leía", "leíamos", "leíais", "leían"], futuro: ["leeré", "leerás", "leerá", "leeremos", "leeréis", "leerán"], condicional: ["leería", "leerías", "leería", "leeríamos", "leeríais", "leerían"], presentePerfecto: ["he leído", "has leído", "ha leído", "hemos leído", "habéis leído", "han leído"], pluscuamperfecto: ["había leído", "habías leído", "había leído", "habíamos leído", "habíais leído", "habían leído"], futuroPerfecto: ["habré leído", "habrás leído", "habrá leído", "habremos leído", "habréis leído", "habrán leído"], condicionalPerfecto: ["habría leído", "habrías leído", "habría leído", "habríamos leído", "habríais leído", "habrían leído"], presenteSubjuntivo: ["lea", "leas", "lea", "leamos", "leáis", "lean"], imperfectoSubjuntivo: ["leyera", "leyeras", "leyera", "leyéramos", "leyerais", "leyeran"], participle: "leído", note: null },
    { inf: "creer", en: "to believe", presente: ["creo", "crees", "cree", "creemos", "creéis", "creen"], preterito: ["creí", "creíste", "creyó", "creímos", "creísteis", "creyeron"], imperfecto: ["creía", "creías", "creía", "creíamos", "creíais", "creían"], futuro: ["creeré", "creerás", "creerá", "creeremos", "creeréis", "creerán"], condicional: ["creería", "creerías", "creería", "creeríamos", "creeríais", "creerían"], presentePerfecto: ["he creído", "has creído", "ha creído", "hemos creído", "habéis creído", "han creído"], pluscuamperfecto: ["había creído", "habías creído", "había creído", "habíamos creído", "habíais creído", "habían creído"], futuroPerfecto: ["habré creído", "habrás creído", "habrá creído", "habremos creído", "habréis creído", "habrán creído"], condicionalPerfecto: ["habría creído", "habrías creído", "habría creído", "habríamos creído", "habríais creído", "habrían creído"], presenteSubjuntivo: ["crea", "creas", "crea", "creamos", "creáis", "crean"], imperfectoSubjuntivo: ["creyera", "creyeras", "creyera", "creyéramos", "creyerais", "creyeran"], participle: "creído", note: null },
    { inf: "construir", en: "to build", presente: ["construyo", "construyes", "construye", "construimos", "construís", "construyen"], preterito: ["construí", "construiste", "construyó", "construimos", "construisteis", "construyeron"], imperfecto: ["construía", "construías", "construía", "construíamos", "construíais", "construían"], futuro: ["construiré", "construirás", "construirá", "construiremos", "construiréis", "construirán"], condicional: ["construiría", "construirías", "construiría", "construiríamos", "construiríais", "construirían"], presentePerfecto: ["he construido", "has construido", "ha construido", "hemos construido", "habéis construido", "han construido"], pluscuamperfecto: ["había construido", "habías construido", "había construido", "habíamos construido", "habíais construido", "habían construido"], futuroPerfecto: ["habré construido", "habrás construido", "habrá construido", "habremos construido", "habréis construido", "habrán construido"], condicionalPerfecto: ["habría construido", "habrías construido", "habría construido", "habríamos construido", "habríais construido", "habrían construido"], presenteSubjuntivo: ["construya", "construyas", "construya", "construyamos", "construyáis", "construyan"], imperfectoSubjuntivo: ["construyera", "construyeras", "construyera", "construyéramos", "construyerais", "construyeran"], participle: "construido", note: null },
    { inf: "hablar", en: "to speak", presente: ["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"], preterito: ["hablé", "hablaste", "habló", "hablamos", "hablasteis", "hablaron"], imperfecto: ["hablaba", "hablabas", "hablaba", "hablábamos", "hablabais", "hablaban"], futuro: ["hablaré", "hablarás", "hablará", "hablaremos", "hablaréis", "hablarán"], condicional: ["hablaría", "hablarías", "hablaría", "hablaríamos", "hablaríais", "hablarían"], presentePerfecto: ["he hablado", "has hablado", "ha hablado", "hemos hablado", "habéis hablado", "han hablado"], pluscuamperfecto: ["había hablado", "habías hablado", "había hablado", "habíamos hablado", "habíais hablado", "habían hablado"], futuroPerfecto: ["habré hablado", "habrás hablado", "habrá hablado", "habremos hablado", "habréis hablado", "habrán hablado"], condicionalPerfecto: ["habría hablado", "habrías hablado", "habría hablado", "habríamos hablado", "habríais hablado", "habrían hablado"], presenteSubjuntivo: ["hable", "hables", "hable", "hablemos", "habléis", "hablen"], imperfectoSubjuntivo: ["hablara", "hablaras", "hablara", "habláramos", "hablarais", "hablaran"], participle: "hablado", note: null },
    { inf: "comer", en: "to eat", presente: ["como", "comes", "come", "comemos", "coméis", "comen"], preterito: ["comí", "comiste", "comió", "comimos", "comisteis", "comieron"], imperfecto: ["comía", "comías", "comía", "comíamos", "comíais", "comían"], futuro: ["comeré", "comerás", "comerá", "comeremos", "comeréis", "comerán"], condicional: ["comería", "comerías", "comería", "comeríamos", "comeríais", "comerían"], presentePerfecto: ["he comido", "has comido", "ha comido", "hemos comido", "habéis comido", "han comido"], pluscuamperfecto: ["había comido", "habías comido", "había comido", "habíamos comido", "habíais comido", "habían comido"], futuroPerfecto: ["habré comido", "habrás comido", "habrá comido", "habremos comido", "habréis comido", "habrán comido"], condicionalPerfecto: ["habría comido", "habrías comido", "habría comido", "habríamos comido", "habríais comido", "habrían comido"], presenteSubjuntivo: ["coma", "comas", "coma", "comamos", "comáis", "coman"], imperfectoSubjuntivo: ["comiera", "comieras", "comiera", "comiéramos", "comierais", "comieran"], participle: "comido", note: null },
    { inf: "vivir", en: "to live", presente: ["vivo", "vives", "vive", "vivimos", "vivís", "viven"], preterito: ["viví", "viviste", "vivió", "vivimos", "vivisteis", "vivieron"], imperfecto: ["vivía", "vivías", "vivía", "vivíamos", "vivíais", "vivían"], futuro: ["viviré", "vivirás", "vivirá", "viviremos", "viviréis", "vivirán"], condicional: ["viviría", "vivirías", "viviría", "viviríamos", "viviríais", "vivirían"], presentePerfecto: ["he vivido", "has vivido", "ha vivido", "hemos vivido", "habéis vivido", "han vivido"], pluscuamperfecto: ["había vivido", "habías vivido", "había vivido", "habíamos vivido", "habíais vivido", "habían vivido"], futuroPerfecto: ["habré vivido", "habrás vivido", "habrá vivido", "habremos vivido", "habréis vivido", "habrán vivido"], condicionalPerfecto: ["habría vivido", "habrías vivido", "habría vivido", "habríamos vivido", "habríais vivido", "habrían vivido"], presenteSubjuntivo: ["viva", "vivas", "viva", "vivamos", "viváis", "vivan"], imperfectoSubjuntivo: ["viviera", "vivieras", "viviera", "viviéramos", "vivierais", "vivieran"], participle: "vivido", note: null },
    { inf: "trabajar", en: "to work", presente: ["trabajo", "trabajas", "trabaja", "trabajamos", "trabajáis", "trabajan"], preterito: ["trabajé", "trabajaste", "trabajó", "trabajamos", "trabajasteis", "trabajaron"], imperfecto: ["trabajaba", "trabajabas", "trabajaba", "trabajábamos", "trabajabais", "trabajaban"], futuro: ["trabajaré", "trabajarás", "trabajará", "trabajaremos", "trabajaréis", "trabajarán"], condicional: ["trabajaría", "trabajarías", "trabajaría", "trabajaríamos", "trabajaríais", "trabajarían"], presentePerfecto: ["he trabajado", "has trabajado", "ha trabajado", "hemos trabajado", "habéis trabajado", "han trabajado"], pluscuamperfecto: ["había trabajado", "habías trabajado", "había trabajado", "habíamos trabajado", "habíais trabajado", "habían trabajado"], futuroPerfecto: ["habré trabajado", "habrás trabajado", "habrá trabajado", "habremos trabajado", "habréis trabajado", "habrán trabajado"], condicionalPerfecto: ["habría trabajado", "habrías trabajado", "habría trabajado", "habríamos trabajado", "habríais trabajado", "habrían trabajado"], presenteSubjuntivo: ["trabaje", "trabajes", "trabaje", "trabajemos", "trabajéis", "trabajen"], imperfectoSubjuntivo: ["trabajara", "trabajaras", "trabajara", "trabajáramos", "trabajarais", "trabajaran"], participle: "trabajado", note: null },
    { inf: "estudiar", en: "to study", presente: ["estudio", "estudias", "estudia", "estudiamos", "estudiáis", "estudian"], preterito: ["estudié", "estudiaste", "estudió", "estudiamos", "estudiasteis", "estudiaron"], imperfecto: ["estudiaba", "estudiabas", "estudiaba", "estudiábamos", "estudiabais", "estudiaban"], futuro: ["estudiaré", "estudiarás", "estudiará", "estudiaremos", "estudiaréis", "estudiarán"], condicional: ["estudiaría", "estudiarías", "estudiaría", "estudiaríamos", "estudiaríais", "estudiarían"], presentePerfecto: ["he estudiado", "has estudiado", "ha estudiado", "hemos estudiado", "habéis estudiado", "han estudiado"], pluscuamperfecto: ["había estudiado", "habías estudiado", "había estudiado", "habíamos estudiado", "habíais estudiado", "habían estudiado"], futuroPerfecto: ["habré estudiado", "habrás estudiado", "habrá estudiado", "habremos estudiado", "habréis estudiado", "habrán estudiado"], condicionalPerfecto: ["habría estudiado", "habrías estudiado", "habría estudiado", "habríamos estudiado", "habríais estudiado", "habrían estudiado"], presenteSubjuntivo: ["estudie", "estudies", "estudie", "estudiemos", "estudiéis", "estudien"], imperfectoSubjuntivo: ["estudiara", "estudiaras", "estudiara", "estudiáramos", "estudiarais", "estudiaran"], participle: "estudiado", note: null },
    { inf: "escribir", en: "to write", presente: ["escribo", "escribes", "escribe", "escribimos", "escribís", "escriben"], preterito: ["escribí", "escribiste", "escribió", "escribimos", "escribisteis", "escribieron"], imperfecto: ["escribía", "escribías", "escribía", "escribíamos", "escribíais", "escribían"], futuro: ["escribiré", "escribirás", "escribirá", "escribiremos", "escribiréis", "escribirán"], condicional: ["escribiría", "escribirías", "escribiría", "escribiríamos", "escribiríais", "escribirían"], presentePerfecto: ["he escrito", "has escrito", "ha escrito", "hemos escrito", "habéis escrito", "han escrito"], pluscuamperfecto: ["había escrito", "habías escrito", "había escrito", "habíamos escrito", "habíais escrito", "habían escrito"], futuroPerfecto: ["habré escrito", "habrás escrito", "habrá escrito", "habremos escrito", "habréis escrito", "habrán escrito"], condicionalPerfecto: ["habría escrito", "habrías escrito", "habría escrito", "habríamos escrito", "habríais escrito", "habrían escrito"], presenteSubjuntivo: ["escriba", "escribas", "escriba", "escribamos", "escribáis", "escriban"], imperfectoSubjuntivo: ["escribiera", "escribieras", "escribiera", "escribiéramos", "escribierais", "escribieran"], participle: "escrito", note: null },
    { inf: "llevar", en: "to carry / wear", presente: ["llevo", "llevas", "lleva", "llevamos", "lleváis", "llevan"], preterito: ["llevé", "llevaste", "llevó", "llevamos", "llevasteis", "llevaron"], imperfecto: ["llevaba", "llevabas", "llevaba", "llevábamos", "llevabais", "llevaban"], futuro: ["llevaré", "llevarás", "llevará", "llevaremos", "llevaréis", "llevarán"], condicional: ["llevaría", "llevarías", "llevaría", "llevaríamos", "llevaríais", "llevarían"], presentePerfecto: ["he llevado", "has llevado", "ha llevado", "hemos llevado", "habéis llevado", "han llevado"], pluscuamperfecto: ["había llevado", "habías llevado", "había llevado", "habíamos llevado", "habíais llevado", "habían llevado"], futuroPerfecto: ["habré llevado", "habrás llevado", "habrá llevado", "habremos llevado", "habréis llevado", "habrán llevado"], condicionalPerfecto: ["habría llevado", "habrías llevado", "habría llevado", "habríamos llevado", "habríais llevado", "habrían llevado"], presenteSubjuntivo: ["lleve", "lleves", "lleve", "llevemos", "llevéis", "lleven"], imperfectoSubjuntivo: ["llevara", "llevaras", "llevara", "lleváramos", "llevarais", "llevaran"], participle: "llevado", note: null },
    { inf: "llamar", en: "to call", presente: ["llamo", "llamas", "llama", "llamamos", "llamáis", "llaman"], preterito: ["llamé", "llamaste", "llamó", "llamamos", "llamasteis", "llamaron"], imperfecto: ["llamaba", "llamabas", "llamaba", "llamábamos", "llamabais", "llamaban"], futuro: ["llamaré", "llamarás", "llamará", "llamaremos", "llamaréis", "llamarán"], condicional: ["llamaría", "llamarías", "llamaría", "llamaríamos", "llamaríais", "llamarían"], presentePerfecto: ["he llamado", "has llamado", "ha llamado", "hemos llamado", "habéis llamado", "han llamado"], pluscuamperfecto: ["había llamado", "habías llamado", "había llamado", "habíamos llamado", "habíais llamado", "habían llamado"], futuroPerfecto: ["habré llamado", "habrás llamado", "habrá llamado", "habremos llamado", "habréis llamado", "habrán llamado"], condicionalPerfecto: ["habría llamado", "habrías llamado", "habría llamado", "habríamos llamado", "habríais llamado", "habrían llamado"], presenteSubjuntivo: ["llame", "llames", "llame", "llamemos", "llaméis", "llamen"], imperfectoSubjuntivo: ["llamara", "llamaras", "llamara", "llamáramos", "llamarais", "llamaran"], participle: "llamado", note: null },
    { inf: "tomar", en: "to take / drink", presente: ["tomo", "tomas", "toma", "tomamos", "tomáis", "toman"], preterito: ["tomé", "tomaste", "tomó", "tomamos", "tomasteis", "tomaron"], imperfecto: ["tomaba", "tomabas", "tomaba", "tomábamos", "tomabais", "tomaban"], futuro: ["tomaré", "tomarás", "tomará", "tomaremos", "tomaréis", "tomarán"], condicional: ["tomaría", "tomarías", "tomaría", "tomaríamos", "tomaríais", "tomarían"], presentePerfecto: ["he tomado", "has tomado", "ha tomado", "hemos tomado", "habéis tomado", "han tomado"], pluscuamperfecto: ["había tomado", "habías tomado", "había tomado", "habíamos tomado", "habíais tomado", "habían tomado"], futuroPerfecto: ["habré tomado", "habrás tomado", "habrá tomado", "habremos tomado", "habréis tomado", "habrán tomado"], condicionalPerfecto: ["habría tomado", "habrías tomado", "habría tomado", "habríamos tomado", "habríais tomado", "habrían tomado"], presenteSubjuntivo: ["tome", "tomes", "tome", "tomemos", "toméis", "tomen"], imperfectoSubjuntivo: ["tomara", "tomaras", "tomara", "tomáramos", "tomarais", "tomaran"], participle: "tomado", note: null },
    { inf: "necesitar", en: "to need", presente: ["necesito", "necesitas", "necesita", "necesitamos", "necesitáis", "necesitan"], preterito: ["necesité", "necesitaste", "necesitó", "necesitamos", "necesitasteis", "necesitaron"], imperfecto: ["necesitaba", "necesitabas", "necesitaba", "necesitábamos", "necesitabais", "necesitaban"], futuro: ["necesitaré", "necesitarás", "necesitará", "necesitaremos", "necesitaréis", "necesitarán"], condicional: ["necesitaría", "necesitarías", "necesitaría", "necesitaríamos", "necesitaríais", "necesitarían"], presentePerfecto: ["he necesitado", "has necesitado", "ha necesitado", "hemos necesitado", "habéis necesitado", "han necesitado"], pluscuamperfecto: ["había necesitado", "habías necesitado", "había necesitado", "habíamos necesitado", "habíais necesitado", "habían necesitado"], futuroPerfecto: ["habré necesitado", "habrás necesitado", "habrá necesitado", "habremos necesitado", "habréis necesitado", "habrán necesitado"], condicionalPerfecto: ["habría necesitado", "habrías necesitado", "habría necesitado", "habríamos necesitado", "habríais necesitado", "habrían necesitado"], presenteSubjuntivo: ["necesite", "necesites", "necesite", "necesitemos", "necesitéis", "necesiten"], imperfectoSubjuntivo: ["necesitara", "necesitaras", "necesitara", "necesitáramos", "necesitarais", "necesitaran"], participle: "necesitado", note: null },
    { inf: "usar", en: "to use", presente: ["uso", "usas", "usa", "usamos", "usáis", "usan"], preterito: ["usé", "usaste", "usó", "usamos", "usasteis", "usaron"], imperfecto: ["usaba", "usabas", "usaba", "usábamos", "usabais", "usaban"], futuro: ["usaré", "usarás", "usará", "usaremos", "usaréis", "usarán"], condicional: ["usaría", "usarías", "usaría", "usaríamos", "usaríais", "usarían"], presentePerfecto: ["he usado", "has usado", "ha usado", "hemos usado", "habéis usado", "han usado"], pluscuamperfecto: ["había usado", "habías usado", "había usado", "habíamos usado", "habíais usado", "habían usado"], futuroPerfecto: ["habré usado", "habrás usado", "habrá usado", "habremos usado", "habréis usado", "habrán usado"], condicionalPerfecto: ["habría usado", "habrías usado", "habría usado", "habríamos usado", "habríais usado", "habrían usado"], presenteSubjuntivo: ["use", "uses", "use", "usemos", "uséis", "usen"], imperfectoSubjuntivo: ["usara", "usaras", "usara", "usáramos", "usarais", "usaran"], participle: "usado", note: null },
    { inf: "escuchar", en: "to listen", presente: ["escucho", "escuchas", "escucha", "escuchamos", "escucháis", "escuchan"], preterito: ["escuché", "escuchaste", "escuchó", "escuchamos", "escuchasteis", "escucharon"], imperfecto: ["escuchaba", "escuchabas", "escuchaba", "escuchábamos", "escuchabais", "escuchaban"], futuro: ["escucharé", "escucharás", "escuchará", "escucharemos", "escucharéis", "escucharán"], condicional: ["escucharía", "escucharías", "escucharía", "escucharíamos", "escucharíais", "escucharían"], presentePerfecto: ["he escuchado", "has escuchado", "ha escuchado", "hemos escuchado", "habéis escuchado", "han escuchado"], pluscuamperfecto: ["había escuchado", "habías escuchado", "había escuchado", "habíamos escuchado", "habíais escuchado", "habían escuchado"], futuroPerfecto: ["habré escuchado", "habrás escuchado", "habrá escuchado", "habremos escuchado", "habréis escuchado", "habrán escuchado"], condicionalPerfecto: ["habría escuchado", "habrías escuchado", "habría escuchado", "habríamos escuchado", "habríais escuchado", "habrían escuchado"], presenteSubjuntivo: ["escuche", "escuches", "escuche", "escuchemos", "escuchéis", "escuchen"], imperfectoSubjuntivo: ["escuchara", "escucharas", "escuchara", "escucháramos", "escucharais", "escucharan"], participle: "escuchado", note: null },
    { inf: "mirar", en: "to watch / look at", presente: ["miro", "miras", "mira", "miramos", "miráis", "miran"], preterito: ["miré", "miraste", "miró", "miramos", "mirasteis", "miraron"], imperfecto: ["miraba", "mirabas", "miraba", "mirábamos", "mirabais", "miraban"], futuro: ["miraré", "mirarás", "mirará", "miraremos", "miraréis", "mirarán"], condicional: ["miraría", "mirarías", "miraría", "miraríamos", "miraríais", "mirarían"], presentePerfecto: ["he mirado", "has mirado", "ha mirado", "hemos mirado", "habéis mirado", "han mirado"], pluscuamperfecto: ["había mirado", "habías mirado", "había mirado", "habíamos mirado", "habíais mirado", "habían mirado"], futuroPerfecto: ["habré mirado", "habrás mirado", "habrá mirado", "habremos mirado", "habréis mirado", "habrán mirado"], condicionalPerfecto: ["habría mirado", "habrías mirado", "habría mirado", "habríamos mirado", "habríais mirado", "habrían mirado"], presenteSubjuntivo: ["mire", "mires", "mire", "miremos", "miréis", "miren"], imperfectoSubjuntivo: ["mirara", "miraras", "mirara", "miráramos", "mirarais", "miraran"], participle: "mirado", note: null },
    { inf: "ayudar", en: "to help", presente: ["ayudo", "ayudas", "ayuda", "ayudamos", "ayudáis", "ayudan"], preterito: ["ayudé", "ayudaste", "ayudó", "ayudamos", "ayudasteis", "ayudaron"], imperfecto: ["ayudaba", "ayudabas", "ayudaba", "ayudábamos", "ayudabais", "ayudaban"], futuro: ["ayudaré", "ayudarás", "ayudará", "ayudaremos", "ayudaréis", "ayudarán"], condicional: ["ayudaría", "ayudarías", "ayudaría", "ayudaríamos", "ayudaríais", "ayudarían"], presentePerfecto: ["he ayudado", "has ayudado", "ha ayudado", "hemos ayudado", "habéis ayudado", "han ayudado"], pluscuamperfecto: ["había ayudado", "habías ayudado", "había ayudado", "habíamos ayudado", "habíais ayudado", "habían ayudado"], futuroPerfecto: ["habré ayudado", "habrás ayudado", "habrá ayudado", "habremos ayudado", "habréis ayudado", "habrán ayudado"], condicionalPerfecto: ["habría ayudado", "habrías ayudado", "habría ayudado", "habríamos ayudado", "habríais ayudado", "habrían ayudado"], presenteSubjuntivo: ["ayude", "ayudes", "ayude", "ayudemos", "ayudéis", "ayuden"], imperfectoSubjuntivo: ["ayudara", "ayudaras", "ayudara", "ayudáramos", "ayudarais", "ayudaran"], participle: "ayudado", note: null },
    { inf: "comprar", en: "to buy", presente: ["compro", "compras", "compra", "compramos", "compráis", "compran"], preterito: ["compré", "compraste", "compró", "compramos", "comprasteis", "compraron"], imperfecto: ["compraba", "comprabas", "compraba", "comprábamos", "comprabais", "compraban"], futuro: ["compraré", "comprarás", "comprará", "compraremos", "compraréis", "comprarán"], condicional: ["compraría", "comprarías", "compraría", "compraríamos", "compraríais", "comprarían"], presentePerfecto: ["he comprado", "has comprado", "ha comprado", "hemos comprado", "habéis comprado", "han comprado"], pluscuamperfecto: ["había comprado", "habías comprado", "había comprado", "habíamos comprado", "habíais comprado", "habían comprado"], futuroPerfecto: ["habré comprado", "habrás comprado", "habrá comprado", "habremos comprado", "habréis comprado", "habrán comprado"], condicionalPerfecto: ["habría comprado", "habrías comprado", "habría comprado", "habríamos comprado", "habríais comprado", "habrían comprado"], presenteSubjuntivo: ["compre", "compres", "compre", "compremos", "compréis", "compren"], imperfectoSubjuntivo: ["comprara", "compraras", "comprara", "compráramos", "comprarais", "compraran"], participle: "comprado", note: null },
    { inf: "caminar", en: "to walk", presente: ["camino", "caminas", "camina", "caminamos", "camináis", "caminan"], preterito: ["caminé", "caminaste", "caminó", "caminamos", "caminasteis", "caminaron"], imperfecto: ["caminaba", "caminabas", "caminaba", "caminábamos", "caminabais", "caminaban"], futuro: ["caminaré", "caminarás", "caminará", "caminaremos", "caminaréis", "caminarán"], condicional: ["caminaría", "caminarías", "caminaría", "caminaríamos", "caminaríais", "caminarían"], presentePerfecto: ["he caminado", "has caminado", "ha caminado", "hemos caminado", "habéis caminado", "han caminado"], pluscuamperfecto: ["había caminado", "habías caminado", "había caminado", "habíamos caminado", "habíais caminado", "habían caminado"], futuroPerfecto: ["habré caminado", "habrás caminado", "habrá caminado", "habremos caminado", "habréis caminado", "habrán caminado"], condicionalPerfecto: ["habría caminado", "habrías caminado", "habría caminado", "habríamos caminado", "habríais caminado", "habrían caminado"], presenteSubjuntivo: ["camine", "camines", "camine", "caminemos", "caminéis", "caminen"], imperfectoSubjuntivo: ["caminara", "caminaras", "caminara", "camináramos", "caminarais", "caminaran"], participle: "caminado", note: null },
    { inf: "abrir", en: "to open", presente: ["abro", "abres", "abre", "abrimos", "abrís", "abren"], preterito: ["abrí", "abriste", "abrió", "abrimos", "abristeis", "abrieron"], imperfecto: ["abría", "abrías", "abría", "abríamos", "abríais", "abrían"], futuro: ["abriré", "abrirás", "abrirá", "abriremos", "abriréis", "abrirán"], condicional: ["abriría", "abrirías", "abriría", "abriríamos", "abriríais", "abrirían"], presentePerfecto: ["he abierto", "has abierto", "ha abierto", "hemos abierto", "habéis abierto", "han abierto"], pluscuamperfecto: ["había abierto", "habías abierto", "había abierto", "habíamos abierto", "habíais abierto", "habían abierto"], futuroPerfecto: ["habré abierto", "habrás abierto", "habrá abierto", "habremos abierto", "habréis abierto", "habrán abierto"], condicionalPerfecto: ["habría abierto", "habrías abierto", "habría abierto", "habríamos abierto", "habríais abierto", "habrían abierto"], presenteSubjuntivo: ["abra", "abras", "abra", "abramos", "abráis", "abran"], imperfectoSubjuntivo: ["abriera", "abrieras", "abriera", "abriéramos", "abrierais", "abrieran"], participle: "abierto", note: null },
    { inf: "aprender", en: "to learn", presente: ["aprendo", "aprendes", "aprende", "aprendemos", "aprendéis", "aprenden"], preterito: ["aprendí", "aprendiste", "aprendió", "aprendimos", "aprendisteis", "aprendieron"], imperfecto: ["aprendía", "aprendías", "aprendía", "aprendíamos", "aprendíais", "aprendían"], futuro: ["aprenderé", "aprenderás", "aprenderá", "aprenderemos", "aprenderéis", "aprenderán"], condicional: ["aprendería", "aprenderías", "aprendería", "aprenderíamos", "aprenderíais", "aprenderían"], presentePerfecto: ["he aprendido", "has aprendido", "ha aprendido", "hemos aprendido", "habéis aprendido", "han aprendido"], pluscuamperfecto: ["había aprendido", "habías aprendido", "había aprendido", "habíamos aprendido", "habíais aprendido", "habían aprendido"], futuroPerfecto: ["habré aprendido", "habrás aprendido", "habrá aprendido", "habremos aprendido", "habréis aprendido", "habrán aprendido"], condicionalPerfecto: ["habría aprendido", "habrías aprendido", "habría aprendido", "habríamos aprendido", "habríais aprendido", "habrían aprendido"], presenteSubjuntivo: ["aprenda", "aprendas", "aprenda", "aprendamos", "aprendáis", "aprendan"], imperfectoSubjuntivo: ["aprendiera", "aprendieras", "aprendiera", "aprendiéramos", "aprendierais", "aprendieran"], participle: "aprendido", note: null },
    { inf: "beber", en: "to drink", presente: ["bebo", "bebes", "bebe", "bebemos", "bebéis", "beben"], preterito: ["bebí", "bebiste", "bebió", "bebimos", "bebisteis", "bebieron"], imperfecto: ["bebía", "bebías", "bebía", "bebíamos", "bebíais", "bebían"], futuro: ["beberé", "beberás", "beberá", "beberemos", "beberéis", "beberán"], condicional: ["bebería", "beberías", "bebería", "beberíamos", "beberíais", "beberían"], presentePerfecto: ["he bebido", "has bebido", "ha bebido", "hemos bebido", "habéis bebido", "han bebido"], pluscuamperfecto: ["había bebido", "habías bebido", "había bebido", "habíamos bebido", "habíais bebido", "habían bebido"], futuroPerfecto: ["habré bebido", "habrás bebido", "habrá bebido", "habremos bebido", "habréis bebido", "habrán bebido"], condicionalPerfecto: ["habría bebido", "habrías bebido", "habría bebido", "habríamos bebido", "habríais bebido", "habrían bebido"], presenteSubjuntivo: ["beba", "bebas", "beba", "bebamos", "bebáis", "beban"], imperfectoSubjuntivo: ["bebiera", "bebieras", "bebiera", "bebiéramos", "bebierais", "bebieran"], participle: "bebido", note: null },
    { inf: "deber", en: "should / must (to owe)", presente: ["debo", "debes", "debe", "debemos", "debéis", "deben"], preterito: ["debí", "debiste", "debió", "debimos", "debisteis", "debieron"], imperfecto: ["debía", "debías", "debía", "debíamos", "debíais", "debían"], futuro: ["deberé", "deberás", "deberá", "deberemos", "deberéis", "deberán"], condicional: ["debería", "deberías", "debería", "deberíamos", "deberíais", "deberían"], presentePerfecto: ["he debido", "has debido", "ha debido", "hemos debido", "habéis debido", "han debido"], pluscuamperfecto: ["había debido", "habías debido", "había debido", "habíamos debido", "habíais debido", "habían debido"], futuroPerfecto: ["habré debido", "habrás debido", "habrá debido", "habremos debido", "habréis debido", "habrán debido"], condicionalPerfecto: ["habría debido", "habrías debido", "habría debido", "habríamos debido", "habríais debido", "habrían debido"], presenteSubjuntivo: ["deba", "debas", "deba", "debamos", "debáis", "deban"], imperfectoSubjuntivo: ["debiera", "debieras", "debiera", "debiéramos", "debierais", "debieran"], participle: "debido", note: null },
    { inf: "cantar", en: "to sing", presente: ["canto", "cantas", "canta", "cantamos", "cantáis", "cantan"], preterito: ["canté", "cantaste", "cantó", "cantamos", "cantasteis", "cantaron"], imperfecto: ["cantaba", "cantabas", "cantaba", "cantábamos", "cantabais", "cantaban"], futuro: ["cantaré", "cantarás", "cantará", "cantaremos", "cantaréis", "cantarán"], condicional: ["cantaría", "cantarías", "cantaría", "cantaríamos", "cantaríais", "cantarían"], presentePerfecto: ["he cantado", "has cantado", "ha cantado", "hemos cantado", "habéis cantado", "han cantado"], pluscuamperfecto: ["había cantado", "habías cantado", "había cantado", "habíamos cantado", "habíais cantado", "habían cantado"], futuroPerfecto: ["habré cantado", "habrás cantado", "habrá cantado", "habremos cantado", "habréis cantado", "habrán cantado"], condicionalPerfecto: ["habría cantado", "habrías cantado", "habría cantado", "habríamos cantado", "habríais cantado", "habrían cantado"], presenteSubjuntivo: ["cante", "cantes", "cante", "cantemos", "cantéis", "canten"], imperfectoSubjuntivo: ["cantara", "cantaras", "cantara", "cantáramos", "cantarais", "cantaran"], participle: "cantado", note: null },
    { inf: "encantar", en: "to delight / to love (used like gustar)", presente: ["encanto", "encantas", "encanta", "encantamos", "encantáis", "encantan"], preterito: ["encanté", "encantaste", "encantó", "encantamos", "encantasteis", "encantaron"], imperfecto: ["encantaba", "encantabas", "encantaba", "encantábamos", "encantabais", "encantaban"], futuro: ["encantaré", "encantarás", "encantará", "encantaremos", "encantaréis", "encantarán"], condicional: ["encantaría", "encantarías", "encantaría", "encantaríamos", "encantaríais", "encantarían"], presentePerfecto: ["he encantado", "has encantado", "ha encantado", "hemos encantado", "habéis encantado", "han encantado"], pluscuamperfecto: ["había encantado", "habías encantado", "había encantado", "habíamos encantado", "habíais encantado", "habían encantado"], futuroPerfecto: ["habré encantado", "habrás encantado", "habrá encantado", "habremos encantado", "habréis encantado", "habrán encantado"], condicionalPerfecto: ["habría encantado", "habrías encantado", "habría encantado", "habríamos encantado", "habríais encantado", "habrían encantado"], presenteSubjuntivo: ["encante", "encantes", "encante", "encantemos", "encantéis", "encanten"], imperfectoSubjuntivo: ["encantara", "encantaras", "encantara", "encantáramos", "encantarais", "encantaran"], participle: "encantado", note: "Almost always used gustar-style: me encanta / me encantan. Full conjugation shown for reference." },
    { inf: "gustar", en: "to like / to be pleasing to", presente: ["gusto", "gustas", "gusta", "gustamos", "gustáis", "gustan"], preterito: ["gusté", "gustaste", "gustó", "gustamos", "gustasteis", "gustaron"], imperfecto: ["gustaba", "gustabas", "gustaba", "gustábamos", "gustabais", "gustaban"], futuro: ["gustaré", "gustarás", "gustará", "gustaremos", "gustaréis", "gustarán"], condicional: ["gustaría", "gustarías", "gustaría", "gustaríamos", "gustaríais", "gustarían"], presentePerfecto: ["he gustado", "has gustado", "ha gustado", "hemos gustado", "habéis gustado", "han gustado"], pluscuamperfecto: ["había gustado", "habías gustado", "había gustado", "habíamos gustado", "habíais gustado", "habían gustado"], futuroPerfecto: ["habré gustado", "habrás gustado", "habrá gustado", "habremos gustado", "habréis gustado", "habrán gustado"], condicionalPerfecto: ["habría gustado", "habrías gustado", "habría gustado", "habríamos gustado", "habríais gustado", "habrían gustado"], presenteSubjuntivo: ["guste", "gustes", "guste", "gustemos", "gustéis", "gusten"], imperfectoSubjuntivo: ["gustara", "gustaras", "gustara", "gustáramos", "gustarais", "gustaran"], participle: "gustado", note: "Almost always used in 3rd person with an indirect object pronoun: me gusta, te gustan... Full conjugation shown for reference." },
    { inf: "interesar", en: "to interest", presente: ["intereso", "interesas", "interesa", "interesamos", "interesáis", "interesan"], preterito: ["interesé", "interesaste", "interesó", "interesamos", "interesasteis", "interesaron"], imperfecto: ["interesaba", "interesabas", "interesaba", "interesábamos", "interesabais", "interesaban"], futuro: ["interesaré", "interesarás", "interesará", "interesaremos", "interesaréis", "interesarán"], condicional: ["interesaría", "interesarías", "interesaría", "interesaríamos", "interesaríais", "interesarían"], presentePerfecto: ["he interesado", "has interesado", "ha interesado", "hemos interesado", "habéis interesado", "han interesado"], pluscuamperfecto: ["había interesado", "habías interesado", "había interesado", "habíamos interesado", "habíais interesado", "habían interesado"], futuroPerfecto: ["habré interesado", "habrás interesado", "habrá interesado", "habremos interesado", "habréis interesado", "habrán interesado"], condicionalPerfecto: ["habría interesado", "habrías interesado", "habría interesado", "habríamos interesado", "habríais interesado", "habrían interesado"], presenteSubjuntivo: ["interese", "intereses", "interese", "interesemos", "intereséis", "interesen"], imperfectoSubjuntivo: ["interesara", "interesaras", "interesara", "interesáramos", "interesarais", "interesaran"], participle: "interesado", note: "Used gustar-style: me interesa / me interesan." },
    { inf: "molestar", en: "to bother / annoy", presente: ["molesto", "molestas", "molesta", "molestamos", "molestáis", "molestan"], preterito: ["molesté", "molestaste", "molestó", "molestamos", "molestasteis", "molestaron"], imperfecto: ["molestaba", "molestabas", "molestaba", "molestábamos", "molestabais", "molestaban"], futuro: ["molestaré", "molestarás", "molestará", "molestaremos", "molestaréis", "molestarán"], condicional: ["molestaría", "molestarías", "molestaría", "molestaríamos", "molestaríais", "molestarían"], presentePerfecto: ["he molestado", "has molestado", "ha molestado", "hemos molestado", "habéis molestado", "han molestado"], pluscuamperfecto: ["había molestado", "habías molestado", "había molestado", "habíamos molestado", "habíais molestado", "habían molestado"], futuroPerfecto: ["habré molestado", "habrás molestado", "habrá molestado", "habremos molestado", "habréis molestado", "habrán molestado"], condicionalPerfecto: ["habría molestado", "habrías molestado", "habría molestado", "habríamos molestado", "habríais molestado", "habrían molestado"], presenteSubjuntivo: ["moleste", "molestes", "moleste", "molestemos", "molestéis", "molesten"], imperfectoSubjuntivo: ["molestara", "molestaras", "molestara", "molestáramos", "molestarais", "molestaran"], participle: "molestado", note: "Used gustar-style: me molesta / me molestan." },
    { inf: "faltar", en: "to be missing / lacking", presente: ["falto", "faltas", "falta", "faltamos", "faltáis", "faltan"], preterito: ["falté", "faltaste", "faltó", "faltamos", "faltasteis", "faltaron"], imperfecto: ["faltaba", "faltabas", "faltaba", "faltábamos", "faltabais", "faltaban"], futuro: ["faltaré", "faltarás", "faltará", "faltaremos", "faltaréis", "faltarán"], condicional: ["faltaría", "faltarías", "faltaría", "faltaríamos", "faltaríais", "faltarían"], presentePerfecto: ["he faltado", "has faltado", "ha faltado", "hemos faltado", "habéis faltado", "han faltado"], pluscuamperfecto: ["había faltado", "habías faltado", "había faltado", "habíamos faltado", "habíais faltado", "habían faltado"], futuroPerfecto: ["habré faltado", "habrás faltado", "habrá faltado", "habremos faltado", "habréis faltado", "habrán faltado"], condicionalPerfecto: ["habría faltado", "habrías faltado", "habría faltado", "habríamos faltado", "habríais faltado", "habrían faltado"], presenteSubjuntivo: ["falte", "faltes", "falte", "faltemos", "faltéis", "falten"], imperfectoSubjuntivo: ["faltara", "faltaras", "faltara", "faltáramos", "faltarais", "faltaran"], participle: "faltado", note: "Used gustar-style: me falta / me faltan." },
    { inf: "doler", en: "to hurt / ache", presente: ["duelo", "dueles", "duele", "dolemos", "doléis", "duelen"], preterito: ["dolí", "doliste", "dolió", "dolimos", "dolisteis", "dolieron"], imperfecto: ["dolía", "dolías", "dolía", "dolíamos", "dolíais", "dolían"], futuro: ["doleré", "dolerás", "dolerá", "doleremos", "doleréis", "dolerán"], condicional: ["dolería", "dolerías", "dolería", "doleríamos", "doleríais", "dolerían"], presentePerfecto: ["he dolido", "has dolido", "ha dolido", "hemos dolido", "habéis dolido", "han dolido"], pluscuamperfecto: ["había dolido", "habías dolido", "había dolido", "habíamos dolido", "habíais dolido", "habían dolido"], futuroPerfecto: ["habré dolido", "habrás dolido", "habrá dolido", "habremos dolido", "habréis dolido", "habrán dolido"], condicionalPerfecto: ["habría dolido", "habrías dolido", "habría dolido", "habríamos dolido", "habríais dolido", "habrían dolido"], presenteSubjuntivo: ["duela", "duelas", "duela", "dolamos", "doláis", "duelan"], imperfectoSubjuntivo: ["doliera", "dolieras", "doliera", "doliéramos", "dolierais", "dolieran"], participle: "dolido", note: "Used gustar-style: me duele / me duelen." },
    { inf: "quedar", en: "to be left / remain, to arrange to meet", presente: ["quedo", "quedas", "queda", "quedamos", "quedáis", "quedan"], preterito: ["quedé", "quedaste", "quedó", "quedamos", "quedasteis", "quedaron"], imperfecto: ["quedaba", "quedabas", "quedaba", "quedábamos", "quedabais", "quedaban"], futuro: ["quedaré", "quedarás", "quedará", "quedaremos", "quedaréis", "quedarán"], condicional: ["quedaría", "quedarías", "quedaría", "quedaríamos", "quedaríais", "quedarían"], presentePerfecto: ["he quedado", "has quedado", "ha quedado", "hemos quedado", "habéis quedado", "han quedado"], pluscuamperfecto: ["había quedado", "habías quedado", "había quedado", "habíamos quedado", "habíais quedado", "habían quedado"], futuroPerfecto: ["habré quedado", "habrás quedado", "habrá quedado", "habremos quedado", "habréis quedado", "habrán quedado"], condicionalPerfecto: ["habría quedado", "habrías quedado", "habría quedado", "habríamos quedado", "habríais quedado", "habrían quedado"], presenteSubjuntivo: ["quede", "quedes", "quede", "quedemos", "quedéis", "queden"], imperfectoSubjuntivo: ["quedara", "quedaras", "quedara", "quedáramos", "quedarais", "quedaran"], participle: "quedado", note: null },
    { inf: "quedarse", en: "to stay", presente: ["me quedo", "te quedas", "se queda", "nos quedamos", "os quedáis", "se quedan"], preterito: ["me quedé", "te quedaste", "se quedó", "nos quedamos", "os quedasteis", "se quedaron"], imperfecto: ["me quedaba", "te quedabas", "se quedaba", "nos quedábamos", "os quedabais", "se quedaban"], futuro: ["me quedaré", "te quedarás", "se quedará", "nos quedaremos", "os quedaréis", "se quedarán"], condicional: ["me quedaría", "te quedarías", "se quedaría", "nos quedaríamos", "os quedaríais", "se quedarían"], presentePerfecto: ["me he quedado", "te has quedado", "se ha quedado", "nos hemos quedado", "os habéis quedado", "se han quedado"], pluscuamperfecto: ["me había quedado", "te habías quedado", "se había quedado", "nos habíamos quedado", "os habíais quedado", "se habían quedado"], futuroPerfecto: ["me habré quedado", "te habrás quedado", "se habrá quedado", "nos habremos quedado", "os habréis quedado", "se habrán quedado"], condicionalPerfecto: ["me habría quedado", "te habrías quedado", "se habría quedado", "nos habríamos quedado", "os habríais quedado", "se habrían quedado"], presenteSubjuntivo: ["me quede", "te quedes", "se quede", "nos quedemos", "os quedéis", "se queden"], imperfectoSubjuntivo: ["me quedara", "te quedaras", "se quedara", "nos quedáramos", "os quedarais", "se quedaran"], participle: "quedado", note: null },
    { inf: "llamarse", en: "to be called / named", presente: ["me llamo", "te llamas", "se llama", "nos llamamos", "os llamáis", "se llaman"], preterito: ["me llamé", "te llamaste", "se llamó", "nos llamamos", "os llamasteis", "se llamaron"], imperfecto: ["me llamaba", "te llamabas", "se llamaba", "nos llamábamos", "os llamabais", "se llamaban"], futuro: ["me llamaré", "te llamarás", "se llamará", "nos llamaremos", "os llamaréis", "se llamarán"], condicional: ["me llamaría", "te llamarías", "se llamaría", "nos llamaríamos", "os llamaríais", "se llamarían"], presentePerfecto: ["me he llamado", "te has llamado", "se ha llamado", "nos hemos llamado", "os habéis llamado", "se han llamado"], pluscuamperfecto: ["me había llamado", "te habías llamado", "se había llamado", "nos habíamos llamado", "os habíais llamado", "se habían llamado"], futuroPerfecto: ["me habré llamado", "te habrás llamado", "se habrá llamado", "nos habremos llamado", "os habréis llamado", "se habrán llamado"], condicionalPerfecto: ["me habría llamado", "te habrías llamado", "se habría llamado", "nos habríamos llamado", "os habríais llamado", "se habrían llamado"], presenteSubjuntivo: ["me llame", "te llames", "se llame", "nos llamemos", "os llaméis", "se llamen"], imperfectoSubjuntivo: ["me llamara", "te llamaras", "se llamara", "nos llamáramos", "os llamarais", "se llamaran"], participle: "llamado", note: null },
    { inf: "levantarse", en: "to get up", presente: ["me levanto", "te levantas", "se levanta", "nos levantamos", "os levantáis", "se levantan"], preterito: ["me levanté", "te levantaste", "se levantó", "nos levantamos", "os levantasteis", "se levantaron"], imperfecto: ["me levantaba", "te levantabas", "se levantaba", "nos levantábamos", "os levantabais", "se levantaban"], futuro: ["me levantaré", "te levantarás", "se levantará", "nos levantaremos", "os levantaréis", "se levantarán"], condicional: ["me levantaría", "te levantarías", "se levantaría", "nos levantaríamos", "os levantaríais", "se levantarían"], presentePerfecto: ["me he levantado", "te has levantado", "se ha levantado", "nos hemos levantado", "os habéis levantado", "se han levantado"], pluscuamperfecto: ["me había levantado", "te habías levantado", "se había levantado", "nos habíamos levantado", "os habíais levantado", "se habían levantado"], futuroPerfecto: ["me habré levantado", "te habrás levantado", "se habrá levantado", "nos habremos levantado", "os habréis levantado", "se habrán levantado"], condicionalPerfecto: ["me habría levantado", "te habrías levantado", "se habría levantado", "nos habríamos levantado", "os habríais levantado", "se habrían levantado"], presenteSubjuntivo: ["me levante", "te levantes", "se levante", "nos levantemos", "os levantéis", "se levanten"], imperfectoSubjuntivo: ["me levantara", "te levantaras", "se levantara", "nos levantáramos", "os levantarais", "se levantaran"], participle: "levantado", note: null },
    { inf: "despertarse", en: "to wake up", presente: ["me despierto", "te despiertas", "se despierta", "nos despertamos", "os despertáis", "se despiertan"], preterito: ["me desperté", "te despertaste", "se despertó", "nos despertamos", "os despertasteis", "se despertaron"], imperfecto: ["me despertaba", "te despertabas", "se despertaba", "nos despertábamos", "os despertabais", "se despertaban"], futuro: ["me despertaré", "te despertarás", "se despertará", "nos despertaremos", "os despertaréis", "se despertarán"], condicional: ["me despertaría", "te despertarías", "se despertaría", "nos despertaríamos", "os despertaríais", "se despertarían"], presentePerfecto: ["me he despertado", "te has despertado", "se ha despertado", "nos hemos despertado", "os habéis despertado", "se han despertado"], pluscuamperfecto: ["me había despertado", "te habías despertado", "se había despertado", "nos habíamos despertado", "os habíais despertado", "se habían despertado"], futuroPerfecto: ["me habré despertado", "te habrás despertado", "se habrá despertado", "nos habremos despertado", "os habréis despertado", "se habrán despertado"], condicionalPerfecto: ["me habría despertado", "te habrías despertado", "se habría despertado", "nos habríamos despertado", "os habríais despertado", "se habrían despertado"], presenteSubjuntivo: ["me despierte", "te despiertes", "se despierte", "nos despertemos", "os despertéis", "se despierten"], imperfectoSubjuntivo: ["me despertara", "te despertaras", "se despertara", "nos despertáramos", "os despertarais", "se despertaran"], participle: "despertado", note: null },
    { inf: "acostarse", en: "to go to bed", presente: ["me acuesto", "te acuestas", "se acuesta", "nos acostamos", "os acostáis", "se acuestan"], preterito: ["me acosté", "te acostaste", "se acostó", "nos acostamos", "os acostasteis", "se acostaron"], imperfecto: ["me acostaba", "te acostabas", "se acostaba", "nos acostábamos", "os acostabais", "se acostaban"], futuro: ["me acostaré", "te acostarás", "se acostará", "nos acostaremos", "os acostaréis", "se acostarán"], condicional: ["me acostaría", "te acostarías", "se acostaría", "nos acostaríamos", "os acostaríais", "se acostarían"], presentePerfecto: ["me he acostado", "te has acostado", "se ha acostado", "nos hemos acostado", "os habéis acostado", "se han acostado"], pluscuamperfecto: ["me había acostado", "te habías acostado", "se había acostado", "nos habíamos acostado", "os habíais acostado", "se habían acostado"], futuroPerfecto: ["me habré acostado", "te habrás acostado", "se habrá acostado", "nos habremos acostado", "os habréis acostado", "se habrán acostado"], condicionalPerfecto: ["me habría acostado", "te habrías acostado", "se habría acostado", "nos habríamos acostado", "os habríais acostado", "se habrían acostado"], presenteSubjuntivo: ["me acueste", "te acuestes", "se acueste", "nos acostemos", "os acostéis", "se acuesten"], imperfectoSubjuntivo: ["me acostara", "te acostaras", "se acostara", "nos acostáramos", "os acostarais", "se acostaran"], participle: "acostado", note: null },
    { inf: "vestirse", en: "to get dressed", presente: ["me visto", "te vistes", "se viste", "nos vestimos", "os vestís", "se visten"], preterito: ["me vestí", "te vestiste", "se vistió", "nos vestimos", "os vestisteis", "se vistieron"], imperfecto: ["me vestía", "te vestías", "se vestía", "nos vestíamos", "os vestíais", "se vestían"], futuro: ["me vestiré", "te vestirás", "se vestirá", "nos vestiremos", "os vestiréis", "se vestirán"], condicional: ["me vestiría", "te vestirías", "se vestiría", "nos vestiríamos", "os vestiríais", "se vestirían"], presentePerfecto: ["me he vestido", "te has vestido", "se ha vestido", "nos hemos vestido", "os habéis vestido", "se han vestido"], pluscuamperfecto: ["me había vestido", "te habías vestido", "se había vestido", "nos habíamos vestido", "os habíais vestido", "se habían vestido"], futuroPerfecto: ["me habré vestido", "te habrás vestido", "se habrá vestido", "nos habremos vestido", "os habréis vestido", "se habrán vestido"], condicionalPerfecto: ["me habría vestido", "te habrías vestido", "se habría vestido", "nos habríamos vestido", "os habríais vestido", "se habrían vestido"], presenteSubjuntivo: ["me vista", "te vistas", "se vista", "nos vistamos", "os vistáis", "se vistan"], imperfectoSubjuntivo: ["me vistiera", "te vistieras", "se vistiera", "nos vistiéramos", "os vistierais", "se vistieran"], participle: "vestido", note: null },
    { inf: "bañarse", en: "to bathe", presente: ["me baño", "te bañas", "se baña", "nos bañamos", "os bañáis", "se bañan"], preterito: ["me bañé", "te bañaste", "se bañó", "nos bañamos", "os bañasteis", "se bañaron"], imperfecto: ["me bañaba", "te bañabas", "se bañaba", "nos bañábamos", "os bañabais", "se bañaban"], futuro: ["me bañaré", "te bañarás", "se bañará", "nos bañaremos", "os bañaréis", "se bañarán"], condicional: ["me bañaría", "te bañarías", "se bañaría", "nos bañaríamos", "os bañaríais", "se bañarían"], presentePerfecto: ["me he bañado", "te has bañado", "se ha bañado", "nos hemos bañado", "os habéis bañado", "se han bañado"], pluscuamperfecto: ["me había bañado", "te habías bañado", "se había bañado", "nos habíamos bañado", "os habíais bañado", "se habían bañado"], futuroPerfecto: ["me habré bañado", "te habrás bañado", "se habrá bañado", "nos habremos bañado", "os habréis bañado", "se habrán bañado"], condicionalPerfecto: ["me habría bañado", "te habrías bañado", "se habría bañado", "nos habríamos bañado", "os habríais bañado", "se habrían bañado"], presenteSubjuntivo: ["me bañe", "te bañes", "se bañe", "nos bañemos", "os bañéis", "se bañen"], imperfectoSubjuntivo: ["me bañara", "te bañaras", "se bañara", "nos bañáramos", "os bañarais", "se bañaran"], participle: "bañado", note: null },
    { inf: "ducharse", en: "to shower", presente: ["me ducho", "te duchas", "se ducha", "nos duchamos", "os ducháis", "se duchan"], preterito: ["me duché", "te duchaste", "se duchó", "nos duchamos", "os duchasteis", "se ducharon"], imperfecto: ["me duchaba", "te duchabas", "se duchaba", "nos duchábamos", "os duchabais", "se duchaban"], futuro: ["me ducharé", "te ducharás", "se duchará", "nos ducharemos", "os ducharéis", "se ducharán"], condicional: ["me ducharía", "te ducharías", "se ducharía", "nos ducharíamos", "os ducharíais", "se ducharían"], presentePerfecto: ["me he duchado", "te has duchado", "se ha duchado", "nos hemos duchado", "os habéis duchado", "se han duchado"], pluscuamperfecto: ["me había duchado", "te habías duchado", "se había duchado", "nos habíamos duchado", "os habíais duchado", "se habían duchado"], futuroPerfecto: ["me habré duchado", "te habrás duchado", "se habrá duchado", "nos habremos duchado", "os habréis duchado", "se habrán duchado"], condicionalPerfecto: ["me habría duchado", "te habrías duchado", "se habría duchado", "nos habríamos duchado", "os habríais duchado", "se habrían duchado"], presenteSubjuntivo: ["me duche", "te duches", "se duche", "nos duchemos", "os duchéis", "se duchen"], imperfectoSubjuntivo: ["me duchara", "te ducharas", "se duchara", "nos ducháramos", "os ducharais", "se ducharan"], participle: "duchado", note: null },
    { inf: "sentarse", en: "to sit down", presente: ["me siento", "te sientas", "se sienta", "nos sentamos", "os sentáis", "se sientan"], preterito: ["me senté", "te sentaste", "se sentó", "nos sentamos", "os sentasteis", "se sentaron"], imperfecto: ["me sentaba", "te sentabas", "se sentaba", "nos sentábamos", "os sentabais", "se sentaban"], futuro: ["me sentaré", "te sentarás", "se sentará", "nos sentaremos", "os sentaréis", "se sentarán"], condicional: ["me sentaría", "te sentarías", "se sentaría", "nos sentaríamos", "os sentaríais", "se sentarían"], presentePerfecto: ["me he sentado", "te has sentado", "se ha sentado", "nos hemos sentado", "os habéis sentado", "se han sentado"], pluscuamperfecto: ["me había sentado", "te habías sentado", "se había sentado", "nos habíamos sentado", "os habíais sentado", "se habían sentado"], futuroPerfecto: ["me habré sentado", "te habrás sentado", "se habrá sentado", "nos habremos sentado", "os habréis sentado", "se habrán sentado"], condicionalPerfecto: ["me habría sentado", "te habrías sentado", "se habría sentado", "nos habríamos sentado", "os habríais sentado", "se habrían sentado"], presenteSubjuntivo: ["me siente", "te sientes", "se siente", "nos sentemos", "os sentéis", "se sienten"], imperfectoSubjuntivo: ["me sentara", "te sentaras", "se sentara", "nos sentáramos", "os sentarais", "se sentaran"], participle: "sentado", note: "Not to be confused with sentirse (to feel) - sentarse is \"to seat oneself\", from sentar." },
    { inf: "sentirse", en: "to feel (an emotion/state)", presente: ["me siento", "te sientes", "se siente", "nos sentimos", "os sentís", "se sienten"], preterito: ["me sentí", "te sentiste", "se sintió", "nos sentimos", "os sentisteis", "se sintieron"], imperfecto: ["me sentía", "te sentías", "se sentía", "nos sentíamos", "os sentíais", "se sentían"], futuro: ["me sentiré", "te sentirás", "se sentirá", "nos sentiremos", "os sentiréis", "se sentirán"], condicional: ["me sentiría", "te sentirías", "se sentiría", "nos sentiríamos", "os sentiríais", "se sentirían"], presentePerfecto: ["me he sentido", "te has sentido", "se ha sentido", "nos hemos sentido", "os habéis sentido", "se han sentido"], pluscuamperfecto: ["me había sentido", "te habías sentido", "se había sentido", "nos habíamos sentido", "os habíais sentido", "se habían sentido"], futuroPerfecto: ["me habré sentido", "te habrás sentido", "se habrá sentido", "nos habremos sentido", "os habréis sentido", "se habrán sentido"], condicionalPerfecto: ["me habría sentido", "te habrías sentido", "se habría sentido", "nos habríamos sentido", "os habríais sentido", "se habrían sentido"], presenteSubjuntivo: ["me sienta", "te sientas", "se sienta", "nos sintamos", "os sintáis", "se sientan"], imperfectoSubjuntivo: ["me sintiera", "te sintieras", "se sintiera", "nos sintiéramos", "os sintierais", "se sintieran"], participle: "sentido", note: "Not to be confused with sentarse (to sit down)." },
    { inf: "irse", en: "to leave / go away", presente: ["me voy", "te vas", "se va", "nos vamos", "os vais", "se van"], preterito: ["me fui", "te fuiste", "se fue", "nos fuimos", "os fuisteis", "se fueron"], imperfecto: ["me iba", "te ibas", "se iba", "nos íbamos", "os ibais", "se iban"], futuro: ["me iré", "te irás", "se irá", "nos iremos", "os iréis", "se irán"], condicional: ["me iría", "te irías", "se iría", "nos iríamos", "os iríais", "se irían"], presentePerfecto: ["me he ido", "te has ido", "se ha ido", "nos hemos ido", "os habéis ido", "se han ido"], pluscuamperfecto: ["me había ido", "te habías ido", "se había ido", "nos habíamos ido", "os habíais ido", "se habían ido"], futuroPerfecto: ["me habré ido", "te habrás ido", "se habrá ido", "nos habremos ido", "os habréis ido", "se habrán ido"], condicionalPerfecto: ["me habría ido", "te habrías ido", "se habría ido", "nos habríamos ido", "os habríais ido", "se habrían ido"], presenteSubjuntivo: ["me vaya", "te vayas", "se vaya", "nos vayamos", "os vayáis", "se vayan"], imperfectoSubjuntivo: ["me fuera", "te fueras", "se fuera", "nos fuéramos", "os fuerais", "se fueran"], participle: "ido", note: null },
    { inf: "divertirse", en: "to have fun", presente: ["me divierto", "te diviertes", "se divierte", "nos divertimos", "os divertís", "se divierten"], preterito: ["me divertí", "te divertiste", "se divirtió", "nos divertimos", "os divertisteis", "se divirtieron"], imperfecto: ["me divertía", "te divertías", "se divertía", "nos divertíamos", "os divertíais", "se divertían"], futuro: ["me divertiré", "te divertirás", "se divertirá", "nos divertiremos", "os divertiréis", "se divertirán"], condicional: ["me divertiría", "te divertirías", "se divertiría", "nos divertiríamos", "os divertiríais", "se divertirían"], presentePerfecto: ["me he divertido", "te has divertido", "se ha divertido", "nos hemos divertido", "os habéis divertido", "se han divertido"], pluscuamperfecto: ["me había divertido", "te habías divertido", "se había divertido", "nos habíamos divertido", "os habíais divertido", "se habían divertido"], futuroPerfecto: ["me habré divertido", "te habrás divertido", "se habrá divertido", "nos habremos divertido", "os habréis divertido", "se habrán divertido"], condicionalPerfecto: ["me habría divertido", "te habrías divertido", "se habría divertido", "nos habríamos divertido", "os habríais divertido", "se habrían divertido"], presenteSubjuntivo: ["me divierta", "te diviertas", "se divierta", "nos divirtamos", "os divirtáis", "se diviertan"], imperfectoSubjuntivo: ["me divirtiera", "te divirtieras", "se divirtiera", "nos divirtiéramos", "os divirtierais", "se divirtieran"], participle: "divertido", note: null },
    { inf: "dormirse", en: "to fall asleep", presente: ["me duermo", "te duermes", "se duerme", "nos dormimos", "os dormís", "se duermen"], preterito: ["me dormí", "te dormiste", "se durmió", "nos dormimos", "os dormisteis", "se durmieron"], imperfecto: ["me dormía", "te dormías", "se dormía", "nos dormíamos", "os dormíais", "se dormían"], futuro: ["me dormiré", "te dormirás", "se dormirá", "nos dormiremos", "os dormiréis", "se dormirán"], condicional: ["me dormiría", "te dormirías", "se dormiría", "nos dormiríamos", "os dormiríais", "se dormirían"], presentePerfecto: ["me he dormido", "te has dormido", "se ha dormido", "nos hemos dormido", "os habéis dormido", "se han dormido"], pluscuamperfecto: ["me había dormido", "te habías dormido", "se había dormido", "nos habíamos dormido", "os habíais dormido", "se habían dormido"], futuroPerfecto: ["me habré dormido", "te habrás dormido", "se habrá dormido", "nos habremos dormido", "os habréis dormido", "se habrán dormido"], condicionalPerfecto: ["me habría dormido", "te habrías dormido", "se habría dormido", "nos habríamos dormido", "os habríais dormido", "se habrían dormido"], presenteSubjuntivo: ["me duerma", "te duermas", "se duerma", "nos durmamos", "os durmáis", "se duerman"], imperfectoSubjuntivo: ["me durmiera", "te durmieras", "se durmiera", "nos durmiéramos", "os durmierais", "se durmieran"], participle: "dormido", note: null },
];

// ============================================================
// DOM ELEMENTS — grabbed inside DOMContentLoaded to ensure they exist
// ============================================================
let loginModal, mainApp, loginForm, adminForm, welcomeMessage, logoutBtn,
    portalTitle, tabBtns, tabPanes, messageInput, sendMessageBtn, chatMessages,
    aiCompanionTab, aiMessageInput, aiSendBtn, aiChatMessages, signupForm,
    toggleLoginBtn, toggleSignupBtn, aiRecordBtn, signupFields, signupSuccess, goToLoginBtn;

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Grab all DOM elements now that the page is ready
    loginModal     = document.getElementById('loginModal');
    mainApp        = document.getElementById('mainApp');
    loginForm      = document.getElementById('loginForm');
    adminForm      = document.getElementById('adminForm');
    welcomeMessage = document.getElementById('welcomeMessage');
    logoutBtn      = document.getElementById('logoutBtn');
    portalTitle    = document.getElementById('portalTitle');
    tabBtns        = document.querySelectorAll('.tab-btn');
    tabPanes       = document.querySelectorAll('.tab-pane');
    messageInput   = document.getElementById('messageInput');
    sendMessageBtn = document.getElementById('sendMessage');
    chatMessages   = document.getElementById('chatMessages');
    aiCompanionTab = document.getElementById('aiCompanionTab');
    aiMessageInput = document.getElementById('aiMessageInput');
    aiSendBtn      = document.getElementById('aiSendMessage');
    aiChatMessages = document.getElementById('aiChatMessages');
    signupForm     = document.getElementById('signupForm');
    toggleLoginBtn = document.getElementById('toggleLogin');
    toggleSignupBtn= document.getElementById('toggleSignup');
    aiRecordBtn    = document.getElementById('aiRecordBtn');
    signupFields   = document.getElementById('signupFields');
    signupSuccess  = document.getElementById('signupSuccess');
    goToLoginBtn   = document.getElementById('goToLoginBtn');

    setupEventListeners();
    initTTS();
    // Clear old cached resources so updated poster URLs load
    if (!localStorage.getItem('resourcesCacheV10')) {
        localStorage.removeItem('spanishResources');
        localStorage.setItem('resourcesCacheV10', '1');
    }
    // initCourses() now runs inside showMainApp(), once currentUser (and its subject) is known —
    // calling it here was too early: currentUser is still null for every visitor at this point.

    // Admin preview mode — opened from Students panel
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
        const previewData = sessionStorage.getItem('adminPreviewStudent');
        if (previewData) {
            const s = JSON.parse(previewData);
            currentUser = s;
            history.replaceState(null, '', window.location.pathname);
            // Show a preview banner
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1e40af;color:#fff;padding:8px 16px;font-size:13px;font-weight:600;z-index:99999;display:flex;justify-content:space-between;align-items:center;';
            banner.innerHTML = `<span>👁 Previewing as: ${s.name}</span><button onclick="window.close()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Close Tab</button>`;
            document.body.appendChild(banner);
            document.body.style.paddingTop = '36px';
            showMainApp();
            return;
        }
    }

    // Restore admin session across refreshes
    if (localStorage.getItem('adminLoggedIn')) {
        currentUser = { id: 'admin', name: 'Aaron', type: 'spanish', isAdmin: true, driveFolder: '' };
        showMainApp();
        return;
    }

    // Auto-login if redirected from email confirmation link
    // Supabase puts tokens in the URL hash: #access_token=...&type=signup
    const hash = window.location.hash.substring(1);
    if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const type = params.get('type');
        history.replaceState(null, '', window.location.pathname); // clean the URL
        if (accessToken) {
            // Get user info from the token
            try {
                const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                    headers: _headers(accessToken)
                });
                const user = await res.json();
                if (user.id) {
                    _accessToken = accessToken;
                    localStorage.setItem(SESSION_STORE, JSON.stringify({ access_token: accessToken, user }));
                    await loadUserFromSession({ access_token: accessToken, user });
                    return;
                }
            } catch(e) { console.error('Auto-login from confirmation failed:', e); }
        }
    }

    // Restore session from localStorage / sessionStorage
    const session = sbLoadSession();
    if (session) {
        // Try to refresh the token first (avoids expired token errors)
        if (session.refresh_token) {
            const refreshed = await sbRefreshSession(session.refresh_token);
            if (refreshed) {
                await loadUserFromSession(refreshed);
                return;
            }
        }
        await loadUserFromSession(session);
    } else {
        showLoginModal();
    }
});

async function loadUserFromSession(session) {
    try {
        let profile = await sbGetProfile(session.user.id);

        // Profile missing — create it from user_metadata
        if (!profile) {
            const meta = session.user.user_metadata || {};
            await sbInsertProfile({
                id: session.user.id,
                name: meta.name || session.user.email,
                type: meta.type || 'spanish',
                drive_folder: '',
                email: session.user.email || ''
            });
            profile = await sbGetProfile(session.user.id);
        }

        if (!profile) {
            throw new Error('Could not load or create profile.');
        }

        currentUser = {
            id: session.user.id,
            name: profile.name,
            type: profile.type,
            driveFolder: profile.drive_folder || '',
            thisWeek: profile.this_week || ''
        };
        showMainApp();
    } catch(err) {
        console.error('loadUserFromSession error:', err);
        await sbSignOut();
        showLoginModal();
        setTimeout(() => showError('loginError', 'Could not load your profile. Please try again.'), 100);
    }
}

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    adminForm.addEventListener('submit', handleAdminLogin);
    signupForm.addEventListener('submit', handleSignup);
    logoutBtn.addEventListener('click', handleLogout);

    // Enter key triggers login/signup
    ['loginEmail','loginPassword'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(e); });
    });
    ['signupName','signupEmail','signupPassword'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(e); });
    });
    document.getElementById('adminCode').addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(e); });

    // Toggle between Sign In and Create Account
    toggleLoginBtn.addEventListener('click', () => {
        showLoginFormView();
    });
    toggleSignupBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        adminForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        toggleSignupBtn.classList.add('active');
        toggleLoginBtn.classList.remove('active');
        signupFields.classList.remove('hidden');
        signupSuccess.classList.add('hidden');
    });

    // Admin link
    document.getElementById('adminLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        adminForm.classList.remove('hidden');
        document.getElementById('mainToggle').style.display = 'none';
        document.getElementById('adminCode').focus();
    });

    document.getElementById('backToLoginLink').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginFormView();
    });

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab === 'ai-companion') initAiCompanion();
            showTab(tab);
        });
    });

    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    aiSendBtn.addEventListener('click', sendAiMessage);
    aiMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAiMessage();
    });

    // Voice input (press & hold) — live transcription into the text box
    if (speechSupported) {
        aiRecordBtn.addEventListener('mousedown', startListening);
        aiRecordBtn.addEventListener('mouseup', stopListening);
        aiRecordBtn.addEventListener('mouseleave', stopListening);
        aiRecordBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startListening(); });
        aiRecordBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopListening(); });
    } else {
        aiRecordBtn.disabled = true;
        aiRecordBtn.title = 'La entrada de voz no está disponible en este navegador. Prueba Chrome, Edge o Safari — o simplemente escribe.';
        aiRecordBtn.style.opacity = '0.4';
        aiRecordBtn.style.cursor = 'not-allowed';
    }

    // Go to sign in after signup success
    goToLoginBtn.addEventListener('click', () => {
        showLoginFormView();
    });
}

function showLoginFormView() {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    adminForm.classList.add('hidden');
    toggleLoginBtn.classList.add('active');
    toggleSignupBtn.classList.remove('active');
    document.getElementById('mainToggle').style.display = '';
    clearErrors();
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
}

function clearErrors() {
    ['loginError', 'signupError', 'adminError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.querySelector('#loginForm .login-btn');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    btn.disabled = true;

    try {
        const data = await sbSignIn(email, password);

        if (data.error || data.error_description) {
            showError('loginError', data.error_description || 'Incorrect email or password.');
            return;
        }

        sbSaveSession(data, document.getElementById('rememberMe')?.checked ?? true);
        await loadUserFromSession(data);
    } catch(err) {
        showError('loginError', 'Something went wrong. Please try again.');
        console.error('Login error:', err);
    } finally {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        btn.disabled = false;
    }
}

function handleAdminLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearErrors();
    const code = document.getElementById('adminCode').value.trim();
    if (code === ADMIN_CODE) {
        loginModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        localStorage.setItem('adminLoggedIn', 'true');
        currentUser = { id: 'admin', name: 'Aaron', type: 'spanish', isAdmin: true, driveFolder: '' };
        showMainApp();
    } else {
        showError('adminError', 'Incorrect admin code.');
    }
}

async function handleSignup(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearErrors();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const type = document.getElementById('signupType').value;

    if (!name || !email || !password || !type) { showError('signupError', 'Please fill in all fields.'); return; }
    if (password.length < 6) { showError('signupError', 'Password must be at least 6 characters.'); return; }

    const btn = document.querySelector('#signupFields .login-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    btn.disabled = true;

    const data = await sbSignUp(email, password, name, type);

    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    btn.disabled = false;

    if (data.error || data.msg) {
        showError('signupError', data.msg || data.error_description || 'Something went wrong. Please try again.');
        return;
    }

    // If email confirmation is off, we get an access_token right away
    if (data.access_token) {
        sbSaveSession(data);
        await loadUserFromSession(data);
        return;
    }

    // Email confirmation required
    signupFields.classList.add('hidden');
    signupSuccess.classList.remove('hidden');
    document.getElementById('successEmailDisplay').textContent = email;
}

async function handleLogout() {
    await sbSignOut();
    localStorage.removeItem('adminLoggedIn');
    currentUser = null;
    isEditMode = false;
    document.body.classList.remove('admin-edit-mode');
    showLoginModal();
}

function showLoginModal() {
    loginModal.classList.remove('hidden');
    mainApp.classList.add('hidden');
    document.getElementById('adminFloatingBar')?.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    showLoginFormView();
}

// ============================================================
// MAIN APP
// ============================================================
async function showMainApp() {
    loginModal.classList.add('hidden');
    mainApp.classList.remove('hidden');
    document.body.style.overflow = 'auto';

    // Header
    welcomeMessage.textContent = `Welcome, ${currentUser.name}!`;
    const isMusic = currentUser.type === 'music';
    portalTitle.textContent = isMusic ? 'Aaron Siebert Music' : 'Spanish with Aaron';
    document.getElementById('portalIcon').classList.toggle('hidden', isMusic);
    document.getElementById('portalLogoImg').classList.toggle('hidden', !isMusic);

    // AI companion is hidden until ready to launch, for both subjects.
    // Courses tab is shown for both — each subject only ever renders/fetches its own courses.
    aiCompanionTab.style.display = 'none';
    document.getElementById('coursesTab').style.display = '';

    // Show admin toolbar if admin
    const adminBar = document.getElementById('adminFloatingBar');
    if (adminBar) adminBar.classList.toggle('hidden', !currentUser.isAdmin);

    // Populate all tabs
    populateResources();
    populatePersonalFolder();
    updateCommunityDescription();

    showTab('courses');
    // Must run after currentUser is set (it decides which subject's catalog to fetch) —
    // NOT at DOMContentLoaded time, when currentUser is still null for every user.
    await initCourses();
    renderCourseList();
}

// ============================================================
// RESOURCES TAB (shared per type)
// ============================================================
function getResources() {
    const stored = localStorage.getItem('spanishResources');
    return stored ? JSON.parse(stored) : sharedResources.spanish;
}

function saveResources(data) {
    localStorage.setItem('spanishResources', JSON.stringify(data));
}

function populateResources() {
    const container = document.getElementById('resourcesContent');
    const resources = currentUser.type === 'spanish' ? getResources() : sharedResources.music;
    if (!resources) { container.innerHTML = '<p>No resources available yet.</p>'; return; }

    if (currentUser.type === 'music') {
        let html = `<div class="coming-soon-section"><div class="coming-soon-overlay"><div class="coming-soon-badge"><i class="fas fa-clock"></i> Coming Soon</div><p>Resources are being curated for you. Check back soon!</p></div><div class="coming-soon-content">`;
        (resources.sections || []).forEach(section => {
            html += `<div class="resource-section"><h3><i class="${section.icon}"></i> ${section.title}</h3><div class="link-grid">${section.links.map(link => `<div class="link-card disabled"><i class="${link.icon}"></i><span>${link.label}</span></div>`).join('')}</div></div>`;
        });
        html += `</div></div>`;
        container.innerHTML = html;
        return;
    }

    const items = [];

    items.push({
        id: 'resAccVerbs', icon: 'fas fa-table', label: 'Verb Conjugator',
        body: renderVerbConjugatorTool()
    });

    (resources.sections || []).forEach((section, i) => {
        items.push({
            id: `resAccSec${i}`, icon: section.icon, label: section.title,
            body: `
                <div class="link-grid">
                    ${section.links.map(link => `
                        <a href="${link.url}" target="_blank" class="link-card">
                            <i class="${link.icon}"></i>
                            <span>${link.label}</span>
                        </a>
                    `).join('')}
                </div>`
        });
    });

    if (resources.mediaContent) {
        const media = resources.mediaContent;
        items.push({
            id: 'resAccMedia', icon: media.icon, label: media.title,
            body: `
                <p class="media-subtitle">${media.subtitle}</p>
                ${media.categories.map(cat => `
                    <div class="media-category-group">
                        <div class="media-category-label"><i class="fas fa-circle" style="font-size:7px;margin-right:6px;opacity:0.5;"></i> ${cat.name}</div>
                        <div class="media-grid-sm">
                            ${cat.items.map(item => `
                                <a href="${item.url}" target="_blank" class="media-card-sm">
                                    <div class="media-poster-sm">
                                        ${item.poster
                                            ? `<img src="${item.poster}" alt="${item.title}" onerror="posterLoadFailed(this)">`
                                            : item.wikiTitle
                                                ? `<img data-wiki="${item.wikiTitle}" alt="${item.title}" style="display:none"><div class="poster-placeholder" style="display:flex"><i class="fas fa-film"></i></div>`
                                                : `<div class="poster-placeholder"><i class="fas fa-film"></i></div>`
                                        }
                                        <span class="media-type-badge-sm">${item.type === 'tv' ? 'TV' : 'FILM'}</span>
                                    </div>
                                    <div class="media-info-sm">
                                        <h5>${item.title}</h5>
                                        <span>${item.year}</span>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}`
        });
    }

    if (resources.instagramContent) {
        const insta = resources.instagramContent;
        items.push({
            id: 'resAccInsta', icon: insta.icon, label: insta.title,
            body: `
                <p class="media-subtitle">${insta.subtitle}</p>
                ${insta.categories.map(cat => `
                    <div class="media-category-group">
                        <div class="media-category-label"><i class="fas fa-circle" style="font-size:7px;margin-right:6px;opacity:0.5;"></i> ${cat.name}</div>
                        <div class="insta-chip-row">
                            ${cat.items.map(item => `
                                <a href="${item.url}" target="_blank" class="insta-chip">
                                    <i class="fab fa-instagram"></i>${item.handle}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}`
        });
    }

    container.innerHTML = `
        <div class="res-accordion">
            ${items.map((it, i) => `
                <div class="res-accordion-item">
                    <button type="button" class="res-accordion-header${i === 0 ? ' active' : ''}" onclick="toggleResourceAccordion('${it.id}')" data-accitem="${it.id}">
                        <i class="${it.icon} res-acc-icon"></i>${it.label}
                        <i class="fas fa-chevron-down res-accordion-chevron"></i>
                    </button>
                    <div class="res-accordion-content" id="${it.id}">
                        <div class="res-accordion-content-inner">${it.body}</div>
                    </div>
                </div>
            `).join('')}
        </div>`;
    loadMoviePosters();
    const firstContent = container.querySelector('.res-accordion-content');
    if (firstContent) firstContent.style.maxHeight = firstContent.scrollHeight + 'px';
}

function toggleResourceAccordion(itemId) {
    const header = document.querySelector(`[data-accitem="${itemId}"]`);
    const wasActive = header.classList.contains('active');
    document.querySelectorAll('.res-accordion-header').forEach(h => h.classList.remove('active'));
    document.querySelectorAll('.res-accordion-content').forEach(c => { c.style.maxHeight = '0px'; });
    if (!wasActive) {
        header.classList.add('active');
        const content = document.getElementById(itemId);
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}

// ============================================================
// VERB CONJUGATOR TOOL — type-ahead lookup over verbConjugations
// ============================================================
const VERB_PERSONS = ['yo', 'tú', 'él/ella/Ud.', 'nosotros/as', 'vosotros/as', 'ellos/ellas/Uds.'];

// Every tense/mood available per verb, in the order they're taught. "all"
// shows every one stacked; picking a specific tense shows just that one,
// larger and easier to focus on.
const VERB_TENSES = [
    { key: 'all', label: 'All tenses' },
    { key: 'presente', label: 'Presente (Present)' },
    { key: 'preterito', label: 'Pretérito (Preterite)' },
    { key: 'imperfecto', label: 'Imperfecto (Imperfect)' },
    { key: 'futuro', label: 'Futuro (Future)' },
    { key: 'condicional', label: 'Condicional (Conditional)' },
    { key: 'presentePerfecto', label: 'Pretérito Perfecto (Present Perfect)' },
    { key: 'pluscuamperfecto', label: 'Pluscuamperfecto (Past Perfect)' },
    { key: 'futuroPerfecto', label: 'Futuro Perfecto (Future Perfect)' },
    { key: 'condicionalPerfecto', label: 'Condicional Perfecto (Conditional Perfect)' },
    { key: 'presenteSubjuntivo', label: 'Presente de Subjuntivo (Present Subjunctive)' },
    { key: 'imperfectoSubjuntivo', label: 'Imperfecto de Subjuntivo (Imperfect Subjunctive)' },
];

let _verbToolCurrentInf = null;

function normalizeVerbQuery(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function renderVerbConjugatorTool() {
    return `
        <div class="verb-tool">
            <div class="verb-search-wrap">
                <i class="fas fa-magnifying-glass verb-search-icon"></i>
                <input type="text" class="verb-search-input" id="verbSearchInput"
                    placeholder="Search a verb… (e.g. tener, or &quot;to have&quot;)"
                    oninput="onVerbSearchInput(this.value)" autocomplete="off">
            </div>
            <div id="verbResultsChips" class="verb-results-chips"></div>
            <div class="verb-tense-picker-wrap">
                <label for="verbTenseSelect">Tense</label>
                <select id="verbTenseSelect" onchange="onVerbTenseChange(this.value)">
                    ${VERB_TENSES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}
                </select>
            </div>
            <div id="verbTableContainer" class="verb-table-container">
                <p class="verb-hint">Type a verb in Spanish or English, then pick any tense to see its full conjugation.</p>
            </div>
        </div>`;
}

function verbChipHTML(inf, active) {
    return `<button type="button" class="verb-chip${active ? ' active' : ''}" onclick="selectVerbChip('${inf}')">${inf}</button>`;
}

function renderVerbTable(verb, tenseKey) {
    tenseKey = tenseKey || 'all';
    const tenseCol = (label, forms) => `
        <div class="verb-tense-col">
            <div class="verb-tense-title">${label}</div>
            ${forms.map((form, i) => `
                <div class="verb-person-row">
                    <span class="verb-person">${VERB_PERSONS[i]}</span>
                    <span class="verb-form">${form}</span>
                </div>`).join('')}
        </div>`;

    const tensesToShow = tenseKey === 'all'
        ? VERB_TENSES.filter(t => t.key !== 'all')
        : VERB_TENSES.filter(t => t.key === tenseKey);

    return `
        <div class="verb-table-card">
            <div class="verb-table-header">
                <span class="verb-inf">${verb.inf}</span>
                <span class="verb-en">${verb.en}</span>
            </div>
            ${verb.note ? `<p class="verb-note"><i class="fas fa-circle-info"></i> ${verb.note}</p>` : ''}
            <div class="verb-conj-grid">
                ${tensesToShow.map(t => tenseCol(t.label, verb[t.key])).join('')}
            </div>
        </div>`;
}

function currentVerbTense() {
    return document.getElementById('verbTenseSelect')?.value || 'all';
}

function onVerbSearchInput(rawQuery) {
    const chipsEl = document.getElementById('verbResultsChips');
    const tableEl = document.getElementById('verbTableContainer');
    const q = normalizeVerbQuery(rawQuery);

    if (!q) {
        _verbToolCurrentInf = null;
        chipsEl.innerHTML = '';
        tableEl.innerHTML = '<p class="verb-hint">Type a verb in Spanish or English, then pick any tense to see its full conjugation.</p>';
        resizeOpenResAccordion();
        return;
    }

    const matches = verbConjugations
        .filter(v => normalizeVerbQuery(v.inf).includes(q) || normalizeVerbQuery(v.en).includes(q))
        .slice(0, 8);

    if (matches.length === 0) {
        _verbToolCurrentInf = null;
        chipsEl.innerHTML = '';
        tableEl.innerHTML = '<p class="verb-hint">No matches. Try the infinitive (e.g. "volver") or an English meaning (e.g. "to return").</p>';
        resizeOpenResAccordion();
        return;
    }

    const exact = matches.find(v => normalizeVerbQuery(v.inf) === q);

    if (matches.length === 1 || exact) {
        const chosen = exact || matches[0];
        _verbToolCurrentInf = chosen.inf;
        chipsEl.innerHTML = matches.length > 1 ? matches.map(v => verbChipHTML(v.inf, v.inf === chosen.inf)).join('') : '';
        tableEl.innerHTML = renderVerbTable(chosen, currentVerbTense());
    } else {
        _verbToolCurrentInf = null;
        chipsEl.innerHTML = matches.map(v => verbChipHTML(v.inf, false)).join('');
        tableEl.innerHTML = '<p class="verb-hint">Select a verb above.</p>';
    }
    resizeOpenResAccordion();
}

function selectVerbChip(inf) {
    const verb = verbConjugations.find(v => v.inf === inf);
    if (!verb) return;
    _verbToolCurrentInf = inf;
    document.querySelectorAll('.verb-chip').forEach(c => c.classList.toggle('active', c.textContent === inf));
    document.getElementById('verbTableContainer').innerHTML = renderVerbTable(verb, currentVerbTense());
    resizeOpenResAccordion();
}

function onVerbTenseChange(tenseKey) {
    if (!_verbToolCurrentInf) return;
    const verb = verbConjugations.find(v => v.inf === _verbToolCurrentInf);
    if (!verb) return;
    document.getElementById('verbTableContainer').innerHTML = renderVerbTable(verb, tenseKey);
    resizeOpenResAccordion();
}

function resizeOpenResAccordion() {
    const activeHeader = document.querySelector('.res-accordion-header.active');
    if (!activeHeader) return;
    const content = document.getElementById(activeHeader.dataset.accitem);
    if (content) content.style.maxHeight = content.scrollHeight + 'px';
}

function posterLoadFailed(img) {
    if (img.parentElement) img.parentElement.innerHTML = '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
}

async function loadMoviePosters() {
    const imgs = document.querySelectorAll('img[data-wiki]');
    for (const img of imgs) {
        try {
            const title = encodeURIComponent(img.dataset.wiki);
            const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=200&pilicense=any&redirects=1&origin=*`);
            const data = await res.json();
            const page = Object.values(data.query.pages)[0];
            if (page.thumbnail?.source) {
                img.onerror = () => posterLoadFailed(img);
                img.src = page.thumbnail.source;
                img.style.display = '';
                if (img.nextElementSibling) img.nextElementSibling.style.display = 'none';
            }
        } catch(e) {}
    }
}

// YOUR SPACE TAB (personal Drive folder)
// ============================================================
function populatePersonalFolder() {
    const container = document.getElementById('personalFolder');

    // Build "This Week" card if there's a note from Aaron
    const thisWeekHtml = currentUser.thisWeek ? `
        <div style="background:linear-gradient(135deg,#eff6ff,#e0f2fe);border:1px solid #bfdbfe;border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <div style="background:#2563eb;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-thumbtack" style="font-size:13px;"></i>
                </div>
                <div>
                    <h4 style="font-size:14px;font-weight:700;color:#1e40af;margin:0;">This Week from Aaron</h4>
                </div>
            </div>
            <p style="font-size:14px;line-height:1.7;color:#1e3a5f;white-space:pre-wrap;">${currentUser.thisWeek}</p>
        </div>
    ` : '';

    if (!currentUser.driveFolder) {
        if (currentUser.isNewSignup) {
            container.innerHTML = thisWeekHtml + `
                <div class="folder-card cta-card">
                    <i class="fas fa-lock"></i>
                    <h4>Your Personal Learning Space</h4>
                    <p>When you start lessons with Aaron, you'll get your own private folder with personalized materials, lesson notes, and assignments — all tailored to your learning goals.</p>
                    <button class="access-btn cta-btn" onclick="window.open('https://calendly.com/aaronsiebertsio/lesson', '_blank')">
                        <i class="fas fa-calendar-plus"></i> Book Your First Lesson
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = thisWeekHtml + `
                <div class="folder-card">
                    <i class="fab fa-google-drive"></i>
                    <h4>${currentUser.name}'s Folder</h4>
                    <p>Your personal folder is being set up. Check back soon!</p>
                </div>
            `;
        }
        return;
    }

    container.innerHTML = thisWeekHtml + `
        <div class="folder-card">
            <i class="fab fa-google-drive"></i>
            <h4>${currentUser.name}'s Folder</h4>
            <p>Access your personal learning materials, lesson notes, and assignments</p>
            <button class="access-btn" onclick="window.open('${currentUser.driveFolder}', '_blank')">
                <i class="fas fa-external-link-alt"></i> Open Your Google Drive Folder
            </button>
        </div>
    `;
}

// ============================================================
// COMMUNITY TAB
// ============================================================
function updateCommunityDescription() {
    const desc = document.getElementById('communityDescription');
    desc.textContent = currentUser.type === 'music'
        ? 'Connect with fellow music students'
        : 'Connect with fellow Spanish students — practice, ask questions, share tips!';
}

// ============================================================
// TAB SWITCHING
// ============================================================
function showTab(tabName) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(tabName);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (tabName === 'community') {
        setTimeout(() => messageInput.focus(), 100);
    }
}

// ============================================================
// CHAT
// ============================================================
function sendMessage() {
    const message = messageInput.value.trim();
    if (message === '') return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageElement.innerHTML = `
        <div class="message-header">
            <strong>${currentUser.name}</strong>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">${escapeHtml(message)}</div>
    `;

    chatMessages.appendChild(messageElement);
    messageInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => simulateResponse(), 1000 + Math.random() * 2000);
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function simulateResponse() {
    const spanishResponses = [
        "¡Hola! ¿Cómo estás?",
        "Great question! I was wondering about that too.",
        "Thanks for sharing! That's really helpful.",
        "¿Alguien más tiene problemas con los verbos irregulares?",
        "The practice videos really helped me understand the pronunciation.",
        "Can someone explain the difference between ser and estar again?",
        "¡Buena suerte con tus estudios!",
        "I found this great resource for Spanish practice."
    ];

    const musicResponses = [
        "Has anyone tried the new practice track?",
        "I've been working on scales all week — finally getting faster!",
        "Great tip, thanks for sharing!",
        "Does anyone have recommendations for good warm-up exercises?",
        "The last lesson recording was super helpful.",
        "I'm struggling with rhythm — any advice?",
        "Just learned a new chord progression, sounds amazing!",
        "Practice makes perfect 🎵"
    ];

    const responses = currentUser.type === 'music' ? musicResponses : spanishResponses;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageElement.innerHTML = `
        <div class="message-header">
            <strong>Fellow Student</strong>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">${randomResponse}</div>
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================
// AI SPEAKING/WRITING COMPANION
// ============================================================
// ============================================================
// AI COMPANION — Immersive Spanish Practice
// ============================================================

const ADMIN_SECRET = 'AARON-ADMIN-2025';
let aiConversationHistory = [];
let studentInsightCache = null;
let currentAiMode = null;
let currentAiContext = null;
let isEditMode = false;

function toggleEditMode() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('admin-edit-mode', isEditMode);
    const btn = document.getElementById('editModeBtn');
    if (btn) btn.innerHTML = isEditMode
        ? '<i class="fas fa-eye"></i> View as Student'
        : '<i class="fas fa-edit"></i> Edit Mode';
    closeAdminMenu();
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'courses') {
        if (currentLessonId && currentCourseId) openLesson(currentCourseId, currentLessonId);
        else if (currentCourseId) openCourse(currentCourseId);
        else renderCourseList();
    }
}

function toggleAdminMenu() {
    document.getElementById('adminMenuDropdown').classList.toggle('hidden');
}

function closeAdminMenu() {
    document.getElementById('adminMenuDropdown')?.classList.add('hidden');
}

let ttsEnabled = true;
let ttsVoice = null;

function initTTS() {
    if (!window.speechSynthesis) return;
    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        ttsVoice = voices.find(v => v.lang === 'es-ES' && v.name.includes('Google'))
            || voices.find(v => v.lang === 'es-MX' && v.name.includes('Google'))
            || voices.find(v => v.lang.startsWith('es') && v.localService)
            || voices.find(v => v.lang.startsWith('es'))
            || null;
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    const clean = text
        .replace(/<[^>]+>/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/[⚠️🎭💬🖼️📚✈️☕👋🛒🏥🏨]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'es-ES';
    utt.rate = 0.88;
    utt.pitch = 1.05;
    if (ttsVoice) utt.voice = ttsVoice;
    window.speechSynthesis.speak(utt);
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('ttsToggleBtn');
    if (btn) {
        btn.innerHTML = ttsEnabled
            ? '<i class="fas fa-volume-up"></i> Voice on'
            : '<i class="fas fa-volume-mute"></i> Voice off';
        btn.style.opacity = ttsEnabled ? '1' : '0.5';
    }
    if (!ttsEnabled) window.speechSynthesis?.cancel();
}

async function loadStudentInsight() {
    if (!currentUser || currentUser.id === 'admin-preview') return null;
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/student_insights?user_id=eq.${currentUser.id}&select=*`, {
            headers: _headers(_accessToken)
        });
        const data = await r.json();
        return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch(e) { return null; }
}

async function saveConversationTurn(role, content) {
    if (!currentUser || currentUser.id === 'admin-preview' || !_accessToken) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
            method: 'POST',
            headers: { ..._headers(_accessToken), 'Prefer': 'return=minimal' },
            body: JSON.stringify({ user_id: currentUser.id, role, content })
        });
    } catch(e) {}
}

function buildAISystemPrompt(mode, context, insight) {
    const weaknesses = insight?.insight_text
        ? `\n\nKnown weak areas for ${currentUser.name} from previous sessions (prioritise these):\n${insight.insight_text}`
        : '';

    const modeInstructions = {
        free: `You are having a free conversation with ${currentUser.name}. Topic: anything they bring up. Keep it natural and flowing.`,
        roleplay: `You are playing a roleplay scenario: ${context}. You play the native Spanish speaker in that situation (waiter, hotel receptionist, local person, etc.). Stay in character. Start by setting the scene in Spanish.`,
        picture: `You are helping ${currentUser.name} practise picture description (like Aaron's Module 7 exercise). Tell them you are going to describe a scene to them, then describe a vivid everyday Spanish-world scene (a market in Barcelona, a family dinner, a beach in Valencia, etc.) and ask them to describe what's happening using their Spanish.`,
        grammar: `You are running a focused grammar drill on: ${context}. Create short exercises, ask them to form sentences, and drill this specific topic through conversation. Make it feel like a game, not a test.`
    };

    return `Eres un compañero de práctica de español para ${currentUser.name}, estudiante de Aaron.

${modeInstructions[mode] || modeInstructions.free}
${weaknesses}

REGLAS ABSOLUTAS — sigue estas sin excepción:
1. Responde SIEMPRE en español. Nunca escribas oraciones completas en inglés.
2. Las correcciones van entre corchetes en la misma frase: "¡Casi! [✓ fui, not 'fue' — 'fue' is él/ella] ¿Y qué compraste?"
3. Máximo 3 frases por respuesta. Sé conciso y directo.
4. Termina SIEMPRE con una pregunta o mini-reto para mantener la conversación.
5. Si el estudiante escribe en inglés, responde en español y añade: [Inténtalo en español — I'll help if you get stuck!]
6. Adapta el nivel: vocabulario sencillo, verbos del presente principalmente.
7. Sé cálido, paciente y animador. Celebra los aciertos.
8. Si el estudiante menciona un mensaje de voz, responde como si hubieras escuchado un intento en español.

Ejemplo de respuesta ideal:
Estudiante: "Ayer yo fue al supermercado"
Tú: "¡Bien! [✓ 'fui' para yo — 'fue' es para él/ella] ¿Y qué compraste allí?"`;
}

const AI_COMPANION_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-companion`;

async function callAnthropicAPI(messages, systemPrompt) {
    if (!_accessToken) {
        return '⚠️ Necesitas iniciar sesión como estudiante para usar el compañero de práctica.';
    }
    try {
        const r = await fetch(AI_COMPANION_FUNCTION_URL, {
            method: 'POST',
            headers: _headers(_accessToken),
            body: JSON.stringify({ messages: messages.slice(-20), systemPrompt })
        });
        const data = await r.json();
        if (!r.ok || data.error) return `⚠️ Error: ${data.error || 'No se pudo conectar con el compañero de práctica.'}`;
        return data.text || '...';
    } catch(e) {
        return '⚠️ No se pudo conectar. Comprueba tu conexión.';
    }
}

function showScenarioPicker() {
    document.getElementById('aiModeSelector').classList.add('hidden');
    document.getElementById('aiScenarioPicker').classList.remove('hidden');
}

function showGrammarPicker() {
    document.getElementById('aiModeSelector').classList.add('hidden');
    document.getElementById('aiGrammarPicker').classList.remove('hidden');
}

const MODE_LABELS = {
    free: '💬 Free Conversation',
    picture: '🖼️ Picture Description',
    roleplay: '🎭 Roleplay',
    grammar: '📚 Grammar Drill'
};

const MODE_OPENING = {
    free: '¡Hola! ¿De qué quieres hablar hoy? Cuéntame algo — ¿qué has hecho esta semana?',
    picture: null, // AI generates this
    roleplay: null, // AI generates this
    grammar: null  // AI generates this
};

async function startAiMode(mode, context) {
    currentAiMode = mode;
    currentAiContext = context || null;
    aiConversationHistory = [];
    studentInsightCache = await loadStudentInsight();

    // Show chat view
    document.getElementById('aiModeSelector').classList.add('hidden');
    document.getElementById('aiScenarioPicker').classList.add('hidden');
    document.getElementById('aiGrammarPicker').classList.add('hidden');
    document.getElementById('aiChatView').classList.remove('hidden');

    // Set mode label
    const label = MODE_LABELS[mode] + (context ? ` — ${context}` : '');
    document.getElementById('aiModeLabel').textContent = label;

    // Clear chat
    document.getElementById('aiChatMessages').innerHTML = '';

    // Show opening message
    if (MODE_OPENING[mode]) {
        appendAiMessage('bot', MODE_OPENING[mode]);
        speakText(MODE_OPENING[mode]);
    } else {
        // Let AI generate the opening
        appendAiMessage('bot', '<em style="color:var(--text-secondary)">Iniciando sesión...</em>');
        const systemPrompt = buildAISystemPrompt(mode, context, studentInsightCache);
        const opening = await callAnthropicAPI([{ role: 'user', content: '[START SESSION - greet the student and set up the activity in Spanish]' }], systemPrompt);
        document.getElementById('aiChatMessages').lastElementChild.remove();
        appendAiMessage('bot', opening);
        speakText(opening);
        aiConversationHistory.push({ role: 'assistant', content: opening });
        saveConversationTurn('assistant', opening);
    }
}

function endAiSession() {
    if (isListening) stopListening();
    document.getElementById('aiChatView').classList.add('hidden');
    document.getElementById('aiModeSelector').classList.remove('hidden');
    aiConversationHistory = [];
    currentAiMode = null;
    currentAiContext = null;
}

function appendAiMessage(type, html) {
    const el = document.createElement('div');
    el.className = `ai-message ai-${type}`;
    if (type === 'bot') {
        el.innerHTML = `<div class="ai-avatar"><i class="fas fa-robot"></i></div><div class="ai-bubble"><p>${html}</p></div>`;
    } else {
        el.innerHTML = `<div class="ai-bubble"><p>${html}</p></div><div class="ai-avatar user-avatar"><i class="fas fa-user"></i></div>`;
    }
    document.getElementById('aiChatMessages').appendChild(el);
    document.getElementById('aiChatMessages').scrollTop = 99999;
    return el;
}

async function sendAiMessage() {
    const message = aiMessageInput.value.trim();
    if (!message || !currentAiMode) return;

    appendAiMessage('user', escapeHtml(message));
    aiMessageInput.value = '';

    // Typing indicator
    const typing = appendAiMessage('bot', '<span class="typing-indicator"><span></span><span></span><span></span></span>');

    aiConversationHistory.push({ role: 'user', content: message });
    saveConversationTurn('user', message);

    const systemPrompt = buildAISystemPrompt(currentAiMode, currentAiContext, studentInsightCache);
    const response = await callAnthropicAPI(aiConversationHistory, systemPrompt);

    aiConversationHistory.push({ role: 'assistant', content: response });
    saveConversationTurn('assistant', response);

    typing.remove();
    appendAiMessage('bot', response);
    speakText(response);
}

function initAiCompanion() {
    aiConversationHistory = [];
    studentInsightCache = null;
    currentAiMode = null;
    currentAiContext = null;
    // Show mode selector
    document.getElementById('aiModeSelector').classList.remove('hidden');
    document.getElementById('aiScenarioPicker').classList.add('hidden');
    document.getElementById('aiGrammarPicker').classList.add('hidden');
    document.getElementById('aiChatView').classList.add('hidden');
}




// ============================================================
// VOICE INPUT — live speech-to-text (Web Speech API)
// ============================================================
// Press-and-hold the mic button: recognized speech streams straight into
// aiMessageInput as the student talks, so they can see and fix a mis-heard
// word before sending — then it goes through the exact same send flow
// (sendAiMessage) as if they'd typed it. No separate "voice message" pipeline.
function initSpeechRecognition() {
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) committedTranscript = (committedTranscript + ' ' + chunk).trim();
            else interim += chunk;
        }
        aiMessageInput.value = (committedTranscript + ' ' + interim).trim();
    };
    rec.onerror = (event) => {
        stopListeningUI();
        if (event.error === 'not-allowed') alert('Por favor permite el acceso al micrófono.');
    };
    rec.onend = () => stopListeningUI();
    return rec;
}

function startListening() {
    if (!speechSupported || isListening || !currentAiMode) return;
    if (!recognition) recognition = initSpeechRecognition();
    committedTranscript = aiMessageInput.value.trim();
    try {
        recognition.start();
        isListening = true;
        aiRecordBtn.classList.add('recording');
        aiRecordBtn.innerHTML = '<i class="fas fa-stop"></i>';
    } catch (err) {
        console.error('SpeechRecognition start failed:', err);
    }
}

function stopListening() {
    if (isListening) recognition.stop(); // onend -> stopListeningUI()
}

function stopListeningUI() {
    isListening = false;
    aiRecordBtn.classList.remove('recording');
    aiRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
}

// ============================================================
// COURSES TAB — Student View (two-column player)
// ============================================================

let currentCourseId = null;
let currentLessonId = null;
let quillInstance = null;

function getLastLesson(courseId) {
    return localStorage.getItem('lastLesson_' + courseId);
}

function saveLastLesson(courseId, lessonId) {
    localStorage.setItem('lastLesson_' + courseId, lessonId);
}

async function renderCourseList() {
    const courses = getCourses();
    const progress = await getProgress();
    const grid = document.getElementById('courseGrid');
    const noMsg = document.getElementById('noCoursesMsg');

    if (!courses || courses.length === 0) {
        grid.innerHTML = '';
        noMsg.classList.remove('hidden');
        return;
    }
    noMsg.classList.add('hidden');

    grid.innerHTML = courses.map(course => {
        const total = course.lessons.length;
        const done = course.lessons.filter(l => progress[course.id + '_' + l.id]).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const levelClass = course.level === 'Beginner' ? 'level-beginner' :
                           course.level === 'Intermediate' ? 'level-intermediate' : 'level-advanced';
        const coverHtml = course.coverImage
            ? `<img src="${course.coverImage}" class="course-cover-img" alt="${course.title}" onerror="this.style.display='none'">`
            : `<div class="course-cover-placeholder"><i class="fas fa-book-open"></i></div>`;
        return `
            <div class="course-card" onclick="openCourse('${course.id}')" style="${isEditMode && currentUser.isAdmin ? 'position:relative;' : ''}">
                ${coverHtml}
                ${(isEditMode && currentUser.isAdmin) ? `<div class="course-card-edit-overlay"><button onclick="event.stopPropagation();openCourseEditor('${course.id}')" class="admin-btn small"><i class="fas fa-cog"></i></button><button onclick="event.stopPropagation();deleteCourse('${course.id}')" class="admin-btn small danger"><i class="fas fa-trash"></i></button></div>` : ''}
                <div class="course-card-body">
                    <div class="course-card-top">
                        <span class="course-level-badge ${levelClass}">${course.level}</span>
                        ${currentUser.isAdmin ? `<span class="course-level-badge" style="background:var(--bg-secondary);color:var(--text-secondary);">${(course.subject || 'spanish') === 'music' ? '🎵 Music' : '🗣️ Spanish'}</span>` : ''}
                        <span class="course-lesson-count"><i class="fas fa-list"></i> ${total} lesson${total !== 1 ? 's' : ''}</span>
                    </div>
                    <h4 class="course-title">${course.title}</h4>
                    <p class="course-description">${course.description}</p>
                </div>
                <div class="course-card-footer">
                    <div class="course-progress-bar">
                        <div class="course-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="course-progress-label">${done}/${total} complete</span>
                </div>
            </div>`;
    }).join('');
}

async function openCourse(courseId) {
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    currentCourseId = courseId;
    document.getElementById('courseListView').classList.add('hidden');
    document.getElementById('coursePlayerView').classList.remove('hidden');

    // Build sidebar
    document.getElementById('sidebarCourseTitle').textContent = course.title;
    await refreshSidebar(course);

    // Open last visited lesson or first lesson
    const lastLesson = getLastLesson(courseId);
    const target = (lastLesson && course.lessons.find(l => l.id === lastLesson))
        ? lastLesson
        : (course.lessons[0] ? course.lessons[0].id : null);

    if (target) openLesson(courseId, target);
}

async function refreshSidebar(course) {
    const progress = await getProgress();
    const total = course.lessons.length;
    const done = course.lessons.filter(l => progress[course.id + '_' + l.id]).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('sidebarProgressFill').style.width = pct + '%';
    document.getElementById('sidebarProgressLabel').textContent = pct + '% complete';

    // Group lessons by section
    const sections = {};
    const noSection = [];
    course.lessons.forEach(lesson => {
        if (lesson.section && lesson.section.trim()) {
            if (!sections[lesson.section]) sections[lesson.section] = [];
            sections[lesson.section].push(lesson);
        } else {
            noSection.push(lesson);
        }
    });

    let html = '';

    // Lessons without a section
    if (noSection.length > 0) {
        noSection.forEach(lesson => {
            const isComplete = progress[course.id + '_' + lesson.id];
            const isActive = lesson.id === currentLessonId;
            html += sidebarLessonRow(lesson, course.id, isComplete, isActive);
        });
    }

    // Lessons grouped by section
    Object.entries(sections).forEach(([sectionName, lessons]) => {
        html += `<div class="sidebar-section-title">${sectionName}</div>`;
        lessons.forEach(lesson => {
            const isComplete = progress[course.id + '_' + lesson.id];
            const isActive = lesson.id === currentLessonId;
            html += sidebarLessonRow(lesson, course.id, isComplete, isActive);
        });
    });

    document.getElementById('sidebarLessonList').innerHTML = html;
}

function sidebarLessonRow(lesson, courseId, isComplete, isActive) {
    return `
        <div class="sidebar-lesson-row ${isActive ? 'active' : ''}" onclick="openLesson('${courseId}', '${lesson.id}')">
            <span class="sidebar-lesson-icon">
                ${isComplete
                    ? '<i class="fas fa-check-circle" style="color:#22c55e;font-size:14px;"></i>'
                    : '<i class="far fa-circle" style="color:var(--text-light);font-size:14px;"></i>'}
            </span>
            <span class="sidebar-lesson-name">${lesson.title}</span>
        </div>`;
}

async function openLesson(courseId, lessonId) {
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    const lesson = course && course.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    currentLessonId = lessonId;
    saveLastLesson(courseId, lessonId);

    // Refresh sidebar to update active state
    const courses2 = getCourses();
    const course2 = courses2.find(c => c.id === courseId);
    await refreshSidebar(course2);

    // Admin edit mode — render editable version in place
    if (isEditMode && currentUser.isAdmin) {
        renderEditableLesson(courseId, lessonId, lesson);
        return;
    }


    const progress = await getProgress();
    const isComplete = progress[courseId + '_' + lessonId];

    let html = `<div class="lesson-view-content">`;
    html += `<h3 class="lesson-view-title">${lesson.title}</h3>`;

    if (lesson.videoUrl) {
        const embedUrl = youtubeToEmbed(lesson.videoUrl);
        if (embedUrl) {
            html += `<div class="lesson-video-wrapper">
                <iframe src="${embedUrl}" frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
            </div>`;
        }
    }

    if (lesson.content) {
        html += `<div class="lesson-text-content">${lesson.content}</div>`;
    }

    if (lesson.audioUrl) {
        html += `<div class="lesson-audio-section">
            <h4><i class="fas fa-headphones"></i> Listen</h4>
            <audio controls src="${lesson.audioUrl}" style="width:100%;margin-top:8px;"></audio>
        </div>`;
    }

    if (lesson.quiz && lesson.quiz.length > 0) {
        html += renderQuiz(lesson.quiz, courseId, lessonId);
    }

    // Prev / Next navigation
    const lessonIndex = course.lessons.findIndex(l => l.id === lessonId);
    const prevLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
    const nextLesson = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;

    html += `<div class="lesson-nav-row">
        <div>
            ${prevLesson ? `<button class="back-btn" onclick="openLesson('${courseId}', '${prevLesson.id}')"><i class="fas fa-arrow-left"></i> ${prevLesson.title}</button>` : ''}
        </div>
        <button id="markCompleteBtn" class="mark-complete-btn ${isComplete ? 'completed' : ''}"
            onclick="toggleComplete('${courseId}', '${lessonId}')">
            ${isComplete ? '<i class="fas fa-check-circle"></i> Completed!' : '<i class="far fa-circle"></i> Mark as Complete'}
        </button>
        <div>
            ${nextLesson ? `<button class="back-btn" style="flex-direction:row-reverse;" onclick="openLesson('${courseId}', '${nextLesson.id}')">${nextLesson.title} <i class="fas fa-arrow-right"></i></button>` : ''}
        </div>
    </div>
    </div>`;

    document.getElementById('lessonContent').innerHTML = html;
    document.getElementById('courseContentArea').scrollTop = 0;
}

let inlineQuill = null;
let inlineQuizQuestions = [];

function renderEditableLesson(courseId, lessonId, lesson) {
    inlineQuizQuestions = lesson.quiz ? JSON.parse(JSON.stringify(lesson.quiz)) : [];

    const container = document.getElementById('lessonContent');
    container.innerHTML = `
        <div class="lesson-view-content admin-edit-mode-content">
            <div class="edit-mode-banner">✏️ Edit Mode — changes save when you click Save or switch lessons</div>

            <div class="editable-field-label">Section</div>
            <input id="ilSection" type="text" class="editable-inline-input" value="${escapeAttr(lesson.section||'')}" placeholder="e.g. BASICS (optional)">

            <div class="editable-field-label">Lesson title</div>
            <h3 class="lesson-view-title" id="ilTitle" contenteditable="true" style="border-bottom:2px dashed #c7d2fe;outline:none;padding-bottom:4px;">${lesson.title}</h3>

            <div class="editable-field-label">YouTube URL <span style="font-weight:400;opacity:.7;">(optional)</span></div>
            <input id="ilVideo" type="url" class="editable-inline-input" value="${escapeAttr(lesson.videoUrl||'')}" placeholder="https://www.youtube.com/watch?v=..." oninput="updateInlineVideo(this.value)">
            <div id="ilVideoPreview" style="margin-bottom:20px;">${lesson.videoUrl ? `<div class="lesson-video-wrapper"><iframe src="${youtubeToEmbed(lesson.videoUrl)}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>` : ''}</div>

            <div class="editable-field-label">Lesson notes</div>
            <div id="ilQuillContainer" style="border:1px dashed #c7d2fe;border-radius:var(--radius-md);overflow:hidden;margin-bottom:20px;min-height:160px;"></div>

            <div class="editable-field-label">Audio URL <span style="font-weight:400;opacity:.7;">(optional)</span></div>
            <input id="ilAudio" type="url" class="editable-inline-input" value="${escapeAttr(lesson.audioUrl||'')}" placeholder="https://... (mp3 or wav)" oninput="updateInlineAudio(this.value)" style="margin-bottom:8px;">
            <div id="ilAudioPreview" style="margin-bottom:20px;">${lesson.audioUrl ? `<div class="lesson-audio-section"><h4><i class="fas fa-headphones"></i> Listen</h4><audio controls src="${lesson.audioUrl}" style="width:100%;margin-top:8px;"></audio></div>` : ''}</div>

            <div class="editable-field-label" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span>Quiz questions</span>
                <button onclick="addInlineQuizQuestion()" class="admin-btn small primary"><i class="fas fa-plus"></i> Add question</button>
            </div>
            <div id="ilQuizContainer" style="margin-bottom:24px;"></div>

            <div style="display:flex;gap:12px;padding-top:20px;border-top:1px solid var(--border-light);">
                <button onclick="saveInlineLesson('${courseId}','${lessonId}')" class="login-btn" style="flex:1;"><i class="fas fa-save"></i> Save Lesson</button>
                <button onclick="deleteLesson('${courseId}','${lessonId}')" class="admin-btn danger"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>`;

    setTimeout(() => {
        if (inlineQuill) inlineQuill = null;
        document.getElementById('ilQuillContainer').innerHTML = '';
        inlineQuill = new Quill('#ilQuillContainer', {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        [{ header: [1,2,3,false] }],
                        ['bold','italic','strike','code'],
                        [{ list:'ordered' },{ list:'bullet' }],
                        ['blockquote'],['link'],['hr'],['clean']
                    ],
                    handlers: {
                        hr: function() {
                            const r = this.quill.getSelection(true);
                            this.quill.insertText(r.index,'\n','user');
                            this.quill.insertEmbed(r.index+1,'divider',true,'user');
                            this.quill.setSelection(r.index+2,'silent');
                        }
                    }
                }
            }
        });
        if (lesson.content) {
            inlineQuill.clipboard.dangerouslyPasteHTML(0, lesson.content);
            inlineQuill._originalContent = lesson.content;
            inlineQuill._changed = false;
        }
        inlineQuill.on('text-change', () => { inlineQuill._changed = true; });
        renderInlineQuiz();
    }, 60);

    document.getElementById('courseContentArea').scrollTop = 0;
}

function updateInlineVideo(url) {
    const embed = youtubeToEmbed(url);
    document.getElementById('ilVideoPreview').innerHTML = embed
        ? `<div class="lesson-video-wrapper"><iframe src="${embed}" frameborder="0" allowfullscreen></iframe></div>` : '';
}

function updateInlineAudio(url) {
    document.getElementById('ilAudioPreview').innerHTML = url
        ? `<div class="lesson-audio-section"><h4><i class="fas fa-headphones"></i> Listen</h4><audio controls src="${url}" style="width:100%;margin-top:8px;"></audio></div>` : '';
}

function renderInlineQuiz() {
    const c = document.getElementById('ilQuizContainer');
    if (!c) return;
    if (!inlineQuizQuestions.length) {
        c.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);">No quiz yet.</p>';
        return;
    }
    c.innerHTML = inlineQuizQuestions.map((q, qi) => `
        <div class="quiz-q-editor" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <label style="font-size:12px;font-weight:600;">Question ${qi+1}</label>
                <button class="admin-btn small danger" onclick="inlineQuizQuestions.splice(${qi},1);renderInlineQuiz()"><i class="fas fa-trash"></i></button>
            </div>
            <input type="text" value="${escapeAttr(q.question)}" oninput="inlineQuizQuestions[${qi}].question=this.value" placeholder="Question..." style="width:100%;margin-bottom:6px;">
            ${q.options.map((opt,oi)=>`
                <div class="quiz-option-editor">
                    <input type="radio" name="ilq_${qi}" ${q.correct===oi?'checked':''} onchange="inlineQuizQuestions[${qi}].correct=${oi}" title="Correct answer">
                    <input type="text" value="${escapeAttr(opt)}" oninput="inlineQuizQuestions[${qi}].options[${oi}]=this.value" placeholder="Option ${String.fromCharCode(65+oi)}">
                </div>`).join('')}
        </div>`).join('');
}

function addInlineQuizQuestion() {
    inlineQuizQuestions.push({ question:'', options:['','','',''], correct:0 });
    renderInlineQuiz();
}

function saveInlineLesson(courseId, lessonId) {
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    const lesson = course?.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    lesson.section = document.getElementById('ilSection')?.value.trim() || '';
    lesson.title = document.getElementById('ilTitle')?.innerText.trim() || lesson.title;
    lesson.videoUrl = document.getElementById('ilVideo')?.value.trim() || '';
    lesson.audioUrl = document.getElementById('ilAudio')?.value.trim() || '';
    lesson.content = (inlineQuill?._changed) ? inlineQuill.root.innerHTML : (inlineQuill?._originalContent || lesson.content);
    lesson.quiz = inlineQuizQuestions.filter(q => q.question.trim());

    saveCourses(courses);
    showImportSuccess('Lesson saved!');
    openCourse(courseId); // refresh sidebar
    openLesson(courseId, lessonId); // re-render
}

function youtubeToEmbed(url) {
    try {
        const u = new URL(url);
        let videoId = u.searchParams.get('v');
        if (!videoId && u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
        if (!videoId) return null;
        return `https://www.youtube.com/embed/${videoId}`;
    } catch { return null; }
}

function renderQuiz(questions, courseId, lessonId) {
    const quizId = 'quiz_' + courseId + '_' + lessonId;
    let html = `<div class="lesson-quiz-section" id="${quizId}">`;
    html += `<h4><i class="fas fa-question-circle"></i> Quick Quiz</h4>`;
    questions.forEach((q, qi) => {
        html += `<div class="quiz-question" id="${quizId}_q${qi}">
            <p class="quiz-question-text">${qi + 1}. ${q.question}</p>
            <div class="quiz-options">
                ${q.options.map((opt, oi) => `
                    <button class="quiz-option" onclick="checkAnswer('${quizId}', ${qi}, ${oi}, ${q.correct})">
                        <span class="quiz-option-letter">${String.fromCharCode(65 + oi)}</span> ${opt}
                    </button>`).join('')}
            </div>
            <div class="quiz-feedback hidden" id="${quizId}_f${qi}"></div>
        </div>`;
    });
    html += `</div>`;
    return html;
}

function checkAnswer(quizId, qi, selected, correct) {
    const questionEl = document.getElementById(`${quizId}_q${qi}`);
    const feedbackEl = document.getElementById(`${quizId}_f${qi}`);
    if (!questionEl || questionEl.dataset.answered) return;
    questionEl.dataset.answered = 'true';
    const opts = questionEl.querySelectorAll('.quiz-option');
    opts.forEach((btn, i) => {
        btn.disabled = true;
        if (i === correct) btn.classList.add('correct');
        else if (i === selected) btn.classList.add('incorrect');
    });
    feedbackEl.classList.remove('hidden');
    feedbackEl.innerHTML = selected === correct
        ? '<span class="quiz-correct-msg"><i class="fas fa-check"></i> Correct!</span>'
        : `<span class="quiz-wrong-msg"><i class="fas fa-times"></i> Not quite — the right answer is <strong>${String.fromCharCode(65 + correct)}</strong></span>`;
}

async function toggleComplete(courseId, lessonId) {
    const progress = await getProgress();
    const key = courseId + '_' + lessonId;
    const btn = document.getElementById('markCompleteBtn');

    if (progress[key]) {
        await sbDeleteProgress(currentUser.id, courseId, lessonId);
        btn.className = 'mark-complete-btn';
        btn.innerHTML = '<i class="far fa-circle"></i> Mark as Complete';
    } else {
        await sbUpsertProgress(currentUser.id, courseId, lessonId);
        btn.className = 'mark-complete-btn completed';
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Completed!';
    }

    // Refresh sidebar progress
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (course) await refreshSidebar(course);
}

// Render courses when tab is clicked
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-tab') === 'courses') {
                document.getElementById('courseListView').classList.remove('hidden');
                document.getElementById('coursePlayerView').classList.add('hidden');
                currentCourseId = null;
                currentLessonId = null;
                renderCourseList();
            }
        });
    });
    document.getElementById('backToCourses').addEventListener('click', () => {
        document.getElementById('coursePlayerView').classList.add('hidden');
        document.getElementById('courseListView').classList.remove('hidden');
        currentCourseId = null;
        currentLessonId = null;
        renderCourseList();
    });
});


// Register horizontal rule blot for Quill
document.addEventListener('DOMContentLoaded', () => {
    if (window.Quill) {
        const BlockEmbed = Quill.import('blots/block/embed');
        class DividerBlot extends BlockEmbed {
            static create() { return document.createElement('hr'); }
            static value() { return true; }
        }
        DividerBlot.blotName = 'divider';
        DividerBlot.tagName = 'hr';
        Quill.register(DividerBlot);
    }
});

// ============================================================
// ADMIN PANEL
// ============================================================

let editingCourseId = null;
let editingLessonId = null;
let editingLessonCourseId = null;
let pendingQuizQuestions = [];

function switchAdminTab(tab) {
    ['courses','students','settings'].forEach(t => {
        const pane = document.getElementById('adminPane' + t.charAt(0).toUpperCase() + t.slice(1));
        const btn = document.getElementById('adminTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (pane) pane.classList.toggle('hidden', t !== tab);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'students') loadAdminStudents();
}

function saveApiKey() {
    const key = document.getElementById('anthropicKeyInput').value.trim();
    if (!key) { document.getElementById('apiKeyStatus').innerHTML = '<span style="color:#dc2626;">Please enter a key.</span>'; return; }
    localStorage.setItem('anthropicApiKey', key);
    document.getElementById('apiKeyStatus').innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> Saved!</span>';
}

function _adminCourseCardHtml(course) {
    return `
        <div class="admin-course-card">
            <div class="admin-course-header">
                <div>
                    <h4 class="admin-course-title">${course.title}</h4>
                    <span class="admin-course-meta">${course.level} · ${course.lessons.length} lesson${course.lessons.length !== 1 ? 's' : ''}</span>
                    <p class="admin-course-desc">${course.description}</p>
                </div>
                <div class="admin-course-actions">
                    <button class="admin-btn small primary" onclick="openVisualEditor('${course.id}', null)">
                        <i class="fas fa-edit"></i> Open Editor
                    </button>
                    <button class="admin-btn small" onclick="openCourseEditor('${course.id}')">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="admin-btn small danger" onclick="deleteCourse('${course.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="admin-lesson-list">
                ${course.lessons.map((lesson, i) => `
                    <div class="admin-lesson-row">
                        <span class="admin-lesson-num">${i + 1}</span>
                        <span class="admin-lesson-title">${lesson.title}</span>
                        <div class="admin-lesson-tags">
                            ${lesson.videoUrl ? '<span class="admin-tag">Video</span>' : ''}
                            ${lesson.content ? '<span class="admin-tag">Notes</span>' : ''}
                            ${lesson.audioUrl ? '<span class="admin-tag">Audio</span>' : ''}
                            ${lesson.quiz && lesson.quiz.length > 0 ? `<span class="admin-tag">Quiz (${lesson.quiz.length})</span>` : ''}
                        </div>
                        <div class="admin-lesson-actions">
                            <button class="admin-btn small" onclick="openVisualEditor('${course.id}', '${lesson.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="admin-btn small danger" onclick="deleteLesson('${course.id}', '${lesson.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
                <button class="admin-add-lesson-btn" onclick="addNewLessonVisual('${course.id}')">
                    <i class="fas fa-plus"></i> Add Lesson
                </button>
            </div>
        </div>
    `;
}

function renderAdminCourseList() {
    const courses = getCourses();
    const container = document.getElementById('adminCourseList');
    if (!container) return;

    if (courses.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-secondary);">
            <i class="fas fa-book-open" style="font-size:32px;margin-bottom:16px;display:block;"></i>
            <p>No courses yet. Click <strong>New Course</strong> to get started.</p>
        </div>`;
        return;
    }

    // Group by subject so Spanish and Music courses are always visually separate
    const spanishCourses = courses.filter(c => (c.subject || 'spanish') === 'spanish');
    const musicCourses = courses.filter(c => c.subject === 'music');

    let html = '';
    html += `<div class="admin-course-subject-header"><i class="fas fa-language"></i> SPANISH</div>`;
    html += spanishCourses.length
        ? spanishCourses.map(_adminCourseCardHtml).join('')
        : `<p style="color:var(--text-secondary);font-size:13px;padding:0 4px 20px;">No Spanish courses yet.</p>`;
    html += `<div class="admin-course-subject-header"><i class="fas fa-music"></i> MUSIC</div>`;
    html += musicCourses.length
        ? musicCourses.map(_adminCourseCardHtml).join('')
        : `<p style="color:var(--text-secondary);font-size:13px;padding:0 4px;">No Music courses yet.</p>`;

    container.innerHTML = html;
}

function handleCoverImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('editCourseCover').value = e.target.result;
        document.getElementById('coverPreview').innerHTML = `<img src="${e.target.result}" style="max-height:80px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">`;
    };
    reader.readAsDataURL(file);
}

function openCourseEditor(courseId) {
    editingCourseId = courseId;
    const courses = getCourses();
    const course = courseId ? courses.find(c => c.id === courseId) : null;

    document.getElementById('courseEditorTitle').textContent = course ? 'Edit Course' : 'New Course';
    document.getElementById('editCourseTitle').value = course ? course.title : '';
    document.getElementById('editCourseDesc').value = course ? course.description : '';
    document.getElementById('editCourseSubject').value = course ? (course.subject || 'spanish') : 'spanish';
    document.getElementById('editCourseLevel').value = course ? course.level : 'Beginner';
    document.getElementById('editCourseCover').value = course ? (course.coverImage || '') : '';
    const prev = document.getElementById('coverPreview');
    if (prev) prev.innerHTML = course?.coverImage ? `<img src="${course.coverImage}" style="max-height:80px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">` : '';
    document.getElementById('courseEditorModal').classList.remove('hidden');
}

function closeCourseEditor() {
    document.getElementById('courseEditorModal').classList.add('hidden');
    editingCourseId = null;
}

function saveCourseEdit() {
    const title = document.getElementById('editCourseTitle').value.trim();
    const desc = document.getElementById('editCourseDesc').value.trim();
    const subject = document.getElementById('editCourseSubject').value;
    const level = document.getElementById('editCourseLevel').value;
    const coverImage = document.getElementById('editCourseCover').value.trim();
    if (!title) { alert('Please enter a course title.'); return; }

    const courses = getCourses();
    if (editingCourseId) {
        const course = courses.find(c => c.id === editingCourseId);
        if (course) { course.title = title; course.description = desc; course.subject = subject; course.level = level; course.coverImage = coverImage; }
    } else {
        courses.push({ id: 'course-' + Date.now(), subject, title, description: desc, level, coverImage, lessons: [] });
    }
    saveCourses(courses);
    closeCourseEditor();
    renderAdminCourseList();
}

function deleteCourse(courseId) {
    if (!confirm('Delete this course and all its lessons? This cannot be undone.')) return;
    const courses = getCourses().filter(c => c.id !== courseId);
    saveCourses(courses);
    renderAdminCourseList();
}

// ============================================================
// VISUAL LESSON EDITOR (WYSIWYG)
// ============================================================

let visualEditorCourseId = null;
let visualEditorLessonId = null;
let visualEditorQuill = null;
let visualEditorQuizQuestions = [];

function openVisualEditor(courseId, lessonId) {
    visualEditorCourseId = courseId;
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    // Default to first lesson if none specified
    visualEditorLessonId = lessonId || (course.lessons[0]?.id) || null;

    document.getElementById('visualLessonEditor').classList.remove('hidden');
    document.getElementById('visualEditorCourseTitle').textContent = course.title;
    renderVisualEditorSidebar(course);
    if (visualEditorLessonId) renderVisualEditorLesson(courseId, visualEditorLessonId);
}

function closeVisualEditor() {
    document.getElementById('visualLessonEditor').classList.add('hidden');
    if (visualEditorQuill) { visualEditorQuill = null; }
    renderAdminCourseList();
}

function renderVisualEditorSidebar(course) {
    const sidebar = document.getElementById('visualEditorSidebar');
    const sections = {};
    const noSection = [];

    course.lessons.forEach(lesson => {
        if (lesson.section?.trim()) {
            if (!sections[lesson.section]) sections[lesson.section] = [];
            sections[lesson.section].push(lesson);
        } else { noSection.push(lesson); }
    });

    let html = `<div class="course-sidebar-header">
        <h4>${course.title}</h4>
    </div>`;

    noSection.forEach(lesson => {
        html += visualSidebarRow(lesson, course.id);
    });
    Object.entries(sections).forEach(([name, lessons]) => {
        html += `<div class="sidebar-section-title">${name}</div>`;
        lessons.forEach(lesson => { html += visualSidebarRow(lesson, course.id); });
    });

    html += `<div style="padding:12px 16px;border-top:1px solid var(--border-light);margin-top:8px;">
        <button onclick="addNewLessonVisual('${course.id}')" class="admin-add-lesson-btn" style="margin:0;">
            <i class="fas fa-plus"></i> Add Lesson
        </button>
    </div>`;

    sidebar.innerHTML = html;
}

function visualSidebarRow(lesson, courseId) {
    const isActive = lesson.id === visualEditorLessonId;
    return `<div class="sidebar-lesson-row ${isActive ? 'active' : ''}" onclick="renderVisualEditorLesson('${courseId}', '${lesson.id}')">
        <span class="sidebar-lesson-icon"><i class="fas fa-${isActive ? 'edit' : 'circle'}" style="font-size:10px;color:${isActive ? 'var(--accent-color)' : 'var(--text-light)'};"></i></span>
        <span class="sidebar-lesson-name">${lesson.title}</span>
    </div>`;
}

function renderVisualEditorLesson(courseId, lessonId) {
    // Save current before switching
    if (visualEditorLessonId && visualEditorLessonId !== lessonId && visualEditorQuill) {
        persistVisualEditorChanges(false);
    }

    visualEditorCourseId = courseId;
    visualEditorLessonId = lessonId;
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    const lesson = course?.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    // Update sidebar active state
    renderVisualEditorSidebar(course);
    visualEditorQuizQuestions = lesson.quiz ? JSON.parse(JSON.stringify(lesson.quiz)) : [];

    const content = document.getElementById('visualEditorContent');
    content.innerHTML = `
        <div class="lesson-view-content">

            <!-- Editable title -->
            <div class="visual-edit-block">
                <div class="visual-edit-label">Lesson title</div>
                <h3 class="lesson-view-title" contenteditable="true" id="veTitle"
                    style="outline:none;border-bottom:2px dashed #c7d2fe;padding-bottom:4px;"
                    >${lesson.title}</h3>
            </div>

            <!-- Section tag -->
            <div class="visual-edit-block" style="margin-bottom:16px;">
                <div class="visual-edit-label">Section / chapter <span style="font-weight:400;">(optional)</span></div>
                <input id="veSection" type="text" value="${escapeAttr(lesson.section || '')}"
                    placeholder="e.g. BASICS"
                    style="font-size:12px;padding:6px 10px;border:1px dashed #c7d2fe;border-radius:var(--radius-sm);background:var(--bg-secondary);width:100%;max-width:300px;">
            </div>

            <!-- Video -->
            <div class="visual-edit-block">
                <div class="visual-edit-label">YouTube video URL <span style="font-weight:400;">(optional)</span></div>
                <input id="veVideoUrl" type="url" value="${escapeAttr(lesson.videoUrl || '')}"
                    placeholder="https://www.youtube.com/watch?v=..."
                    oninput="updateVideoPreview(this.value)"
                    style="font-size:13px;padding:8px 12px;border:1px dashed #c7d2fe;border-radius:var(--radius-sm);background:var(--bg-secondary);width:100%;margin-bottom:10px;">
                <div id="veVideoPreview">
                    ${lesson.videoUrl ? `<div class="lesson-video-wrapper"><iframe src="${youtubeToEmbed(lesson.videoUrl)}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>` : ''}
                </div>
            </div>

            <!-- Content / notes (Quill) -->
            <div class="visual-edit-block">
                <div class="visual-edit-label">Lesson notes</div>
                <div id="veQuillContainer" style="border:1px dashed #c7d2fe;border-radius:var(--radius-md);overflow:hidden;min-height:160px;"></div>
            </div>

            <!-- Audio -->
            <div class="visual-edit-block">
                <div class="visual-edit-label">Audio URL <span style="font-weight:400;">(optional — mp3/wav)</span></div>
                <input id="veAudioUrl" type="url" value="${escapeAttr(lesson.audioUrl || '')}"
                    placeholder="https://..."
                    oninput="updateAudioPreview(this.value)"
                    style="font-size:13px;padding:8px 12px;border:1px dashed #c7d2fe;border-radius:var(--radius-sm);background:var(--bg-secondary);width:100%;margin-bottom:10px;">
                <div id="veAudioPreview">
                    ${lesson.audioUrl ? `<div class="lesson-audio-section"><h4><i class="fas fa-headphones"></i> Listen</h4><audio controls src="${lesson.audioUrl}" style="width:100%;margin-top:8px;"></audio></div>` : ''}
                </div>
            </div>

            <!-- Quiz -->
            <div class="visual-edit-block">
                <div class="visual-edit-label" style="display:flex;justify-content:space-between;align-items:center;">
                    <span>Quiz questions</span>
                    <button onclick="addVisualQuizQuestion()" class="admin-btn small primary"><i class="fas fa-plus"></i> Add question</button>
                </div>
                <div id="veQuizContainer"></div>
            </div>

            <!-- Delete lesson -->
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border-light);">
                <button onclick="deleteLessonVisual('${courseId}','${lessonId}')" class="admin-btn danger" style="font-size:12px;">
                    <i class="fas fa-trash"></i> Delete this lesson
                </button>
            </div>
        </div>`;

    // Init Quill
    setTimeout(() => {
        if (visualEditorQuill) visualEditorQuill = null;
        document.getElementById('veQuillContainer').innerHTML = '';
        visualEditorQuill = new Quill('#veQuillContainer', {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        [{ header: [1,2,3,false] }],
                        ['bold','italic','strike','code'],
                        [{ list:'ordered' },{ list:'bullet' }],
                        ['blockquote'],['link'],['hr'],['clean']
                    ],
                    handlers: {
                        hr: function() {
                            const r = this.quill.getSelection(true);
                            this.quill.insertText(r.index,'\n','user');
                            this.quill.insertEmbed(r.index+1,'divider',true,'user');
                            this.quill.setSelection(r.index+2,'silent');
                        }
                    }
                }
            }
        });
        if (lesson.content) {
            visualEditorQuill.clipboard.dangerouslyPasteHTML(0, lesson.content);
            visualEditorQuill._originalContent = lesson.content;
            visualEditorQuill._changed = false;
        }
        visualEditorQuill.on('text-change', () => { visualEditorQuill._changed = true; });
        renderVisualQuiz();
    }, 60);
}

function updateVideoPreview(url) {
    const embed = youtubeToEmbed(url);
    document.getElementById('veVideoPreview').innerHTML = embed
        ? `<div class="lesson-video-wrapper"><iframe src="${embed}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`
        : '';
}

function updateAudioPreview(url) {
    document.getElementById('veAudioPreview').innerHTML = url
        ? `<div class="lesson-audio-section"><h4><i class="fas fa-headphones"></i> Listen</h4><audio controls src="${url}" style="width:100%;margin-top:8px;"></audio></div>`
        : '';
}

function renderVisualQuiz() {
    const container = document.getElementById('veQuizContainer');
    if (!container) return;
    if (visualEditorQuizQuestions.length === 0) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:12px 0;">No quiz questions yet.</p>';
        return;
    }
    container.innerHTML = visualEditorQuizQuestions.map((q, qi) => `
        <div class="quiz-q-editor" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <label style="font-size:12px;font-weight:600;">Question ${qi + 1}</label>
                <button class="admin-btn small danger" onclick="visualEditorQuizQuestions.splice(${qi},1);renderVisualQuiz()"><i class="fas fa-trash"></i></button>
            </div>
            <input type="text" value="${escapeAttr(q.question)}" oninput="visualEditorQuizQuestions[${qi}].question=this.value"
                placeholder="Question text..." style="width:100%;margin-bottom:8px;">
            ${q.options.map((opt, oi) => `
                <div class="quiz-option-editor">
                    <input type="radio" name="vq_correct_${qi}" ${q.correct===oi?'checked':''} onchange="visualEditorQuizQuestions[${qi}].correct=${oi}" title="Correct answer">
                    <input type="text" value="${escapeAttr(opt)}" oninput="visualEditorQuizQuestions[${qi}].options[${oi}]=this.value" placeholder="Option ${String.fromCharCode(65+oi)}">
                </div>`).join('')}
            <p style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Select the radio button next to the correct answer</p>
        </div>`).join('');
}

function addVisualQuizQuestion() {
    visualEditorQuizQuestions.push({ question: '', options: ['','','',''], correct: 0 });
    renderVisualQuiz();
}

function addNewLessonVisual(courseId) {
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    const newLesson = { id: 'lesson-' + Date.now(), section: '', title: 'New Lesson', videoUrl: '', content: '', audioUrl: '', quiz: [] };
    course.lessons.push(newLesson);
    saveCourses(courses);
    openVisualEditor(courseId, newLesson.id);
}

function deleteLessonVisual(courseId, lessonId) {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (course) course.lessons = course.lessons.filter(l => l.id !== lessonId);
    saveCourses(courses);
    const nextLesson = course?.lessons[0]?.id || null;
    if (nextLesson) { renderVisualEditorLesson(courseId, nextLesson); }
    else { closeVisualEditor(); }
}

function persistVisualEditorChanges(showToast = true) {
    if (!visualEditorCourseId || !visualEditorLessonId) return;
    const courses = getCourses();
    const course = courses.find(c => c.id === visualEditorCourseId);
    const lesson = course?.lessons.find(l => l.id === visualEditorLessonId);
    if (!lesson) return;

    lesson.title = document.getElementById('veTitle')?.innerText?.trim() || lesson.title;
    lesson.section = document.getElementById('veSection')?.value?.trim() || '';
    lesson.videoUrl = document.getElementById('veVideoUrl')?.value?.trim() || '';
    lesson.audioUrl = document.getElementById('veAudioUrl')?.value?.trim() || '';
    lesson.content = (visualEditorQuill?._changed) ? visualEditorQuill.root.innerHTML : (visualEditorQuill?._originalContent || lesson.content);
    lesson.quiz = visualEditorQuizQuestions.filter(q => q.question.trim());

    saveCourses(courses);
    if (showToast) showImportSuccess('Lesson saved!');
}

function saveVisualLesson() {
    persistVisualEditorChanges(true);
    renderVisualEditorSidebar(getCourses().find(c => c.id === visualEditorCourseId));
}

function openLessonEditor(courseId, lessonId) {
    editingLessonCourseId = courseId;
    editingLessonId = lessonId;
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    const lesson = lessonId && course ? course.lessons.find(l => l.id === lessonId) : null;

    document.getElementById('lessonEditorTitle').textContent = lesson ? 'Edit Lesson' : 'New Lesson';
    document.getElementById('editLessonSection').value = lesson ? (lesson.section || '') : '';
    document.getElementById('editLessonTitle').value = lesson ? lesson.title : '';
    document.getElementById('editLessonVideo').value = lesson ? lesson.videoUrl : '';
    document.getElementById('editLessonAudio').value = lesson ? lesson.audioUrl : '';

    pendingQuizQuestions = lesson && lesson.quiz ? JSON.parse(JSON.stringify(lesson.quiz)) : [];
    renderQuizEditor();

    document.getElementById('lessonEditorModal').classList.remove('hidden');

    // Destroy previous Quill instance completely before creating a new one
    setTimeout(() => {
        const editorContainer = document.getElementById('quillEditor');
        // Remove any existing Quill toolbar sibling
        const modal = editorContainer.closest('.admin-modal-content');
        modal.querySelectorAll('.ql-toolbar').forEach(el => el.remove());
        editorContainer.innerHTML = '';
        editorContainer.className = '';

        quillInstance = new Quill('#quillEditor', {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        [{ header: [1, 2, 3, false] }],
                        ['bold', 'italic', 'strike', 'code'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['blockquote', 'code-block'],
                        ['link', 'image'],
                        ['hr'],
                        ['clean']
                    ],
                    handlers: {
                        hr: function() {
                            const range = this.quill.getSelection(true);
                            this.quill.insertText(range.index, '\n', 'user');
                            this.quill.insertEmbed(range.index + 1, 'divider', true, 'user');
                            this.quill.setSelection(range.index + 2, 'silent');
                        }
                    }
                }
            }
        });
        if (lesson && lesson.content) {
            quillInstance.clipboard.dangerouslyPasteHTML(0, lesson.content);
            quillInstance._originalContent = lesson.content;
            quillInstance._changed = false;
        }
        quillInstance.on('text-change', () => { quillInstance._changed = true; });
    }, 50);
}

function closeLessonEditor() {
    document.getElementById('lessonEditorModal').classList.add('hidden');
    editingLessonId = null;
    editingLessonCourseId = null;
}

function renderQuizEditor() {
    const container = document.getElementById('quizQuestionsEditor');
    if (pendingQuizQuestions.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">No questions yet. Click "Add Question" to start building a quiz.</p>`;
        return;
    }
    container.innerHTML = pendingQuizQuestions.map((q, qi) => `
        <div class="quiz-q-editor">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <label style="font-weight:600;font-size:13px;">Question ${qi + 1}</label>
                <button type="button" class="admin-btn small danger" onclick="removeQuizQuestion(${qi})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <input type="text" value="${escapeAttr(q.question)}" oninput="pendingQuizQuestions[${qi}].question=this.value" placeholder="Enter question...">
            ${q.options.map((opt, oi) => `
                <div class="quiz-option-editor">
                    <input type="radio" name="correct_${qi}" ${q.correct === oi ? 'checked' : ''}
                        onchange="pendingQuizQuestions[${qi}].correct=${oi}" title="Mark as correct answer">
                    <input type="text" value="${escapeAttr(opt)}" oninput="pendingQuizQuestions[${qi}].options[${oi}]=this.value" placeholder="Option ${String.fromCharCode(65 + oi)}">
                </div>
            `).join('')}
            <p style="font-size:11px;color:var(--text-secondary);">Select the radio button next to the correct answer</p>
        </div>
    `).join('');
}

function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function addQuizQuestion() {
    pendingQuizQuestions.push({ question: '', options: ['', '', '', ''], correct: 0 });
    renderQuizEditor();
}

function removeQuizQuestion(qi) {
    pendingQuizQuestions.splice(qi, 1);
    renderQuizEditor();
}

function saveLessonEdit() {
    const section = document.getElementById('editLessonSection').value.trim();
    const title = document.getElementById('editLessonTitle').value.trim();
    const videoUrl = document.getElementById('editLessonVideo').value.trim();
    const content = (quillInstance?._changed) ? quillInstance.root.innerHTML : (quillInstance?._originalContent || '');
    const audioUrl = document.getElementById('editLessonAudio').value.trim();
    if (!title) { alert('Please enter a lesson title.'); return; }

    const quiz = pendingQuizQuestions.filter(q => q.question.trim());

    const courses = getCourses();
    const course = courses.find(c => c.id === editingLessonCourseId);
    if (!course) return;

    if (editingLessonId) {
        const lesson = course.lessons.find(l => l.id === editingLessonId);
        if (lesson) { lesson.section = section; lesson.title = title; lesson.videoUrl = videoUrl; lesson.content = content; lesson.audioUrl = audioUrl; lesson.quiz = quiz; }
    } else {
        course.lessons.push({ id: 'lesson-' + Date.now(), section, title, videoUrl, content, audioUrl, quiz });
    }

    saveCourses(courses);
    closeLessonEditor();
    renderAdminCourseList();
}

function deleteLesson(courseId, lessonId) {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;
    const courses = getCourses();
    const course = courses.find(c => c.id === courseId);
    if (course) course.lessons = course.lessons.filter(l => l.id !== lessonId);
    saveCourses(courses);
    renderAdminCourseList();
}

// ============================================================
// STUDENTS DASHBOARD
// ============================================================

async function sbRpc(funcName, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + (SUPABASE_KEY)
        },
        body: JSON.stringify(params)
    });
    // Void/upsert-style RPCs (e.g. save_courses_admin) succeed with a 204 and no
    // body — r.json() throws on an empty body, so only parse when there's content.
    const text = await r.text();
    return text ? JSON.parse(text) : (r.ok ? null : { code: r.status, message: r.statusText });
}

async function saveStudentProfile(userId) {
    const driveFolder = document.getElementById(`drive_${userId}`)?.value.trim() || '';
    const type = document.getElementById(`type_${userId}`)?.value || 'spanish';
    const thisWeek = document.getElementById(`thisweek_${userId}`)?.value.trim() || '';
    const email = document.getElementById(`email_${userId}`)?.value.trim() || '';
    const phone = document.getElementById(`phone_${userId}`)?.value.trim() || '';
    const btn = document.querySelector(`button[onclick="saveStudentProfile('${userId}')"]`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; btn.disabled = true; }

    const result = await sbRpc('admin_update_profile', {
        admin_secret: ADMIN_SECRET,
        p_id: userId,
        p_drive_folder: driveFolder,
        p_type: type,
        p_this_week: thisWeek,
        p_email: email,
        p_phone: phone
    });
    const failed = result && typeof result === 'object' && !Array.isArray(result) && result.message;

    if (btn) {
        btn.disabled = false;
        if (!failed) {
            // Update cache so Preview reflects the latest saved data
            if (_studentCache[userId]) {
                _studentCache[userId].drive_folder = driveFolder;
                _studentCache[userId].type = type;
                _studentCache[userId].this_week = thisWeek;
                _studentCache[userId].email = email;
                _studentCache[userId].phone = phone;
            }
            btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            btn.style.background = '#22c55e';
            btn.style.color = 'white';
            setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; btn.style.color = ''; }, 2500);
        } else {
            btn.innerHTML = '<i class="fas fa-times"></i> Failed';
            alert('Save failed: ' + result.message);
            setTimeout(() => { btn.innerHTML = originalText; }, 2500);
        }
    }
}

async function loadAdminStudents() {
    const container = document.getElementById('adminStudentList');
    container.innerHTML = '<p style="color:var(--text-secondary);">Loading...</p>';

    try {
        // Query profiles via the admin-gated RPC (direct table access is
        // locked down by RLS to "own row only" now)
        const profiles = await sbRpc('admin_list_profiles', { admin_secret: ADMIN_SECRET });

        // Supabase returns an error object if something's wrong
        if (!Array.isArray(profiles)) {
            container.innerHTML = `<p style="color:#dc2626;">Could not load students. Supabase error: ${JSON.stringify(profiles)}</p>`;
            return;
        }

        if (profiles.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">No students signed up yet.</p>';
            return;
        }

        // Query insights (non-critical, ignore if fails)
        let insights = [];
        try {
            const insightsData = await sbRpc('get_all_insights_admin', { admin_secret: ADMIN_SECRET });
            if (Array.isArray(insightsData)) insights = insightsData;
        } catch(e) {}

        const insightMap = {};
        insights.forEach(i => { insightMap[i.user_id] = i; });

        // Cache all student data for preview
        _studentCache = {};
        profiles.forEach(s => { _studentCache[s.id] = s; });

        container.innerHTML = profiles.map(student => {
            const insight = insightMap[student.id];
            const hasInsight = insight && insight.insight_text;
            const preview = hasInsight ? insight.insight_text.slice(0, 120) + '...' : '';
            const date = hasInsight ? new Date(insight.generated_at).toLocaleDateString() : '';
            const driveVal = (student.drive_folder || '').replace(/"/g, '&quot;');
            const thisWeekVal = (student.this_week || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const emailVal = (student.email || '').replace(/"/g, '&quot;');
            const phoneVal = (student.phone || '').replace(/"/g, '&quot;');

            return `
            <div class="admin-course-card" style="margin-bottom:16px;padding:16px;">
                <h4 style="margin-bottom:2px;">${student.name || 'Unknown'}</h4>
                <p style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">joined ${new Date(student.created_at).toLocaleDateString()}</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div>
                        <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Email</label>
                        <input type="email" id="email_${student.id}" value="${emailVal}" placeholder="student@email.com"
                            style="width:100%;font-size:12px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Phone</label>
                        <input type="tel" id="phone_${student.id}" value="${phoneVal}" placeholder="+1 234 567 8900"
                            style="width:100%;font-size:12px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:80px 1fr;gap:8px;align-items:center;margin-bottom:8px;">
                    <div>
                        <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Type</label>
                        <select id="type_${student.id}" style="width:100%;font-size:12px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                            <option value="spanish" ${student.type==='spanish'?'selected':''}>Spanish</option>
                            <option value="music" ${student.type==='music'?'selected':''}>Music</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Google Drive Folder</label>
                        <input type="url" id="drive_${student.id}" value="${driveVal}" placeholder="https://drive.google.com/drive/folders/..."
                            style="width:100%;font-size:12px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">📌 This Week</label>
                    <textarea id="thisweek_${student.id}" placeholder="What should this student focus on this week? Homework, tips, next steps..."
                        style="width:100%;font-size:12px;padding:8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);resize:vertical;min-height:70px;line-height:1.5;">${thisWeekVal}</textarea>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="admin-btn small primary" onclick="saveStudentProfile('${student.id}')"><i class="fas fa-save"></i> Save</button>
                    <button class="admin-btn small" onclick="previewAsSpecificStudent('${student.id}')"><i class="fas fa-eye"></i> Preview</button>
                    <button class="admin-btn small" onclick="notifyStudentByEmail('${student.id}')" style="background:#f0fdf4;border-color:#86efac;color:#166534;"><i class="fas fa-envelope"></i> Notify via Email</button>
                </div>
                ${hasInsight ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:10px;">${preview} (${date})</p>` : ''}
            </div>`;
        }).join('');
    } catch(e) {
        container.innerHTML = `<p style="color:#dc2626;">Error loading students: ${e.message}</p>`;
    }
}

function notifyStudentByEmail(studentId) {
    const email = document.getElementById('email_' + studentId)?.value.trim() || '';
    const name = _studentCache[studentId]?.name || 'there';
    const thisWeek = document.getElementById('thisweek_' + studentId)?.value.trim() || '';
    if (!email) {
        alert('Add this student\'s email address first, then click Notify via Email.');
        return;
    }
    if (!thisWeek) {
        alert('Write a "This Week" message first, then click Notify via Email.');
        return;
    }
    const subject = encodeURIComponent('This week from Aaron — ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
    const body = encodeURIComponent(
        'Hi ' + name + ',\n\n' +
        thisWeek + '\n\n' +
        'You can find your full course and materials at:\nhttps://aaron-learning.com\n\n' +
        'See you soon,\nAaron'
    );
    window.open('mailto:' + email + '?subject=' + subject + '&body=' + body);
}

async function generateInsightForStudent(userId, studentName) {
    const apiKey = localStorage.getItem('anthropicApiKey');
    if (!apiKey) { alert('Add your Anthropic API key in Settings first.'); return; }

    showImportSuccess(`Generating insights for ${studentName}...`);

    // Fetch conversations for this student
    const conversations = await sbRpc('get_all_conversations_admin', {
        admin_secret: ADMIN_SECRET,
        p_user_id: userId
    });

    if (!Array.isArray(conversations) || conversations.length < 2) {
        alert(`${studentName} hasn't had enough AI practice conversations yet.`);
        return;
    }

    // Fetch existing insight (if any) for cumulative analysis
    const existingInsights = await sbRpc('get_all_insights_admin', { admin_secret: ADMIN_SECRET });
    const existing = Array.isArray(existingInsights)
        ? existingInsights.find(i => i.user_id === userId)
        : null;

    // Build conversation text
    const convText = conversations
        .map(c => `${c.role === 'user' ? studentName : 'AI'}: ${c.content}`)
        .join('\n');

    const previousInsight = existing?.insight_text
        ? `Previous cumulative insight (build on this, don't repeat it):\n${existing.insight_text}\n\n`
        : '';

    const prompt = `You are helping a Spanish teacher named Aaron understand how his student ${studentName} is progressing with AI conversation practice.

${previousInsight}New conversation transcripts to analyse:
${convText}

Please provide a cumulative teacher's insight report that:
1. Identifies the student's TOP 3 recurring grammatical or vocabulary mistakes with specific examples from the conversations
2. Notes any patterns in what they struggle with vs. what they're improving on
3. Suggests 2-3 specific things Aaron could focus on in their next lesson
4. Gives an overall progress note (be honest but encouraging)

Format clearly with headers. Be specific — quote actual mistakes from the transcripts. Keep the total report under 400 words.`;

    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 600,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        const data = await r.json();
        const insightText = data.content?.[0]?.text;
        if (!insightText) { alert('Could not generate insight. Check your API key.'); return; }

        // Save to Supabase
        await sbRpc('upsert_insight_admin', {
            admin_secret: ADMIN_SECRET,
            p_user_id: userId,
            p_insight: insightText,
            p_count: conversations.length
        });

        showImportSuccess(`Insights saved for ${studentName}!`);
        loadAdminStudents();

        // Show the result
        viewStudentInsightDirect(studentName, insightText, conversations.length);

    } catch(e) {
        alert('Error calling AI: ' + e.message);
    }
}

async function generateAllInsights() {
    const apiKey = localStorage.getItem('anthropicApiKey');
    if (!apiKey) { alert('Add your Anthropic API key in Settings first.'); return; }

    const profiles = await sbRpc('admin_list_profiles', { admin_secret: ADMIN_SECRET });
    if (!Array.isArray(profiles) || profiles.length === 0) { alert('No students yet.'); return; }

    for (const student of profiles) {
        await generateInsightForStudent(student.id, student.name);
    }
}

async function viewStudentInsight(userId, studentName) {
    const insights = await sbRpc('get_all_insights_admin', { admin_secret: ADMIN_SECRET });
    const insight = Array.isArray(insights) ? insights.find(i => i.user_id === userId) : null;
    if (!insight) return;
    viewStudentInsightDirect(studentName, insight.insight_text, insight.conversation_count);
}

function viewStudentInsightDirect(studentName, insightText, convCount) {
    document.getElementById('insightModalTitle').textContent = `${studentName} — AI Practice Insights`;
    document.getElementById('insightModalContent').innerHTML = `
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">${convCount} conversation turns analysed</p>
        <div style="font-size:14px;line-height:1.7;white-space:pre-wrap;">${insightText}</div>`;
    document.getElementById('studentInsightModal').classList.remove('hidden');
}

async function resetCoursesToDefaults() {
    if (!confirm('This will clear all saved course data and reload from defaults. Your videos will need to be re-added. Continue?')) return;
    localStorage.removeItem('coursesCatalog');
    // Delete from Supabase
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/courses_catalog?id=eq.catalog`, {
            method: 'DELETE',
            headers: _headers(_accessToken || SUPABASE_KEY)
        });
    } catch(e) {}
    _coursesCache = JSON.parse(JSON.stringify(defaultCourses));
    document.getElementById('adminSettingsOverlay').classList.add('hidden');
    showImportSuccess('Reset complete — reload the page to see the defaults.');
}

function loadAdminStudentsOverlay() {
    document.getElementById('adminStudentsOverlay').classList.remove('hidden');
    loadAdminStudents();
}

function openLessonPrep() {
    document.getElementById('lessonPrepOverlay').classList.remove('hidden');
    loadLessonPrep();
}

function openAdminCoursesOverlay() {
    document.getElementById('adminCoursesOverlay').classList.remove('hidden');
    renderAdminCourseList();
}

async function loadLessonPrep() {
    const container = document.getElementById('lessonPrepContent');
    container.innerHTML = '<p style="color:var(--text-secondary);">Loading summaries...</p>';
    try {
        const allRows = await sbRpc('admin_list_lesson_summaries', { admin_secret: ADMIN_SECRET });
        const rows = Array.isArray(allRows) ? allRows.slice(0, 30) : allRows;
        if (!rows || rows.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-secondary);">
                <i class="fas fa-brain" style="font-size:32px;margin-bottom:16px;display:block;opacity:0.3;"></i>
                <p>No lesson summaries yet.</p>
                <p style="font-size:13px;margin-top:8px;">The nightly agent will generate one after your next lesson.</p>
            </div>`;
            return;
        }
        const byStudent = {};
        rows.forEach(r => {
            if (!byStudent[r.student_name]) byStudent[r.student_name] = [];
            byStudent[r.student_name].push(r);
        });
        container.innerHTML = Object.entries(byStudent).map(([name, entries]) => {
            const latest = entries[0];
            const dateStr = new Date(latest.lesson_date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
            const older = entries.slice(1, 3);
            return `
            <div style="background:#fff;border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:24px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                    <div>
                        <h3 style="font-size:17px;font-weight:700;margin:0 0 4px;">${name}</h3>
                        <span style="font-size:12px;color:var(--text-secondary);">Last lesson: ${dateStr}</span>
                    </div>
                    <span style="background:#eff6ff;color:#2563eb;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Latest</span>
                </div>
                <div style="margin-bottom:16px;">
                    <h4 style="font-size:13px;font-weight:700;color:var(--accent-color);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;"><i class="fas fa-chalkboard-teacher" style="margin-right:6px;"></i>Lesson Plan</h4>
                    <p style="font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:inherit;">${latest.summary}</p>
                </div>
                ${latest.activities ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius-md);padding:20px;margin-top:4px;">
                    <h4 style="font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;"><i class="fas fa-home" style="margin-right:6px;"></i>Homework</h4>
                    <p style="font-size:14px;line-height:1.8;white-space:pre-wrap;font-family:inherit;">${latest.activities}</p>
                </div>` : ''}
                ${older.length > 0 ? `<details style="margin-top:16px;">
                    <summary style="font-size:13px;color:var(--text-secondary);cursor:pointer;">Show previous summaries</summary>
                    ${older.map(o => {
                        const d = new Date(o.lesson_date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
                        return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light);">
                            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${d}</p>
                            <p style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${o.summary}</p>
                        </div>`;
                    }).join('')}
                </details>` : ''}
            </div>`;
        }).join('');
    } catch(e) {
        container.innerHTML = `<p style="color:#dc2626;">Error loading summaries. Make sure the lesson_summaries table exists in Supabase.</p>`;
    }
}

function openSettingsOverlay() {
    const savedKey = localStorage.getItem('anthropicApiKey');
    if (savedKey) {
        document.getElementById('anthropicKeyInput').value = savedKey;
        document.getElementById('apiKeyStatus').innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> API key saved</span>';
    }
    document.getElementById('adminSettingsOverlay').classList.remove('hidden');
}

function previewAsSpecificStudent(studentId) {
    const s = _studentCache[studentId];
    if (!s) { alert('Student data not found. Reload the Students panel and try again.'); return; }
    // Store in sessionStorage so the new tab can read it
    sessionStorage.setItem('adminPreviewStudent', JSON.stringify({
        id: s.id,
        name: s.name || 'Student',
        type: s.type || 'spanish',
        driveFolder: s.drive_folder || '',
        thisWeek: s.this_week || '',
        isPreview: true
    }));
    window.open(window.location.href.split('?')[0] + '?preview=1', '_blank');
}

// Generic subject preview — doesn't need a real registered student, just
// opens the portal as a synthetic student of the given type in a new tab.
function previewAsSubject(subject) {
    sessionStorage.setItem('adminPreviewStudent', JSON.stringify({
        id: 'preview-' + subject,
        name: subject === 'music' ? 'Preview (Music)' : 'Preview (Spanish)',
        type: subject,
        driveFolder: '',
        thisWeek: '',
        isPreview: true
    }));
    window.open(window.location.href.split('?')[0] + '?preview=1', '_blank');
}

// ============================================================
// RESOURCES EDITOR
// ============================================================
let pendingMovies = [];
let _studentCache = {}; // cache for student preview

// Get a validated TMDB key (prompts once, then reuses). Returns null if unavailable.
async function getValidTmdbKey() {
    let key = (localStorage.getItem('tmdbApiKey') || '').trim();
    if (!key) {
        key = (prompt('One-time setup: paste your free TMDB API key.\n\nGet it at themoviedb.org → Settings → API → "API Key (v3 auth)" (a long letters/numbers string). After this, pasting IMDb links just works.') || '').trim();
        if (!key) return null;
    }
    try {
        const test = await fetch(`https://api.themoviedb.org/3/movie/550?api_key=${key}`);
        if (!test.ok) {
            localStorage.removeItem('tmdbApiKey');
            const body = await test.json().catch(() => ({}));
            alert(`That TMDB key didn't work (${body.status_message || 'invalid key'}). Make sure it's the "API Key (v3 auth)", then try again.`);
            return null;
        }
    } catch(e) {
        alert('Could not reach TMDB. Check your connection and try again.');
        return null;
    }
    localStorage.setItem('tmdbApiKey', key);
    return key;
}

// Paste an IMDb link → auto-fill title, year, poster, and add it to the list.
async function addFromImdbLink() {
    const input = document.getElementById('imdbQuickAdd');
    const category = document.getElementById('imdbQuickCategory').value;
    const raw = (input.value || '').trim();
    if (!raw) return;

    // Extract the tt ID from any IMDb URL or a bare ID
    const m = raw.match(/(tt\d{6,9})/);
    if (!m) {
        alert('That doesn\'t look like an IMDb link. It should contain something like tt1234567.');
        return;
    }
    const imdbId = m[1];

    const key = await getValidTmdbKey();
    if (!key) return;

    const btn = document.querySelector('button[onclick="addFromImdbLink()"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Looking up...';

    try {
        const r = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${key}&external_source=imdb_id`);
        const data = await r.json();
        const movie = (data.movie_results || [])[0];
        const tv = (data.tv_results || [])[0];
        const hit = movie || tv;

        if (!hit) {
            alert('Couldn\'t find that title on TMDB. You can add it manually instead.');
            btn.disabled = false; btn.innerHTML = orig;
            return;
        }

        const isTv = !!tv && !movie;
        const title = hit.title || hit.name || '';
        const dateStr = hit.release_date || hit.first_air_date || '';
        const year = dateStr ? parseInt(dateStr.slice(0,4)) : '';
        const poster = hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : '';

        pendingMovies.push({
            title,
            year,
            director: '',
            type: isTv ? 'tv' : 'movie',
            poster,
            url: `https://www.imdb.com/title/${imdbId}/`,
            category
        });

        renderMovieEditorList();
        input.value = '';
        btn.disabled = false;
        btn.innerHTML = orig;
    } catch(e) {
        alert('Something went wrong looking that up: ' + e.message);
        btn.disabled = false; btn.innerHTML = orig;
    }
}

async function autoFetchPosters() {
    let tmdbKey = (localStorage.getItem('tmdbApiKey') || '').trim();

    // Always re-prompt if no key, and validate it before trusting it
    if (!tmdbKey) {
        tmdbKey = (prompt('Paste your free TMDB API key.\n\nGet one at themoviedb.org → Settings → API → "API Key (v3 auth)". It is a long string of letters and numbers.') || '').trim();
        if (!tmdbKey) return;
    }

    const btn = document.getElementById('autoFetchPostersBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking key...';

    // Validate the key with a known movie (Fight Club, id 550) before doing anything
    try {
        const test = await fetch(`https://api.themoviedb.org/3/movie/550?api_key=${tmdbKey}`);
        if (!test.ok) {
            const body = await test.json().catch(() => ({}));
            btn.disabled = false; btn.innerHTML = original;
            localStorage.removeItem('tmdbApiKey');
            alert(`That TMDB key didn't work (error ${test.status}: ${body.status_message || 'invalid key'}).\n\nMake sure you copied the "API Key (v3 auth)" — a long letter/number string, NOT the longer "Read Access Token". Try again.`);
            return;
        }
    } catch(e) {
        btn.disabled = false; btn.innerHTML = original;
        alert('Could not reach TMDB. Check your internet connection and try again.');
        return;
    }

    // Key works — save it
    localStorage.setItem('tmdbApiKey', tmdbKey);

    let found = 0;
    const missed = [];
    for (let i = 0; i < pendingMovies.length; i++) {
        const movie = pendingMovies[i];
        if (!movie.title) continue;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i+1}/${pendingMovies.length}...`;

        try {
            const type = movie.type === 'tv' ? 'tv' : 'movie';
            const yearParam = movie.year ? (type === 'tv' ? `&first_air_date_year=${movie.year}` : `&year=${movie.year}`) : '';
            const url = `https://api.themoviedb.org/3/search/${type}?api_key=${tmdbKey}&query=${encodeURIComponent(movie.title)}${yearParam}`;
            const r = await fetch(url);
            const data = await r.json();
            const hit = (data.results || []).find(x => x.poster_path);
            if (hit) {
                pendingMovies[i].poster = `https://image.tmdb.org/t/p/w500${hit.poster_path}`;
                found++;
            } else {
                missed.push(movie.title);
            }
        } catch(e) { missed.push(movie.title); }
        await new Promise(res => setTimeout(res, 200));
    }

    renderMovieEditorList();
    btn.disabled = false;
    btn.innerHTML = original;
    let msg = `Found posters for ${found} of ${pendingMovies.length} titles.`;
    if (missed.length) msg += `\n\nCouldn't find: ${missed.join(', ')}. You can upload those manually.`;
    msg += `\n\n⚠️ Click SAVE to keep these posters.`;
    alert(msg);
}

function handleMoviePosterUpload(index, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500000) {
        alert('Image too large. Please use an image under 500KB.');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        pendingMovies[index].poster = e.target.result;
        renderMovieEditorList();
    };
    reader.readAsDataURL(file);
}

// ── Resources Editor ──────────────────────────────────────────
let pendingSections = [];

function getYoutubeThumbnail(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&\n?#]{8,})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function getLinkIcon(url) {
    if (/youtube\.com|youtu\.be/.test(url)) return 'fab fa-youtube';
    if (/instagram\.com/.test(url)) return 'fab fa-instagram';
    if (/spotify\.com/.test(url)) return 'fab fa-spotify';
    if (/twitter\.com|x\.com/.test(url)) return 'fab fa-twitter';
    if (/facebook\.com/.test(url)) return 'fab fa-facebook';
    if (/tiktok\.com/.test(url)) return 'fab fa-tiktok';
    return 'fas fa-link';
}

function switchResTab(tab) {
    const isSections = tab === 'sections';
    document.getElementById('resPanelSections').style.display = isSections ? '' : 'none';
    document.getElementById('resPanelMovies').style.display = isSections ? 'none' : '';
    document.getElementById('resTabSections').style.borderBottomColor = isSections ? 'var(--accent-color)' : 'transparent';
    document.getElementById('resTabSections').style.color = isSections ? 'var(--accent-color)' : 'var(--text-secondary)';
    document.getElementById('resTabMovies').style.borderBottomColor = isSections ? 'transparent' : 'var(--accent-color)';
    document.getElementById('resTabMovies').style.color = isSections ? 'var(--text-secondary)' : 'var(--accent-color)';
}

function openResourcesEditor() {
    const resources = getResources();

    // Deep copy sections
    pendingSections = JSON.parse(JSON.stringify(resources.sections || []));

    // Flatten movies
    pendingMovies = [];
    (resources.mediaContent?.categories || []).forEach(cat => {
        cat.items.forEach(item => pendingMovies.push({ ...item, category: cat.name }));
    });

    renderResSections();
    renderMovieEditorList();

    document.getElementById('resourcesEditorModal').classList.remove('hidden');
    switchResTab('sections');

    document.getElementById('addMovieBtn').onclick = () => {
        pendingMovies.push({ title: '', year: new Date().getFullYear(), director: '', type: 'movie', poster: '', url: '', category: 'Deep / Dark but Amazing' });
        renderMovieEditorList();
    };
    document.getElementById('saveResourcesBtn').onclick = saveResourcesEdit;
    document.getElementById('closeResourcesBtn').onclick = () => document.getElementById('resourcesEditorModal').classList.add('hidden');
}

function addResSection() {
    pendingSections.push({ title: 'New Section', icon: 'fas fa-link', links: [] });
    renderResSections();
}

function addResLink(sectionIdx) {
    pendingSections[sectionIdx].links.push({ label: '', url: '', icon: 'fas fa-link' });
    renderResSections();
}

function removeResSection(sectionIdx) {
    if (!confirm('Remove this section and all its links?')) return;
    pendingSections.splice(sectionIdx, 1);
    renderResSections();
}

function removeResLink(sectionIdx, linkIdx) {
    pendingSections[sectionIdx].links.splice(linkIdx, 1);
    renderResSections();
}

function updateResLink(sectionIdx, linkIdx, field, value) {
    pendingSections[sectionIdx].links[linkIdx][field] = value;
    // Auto-detect icon from URL
    if (field === 'url') {
        pendingSections[sectionIdx].links[linkIdx].icon = getLinkIcon(value);
    }
    renderResSections();
}

function renderResSections() {
    const container = document.getElementById('resSectionList');
    if (pendingSections.length === 0) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:24px;">No sections yet. Click "Add Section" to get started.</p>';
        return;
    }

    container.innerHTML = pendingSections.map((section, si) => `
        <div class="res-section-card">
            <div class="res-section-header">
                <i class="${section.icon || 'fas fa-link'}" style="color:var(--accent-color);font-size:13px;width:16px;text-align:center;flex-shrink:0;"></i>
                <input value="${escapeAttr(section.title)}"
                    oninput="pendingSections[${si}].title=this.value"
                    placeholder="Section title">
                <input value="${escapeAttr(section.icon || '')}"
                    oninput="pendingSections[${si}].icon=this.value;renderResSections()"
                    placeholder="fas fa-link"
                    style="width:130px;flex:none;font-size:11px;color:var(--text-secondary);border:1px solid var(--border-color);border-radius:4px;padding:3px 6px;background:#fff;">
                <button class="admin-btn small primary" onclick="addResLink(${si})" style="flex-shrink:0;white-space:nowrap;">
                    <i class="fas fa-plus"></i> Link
                </button>
                <button class="admin-btn small danger" onclick="removeResSection(${si})" style="flex-shrink:0;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="res-links-list">
                ${section.links.length === 0
                    ? `<p style="font-size:12px;color:var(--text-light);padding:6px 0;">No links yet — click + Link above.</p>`
                    : section.links.map((link, li) => {
                        const thumb = getYoutubeThumbnail(link.url || '');
                        const autoIcon = getLinkIcon(link.url || '');
                        return `
                        <div class="res-link-row">
                            <div class="res-link-thumb">
                                ${thumb
                                    ? `<img src="${thumb}" alt="" onerror="this.parentElement.innerHTML='<span class=\\"no-thumb\\"><i class=\\"${autoIcon}\\" style=\\"font-size:14px;color:#9ca3af;\\"></i></span>'">`
                                    : `<span class="no-thumb"><i class="${autoIcon}" style="font-size:14px;color:#9ca3af;"></i></span>`}
                            </div>
                            <input class="res-link-input" value="${escapeAttr(link.label)}"
                                oninput="pendingSections[${si}].links[${li}].label=this.value"
                                placeholder="Label">
                            <input class="res-link-input" type="url" value="${escapeAttr(link.url || '')}"
                                onblur="updateResLink(${si},${li},'url',this.value)"
                                placeholder="https://...">
                            <button class="admin-btn small danger" onclick="removeResLink(${si},${li})" style="padding:4px 8px;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>`;
                    }).join('')}
            </div>
        </div>
    `).join('');
}

function saveResourcesEdit() {
    const resources = getResources();

    // Save sections
    resources.sections = pendingSections;

    // Rebuild movie categories
    const categoryMap = {};
    pendingMovies.forEach(movie => {
        const cat = movie.category || 'Other';
        if (!categoryMap[cat]) categoryMap[cat] = [];
        const { category, ...item } = movie;
        categoryMap[cat].push(item);
    });
    if (resources.mediaContent) {
        resources.mediaContent.categories = Object.entries(categoryMap).map(([name, items]) => ({ name, items }));
    }

    saveResources(resources);
    document.getElementById('resourcesEditorModal').classList.add('hidden');
    populateResources();
    showImportSuccess('Resources saved!');
}

function renderMovieEditorList() {
    const container = document.getElementById('movieEditorList');
    if (!container) return;
    if (pendingMovies.length === 0) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:24px;">No films yet. Click + Add Film/Show.</p>';
        return;
    }
    container.innerHTML = pendingMovies.map((movie, i) => `
        <div class="admin-course-card" style="margin-bottom:10px;padding:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px;">Title</label>
                    <input type="text" value="${escapeAttr(movie.title)}" oninput="pendingMovies[${i}].title=this.value" placeholder="Film title">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px;">Category</label>
                    <input type="text" value="${escapeAttr(movie.category || '')}" oninput="pendingMovies[${i}].category=this.value" placeholder="e.g. Deep / Dark but Amazing">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px;">Director</label>
                    <input type="text" value="${escapeAttr(movie.director || '')}" oninput="pendingMovies[${i}].director=this.value" placeholder="Director name">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px;">Year</label>
                    <input type="number" value="${movie.year || ''}" oninput="pendingMovies[${i}].year=parseInt(this.value)" placeholder="2024">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px;">IMDb / Link URL</label>
                    <input type="url" value="${escapeAttr(movie.url || '')}" oninput="pendingMovies[${i}].url=this.value" placeholder="https://www.imdb.com/title/...">
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <select oninput="pendingMovies[${i}].type=this.value" style="padding:7px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:12px;">
                        <option value="movie" ${movie.type==='movie'?'selected':''}>Film</option>
                        <option value="tv" ${movie.type==='tv'?'selected':''}>TV</option>
                    </select>
                    <button class="admin-btn small danger" onclick="pendingMovies.splice(${i},1);renderMovieEditorList()"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function openImportModal() {
    document.getElementById('importJsonInput').value = '';
    document.getElementById('importError').classList.add('hidden');
    document.getElementById('importModal').classList.remove('hidden');
    document.getElementById('doImportBtn').onclick = doImport;
    document.getElementById('closeImportBtn').onclick = () => document.getElementById('importModal').classList.add('hidden');
}

function doImport() {
    const raw = document.getElementById('importJsonInput').value.trim();
    const errEl = document.getElementById('importError');
    errEl.classList.add('hidden');

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch(e) {
        errEl.textContent = 'Invalid JSON — check for missing commas, brackets, or quotes.';
        errEl.classList.remove('hidden');
        return;
    }

    const courses = getCourses();

    // Support three formats:
    // 1. Array of courses  → merge all
    // 2. Single course object (has .lessons) → merge one
    // 3. Lesson notes update (has .courseId + .lessonId + .content) → update one lesson

    if (Array.isArray(parsed)) {
        // Format 1: full courses array
        parsed.forEach(incomingCourse => mergeCourse(courses, incomingCourse));
        saveCourses(courses);
        document.getElementById('importModal').classList.add('hidden');
        renderAdminCourseList();
        showImportSuccess(`${parsed.length} course${parsed.length !== 1 ? 's' : ''} imported`);

    } else if (parsed.lessons !== undefined) {
        // Format 2: single course
        mergeCourse(courses, parsed);
        saveCourses(courses);
        document.getElementById('importModal').classList.add('hidden');
        renderAdminCourseList();
        showImportSuccess(`Course "${parsed.title}" imported`);

    } else if (parsed.courseId && parsed.lessonId && parsed.content !== undefined) {
        // Format 3: lesson notes update
        const course = courses.find(c => c.id === parsed.courseId);
        if (!course) {
            errEl.textContent = `Course ID "${parsed.courseId}" not found.`;
            errEl.classList.remove('hidden');
            return;
        }
        const lesson = course.lessons.find(l => l.id === parsed.lessonId);
        if (!lesson) {
            errEl.textContent = `Lesson ID "${parsed.lessonId}" not found in that course.`;
            errEl.classList.remove('hidden');
            return;
        }
        lesson.content = parsed.content;
        if (parsed.title) lesson.title = parsed.title;
        if (parsed.section !== undefined) lesson.section = parsed.section;
        if (parsed.videoUrl !== undefined) lesson.videoUrl = parsed.videoUrl;
        if (parsed.audioUrl !== undefined) lesson.audioUrl = parsed.audioUrl;
        if (parsed.quiz !== undefined) lesson.quiz = parsed.quiz;
        saveCourses(courses);
        document.getElementById('importModal').classList.add('hidden');
        renderAdminCourseList();
        showImportSuccess(`Lesson "${lesson.title}" updated`);

    } else {
        errEl.textContent = 'Unrecognised format. See the expected JSON structure in the docs.';
        errEl.classList.remove('hidden');
    }
}

function mergeCourse(courses, incomingCourse) {
    // Ensure required fields
    if (!incomingCourse.id) incomingCourse.id = 'course-' + Date.now();
    if (!incomingCourse.subject) incomingCourse.subject = 'spanish';
    if (!incomingCourse.lessons) incomingCourse.lessons = [];
    incomingCourse.lessons.forEach(l => { if (!l.id) l.id = 'lesson-' + Date.now() + Math.random(); });

    const existing = courses.find(c => c.id === incomingCourse.id);
    if (existing) {
        // Merge: update course fields and merge lessons
        Object.assign(existing, { ...incomingCourse, lessons: existing.lessons });
        incomingCourse.lessons.forEach(incomingLesson => {
            const existingLesson = existing.lessons.find(l => l.id === incomingLesson.id);
            if (existingLesson) {
                Object.assign(existingLesson, incomingLesson);
            } else {
                existing.lessons.push(incomingLesson);
            }
        });
    } else {
        courses.push(incomingCourse);
    }
}

function showImportSuccess(msg) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:99px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    banner.innerHTML = `<i class="fas fa-check"></i> ${msg}`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
}

function openExportModal() {
    const courses = getCourses();
    document.getElementById('exportJson').value = JSON.stringify(courses, null, 2);
    document.getElementById('exportModal').classList.remove('hidden');
}

function copyExportJson() {
    const ta = document.getElementById('exportJson');
    ta.select();
    document.execCommand('copy');
    const btn = document.getElementById('copyJsonBtn');
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy to Clipboard'; }, 2000);
}

// Wire up courses tab back buttons (called after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
    const backToCourses = document.getElementById('backToCourses');
    if (backToCourses) backToCourses.addEventListener('click', () => {
        document.getElementById('coursePlayerView').classList.add('hidden');
        document.getElementById('courseListView').classList.remove('hidden');
        currentCourseId = null;
        currentLessonId = null;
        renderCourseList();
    });
});

// Render courses when tab is clicked
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-tab') === 'courses') {
                const listView = document.getElementById('courseListView');
                const playerView = document.getElementById('coursePlayerView');
                if (listView) listView.classList.remove('hidden');
                if (playerView) playerView.classList.add('hidden');
                renderCourseList();
            }
        });
    });
});
