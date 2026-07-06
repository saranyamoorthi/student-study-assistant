/* ==========================================================================
   GLOBAL APP STATE
   ========================================================================== */
let appState = {
    streak: 0,
    focusMinutes: 0,
    quizzesSolved: 0,
    quizCorrectAnswers: 0,
    quizTotalQuestions: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    theme: 'dark',
    lastActiveDay: null,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0] // Mon-Sun focus times
};

// Pomodoro Timer State
let timerInterval = null;
let timerSecondsRemaining = 25 * 60;
let timerTotalDuration = 25 * 60;
let timerModeName = 'Focus';
let timerIsRunning = false;
let soundEnabled = true;

// Active Study Plan State
let activeStudyPlan = null;

// Summarizer State
let activeSummaryDepth = 'bullets';
let activeSummaryResults = null;
let activeFlashcards = [];
let currentFlashcardIndex = 0;

// Quiz State
let quizActiveQuestions = [];
let quizCurrentIndex = 0;
let quizUserScore = 0;
let quizSelectedOptionIndex = null;
let quizIsAnswerSubmitted = false;

/* ==========================================================================
   DOM INITIALIZATION & DATA LOADING
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();
    initTheme();
    updateDateDisplay();
    updateGreeting();
    updateDashboardStats();
    renderAnalyticsChart();
    initQuotes();
    loadActiveStudyPlan();
    renderResourceLibrary();
});

// Load App state
function loadStateFromStorage() {
    const savedState = localStorage.getItem('aegis_study_state');
    if (savedState) {
        try {
            appState = { ...appState, ...JSON.parse(savedState) };
        } catch (e) {
            console.error("Error reading study state", e);
        }
    }
    
    // Check and update study streaks based on dates
    checkStreakLogic();
}

function saveStateToStorage() {
    localStorage.setItem('aegis_study_state', JSON.stringify(appState));
}

// Streak logic validation
function checkStreakLogic() {
    const todayStr = new Date().toDateString();
    
    if (appState.lastActiveDay === null) {
        // First time
        appState.streak = 1;
        appState.lastActiveDay = todayStr;
    } else {
        const lastDay = new Date(appState.lastActiveDay);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today - lastDay);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Next day consecutive
            appState.streak += 1;
            appState.lastActiveDay = todayStr;
        } else if (diffDays > 1) {
            // Broken streak
            appState.streak = 1;
            appState.lastActiveDay = todayStr;
        }
    }
    saveStateToStorage();
}

// Format Header Date
function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateText = new Date().toLocaleDateString('en-US', options);
    document.getElementById('date-text').innerText = dateText;
}

// Format Greeting
function updateGreeting() {
    const hrs = new Date().getHours();
    let greet = "Good morning, Scholar! ☀️";
    if (hrs >= 12 && hrs < 17) {
        greet = "Good afternoon, Scholar! 🌤️";
    } else if (hrs >= 17 && hrs < 22) {
        greet = "Good evening, Scholar! 🌙";
    } else if (hrs >= 22 || hrs < 4) {
        greet = "Burning the midnight oil? 💡";
    }
    document.getElementById('greeting-text').innerText = greet;
}

/* ==========================================================================
   THEME MANAGER
   ========================================================================== */
function initTheme() {
    document.documentElement.setAttribute('data-theme', appState.theme);
    updateThemeButtonUI();
}

function toggleTheme() {
    appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', appState.theme);
    updateThemeButtonUI();
    saveStateToStorage();
}

function updateThemeButtonUI() {
    const btnText = document.getElementById('theme-text');
    if (appState.theme === 'light') {
        btnText.innerText = "Dark Mode";
    } else {
        btnText.innerText = "Light Mode";
    }
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

/* ==========================================================================
   TAB VIEW SWITCHER
   ========================================================================== */
function switchTab(tabId) {
    // Update navigation active states
    document.querySelectorAll('.nav-item').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update panel active states
    document.querySelectorAll('.tab-panel').forEach(panel => {
        if (panel.id === tabId) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
    
    // Scroll window back to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        switchTab(tabId);
    });
});

/* ==========================================================================
   DAILY MOTIVATIONAL QUOTES
   ========================================================================== */
const motivationQuotes = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Productivity is being able to do things that you were never able to do before.", author: "Franz Kafka" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
    { text: "Failure is the opportunity to begin again more intelligently.", author: "Henry Ford" },
    { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
    { text: "Don't let what you cannot do interfere with what you can do.", author: "John Wooden" },
    { text: "There are no shortcuts to any place worth going.", author: "Beverly Sills" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
];

function initQuotes() {
    displayNewQuote();
    document.getElementById('refresh-quote-btn').addEventListener('click', displayNewQuote);
}

function displayNewQuote() {
    const randomIndex = Math.floor(Math.random() * motivationQuotes.length);
    const quote = motivationQuotes[randomIndex];
    document.getElementById('motivational-quote').innerHTML = `"${quote.text}" &mdash; <em>${quote.author}</em>`;
}

/* ==========================================================================
   POMODORO FOCUS TIMER MODULE (WEB AUDIO CHIMES)
   ========================================================================== */
function playChime(type) {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'start') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'complete') {
            // Focus completed fanfare
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } else if (type === 'tick') {
            // Subtle woodblock clock tick
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1000, ctx.currentTime);
            gain.gain.setValueAtTime(0.02, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        }
    } catch (e) {
        console.warn("Web Audio chime blocked/unsupported:", e);
    }
}

function toggleTimerSound() {
    soundEnabled = !soundEnabled;
    const soundOn = document.querySelector('.sound-on-icon');
    const soundOff = document.querySelector('.sound-off-icon');
    if (soundEnabled) {
        soundOn.classList.remove('hidden');
        soundOff.classList.add('hidden');
    } else {
        soundOn.classList.add('hidden');
        soundOff.classList.remove('hidden');
    }
}

function setTimerMode(minutes, modeLabel, btn) {
    if (timerIsRunning) {
        clearInterval(timerInterval);
        timerIsRunning = false;
        document.getElementById('timer-start').innerText = "Start Focus";
    }
    
    // Toggle active classes
    document.querySelectorAll('.mode-btn').forEach(mBtn => mBtn.classList.remove('active'));
    btn.classList.add('active');

    timerSecondsRemaining = minutes * 60;
    timerTotalDuration = minutes * 60;
    timerModeName = modeLabel;
    
    document.getElementById('timer-status').innerText = `Ready for ${timerModeName}`;
    updateTimerDisplay();
    updateTimerProgressRing();
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSecondsRemaining / 60);
    const secs = timerSecondsRemaining % 60;
    const displayStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').innerText = displayStr;
}

function updateTimerProgressRing() {
    const ring = document.getElementById('timer-progress-bar');
    const totalCircumference = 502; // 2 * PI * 80
    const fractionElapsed = (timerTotalDuration - timerSecondsRemaining) / timerTotalDuration;
    const dashoffset = totalCircumference - (fractionElapsed * totalCircumference);
    ring.style.strokeDashoffset = dashoffset;
}

function toggleTimer() {
    const startBtn = document.getElementById('timer-start');
    if (timerIsRunning) {
        // Pause timer
        clearInterval(timerInterval);
        timerIsRunning = false;
        startBtn.innerText = "Resume";
        document.getElementById('timer-status').innerText = `${timerModeName} Paused`;
    } else {
        // Start/Resume timer
        timerIsRunning = true;
        startBtn.innerText = "Pause";
        document.getElementById('timer-status').innerText = `Focusing... 🎯`;
        playChime('start');
        
        timerInterval = setInterval(() => {
            timerSecondsRemaining--;
            updateTimerDisplay();
            updateTimerProgressRing();
            
            if (timerSecondsRemaining % 60 === 0 && timerSecondsRemaining > 0) {
                // Heartbeat tick at minute counts
                playChime('tick');
            }

            if (timerSecondsRemaining <= 0) {
                clearInterval(timerInterval);
                timerIsRunning = false;
                startBtn.innerText = "Restart Session";
                document.getElementById('timer-status').innerText = `${timerModeName} Session Done! 🎉`;
                playChime('complete');
                
                // Track study statistics if it was a Focus session
                if (timerModeName === 'Focus') {
                    logFocusTime(Math.round(timerTotalDuration / 60));
                }
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerIsRunning = false;
    timerSecondsRemaining = timerTotalDuration;
    document.getElementById('timer-start').innerText = "Start Focus";
    document.getElementById('timer-status').innerText = `Ready for ${timerModeName}`;
    updateTimerDisplay();
    updateTimerProgressRing();
}

function logFocusTime(minutes) {
    appState.focusMinutes += minutes;
    
    // Add to current weekday
    let currentDayIndex = new Date().getDay(); // 0 is Sunday, 1-6 Mon-Sat
    // Map Sunday = 6, Mon-Sat = 0-5
    let mappedIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
    appState.weeklyActivity[mappedIndex] += minutes;
    
    saveStateToStorage();
    updateDashboardStats();
    renderAnalyticsChart();
}

/* ==========================================================================
   PROGRESS STATISTICS AND ANALYTICS CHART
   ========================================================================== */
function updateDashboardStats() {
    document.getElementById('stat-streak').innerText = `${appState.streak} Day${appState.streak === 1 ? '' : 's'}`;
    document.getElementById('stat-focus-time').innerText = `${appState.focusMinutes}m`;
    document.getElementById('stat-quizzes').innerText = `${appState.quizzesSolved}`;
    
    // Quiz Accuracy
    const quizAccuracyRate = document.getElementById('stat-quiz-accuracy');
    if (appState.quizTotalQuestions > 0) {
        const accuracy = Math.round((appState.quizCorrectAnswers / appState.quizTotalQuestions) * 100);
        quizAccuracyRate.innerText = `Accuracy: ${accuracy}%`;
    } else {
        quizAccuracyRate.innerText = `Accuracy: --%`;
    }

    // Tasks Completed
    document.getElementById('stat-tasks').innerText = `${appState.tasksCompleted}`;
    const tasksRate = document.getElementById('stat-tasks-rate');
    if (appState.tasksCreated > 0) {
        const completionPercent = Math.round((appState.tasksCompleted / appState.tasksCreated) * 100);
        tasksRate.innerText = `Completion: ${completionPercent}%`;
    } else {
        tasksRate.innerText = `Completion: --%`;
    }
}

function renderAnalyticsChart() {
    const svg = document.getElementById('analytics-chart-svg');
    if (!svg) return;
    
    // Clear previous points and line paths
    const polyline = document.getElementById('chart-line');
    const pointsGroup = document.getElementById('chart-points');
    pointsGroup.innerHTML = '';
    
    const data = appState.weeklyActivity;
    const maxVal = Math.max(...data, 30); // scale height based on max minutes studied, minimum scale 30 min
    
    // Coordinates mapping: width 500, height 150.
    // X coords: Mon=40, Tue=113, Wed=186, Thu=260, Fri=333, Sat=406, Sun=480.
    const xCoords = [40, 113, 186, 260, 333, 406, 480];
    const chartHeight = 100; // grid height goes from y=20 to y=120
    const points = [];
    
    for (let i = 0; i < 7; i++) {
        const val = data[i];
        // Calculate y coordinate (invert since 0 is at top)
        const y = 120 - ((val / maxVal) * chartHeight);
        points.push(`${xCoords[i]},${y}`);
        
        // Render glowing circles
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "chart-point");
        circle.setAttribute("cx", xCoords[i]);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 5);
        circle.setAttribute("fill", "var(--color-bg-base)");
        circle.setAttribute("stroke", "var(--color-secondary)");
        circle.setAttribute("stroke-width", 3.5);
        
        // Tooltip description
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${val} minutes focused`;
        circle.appendChild(title);
        
        pointsGroup.appendChild(circle);
    }
    
    // Update polyline attributes
    polyline.setAttribute("points", points.join(" "));
}

function clearProgressData() {
    if (confirm("Are you sure you want to clear your study analytics and streak? This action cannot be undone.")) {
        appState.streak = 0;
        appState.focusMinutes = 0;
        appState.quizzesSolved = 0;
        appState.quizCorrectAnswers = 0;
        appState.quizTotalQuestions = 0;
        appState.tasksCreated = 0;
        appState.tasksCompleted = 0;
        appState.weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
        appState.lastActiveDay = null;
        
        saveStateToStorage();
        updateDashboardStats();
        renderAnalyticsChart();
        alert("Analytics reset successfully!");
    }
}

/* ==========================================================================
   AI CONCEPT EXPLAINER CORE
   ========================================================================== */
const conceptDatabase = {
    photosynthesis: {
        title: "Photosynthesis 🌱",
        eli5: "Think of a leaf as a tiny, solar-powered kitchen! The sun acts as the chef, carbon dioxide in the air is the raw ingredient, and water is what they drink. They cook all of this together to bake yummy glucose (their food sugar) and blow out clean oxygen as a byproduct for us to breathe!",
        standard: "Photosynthesis is the chemical process through which green plants, algae, and some bacteria convert light energy (usually solar) into chemical energy in the form of glucose. It is represented by the formula:<br><strong>6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂</strong>",
        advanced: "Photosynthesis takes place in cell organelles called chloroplasts, which contain chlorophyll. It occurs in two main phases:<br>1. <strong>Light-Dependent Reactions:</strong> In the thylakoid membranes, solar photons split H₂O molecules, generating oxygen, ATP, and NADPH.<br>2. <strong>Light-Independent Reactions (Calvin Cycle):</strong> Occurs in the stroma, using ATP and NADPH to reduce CO₂ into triose phosphate sugars (glucose precursor).",
        points: [
            "Chloroplasts capture light using green pigments called Chlorophyll.",
            "Water is split during the process, releasing vital oxygen gas.",
            "Sustains almost all life on Earth by generating oxygen and food layers."
        ],
        glossary: {
            "Chlorophyll": "The light-absorbing green pigment in plants.",
            "Calvin Cycle": "The enzymatic pathway that fixes carbon dioxide into organic molecules.",
            "Stomata": "Pores on the leaf surface enabling carbon dioxide absorption and oxygen release."
        }
    },
    quadraticformula: {
        title: "Quadratic Formula 📐",
        eli5: "Imagine trying to find where a roller coaster track crosses the flat ground. The quadratic formula is a magic key! If you type in the curves of the roller coaster (using variables a, b, and c), it immediately calculates the coordinates of the two ground crossing points.",
        standard: "The quadratic formula is a mathematical formula used to solve quadratic equations of the form ax² + bx + c = 0. The solutions are defined by:<br><strong>x = [-b ± √(b² - 4ac)] / 2a</strong>",
        advanced: "The quadratic formula resolves second-degree polynomials. The expression <strong>D = b² - 4ac</strong> under the radical is the <strong>discriminant</strong>:<br>- If D > 0, there are two distinct real roots.<br>- If D = 0, there is exactly one real root (a double root).<br>- If D < 0, there are two complex roots.",
        points: [
            "Derived directly by completing the square on the generic equation ax² + bx + c = 0.",
            "The '±' sign means you will normally compute two separate values.",
            "Works for any real coefficient variables, even when factoring fails."
        ],
        glossary: {
            "Discriminant": "The b² - 4ac value that indicates the root multiplicity.",
            "Parabola": "The symmetrical, open curve shape represented by a quadratic equation."
        }
    },
    gravity: {
        title: "Gravity 🍎",
        eli5: "Imagine placing a heavy bowling ball on a soft trampoline. It creates a deep sink! If you roll a tiny marble on the trampoline, it rolls downward toward the heavy ball. That is gravity! Heavy objects like Earth warp space, sliding smaller things toward them.",
        standard: "Gravity is a fundamental physical force of attraction that exists between any two masses, any two bodies, or particles of matter. On Earth, gravity accelerates falling objects at approximately <strong>9.8 m/s²</strong>.",
        advanced: "Gravity is explained by two models in physics:<br>1. <strong>Newton's Law of Universal Gravitation:</strong> F = G * (m₁m₂) / r², meaning the attractive force is directly proportional to masses and inversely proportional to the square of their distance.<br>2. <strong>Einstein's General Relativity:</strong> Space and time are merged into a 4D fabric (spacetime). Mass curves this fabric, and objects follow geodesic paths along this curvature.",
        points: [
            "One of the four fundamental forces of nature (the weakest, but infinite in range).",
            "Governs cosmic movement, keeping planets, moons, and galaxies in stable orbits.",
            "Keeps the atmosphere, oceans, and life bound safely to Earth."
        ],
        glossary: {
            "Spacetime": "The unified mathematical model blending space and time coordinates.",
            "Mass": "A measure of an object's resistance to acceleration, dictating gravitational force."
        }
    },
    celldivision: {
        title: "Cell Division & Mitosis 🔬",
        eli5: "Think of a cell as a tiny kitchen library. Before splitting, it makes a perfect photocopy of its recipe book (DNA). Then, it lines the copies up, moves them to opposite sides of the room, and builds a wall down the middle to make two identical kitchens!",
        standard: "Mitosis is a type of cell division in eukaryotic cells that results in two daughter cells, each having the same number and kind of chromosomes as the parent nucleus. It serves growth and repair functions.",
        advanced: "Mitosis progresses through four sequential stages (PMAT):<br>1. <strong>Prophase:</strong> Chromatin condenses; spindle fibers form.<br>2. <strong>Metaphase:</strong> Chromosomes align along the cellular equator.<br>3. <strong>Anaphase:</strong> Sister chromatids are separated and pulled to opposing poles.<br>4. <strong>Telophase:</strong> New nuclear membranes enclose the genetic clusters. Followed by <strong>cytokinesis</strong>.",
        points: [
            "Creates two identical clone cells from a single original cell.",
            "Key to multicellular development, wound healing, and cell turnovers.",
            "Strictly regulated by proteins to prevent tumor or cancer cells."
        ],
        glossary: {
            "Chromosomes": "Coiled thread-like packages containing genetic DNA information.",
            "Cytokinesis": "The final mechanical cleavage splitting the cytoplasm of the parent cell."
        }
    },
    recursion: {
        title: "Recursion 💻",
        eli5: "Imagine looking in two parallel mirrors and seeing reflections inside reflections forever. Or opening a Russian nesting doll: to find the prize inside, you keep opening smaller and smaller dolls (recursion) until you reach the tiniest, solid doll at the center (the base case) and stop!",
        standard: "Recursion is a method in computer science where a function calls itself directly or indirectly. It divides a complex problem into simpler sub-problems of the same type.",
        advanced: "Recursive algorithms utilize the execution call stack. Each recursive call places a new stack frame in memory. A recursive function must contain:<br>1. <strong>Base Case:</strong> The terminating condition which returns a direct value.<br>2. <strong>Recursive Case:</strong> The logic calling the function itself with reduced arguments, moving toward the base case.",
        points: [
            "Must have a base case, or it loops infinitely and causes stack overflows.",
            "Excellent for tree traversals, directory operations, and sorting structures.",
            "Often leads to simpler code but consumes more stack memory than iteration."
        ],
        glossary: {
            "Stack Overflow": "A terminal runtime error when the call stack memory is completely exhausted.",
            "Base Case": "The absolute conditional check that halts further recursive calls."
        }
    },
    frenchrevolution: {
        title: "French Revolution 🏰",
        eli5: "Imagine a playground where 98% of the kids do all the chores and pay for all the toys, while 2% of the kids get everything for free and boss everyone around. Eventually, the 98% get super mad, kick the bossy kids out, and write a new rulebook for equality!",
        standard: "The French Revolution (1789–1799) was a watershed period of radical social and political upheaval in France that led to the collapse of the absolute monarchy and established the foundation of democratic liberties.",
        advanced: "The revolution was triggered by financial insolvency, food scarcity, and an archaic class system (the Three Estates). Key milestones include the storming of the Bastille on July 14, 1789, the drafting of the Declaration of the Rights of Man, the Reign of Terror under Robespierre, and the rise of Napoleon Bonaparte.",
        points: [
            "Abolished feudalism and absolute royal privilege in France.",
            "Introduced universal human rights concepts across Europe.",
            "Paved the path for modern secular nation-states."
        ],
        glossary: {
            "Bastille": "A fortress-prison in Paris, representing royal tyranny.",
            "Third Estate": "The commoner class representing 98% of the French populace."
        }
    }
};

// Handle Suggesion Click
function applySuggestion(suggestionText) {
    document.getElementById('chat-input').value = suggestionText;
    // Auto submit
    handleChatSubmit(new Event('submit'));
}

function handleChatSubmit(event) {
    event.preventDefault();
    const inputField = document.getElementById('chat-input');
    const question = inputField.value.trim();
    if (!question) return;
    
    // Add user message to UI
    appendChatMessage('user', `<p>${escapeHTML(question)}</p>`);
    inputField.value = '';
    
    // Show typing indicator
    const indicator = document.getElementById('typing-indicator');
    indicator.classList.remove('hidden');
    
    // Scroll chat messages container
    const chatContainer = document.getElementById('chat-messages-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Simulate AI thinking and streaming
    setTimeout(() => {
        const responseHTML = generateAIResponse(question);
        indicator.classList.add('hidden');
        
        // Append response container, then stream content
        const uniqueId = 'ai-res-' + Date.now();
        appendChatMessage('system', `<div id="${uniqueId}"></div>`, '🤖');
        
        streamHTMLResponse(responseHTML, uniqueId);
    }, 1500);
}

function appendChatMessage(sender, contentHTML, avatar = '👤') {
    const chatContainer = document.getElementById('chat-messages-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    
    msgDiv.innerHTML = `
        <div class="message-avatar">${sender === 'user' ? '👤' : avatar}</div>
        <div class="message-bubble">${contentHTML}</div>
    `;
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Simple template generator for queries
function generateAIResponse(query) {
    const cleanQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mode = document.querySelector('input[name="explain-depth"]:checked').value;
    
    // Check database
    let matchKey = null;
    if (cleanQuery.includes('photosynthesis')) matchKey = 'photosynthesis';
    else if (cleanQuery.includes('quadratic') || cleanQuery.includes('formula')) matchKey = 'quadraticformula';
    else if (cleanQuery.includes('gravity')) matchKey = 'gravity';
    else if (cleanQuery.includes('cell') || cleanQuery.includes('mitosis') || cleanQuery.includes('division')) matchKey = 'celldivision';
    else if (cleanQuery.includes('recursion')) matchKey = 'recursion';
    else if (cleanQuery.includes('french') || cleanQuery.includes('revolution')) matchKey = 'frenchrevolution';
    
    if (matchKey) {
        const entry = conceptDatabase[matchKey];
        return compileAIResponseHTML(entry, mode);
    }
    
    // Dynamically handle generic topics (Science, History, Math, Tech templates)
    return compileGenericAIResponseHTML(query, mode);
}

function compileAIResponseHTML(entry, mode) {
    let mainExplanation = "";
    let modeLabel = "";
    
    if (mode === 'kid') {
        mainExplanation = entry.eli5;
        modeLabel = "Simplified Analogy (ELI5)";
    } else if (mode === 'normal') {
        mainExplanation = entry.standard;
        modeLabel = "Standard Academic Explanation";
    } else {
        mainExplanation = entry.advanced;
        modeLabel = "Advanced Concept Details";
    }
    
    let html = `<h3>${entry.title}</h3>
                <p class="badge" style="margin: 6px 0 12px 0;">Mode: ${modeLabel}</p>
                <div class="ai-section">
                    <div class="ai-section-title">💡 Explanation Summary</div>
                    <p>${mainExplanation}</p>
                </div>`;
                
    // Add bullets
    html += `<div class="ai-section">
                <div class="ai-section-title">📋 Key Concept Points</div>
                <ul class="ai-bullet-list">`;
    entry.points.forEach(pt => {
        html += `<li>${pt}</li>`;
    });
    html += `   </ul>
             </div>`;
             
    // Add glossary
    html += `<div class="ai-section">
                <div class="ai-section-title">📖 Core Terminology</div>`;
    for (const [term, def] of Object.entries(entry.glossary)) {
        html += `<div class="glossary-item"><strong>${term}:</strong> ${def}</div>`;
    }
    html += `</div>`;
    
    return html;
}

function compileGenericAIResponseHTML(query, mode) {
    // Generate an intelligent-looking fallback explanation based on query terms
    let category = "General Topic";
    let titleEmoji = "🎓";
    let explanation = "";
    let points = [];
    let glossary = {};
    
    if (query.match(/(python|code|javascript|c\+\+|java|html|programming|css|loop|array|function)/i)) {
        category = "Computer Science";
        titleEmoji = "💻";
        explanation = `Great programming question! To explain <strong>"${escapeHTML(query)}"</strong> in Computer Science, it helps to understand that computers require step-by-step instructions. `;
        if (mode === 'kid') {
            explanation += `Think of code like a kitchen recipe. You tell the computer exactly when to grab ingredients, stir them, or repeat steps.`;
            points = [
                "Computers read instructions top-to-bottom sequentially.",
                "Variables act as labeled storage boxes for data.",
                "Functions are reusable sets of commands."
            ];
            glossary = { "Syntax": "The correct spelling rules for code.", "Variables": "Small folders holding data names." };
        } else {
            explanation += `This topic relates to control flows and state variables. In programming, we structure code statements to allocate stack frames or manage heap space efficiently.`;
            points = [
                "Compilers verify statements against core language rules.",
                "Memory buffers store structural state items.",
                "Optimization helps algorithms complete cycles faster."
            ];
            glossary = { "Algorithm": "A step-by-step mathematical recipe to solve a problem.", "Runtime": "The time window when a program executes." };
        }
    } else if (query.match(/(atom|molecule|chemistry|water|physics|cell|biology|brain|reaction|space|planet)/i)) {
        category = "Natural Sciences";
        titleEmoji = "🔬";
        explanation = `Fascinating scientific inquiry! Science explores rules that define the universe. Exploring <strong>"${escapeHTML(query)}"</strong> involves understanding how microscopic components join together.`;
        if (mode === 'kid') {
            explanation += `Think of the universe as a giant Lego set. Everything you touch is made of tiny Lego bricks called atoms. They snap together in different arrangements to make everything!`;
            points = [
                "All physical items are made of particles too small to see with eyes.",
                "Forces pull or push items without direct touching.",
                "Energy cannot be destroyed, only transformed."
            ];
            glossary = { "Matter": "The structural stuff physical items are made of.", "Energy": "The power that lets things move or run." };
        } else {
            explanation += `This is governed by thermodynamic laws and chemical bonds. Physical laws dictate chemical stability, molecular orbitals, or gravitational attraction rules.`;
            points = [
                "Bonds form when atoms exchange or share valence electrons.",
                "Systems naturally decay toward higher thermodynamic disorder (entropy).",
                "Force variables change according to distance coordinates."
            ];
            glossary = { "Thermodynamics": "The branch of science dealing with heat and movement energy.", "Molecules": "Two or more atoms bonded together." };
        }
    } else if (query.match(/(math|equation|sum|fraction|divide|calculus|geometry|algebra|numbers)/i)) {
        category = "Mathematics";
        titleEmoji = "📐";
        explanation = `Let's tackle this math query! <strong>"${escapeHTML(query)}"</strong> represents a logical structure designed to calculate unknown proportions.`;
        if (mode === 'kid') {
            explanation += `Think of math as a puzzle game. You have clues (known numbers) and a mystery target (like 'x'). We move the puzzle blocks around until the mystery target stands alone!`;
            points = [
                "Equals sign (=) means both sides must weigh the exact same.",
                "Addition is the opposite of subtraction; division is the opposite of multiplication.",
                "Shapes can be measured using coordinate grids."
            ];
            glossary = { "Equation": "A math sentence showing two parts are equal.", "Variable": "A letter representing a mystery number." };
        } else {
            explanation += `This involves algebraic relationships and function evaluations. To solve, we perform balance operations on equations or compute derivatives to identify tangents.`;
            points = [
                "Constants define baseline functions.",
                "Derivatives identify instantaneous rates of change in curves.",
                "Symmetry simplifies mathematical calculations."
            ];
            glossary = { "Function": "A rule relating an input to an output.", "Theorem": "A mathematical statement proven to be true." };
        }
    } else {
        explanation = `Interesting query! Let's explore <strong>"${escapeHTML(query)}"</strong>. This is a topic that overlaps multiple academic pathways.`;
        if (mode === 'kid') {
            explanation += ` think of this concept like playing a team sport: everyone has a special position, and they work together under strict rules to achieve a shared goal.`;
            points = [
                "Understanding the basic vocabulary makes studying easier.",
                "Breaking big topics into small parts prevents stress.",
                "Active review helps ideas stay in your brain longer."
            ];
            glossary = { "Concept": "A big idea or mental picture of how something works.", "Syllabus": "A roadmap list of what to study." };
        } else {
            explanation += `Understanding this requires checking primary contextual details, structural definitions, and analyzing critical parameters.`;
            points = [
                "Contextual analysis reveals baseline influences.",
                "Cross-referencing terminology clears up confusion.",
                "Applying models helps predict output outcomes."
            ];
            glossary = { "Context": "The background details that clarify an event.", "Analysis": "Breaking down a topic to study its core features." };
        }
    }
    
    return `<h3>"${escapeHTML(query)}" ${titleEmoji}</h3>
            <p class="badge" style="margin: 6px 0 12px 0;">Category: ${category} | Mode: ${mode === 'kid' ? 'ELI5' : mode === 'normal' ? 'Standard' : 'Deep Dive'}</p>
            <div class="ai-section">
                <div class="ai-section-title">💡 Simplified Summary</div>
                <p>${explanation}</p>
            </div>
            <div class="ai-section">
                <div class="ai-section-title">📋 Key Takeaways</div>
                <ul class="ai-bullet-list">
                    ${points.map(pt => `<li>${pt}</li>`).join('')}
                </ul>
            </div>
            <div class="ai-section">
                <div class="ai-section-title">📖 Glossary terms</div>
                ${Object.entries(glossary).map(([term, def]) => `<div class="glossary-item"><strong>${term}:</strong> ${def}</div>`).join('')}
            </div>`;
}

// Stream simulated response
function streamHTMLResponse(html, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let index = 0;
    // Fast step intervals, skipping HTML tags
    const interval = setInterval(() => {
        if (index >= html.length) {
            clearInterval(interval);
            // Re-render full content once finished to guarantee all tags are fully complete
            container.innerHTML = html;
            
            // Scroll chat to bottom again
            const chatContainer = document.getElementById('chat-messages-container');
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return;
        }
        
        // If we hit an HTML tag, advance past it to avoid raw text tags appearing in UI
        if (html[index] === '<') {
            const endTagIndex = html.indexOf('>', index);
            if (endTagIndex !== -1) {
                index = endTagIndex + 1;
            } else {
                index++;
            }
        } else {
            index++;
        }
        
        container.innerHTML = html.substring(0, index) + '<span style="border-right: 2px solid var(--color-primary); margin-left: 2px; animation: blink 0.8s infinite;"></span>';
        
        // Scroll incrementally
        const chatContainer = document.getElementById('chat-messages-container');
        if (chatContainer.scrollHeight - chatContainer.scrollTop < 100) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }, 10);
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/* ==========================================================================
   STUDY PLANNER ENGINE
   ========================================================================== */
function generateStudyPlan(event) {
    event.preventDefault();
    const goal = document.getElementById('plan-goal').value.trim();
    const subject = document.getElementById('plan-subject').value;
    const level = document.getElementById('plan-level').value;
    const hours = document.getElementById('plan-hours').value;
    const duration = parseInt(document.getElementById('plan-duration').value);
    
    if (!goal) return;

    // Build timeline items
    const tasks = [];
    const subjectsPatterns = {
        Science: [
            "Review core science vocab & formulas.",
            "Map cell processes/chemical equations in a flowchart.",
            "Complete dynamic subject practice questions.",
            "Self-explain diagrams and functions aloud.",
            "Create spaced-repetition science cards.",
            "Take Science Arena practice quiz.",
            "Final review of difficult notes."
        ],
        Math: [
            "Draw formula cheat sheets & solve simple calculations.",
            "Solve medium equations with step-by-step guides.",
            "Work on word application problems.",
            "Timed-solve challenge worksheets.",
            "Take Math Arena practice quiz.",
            "Analyze and re-solve prior arithmetic errors.",
            "Practice speed drills on core equations."
        ],
        CS: [
            "Outline key programming concepts & algorithms.",
            "Write basic methods & build small functions.",
            "Conduct syntax debug exercises.",
            "Diagram memory allocation or call stacks.",
            "Build a modular helper mini-project.",
            "Take Programming Arena quiz.",
            "Review code structure and optimize performance."
        ],
        Humanities: [
            "Create history/theme timeline maps.",
            "Highlight core essay sources & read chapters.",
            "Draft summarized bullet outlines.",
            "Review flashcards of dates, names, or terminology.",
            "Draft short essay paragraphs matching sources.",
            "Take History Arena practice quiz.",
            "Final timeline revision."
        ],
        General: [
            "Organize target syllabus chapters and note pages.",
            "Active-recall read textbook chapters.",
            "Build detailed bullet-point summaries.",
            "Study vocabulary definitions.",
            "Take a subject mock quiz.",
            "Self-quiz using active flashcards.",
            "Review note cards and prepare."
        ]
    };

    const pattern = subjectsPatterns[subject] || subjectsPatterns.General;
    
    for (let day = 1; day <= duration; day++) {
        // Pick task item from pattern index
        const taskText = pattern[(day - 1) % pattern.length];
        tasks.push({
            day: day,
            task: taskText,
            completed: false
        });
    }

    activeStudyPlan = {
        title: `Plan: ${goal}`,
        subject: subject,
        level: level,
        hours: hours,
        duration: duration,
        tasks: tasks
    };

    localStorage.setItem('aegis_active_plan', JSON.stringify(activeStudyPlan));
    
    // Log new tasks to count
    appState.tasksCreated += duration;
    saveStateToStorage();
    updateDashboardStats();

    renderActiveStudyPlan();
}

function loadActiveStudyPlan() {
    const savedPlan = localStorage.getItem('aegis_active_plan');
    if (savedPlan) {
        try {
            activeStudyPlan = JSON.parse(savedPlan);
            renderActiveStudyPlan();
        } catch(e) {
            console.error("Error reading saved study plan", e);
        }
    }
}

function renderActiveStudyPlan() {
    const noPlanView = document.getElementById('no-plan-view');
    const activeView = document.getElementById('active-plan-view');
    const titleEl = document.getElementById('active-plan-title');
    const hoursEl = document.getElementById('active-plan-hours');
    const timelineContainer = document.getElementById('plan-timeline-container');
    
    if (!activeStudyPlan) {
        noPlanView.classList.remove('hidden');
        activeView.classList.add('hidden');
        return;
    }
    
    noPlanView.classList.add('hidden');
    activeView.classList.remove('hidden');
    
    titleEl.innerText = activeStudyPlan.title;
    hoursEl.innerText = `${activeStudyPlan.hours} hrs/day (${activeStudyPlan.level})`;
    
    timelineContainer.innerHTML = '';
    
    activeStudyPlan.tasks.forEach((item, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = `timeline-day`;
        
        dayDiv.innerHTML = `
            <div class="day-header">
                <span class="day-title">Day ${item.day}</span>
                <span class="day-status" id="day-status-${index}">${item.completed ? 'COMPLETED' : 'PENDING'}</span>
            </div>
            <label class="day-task-item ${item.completed ? 'completed' : ''}" id="day-label-${index}">
                <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="togglePlanTask(${index}, this)">
                <span>${item.task}</span>
            </label>
        `;
        timelineContainer.appendChild(dayDiv);
    });
}

function togglePlanTask(taskIndex, checkbox) {
    if (!activeStudyPlan) return;
    
    const taskCompletedState = checkbox.checked;
    activeStudyPlan.tasks[taskIndex].completed = taskCompletedState;
    
    // Update labels classes
    const label = document.getElementById(`day-label-${taskIndex}`);
    const statusText = document.getElementById(`day-status-${taskIndex}`);
    
    if (taskCompletedState) {
        label.classList.add('completed');
        statusText.innerText = 'COMPLETED';
        appState.tasksCompleted++;
    } else {
        label.classList.remove('completed');
        statusText.innerText = 'PENDING';
        appState.tasksCompleted = Math.max(0, appState.tasksCompleted - 1);
    }
    
    localStorage.setItem('aegis_active_plan', JSON.stringify(activeStudyPlan));
    saveStateToStorage();
    updateDashboardStats();
}

function clearActivePlan() {
    if (confirm("Are you sure you want to remove this study plan? Progress statistics will remain, but the checklist will clear.")) {
        // Decrease remaining incomplete tasks from count, if relevant
        if (activeStudyPlan) {
            const incompleteCount = activeStudyPlan.tasks.filter(t => !t.completed).length;
            appState.tasksCreated = Math.max(0, appState.tasksCreated - incompleteCount);
        }
        activeStudyPlan = null;
        localStorage.removeItem('aegis_active_plan');
        saveStateToStorage();
        updateDashboardStats();
        renderActiveStudyPlan();
    }
}

/* ==========================================================================
   SMART NOTES SUMMARIZER CORE
   ========================================================================== */
function setSummaryDepth(depth, btn) {
    activeSummaryDepth = depth;
    // Toggle active styles
    document.querySelectorAll('.summarizer-depth-picker button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function generateSummary() {
    const rawText = document.getElementById('summary-input').value.trim();
    if (rawText.length < 100) {
        alert("Please enter a longer note passage (minimum 100 characters) to analyze!");
        return;
    }
    
    // Hide empty placeholder
    document.getElementById('no-summary-view').classList.add('hidden');
    
    const resultView = document.getElementById('summary-result-view');
    const flashcardView = document.getElementById('flashcards-result-view');
    
    resultView.classList.add('hidden');
    flashcardView.classList.add('hidden');
    
    // Parse note text and generate summaries
    const cleanSentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    if (activeSummaryDepth === 'bullets') {
        resultView.classList.remove('hidden');
        let bulletHTML = `<h4>Summary Outline</h4><ul>`;
        
        // Pick the longest sentences as descriptive concepts
        const keySentences = cleanSentences.filter(s => s.length > 25).slice(0, 5);
        if (keySentences.length === 0) keySentences.push(cleanSentences[0]);
        
        keySentences.forEach(s => {
            bulletHTML += `<li>${s}.</li>`;
        });
        bulletHTML += `</ul>`;
        
        bulletHTML += `<h4>Action Items</h4><ul>
            <li>Revise notes using spaced repetition methods.</li>
            <li>Take an associated Quiz in Quiz Arena to solidify concepts.</li>
        </ul>`;
        
        resultView.innerHTML = bulletHTML;
        activeSummaryResults = bulletHTML;
        
    } else if (activeSummaryDepth === 'glossary') {
        resultView.classList.remove('hidden');
        let glossaryHTML = `<h4>Core Terminology Definitions</h4>`;
        
        // Find sentences with "is", "refers", "defines", "are" or extract nouns
        const glossaryItems = [];
        cleanSentences.forEach(sentence => {
            const matches = sentence.match(/^([^,:-]+)\s+(is|are|refers to|defined as|means)\s+([^,.-]+)/i);
            if (matches && matches[1].length < 30) {
                glossaryItems.push({
                    term: matches[1].trim(),
                    definition: (matches[2] + " " + matches[3]).trim()
                });
            }
        });
        
        // If not enough matches, create simulated definitions using capitalised nouns
        if (glossaryItems.length < 2) {
            const words = rawText.split(/\s+/);
            const properNouns = [...new Set(words.filter(w => w.match(/^[A-Z][a-z]{3,}$/)))].slice(0, 4);
            properNouns.forEach((noun, i) => {
                // Find a containing sentence
                const sent = cleanSentences.find(s => s.includes(noun)) || "Defined topic within the reading materials.";
                glossaryItems.push({
                    term: noun,
                    definition: sent.length > 80 ? sent.substring(0, 80) + "..." : sent
                });
            });
        }
        
        glossaryItems.forEach(item => {
            glossaryHTML += `<div class="glossary-item"><strong>${item.term}:</strong> ${item.definition}.</div>`;
        });
        
        resultView.innerHTML = glossaryHTML;
        activeSummaryResults = glossaryHTML;
        
    } else if (activeSummaryDepth === 'flashcards') {
        flashcardView.classList.remove('hidden');
        
        // Generate flashcards from parsed definitions
        const cards = [];
        cleanSentences.forEach(sentence => {
            const matches = sentence.match(/^([^,:-]+)\s+(is|are|refers to|means)\s+([^.-]+)/i);
            if (matches && matches[1].length < 25) {
                cards.push({
                    front: matches[1].trim(),
                    back: (matches[2] + " " + matches[3]).trim() + "."
                });
            }
        });
        
        // Fallback card structure
        if (cards.length < 3) {
            cards.push({ front: "Active Recall", back: "The practice of testing yourself on concepts rather than just re-reading notes." });
            cards.push({ front: "Note Summary", back: "Condensing major concepts to review study material efficiently." });
            cards.push({ front: "Spaced Repetition", back: "A learning technique where reviews are spaced out at increasing intervals." });
        }
        
        activeFlashcards = cards;
        currentFlashcardIndex = 0;
        showFlashcard();
    }
}

function showFlashcard() {
    if (activeFlashcards.length === 0) return;
    
    // Reset flip state
    const cardEl = document.querySelector('.flashcard');
    cardEl.classList.remove('flipped');
    
    const card = activeFlashcards[currentFlashcardIndex];
    document.getElementById('card-front-text').innerText = card.front;
    document.getElementById('card-back-text').innerText = card.back;
    
    document.getElementById('card-counter').innerText = `${currentFlashcardIndex + 1} / ${activeFlashcards.length}`;
}

function flipFlashcard(cardElement) {
    cardElement.classList.toggle('flipped');
}

function nextFlashcard() {
    if (activeFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % activeFlashcards.length;
    showFlashcard();
}

function prevFlashcard() {
    if (activeFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex - 1 + activeFlashcards.length) % activeFlashcards.length;
    showFlashcard();
}

function copySummaryText() {
    if (!activeSummaryResults && activeFlashcards.length === 0) {
        alert("Generate a summary outline first!");
        return;
    }
    
    let textToCopy = "";
    if (activeSummaryDepth === 'flashcards') {
        textToCopy = activeFlashcards.map(c => `Front: ${c.front}\nBack: ${c.back}`).join('\n\n');
    } else {
        // Strip HTML tag markup
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = activeSummaryResults;
        textToCopy = tempDiv.textContent || tempDiv.innerText || "";
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert("Summary notes copied to clipboard!");
    }).catch(err => {
        console.error("Could not copy summary", err);
    });
}

/* ==========================================================================
   QUIZ ARENA PLAYGAME MODULE
   ========================================================================== */
const quizQuestionsDatabase = {
    science: [
        {
            q: "Which organelle is universally referred to as the 'powerhouse of the cell'?",
            options: ["Chloroplast", "Nucleus", "Mitochondria", "Ribosome"],
            correct: 2,
            explanation: "Mitochondria convert glucose energy into ATP, which powers cellular chemistry actions."
        },
        {
            q: "What is the approximate speed of light through a vacuum space?",
            options: ["150,000 km/s", "300,000 km/s", "500,000 km/s", "1,000,000 km/s"],
            correct: 1,
            explanation: "Light travels at roughly 299,792 kilometers per second (commonly simplified to 300,000 km/s)."
        },
        {
            q: "What elemental chemical gas do plants absorb during photosynthesis?",
            options: ["Oxygen", "Carbon Dioxide", "Hydrogen", "Nitrogen"],
            correct: 1,
            explanation: "Plants absorb Carbon Dioxide (CO₂) and water to synthesize glucose sugars, emitting oxygen."
        },
        {
            q: "What is the chemical element symbol representing Gold?",
            options: ["Ag", "Au", "Fe", "Pb"],
            correct: 1,
            explanation: "Au comes from the Latin word 'Aurum', meaning shining dawn or gold."
        },
        {
            q: "Who formulated the general theory of relativity equations in physics?",
            options: ["Isaac Newton", "Albert Einstein", "Nikola Tesla", "Marie Curie"],
            correct: 1,
            explanation: "Albert Einstein published the General Theory of Relativity in 1915, describing gravity as spacetime curvature."
        }
    ],
    math: [
        {
            q: "Solve for x in the linear algebraic equation: 3x - 7 = 14.",
            options: ["5", "6", "7", "8"],
            correct: 2,
            explanation: "Add 7 to both sides: 3x = 21. Divide by 3: x = 7."
        },
        {
            q: "What is the derivative of the polynomial function f(x) = x²?",
            options: ["x", "2", "2x", "x³"],
            correct: 2,
            explanation: "Applying the power rule, d/dx(x^n) = n*x^(n-1), so d/dx(x²) = 2x."
        },
        {
            q: "How many internal degrees are contained in a perfect right-angle triangle?",
            options: ["45 degrees", "90 degrees", "180 degrees", "360 degrees"],
            correct: 1,
            explanation: "A right angle is exactly perpendicular, measuring 90 degrees."
        },
        {
            q: "What is the square root of 144?",
            options: ["10", "11", "12", "14"],
            correct: 2,
            explanation: "12 times 12 equals 144."
        },
        {
            q: "What is the value of Pi rounded to 2 decimal places?",
            options: ["3.12", "3.14", "3.16", "3.18"],
            correct: 1,
            explanation: "Pi begins as 3.14159..., which rounds down to 3.14."
        }
    ],
    history: [
        {
            q: "In what historical year did World War I officially begin?",
            options: ["1912", "1914", "1918", "1939"],
            correct: 1,
            explanation: "WWI began in July 1914 following the assassination of Archduke Franz Ferdinand."
        },
        {
            q: "Who was selected as the first President of the United States?",
            options: ["Thomas Jefferson", "Benjamin Franklin", "George Washington", "John Adams"],
            correct: 2,
            explanation: "George Washington served as president from 1789 to 1797."
        },
        {
            q: "The storming of which prison marked the start of the French Revolution?",
            options: ["Chateau d'If", "Alcatraz", "Tower of London", "Bastille"],
            correct: 3,
            explanation: "Revolutionaries stormed the Bastille prison in Paris on July 14, 1789, seeking arms and ammunition."
        },
        {
            q: "Which ancient Mediterranean empire constructed the famous Colosseum in Rome?",
            options: ["Greek Empire", "Roman Empire", "Byzantine Empire", "Ottoman Empire"],
            correct: 1,
            explanation: "The Roman Empire built the Colosseum (Flavian Amphitheatre) between 72 AD and 80 AD."
        },
        {
            q: "Which famous queen of ancient Egypt formed alliances with Julius Caesar?",
            options: ["Cleopatra", "Nefertiti", "Hatshepsut", "Sobekneferu"],
            correct: 0,
            explanation: "Cleopatra VII Philopator was ruler of Ptolemaic Egypt and is famous for her alliances with Roman generals."
        }
    ],
    programming: [
        {
            q: "Which keyword is used to declare a modern block-scoped variable in JavaScript?",
            options: ["var", "let", "define", "global"],
            correct: 1,
            explanation: "'let' and 'const' are block-scoped variable keywords, preventing scope leaks associated with 'var'."
        },
        {
            q: "What does HTML stand for in web engineering terms?",
            options: ["HyperText Markup Language", "HighTech Machine Language", "HyperTransfer Main Link", "Hypertext Main Loop"],
            correct: 0,
            explanation: "HTML is the standard HyperText Markup Language used to structure web pages."
        },
        {
            q: "What is the average time complexity of searching inside a balanced Binary Search Tree?",
            options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
            correct: 1,
            explanation: "A balanced BST cuts the remaining search space in half with each node step, producing log n search complexity."
        },
        {
            q: "Which symbol is used to start comment notes inside Python scripts?",
            options: ["//", "/*", "#", "--"],
            correct: 2,
            explanation: "Python uses the hash symbol '#' for starting single-line code comments."
        },
        {
            q: "Which of these is a popular backend JavaScript runtime environment?",
            options: ["React.js", "Angular", "Node.js", "Django"],
            correct: 2,
            explanation: "Node.js is a runtime that compiles and executes JavaScript server-side using Google's V8 engine."
        }
    ]
};

function startSubjectQuiz(subjectId) {
    const questions = quizQuestionsDatabase[subjectId];
    if (!questions) return;
    
    document.getElementById('quiz-badge-title').innerText = `${subjectId.toUpperCase()} ARENA`;
    
    // Copy questions to active session
    quizActiveQuestions = JSON.parse(JSON.stringify(questions));
    launchQuizGameplay();
}

function startCustomQuiz() {
    const text = document.getElementById('custom-quiz-text').value.trim();
    if (text.length < 150) {
        alert("Please paste a longer notes snippet (minimum 150 characters) to parse custom quiz questions!");
        return;
    }
    
    // Dynamically generate a mini quiz from sentences!
    const cleanSentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 25);
    const questions = [];
    
    cleanSentences.slice(0, 4).forEach((sent, idx) => {
        // Find nouns or key definitions
        const matches = sent.match(/^([^,:-]+)\s+(is|are|refers to|defined as|means)\s+([^,.-]+)/i);
        if (matches && matches[1].length < 25) {
            const term = matches[1].trim();
            const def = (matches[2] + " " + matches[3]).trim();
            
            questions.push({
                q: `According to your study materials, what is defined as "${def}..."?`,
                options: [term, "General Variable", "Structured Matrix", "Context Frame"],
                correct: 0,
                explanation: `Your study notes state: "${sent}."`
            });
        }
    });
    
    // Fallback if notes structure is complex to parse
    if (questions.length < 3) {
        questions.push({
            q: "Identify the primary benefit of testing note recall via flashcards or quizzes:",
            options: ["Active learning consolidation", "Passive speed reading", "Rote copying", "Formatting alignment"],
            correct: 0,
            explanation: "Testing forces neural path recall, creating stronger memory loops."
        });
        questions.push({
            q: "Complete the following statement: The primary focal point of study sessions should prioritize...",
            options: ["Total quantity hours", "Quality active focus", "Colored highlighting", "Font spacing"],
            correct: 1,
            explanation: "Quality focus (Pomodoro) creates deep understanding, regardless of total length."
        });
    }
    
    document.getElementById('quiz-badge-title').innerText = "CUSTOM NOTES ARENA";
    quizActiveQuestions = questions;
    launchQuizGameplay();
}

function launchQuizGameplay() {
    quizCurrentIndex = 0;
    quizUserScore = 0;
    
    // Swap panels
    document.getElementById('quiz-selector-view').classList.add('hidden');
    document.getElementById('quiz-results-view').classList.add('hidden');
    document.getElementById('quiz-gameplay-view').classList.remove('hidden');
    
    renderCurrentQuizQuestion();
}

function renderCurrentQuizQuestion() {
    quizIsAnswerSubmitted = false;
    quizSelectedOptionIndex = null;
    
    // Reset banner and button
    document.getElementById('quiz-feedback').classList.add('hidden');
    
    const submitBtn = document.getElementById('quiz-action-btn');
    submitBtn.innerText = "Submit Answer";
    submitBtn.disabled = true;
    
    const qData = quizActiveQuestions[quizCurrentIndex];
    
    // Update tracker
    document.getElementById('quiz-q-counter').innerText = `Question ${quizCurrentIndex + 1} of ${quizActiveQuestions.length}`;
    
    // Update Progress bar width
    const percentage = ((quizCurrentIndex) / quizActiveQuestions.length) * 100;
    document.getElementById('quiz-progress-bar').style.width = `${percentage}%`;
    
    // Load text
    document.getElementById('quiz-question-text').innerText = qData.q;
    
    // Load options
    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';
    
    qData.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.onclick = () => selectQuizOption(idx);
        
        btn.innerHTML = `
            <span>${opt}</span>
            <div class="option-indicator">${String.fromCharCode(65 + idx)}</div>
        `;
        optionsContainer.appendChild(btn);
    });
}

function selectQuizOption(optionIdx) {
    if (quizIsAnswerSubmitted) return;
    
    quizSelectedOptionIndex = optionIdx;
    
    // Reset selections styles
    document.querySelectorAll('.option-btn').forEach((btn, idx) => {
        if (idx === optionIdx) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Enable submit button
    document.getElementById('quiz-action-btn').disabled = false;
}

function handleQuizAction() {
    const submitBtn = document.getElementById('quiz-action-btn');
    const qData = quizActiveQuestions[quizCurrentIndex];
    
    if (!quizIsAnswerSubmitted) {
        // Evaluate answer
        quizIsAnswerSubmitted = true;
        
        const optionButtons = document.querySelectorAll('.option-btn');
        const correctIdx = qData.correct;
        
        // Show feedbacks banner
        const feedbackBanner = document.getElementById('quiz-feedback');
        const feedbackIcon = document.getElementById('feedback-icon');
        const feedbackTitle = document.getElementById('feedback-title');
        const feedbackExpl = document.getElementById('feedback-explanation');
        
        feedbackBanner.classList.remove('hidden');
        
        if (quizSelectedOptionIndex === correctIdx) {
            // Correct!
            optionButtons[quizSelectedOptionIndex].classList.add('correct');
            feedbackIcon.innerText = '✅';
            feedbackTitle.innerText = "Correct Answer! Well done.";
            feedbackTitle.style.color = "var(--color-accent-emerald)";
            quizUserScore++;
        } else {
            // Incorrect
            optionButtons[quizSelectedOptionIndex].classList.add('incorrect');
            optionButtons[correctIdx].classList.add('correct');
            feedbackIcon.innerText = '❌';
            feedbackTitle.innerText = "Incorrect Choice.";
            feedbackTitle.style.color = "var(--color-accent-pink)";
        }
        
        feedbackExpl.innerText = qData.explanation;
        
        // Update dashboard count state (each question solved is logged)
        appState.quizTotalQuestions++;
        if (quizSelectedOptionIndex === correctIdx) {
            appState.quizCorrectAnswers++;
        }
        saveStateToStorage();
        
        // Toggle button action label
        if (quizCurrentIndex === quizActiveQuestions.length - 1) {
            submitBtn.innerText = "See Results";
        } else {
            submitBtn.innerText = "Next Question";
        }
    } else {
        // Progress to next question or display result dashboard
        if (quizCurrentIndex < quizActiveQuestions.length - 1) {
            quizCurrentIndex++;
            renderCurrentQuizQuestion();
        } else {
            showQuizResults();
        }
    }
}

function showQuizResults() {
    // Save quiz count stats
    appState.quizzesSolved++;
    saveStateToStorage();
    updateDashboardStats();
    
    // Swap panels
    document.getElementById('quiz-gameplay-view').classList.add('hidden');
    document.getElementById('quiz-results-view').classList.remove('hidden');
    
    // Display results text
    document.getElementById('res-score').innerText = `${quizUserScore} / ${quizActiveQuestions.length}`;
    const acc = Math.round((quizUserScore / quizActiveQuestions.length) * 100);
    document.getElementById('res-accuracy').innerText = `${acc}%`;
}

function exitQuiz() {
    // Swap panels
    document.getElementById('quiz-gameplay-view').classList.add('hidden');
    document.getElementById('quiz-results-view').classList.add('hidden');
    document.getElementById('quiz-selector-view').classList.remove('hidden');
}

/* ==========================================================================
   ACADEMIC RESOURCE LIBRARY
   ========================================================================== */
const resourceDatabase = [
    {
        title: "Khan Academy",
        description: "Interactive educational portal offering structured study paths for math, chemistry, biology, physics, and history.",
        category: "science",
        url: "https://www.khanacademy.org"
    },
    {
        title: "CrashCourse YouTube",
        description: "Highly visual, animated explanations of history, literature, biology, computer science, and chemistry concepts.",
        category: "science",
        url: "https://www.youtube.com/user/crashcourse"
    },
    {
        title: "Symbolab Calculator",
        description: "Advanced math solver showing detailed, step-by-step solutions for algebra, calculus, and matrix queries.",
        category: "math",
        url: "https://www.symbolab.com"
    },
    {
        title: "Desmos Graphing Tool",
        description: "Dynamic online graphing tool allowing interactive explorations of equations, calculus limits, and shapes.",
        category: "math",
        url: "https://www.desmos.com"
    },
    {
        title: "MDN Web Docs",
        description: "The authoritative engineering reference directory for HTML, CSS, JavaScript, and web architecture details.",
        category: "cs",
        url: "https://developer.mozilla.org"
    },
    {
        title: "freeCodeCamp.org",
        description: "Free coding certification pathways with hundreds of interactive programming lessons and building blocks.",
        category: "cs",
        url: "https://www.freecodecamp.org"
    },
    {
        title: "Pomofocus.io",
        description: "Sleek web-based Pomodoro timers to manage and plan study focus windows efficiently.",
        category: "tools",
        url: "https://pomofocus.io"
    },
    {
        title: "Anki Flashcards Website",
        description: "Powerful flashcard deck app that utilizes spaced repetition to memorize vocabulary or facts permanently.",
        category: "tools",
        url: "https://apps.ankiweb.net"
    }
];

let activeResourceFilter = 'all';

function renderResourceLibrary() {
    const container = document.getElementById('resource-cards-container');
    const searchVal = document.getElementById('resource-search').value.toLowerCase();
    
    container.innerHTML = '';
    
    const filtered = resourceDatabase.filter(res => {
        // Match search
        const matchesSearch = res.title.toLowerCase().includes(searchVal) || res.description.toLowerCase().includes(searchVal);
        
        // Match category filter
        const matchesCategory = activeResourceFilter === 'all' || res.category === activeResourceFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <span class="empty-icon">🔍</span>
                <h4>No Matching Resources</h4>
                <p>Try refining your search keyword or selecting a different category filter.</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach(res => {
        const card = document.createElement('div');
        card.className = 'res-item-card';
        
        let tagLabel = 'Science';
        if (res.category === 'math') tagLabel = 'Mathematics';
        else if (res.category === 'cs') tagLabel = 'Comp Sci';
        else if (res.category === 'tools') tagLabel = 'Tool';
        
        card.innerHTML = `
            <span class="res-card-tag tag-${res.category}">${tagLabel}</span>
            <h4>${res.title}</h4>
            <p>${res.description}</p>
            <a href="${res.url}" target="_blank" rel="noopener noreferrer" class="res-link">
                <span>Visit Resource</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="7" y1="17" x2="17" y2="7"/>
                    <polyline points="7 7 17 7 17 17"/>
                </svg>
            </a>
        `;
        container.appendChild(card);
    });
}

function setResourceFilter(category, btn) {
    activeResourceFilter = category;
    
    // Toggle active chip classes
    document.querySelectorAll('#resource-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    
    renderResourceLibrary();
}

function filterResources() {
    renderResourceLibrary();
}
