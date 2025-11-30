if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// DEBUG: Do not remove these logs
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
    }
];

let currentInstruction = 0;

/**
 * Main entry point for the application's frontend logic.
 */
document.addEventListener('DOMContentLoaded', () => {
    log('info', 'DOM fully loaded and parsed.');
    initializeInstructionalOverlay();

    // --- Main App Menu ---
    // ... (rest of the DOMContentLoaded logic)
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


    // --- App Initialization ---
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
    log('debug', 'Initializing instructional overlay...');
    const overlay = document.getElementById('instructional-overlay');
    if (!overlay) {
        log('debug', 'Instructional overlay element not found on this page. Aborting.');
        return; // Do nothing if the overlay is not on this page
    }
    log('debug', 'Overlay element found.');

    const closeBtn = document.getElementById('close-instructions');
    const nextBtn = document.getElementById('next-instruction');
    const prevBtn = document.getElementById('prev-instruction');

    const closeOverlay = () => {
        log('debug', 'Closing overlay and setting hasSeenInstructions flag.');
        overlay.classList.remove('active');
        localStorage.setItem('hasSeenInstructions', 'true');
    };

    closeBtn.addEventListener('click', closeOverlay);

    nextBtn.addEventListener('click', () => {
        if (currentInstruction < instructions.length - 1) {
            currentInstruction++;
            renderInstruction();
        } else {
            closeOverlay(); // 'Finish' button functionality
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentInstruction > 0) {
            currentInstruction--;
            renderInstruction();
        }
    });

    const hasSeenInstructions = localStorage.getItem('hasSeenInstructions');
    log('debug', `localStorage 'hasSeenInstructions' is: ${hasSeenInstructions}`);

    if (!hasSeenInstructions) {
        log('info', 'User has not seen instructions. Activating overlay.');
        overlay.classList.add('active');
        renderInstruction();
    } else {
        log('info', 'User has already seen instructions. Overlay will not be shown.');
    }
}

function renderInstruction() {
    log('debug', `Rendering instruction page: ${currentInstruction + 1}`);
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

/**
 * Initializes all the main event listeners for the application.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
function initializeEventListeners(elements) {
    elements.rangeCheckbox.addEventListener('change', () => {
        elements.rangeInputs.style.display = elements.rangeCheckbox.checked ? 'block' : 'none';
    });

    elements.readingForm.addEventListener('submit', (e) => handleReadingSubmit(e, elements));
    elements.periodButton.addEventListener('click', () => handleNewCycleSubmit(elements));
}

// ... (The rest of the file remains the same)
/**
 * Fetches initial cycle and analytics data from the API and triggers the first render.
 * @param {object} elements - An object containing references to the main DOM elements.
 * @param {number} [viewAsUserId=null] - The ID of the user to view data for.
 */
async function fetchAndRenderData(elements, viewAsUserId = null) {
    // DEBUG: Do not remove these logs
    log('info', `fetchAndRenderData: Starting to fetch cycles and analytics for user: ${viewAsUserId || 'self'}.`);
    try {
        const cacheBust = `?t=${new Date().getTime()}`;
        const userQuery = viewAsUserId ? `?user_id=${viewAsUserId}` : '';
        
        const responses = await Promise.all([
            fetch(`/api/me${cacheBust}`),
            fetch(`/api/cycles${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`),
            fetch(`/api/analytics${userQuery}${userQuery ? '&' : '?'}t=${cacheBust}`)
        ]);

        // Check for unauthorized responses and redirect to login
        for (const response of responses) {
            if (response.status === 401) {
                log('info', 'User not authenticated, redirecting to login page.');
                window.location.href = '/';
                return;
            }
        }

        const [user, cycles, analytics] = await Promise.all(responses.map(res => res.json()));

        log('debug', 'fetchAndRenderData: User data fetched.', user);
        log('debug', 'fetchAndRenderData: Cycles data fetched.', cycles);
        log('debug', 'fetchAndRenderData: Analytics data fetched.', analytics);

        if (user.is_admin) {
            const appMenuContent = document.getElementById('app-menu-content');
            if (!appMenuContent.querySelector('.admin-link')) {
                const adminLink = document.createElement('a');
                adminLink.href = '/admin';
                adminLink.textContent = 'Admin';
                adminLink.className = 'admin-link';
                appMenuContent.prepend(adminLink);
            }
        }

        const sharedUsersRes = await fetch('/api/shared-users');
        const sharedUsers = await sharedUsersRes.json();
        renderAccountSwitcher(sharedUsers, elements);

        renderAnalytics(analytics, cycles, elements);
    } catch (error) {
        log('error', 'Error fetching data:', error);
    }
}

/**
 * Renders the cycle cards and their day grids.
 * @param {Array<object>} cycles - An array of cycle objects.
 * @param {object} elements - An object containing references to the main DOM elements.
 * @param {Array<object>} [fertileWindows=[]] - An array of calculated fertile window objects.
 */
function renderCycles(cycles, elements, fertileWindows = []) {
    log('info', 'renderCycles: Starting to render cycles.');
    elements.cyclesContainer.innerHTML = '';
    if (!cycles || cycles.length === 0) {
        log('info', 'renderCycles: No cycles to render.');
        elements.cyclesContainer.innerHTML = '<p>No cycle data yet. Start a new cycle to begin tracking.</p>';
        return;
    }
    cycles.forEach((cycle, index) => {
        const cycleDiv = document.createElement('div');
        cycleDiv.className = 'cycle';
        cycleDiv.dataset.cycleId = cycle.id;
        const currentFertileWindow = fertileWindows[index];

        const cycleHeaderContainer = document.createElement('div');
        cycleHeaderContainer.className = 'cycle-header-container';

        const cycleHeader = document.createElement('div');
        cycleHeader.className = 'cycle-header';
        cycleHeader.textContent = `Cycle ${cycles.length - index}`;
        cycleHeaderContainer.appendChild(cycleHeader);

        const menuContainer = document.createElement('div');
        menuContainer.className = 'cycle-menu-container';
        
        const menuButton = document.createElement('div');
        menuButton.className = 'cycle-menu-button';
        menuButton.innerHTML = `<span></span><span></span><span></span>`;
        menuContainer.appendChild(menuButton);

        const menuContent = document.createElement('div');
        menuContent.className = 'cycle-menu-content';
        menuContent.innerHTML = `
            <a href="#" class="edit-cycle">Edit</a>
            <a href="#" class="delete-cycle">Delete</a>
        `;
        menuContainer.appendChild(menuContent);
        cycleHeaderContainer.appendChild(menuContainer);
        cycleDiv.appendChild(cycleHeaderContainer);

        menuButton.onclick = (e) => {
            e.stopPropagation();
            if (cycleDiv.classList.contains('edit-mode')) {
                toggleEditMode(cycleDiv, cycle.id, elements);
            } else {
                menuContent.classList.toggle('active');
            }
        };

        menuContent.querySelector('.edit-cycle').onclick = (e) => {
            e.preventDefault();
            toggleEditMode(cycleDiv, cycle.id, elements);
            menuContent.classList.remove('active');
        };

        menuContent.querySelector('.delete-cycle').onclick = (e) => {
            e.preventDefault();
            deleteCycle(cycle.id, elements);
        };

        const dayGrid = document.createElement('div');
        dayGrid.className = 'day-grid';

        cycle.days.forEach(dayData => {
            const dayDiv = createDayDiv(dayData, cycle, currentFertileWindow, elements);
            dayGrid.appendChild(dayDiv);
        });

        cycleDiv.appendChild(dayGrid);
        elements.cyclesContainer.appendChild(cycleDiv);
    });
}

/**
 * Calculates the fertile windows for each cycle based on hormone readings.
 * @param {Array<object>} cycles - An array of cycle objects.
 * @returns {{fertileWindows: Array<object>, averageFertileWindow: number}}
 */
function calculateFertileWindows(cycles) {
    // ... (implementation is correct, no changes needed)
    let totalFertileDays = 0;
    let fertileCyclesCount = 0;

    const fertileWindows = cycles.map(cycle => {
        const highOrPeakDays = cycle.days.filter(d => d.hormone_reading === 'High' || d.hormone_reading === 'Peak').sort((a, b) => new Date(a.date) - new Date(b.date));
        const peakDays = cycle.days.filter(d => d.hormone_reading === 'Peak').sort((a, b) => new Date(a.date) - new Date(b.date));

        if (highOrPeakDays.length === 0) return null;

        const firstHighOrPeakDate = new Date(highOrPeakDays[0].date);
        const fertileStart = new Date(firstHighOrPeakDate);
        fertileStart.setDate(fertileStart.getDate() - 6);

        let fertileEnd;
        if (peakDays.length > 0) {
            const lastPeakDate = new Date(peakDays[peakDays.length - 1].date);
            fertileEnd = new Date(lastPeakDate);
            fertileEnd.setDate(fertileEnd.getDate() + 3);
        } else {
            const lastHighDate = new Date(highOrPeakDays[highOrPeakDays.length - 1].date);
            fertileEnd = new Date(lastHighDate);
        }
        
        const cycleStartDate = new Date(cycle.start_date);
        if (fertileStart < cycleStartDate) {
            fertileStart.setTime(cycleStartDate.getTime());
        }

        const length = (fertileEnd.getTime() - fertileStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        if (length > 0) {
            totalFertileDays += length;
            fertileCyclesCount++;
        }

        return { start: fertileStart, end: fertileEnd };
    });

    const averageFertileWindow = fertileCyclesCount > 0 ? Math.round(totalFertileDays / fertileCyclesCount) : 0;
    return { fertileWindows, averageFertileWindow };
}

/**
 * Renders the account switcher dropdown menu.
 * @param {Array<object>} users - The list of users the current user can view.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
function renderAccountSwitcher(users, elements) {
    const container = document.getElementById('account-switcher-container');
    const section = document.getElementById('account-switcher-section');

    if (!container || !section) return;
    
    if (users.length <= 1) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    let switcher = document.getElementById('account-switcher');
    if (!switcher) {
        switcher = document.createElement('select');
        switcher.id = 'account-switcher';
        container.appendChild(switcher);

        switcher.addEventListener('change', (e) => {
            const selectedUserId = e.target.value;
            fetchAndRenderData(elements, selectedUserId);
        });
    }

    const currentSelection = switcher.value;
    switcher.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        if (user.id == currentSelection) {
            option.selected = true;
        }
        switcher.appendChild(option);
    });
}

/**
 * Renders the analytics data and estimated future dates.
 * @param {object} analytics - The calculated analytics data from the API.
 * @param {Array<object>} cycles - An array of cycle objects.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
function renderAnalytics(analytics, cycles, elements) {
    log('info', 'renderAnalytics: Starting to render analytics.');
    elements.avgCycleLengthSpan.textContent = analytics.averageCycleLength || '--';
    elements.avgDaysToPeakSpan.textContent = analytics.averageDaysToPeak || '--';

    const { fertileWindows, averageFertileWindow } = calculateFertileWindows(cycles);
    document.getElementById('avg-fertile-window').textContent = averageFertileWindow > 0 ? `${averageFertileWindow} days` : '--';
    
    renderCycles(cycles, elements, fertileWindows);

    const estimatedNextPeriodSpan = document.getElementById('estimated-next-period');
    const fertileWindowStartSpan = document.getElementById('fertile-window-start');
    const fertileWindowEndSpan = document.getElementById('fertile-window-end');

    if (analytics.averageCycleLength > 0 && cycles.length > 0) {
        const lastCycle = cycles[0];
        const lastCycleStartDate = new Date(lastCycle.start_date);
        const estimatedNextDate = new Date(lastCycleStartDate);
        estimatedNextDate.setDate(lastCycleStartDate.getDate() + analytics.averageCycleLength);
        estimatedNextPeriodSpan.textContent = estimatedNextDate.toLocaleDateString();

        if (analytics.averageDaysToPeak > 0) {
            const estimatedFertileStart = new Date(estimatedNextDate);
            estimatedFertileStart.setDate(estimatedNextDate.getDate() + analytics.averageDaysToPeak - 7);
            const estimatedFertileEnd = new Date(estimatedNextDate);
            estimatedFertileEnd.setDate(estimatedNextDate.getDate() + analytics.averageDaysToPeak + 3);
            fertileWindowStartSpan.textContent = estimatedFertileStart.toLocaleDateString();
            fertileWindowEndSpan.textContent = estimatedFertileEnd.toLocaleDateString();
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

/**
 * Creates a DOM element for a single day in a cycle.
 * @param {object} dayData - The data for the specific day.
 * @param {object} cycle - The parent cycle object.
 * @param {object} fertileWindow - The calculated fertile window for the cycle.
 * @param {object} elements - An object containing references to the main DOM elements.
 * @returns {HTMLElement} The created day element.
 */
function createDayDiv(dayData, cycle, fertileWindow, elements) {
    const dayDate = new Date(dayData.date);
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    if (fertileWindow && dayDate >= fertileWindow.start && dayDate <= fertileWindow.end) {
        dayDiv.classList.add('fertile-window');
    }
    dayDiv.dataset.dayData = JSON.stringify(dayData);

    const dayNumber = Math.floor((dayDate.getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dayNumberDiv = document.createElement('div');
    dayNumberDiv.className = 'day-number';
    dayNumberDiv.textContent = `Day ${dayNumber}`;
    dayDiv.appendChild(dayNumberDiv);

    const dayOfMonth = dayDate.getUTCDate();
    const month = dayDate.getUTCMonth() + 1;
    const formattedDate = `${String(month).padStart(2, '0')}/${String(dayOfMonth).padStart(2, '0')}`;
    const dateDiv = document.createElement('div');
    dateDiv.className = 'day-date';
    dateDiv.textContent = formattedDate;
    dayDiv.appendChild(dateDiv);

    const readingDiv = document.createElement('div');
    readingDiv.className = `reading ${dayData.hormone_reading || 'none'}`;
    readingDiv.textContent = dayData.hormone_reading || 'No Reading';
    dayDiv.appendChild(readingDiv);

    if (dayData.intercourse) {
        const heartDiv = document.createElement('div');
        heartDiv.className = 'heart';
        heartDiv.textContent = '❤️';
        dayDiv.appendChild(heartDiv);
    }
    return dayDiv;
}

/**
 * Sends a request to the API to log or update a reading.
 * @param {object} payload - The data for the reading.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
async function logOrUpdateReading(payload, elements) {
    log('info', 'logOrUpdateReading: Preparing to log or update reading.');
    log('debug', 'Payload:', payload);
    const { id, ...body } = payload;
    const isUpdate = id !== undefined && id !== null;
    const url = isUpdate ? `/api/cycles/days/${id}` : '/api/cycles/days';
    const method = isUpdate ? 'PUT' : 'POST';

    try {
        log('debug', `Sending ${method} request to ${url}`);
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }
        fetchAndRenderData(elements);
    } catch (error) {
        log('error', `Error ${isUpdate ? 'updating' : 'logging'} reading:`, error);
        alert('An unknown error occurred. Please check the console.');
    }
}

/**
 * Toggles the edit mode for a cycle card, allowing for inline editing of day data.
 * @param {HTMLElement} cycleDiv - The DOM element for the cycle.
 * @param {number} cycleId - The ID of the cycle.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
function toggleEditMode(cycleDiv, cycleId, elements) {
    log('info', `toggleEditMode: Toggling edit mode for cycle ${cycleId}.`);
    const isEditing = cycleDiv.classList.toggle('edit-mode');
    log('debug', `Is editing: ${isEditing}`);
    const dayDivs = cycleDiv.querySelectorAll('.day');
    dayDivs.forEach(dayDiv => {
        const readingDiv = dayDiv.querySelector('.reading');
        if (readingDiv) {
            if (isEditing) {
                const dayData = JSON.parse(dayDiv.dataset.dayData);

                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'delete-day';
                deleteBtn.textContent = 'x';
                deleteBtn.onclick = () => deleteReading(dayData.id, elements);
                dayDiv.appendChild(deleteBtn);

                const reading = dayData.hormone_reading;
                readingDiv.innerHTML = `
                    <select>
                        <option value="" ${!reading || reading === 'No Reading' ? 'selected' : ''}>No Reading</option>
                        <option value="Low" ${reading === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="High" ${reading === 'High' ? 'selected' : ''}>High</option>
                        <option value="Peak" ${reading === 'Peak' ? 'selected' : ''}>Peak</option>
                    </select>
                `;

                const intercourseCheckbox = document.createElement('input');
                intercourseCheckbox.type = 'checkbox';
                intercourseCheckbox.checked = dayData.intercourse;
                
                const intercourseLabel = document.createElement('label');
                intercourseLabel.textContent = ' ❤️';
                intercourseLabel.prepend(intercourseCheckbox);
                readingDiv.appendChild(intercourseLabel);
            } else {
                const deleteBtn = dayDiv.querySelector('.delete-day');
                if (deleteBtn) deleteBtn.remove();

                const select = readingDiv.querySelector('select');
                const newReading = select.value;
                const intercourseCheckbox = readingDiv.querySelector('input[type="checkbox"]');
                const newIntercourse = intercourseCheckbox.checked;

                const dayData = JSON.parse(dayDiv.dataset.dayData);
                const originalReading = dayData.hormone_reading || null;
                const updatedReading = newReading === '' ? null : newReading;
                const originalIntercourse = !!dayData.intercourse;

                let changesMade = false;
                const payload = { date: dayData.date };

                if (originalReading !== updatedReading) {
                    payload.hormone_reading = updatedReading;
                    changesMade = true;
                }
                if (originalIntercourse !== newIntercourse) {
                    payload.intercourse = newIntercourse;
                    changesMade = true;
                }

                if (changesMade) {
                    logOrUpdateReading({ ...payload, id: dayData.id }, elements);
                } else {
                    readingDiv.innerHTML = '';
                    readingDiv.className = `reading ${originalReading || 'none'}`;
                    readingDiv.textContent = originalReading || 'No Reading';

                    const heartIcon = dayDiv.querySelector('.heart');
                    if (originalIntercourse && !heartIcon) {
                        const heartDiv = document.createElement('div');
                        heartDiv.className = 'heart';
                        heartDiv.textContent = '❤️';
                        dayDiv.appendChild(heartDiv);
                    } else if (!originalIntercourse && heartIcon) {
                        heartIcon.remove();
                    }
                }
            }
        }
    });
}

/**
 * Handles the submission of the main reading form for single or range entries.
 * @param {Event} e - The form submission event.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
async function handleReadingSubmit(e, elements) {
    e.preventDefault();
    log('info', 'readingForm submit: Form submitted.');
    const hormone_reading = document.getElementById('reading').value;
    const intercourse = document.getElementById('intercourse-checkbox').checked;
    const date = elements.dateInput.value;
    const end_date = elements.endDateInput.value;
    const range = elements.rangeCheckbox.checked;

    const url = range ? '/api/cycles/days/range' : '/api/cycles/days';
    const body = range 
        ? { start_date: date, end_date: end_date, hormone_reading, intercourse }
        : { date, hormone_reading, intercourse };

    try {
        log('debug', `Submitting reading to ${url} with body:`, body);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }
        fetchAndRenderData(elements);
    } catch (error) {
        log('error', 'Error logging reading:', error);
        alert('An error occurred while logging the reading. Please check the console for details.');
    }
}

/**
 * Handles the submission for starting a new cycle.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
async function handleNewCycleSubmit(elements) {
    log('info', 'periodButton click: "Start New Cycle" button clicked.');
    const startDate = elements.periodStartDateInput.value;
    if (!startDate) {
        log('warn', 'periodButton click: No start date selected.');
        return;
    }

    try {
        log('debug', `Sending request to start new cycle with date: ${startDate}`);
        const response = await fetch('/api/cycles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: startDate }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }
        fetchAndRenderData(elements);
    } catch (error) {
        log('error', 'Error starting new cycle:', error);
        const errorData = await response.json();
        alert(`Error starting new cycle: ${errorData.error}\nDetails: ${errorData.details}`);
    }
}

/**
 * Deletes an entire cycle and all its associated data.
 * @param {number} id - The ID of the cycle to delete.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
async function deleteCycle(id, elements) {
    log('info', `deleteCycle: Attempting to delete cycle ${id}.`);
    if (!confirm('Are you sure you want to delete this entire cycle and all its readings? This action cannot be undone.')) {
        log('info', 'deleteCycle: Deletion cancelled by user.');
        return;
    }
    try {
        const response = await fetch(`/api/cycles/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete cycle.');
        }
        fetchAndRenderData(elements);
    } catch (error) {
        log('error', `Error deleting cycle ${id}:`, error);
        alert(`Error deleting cycle: ${error.message}`);
    }
}

/**
 * Deletes a single day's reading.
 * @param {number} id - The ID of the day reading to delete.
 * @param {object} elements - An object containing references to the main DOM elements.
 */
async function deleteReading(id, elements) {
    if (!id) {
        log('info', 'deleteReading: Attempted to delete a placeholder reading. No action taken.');
        return;
    }
    log('info', `deleteReading: Attempting to delete reading ${id}.`);
    if (!confirm('Are you sure you want to delete this reading?')) {
        log('info', `deleteReading: Deletion of reading ${id} cancelled by user.`);
        return;
    }
    try {
        const response = await fetch(`/api/cycles/days/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete reading.');
        }
        fetchAndRenderData(elements);
    } catch (error) {
        log('error', `Error deleting reading ${id}:`, error);
        alert(`Error deleting reading: ${error.message}`);
    }
}

/**
 * Handles the submission of the "Share Your Data" form.
 * @param {Event} e - The form submission event.
 */
async function handleShareSubmit(e) {
    e.preventDefault();
    const messageElement = document.getElementById('share-message');
    const email = document.getElementById('partner-email').value;

    try {
        const response = await fetch('/api/partner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const result = await response.json();
        if (response.ok) {
            messageElement.textContent = result.message;
            messageElement.style.color = 'green';
            document.getElementById('share-form').reset();
        } else {
            throw new Error(result.error || 'Failed to share data.');
        }
    } catch (error) {
        messageElement.textContent = error.message;
        messageElement.style.color = 'red';
    }
}
