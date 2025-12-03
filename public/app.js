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
        content: `<h3>Calculating Your Window</h3><img src="/LHandEstrogen.png" alt="LH and Estrogen Chart" style="width:100%; display:block; margin:auto;"><p><b>The Equation: Ovulation Timing + Sperm Survival = Your Window</b></p><p>To stay safe, we combine real-time data with biological facts:</p><ul><li><b>The Event:</b> The Monitor identifies your Peak (when the egg actually releases).</li><li><b>The Risk:</b> Sperm can survive inside the body for 5 days waiting for that egg.</li><li><b>The Result:</b> The "High" readings track Estrogen to warn you before ovulation, covering the sperm survival time. The "Peak" tracks the actual event. Together, they define the fertile window you see in the chart above.</li></ul>`
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
    log('info', '--- initializeInstructionalOverlay START ---');
    log('info', 'Instructions array content:', JSON.stringify(instructions));
    const overlay = document.getElementById('instructional-overlay');
    if (!overlay) {
        log('warn', 'Instructional overlay element not found. --- initializeInstructionalOverlay END ---');
        return;
    }

    const closeBtn = document.getElementById('close-instructions');
    const nextBtn = document.getElementById('next-instruction');
    const prevBtn = document.getElementById('prev-instruction');

    const closeOverlay = () => {
        overlay.classList.remove('active');
        // Make an API call to permanently mark instructions as viewed
        fetch('/api/instructions-viewed', { method: 'POST' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update instructions status');
                }
                log('info', 'Successfully updated instructions status on the server.');
            })
            .catch(error => console.error('Error updating instructions status:', error));
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
    log('info', `--- renderInstruction START (Current Index: ${currentInstruction}) ---`);
    if (currentInstruction >= instructions.length) {
        log('error', `Invalid instruction index: ${currentInstruction}. Instructions length: ${instructions.length}`);
        return;
    }
    const instruction = instructions[currentInstruction];
    log('info', 'Rendering instruction:', JSON.stringify(instruction));
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
    log('info', '--- renderInstruction END ---');
}

function initializeEventListeners(elements) {
    elements.rangeCheckbox.addEventListener('change', () => {
        elements.rangeInputs.style.display = elements.rangeCheckbox.checked ? 'block' : 'none';
    });

    elements.readingForm.addEventListener('submit', (e) => handleReadingSubmit(e, elements));
    elements.periodButton.addEventListener('click', () => handleNewCycleSubmit(elements));
}

async function fetchAndRenderData(elements, viewAsUserId = null) {
    log('info', `[START] fetchAndRenderData: Fetching data for user: ${viewAsUserId || 'self'}.`);
    try {
        const cacheBust = `?t=${new Date().getTime()}`;
        const userQuery = viewAsUserId ? `?user_id=${viewAsUserId}` : '';
        log('info', `[FETCH] URLs being fetched: /api/me, /api/cycles${userQuery}, /api/analytics${userQuery}`);

        const responses = await Promise.all([
            fetch(`/api/me${cacheBust}`),
            fetch(`/api/cycles${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`),
            fetch(`/api/analytics${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`)
        ]);

        log('info', '[FETCH] All fetch promises have resolved.');

        for (const response of responses) {
            if (response.status === 401) {
                log('error', '[AUTH] User not authenticated (401). Redirecting to login.');
                window.location.href = '/';
                return;
            }
        }

        log('info', '[FETCH] All responses are OK. Parsing JSON...');
        const [user, cycles, analytics] = await Promise.all(responses.map(res => res.json()));

        log('info', `[DATA] Logged-in user: ${user.name} (ID: ${user.id}). Viewing as user: ${viewAsUserId || user.id}`);
        log('info', `[DATA] Cycles received: ${cycles.length}`);
        log('info', `[DATA] Analytics received:`, analytics);

        if (user.show_instructions && !sessionStorage.getItem('instructions_shown')) {
            const overlay = document.getElementById('instructional-overlay');
            if (overlay) {
                log('info', 'User preference set to show instructions. Activating overlay.');
                overlay.classList.add('active');
                renderInstruction();
                sessionStorage.setItem('instructions_shown', 'true');
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

        // --- INTELLIGENT DEFAULT ---
        // If this is the initial load (no viewAsUserId), the current user has no cycles,
        // and there's another user available, default to the other user's view.
        if (!viewAsUserId && cycles.length === 0 && sharedUsers.length > 1) {
            const otherUser = sharedUsers.find(u => u.id !== user.id);
            if (otherUser) {
                log('info', `[AUTO-SWITCH] Current user has no data. Defaulting to view user ${otherUser.id}.`);
                fetchAndRenderData(elements, otherUser.id);
                return; // Stop the current render pass
            }
        }
        
        // Pass the currently viewed user's ID to the switcher to maintain state
        renderAccountSwitcher(sharedUsers, elements, user, viewAsUserId);

        renderCycles(cycles, elements, calculateFertileWindows(cycles));
        renderAnalytics(analytics, cycles, elements);
    } catch (error) {
        log('error', 'Error fetching data:', error);
    }
}

function renderCycles(cycles, elements, fertileWindows = []) {
    log('info', `[RENDER] --- renderCycles START ---. Received ${cycles.length} cycles.`);
    const container = elements.cyclesContainer;
    if (!container) {
        log('error', '[RENDER] Cycles container not found in DOM.');
        return;
    }
    container.innerHTML = ''; // Clear previous cycles

    if (!cycles || cycles.length === 0) {
        log('info', '[RENDER] No cycles to display. Showing message.');
        container.innerHTML = '<p>No cycles recorded yet. Start by logging your period start date.</p>';
        return;
    }

    cycles.forEach((cycle, index) => {
        log('info', `[RENDER] Processing cycle ${index + 1}/${cycles.length}, ID: ${cycle.id}`);
        const cycleDiv = document.createElement('div');
        cycleDiv.className = 'cycle'; // Fix: Use .cycle to match CSS
        cycleDiv.dataset.cycleId = cycle.id;

        const startDate = new Date(cycle.start_date).toLocaleDateString();
        const endDate = cycle.end_date ? new Date(cycle.end_date).toLocaleDateString() : 'Present';
        const cycleLength = cycle.end_date ? Math.round((new Date(cycle.end_date) - new Date(cycle.start_date)) / (1000 * 60 * 60 * 24)) + 1 : 'Ongoing';

        cycleDiv.innerHTML = `
            <div class="cycle-header">
                <div class="cycle-title">
                    <h4>Cycle: ${startDate} - ${endDate}</h4>
                    <span>(${cycleLength} days)</span>
                </div>
                <div class="cycle-menu-container">
                    <button class="cycle-menu-button" data-cycle-id="${cycle.id}">
                        <span></span><span></span><span></span>
                    </button>
                    <div class="cycle-menu-content">
                        <a href="#" class="edit-cycle-btn" data-cycle-id="${cycle.id}">Edit</a>
                        <a href="#" class="delete-cycle-btn" data-id="${cycle.id}">Delete</a>
                    </div>
                </div>
            </div>
            <div class="day-grid"></div>
        `;

        const daysGrid = cycleDiv.querySelector('.day-grid');
        const menuButton = cycleDiv.querySelector('.cycle-menu-button');
        const menuContent = cycleDiv.querySelector('.cycle-menu-content');
        const editButton = cycleDiv.querySelector('.edit-cycle-btn');

        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cycleDiv.classList.contains('edit-mode')) {
                toggleEditMode(cycleDiv, cycle.id, elements);
            } else {
                menuContent.classList.toggle('active');
            }
        });

        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleEditMode(cycleDiv, cycle.id, elements);
            menuContent.classList.remove('active'); // Close menu
        });
        const fertileWindow = fertileWindows.find(fw => fw.cycleId === cycle.id);

        if (cycle.days) {
            cycle.days.forEach(day => {
                const dayDiv = createDayDiv(day, cycle, fertileWindow, elements);
                daysGrid.appendChild(dayDiv);
            });
        }

        container.appendChild(cycleDiv);
    });

    // Add event listeners for the new delete buttons within menus
    container.querySelectorAll('.delete-cycle-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const cycleId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this entire cycle? This action cannot be undone.')) {
                deleteCycle(cycleId, elements);
            }
        });
    });
    log('info', `[RENDER] --- renderCycles END ---. Finished rendering cycles.`);
}

function calculateFertileWindows(cycles) {
    if (!cycles) return [];

    return cycles.map(cycle => {
        const sortedDays = cycle.days.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

        const firstHighOrPeak = sortedDays.find(d => d.hormone_reading === 'High' || d.hormone_reading === 'Peak');
        const lastPeak = sortedDays.slice().reverse().find(d => d.hormone_reading === 'Peak');

        let fertileStart = null;
        if (firstHighOrPeak) {
            const startDate = new Date(firstHighOrPeak.date);
            startDate.setDate(startDate.getDate() - 3); // Window opens 3 days before the first high/peak
            fertileStart = startDate.toISOString().split('T')[0];
        }

        let fertileEnd = null;
        if (lastPeak) {
            const endDate = new Date(lastPeak.date);
            endDate.setDate(endDate.getDate() + 4); // Window closes after Peak + 4 days
            fertileEnd = endDate.toISOString().split('T')[0];
        }
        
        // If the cycle is ongoing and a peak has been detected, the window might still be open
        if (lastPeak && !cycle.end_date && !fertileEnd) {
             const endDate = new Date(lastPeak.date);
             endDate.setDate(endDate.getDate() + 4);
             if (new Date() < endDate) {
                fertileEnd = null; // Still in the window
             } else {
                fertileEnd = endDate.toISOString().split('T')[0];
             }
        }


        return { cycleId: cycle.id, start: fertileStart, end: fertileEnd };
    });
}

function renderAccountSwitcher(users, elements, currentUser, currentlySelectedId) {
    log('info', `[RENDER] --- renderAccountSwitcher START ---`);
    log('info', `[RENDER] Switcher Data: Total Users=${users.length}, Current User ID=${currentUser.id}, Selected User ID=${currentlySelectedId}`);

    const container = document.getElementById('account-switcher-container');
    if (!container) {
        log('error', '[RENDER] Account switcher container not found in DOM.');
        return;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    // Only show the switcher if there's more than one user (the current user + at least one partner)
    if (!users || users.length <= 1) {
        log('info', '[RENDER] No other shared users to display. Hiding switcher.');
        container.style.display = 'none';
        return;
    }

    log('info', '[RENDER] Building account switcher dropdown...');
    const select = document.createElement('select');
    select.id = 'user-switcher';

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        // Label the current user as "My Data" for clarity
        option.textContent = (user.id === currentUser.id) ? 'My Data' : (user.name || user.email);

        // Determine which option should be selected
        const isCurrentlySelected = currentlySelectedId ? (user.id == currentlySelectedId) : (user.id === currentUser.id);
        log('info', `[RENDER] Option: ${user.name}, isSelected: ${isCurrentlySelected}`);
        if (isCurrentlySelected) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        const selectedUserId = e.target.value;
        log('info', `[ACTION] Dropdown changed. Selected User ID: ${selectedUserId}`);
        // If the selected ID matches the current user's ID, fetch with null to view self
        const viewAsId = (selectedUserId == currentUser.id) ? null : selectedUserId;
        fetchAndRenderData(elements, viewAsId);
    });

    container.appendChild(select);
    log('info', 'Dropdown appended to container. --- renderAccountSwitcher END ---');
}

function renderAnalytics(analytics, cycles, elements) {
    const avgCycleLengthSpan = document.getElementById('avg-cycle-length');
    const avgDaysToPeakSpan = document.getElementById('avg-days-to-peak');
    const avgFertileWindowSpan = document.getElementById('avg-fertile-window');
    const estimatedNextPeriodSpan = document.getElementById('estimated-next-period');
    const fertileWindowStartSpan = document.getElementById('fertile-window-start');
    const fertileWindowEndSpan = document.getElementById('fertile-window-end');

    // Use backend-calculated averages
    avgCycleLengthSpan.textContent = analytics.averageCycleLength || '--';
    avgDaysToPeakSpan.textContent = analytics.averageDaysToPeak || '--';

    const fertileWindows = calculateFertileWindows(cycles);
    const validWindows = fertileWindows.filter(fw => fw.start && fw.end);
    
    let avgFertileWindowLength = 0;
    if (validWindows.length > 0) {
        const totalFertileDays = validWindows.reduce((acc, fw) => {
            const start = new Date(fw.start);
            const end = new Date(fw.end);
            return acc + (end - start) / (1000 * 60 * 60 * 24) + 1;
        }, 0);
        avgFertileWindowLength = Math.round(totalFertileDays / validWindows.length);
        avgFertileWindowSpan.textContent = avgFertileWindowLength;
    } else {
        avgFertileWindowSpan.textContent = '--';
    }

    const mostRecentCycle = cycles && cycles.length > 0 ? cycles[0] : null;
    if (mostRecentCycle && analytics.averageCycleLength > 0) {
        const lastStartDate = new Date(mostRecentCycle.start_date);
        const nextPeriodDate = new Date(lastStartDate.getTime());
        nextPeriodDate.setDate(lastStartDate.getDate() + analytics.averageCycleLength);
        estimatedNextPeriodSpan.textContent = nextPeriodDate.toLocaleDateString();

        if (analytics.averageDaysToPeak > 0 && avgFertileWindowLength > 0) {
            const nextFertileStartDate = new Date(nextPeriodDate.getTime());
            nextFertileStartDate.setDate(nextPeriodDate.getDate() + analytics.averageDaysToPeak - (avgFertileWindowLength / 2));
            
            const nextFertileEndDate = new Date(nextFertileStartDate.getTime());
            nextFertileEndDate.setDate(nextFertileStartDate.getDate() + avgFertileWindowLength);

            fertileWindowStartSpan.textContent = nextFertileStartDate.toLocaleDateString();
            fertileWindowEndSpan.textContent = nextFertileEndDate.toLocaleDateString();
        } else {
            fertileWindowStartSpan.textContent = '--';
            fertileWindowEndSpan.textContent = '--';
        }
    } else {
        estimatedNextPeriodSpan.textContent = '--';
        fertileWindowStartSpan.textContent = '--';
        fertileWindowEndSpan.textContent = '--';
    }
}

function createDayDiv(dayData, cycle, fertileWindow, elements) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    dayDiv.dataset.dayId = dayData.id;
    dayDiv.dataset.date = dayData.date;

    const dayDate = new Date(dayData.date);
    const cycleStartDate = new Date(cycle.start_date);

    // Calculate day number safely
    const dayNumber = dayDate && cycleStartDate ? Math.round((dayDate - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1 : 'N/A';

    // Apply fertile window shading
    if (fertileWindow && fertileWindow.start) {
        const startDate = new Date(fertileWindow.start);
        const endDate = fertileWindow.end ? new Date(fertileWindow.end) : null;
        if (dayDate >= startDate && (!endDate || dayDate <= endDate)) {
            dayDiv.classList.add('fertile-window');
        }
    }

    const reading = dayData.hormone_reading || '--';
    const readingClass = dayData.hormone_reading || '';

    dayDiv.innerHTML = `
        <button class="delete-day" data-id="${dayData.id}">&times;</button>
        <div class="day-number">Day ${dayNumber}</div>
        <div class="day-date">${dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div>
        <div class="reading ${readingClass}">${reading}</div>
        <div class="reading-edit">
            <select class="reading-select">
                <option value="" ${!dayData.hormone_reading ? 'selected' : ''}>--</option>
                <option value="Low" ${dayData.hormone_reading === 'Low' ? 'selected' : ''}>Low</option>
                <option value="High" ${dayData.hormone_reading === 'High' ? 'selected' : ''}>High</option>
                <option value="Peak" ${dayData.hormone_reading === 'Peak' ? 'selected' : ''}>Peak</option>
            </select>
            <div class="intercourse-edit">
                <input type="checkbox" class="intercourse-checkbox" ${dayData.intercourse ? 'checked' : ''}> ❤️
            </div>
        </div>
        <div class="intercourse-display">${dayData.intercourse ? '❤️' : ''}</div>
    `;

    dayDiv.querySelector('.delete-day').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this reading?')) {
            deleteReading(dayData.id, elements);
        }
    });

    dayDiv.querySelector('.reading-select').addEventListener('change', (e) => {
        const newReading = e.target.value;
        logOrUpdateReading({
            id: dayData.id,
            date: dayData.date,
            hormone_reading: newReading,
            cycle_id: cycle.id
        }, elements);
    });

    dayDiv.querySelector('.intercourse-checkbox').addEventListener('change', (e) => {
        const newIntercourse = e.target.checked;
        logOrUpdateReading({
            id: dayData.id,
            date: dayData.date,
            intercourse: newIntercourse,
            cycle_id: cycle.id
        }, elements);
    });

    return dayDiv;
}

async function logOrUpdateReading(payload, elements) {
    const { id, date, hormone_reading, intercourse, cycle_id } = payload;
    const isUpdate = id !== undefined;
    const url = isUpdate ? `/api/cycles/days/${id}` : '/api/cycles/days';
    const method = isUpdate ? 'PUT' : 'POST';

    const body = { date, cycle_id };
    if (hormone_reading !== undefined) body.hormone_reading = hormone_reading;
    if (intercourse !== undefined) body.intercourse = intercourse;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('Failed to save reading');
        fetchAndRenderData(elements); // Refresh data
    } catch (error) {
        console.error('Error saving reading:', error);
    }
}

function toggleEditMode(cycleDiv, cycleId, elements) {
    cycleDiv.classList.toggle('edit-mode');
    const isEditing = cycleDiv.classList.contains('edit-mode');

    // Also ensure the menu content is hidden when toggling edit mode
    const menuContent = cycleDiv.querySelector('.cycle-menu-content');
    if (menuContent) {
        menuContent.classList.remove('active');
    }

    const dayElements = cycleDiv.querySelectorAll('.day');
    dayElements.forEach(day => {
        const display = day.querySelector('.reading');
        const edit = day.querySelector('.reading-edit');
        const intercourseDisplay = day.querySelector('.intercourse-display');

        if(display) display.style.display = isEditing ? 'none' : 'block';
        if(edit) edit.style.display = isEditing ? 'block' : 'none';
        if(intercourseDisplay) intercourseDisplay.style.display = isEditing ? 'none' : 'block';
    });
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
    if (!id) return; // Ignore if there's no ID (for unsaved days)
    try {
        const response = await fetch(`/api/cycles/days/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete reading');
        fetchAndRenderData(elements); // Refresh data
    } catch (error) {
        console.error('Error deleting reading:', error);
    }
}

async function handleShareSubmit(e) {
    // ... function implementation
}
