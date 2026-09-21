/* =========================================================
   INSTaLEARN
   Frontend prototype
   ========================================================= */


/* =========================================================
   FIREBASE AUTHENTICATION
   ========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyBY0ab8WtKSWWyeiTdKs-ppxRUr-XbRhUg",
    authDomain: "instalearn-d94a4.firebaseapp.com",
    projectId: "instalearn-d94a4",
    storageBucket: "instalearn-d94a4.firebasestorage.app",
    messagingSenderId: "820065915995",
    appId: "1:820065915995:web:86c8becdf208be60491b7e",
    measurementId: "G-1MB5SVLFVJ"
};

let auth;
try {
    if (typeof firebase === "undefined") {
        throw new Error("Firebase SDK script did not load (no internet / blocked CDN).");
    }
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
} catch (err) {
    // Don't let a failed/slow Firebase load kill the ENTIRE script.
    // Without this guard, one network hiccup would stop every function
    // below from ever being registered (navigation, chatbot, dark mode,
    // quizzes, etc. would all appear "dead" on screen).
    console.warn("InstaLearn: Firebase failed to initialize —", err.message || err);
}

function isValidGmail(email) {
    const gmailRegex = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@gmail\.com$/i;
    return gmailRegex.test(email.trim());
}


/* =========================================================
   EMAILJS (sends the security code to the user's real Gmail)
   ========================================================= */

// EmailJS credentials (from dashboard.emailjs.com)
const EMAILJS_PUBLIC_KEY = "xqJslFMbdgKdiH9al";
const EMAILJS_SERVICE_ID = "service_lugf14d";
const EMAILJS_TEMPLATE_ID = "template_usw501v";

// Set to false while developing/testing other features so you don't burn
// through the free monthly EmailJS quota (200/month). Set back to true
// for the actual demo so the code really gets emailed.
const EMAILJS_SEND_REAL_EMAILS = true;

const emailjsConfigured =
    EMAILJS_SEND_REAL_EMAILS &&
    EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY" &&
    EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID" &&
    EMAILJS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID";

if (emailjsConfigured && window.emailjs) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}


/* =========================================================
   PASSWORD STRENGTH METER
   ========================================================= */

function getPasswordStrength(password) {
    if (!password) return { score: 0, label: "" };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: "Weak" };
    if (score <= 3) return { score: 2, label: "Medium" };
    return { score: 3, label: "Strong" };
}

function updatePasswordStrength(inputId, meterId) {
    const input = document.getElementById(inputId);
    const meter = document.getElementById(meterId);
    if (!input || !meter) return;

    const bar = meter.querySelector(".password-strength-bar");
    const label = meter.querySelector(".password-strength-label");
    const { score, label: text } = getPasswordStrength(input.value);

    meter.classList.remove("hidden");
    bar.className = "password-strength-bar";
    if (score === 1) bar.classList.add("weak");
    if (score === 2) bar.classList.add("medium");
    if (score === 3) bar.classList.add("strong");

    label.textContent = input.value ? text : "";
}


/* =========================================================
   DARK MODE
   ========================================================= */

function applyDarkModePreference() {
    const enabled = localStorage.getItem("instaLearnDarkMode") === "true";
    document.body.classList.toggle("dark-theme", enabled);
    const toggle = document.getElementById("darkModeToggle");
    if (toggle) toggle.checked = enabled;
}

function toggleDarkMode() {
    const toggle = document.getElementById("darkModeToggle");
    const enabled = toggle ? toggle.checked : !document.body.classList.contains("dark-theme");
    document.body.classList.toggle("dark-theme", enabled);
    localStorage.setItem("instaLearnDarkMode", enabled ? "true" : "false");
}

function forceLightMode() {
    document.body.classList.remove("dark-theme");
}

// Dark mode is an account/app preference — it should only ever show
// once the student is actually inside the app. The welcome, login,
// register, and other pre-login pages always stay in light mode, so
// we deliberately do NOT auto-apply the saved preference on initial
// page load. It gets applied in loadApp() instead (see below), and
// cleared again on logout.


/* =========================================================
   LOGIN ATTEMPT LIMIT
   ========================================================= */

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 60;
let loginLockTimer = null;

function getLoginAttemptState(email) {
    try {
        const all = JSON.parse(localStorage.getItem("instaLearnLoginAttempts") || "{}");
        return all[email] || { count: 0, lockedUntil: 0 };
    } catch {
        return { count: 0, lockedUntil: 0 };
    }
}

function saveLoginAttemptState(email, state) {
    const all = JSON.parse(localStorage.getItem("instaLearnLoginAttempts") || "{}");
    all[email] = state;
    localStorage.setItem("instaLearnLoginAttempts", JSON.stringify(all));
}

function registerFailedLogin(email) {
    const state = getLoginAttemptState(email);
    state.count = (state.count || 0) + 1;

    if (state.count >= MAX_LOGIN_ATTEMPTS) {
        state.lockedUntil = Date.now() + LOGIN_LOCK_SECONDS * 1000;
        state.count = 0;
    }

    saveLoginAttemptState(email, state);
    return state;
}

function clearLoginAttempts(email) {
    saveLoginAttemptState(email, { count: 0, lockedUntil: 0 });
}

function isLoginLocked(email) {
    const state = getLoginAttemptState(email);
    return state.lockedUntil && state.lockedUntil > Date.now();
}

function startLoginLockCountdown(email) {
    const note = document.getElementById("loginLockNote");
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (!note || !submitBtn) return;

    clearInterval(loginLockTimer);

    const tick = () => {
        const state = getLoginAttemptState(email);
        const remaining = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));

        if (remaining <= 0) {
            clearInterval(loginLockTimer);
            note.classList.add("hidden");
            submitBtn.disabled = false;
            return;
        }

        note.classList.remove("hidden");
        note.textContent = `Too many failed attempts. Try again in ${remaining}s.`;
        submitBtn.disabled = true;
    };

    tick();
    loginLockTimer = setInterval(tick, 1000);
}


/* =========================================================
   AUTO-LOGOUT AFTER INACTIVITY
   ========================================================= */

const AUTO_LOGOUT_WARNING_AFTER_MS = 5 * 60 * 1000; // 5 min idle -> warning
const AUTO_LOGOUT_COUNTDOWN_SECONDS = 30;

let inactivityTimer = null;
let autoLogoutCountdownTimer = null;

function isInsideApp() {
    const appPage = document.getElementById("appPage");
    return appPage && appPage.classList.contains("active");
}

function resetInactivityTimer() {
    if (!isInsideApp()) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(showAutoLogoutWarning, AUTO_LOGOUT_WARNING_AFTER_MS);
}

function showAutoLogoutWarning() {
    if (!isInsideApp()) return;

    const overlay = document.getElementById("autoLogoutOverlay");
    const countdownEl = document.getElementById("autoLogoutCountdown");
    if (!overlay || !countdownEl) return;

    overlay.classList.remove("hidden");
    let secondsLeft = AUTO_LOGOUT_COUNTDOWN_SECONDS;
    countdownEl.textContent = secondsLeft;

    clearInterval(autoLogoutCountdownTimer);
    autoLogoutCountdownTimer = setInterval(() => {
        secondsLeft--;
        countdownEl.textContent = Math.max(0, secondsLeft);
        if (secondsLeft <= 0) {
            clearInterval(autoLogoutCountdownTimer);
            overlay.classList.add("hidden");
            forceLogout();
        }
    }, 1000);
}

function stayLoggedIn() {
    clearInterval(autoLogoutCountdownTimer);
    document.getElementById("autoLogoutOverlay")?.classList.add("hidden");
    resetInactivityTimer();
}

["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
});


/* =========================================================
   SECURITY CODE (email verification step before login,
   change password, or password reset go through)
   ========================================================= */

let pendingSecurityCode = null;
let pendingSecurityResolve = null;

function generateSecurityCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Sends the code to the user's real Gmail via EmailJS when it's configured.
// Falls back to showing the code on screen (clearly labeled) only if EmailJS
// isn't set up yet or the send fails, so the flow can still be demoed/tested.
function sendSecurityCodeTo(email) {
    pendingSecurityCode = generateSecurityCode();

    const demoNote = document.getElementById("securityCodeDemoNote");
    const demoValue = document.getElementById("securityCodeDemoValue");

    if (emailjsConfigured && window.emailjs) {

        if (demoNote) demoNote.classList.add("hidden");
        showToast(`Sending security code to ${email}...`);

        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            email: email,
            passcode: pendingSecurityCode,
            time: new Date(Date.now() + 15 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }).then(() => {
            showToast(`Security code sent to ${email}. Check your inbox.`);
        }).catch((err) => {
            console.error("EmailJS send failed:", err);
            if (demoValue) demoValue.textContent = pendingSecurityCode;
            if (demoNote) demoNote.classList.remove("hidden");
            showToast("Couldn't email the code — showing it here instead.");
        });

    } else {

        if (demoValue) demoValue.textContent = pendingSecurityCode;
        if (demoNote) demoNote.classList.remove("hidden");

        console.log(`[InstaLearn demo] Security code for ${email}: ${pendingSecurityCode}`);
        showToast(`Security code sent to ${email}.`);
    }
}

// Shows the modal and returns a Promise that resolves to true (verified)
// or false (cancelled). Call this before completing login, change password,
// or reset password.
function requestSecurityCode(email, message) {
    return new Promise((resolve) => {
        pendingSecurityResolve = resolve;

        const overlay = document.getElementById("securityCodeOverlay");
        const messageEl = document.getElementById("securityCodeMessage");
        const input = document.getElementById("securityCodeInput");

        if (messageEl) {
            messageEl.textContent = message || `We sent a 6-digit security code to ${email}. Enter it below to continue.`;
        }
        if (input) input.value = "";

        sendSecurityCodeTo(email);

        if (overlay) overlay.classList.remove("hidden");
        if (input) input.focus();
    });
}

function confirmSecurityCode() {
    const input = document.getElementById("securityCodeInput");
    const entered = input ? input.value.trim() : "";

    if (!entered) {
        showToast("Enter the security code.");
        return;
    }

    if (entered !== pendingSecurityCode) {
        showToast("Incorrect security code. Please try again.");
        return;
    }

    document.getElementById("securityCodeOverlay").classList.add("hidden");
    pendingSecurityCode = null;

    const resolve = pendingSecurityResolve;
    pendingSecurityResolve = null;
    if (resolve) resolve(true);
}

function resendSecurityCode() {
    const messageEl = document.getElementById("securityCodeMessage");
    const email = messageEl ? messageEl.textContent.match(/[\w.+-]+@gmail\.com/i)?.[0] : null;
    sendSecurityCodeTo(email || "your Gmail");
}

function cancelSecurityCode() {
    document.getElementById("securityCodeOverlay").classList.add("hidden");
    pendingSecurityCode = null;

    const resolve = pendingSecurityResolve;
    pendingSecurityResolve = null;
    if (resolve) resolve(false);
}


/* =========================================================
   TERMS & CONDITIONS MODAL
   ========================================================= */

function openTerms(event) {
    if (event) event.preventDefault();
    const overlay = document.getElementById("termsOverlay");
    if (overlay) overlay.classList.remove("hidden");
}

function closeTerms() {
    const overlay = document.getElementById("termsOverlay");
    if (overlay) overlay.classList.add("hidden");
}

function closeTermsOnBackdrop(event) {
    if (event.target.id === "termsOverlay") closeTerms();
}


/* =========================================================
   BACK TO TOP (mobile navigation)
   ========================================================= */

function scrollPageToTop() {
    const activePage = document.querySelector(".page.active");
    if (activePage && activePage.scrollTop > 0) {
        activePage.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupBackToTopButton() {
    const btn = document.getElementById("backToTopBtn");
    if (!btn) return;

    const toggleVisibility = () => {
        const scrolled = window.scrollY || document.documentElement.scrollTop || 0;
        if (scrolled > 250) {
            btn.classList.remove("hidden");
        } else {
            btn.classList.add("hidden");
        }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    document.addEventListener("scroll", (e) => {
        if (e.target && e.target.classList && e.target.classList.contains("page")) {
            toggleVisibility();
        }
    }, true);

    toggleVisibility();
}

document.addEventListener("DOMContentLoaded", setupBackToTopButton);

function firebaseErrorMessage(error) {
    const code = error?.code || "";

    switch (code) {
        case "auth/email-already-in-use":
            return "This Gmail is already registered. Please log in instead.";
        case "auth/invalid-email":
            return "Please enter a valid Gmail address.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect Gmail or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Please wait a while and try again.";
        case "auth/unauthorized-domain":
            return "This website address is not authorized in Firebase. Add 127.0.0.1 to Firebase Authorized Domains.";
        case "auth/requires-recent-login":
            return "For security, please log in again before changing your password.";
        case "auth/user-disabled":
            return "This account has been disabled. Please contact the administrator.";
        case "auth/operation-not-allowed":
            return "Email/password sign-in is not enabled in Firebase Authentication.";
        case "auth/network-request-failed":
            return "Network error. Check your internet connection and try again.";
        case "auth/invalid-verification-code":
        case "auth/expired-action-code":
            return "This email action link is invalid or expired. Request a new email.";
        default:
            return error?.message || "Something went wrong. Please try again.";
    }
}

/* ================= DATA ================= */

let subjectFilter = "all";
let lastWrongQuestions = [];

const subjects = {
    math: {
        name: "Mathematics",
        icon: "🔢",
        description: "Build your mathematical skills through practice.",
        topics: ["Arithmetic", "Fractions", "Algebra", "Geometry", "Statistics"], level: "Beginner → Advanced", category: "Core", outcomes: "Numbers, equations, shapes & data", time: "15–25 min"
    },

    science: {
        name: "Science",
        icon: "🔬",
        description: "Explore the world through science.",
        topics: ["Biology", "Physics", "Chemistry", "Earth Science", "Space"], level: "Beginner → Advanced", category: "Core", outcomes: "Living things, matter & energy", time: "15–25 min"
    },

    english: {
        name: "English",
        icon: "📚",
        description: "Improve your grammar, vocabulary and communication.",
        topics: ["Grammar", "Vocabulary", "Reading", "Writing", "Communication"], level: "Beginner → Advanced", category: "Language", outcomes: "Grammar, reading & communication", time: "10–20 min"
    },

    computer: {
        name: "Computer",
        icon: "💻",
        description: "Learn computer and technology fundamentals.",
        topics: ["Programming", "Hardware", "Software", "Networking", "Internet"], level: "Beginner → Advanced", category: "Technology", outcomes: "Programming & digital fundamentals", time: "15–30 min"
    },

    history: {
        name: "History",
        icon: "🏛️",
        description: "Discover important events from the past.",
        topics: ["World History", "Philippine History", "Civilizations", "Culture", "Politics"], level: "Beginner → Advanced", category: "Humanities", outcomes: "Events, people & civilizations", time: "15–25 min"
    },

    geography: {
        name: "Geography",
        icon: "🌎",
        description: "Explore countries, places and our planet.",
        topics: ["Countries", "Maps", "Climate", "Landforms", "Population"], level: "Beginner → Advanced", category: "Humanities", outcomes: "Maps, places, climate & people", time: "15–25 min"
    }
};


/* ================= LEARNING LESSONS ================= */

const learningLessons = {
    math: {
        intro: "Build confidence with numbers, patterns and problem solving.",
        lessons: [
            ["Arithmetic", "Review addition, subtraction, multiplication and division. Work carefully from left to right and check your result.", "Tip: Estimate the answer first so you can catch mistakes quickly.", "Example: 48 + 27 → estimate ~75, then compute exactly: 48 + 27 = 75. Matches the estimate, so it's likely correct."],
            ["Fractions", "A fraction represents part of a whole. The numerator is on top and the denominator is on the bottom.", "Tip: To add fractions with different denominators, first find a common denominator.", "Example: 1/4 + 1/6 → common denominator 12 → 3/12 + 2/12 = 5/12."],
            ["Algebra", "Algebra uses letters to represent unknown values. Solve equations by doing the same operation to both sides.", "Tip: Isolate the variable one step at a time.", "Example: 2x + 5 = 17 → subtract 5 from both sides: 2x = 12 → divide by 2: x = 6."],
            ["Geometry", "Geometry studies shapes, angles, area and perimeter. Use the correct formula for each shape.", "Tip: Draw the shape and label the measurements before calculating.", "Example: A rectangle 8cm by 5cm has area = 8 × 5 = 40 cm², and perimeter = 2(8 + 5) = 26 cm."],
            ["Statistics", "Statistics helps you understand data using measures such as mean, median, mode and range.", "Tip: Sort the values first when finding the median.", "Example: Data set {4, 8, 6, 2, 10} → sorted: {2, 4, 6, 8, 10} → mean = 30/5 = 6, median = 6."]
        ]
    },
    science: {
        intro: "Explore living things, matter, energy and the world around you.",
        lessons: [
            ["Biology", "Biology studies living things, including cells, organisms and ecosystems.", "Tip: Remember that the cell is the basic unit of life.", "Example: A plant cell has a cell wall and chloroplasts for photosynthesis; an animal cell does not."],
            ["Physics", "Physics explains motion, forces, energy and how objects interact.", "Tip: Always identify the known values before choosing a formula.", "Example: Speed = distance ÷ time. A car traveling 150 km in 3 hours has a speed of 150 ÷ 3 = 50 km/h."],
            ["Chemistry", "Chemistry studies matter and the changes that happen when substances interact.", "Tip: Learn common symbols and formulas before balancing equations.", "Example: Water is H₂O — 2 hydrogen atoms bonded to 1 oxygen atom."],
            ["Earth Science", "Earth science covers rocks, weather, oceans and the processes that shape our planet.", "Tip: Connect each process to what you can observe in the real world.", "Example: The water cycle: evaporation → condensation → precipitation → collection, then it repeats."],
            ["Space", "Astronomy explores stars, planets, moons, galaxies and the universe.", "Tip: Compare objects by size, distance and composition to remember them.", "Example: Earth completes one orbit around the Sun in about 365.25 days — that's why we have a leap year every 4 years."]
        ]
    },
    english: {
        intro: "Strengthen grammar, vocabulary, reading and communication skills.",
        lessons: [
            ["Grammar", "Grammar gives structure to sentences through parts of speech, verb tense and sentence patterns.", "Tip: Read your sentence aloud to spot missing or awkward words.", "Example: \"She go to school\" is incorrect; the correct subject-verb agreement is \"She goes to school.\""],
            ["Vocabulary", "Vocabulary is the collection of words you understand and can use effectively.", "Tip: Learn a new word in a sentence instead of memorizing it alone.", "Example: \"Meticulous\" means very careful and precise — \"She is meticulous about checking her work for errors.\""],
            ["Reading", "Good reading means identifying the main idea, supporting details, tone and purpose.", "Tip: Ask yourself what the author wants you to understand.", "Example: If a passage lists effects of pollution and ends with a call to act, the purpose is likely persuasive, not just informative."],
            ["Writing", "Strong writing has a clear idea, organized paragraphs and evidence that supports the message.", "Tip: Outline your main points before writing the full paragraph.", "Example: Topic sentence → supporting detail → example → concluding sentence is a simple, reliable paragraph structure."],
            ["Communication", "Effective communication is clear, respectful and appropriate for the audience and situation.", "Tip: Think about your audience before choosing your words.", "Example: Explaining a topic to a classmate vs. a teacher — same idea, but simpler words and tone for a classmate."]
        ]
    },
    computer: {
        intro: "Learn the foundations of computers, software and programming.",
        lessons: [
            ["Programming", "Programming means giving a computer precise instructions using a programming language.", "Tip: Break a large problem into small steps before writing code.", "Example: To find the largest of 3 numbers, compare them two at a time instead of trying to do it all in one step."],
            ["Hardware", "Hardware is the physical part of a computer, such as the CPU, RAM, storage and input devices.", "Tip: Think of RAM as short-term working space and storage as long-term space.", "Example: Closing an app clears it from RAM, but files saved to storage (like a hard drive) remain even after shutdown."],
            ["Software", "Software is the collection of programs and instructions that tell hardware what to do.", "Tip: An operating system manages hardware and provides a platform for applications.", "Example: Windows, macOS, and Android are operating systems; Chrome and Word are applications that run on top of them."],
            ["Networking", "Computer networks connect devices so they can communicate and share resources.", "Tip: A router directs traffic between networks.", "Example: When you connect to Wi-Fi at home, your router directs your device's requests to and from the internet."],
            ["Internet", "The internet is a global network of connected devices that communicate using standard protocols.", "Tip: A website is accessed through a browser using web technologies such as HTTP and DNS.", "Example: Typing \"google.com\" triggers DNS to find Google's server address, then your browser loads the page over HTTP/HTTPS."]
        ]
    },
    history: {
        intro: "Understand important events, civilizations and ideas that shaped societies.",
        lessons: [
            ["World History", "World history studies major events, movements and interactions among societies across time.", "Tip: Build a timeline to connect events and their causes.", "Example: World War I (1914–1918) led to political changes that contributed to the causes of World War II."],
            ["Philippine History", "Philippine history covers the development of the islands and their people before, during and after colonization.", "Tip: Separate events by period so dates and causes are easier to remember.", "Example: The Philippine Revolution began in 1896, leading to the declaration of independence on June 12, 1898."],
            ["Civilizations", "Civilizations develop organized societies with institutions, culture, technology and systems of government.", "Tip: Compare civilizations by government, economy, religion and technology.", "Example: Ancient Egypt developed a strong central government and writing system (hieroglyphics) to manage its society."],
            ["Culture", "Culture includes beliefs, traditions, language, arts and practices shared by a community.", "Tip: Culture changes as people interact and adapt over time.", "Example: Filipino cuisine reflects cultural blending — adobo shows indigenous, Spanish, and Chinese culinary influences."],
            ["Politics", "Politics involves how groups make decisions, distribute power and govern society.", "Tip: Identify who has power, how it is obtained and how it is limited.", "Example: In a democracy, power comes from elections, and it is limited by a constitution and separation of powers."]
        ]
    },
    geography: {
        intro: "Explore places, people, climate and the physical features of our planet.",
        lessons: [
            ["Countries", "Countries are political territories with governments, populations and defined boundaries.", "Tip: Use maps to connect country names with their regions and neighbors.", "Example: The Philippines is an archipelago in Southeast Asia made up of over 7,000 islands."],
            ["Maps", "Maps represent places visually and use symbols, scale and directions to communicate geographic information.", "Tip: Check the legend and scale before interpreting a map.", "Example: If a map scale shows 1 cm = 10 km, a distance of 3 cm on the map represents 30 km in real life."],
            ["Climate", "Climate describes long-term patterns of temperature and precipitation in a place.", "Tip: Do not confuse climate, which is long-term, with daily weather.", "Example: The Philippines has a tropical climate with a wet and dry season, even though daily weather can vary."],
            ["Landforms", "Landforms are natural physical features such as mountains, plains, valleys and plateaus.", "Tip: Picture the elevation and shape of the land to distinguish them.", "Example: Mount Apo, the highest mountain in the Philippines, is a landform shaped by volcanic activity."],
            ["Population", "Population geography studies where people live, how many people live there and how populations change.", "Tip: Look at density, migration and birth/death rates together.", "Example: Metro Manila has a very high population density because many people migrate there for jobs and education."]
        ]
    }
};


/* ================= QUIZ DATA ================= */

const quizQuestions = {

    math: {

        Easy: [
            {
                question: "What is 1 + 1?",
                options: ["1", "2", "3", "4"],
                answer: 1
            },
            {
                question: "What is 5 + 3?",
                options: ["6", "7", "8", "9"],
                answer: 2
            },
            {
                question: "What is 10 - 4?",
                options: ["5", "6", "7", "8"],
                answer: 1
            },
            {
                question: "What is 2 × 3?",
                options: ["5", "6", "7", "8"],
                answer: 1
            },
            {
                question: "What is 20 ÷ 4?",
                options: ["4", "5", "6", "8"],
                answer: 1
            },
            {
                question: "What is 7 + 2?",
                options: ["8", "9", "10", "11"],
                answer: 1
            },
            {
                question: "What is 12 - 5?",
                options: ["6", "7", "8", "9"],
                answer: 1
            },
            {
                question: "What is 3 × 4?",
                options: ["10", "11", "12", "13"],
                answer: 2
            },
            {
                question: "What is 15 ÷ 3?",
                options: ["3", "4", "5", "6"],
                answer: 2
            },
            {
                question: "What is 9 + 6?",
                options: ["14", "15", "16", "17"],
                answer: 1
            }
        ],

        Medium: [
            {
                question: "What is 12 × 5?",
                options: ["50", "55", "60", "65"],
                answer: 2
            },
            {
                question: "What is 144 ÷ 12?",
                options: ["10", "11", "12", "14"],
                answer: 2
            },
            {
                question: "What is 25% of 80?",
                options: ["10", "15", "20", "25"],
                answer: 2
            },
            {
                question: "What is 15²?",
                options: ["125", "200", "225", "250"],
                answer: 2
            },
            {
                question: "What is 3/4 as a decimal?",
                options: ["0.25", "0.5", "0.75", "1"],
                answer: 2
            },
            {
                question: "If x + 7 = 15, what is x?",
                options: ["6", "7", "8", "9"],
                answer: 2
            },
            {
                question: "What is 20% of 150?",
                options: ["20", "25", "30", "35"],
                answer: 2
            },
            {
                question: "What is 8 × 9?",
                options: ["64", "72", "81", "88"],
                answer: 1
            },
            {
                question: "What is the perimeter of a square with side 5?",
                options: ["10", "15", "20", "25"],
                answer: 2
            },
            {
                question: "What is 2³?",
                options: ["4", "6", "8", "9"],
                answer: 2
            }
        ],

        Hard: [
            {
                question: "Solve: 3x + 6 = 21",
                options: ["3", "4", "5", "6"],
                answer: 2
            },
            {
                question: "What is √144?",
                options: ["10", "11", "12", "14"],
                answer: 2
            },
            {
                question: "What is 15% of 240?",
                options: ["24", "30", "36", "40"],
                answer: 2
            },
            {
                question: "What is the area of a circle with radius 2 using π ≈ 3.14?",
                options: ["6.28", "12.56", "15.70", "25.12"],
                answer: 1
            },
            {
                question: "Solve: 2x - 8 = 14",
                options: ["9", "10", "11", "12"],
                answer: 2
            },
            {
                question: "What is 5³?",
                options: ["25", "75", "100", "125"],
                answer: 3
            },
            {
                question: "What is 7/8 as a decimal?",
                options: ["0.625", "0.75", "0.875", "0.925"],
                answer: 2
            },
            {
                question: "If 4x = 48, what is x?",
                options: ["10", "11", "12", "14"],
                answer: 2
            },
            {
                question: "What is 18²?",
                options: ["324", "328", "342", "361"],
                answer: 0
            },
            {
                question: "What is the average of 10, 20 and 30?",
                options: ["15", "20", "25", "30"],
                answer: 1
            }
        ]
    },


    science: {

        Easy: [
            {
                question: "What planet do we live on?",
                options: ["Mars", "Earth", "Venus", "Jupiter"],
                answer: 1
            },
            {
                question: "What gas do humans need to breathe?",
                options: ["Oxygen", "Carbon dioxide", "Hydrogen", "Helium"],
                answer: 0
            },
            {
                question: "How many legs does an insect have?",
                options: ["4", "6", "8", "10"],
                answer: 1
            },
            {
                question: "What is H₂O commonly known as?",
                options: ["Salt", "Water", "Oxygen", "Hydrogen"],
                answer: 1
            },
            {
                question: "Which organ pumps blood?",
                options: ["Brain", "Lungs", "Heart", "Kidney"],
                answer: 2
            },
            {
                question: "What force pulls objects toward Earth?",
                options: ["Gravity", "Light", "Sound", "Heat"],
                answer: 0
            },
            {
                question: "Which star is closest to Earth?",
                options: ["Sirius", "The Sun", "Polaris", "Vega"],
                answer: 1
            },
            {
                question: "What do plants use to make food?",
                options: ["Photosynthesis", "Digestion", "Respiration", "Evaporation"],
                answer: 0
            },
            {
                question: "What is the largest planet?",
                options: ["Earth", "Mars", "Jupiter", "Venus"],
                answer: 2
            },
            {
                question: "Which sense uses the eyes?",
                options: ["Hearing", "Touch", "Sight", "Taste"],
                answer: 2
            }
        ],

        Medium: [
            {
                question: "What is the center of an atom called?",
                options: ["Electron", "Nucleus", "Molecule", "Cell"],
                answer: 1
            },
            {
                question: "Which organ is mainly responsible for breathing?",
                options: ["Heart", "Liver", "Lungs", "Stomach"],
                answer: 2
            },
            {
                question: "What is the process by which plants release water vapor?",
                options: ["Transpiration", "Digestion", "Condensation", "Freezing"],
                answer: 0
            },
            {
                question: "Which blood cells fight infection?",
                options: ["Red blood cells", "White blood cells", "Platelets", "Plasma"],
                answer: 1
            },
            {
                question: "What is the chemical symbol for gold?",
                options: ["Ag", "Au", "Gd", "Go"],
                answer: 1
            },
            {
                question: "Which planet is known as the Red Planet?",
                options: ["Mars", "Mercury", "Saturn", "Neptune"],
                answer: 0
            },
            {
                question: "What is the boiling point of water at sea level?",
                options: ["50°C", "75°C", "100°C", "150°C"],
                answer: 2
            },
            {
                question: "What type of energy comes from the Sun?",
                options: ["Solar", "Nuclear only", "Sound", "Chemical only"],
                answer: 0
            },
            {
                question: "Which part of the cell contains genetic material?",
                options: ["Nucleus", "Wall", "Membrane", "Cytoplasm"],
                answer: 0
            },
            {
                question: "What is the basic unit of life?",
                options: ["Atom", "Cell", "Organ", "Tissue"],
                answer: 1
            }
        ],

        Hard: [
            {
                question: "What is the powerhouse of the cell?",
                options: ["Nucleus", "Ribosome", "Mitochondria", "Vacuole"],
                answer: 2
            },
            {
                question: "What is Newton's first law commonly called?",
                options: ["Law of Inertia", "Law of Gravity", "Law of Motion", "Law of Energy"],
                answer: 0
            },
            {
                question: "What is the approximate speed of light?",
                options: ["3 × 10⁶ m/s", "3 × 10⁸ m/s", "3 × 10¹⁰ m/s", "3 × 10⁴ m/s"],
                answer: 1
            },
            {
                question: "What is the pH of a neutral solution?",
                options: ["0", "5", "7", "14"],
                answer: 2
            },
            {
                question: "Which particle has a negative charge?",
                options: ["Proton", "Neutron", "Electron", "Nucleus"],
                answer: 2
            },
            {
                question: "What molecule carries genetic instructions?",
                options: ["DNA", "ATP", "H₂O", "CO₂"],
                answer: 0
            },
            {
                question: "What is acceleration?",
                options: [
                    "Change in velocity over time",
                    "Distance only",
                    "Mass divided by volume",
                    "Force only"
                ],
                answer: 0
            },
            {
                question: "Which gas is most abundant in Earth's atmosphere?",
                options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
                answer: 1
            },
            {
                question: "What is the SI unit of force?",
                options: ["Joule", "Watt", "Newton", "Pascal"],
                answer: 2
            },
            {
                question: "Which process converts glucose into usable cellular energy?",
                options: ["Photosynthesis", "Cellular respiration", "Transpiration", "Osmosis"],
                answer: 1
            }
        ]
    },


    english: {

        Easy: [
            {
                question: "Which word is a noun?",
                options: ["Run", "Beautiful", "Teacher", "Quickly"],
                answer: 2
            },
            {
                question: "What is the opposite of 'hot'?",
                options: ["Warm", "Cold", "Dry", "Bright"],
                answer: 1
            },
            {
                question: "Which is a pronoun?",
                options: ["John", "Beautiful", "They", "Running"],
                answer: 2
            },
            {
                question: "Choose the correct spelling.",
                options: ["Beautifull", "Beautiful", "Beutiful", "Beautifol"],
                answer: 1
            },
            {
                question: "What is the plural of 'child'?",
                options: ["Childs", "Children", "Childes", "Childrens"],
                answer: 1
            },
            {
                question: "Which word is an adjective?",
                options: ["Quickly", "Beautiful", "Run", "Happiness"],
                answer: 1
            },
            {
                question: "Which sentence is correct?",
                options: [
                    "She are happy.",
                    "She is happy.",
                    "She am happy.",
                    "She be happy."
                ],
                answer: 1
            },
            {
                question: "What is the opposite of 'early'?",
                options: ["Fast", "Late", "Soon", "Quick"],
                answer: 1
            },
            {
                question: "Which is a verb?",
                options: ["Jump", "Blue", "Chair", "Slowly"],
                answer: 0
            },
            {
                question: "Which punctuation ends a question?",
                options: [".", ",", "!", "?"],
                answer: 3
            }
        ],

        Medium: [
            {
                question: "Choose the correct sentence.",
                options: [
                    "He don't like apples.",
                    "He doesn't like apples.",
                    "He doesn't likes apples.",
                    "He not like apples."
                ],
                answer: 1
            },
            {
                question: "What is a synonym for 'happy'?",
                options: ["Sad", "Joyful", "Angry", "Tired"],
                answer: 1
            },
            {
                question: "What is an antonym of 'ancient'?",
                options: ["Old", "Historic", "Modern", "Past"],
                answer: 2
            },
            {
                question: "Which tense is 'I have eaten'?",
                options: ["Simple past", "Present perfect", "Future", "Present continuous"],
                answer: 1
            },
            {
                question: "Which word is an adverb?",
                options: ["Quickly", "Quick", "Quickness", "Quicker"],
                answer: 0
            },
            {
                question: "Choose the correct article: '___ apple'.",
                options: ["A", "An", "Thee", "No article"],
                answer: 1
            },
            {
                question: "Which sentence uses a preposition?",
                options: [
                    "The book is on the table.",
                    "She runs quickly.",
                    "They laughed.",
                    "He is happy."
                ],
                answer: 0
            },
            {
                question: "What does 'generous' mean?",
                options: [
                    "Willing to give",
                    "Very angry",
                    "Unable to speak",
                    "Very quiet"
                ],
                answer: 0
            },
            {
                question: "Which word is a conjunction?",
                options: ["And", "Quickly", "Beautiful", "House"],
                answer: 0
            },
            {
                question: "Choose the correct form: 'They ___ studying.'",
                options: ["is", "am", "are", "be"],
                answer: 2
            }
        ],

        Hard: [
            {
                question: "Which sentence uses a passive voice?",
                options: [
                    "The boy kicked the ball.",
                    "The ball was kicked by the boy.",
                    "The boy is kicking.",
                    "The boy kicks well."
                ],
                answer: 1
            },
            {
                question: "What is a metaphor?",
                options: [
                    "A direct comparison without like/as",
                    "A question",
                    "A command",
                    "A factual statement"
                ],
                answer: 0
            },
            {
                question: "Which is an example of irony?",
                options: [
                    "A fire station catches fire.",
                    "The sun is bright.",
                    "She ate lunch.",
                    "He went home."
                ],
                answer: 0
            },
            {
                question: "What does 'ambiguous' mean?",
                options: [
                    "Having one clear meaning",
                    "Having more than one possible meaning",
                    "Very loud",
                    "Extremely old"
                ],
                answer: 1
            },
            {
                question: "Which is a complex sentence?",
                options: [
                    "I went home.",
                    "I went home, and I slept.",
                    "Because it rained, we stayed inside.",
                    "Run!"
                ],
                answer: 2
            },
            {
                question: "What is the main purpose of a thesis statement?",
                options: [
                    "Introduce the main argument",
                    "End an essay",
                    "List references",
                    "Add decoration"
                ],
                answer: 0
            },
            {
                question: "Which word is closest to 'contemplate'?",
                options: ["Ignore", "Think deeply", "Run", "Forget"],
                answer: 1
            },
            {
                question: "What is personification?",
                options: [
                    "Giving human qualities to non-human things",
                    "Repeating a word",
                    "Using a question",
                    "Comparing numbers"
                ],
                answer: 0
            },
            {
                question: "Which is grammatically correct?",
                options: [
                    "Neither of them are ready.",
                    "Neither of them is ready.",
                    "Neither them is ready.",
                    "Neither are them ready."
                ],
                answer: 1
            },
            {
                question: "What is a rhetorical question?",
                options: [
                    "A question asked without expecting an answer",
                    "A question in a test",
                    "A mathematical question",
                    "A question with two answers"
                ],
                answer: 0
            }
        ]
    },

    computer: {
        Easy: [
            {question: "What part of a computer is often called the brain?", options: ["Monitor", "CPU", "Keyboard", "Mouse"], answer: 1},
            {question: "Which device is mainly used to type text?", options: ["Keyboard", "Speaker", "Monitor", "Router"], answer: 0},
            {question: "Which device displays visual output?", options: ["CPU", "RAM", "Monitor", "Microphone"], answer: 2},
            {question: "What does USB commonly connect?", options: ["Computer peripherals", "Only televisions", "Only batteries", "Only routers"], answer: 0},
            {question: "Which is an operating system?", options: ["Windows", "Google", "YouTube", "Wi-Fi"], answer: 0},
            {question: "What does RAM provide?", options: ["Temporary working memory", "Permanent paper storage", "Internet service", "Power only"], answer: 0},
            {question: "Which is a web browser?", options: ["Chrome", "Python", "Windows", "Bluetooth"], answer: 0},
            {question: "What is software?", options: ["Physical computer parts", "Programs and instructions", "A power cable", "A desk"], answer: 1},
            {question: "Which device is used to move a pointer?", options: ["Mouse", "Printer", "Speaker", "Scanner"], answer: 0},
            {question: "What is a file?", options: ["A stored collection of data", "A computer screen", "A keyboard key", "A power outlet"], answer: 0}
        ],
        Medium: [
            {question: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Power Utility", "Central Program User", "Control Processing User"], answer: 0},
            {question: "Which memory is volatile?", options: ["RAM", "SSD", "HDD", "USB drive"], answer: 0},
            {question: "What is an IP address used for?", options: ["Identifying a device/interface on a network", "Printing documents", "Cooling a CPU", "Editing images"], answer: 0},
            {question: "What does DNS help translate?", options: ["Domain names to IP addresses", "Images to videos", "RAM to storage", "USB to HDMI"], answer: 0},
            {question: "Which is a programming language?", options: ["Python", "Chrome", "Ethernet", "Windows Explorer"], answer: 0},
            {question: "What does an algorithm describe?", options: ["A step-by-step procedure", "A physical cable", "A monitor setting", "A password"], answer: 0},
            {question: "Which protocol is commonly used to load websites securely?", options: ["HTTPS", "FTP only", "RAM", "HDMI"], answer: 0},
            {question: "What is a database used for?", options: ["Organizing and storing data", "Cooling hardware", "Displaying pixels", "Generating electricity"], answer: 0},
            {question: "What is debugging?", options: ["Finding and fixing program errors", "Deleting all files", "Installing a monitor", "Creating a network cable"], answer: 0},
            {question: "What is cloud computing?", options: ["Using remote computing resources over a network", "Using only offline software", "A type of keyboard", "A monitor technology"], answer: 0}
        ],
        Hard: [
            {question: "Which data structure follows LIFO?", options: ["Queue", "Stack", "Tree", "Graph"], answer: 1},
            {question: "Which data structure follows FIFO?", options: ["Stack", "Queue", "Heap", "Tree"], answer: 1},
            {question: "What is the main purpose of normalization in databases?", options: ["Reduce unnecessary data redundancy", "Increase screen brightness", "Compress images only", "Speed up the CPU fan"], answer: 0},
            {question: "What does O(n) describe in algorithm analysis?", options: ["A linear growth rate", "A constant color", "A database table", "A network cable"], answer: 0},
            {question: "Which layer handles IP routing in the OSI model?", options: ["Physical", "Data Link", "Network", "Application"], answer: 2},
            {question: "What is encapsulation in OOP?", options: ["Bundling data and methods with controlled access", "Deleting an object", "Running code without variables", "Connecting two monitors"], answer: 0},
            {question: "What does a primary key identify?", options: ["A unique record in a table", "A web browser", "A network cable", "A computer user interface"], answer: 0},
            {question: "Which technology commonly provides encrypted web transport?", options: ["TLS", "ASCII", "JPEG", "RAM"], answer: 0},
            {question: "What is recursion?", options: ["A function calling itself", "A database backup", "A network address", "A hardware upgrade"], answer: 0},
            {question: "What is version control used for?", options: ["Tracking changes to files and code", "Cooling a processor", "Formatting a monitor", "Replacing RAM"], answer: 0}
        ]
    },

    history: {
        Easy: [
            {question: "Which document declared Philippine independence in 1898?", options: ["Malolos Constitution", "Acta de la Proclamacion de la Independencia del Pueblo Filipino", "Treaty of Paris", "EDSA Proclamation"], answer: 1},
            {question: "Who is widely known as the national hero of the Philippines?", options: ["Jose Rizal", "Andres Bonifacio", "Emilio Aguinaldo", "Apolinario Mabini"], answer: 0},
            {question: "Which ancient civilization built the pyramids at Giza?", options: ["Roman", "Egyptian", "Mayan", "Viking"], answer: 1},
            {question: "What is a timeline used for?", options: ["Showing events in chronological order", "Measuring rainfall", "Drawing maps only", "Counting population"], answer: 0},
            {question: "Which was a major center of the Roman Empire?", options: ["Rome", "Manila", "Beijing", "Cairo"], answer: 0},
            {question: "What is a civilization?", options: ["An organized human society", "A weather pattern", "A mountain range", "A computer program"], answer: 0},
            {question: "What is culture?", options: ["Shared beliefs and practices", "A type of government only", "A geographic coordinate", "A military weapon"], answer: 0},
            {question: "Who led the Katipunan?", options: ["Andres Bonifacio", "Jose Rizal", "Ferdinand Marcos", "Manuel Quezon"], answer: 0},
            {question: "What does chronology mean?", options: ["Order by time", "Order by size", "Order by location", "Order by color"], answer: 0},
            {question: "What is government?", options: ["A system for organizing and governing a society", "A weather system", "A trade route", "A map symbol"], answer: 0}
        ],
        Medium: [
            {question: "What event marked the start of World War I in 1914?", options: ["Attack on Pearl Harbor", "Assassination of Archduke Franz Ferdinand", "Fall of the Berlin Wall", "Russian Revolution"], answer: 1},
            {question: "What was the Industrial Revolution mainly associated with?", options: ["Mechanized production and factories", "The invention of agriculture", "The end of writing", "The creation of the internet"], answer: 0},
            {question: "What was the Malolos Congress associated with?", options: ["The First Philippine Republic", "Spanish exploration", "The EDSA Revolution", "World War II in Europe"], answer: 0},
            {question: "Why are primary sources valuable to historians?", options: ["They provide evidence from the period studied", "They are always unbiased", "They contain no errors", "They are always written by historians"], answer: 0},
            {question: "What was the Renaissance?", options: ["A revival of art, learning and classical ideas in Europe", "A military alliance", "A weather event", "A modern computer era"], answer: 0},
            {question: "What is colonialism?", options: ["Control of a territory by an external power", "A form of farming", "A type of map", "A scientific experiment"], answer: 0},
            {question: "What was the Cold War?", options: ["A period of rivalry mainly between the US and USSR", "A war fought only in Antarctica", "A medieval conflict", "A trade agreement"], answer: 0},
            {question: "What does sovereignty mean?", options: ["Supreme authority of a state over its territory", "A type of currency", "A cultural festival", "A military rank"], answer: 0},
            {question: "What is an archive?", options: ["A collection of preserved records", "A battlefield", "A political party", "A weather station"], answer: 0},
            {question: "What is historical causation?", options: ["Understanding how events and conditions contribute to outcomes", "Memorizing dates only", "Drawing borders", "Counting artifacts"], answer: 0}
        ],
        Hard: [
            {question: "Which treaty ended World War I between Germany and the Allied powers?", options: ["Treaty of Versailles", "Treaty of Paris 1898", "Treaty of Tordesillas", "Treaty of Ghent"], answer: 0},
            {question: "What was the primary purpose of the Magna Carta in 1215?", options: ["Limit certain royal powers", "Create the United Nations", "End World War II", "Establish the Roman Empire"], answer: 0},
            {question: "What was the Enlightenment strongly associated with?", options: ["Reason, individual rights and political thought", "Feudal expansion", "Steam engines only", "Ancient Egyptian religion"], answer: 0},
            {question: "Which factor contributed to the Philippine Revolution against Spain?", options: ["Growing nationalism and opposition to colonial rule", "The invention of the internet", "The Cold War", "The Industrial Revolution in Japan"], answer: 0},
            {question: "What is historiography?", options: ["The study of how history is written and interpreted", "A system of government", "A type of map", "A collection of coins"], answer: 0},
            {question: "What was the significance of the 1986 EDSA People Power Revolution?", options: ["It led to the end of Ferdinand Marcos's presidency", "It began World War I", "It founded the Katipunan", "It ended Spanish rule in 1898"], answer: 0},
            {question: "What is nationalism?", options: ["A sense of shared national identity and loyalty", "A system of farming", "A type of climate", "A mathematical method"], answer: 0},
            {question: "Why do historians compare multiple sources?", options: ["To evaluate evidence and differing perspectives", "To avoid reading any sources", "To guarantee one perfect answer", "To remove chronology"], answer: 0},
            {question: "What is imperialism?", options: ["A policy of extending power or influence over other territories", "A voting system", "A scientific law", "A type of architecture"], answer: 0},
            {question: "What is historical context?", options: ["The conditions and circumstances surrounding an event", "Only the exact date", "Only the location", "A list of rulers"], answer: 0}
        ]
    },

    geography: {
        Easy: [
            {question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2},
            {question: "What is the capital of the Philippines?", options: ["Cebu City", "Manila", "Davao City", "Baguio"], answer: 1},
            {question: "Which continent is the Sahara Desert in?", options: ["Asia", "Africa", "Europe", "Australia"], answer: 1},
            {question: "What is a map?", options: ["A representation of a place", "A weather event", "A type of government", "A language"], answer: 0},
            {question: "Which is a landform?", options: ["Mountain", "Cloud", "Rain", "Wind"], answer: 0},
            {question: "What does a compass show?", options: ["Direction", "Population", "Temperature only", "Elevation only"], answer: 0},
            {question: "Which is a country in Southeast Asia?", options: ["Philippines", "Brazil", "Egypt", "Spain"], answer: 0},
            {question: "What is weather?", options: ["Short-term atmospheric conditions", "Long-term population change", "A political boundary", "A landform"], answer: 0},
            {question: "What is an island?", options: ["Land surrounded by water", "Water surrounded by land", "A mountain only", "A desert only"], answer: 0},
            {question: "What is a river?", options: ["A flowing body of water", "A political boundary only", "A type of climate", "A map symbol"], answer: 0}
        ],
        Medium: [
            {question: "What is climate?", options: ["Long-term patterns of weather", "Today's temperature only", "A political system", "A landform"], answer: 0},
            {question: "What does population density measure?", options: ["People per unit of area", "Rainfall per year", "Mountain height", "River length"], answer: 0},
            {question: "What is latitude measured from?", options: ["The Equator", "The Prime Meridian", "The International Date Line", "The Tropic of Capricorn only"], answer: 0},
            {question: "What is longitude measured from?", options: ["The Prime Meridian", "The Equator", "The Arctic Circle", "The Tropic of Cancer"], answer: 0},
            {question: "Which process can shape a river valley?", options: ["Erosion", "Photosynthesis", "Condensation", "Magnetism"], answer: 0},
            {question: "What is urbanization?", options: ["Growth of towns and cities", "Movement of tectonic plates", "Formation of clouds", "Creation of oceans"], answer: 0},
            {question: "Which layer of Earth is liquid and mostly metallic?", options: ["Outer core", "Crust", "Mantle", "Inner core"], answer: 0},
            {question: "What is a plateau?", options: ["An elevated area with a relatively flat top", "A deep ocean trench", "A narrow river", "A tropical storm"], answer: 0},
            {question: "What is migration?", options: ["Movement of people from one place to another", "Movement of clouds only", "Growth of mountains", "Change in temperature"], answer: 0},
            {question: "What does a map scale show?", options: ["The relationship between map distance and real distance", "Political power", "Climate zones only", "Population age"], answer: 0}
        ],
        Hard: [
            {question: "What causes most earthquakes?", options: ["Movement of tectonic plates", "Daily weather", "Ocean tides only", "Cloud formation"], answer: 0},
            {question: "What is the Coriolis effect?", options: ["The apparent deflection of moving air and water due to Earth's rotation", "A type of rainfall", "A mountain-building process", "A map projection"], answer: 0},
            {question: "What is a monsoon?", options: ["A seasonal reversal in wind patterns often affecting rainfall", "A permanent desert", "A type of volcano", "A population census"], answer: 0},
            {question: "What is a watershed?", options: ["An area of land draining to a common water body", "A mountain summit", "A climate zone", "A political party"], answer: 0},
            {question: "What is GIS commonly used for?", options: ["Analyzing and displaying geographic data", "Editing music only", "Measuring blood pressure", "Programming CPUs"], answer: 0},
            {question: "What is a demographic transition?", options: ["A model describing changes in birth and death rates as societies develop", "A type of map", "A volcanic eruption", "A river process"], answer: 0},
            {question: "What is desertification?", options: ["Land degradation in dry areas toward desert-like conditions", "Formation of glaciers", "Urban growth", "Ocean circulation"], answer: 0},
            {question: "What is a renewable resource?", options: ["A resource replenished naturally on a human timescale", "A resource that can never return", "A political boundary", "A map symbol"], answer: 0},
            {question: "What is a population pyramid?", options: ["A graph showing population by age and sex", "A mountain shape", "A map projection", "A rainfall chart only"], answer: 0},
            {question: "Why are map projections needed?", options: ["To represent Earth's curved surface on a flat map", "To increase population", "To measure wind speed", "To create borders automatically"], answer: 0}
        ]
    }
};


/* ================= STATE ================= */

let currentUser = null;
let appInitialized = false; // becomes true after the app has opened Dashboard once
let currentSubject = "math";
let currentDifficulty = "Easy";
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentScore = 0;
let selectedAnswer = null;


/* ================= STORAGE ================= */

function getUsers() {
    const users = JSON.parse(localStorage.getItem("instaLearnUsers")) || {};
    // Security: never retain passwords in localStorage.
    let changed = false;
    Object.values(users).forEach(user => {
        if (user && Object.prototype.hasOwnProperty.call(user, "password")) {
            delete user.password;
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem("instaLearnUsers", JSON.stringify(users));
    }
    return users;
}

function saveUsers(users) {
    localStorage.setItem("instaLearnUsers", JSON.stringify(users));
}

function getCurrentUserData() {
    if (!currentUser) return null;

    const users = getUsers();
    return users[currentUser] || null;
}

function saveCurrentUserData(data) {
    const users = getUsers();
    users[currentUser] = data;
    saveUsers(users);
}

function formatPasswordChangedAgo(timestamp) {
    if (!timestamp) return "";

    const elapsed = Math.max(0, Date.now() - Number(timestamp));
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (elapsed < minute) return "just now";
    if (elapsed < hour) {
        const minutes = Math.floor(elapsed / minute);
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    }
    if (elapsed < day) {
        const hours = Math.floor(elapsed / hour);
        return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }

    const days = Math.floor(elapsed / day);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function showLoginPasswordReminder(email) {
    const box = document.getElementById("loginPasswordHint");
    const text = document.getElementById("loginPasswordHintText");
    if (!box || !text) return;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const users = getUsers();
    const profile = users[normalizedEmail];
    const changedAt = profile?.passwordChangedAt;

    if (!changedAt) {
        box.classList.add("hidden");
        text.textContent = "";
        return;
    }

    text.textContent = `Your password was changed ${formatPasswordChangedAgo(changedAt)}. Try the newer password you set.`;
    box.classList.remove("hidden");
}

function hideLoginPasswordReminder() {
    const box = document.getElementById("loginPasswordHint");
    const text = document.getElementById("loginPasswordHintText");
    if (box) box.classList.add("hidden");
    if (text) text.textContent = "";
}


/* ================= INITIALIZATION ================= */

document.addEventListener("DOMContentLoaded", () => {

    setupForms();
    setupAppNavigation();

    const loginEmailInput = document.getElementById("loginEmail");
    const loginPasswordInput = document.getElementById("loginPassword");
    loginEmailInput?.addEventListener("input", hideLoginPasswordReminder);
    loginPasswordInput?.addEventListener("input", hideLoginPasswordReminder);

    auth?.onAuthStateChanged(firebaseUser => {

        if (firebaseUser) {
            currentUser = firebaseUser.email;

            ensureLocalProfile(firebaseUser);

            if (!firebaseUser.emailVerified) {
                showVerificationGate(firebaseUser);
                return;
            }

            clearPendingVerification();
            loadApp();
        }
    });

});

function ensureLocalProfile(firebaseUser) {

    if (!firebaseUser?.email) return;

    const users = getUsers();
    const email = firebaseUser.email.toLowerCase();

    if (!users[email]) {
        users[email] = {
            name: firebaseUser.displayName || email.split("@")[0],
            email: email,
            photo: firebaseUser.photoURL || null,
            subjects: ["math", "science", "english"],
            progress: {
                math: 0,
                science: 0,
                english: 0,
                computer: 0,
                history: 0,
                geography: 0
            },
            totalQuestions: 0,
            streak: 1,
            activities: [],
            learningGoal: "Improve my grades"
        };

        saveUsers(users);
    } else if (!users[email].name) {
        users[email].name = firebaseUser.displayName || email.split("@")[0];
        saveUsers(users);
    }
}

/* ================= PAGE NAVIGATION ================= */

function showPage(pageId) {

    const alreadyActive = document.getElementById(pageId)?.classList.contains("active");

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    const page = document.getElementById(pageId);

    if (page) {
        page.classList.add("active");
    }

    if (!alreadyActive) {
        window.scrollTo(0, 0);
    }
}


let currentSectionId = "dashboardSection";

function showSection(sectionId) {
    const target = document.getElementById(sectionId);

    if (!target || !target.classList.contains("content-section")) {
        console.error("InstaLearn navigation: section not found:", sectionId);
        return false;
    }

    document.querySelectorAll(".content-section").forEach(section => {
        const isTarget = section.id === sectionId;
        section.classList.toggle("hidden", !isTarget);
        section.hidden = !isTarget;
        section.setAttribute("aria-hidden", String(!isTarget));
    });

    currentSectionId = sectionId;

    const appPage = document.getElementById("appPage");
    if (appPage) appPage.classList.add("active");

    window.scrollTo({ top: 0, behavior: "auto" });
    return true;
}

function setupAppNavigation() {
    const navItems = document.querySelectorAll(".sidebar .nav-item[data-section]");

    navItems.forEach(item => {
        item.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const sectionId = this.dataset.section;
            if (!sectionId) return;

            if (sectionId === "dashboardSection") openDashboard();
            else if (sectionId === "subjectsSection") openSubjects();
            else if (sectionId === "progressSection") openProgress();
            else if (sectionId === "settingsSection") openSettings();
            else if (sectionId === "helpSection") openHelp();
            else if (sectionId === "aboutSection") openAbout();
        }, true);
    });
}


/* ================= FORMS ================= */

function setupForms() {

    document.getElementById("loginForm")
        .addEventListener("submit", login);

    document.getElementById("registerForm")
        .addEventListener("submit", register);

    document.getElementById("forgotForm")
        .addEventListener("submit", forgotPassword);

}


/* ================= REGISTER ================= */

async function register(event) {

    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("registerConfirm").value;

    if (!isValidGmail(email)) {
        showToast("Please enter a valid Gmail address.");
        return;
    }

    if (password.length < 8) {
        showToast("Password must be at least 8 characters.");
        return;
    }

    if (password !== confirm) {
        showToast("Passwords do not match.");
        return;
    }

    const submitBtn = document.getElementById("registerSubmitBtn");
    const originalBtnText = submitBtn ? submitBtn.textContent : "Create Account";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating account...";
    }

    try {
        const credential = await auth.createUserWithEmailAndPassword(email, password);

        await credential.user.updateProfile({
            displayName: name
        });

        const users = getUsers();

        users[email] = {
            name: name,
            email: email,
            photo: null,
            subjects: ["math", "science", "english"],
            progress: {
                math: 0,
                science: 0,
                english: 0,
                computer: 0,
                history: 0,
                geography: 0
            },
            totalQuestions: 0,
            streak: 1,
            activities: [],
            learningGoal: "Improve my grades"
        };

        saveUsers(users);
        currentUser = email;
        localStorage.setItem("instaLearnCurrentUser", email);

        // Send a real verification email. Passwords are never stored locally.
        try {
            await credential.user.sendEmailVerification();
        } catch (verificationError) {
            console.warn("Verification email could not be sent:", verificationError);
        }

        document.getElementById("registerForm").reset();

        localStorage.setItem("instaLearnPendingVerificationEmail", email);
        showVerificationGate(credential.user);
        showToast("Account created. Verify your Gmail before entering InstaLearn.");

    } catch (error) {
        // If Firebase already has this Gmail, Firebase blocks the duplicate account.
        showToast(firebaseErrorMessage(error));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}


/* ================= LOGIN ================= */

async function login(event) {

    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    if (!isValidGmail(email)) {
        showToast("Please enter a valid Gmail address.");
        return;
    }

    if (isLoginLocked(email)) {
        startLoginLockCountdown(email);
        showToast("Too many failed attempts. Please wait before trying again.");
        return;
    }

    hideLoginPasswordReminder();

    const submitBtn = document.getElementById("loginSubmitBtn");
    const originalBtnText = submitBtn ? submitBtn.textContent : "Login";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in...";
    }

    try {
        await auth.setPersistence(
            rememberMe
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION
        );

        let credential;

        credential = await auth.signInWithEmailAndPassword(email, password);

        currentUser = credential.user.email;
        ensureLocalProfile(credential.user);
        clearLoginAttempts(email);

        if (!credential.user.emailVerified) {
            localStorage.setItem("instaLearnPendingVerificationEmail", email);
            showVerificationGate(credential.user);
            showToast("Please verify your Gmail before entering InstaLearn.");
            return;
        }

        // Extra security step: require the Gmail security code before the
        // login actually completes.
        const codeVerified = await requestSecurityCode(
            email,
            `For your security, we sent a code to ${email}. Enter it to finish logging in.`
        );

        if (!codeVerified) {
            await auth.signOut();
            showToast("Login cancelled.");
            return;
        }

        localStorage.setItem("instaLearnCurrentUser", currentUser);
        clearPendingVerification();
        document.getElementById("loginForm").reset();
        resetInactivityTimer();

        showToast("Welcome back!");

    } catch (error) {
        if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password") {
            showLoginPasswordReminder(email);

            const state = registerFailedLogin(email);
            if (state.lockedUntil && state.lockedUntil > Date.now()) {
                startLoginLockCountdown(email);
            }
        }
        showToast(firebaseErrorMessage(error));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}


/* ================= FORGOT PASSWORD ================= */

async function forgotPassword(event) {

    event.preventDefault();

    const emailInput = document.getElementById("forgotEmail");
    const email = emailInput.value.trim().toLowerCase();

    if (!isValidGmail(email)) {
        showToast("Please enter a valid Gmail address.");
        emailInput.focus();
        return;
    }

    const confirmed = window.confirm(
        `Send a secure password reset email to ${email}?\n\nThe password will NOT be changed here. You must open the reset email in that Gmail account and use its secure link to choose a new password.`
    );

    if (!confirmed) return;

    const button = document.querySelector('#forgotForm button[type="submit"]');
    const originalText = button ? button.textContent : "Send Reset Email";
    if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
    }

    try {
        // Firebase owns the reset process. This does not change the password and
        // does not grant access to the account. If Email Enumeration Protection is
        // enabled, Firebase may intentionally return the same outward result for
        // registered and unregistered emails.
        await auth.sendPasswordResetEmail(email);

        document.getElementById("forgotForm").reset();
        showToast(`If an InstaLearn account uses ${email}, a secure reset email has been sent. Check Inbox and Spam.`);
    } catch (error) {
        showToast(firebaseErrorMessage(error));
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

/* ================= LOAD APP ================= */

function loadApp() {

    showPage("appPage");

    applyDarkModePreference();

    updateUserUI();
    refreshEmailVerificationStatus();

    // Firebase's onAuthStateChanged can fire again after the user is already
    // inside the app (e.g. token refresh, tab refocus). Only force the view
    // to Dashboard the FIRST time the app loads for this session, otherwise
    // it snaps the user back to Dashboard every time they click another tab.
    if (!appInitialized) {
        openDashboard();
        appInitialized = true;
    } else {
        renderDashboardSubjects();
        renderActivities();
        renderLearningDashboard();
    }

    renderDashboardProgressChart();

    renderSubjects();

    renderProgress();

    renderSettingsSubjects();

    resetInactivityTimer();

}


/* ================= USER UI ================= */

function updateUserUI() {

    const user = getCurrentUserData();

    if (!user) return;

    document.getElementById("dashboardName").textContent =
        user.name;

    document.getElementById("sidebarName").textContent =
        user.name;

    document.getElementById("settingsName").value =
        user.name;

    document.getElementById("settingsEmail").value =
        user.email;

    setAvatar("sidebarAvatar", user);

    setAvatar("topAvatar", user);

    setAvatar("settingsAvatar", user);

    document.getElementById("totalQuestions").textContent =
        user.totalQuestions;

    document.getElementById("streakCount").textContent =
        user.streak || 1;

    calculateOverallProgress();

    const tip = document.getElementById("gettingStartedTip");
    if (tip) {
        tip.classList.toggle("hidden", (user.totalQuestions || 0) > 0);
    }

}


/* ================= AVATAR ================= */

function setAvatar(elementId, user) {

    const element = document.getElementById(elementId);

    if (!element) return;

    if (user.photo) {

        element.innerHTML =
            `<img src="${user.photo}" alt="Profile photo">`;

    } else {

        element.textContent =
            user.name.charAt(0).toUpperCase();

    }

}


/* ================= DASHBOARD ================= */

function showSkeletonCards(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Array.from({ length: count })
        .map(() => `
            <div class="subject-card skeleton-card">
                <div class="skeleton-block skeleton-icon"></div>
                <div class="skeleton-block skeleton-line" style="width:70%"></div>
                <div class="skeleton-block skeleton-line" style="width:90%"></div>
                <div class="skeleton-block skeleton-bar"></div>
            </div>
        `)
        .join("");
}

function openDashboard() {
    if (!showSection("dashboardSection")) return;

    setActiveNav(0);

    showSkeletonCards("dashboardSubjects", 3);

    setTimeout(() => {
        renderDashboardSubjects();
        renderActivities();
    }, 400);

    updateUserUI();
    renderLearningDashboard();

}


function getLearningGoalLabel(goal) {
    return goal || "Improve my grades";
}

function getRecommendedSubject(user) {
    const selected = (user?.subjects || []).filter(id => subjects[id]);
    if (!selected.length) return null;
    return selected.slice().sort((a, b) => (user.progress?.[a] || 0) - (user.progress?.[b] || 0))[0];
}

function renderLearningDashboard() {
    const user = getCurrentUserData();
    if (!user) return;
    const overall = calculateOverallProgress();
    const goal = getLearningGoalLabel(user.learningGoal);
    const goalText = document.getElementById("dashboardGoalText");
    const percent = document.getElementById("planProgressPercent");
    const bar = document.getElementById("planProgressBar");
    if (goalText) goalText.textContent = `Goal: ${goal}. InstaLearn will keep your dashboard focused on steady progress.`;
    if (percent) percent.textContent = overall + "%";
    if (bar) bar.style.width = overall + "%";

    const next = getRecommendedSubject(user);
    const nextTitle = document.getElementById("dashboardNextTitle");
    const nextText = document.getElementById("dashboardNextText");
    const nextRing = document.getElementById("dashboardNextRing");
    if (next && subjects[next]) {
        const progress = user.progress?.[next] || 0;
        const topic = subjects[next].topics[Math.min(Math.floor(progress / 20), subjects[next].topics.length - 1)];
        if (nextTitle) nextTitle.textContent = `${subjects[next].name} · ${topic}`;
        if (nextText) nextText.textContent = progress === 0 ? `Start with ${topic}, then check your understanding with practice.` : `Pick up where you left off. ${topic} is your next recommended topic.`;
        if (nextRing) nextRing.textContent = progress + "%";
    } else {
        if (nextTitle) nextTitle.textContent = "Choose your first subject";
        if (nextText) nextText.textContent = "Build your learning path by selecting a subject from My Subjects.";
        if (nextRing) nextRing.textContent = "→";
    }
}

function openRecommendedLearning() {
    const user = getCurrentUserData();
    const recommended = getRecommendedSubject(user);
    if (!recommended) { openSubjects(); return; }
    currentSubject = recommended;
    openLearningSection();
}

function requestTutorHelp() {
    showToast("Tutor support request saved. A tutor contact flow can be connected here for the final client setup.");
}

function saveLearningGoal(goal) {
    const user = getCurrentUserData();
    if (!user) return;
    user.learningGoal = goal;
    saveCurrentUserData(user);
    renderLearningDashboard();
    showToast("Learning goal updated.");
}

function renderDashboardSubjects() {

    const container =
        document.getElementById("dashboardSubjects");

    const user = getCurrentUserData();

    container.innerHTML = "";

    if (!user) return;

    if (!user.subjects.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <strong>No subjects selected yet.</strong>
                <span>Choose a subject from My Subjects to start learning.</span>
                <button class="btn primary" onclick="openSubjects()">Choose Subjects</button>
            </div>
        `;
        return;
    }

    user.subjects.slice(0, 3).forEach(id => {

        const subject = subjects[id];

        if (!subject) return;

        const progress =
            user.progress[id] || 0;

        container.innerHTML += `
            <div class="subject-card">

                <div class="subject-icon">
                    ${subject.icon}
                    ${progress >= 100 ? '<span class="subject-badge" title="Completed">🏆</span>' : ""}
                </div>

                <h3>${subject.name}</h3>

                <p>${subject.description}</p>

                <div class="subject-progress">
                    <div class="progress-bar">
                        <div style="width:${progress}%"></div>
                    </div>
                </div>

                <div class="subject-footer">

                    <span>${progress}% complete</span>

                    ${progress >= 100
                        ? `<button class="subject-action" onclick="openCertificate('${id}')">Certificate</button>`
                        : `<button class="subject-action" onclick="openSubjectDetail('${id}')">Open</button>`}

                </div>

            </div>
        `;

    });

}


/* ================= SUBJECTS ================= */

function openSubjects() {
    if (!showSection("subjectsSection")) return;

    setActiveNav(1);

    showSkeletonCards("allSubjects", 6);

    setTimeout(renderSubjects, 350);

}


function setSubjectFilter(filter) {
    subjectFilter = filter;
    document.querySelectorAll(".subject-filter").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    renderSubjects();
}

function renderSubjects() {
    const container = document.getElementById("allSubjects");
    const empty = document.getElementById("subjectLibraryEmpty");
    const count = document.getElementById("subjectLibraryCount");
    const search = (document.getElementById("subjectSearch")?.value || "").trim().toLowerCase();
    const user = getCurrentUserData();
    if (!container || !user) return;

    const entries = Object.entries(subjects).filter(([id, subject]) => {
        const selected = user.subjects.includes(id);
        const progress = user.progress[id] || 0;
        const matchesSearch = !search || subject.name.toLowerCase().includes(search) || subject.description.toLowerCase().includes(search) || subject.topics.some(topic => topic.toLowerCase().includes(search));
        const matchesFilter = subjectFilter === "all" ||
            (subjectFilter === "selected" && selected) ||
            (subjectFilter === "progress" && progress > 0 && progress < 100) ||
            (subjectFilter === "new" && progress === 0);
        return matchesSearch && matchesFilter;
    });

    container.innerHTML = entries.map(([id, subject]) => {
        const selected = user.subjects.includes(id);
        const progress = user.progress[id] || 0;
        const nextTopic = subject.topics[Math.min(Math.floor(progress / 20), subject.topics.length - 1)];
        return `
            <article class="subject-card premium-subject-card ${selected ? "is-selected" : ""}" onclick="${selected ? `openSubjectDetail('${id}')` : `toggleSubject('${id}')`}">
                <div class="subject-card-topline">
                    <span class="subject-category">${subject.category}</span>
                    ${selected ? `<span class="selected-badge">✓ My Subject</span>` : `<span class="available-badge">Available</span>`}
                </div>
                <div class="subject-icon">${subject.icon}</div>
                <div class="subject-card-title-row">
                    <h3>${subject.name}</h3>
                </div>
                <p>${subject.description}</p>
                <div class="subject-meta-row"><span>📚 ${subject.topics.length} topics</span><span>⚡ 3 levels</span><span>⏱ ${subject.time}</span></div>
                <div class="subject-progress">
                    <div class="progress-bar"><div style="width:${progress}%"></div></div>
                </div>
                <div class="subject-footer">
                    <span>${progress ? `${progress}% mastery · Next: ${nextTopic}` : "Ready to begin"}</span>
                    <div class="subject-actions">
                        ${selected ? `<button class="subject-action" onclick="event.stopPropagation(); openSubjectDetail('${id}')">Open →</button><button class="subject-remove" onclick="event.stopPropagation(); toggleSubject('${id}')">Remove</button>` : `<button class="subject-action" onclick="event.stopPropagation(); toggleSubject('${id}')">+ Add Subject</button>`}
                    </div>
                </div>
            </article>`;
    }).join("");

    if (count) count.textContent = Object.keys(subjects).length;
    if (empty) empty.classList.toggle("hidden", entries.length !== 0);
}


/* ================= SELECT SUBJECT ================= */

function toggleSubject(id) {

    const user = getCurrentUserData();

    if (!user) return;

    if (user.subjects.includes(id)) {

        user.subjects =
            user.subjects.filter(subjectId => subjectId !== id);

        showToast("Subject removed.");

    } else {

        user.subjects.push(id);

        showToast(
            `${subjects[id].name} added to your subjects!`
        );

    }

    saveCurrentUserData(user);

    renderSubjects();

    renderDashboardSubjects();

    renderSettingsSubjects();

}


/* ================= SUBJECT DETAIL ================= */

function openSubjectDetail(id) {

    const user = getCurrentUserData();

    if (!user) return;

    currentSubject = id;

    const subject = subjects[id];

    showSection("subjectDetailSection");

    document.getElementById("detailIcon").textContent =
        subject.icon;

    document.getElementById("detailTitle").textContent =
        subject.name;

    document.getElementById("detailDescription").textContent =
        subject.description;

    const progress =
        user.progress[id] || 0;

    document.getElementById("detailProgress").textContent =
        progress + "%";

    document.getElementById("detailProgressBar").style.width =
        progress + "%";

    const topicList =
        document.getElementById("topicList");

    document.getElementById("detailTopicCount").textContent = subject.topics.length;
    const nextIndex = Math.min(Math.floor(progress / 20), subject.topics.length - 1);
    const nextTopic = subject.topics[nextIndex];
    document.getElementById("detailNextTitle").textContent = progress >= 100 ? "Subject mastered" : `Continue with ${nextTopic}`;
    document.getElementById("detailNextText").textContent = progress >= 100 ? "Great work. Revisit the lessons or challenge yourself with a harder practice level." : `Your next recommended topic is ${nextTopic}. Learn it first, then test yourself with practice.`;
    document.getElementById("detailNextButton").textContent = progress >= 100 ? "Review Lessons" : "Start Learning";
    const outcomeText = document.getElementById("detailOutcomeText");
    if (outcomeText) outcomeText.textContent = `${subject.outcomes}. Typical session: ${subject.time}.`;

    topicList.innerHTML = subject.topics.map((topic, index) => {
        const topicProgress = progress >= ((index + 1) / subject.topics.length) * 100 ? 100 : (progress > (index / subject.topics.length) * 100 ? 50 : 0);
        return `<button class="topic-item rich-topic" onclick="openLearningSection()">
            <span class="topic-index ${topicProgress === 100 ? "done" : ""}">${topicProgress === 100 ? "✓" : String(index + 1).padStart(2, "0")}</span>
            <span class="topic-main"><strong>${topic}</strong><small>${topicProgress === 100 ? "Completed" : topicProgress > 0 ? "In progress" : "Ready to learn"}</small></span>
            <span class="topic-arrow">→</span>
        </button>`;
    }).join("");

}


/* ================= LEARNING INFO ================= */

function startDiagnostic() {
    if (!currentSubject || !quizQuestions[currentSubject]?.easy) {
        showToast("This subject's skill check is not available yet.");
        return;
    }
    currentDifficulty = "easy";
    currentQuestions = [...quizQuestions[currentSubject].easy].sort(() => Math.random() - 0.5).slice(0, 5);
    currentQuestionIndex = 0;
    currentScore = 0;
    selectedAnswer = null;
    lastWrongQuestions = [];
    showSection("quizSection");
    document.getElementById("quizDifficulty").textContent = "Skill Check";
    loadQuestion();
}

function openLearningSection() {

    const user = getCurrentUserData();
    const subject = subjects[currentSubject];
    const lesson = learningLessons[currentSubject];

    if (!user || !subject || !lesson) {
        showToast("This lesson is not available yet.");
        return;
    }

    showSection("learningSection");

    document.getElementById("learningIcon").textContent = subject.icon;
    document.getElementById("learningTitle").textContent = subject.name;
    document.getElementById("learningIntro").textContent = lesson.intro;

    const progress = user.progress[currentSubject] || 0;
    document.getElementById("learningProgress").textContent = progress + "% complete";
    document.getElementById("learningProgressBar").style.width = progress + "%";

    const container = document.getElementById("lessonCards");
    container.innerHTML = lesson.lessons.map((item, index) => `
        <article class="lesson-card">
            <div class="lesson-number">${String(index + 1).padStart(2, "0")}</div>
            <div class="lesson-content">
                <p class="small-label">TOPIC ${index + 1}</p>
                <h2>${item[0]}</h2>
                <p>${item[1]}</p>
                <div class="lesson-tip"><strong>Quick tip:</strong> ${item[2]}</div>
                ${item[3] ? `<div class="lesson-example"><strong>Worked example:</strong> ${item[3]}</div>` : ""}
            </div>
        </article>
    `).join("");
}

function completeLearningLesson() {

    const user = getCurrentUserData();
    if (!user) return;

    const oldProgress = user.progress[currentSubject] || 0;

    if (oldProgress >= 100) {
        showToast("This subject is already at 100%.");
        return;
    }

    user.progress[currentSubject] = Math.min(100, oldProgress + 20);
    saveCurrentUserData(user);

    const progress = user.progress[currentSubject];
    document.getElementById("learningProgress").textContent = progress + "% complete";
    document.getElementById("learningProgressBar").style.width = progress + "%";
    document.getElementById("learningCompleteBtn").textContent = progress >= 100 ? "Lesson Completed ✓" : "Mark Lesson Complete";

    updateUserUI();
    renderDashboardSubjects();
    renderSubjects();
    renderProgress();

    if (progress >= 100 && oldProgress < 100) {
        showCertificate(currentSubject, user);
    } else {
        showToast(`Great! ${subjectName(currentSubject)} progress is now ${progress}%.`);
    }
}

function showCertificate(subjectId, user) {
    const overlay = document.getElementById("certificateOverlay");
    if (!overlay) return;

    document.getElementById("certificateSubjectIcon").textContent = subjects[subjectId]?.icon || "🏆";
    document.getElementById("certificateSubjectName").textContent = subjectName(subjectId);
    document.getElementById("certificateStudentName").textContent = user.name || "Student";
    document.getElementById("certificateDate").textContent = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });

    overlay.classList.remove("hidden");
}

function closeCertificate() {
    const overlay = document.getElementById("certificateOverlay");
    if (overlay) overlay.classList.add("hidden");
}

function subjectName(id) {
    return subjects[id]?.name || "Subject";
}

// Backward-compatible alias for older buttons or saved browser markup.
function showLearningInfo() {
    openLearningSection();
}


/* ================= PRACTICE ================= */

function openPracticeSetup() {

    if (!currentSubject || !subjects[currentSubject]) {
        showToast("Please choose a subject first.");
        openSubjects();
        return;
    }

    showSection("practiceSetupSection");

}


function startQuiz(difficulty) {

    currentDifficulty = difficulty;

    const available =
        quizQuestions[currentSubject] &&
        quizQuestions[currentSubject][difficulty];

    if (!available) {

        showToast(
            "Practice questions for this subject are coming soon."
        );

        return;
    }

    currentQuestions =
        [...available].sort(() => Math.random() - .5);

    currentQuestionIndex = 0;
    currentScore = 0;
    selectedAnswer = null;
    lastWrongQuestions = [];

    showSection("quizSection");

    document.getElementById("quizDifficulty")
        .textContent = difficulty;

    loadQuestion();

}


/* ================= LOAD QUESTION ================= */

function loadQuestion() {

    const question =
        currentQuestions[currentQuestionIndex];

    selectedAnswer = null;

    document.getElementById("questionNumber").textContent =
        `Question ${currentQuestionIndex + 1} / ${currentQuestions.length}`;

    document.getElementById("scoreDisplay").textContent =
        `Score: ${currentScore}`;

    const percentage =
        ((currentQuestionIndex) / currentQuestions.length) * 100;

    document.getElementById("quizProgressBar")
        .style.width = percentage + "%";

    document.getElementById("questionText").textContent =
        question.question;

    const options =
        document.getElementById("answerOptions");

    options.innerHTML = "";

    question.options.forEach((option, index) => {

        const button =
            document.createElement("button");

        button.className = "answer-option";

        button.textContent =
            `${String.fromCharCode(65 + index)}. ${option}`;

        button.onclick =
            () => selectAnswer(index, button);

        options.appendChild(button);

    });

    document.getElementById("nextQuestionBtn").disabled =
        true;

    document.getElementById("nextQuestionBtn").textContent =
        currentQuestionIndex === currentQuestions.length - 1
            ? "Finish Practice"
            : "Next Question →";

}


/* ================= SELECT ANSWER ================= */

function selectAnswer(index, button) {

    selectedAnswer = index;

    document.querySelectorAll(".answer-option")
        .forEach(option => {
            option.classList.remove("selected");
        });

    button.classList.add("selected");

    document.getElementById("nextQuestionBtn")
        .disabled = false;

}


/* ================= NEXT QUESTION ================= */

function nextQuestion() {

    if (selectedAnswer === null) return;

    const question =
        currentQuestions[currentQuestionIndex];

    if (selectedAnswer === question.answer) {
        currentScore++;
    } else {
        lastWrongQuestions.push(question);
    }

    currentQuestionIndex++;

    if (currentQuestionIndex >= currentQuestions.length) {

        finishQuiz();

    } else {

        loadQuestion();

    }

}


/* ================= FINISH QUIZ ================= */

function finishQuiz() {

    const total =
        currentQuestions.length;

    const percent =
        Math.round((currentScore / total) * 100);

    const user =
        getCurrentUserData();

    user.totalQuestions += total;

    /*
       Simple progress calculation.
       Each completed quiz increases progress.
    */

    const oldProgress =
        user.progress[currentSubject] || 0;

    const increase =
        Math.max(5, Math.round(percent / 10));

    user.progress[currentSubject] =
        Math.min(100, oldProgress + increase);

    user.activities.unshift({
        subject: currentSubject,
        difficulty: currentDifficulty,
        score: currentScore,
        total: total,
        percent: percent,
        date: new Date().toLocaleDateString()
    });

    user.activities =
        user.activities.slice(0, 10);

    if (percent === 100) {
        user.streak =
            (user.streak || 1) + 1;
    }

    user.reviewTopics = user.reviewTopics || {};
    user.reviewTopics[currentSubject] = lastWrongQuestions.slice(0, 5).map(q => q.question);

    saveCurrentUserData(user);

    showResults(
        currentScore,
        total,
        percent
    );

}


/* ================= RESULTS ================= */

function showResults(score, total, percent) {

    showSection("resultsSection");

    document.getElementById("finalScore")
        .textContent = score;

    document.getElementById("finalPercent")
        .textContent = percent + "%";

    document.getElementById("correctAnswers")
        .textContent = score;

    document.getElementById("wrongAnswers")
        .textContent = total - score;

    document.getElementById("resultAccuracy")
        .textContent = percent + "%";

    let message;

    if (percent === 100) {
        message =
            "Perfect score! Excellent work!";
    } else if (percent >= 80) {
        message =
            "Great job! Keep practicing!";
    } else if (percent >= 60) {
        message =
            "Good effort! You can improve even more.";
    } else {
        message =
            "Keep practicing. Every attempt helps you learn.";
    }

    document.getElementById("resultMessage")
        .textContent = message;

    const reviewCard = document.getElementById("mistakeReviewCard");
    const reviewList = document.getElementById("mistakeReviewList");
    if (reviewCard && reviewList) {
        if (lastWrongQuestions.length) {
            reviewCard.classList.remove("hidden");
            reviewList.innerHTML = lastWrongQuestions.slice(0, 4).map(q => `<span>↳ ${q.question}</span>`).join("");
        } else {
            reviewCard.classList.add("hidden");
            reviewList.innerHTML = "";
        }
    }

}


/* ================= DASHBOARD PROGRESS CHART ================= */

function renderDashboardProgressChart() {

    const container =
        document.getElementById("dashboardProgressChart");

    const user =
        getCurrentUserData();

    if (!container || !user) return;

    if (!user.subjects.length) {
        container.innerHTML = `<p class="muted small">Choose subjects to see your progress chart here.</p>`;
        return;
    }

    container.innerHTML =
        user.subjects
            .map(id => {

                const subject = subjects[id];
                if (!subject) return "";

                const progress = user.progress[id] || 0;

                return `
                    <div class="progress-row">
                        <div class="progress-row-top">
                            <span>${subject.icon} ${subject.name}</span>
                            <strong>${progress}%</strong>
                        </div>
                        <div class="progress-bar">
                            <div style="width:${progress}%"></div>
                        </div>
                    </div>
                `;

            })
            .join("");

}


/* ================= PROGRESS ================= */

function openProgress() {
    if (!showSection("progressSection")) return;

    setActiveNav(2);

    renderProgress();

}


function renderProgress() {

    const container =
        document.getElementById("progressSubjects");

    const user =
        getCurrentUserData();

    if (!container || !user) return;

    container.innerHTML = "";

    if (!user.subjects.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <strong>No subjects yet.</strong>
                <span>Choose a subject to start tracking your progress.</span>
                <button class="btn primary" onclick="openSubjects()">Choose Subjects</button>
            </div>
        `;
        renderProgressOverviewChart();
        renderCertificatesRow();
        return;
    }

    user.subjects.forEach(id => {

        const subject =
            subjects[id];

        const progress =
            user.progress[id] || 0;

        container.innerHTML += `
            <div class="progress-row">

                <div class="progress-row-top">

                    <span>
                        ${subject.icon}
                        ${subject.name}
                        ${progress >= 100 ? '<span class="subject-badge" title="Completed">🏆</span>' : ""}
                    </span>

                    <strong>
                        ${progress}%
                    </strong>

                </div>

                <div class="progress-bar">
                    <div style="width:${progress}%"></div>
                </div>

            </div>
        `;

    });

    renderProgressOverviewChart();
    renderCertificatesRow();

}


/* ================= PROGRESS OVERVIEW CHART (canvas bar chart) ================= */

function renderProgressOverviewChart() {

    const canvas = document.getElementById("progressOverviewChart");
    const user = getCurrentUserData();
    if (!canvas || !user || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const entries = user.subjects
        .map(id => ({ id, subject: subjects[id], progress: user.progress[id] || 0 }))
        .filter(entry => entry.subject);

    if (!entries.length) {
        ctx.fillStyle = "#a8a3b8";
        ctx.font = "13px DM Sans, sans-serif";
        ctx.fillText("No data yet — choose subjects to see your chart.", 15, height / 2);
        return;
    }

    const padding = 30;
    const chartHeight = height - padding * 2;
    const barSlot = (width - padding * 2) / entries.length;
    const barWidth = Math.min(46, barSlot * 0.55);

    // baseline
    ctx.strokeStyle = "#e7e8ef";
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    entries.forEach((entry, i) => {
        const x = padding + barSlot * i + (barSlot - barWidth) / 2;
        const barHeight = (entry.progress / 100) * chartHeight;
        const y = height - padding - barHeight;

        const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
        gradient.addColorStop(0, "#8c52ff");
        gradient.addColorStop(1, "#635bff");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 6) : ctx.rect(x, y, barWidth, barHeight);
        ctx.fill();

        ctx.fillStyle = "#171a24";
        ctx.font = "bold 11px DM Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${entry.progress}%`, x + barWidth / 2, y - 6);

        ctx.fillStyle = "#777d8d";
        ctx.font = "10px DM Sans, sans-serif";
        ctx.fillText(entry.subject.icon, x + barWidth / 2, height - padding + 16);
    });

    ctx.textAlign = "left";
}


/* ================= CERTIFICATES ================= */

function renderCertificatesRow() {

    const container = document.getElementById("certificatesRow");
    const user = getCurrentUserData();
    if (!container || !user) return;

    const completed = user.subjects.filter(id => (user.progress[id] || 0) >= 100 && subjects[id]);

    if (!completed.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <h2>Certificates Earned</h2>
        <div class="certificate-badges">
            ${completed.map(id => `
                <button class="certificate-badge" onclick="openCertificate('${id}')">
                    <span>🏆</span>
                    <strong>${subjects[id].name}</strong>
                </button>
            `).join("")}
        </div>
    `;
}

function openCertificate(subjectId) {
    const user = getCurrentUserData();
    const subject = subjects[subjectId];
    if (!user || !subject) return;

    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    document.getElementById("certificateContent").innerHTML = `
        <div class="certificate-icon">🏆</div>
        <p class="certificate-eyebrow">CERTIFICATE OF COMPLETION</p>
        <h2>${subject.name}</h2>
        <p class="certificate-body">This certifies that</p>
        <p class="certificate-name">${user.name || "InstaLearn Student"}</p>
        <p class="certificate-body">has successfully completed all topics in ${subject.name} on InstaLearn.</p>
        <p class="certificate-date">${dateStr}</p>
    `;

    document.getElementById("certificateOverlay").classList.remove("hidden");
}

function closeCertificate() {
    document.getElementById("certificateOverlay").classList.add("hidden");
}

function printCertificate() {
    const content = document.getElementById("certificateContent");
    const printable = document.getElementById("printableReport");
    if (!content || !printable) return;

    printable.innerHTML = `<div class="certificate-content">${content.innerHTML}</div>`;
    window.print();
}


/* ================= EXPORT PROGRESS REPORT ================= */

function exportProgressReport() {
    const user = getCurrentUserData();
    if (!user) return;

    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const rows = user.subjects
        .map(id => {
            const subject = subjects[id];
            if (!subject) return "";
            const progress = user.progress[id] || 0;
            return `
                <tr>
                    <td>${subject.icon} ${subject.name}</td>
                    <td>${progress}%</td>
                    <td>${progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started"}</td>
                </tr>
            `;
        })
        .join("");

    document.getElementById("printableReport").innerHTML = `
        <h1>InstaLearn Progress Report</h1>
        <p>Student: ${user.name || "—"}</p>
        <p>Email: ${user.email || "—"}</p>
        <p>Date generated: ${dateStr}</p>
        <table>
            <thead>
                <tr><th>Subject</th><th>Progress</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${rows || "<tr><td colspan='3'>No subjects yet.</td></tr>"}
            </tbody>
        </table>
        <p>Total questions answered: ${user.totalQuestions || 0}</p>
        <p>Current streak: ${user.streak || 0} day(s)</p>
    `;

    window.print();
}


/* ================= SETTINGS ================= */

function seedDemoData() {

    const user = getCurrentUserData();
    if (!user) return;

    if (!user.subjects.length) {
        user.subjects = ["math", "science", "english", "computer", "history", "geography"];
    }

    user.progress = {
        math: 78,
        science: 55,
        english: 90,
        computer: 40,
        history: 65,
        geography: 30
    };

    user.totalQuestions = 142;
    user.streak = 7;

    const today = new Date();
    const daysAgo = n => new Date(today.getTime() - n * 86400000).toLocaleDateString();

    user.activities = [
        { subject: "math", difficulty: "Medium", score: 8, total: 10, date: daysAgo(0) },
        { subject: "english", difficulty: "Hard", score: 9, total: 10, date: daysAgo(1) },
        { subject: "science", difficulty: "Easy", score: 7, total: 10, date: daysAgo(2) },
        { subject: "history", difficulty: "Medium", score: 6, total: 10, date: daysAgo(3) },
        { subject: "computer", difficulty: "Easy", score: 8, total: 10, date: daysAgo(4) }
    ];

    saveCurrentUserData(user);

    updateUserUI();
    renderDashboardSubjects();
    renderDashboardProgressChart();
    renderActivities();
    renderLearningDashboard();
    renderProgress();
    renderSettingsSubjects();

    showToast("Demo data loaded.");

}

function resetProgressData() {

    const user = getCurrentUserData();
    if (!user) return;

    if (!confirm("Reset all progress, streak, and activity back to zero?")) return;

    Object.keys(user.progress).forEach(id => {
        user.progress[id] = 0;
    });

    user.totalQuestions = 0;
    user.streak = 1;
    user.activities = [];

    saveCurrentUserData(user);

    updateUserUI();
    renderDashboardSubjects();
    renderDashboardProgressChart();
    renderActivities();
    renderLearningDashboard();
    renderProgress();
    renderSettingsSubjects();

    showToast("Progress reset.");

}

function openSettings() {
    if (!showSection("settingsSection")) return;

    setActiveNav(3);

    updateUserUI();

    renderSettingsSubjects();

    const user = getCurrentUserData();
    const goal = document.getElementById("learningGoal");
    if (goal) goal.value = user?.learningGoal || "Improve my grades";

}


function openHelp() {
    if (!showSection("helpSection")) return;
    setActiveNav(4);
}


function openAbout() {
    if (!showSection("aboutSection")) return;
    setActiveNav(5);
}


function submitFeedback() {

    const type = document.getElementById("feedbackType")?.value || "Other";
    const messageEl = document.getElementById("feedbackMessage");
    const message = messageEl ? messageEl.value.trim() : "";
    const status = document.getElementById("feedbackStatus");

    if (!message) {
        if (status) {
            status.textContent = "Please enter some details before sending.";
            status.classList.remove("hidden");
        }
        return;
    }

    try {
        const key = "instalearn_feedback";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");

        existing.push({
            type,
            message,
            date: new Date().toISOString(),
            user: getCurrentUserData()?.email || "guest"
        });

        localStorage.setItem(key, JSON.stringify(existing));

    } catch (err) {
        console.error("Could not save feedback:", err);
    }

    if (messageEl) messageEl.value = "";

    if (status) {
        status.textContent = "Thanks! Your feedback has been sent to the InstaLearn team.";
        status.classList.remove("hidden");
    }
}


function renderSettingsSubjects() {

    const container =
        document.getElementById("settingsSubjects");

    const user =
        getCurrentUserData();

    if (!container || !user) return;

    if (user.subjects.length === 0) {

        container.innerHTML =
            `<p class="muted">No subjects selected.</p>`;

        return;
    }

    container.innerHTML =
        user.subjects
            .map(id => `<span>${subjects[id].icon} ${subjects[id].name}</span>`)
            .join("");

}


/* ================= SAVE PROFILE ================= */

function saveProfile() {

    const user =
        getCurrentUserData();

    if (!user) return;

    const name =
        document.getElementById("settingsName")
            .value.trim();

    if (!name) {

        showToast("Display name cannot be empty.");

        return;
    }

    const confirmed = window.confirm(
        "Save these profile changes?"
    );

    if (!confirmed) {
        return;
    }

    user.name = name;

    saveCurrentUserData(user);

    updateUserUI();

    showToast("Profile updated successfully.");

}


/* ================= PHOTO UPLOAD ================= */

document.addEventListener("DOMContentLoaded", () => {

    const upload =
        document.getElementById("photoUpload");

    upload.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            showToast("Please upload an image.");

            return;
        }

        const reader =
            new FileReader();

        reader.onload = function(event) {

            const user =
                getCurrentUserData();

            user.photo =
                event.target.result;

            saveCurrentUserData(user);

            updateUserUI();

            showToast("Display photo updated.");

        };

        reader.readAsDataURL(file);

    });

});


/* ================= EMAIL VERIFICATION ================= */

function showVerificationGate(firebaseUser) {
    const email = firebaseUser?.email || localStorage.getItem("instaLearnPendingVerificationEmail") || "your Gmail";
    const emailText = document.getElementById("verificationEmailText");
    if (emailText) emailText.textContent = email;

    localStorage.setItem("instaLearnPendingVerificationEmail", email);
    localStorage.removeItem("instaLearnCurrentUser");
    showPage("verificationPage");
}

function clearPendingVerification() {
    localStorage.removeItem("instaLearnPendingVerificationEmail");
}

async function logoutFromVerification() {
    try {
        await auth.signOut();
    } catch (error) {
        console.warn("Verification logout failed:", error);
    }

    currentUser = null;
    clearPendingVerification();
    localStorage.removeItem("instaLearnCurrentUser");
    showPage("welcomePage");
    forceLightMode();
}

async function resendVerificationEmail() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
        showToast("Please log in again to resend the verification email.");
        showPage("loginPage");
        return;
    }

    if (firebaseUser.emailVerified) {
        showToast("Your Gmail is already verified.");
        return;
    }

    const confirmed = window.confirm(
        `Send a verification email to ${firebaseUser.email}?\n\nYou will need to open that Gmail account and click Firebase's secure verification link.`
    );
    if (!confirmed) return;

    try {
        await firebaseUser.sendEmailVerification();
        showToast("Verification email sent. Check your Gmail Inbox and Spam folder.");
    } catch (error) {
        showToast(firebaseErrorMessage(error));
    }
}

async function refreshEmailVerificationStatus(showSuccessToast = false) {
    const firebaseUser = auth.currentUser;
    const banner = document.getElementById("emailVerificationBanner");
    if (!firebaseUser) return false;

    try {
        await firebaseUser.reload();
    } catch (error) {
        console.warn("Could not refresh verification status:", error);
    }

    if (auth.currentUser?.emailVerified) {
        if (banner) banner.classList.add("hidden");
        clearPendingVerification();
        localStorage.setItem("instaLearnCurrentUser", auth.currentUser.email);
        if (showSuccessToast) showToast("Gmail verified successfully. Welcome to InstaLearn!");
        if (!appInitialized) {
            loadApp();
        }
        return true;
    }

    if (banner) banner.classList.remove("hidden");
    showVerificationGate(auth.currentUser);
    if (showSuccessToast) showToast("Your Gmail is still not verified. Open the latest verification email first.");
    return false;
}

async function checkEmailVerification() {
    await refreshEmailVerificationStatus(true);
}

/* ================= CHANGE PASSWORD ================= */

async function sendSettingsResetEmail() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) {
        showToast("Please log in again.");
        return;
    }

    const confirmed = window.confirm(
        `Send a secure password reset email to ${firebaseUser.email}?\n\nOpen the email in Gmail and follow Firebase's secure link to choose a new password.`
    );
    if (!confirmed) return;

    try {
        await auth.sendPasswordResetEmail(firebaseUser.email);
        showToast("Reset email sent. Check your Gmail Inbox and Spam folder.");
    } catch (error) {
        showToast(firebaseErrorMessage(error));
    }
}

async function changePassword() {

    const user = getCurrentUserData();
    const firebaseUser = auth.currentUser;

    if (!user || !firebaseUser) {
        showToast("Please log in again.");
        return;
    }

    const current = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmNewPassword").value;

    if (!current) {
        showToast("Enter your current password.");
        return;
    }

    if (newPassword.length < 8) {
        showToast("New password must be at least 8 characters.");
        return;
    }

    if (newPassword !== confirm) {
        showToast("New passwords do not match.");
        return;
    }

    if (current === newPassword) {
        showToast("Your new password must be different.");
        return;
    }

    const confirmed = window.confirm(
        "Update your InstaLearn password now?\n\nYou will use the new password the next time you log in."
    );

    if (!confirmed) {
        return;
    }

    // Extra security step: require the Gmail security code before the
    // password change actually goes through.
    const codeVerified = await requestSecurityCode(
        firebaseUser.email,
        `For your security, we sent a code to ${firebaseUser.email}. Enter it to confirm this password change.`
    );

    if (!codeVerified) {
        showToast("Password change cancelled.");
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(
            firebaseUser.email,
            current
        );

        await firebaseUser.reauthenticateWithCredential(credential);
        await firebaseUser.updatePassword(newPassword);

        // Keep only the time of the password change, never the password itself.
        // This lets the login screen remind the user when they recently changed it.
        user.passwordChangedAt = Date.now();
        delete user.password;
        saveCurrentUserData(user);

        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmNewPassword").value = "";
        document.getElementById("newPasswordStrength")?.classList.add("hidden");

        showToast("Password updated successfully.");

    } catch (error) {
        showToast(firebaseErrorMessage(error));
    }
}


/* ================= ACTIVITIES ================= */

function renderActivities() {

    const container =
        document.getElementById("recentActivity");

    const user =
        getCurrentUserData();

    if (!container || !user) return;

    if (!user.activities.length) {

        container.innerHTML = `
            <div class="activity-item">
                <div class="empty-state-icon">📭</div>
                <div>
                    <strong>No practice activity yet.</strong>
                    <span>Start a practice session to see it here.</span>
                    <button class="btn primary" style="margin-top:10px;" onclick="openSubjects()">Start Practice</button>
                </div>
            </div>
        `;

        return;
    }

    container.innerHTML =
        user.activities
            .slice(0, 5)
            .map(activity => {

                const subject =
                    subjects[activity.subject];

                return `
                    <div class="activity-item">

                        <div>

                            <strong>
                                ${subject.icon}
                                ${subject.name} — ${activity.difficulty}
                            </strong>

                            <span>
                                ${activity.date}
                            </span>

                        </div>

                        <span class="activity-score">
                            ${activity.score}/${activity.total}
                        </span>

                    </div>
                `;

            })
            .join("");

}


/* ================= OVERALL PROGRESS ================= */

function calculateOverallProgress() {

    const user =
        getCurrentUserData();

    if (!user) return;

    const selected =
        user.subjects;

    if (!selected.length) {

        document.getElementById("overallProgress")
            .textContent = "0%";

        return;
    }

    const total =
        selected.reduce(
            (sum, id) =>
                sum + (user.progress[id] || 0),
            0
        );

    const average =
        Math.round(total / selected.length);

    document.getElementById("overallProgress")
        .textContent = average + "%";

}


/* ================= NAV ================= */

function setActiveNav(index) {

    document.querySelectorAll(".nav-item")
        .forEach((item, i) => {

            item.classList.toggle(
                "active",
                i === index
            );

        });

}


/* ================= LOGOUT ================= */

async function logout() {

    const confirmed = window.confirm(
        "Are you sure you want to log out of InstaLearn?"
    );

    if (!confirmed) {
        return;
    }

    await forceLogout();
}

async function forceLogout() {

    try {
        await auth.signOut();
    } catch (error) {
        showToast(firebaseErrorMessage(error));
        return;
    }

    localStorage.removeItem("instaLearnCurrentUser");

    currentUser = null;
    appInitialized = false;

    clearTimeout(inactivityTimer);
    clearInterval(autoLogoutCountdownTimer);
    document.getElementById("autoLogoutOverlay")?.classList.add("hidden");

    const chatWindow = document.getElementById("chatWindow");
    if (chatWindow) {
        chatWindow.classList.remove("open");
    }
    syncChatButtonVisibility();

    showToast("Logged out successfully.");

    setTimeout(() => {
        showPage("welcomePage");
        forceLightMode();
    }, 300);

}


/* ================= PASSWORD TOGGLE ================= */

function togglePassword(inputId, button) {

    const input =
        document.getElementById(inputId);

    if (input.type === "password") {

        input.type = "text";
        button.textContent = "Hide";

    } else {

        input.type = "password";
        button.textContent = "Show";

    }

}


/* ================= MOBILE SIDEBAR ================= */

function toggleSidebar() {

    document.querySelector(".sidebar")
        .classList.toggle("open");

}


/* ================= CHATBOT ================= */

function syncChatButtonVisibility() {
    const windowEl = document.getElementById("chatWindow");
    const buttonEl = document.getElementById("chatButton");
    if (!windowEl || !buttonEl) return;
    buttonEl.classList.toggle("chat-button-hidden", windowEl.classList.contains("open"));
}

function toggleChat() {
    const windowEl = document.getElementById("chatWindow");
    if (!windowEl) return;
    windowEl.classList.toggle("open");
    syncChatButtonVisibility();
    if (windowEl.classList.contains("open")) {
        setTimeout(() => document.getElementById("chatInput")?.focus(), 80);
    }
}

function handleChatKey(event) {
    if (event.key === "Enter") sendChat();
}

function showTypingIndicator() {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "bot-message typing-indicator";
    div.id = "chatTypingIndicator";
    div.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    document.getElementById("chatTypingIndicator")?.remove();
}

function sendChat() {
    const input = document.getElementById("chatInput");
    const message = input?.value.trim();
    if (!message) return;
    addChatMessage(message, "user");
    input.value = "";
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        const result = getBotResponse(message);
        addChatMessage(result.reply, "bot");
        if (result.action) result.action();
    }, 280);
}

function askBot(message) {
    addChatMessage(message, "user");
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        const result = getBotResponse(message);
        addChatMessage(result.reply, "bot");
        if (result.action) result.action();
    }, 220);
}

document.addEventListener("click", function (event) {
    const windowEl = document.getElementById("chatWindow");
    const buttonEl = document.getElementById("chatButton");
    if (!windowEl || !windowEl.classList.contains("open")) return;
    if (windowEl.contains(event.target) || buttonEl?.contains(event.target)) return;
    windowEl.classList.remove("open");
    syncChatButtonVisibility();
});

function openChatWith(message) {
    const chat = document.getElementById("chatWindow");
    if (chat && !chat.classList.contains("open")) chat.classList.add("open");
    syncChatButtonVisibility();
    askBot(message);
}

function addChatMessage(message, type) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = type === "user" ? "user-message" : "bot-message";
    div.textContent = message;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function chatbotHas(text, words) {
    return words.some(word => text.includes(word));
}

function getBotResponse(message) {
    const text = String(message || "").toLowerCase().trim();

    if (chatbotHas(text, ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "yo"])) {
        return { reply: "Hello! 👋 I'm the InstaLearn Assistant. I can help you navigate the website, explain how features work, and guide you through your account, subjects, lessons, practice, progress, settings, password reset, verification, and more. I stay focused on InstaLearn rather than general questions." };
    }
    if (chatbotHas(text, ["who are you", "what are you", "your name", "are you ai"])) {
        return { reply: "I'm the InstaLearn Assistant — your built-in website guide. I'm focused on InstaLearn itself, so I can explain features, guide you around the site, and help with account and navigation questions. I don't answer unrelated general questions." };
    }

    // Navigation commands actually move the user around the website.
    if (chatbotHas(text, ["dashboard", "home page", "home", "main page"]) && chatbotHas(text, ["go", "open", "take", "show", "where", "navigate", "bring"])) {
        return { reply: "Sure — opening your Dashboard now.", action: () => openDashboard() };
    }
    if (chatbotHas(text, ["subject", "subjects", "learning library"]) && chatbotHas(text, ["go", "open", "take", "show", "where", "navigate", "browse"])) {
        return { reply: "Sure — opening My Subjects so you can browse your learning options.", action: () => openSubjects() };
    }
    if (chatbotHas(text, ["progress", "my progress", "performance"]) && chatbotHas(text, ["go", "open", "take", "show", "where", "navigate", "see"])) {
        return { reply: "Opening your Progress page.", action: () => openProgress() };
    }
    if (chatbotHas(text, ["settings", "account settings", "profile settings"]) && chatbotHas(text, ["go", "open", "take", "show", "where", "navigate"])) {
        return { reply: "Opening Settings for you.", action: () => openSettings() };
    }
    if (chatbotHas(text, ["practice", "quiz", "test"]) && chatbotHas(text, ["go", "open", "take", "start", "practice now"])) {
        if (currentSubject && subjects[currentSubject]) return { reply: `Opening ${subjects[currentSubject].name} practice setup.`, action: () => openPracticeSetup() };
        return { reply: "Choose a subject first, then I can take you directly to its practice setup.", action: () => openSubjects() };
    }

    if (chatbotHas(text, ["login", "log in", "sign in", "signin"])) {
        return { reply: "To log in, use Login from the Welcome page, enter your registered Gmail and password, then press Login. If your password is wrong, InstaLearn can show a reminder when a recent password change was saved." };
    }
    if (chatbotHas(text, ["register", "sign up", "signup", "create account", "new account"])) {
        return { reply: "To create an account, choose Create Account on the Welcome page, enter your display name, Gmail, password, confirm the password, accept the Terms, and submit. A verification email is sent after registration." };
    }
    if (chatbotHas(text, ["reset", "forgot", "forgotten", "recover"]) && chatbotHas(text, ["pass", "password", "account"])) {
        return { reply: "If you forgot or want to reset your password, open the Forgot Password option on the Login page, enter your registered Gmail, and request the secure reset email. Check Spam/Junk too if you don't see it in your inbox." };
    }
    if (chatbotHas(text, ["change password", "update password", "new password", "password change", "password changed"])) {
        return { reply: "To change your password, go to Settings → Change Password. Enter your current password, your new password, confirm it, then choose Update Password. InstaLearn also records a recent password-change reminder for the login screen on this browser." };
    }
    if (chatbotHas(text, ["verification", "verify email", "verified", "verification email", "verify gmail"])) {
        return { reply: "After creating your account, InstaLearn sends a verification email to your Gmail. Check Inbox and Spam/Junk. Inside the app, use Resend email if needed, or choose I already verified after confirming the email." };
    }
    if (chatbotHas(text, ["logout", "log out", "sign out"])) {
        return { reply: "You can log out using the Logout button at the bottom of the sidebar." };
    }

    if (chatbotHas(text, ["learn", "lesson", "learning", "topic", "topics"])) {
        return { reply: "For lessons, open My Subjects → choose a subject → Start Learning. Each subject has a learning path with topics, explanations, quick tips, progress, and a Mark Lesson Complete button." };
    }
    if (chatbotHas(text, ["subject", "subjects", "choose", "select"])) {
        return { reply: "Open My Subjects to choose what you want to study. Selected subjects can be opened for learning and practice, and you can remove a selected subject whenever you want." };
    }
    if (chatbotHas(text, ["practice", "quiz", "difficulty", "easy", "medium", "hard"])) {
        return { reply: "To practice, open a subject → Practice → choose Easy, Medium, or Hard. Each practice session contains 10 questions, then InstaLearn shows your score, accuracy, correct answers, and wrong answers." };
    }
    if (chatbotHas(text, ["score", "result", "accuracy", "correct", "wrong"])) {
        return { reply: "After a practice session, InstaLearn shows your score out of 10, percentage, correct answers, wrong answers, and accuracy. Your subject progress can also increase based on your result." };
    }
    if (chatbotHas(text, ["progress", "streak", "achievement", "achievements"])) {
        return { reply: "Open Progress to see subject mastery and achievements. Your dashboard also shows overall progress, questions answered, and your learning streak." };
    }
    if (chatbotHas(text, ["goal", "learning goal", "personalize", "personalized"])) {
        return { reply: "You can set your Primary Learning Goal in Settings → Learning Preferences. The dashboard uses it to personalize your Learning Plan message." };
    }
    if (chatbotHas(text, ["profile", "display name", "photo", "picture", "avatar"])) {
        return { reply: "Go to Settings → Profile to update your display name and upload a profile photo. Your profile information is reflected across the student dashboard." };
    }
    if (chatbotHas(text, ["tutor", "teacher", "human help", "human support", "help from tutor"])) {
        return { reply: "InstaLearn is designed to support human tutoring too. The dashboard has a Tutor Help area where a real tutor request flow can be connected for the client. For now, the button is a prototype action." };
    }
    if (chatbotHas(text, ["schedule", "booking", "book a session", "session", "appointment"])) {
        return { reply: "Tutor scheduling is planned as a business feature for InstaLearn. The current student interface is prepared for a future session calendar and booking flow, but it does not create real appointments yet." };
    }
    if (chatbotHas(text, ["chatbot", "assistant", "what can you do", "help me"])) {
        return { reply: "I can help with InstaLearn navigation and features: login, registration, password reset/change, email verification, subjects, lessons, practice, scores, progress, achievements, learning goals, profile settings, tutor support, and where to find things. I stay focused on InstaLearn rather than general questions." };
    }

    return { reply: "I can help with InstaLearn itself. Try asking: ‘How do I reset my password?’, ‘Where is Progress?’, ‘How do I practice?’, ‘How do I verify my Gmail?’, ‘Take me to Settings’, or ‘What can you do?’" };
}

/* ================= TOAST ================= */

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2800);

}


/* ================= PROGRESS BAR ANIMATION ================= */
(function () {
    function animateBar(el) {
        if (!el || el.dataset.barAnimated) return;
        const target = el.style.width;
        if (!target || target === "0%") return;
        el.dataset.barAnimated = "1";
        el.style.width = "0%";
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { el.style.width = target; });
        });
    }
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.matches?.(".progress-bar > div")) animateBar(node);
                node.querySelectorAll?.(".progress-bar > div").forEach(animateBar);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
