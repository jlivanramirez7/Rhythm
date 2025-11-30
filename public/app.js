if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

const log = (level, message, ...args) => {
    console.log(`[${level.toUpperCase()}] [UI] ${message}`, ...args);
};

const instructions = [
    {
        title: 'The Marquette Method',
        content: `<h3>Objective. Digital. Effective.</h3><p>This method removes human error by using the Clearblue Fertility Monitor to track two specific urinary hormones: Estrogen and LH.</p><p>Instead of guessing based on how you "feel," you get a concrete data point every morning. It’s about 98% effective with perfect use, largely because it doesn't rely on you analyzing your own mucus before you've had your coffee.</p>`
    },
    {
        title: 'The Daily Routine',
        content: `<h3>The 6-Hour Window</h3><p>You must set a 6-hour testing window on your monitor (e.g., 6:00 AM – 12:00 PM). You can only test during this time.</p><h3>The Workflow:</h3><ul><li>Cycle Day 1-5: No testing.</li><li>Cycle Day 6: Begin testing.</li></ul><h3>The Action:</h3><p>Collect a urine sample, dip the test stick, and insert it into the monitor.</p><h3>The Wait:</h3><p>It takes 5 minutes to read.</p><p><em>Note: You will test every day until the fertile window closes.</em></p>`
    },
    {
        title: 'The Three Readings',
        content: `<h3>Interpreting Your Data</h3><ol><li><strong>LOW (Infertile)</strong><br>Status: No hormone rise.<br>Action: Intercourse is available.</li><li><strong>HIGH (Fertile)</strong><br>Status: Estrogen is rising. The fertile window is OPEN.<br>Why: Sperm can survive up to 5 days waiting for the egg.<br>Action: Abstinence begins immediately.</li><li><strong>PEAK (Maximum Fertility)</strong><br>Status: LH Surge detected. Ovulation is imminent (24-36 hours).<br>Action: Continue abstinence. The monitor will automatically show "Peak" for two days.</li></ol>`
    },
    {
        title: 'Closing the Window',
        content: `<h3>The "PPHLL" Rule</h3><p>You remain in the fertile window (abstinence) starting from the very first "High" reading. To exit, you must trigger the countdown starting on your first Peak day.</p><h3>The Countdown:</h3><ul><li>Peak (Day 1)</li><li>Peak (Day 2 - Automatic)</li><li>High (Wait Day 1)</li><li>Low (Wait Day 2)</li></ul><p>The Rule: On the evening of that 4th day (the second "Wait" day), the window is officially closed. You are safe to resume normal relations until the end of the cycle.</p>`
    },
    {
        title: 'The Logic',
        content: `<h3>Calculating Your Window</h3><img src="/LHandEstrogen.png" alt="LH and Estrogen Chart" style="width:100%; max-width:400px; display:block; margin:auto;"><p><b>The Equation: Ovulation Timing + Sperm Survival = Your Window</b></p><p>To stay safe, we combine real-time data with biological facts:</p><ul><li><b>The Event:</b> The Monitor identifies your Peak (when the egg actually releases).</li><li><b>The Risk:</b> Sperm can survive inside the body for 5 days waiting for that egg.</li><li><b>The Result:</b> The "High" readings track Estrogen to warn you before ovulation, covering the sperm survival time. The "Peak" tracks the actual event. Together, they define the fertile window you see in the chart above.</li></ul>`
    }
];

let currentInstruction = 0;

document.addEventListener('DOMContentLoaded', () => {
    log('info', 'DOM fully loaded and parsed.');
    initializeInstructionalOverlay();

    const appMenuToggle = document.getElementById('app-menu-toggle');
    const appMenuContent = document.getElementById('app-menu-content');

    if (appMenuToggle && appMenuContent) {
        appMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            appMenuToggle.classList.toggle('active');
            appMenuContent.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!appMenuContent.contains(event.target) && !appMenuToggle.contains(event.target)) {
                appMenuToggle.classList.remove('active');
                appMenuContent.classList.remove('active');
            }
        });
    }

    const readingForm = document.getElementById('reading-form');
    if (readingForm) {
        const elements = {
            periodButton: document.getElementById('period-button'),
            cyclesContainer: document.getElementById('cycles-container'),
            avgCycleLengthSpan: document.getElementById('avg-cycle-length'),
            avgDaysToPeakSpan: document.getElementById('avg-days-to-peak'),
            dateInput: document.getElementById('date'),
            periodStartDateInput: document.getElementById('period-start-date'),
            rangeCheckbox: document.getElementById('range-checkbox'),
            rangeInputs: document.getElementById('range-inputs'),
            endDateInput: document.getElementById('end-date'),
            readingForm: readingForm
        };

        initializeEventListeners(elements);
        elements.periodStartDateInput.value = new Date().toISOString().split('T')[0];
        fetchAndRenderData(elements);
    }
});

function initializeInstructionalOverlay() {
    const overlay = document.getElementById('instructional-overlay');
    if (!overlay) {
        return;
    }

    const closeBtn = document.getElementById('close-instructions');
    const nextBtn = document.getElementById('next-instruction');
    const prevBtn = document.getElementById('prev-instruction');

    const closeOverlay = () => {
        overlay.classList.remove('active');
    };

    closeBtn.addEventListener('click', closeOverlay);

    nextBtn.addEventListener('click', () => {
        if (currentInstruction < instructions.length - 1) {
            currentInstruction++;
            renderInstruction();
        } else {
            closeOverlay();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentInstruction > 0) {
            currentInstruction--;
            renderInstruction();
        }
    });
}

function renderInstruction() {
    const instruction = instructions[currentInstruction];
    document.getElementById('instruction-title').textContent = instruction.title;
    document.getElementById('instruction-content').innerHTML = instruction.content;

    const pageIndicator = document.getElementById('page-indicator');
    pageIndicator.textContent = `Page ${currentInstruction + 1} of ${instructions.length}`;

    const progressBar = document.getElementById('progress-bar');
    const progress = ((currentInstruction + 1) / instructions.length) * 100;
    progressBar.style.width = `${progress}%`;

    const prevBtn = document.getElementById('prev-instruction');
    prevBtn.style.display = currentInstruction === 0 ? 'none' : 'inline-block';

    const nextBtn = document.getElementById('next-instruction');
    if (currentInstruction === instructions.length - 1) {
        nextBtn.textContent = 'Finish';
    } else {
        nextBtn.textContent = 'Next';
    }
}

function initializeEventListeners(elements) {
    elements.rangeCheckbox.addEventListener('change', () => {
        elements.rangeInputs.style.display = elements.rangeCheckbox.checked ? 'block' : 'none';
    });

    elements.readingForm.addEventListener('submit', (e) => handleReadingSubmit(e, elements));
    elements.periodButton.addEventListener('click', () => handleNewCycleSubmit(elements));
}

async function fetchAndRenderData(elements, viewAsUserId = null) {
    log('info', `fetchAndRenderData: Starting to fetch data for user: ${viewAsUserId || 'self'}.`);
    try {
        const cacheBust = `?t=${new Date().getTime()}`;
        const userQuery = viewAsUserId ? `?user_id=${viewAsUserId}` : '';
        
        const responses = await Promise.all([
            fetch(`/api/me${cacheBust}`),
            fetch(`/api/cycles${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`),
            fetch(`/api/analytics${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`)
        ]);

        for (const response of responses) {
            if (response.status === 401) {
                log('info', 'User not authenticated, redirecting to login page.');
                window.location.href = '/';
                return;
            }
        }

        const [user, cycles, analytics] = await Promise.all(responses.map(res => res.json()));

        log('debug', 'User data fetched:', user);

        if (user.show_instructions) {
            const overlay = document.getElementById('instructional-overlay');
            if (overlay) {
                log('info', 'User preference set to show instructions. Activating overlay.');
                overlay.classList.add('active');
                renderInstruction();
            }
        }

        if (user.is_admin) {
            const appMenuContent = document.getElementById('app-menu-content');
            if (appMenuContent && !appMenuContent.querySelector('.admin-link')) {
                const adminLink = document.createElement('a');
                adminLink.href = '/admin';
                adminLink.textContent = 'Admin';
                adminLink.className = 'admin-link';
                appMenuContent.prepend(adminLink);
            }
        }

        log('info', 'About to fetch shared users.');
        const sharedUsersRes = await fetch('/api/shared-users');
        const sharedUsers = await sharedUsersRes.json();
        log('info', 'Received shared users data:', JSON.stringify(sharedUsers));
        renderAccountSwitcher(sharedUsers, elements);

        renderAnalytics(analytics, cycles, elements);
    } catch (error) {
        log('error', 'Error fetching data:', error);
    }
}

function renderCycles(cycles, elements, fertileWindows = []) {
    // ... function implementation
}

function calculateFertileWindows(cycles) {
    // ... function implementation
}

function renderAccountSwitcher(users, elements) {
    log('info', '--- renderAccountSwitcher START ---');
    log('info', 'Users parameter:', JSON.stringify(users));

    const container = document.getElementById('account-switcher-container');
    if (!container) {
        log('warn', 'Account switcher container not found. --- renderAccountSwitcher END ---');
        return;
    }
    container.innerHTML = ''; // Clear previous content
    container.style.display = 'block'; // Always ensure the container is visible

    if (!users || users.length === 0) {
        log('info', 'Condition met: No shared users. Displaying message.');
        container.textContent = 'No other user data to display.';
        log('info', '--- renderAccountSwitcher END ---');
        return;
    }

    log('info', 'Condition not met: Users found. Building dropdown.');
    const select = document.createElement('select');
    select.id = 'user-switcher';

    const myDataOption = document.createElement('option');
    myDataOption.value = '';
    myDataOption.textContent = 'My Data';
    select.appendChild(myDataOption);

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name || user.email;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        const userId = e.target.value;
        log('info', `Switching view to user ID: ${userId || 'self'}`);
        fetchAndRenderData(elements, userId || null);
    });

    container.appendChild(select);
    log('info', 'Dropdown appended to container. --- renderAccountSwitcher END ---');
}

function renderAnalytics(analytics, cycles, elements) {
    // ... function implementation
}

function createDayDiv(dayData, cycle, fertileWindow, elements) {
    // ... function implementation
}

async function logOrUpdateReading(payload, elements) {
    // ... function implementation
}

function toggleEditMode(cycleDiv, cycleId, elements) {
    // ... function implementation
}

async function handleReadingSubmit(e, elements) {
    // ... function implementation
}

async function handleNewCycleSubmit(elements) {
    // ... function implementation
}

async function deleteCycle(id, elements) {
    // ... function implementation
}

async function deleteReading(id, elements) {
    // ... function implementation
}

async function handleShareSubmit(e) {
    // ... function implementation
}
