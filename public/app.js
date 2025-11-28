document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const menuContent = document.getElementById('menu-content');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuContent.classList.toggle('active');
        });
    }

    // Close menu if clicking outside
    document.addEventListener('click', (event) => {
        if (menuContent && !menuContent.contains(event.target) && !menuToggle.contains(event.target) && menuContent.classList.contains('active')) {
            menuToggle.classList.remove('active');
            menuContent.classList.remove('active');
        }
    });

    const readingForm = document.getElementById('reading-form');
    if (readingForm) {
        const periodButton = document.getElementById('period-button');
        const cyclesContainer = document.getElementById('cycles-container');
        const avgCycleLengthSpan = document.getElementById('avg-cycle-length');
        const avgDaysToPeakSpan = document.getElementById('avg-days-to-peak');
        const dateInput = document.getElementById('date');
        const periodStartDateInput = document.getElementById('period-start-date');
        const rangeCheckbox = document.getElementById('range-checkbox');
        const rangeInputs = document.getElementById('range-inputs');
        const endDateInput = document.getElementById('end-date');

        rangeCheckbox.addEventListener('change', () => {
            rangeInputs.style.display = rangeCheckbox.checked ? 'block' : 'none';
        });

        // Set period start date to today by default
        periodStartDateInput.value = new Date().toISOString().split('T')[0];

        const fetchAndRenderData = async () => {
            console.log('Fetching and rendering data...');
            try {
                const cacheBust = `?t=${new Date().getTime()}`;
                // Fetch cycles
                const cyclesRes = await fetch(`/api/cycles${cacheBust}`);
                const cycles = await cyclesRes.json();
                console.log('Fetched cycles:', cycles);
                renderCycles(cycles);

                // Fetch analytics
                const analyticsRes = await fetch(`/api/analytics${cacheBust}`);
                const analytics = await analyticsRes.json();
                renderAnalytics(analytics, cycles);
            } catch (error) {
                console.error('Error fetching data:', error);
                alert('An error occurred while fetching data. Please check the console for details.');
            }
        };

        const renderCycles = (cycles) => {
            console.log('Rendering cycles...');
            cyclesContainer.innerHTML = '';
            // The backend sends cycles sorted newest first. To display them in that order,
            // and still get correct chronological numbering, we iterate normally and calculate the number.
            if (!cycles || cycles.length === 0) {
                cyclesContainer.innerHTML = '<p>No cycle data yet. Start a new cycle to begin tracking.</p>';
                return;
            }
            cycles.forEach((cycle, index) => {
                const cycleDiv = document.createElement('div');
                cycleDiv.className = 'cycle';
                cycleDiv.dataset.cycleId = cycle.id;

                // Treat date strings from backend as UTC to prevent timezone shifts
                const startDate = new Date(cycle.start_date);
                
                let endDate;
                let effectiveEndDate;
                if (cycle.end_date) {
                    endDate = new Date(cycle.end_date);
                    effectiveEndDate = endDate;
                } else {
                    const latestReadingDate = cycle.days.length > 0 ? cycle.days.reduce((max, day) => {
                        const dayDate = new Date(day.date);
                        return dayDate > max ? dayDate : max;
                    }, startDate) : startDate;
                    
                    effectiveEndDate = latestReadingDate;
                }

                const cycleLength = (effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
                
                const cycleHeaderContainer = document.createElement('div');
                cycleHeaderContainer.className = 'cycle-header-container';

                const cycleHeader = document.createElement('div');
                cycleHeader.className = 'cycle-header';
                const cycleNumber = cycles.length - index;
                cycleHeader.textContent = `Cycle ${cycleNumber}`;
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
                        toggleEditMode(cycleDiv, cycle.id);
                    } else {
                        menuContent.classList.toggle('active');
                    }
                };

                menuContent.querySelector('.edit-cycle').onclick = (e) => {
                    e.preventDefault();
                    toggleEditMode(cycleDiv, cycle.id);
                    menuContent.classList.remove('active');
                };

                menuContent.querySelector('.delete-cycle').onclick = (e) => {
                    e.preventDefault();
                    deleteCycle(cycle.id);
                };

                const dayGrid = document.createElement('div');
                dayGrid.className = 'day-grid';

                cycle.days.forEach(dayData => {
                    const dayDiv = createDayDiv(dayData, cycle);
                    dayGrid.appendChild(dayDiv);
                });

                cycleDiv.appendChild(dayGrid);
                cyclesContainer.appendChild(cycleDiv);
            });
        };

        const calculateFertileWindows = (cycles) => {
            let totalFertileDays = 0;
            let fertileCyclesCount = 0;

            const fertileWindows = cycles.map(cycle => {
                const highOrPeakDays = cycle.days.filter(d => d.hormone_reading === 'High' || d.hormone_reading === 'Peak').sort((a, b) => new Date(a.date) - new Date(b.date));
                const peakDays = cycle.days.filter(d => d.hormone_reading === 'Peak').sort((a, b) => new Date(a.date) - new Date(b.date));

                if (highOrPeakDays.length === 0) {
                    return null;
                }

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
        };

        const renderAnalytics = (analytics, cycles) => {
            avgCycleLengthSpan.textContent = analytics.averageCycleLength || '--';
            avgDaysToPeakSpan.textContent = analytics.averageDaysToPeak || '--';

            const { averageFertileWindow } = calculateFertileWindows(cycles);
            document.getElementById('avg-fertile-window').textContent = averageFertileWindow > 0 ? `${averageFertileWindow} days` : '--';

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
        };

        const updateCycleUI = (updatedCycle) => {
            console.log('Updating cycle UI for cycle:', updatedCycle);
            let cycleDiv = document.querySelector(`.cycle[data-cycle-id='${updatedCycle.id}']`);
            if (cycleDiv) {
                const dayGrid = cycleDiv.querySelector('.day-grid');
                dayGrid.innerHTML = '';
                updatedCycle.days.forEach(dayData => {
                    const dayDiv = createDayDiv(dayData, updatedCycle);
                    dayGrid.appendChild(dayDiv);
                });
            } else {
                fetchAndRenderData();
            }
        };

        const createDayDiv = (dayData, cycle) => {
            console.log('Creating day div for:', dayData, cycle);
            const dayDate = new Date(dayData.date);
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day';
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
        };
        
        const logOrUpdateReading = async (payload) => {
            console.log('Logging or updating reading:', payload);
            const { id, ...body } = payload;
            const isUpdate = id !== undefined && id !== null;
            const url = isUpdate ? `/api/cycles/days/${id}` : '/api/cycles/days';
            const method = isUpdate ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                const updatedCycle = await response.json();
                updateCycleUI(updatedCycle);
            } catch (error) {
                console.error(`Error ${isUpdate ? 'updating' : 'logging'} reading:`, error);
                alert('An unknown error occurred. Please check the console.');
            }
        };

        const toggleEditMode = (cycleDiv, cycleId) => {
            console.log('Toggling edit mode for cycle:', cycleId);
            const isEditing = cycleDiv.classList.toggle('edit-mode');
            const dayDivs = cycleDiv.querySelectorAll('.day');
            dayDivs.forEach(dayDiv => {
                const readingDiv = dayDiv.querySelector('.reading');
                if (readingDiv) {
                    if (isEditing) {
                        const dayData = JSON.parse(dayDiv.dataset.dayData);
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
                        const select = readingDiv.querySelector('select');
                        const newReading = select.value;
                        const intercourseCheckbox = readingDiv.querySelector('input[type="checkbox"]');
                        const newIntercourse = intercourseCheckbox.checked;

                        const dayData = JSON.parse(dayDiv.dataset.dayData);
                        const originalReading = dayData.hormone_reading || null;
                        const updatedReading = newReading === '' ? null : newReading;
                        const originalIntercourse = !!dayData.intercourse;
                        const updatedIntercourse = newIntercourse;

                        let changesMade = false;
                        const payload = { date: dayData.date };

                        if (originalReading !== updatedReading) {
                            payload.hormone_reading = updatedReading;
                            changesMade = true;
                        }

                        if (originalIntercourse !== updatedIntercourse) {
                            payload.intercourse = updatedIntercourse;
                            changesMade = true;
                        }

                        if (changesMade) {
                            logOrUpdateReading({ ...payload, id: dayData.id });
                        }
                    }
                }
            });
        };

        readingForm.addEventListener('submit', async (e) => {
            console.log('Reading form submitted');
            e.preventDefault();
            const hormone_reading = document.getElementById('reading').value;
            const intercourse = document.getElementById('intercourse-checkbox').checked;
            const date = document.getElementById('date').value;
            const end_date = document.getElementById('end-date').value;
            const range = document.getElementById('range-checkbox').checked;

            const url = range ? '/api/cycles/days/range' : '/api/cycles/days';
            const body = range 
                ? { start_date: date, end_date: end_date, hormone_reading, intercourse }
                : { date, hormone_reading, intercourse };

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                
                if (range) {
                    fetchAndRenderData();
                } else {
                    const updatedCycle = await response.json();
                    updateCycleUI(updatedCycle);
                }
            } catch (error) {
                console.error('Error logging reading:', error);
                alert('An error occurred while logging the reading. Please check the console for details.');
            }
        });

        periodButton.addEventListener('click', async () => {
            const startDate = periodStartDateInput.value;
            if (!startDate) {
                console.log('Please select a start date for your period.');
                return;
            }

            try {
                const response = await fetch('/api/cycles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ start_date: startDate }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                fetchAndRenderData();
            } catch (error) {
                console.error('Error starting new cycle:', error);
                const errorData = await response.json();
                alert(`Error starting new cycle: ${errorData.error}\nDetails: ${errorData.details}`);
            }
        });


        const deleteCycle = async (id) => {
            if (!confirm('Are you sure you want to delete this entire cycle and all its readings? This action cannot be undone.')) {
                return;
            }
            try {
                const response = await fetch(`/api/cycles/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Failed to delete cycle.');
                }
                fetchAndRenderData();
            } catch (error) {
                console.error('Error deleting cycle:', error);
                alert(`Error deleting cycle: ${error.message}`);
            }
        };

        const deleteReading = async (id) => {
            // If the day card is a placeholder, it won't have an ID. Do nothing.
            if (!id) {
                return;
            }
            if (!confirm('Are you sure you want to delete this reading?')) {
                return;
            }
            try {
                const response = await fetch(`/api/cycles/days/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Failed to delete reading.');
                }
                fetchAndRenderData();
            } catch (error) {
                console.error('Error deleting reading:', error);
                alert(`Error deleting reading: ${error.message}`);
            }
        };

        const openEditModal = (dayData) => {
            const formattedDayDate = dayData.date.split('T')[0];

            let modal = document.getElementById('edit-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'edit-modal';
                modal.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    z-index: 1000; display: flex; flex-direction: column; gap: 10px;
                `;
                modal.innerHTML = `
                    <h3>Edit Reading for ${new Date(formattedDayDate  + 'T00:00:00').toLocaleDateString()}</h3>
                    <label for="edit-hormone-reading">Hormone Reading:</label>
                    <select id="edit-hormone-reading" required>
                        <option value="Low">Low</option>
                        <option value="High">High</option>
                        <option value="Peak">Peak</option>
                    </select>
                    <div style="display: flex; justify-content: space-between;">
                        <button id="save-edit">Save</button>
                        <button id="cancel-edit">Cancel</button>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            document.getElementById('edit-hormone-reading').value = dayData.hormone_reading || 'Low';
            modal.style.display = 'flex';

            const saveEditButton = document.getElementById('save-edit');
            saveEditButton.onclick = async () => {
                const newHormoneReading = document.getElementById('edit-hormone-reading').value;
                
                // Determine if it's an update or a new reading
                const method = dayData.id.toString().startsWith('placeholder') ? 'POST' : 'PUT';
                const url = method === 'PUT' ? `/api/cycles/days/${dayData.id}` : '/api/cycles/days';
                const body = { date: formattedDayDate, hormone_reading: newHormoneReading };

                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText);
                    }
                    fetchAndRenderData();
                    modal.style.display = 'none';
                } catch (error) {
                    console.error('Error updating reading:', error);
                    const errorData = await response.json();
                    alert(`Error updating reading: ${errorData.error}\nDetails: ${errorData.details}`);
                }
            };

            const cancelEditButton = document.getElementById('cancel-edit');
            cancelEditButton.onclick = () => {
                modal.style.display = 'none';
            };
        };

        fetchAndRenderData();
    }
});
