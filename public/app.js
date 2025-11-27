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
        const clearDataButton = document.getElementById('clear-data-button');
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
            try {
                // Fetch cycles
                const cyclesRes = await fetch('/api/cycles');
                const cycles = await cyclesRes.json();
                renderCycles(cycles);

                // Fetch analytics
                const analyticsRes = await fetch('/api/analytics');
                const analytics = await analyticsRes.json();
                renderAnalytics(analytics, cycles);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        const renderCycles = (cycles) => {
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

                // Treat date strings from backend as UTC to prevent timezone shifts
                const startDate = new Date(cycle.start_date + 'T00:00:00');
                
                let endDate;
                let effectiveEndDate;
                if (cycle.end_date) {
                    endDate = new Date(cycle.end_date + 'T00:00:00');
                    effectiveEndDate = endDate;
                } else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const latestReadingDate = cycle.days.length > 0 ? cycle.days.reduce((max, day) => {
                        const dayDate = new Date(day.date + 'T00:00:00');
                        return dayDate > max ? dayDate : max;
                    }, new Date(0)) : startDate;
                    
                    effectiveEndDate = today > latestReadingDate ? today : latestReadingDate;
                }

                const cycleLength = (effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
                
                const cycleHeaderContainer = document.createElement('div');
                cycleHeaderContainer.className = 'cycle-header-container';

                const cycleHeader = document.createElement('div');
                cycleHeader.className = 'cycle-header';
                const cycleNumber = cycles.length - index;
                cycleHeader.textContent = `Cycle ${cycleNumber} started on ${startDate.toLocaleDateString()} (Length: ${Math.floor(cycleLength)} days)`;
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
                    const dayDate = new Date(dayData.date + 'T00:00:00');
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'day';
                    dayDiv.dataset.dayData = JSON.stringify(dayData);

                    const { fertileWindows } = calculateFertileWindows(cycles);
                    const cycleFertileWindow = fertileWindows[index];
                    if (cycleFertileWindow && dayDate >= cycleFertileWindow.start && dayDate <= cycleFertileWindow.end) {
                        dayDiv.classList.add('fertile-window');
                    }

                    const dayNumber = Math.floor((dayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const dayNumberDiv = document.createElement('div');
                    dayNumberDiv.className = 'day-number';
                    dayNumberDiv.textContent = `Day ${dayNumber}`;
                    dayDiv.appendChild(dayNumberDiv);

                    const dayOfMonth = dayDate.getDate();
                    const month = dayDate.getMonth() + 1;
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

                const firstHighOrPeakDate = new Date(highOrPeakDays[0].date + 'T00:00:00');
                const fertileStart = new Date(firstHighOrPeakDate);
                fertileStart.setDate(fertileStart.getDate() - 6);

                let fertileEnd;
                if (peakDays.length > 0) {
                    const lastPeakDate = new Date(peakDays[peakDays.length - 1].date + 'T00:00:00');
                    fertileEnd = new Date(lastPeakDate);
                    fertileEnd.setDate(fertileEnd.getDate() + 3);
                } else {
                    // If no peak, maybe the fertile window is just the high days? This is an assumption.
                    const lastHighDate = new Date(highOrPeakDays[highOrPeakDays.length - 1].date + 'T00:00:00');
                    fertileEnd = new Date(lastHighDate);
                }
                
                const cycleStartDate = new Date(cycle.start_date + 'T00:00:00');
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

            const { averageFertileWindow, fertileWindows } = calculateFertileWindows(cycles);
            document.getElementById('avg-fertile-window').textContent = averageFertileWindow > 0 ? `${averageFertileWindow} days` : '--';

            const estimatedNextPeriodSpan = document.getElementById('estimated-next-period');
            const fertileWindowStartSpan = document.getElementById('fertile-window-start');
            const fertileWindowEndSpan = document.getElementById('fertile-window-end');

            if (analytics.averageCycleLength > 0 && cycles.length > 0) {
                const lastCycle = cycles[0];
                const lastCycleStartDate = new Date(lastCycle.start_date + 'T00:00:00');
                const estimatedNextDate = new Date(lastCycleStartDate);
                estimatedNextDate.setDate(lastCycleStartDate.getDate() + analytics.averageCycleLength);
                estimatedNextPeriodSpan.textContent = estimatedNextDate.toLocaleDateString();

                if (analytics.averageDaysToPeak > 0) {
                    const estimatedFertileStart = new Date(estimatedNextDate);
                    estimatedFertileStart.setDate(estimatedNextDate.getDate() + analytics.averageDaysToPeak - 7); // 6 days before + peak day
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

        const toggleEditMode = (cycleDiv, cycleId) => {
            const isEditing = cycleDiv.classList.toggle('edit-mode');
            const menuButton = cycleDiv.querySelector('.cycle-menu-button');

            const dayDivs = cycleDiv.querySelectorAll('.day');
            dayDivs.forEach(dayDiv => {
                const readingDiv = dayDiv.querySelector('.reading');
                if (readingDiv) {
                    if (isEditing) {
                        const reading = readingDiv.textContent;
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
                        intercourseCheckbox.checked = dayDiv.querySelector('.heart') !== null;
                        
                        const intercourseLabel = document.createElement('label');
                        intercourseLabel.textContent = ' ❤️';
                        intercourseLabel.prepend(intercourseCheckbox);
                        readingDiv.appendChild(intercourseLabel);

                        const deleteButton = document.createElement('button');
                        deleteButton.textContent = 'x';
                        deleteButton.classList.add('delete-day-button');
                        deleteButton.onclick = (e) => {
                            e.stopPropagation();
                            const dayData = JSON.parse(dayDiv.dataset.dayData);
                            deleteReading(dayData.id);
                        };
                        dayDiv.appendChild(deleteButton);
                    } else {
                        const select = readingDiv.querySelector('select');
                        const newReading = select.value;
                        const intercourseCheckbox = readingDiv.querySelector('input[type="checkbox"]');
                        const newIntercourse = intercourseCheckbox.checked;

                        readingDiv.textContent = newReading || 'No Reading';

                        const dayData = JSON.parse(dayDiv.dataset.dayData);
                        const originalReading = dayData.hormone_reading || null;
                        const updatedReading = newReading === '' ? null : newReading;
                        const originalIntercourse = !!dayData.intercourse;
                        const updatedIntercourse = newIntercourse;

                        const payload = { date: dayData.date };
                        let changesMade = false;

                        // Only add hormone_reading to payload if it actually changed
                        if (originalReading !== updatedReading) {
                            payload.hormone_reading = updatedReading;
                            changesMade = true;
                        }

                        // Only add intercourse to payload if it actually changed
                        if (originalIntercourse !== updatedIntercourse) {
                            payload.intercourse = updatedIntercourse;
                            changesMade = true;
                        }

                        if (changesMade) {
                            updateReading(dayData.id, payload);
                        }

                        const deleteButton = dayDiv.querySelector('.delete-day-button');
                        if (deleteButton) {
                            deleteButton.remove();
                        }
                    }
                }
            });
        };
        
        const updateReading = async (id, payload) => {
            try {
                const response = await fetch(`/api/cycles/days/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                fetchAndRenderData();
            } catch (error) {
                console.error('Error updating reading:', error);
                alert(`Error updating reading: ${error.message}`);
            }
        };

        readingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const hormone_reading = e.target.reading.value;
            const intercourse = e.target.intercourse.checked;

            const payload = { date: e.target.date.value };
            let hasData = false;

            if (hormone_reading) {
                payload.hormone_reading = hormone_reading;
                hasData = true;
            }
            if (intercourse) {
                payload.intercourse = intercourse;
                hasData = true;
            }

            if (!hasData && !rangeCheckbox.checked) {
                alert('Please select a hormone reading or check the intercourse box.');
                return;
            }

            if (rangeCheckbox.checked) {
                const startDate = dateInput.value;
                const endDate = endDateInput.value;
                if (!startDate || !endDate) {
                    alert('Please select both a start and end date for the range.');
                    return;
                }
                if (new Date(startDate) > new Date(endDate)) {
                    alert('The start date must be before the end date.');
                    return;
                }

                const rangePayload = {
                    start_date: startDate,
                    end_date: endDate,
                    hormone_reading,
                    intercourse,
                };

                try {
                    const response = await fetch('/api/cycles/days/range', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(rangePayload),
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText);
                    }
                    fetchAndRenderData();
                    alert('Readings for the date range logged successfully!');
                } catch (error) {
                    console.error('Error logging date range readings:', error);
                    alert(`Error logging date range readings: ${error.message}`);
                }
            } else {
                const date = dateInput.value;
                try {
                    const response = await fetch('/api/cycles/days', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText);
                    }
                    fetchAndRenderData();
                    alert('Reading logged successfully!');
                } catch (error) {
                    console.error('Error logging reading:', error);
                    alert(`Error logging reading: ${error.message}`);
                }
            }
        });

        periodButton.addEventListener('click', async () => {
            const startDate = periodStartDateInput.value;
            if (!startDate) {
                alert('Please select a start date for your period.');
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
                alert('New cycle started successfully!');
            } catch (error) {
                console.error('Error starting new cycle:', error);
                alert(`Error starting new cycle: ${error.message}`);
            }
        });

        clearDataButton.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear ALL data? This action cannot be undone.')) {
                return;
            }
            try {
                const response = await fetch('/api/data', {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                fetchAndRenderData();
                alert('All data cleared successfully!');
            } catch (error) {
                console.error('Error clearing all data:', error);
                alert(`Error clearing all data: ${error.message}`);
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
                    throw new Error(errorText);
                }
                fetchAndRenderData();
                alert('Cycle deleted successfully!');
            } catch (error) {
                console.error('Error deleting cycle:', error);
                alert(`Error deleting cycle: ${error.message}`);
            }
        };

        const deleteReading = async (id) => {
            if (!confirm('Are you sure you want to delete this reading?')) {
                return;
            }
            try {
                const response = await fetch(`/api/cycles/days/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }
                fetchAndRenderData();
                alert('Reading deleted successfully!');
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
                    alert('Reading updated successfully!');
                    modal.style.display = 'none';
                } catch (error) {
                    console.error('Error updating reading:', error);
                    alert(`Error updating reading: ${error.message}`);
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
