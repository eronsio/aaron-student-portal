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


// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

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

    // Voice recording (press & hold)
    aiRecordBtn.addEventListener('mousedown', startRecording);
    aiRecordBtn.addEventListener('mouseup', stopRecording);
    aiRecordBtn.addEventListener('mouseleave', stopRecording);
    aiRecordBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
    aiRecordBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

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

async function callAnthropicAPI(messages, systemPrompt) {
    const apiKey = localStorage.getItem('anthropicApiKey');
    if (!apiKey) {
        return '⚠️ Sin clave API — Aaron necesita añadir una clave de Anthropic en Admin → Settings.';
    }
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
                max_tokens: 250,
                system: systemPrompt,
                messages: messages.slice(-20)
            })
        });
        const data = await r.json();
        if (data.error) return `⚠️ Error: ${data.error.message}`;
        return data.content?.[0]?.text || '...';
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
// VOICE RECORDING
// ============================================================
async function startRecording() {
    if (isRecording) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Add voice message to chat
            addVoiceMessage(audioUrl);
        };

        mediaRecorder.start();
        isRecording = true;
        aiRecordBtn.classList.add('recording');
        aiRecordBtn.innerHTML = '<i class="fas fa-stop"></i>';

    } catch (err) {
        console.error('Mic access denied:', err);
        alert('Please allow microphone access to record voice messages.');
    }
}

function stopRecording() {
    if (!isRecording || !mediaRecorder) return;

    mediaRecorder.stop();
    isRecording = false;
    aiRecordBtn.classList.remove('recording');
    aiRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
}

async function addVoiceMessage(audioUrl) {
    if (!currentAiMode) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'ai-message ai-user';
    userMsg.innerHTML = `
        <div class="ai-bubble voice-bubble">
            <div class="voice-msg-label"><i class="fas fa-microphone"></i> Mensaje de voz</div>
            <audio controls src="${audioUrl}" preload="auto"></audio>
        </div>
        <div class="ai-avatar user-avatar"><i class="fas fa-user"></i></div>`;
    document.getElementById('aiChatMessages').appendChild(userMsg);
    document.getElementById('aiChatMessages').scrollTop = 99999;

    const voiceNote = '[El estudiante ha enviado un mensaje de voz en español]';
    aiConversationHistory.push({ role: 'user', content: voiceNote });
    saveConversationTurn('user', '[voice message]');

    const typing = appendAiMessage('bot', '<span class="typing-indicator"><span></span><span></span><span></span></span>');

    const systemPrompt = buildAISystemPrompt(currentAiMode, currentAiContext, studentInsightCache);
    const response = await callAnthropicAPI(aiConversationHistory, systemPrompt);

    aiConversationHistory.push({ role: 'assistant', content: response });
    saveConversationTurn('assistant', response);

    typing.remove();
    appendAiMessage('bot', response);
    speakText(response);
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
    return r.json();
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

    const profiles = await sbRpc('get_all_profiles_admin', { admin_secret: ADMIN_SECRET });
    if (!Array.isArray(profiles) || profiles.length === 0) { alert('No students yet.'); return; }

    for (const student of profiles) {
        await generateInsightForStudent(student.user_id, student.student_name);
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
