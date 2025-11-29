/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load the HTML file
const appHtml = fs.readFileSync(path.resolve(__dirname, '../public/app.html'), 'utf8');

// Mock the fetch function
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
    ok: true,
  })
);

describe('UI Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    fetch.mockClear();
  });

  it('should render the main page', () => {
    document.body.innerHTML = appHtml;
    const title = document.querySelector('h1');
    expect(title.textContent).toBe('Rhythm');
  });

  it('should fetch and render cycles on app page load', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: '2025-01-28',
        days: [{ date: '2025-01-01', hormone_reading: 'Low', intercourse: false }],
      },
    ];
    const mockAnalytics = {
        averageCycleLength: 28,
        averageDaysToPeak: 14
    };

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockAnalytics),
                ok: true,
            });
        }
    });

    // Load the app code
    require('../public/app.js');
    
    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for the async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const cycleElements = document.querySelectorAll('.cycle');
    expect(cycleElements.length).toBe(1);
    expect(cycleElements[0].querySelector('.cycle-header').textContent).toContain('Cycle 1');
  });

  it('should update a day card with a new reading', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-01', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
            });
        }
    });

    // Load the app code
    require('../public/app.js');

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for the async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const editButton = document.querySelector('.edit-cycle');
    editButton.click();

    const select = document.querySelector('.day .reading select');
    select.value = 'High';

    editButton.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2025-01-01', hormone_reading: 'High' }),
    }));
  });

  it('should update a day card with a new reading in production', async () => {
    process.env.NODE_ENV = 'production';
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-01', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
            });
        }
    });

    // Load the app code
    require('../public/app.js');

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for the async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const editButton = document.querySelector('.edit-cycle');
    editButton.click();

    const select = document.querySelector('.day .reading select');
    select.value = 'High';

    editButton.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2025-01-01', hormone_reading: 'High' }),
    }));
    process.env.NODE_ENV = 'test';
  });

  it('should log a new reading when the form is submitted', async () => {
    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate user input
    document.getElementById('date').value = '2025-01-02';
    document.getElementById('reading').value = 'High';
    document.getElementById('intercourse-checkbox').checked = true;

    // Submit the form
    const form = document.getElementById('reading-form');
    form.dispatchEvent(new Event('submit'));

    // Wait for the async operations in logOrUpdateReading to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: '2025-01-02',
            hormone_reading: 'High',
            intercourse: true
        })
    }));
  });

  it('should log a new reading for a date range when the form is submitted', async () => {
    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate user input
    document.getElementById('date').value = '2025-01-03';
    document.getElementById('end-date').value = '2025-01-05';
    document.getElementById('reading').value = 'Peak';
    document.getElementById('range-checkbox').checked = true;

    // Submit the form
    const form = document.getElementById('reading-form');
    form.dispatchEvent(new Event('submit'));

    // Wait for the async operations in logOrUpdateReading to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/range', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_date: '2025-01-03',
            end_date: '2025-01-05',
            hormone_reading: 'Peak',
            intercourse: false
        })
    }));
  });

  it('should start a new cycle when the "Start New Cycle" button is clicked', async () => {
    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate user input
    const periodStartDateInput = document.getElementById('period-start-date');
    periodStartDateInput.value = '2025-02-01';

    // Click the button
    const periodButton = document.getElementById('period-button');
    periodButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2025-02-01' }),
    }));
  });

  it('should delete a cycle when the delete button is clicked', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
            });
        }
        if (url.includes('/api/cycles/1')) {
            return Promise.resolve({
                ok: true,
            });
        }
    });

    // Mock the confirm function
    global.confirm = jest.fn(() => true);

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Click the delete button
    const deleteButton = document.querySelector('.delete-cycle');
    deleteButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/1', expect.objectContaining({
        method: 'DELETE',
    }));
  });

  it('should delete a reading when the delete button is clicked in edit mode', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-01', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
            });
        }
    });

    // Mock the confirm function
    global.confirm = jest.fn(() => true);

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Enter edit mode
    const editButton = document.querySelector('.edit-cycle');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Click the delete button for the reading
    const deleteButton = document.querySelector('.delete-day');
    deleteButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'DELETE',
    }));
  });

  it('should toggle the visibility of the end date input when the "Set Date Range" checkbox is clicked', async () => {
    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const rangeCheckbox = document.getElementById('range-checkbox');
    const rangeInputs = document.getElementById('range-inputs');

    // Initially, the end date input should be hidden
    expect(rangeInputs.style.display).toBe('none');

    // Click the checkbox to show the end date input
    rangeCheckbox.click();
    expect(rangeInputs.style.display).toBe('block');

    // Click the checkbox again to hide the end date input
    rangeCheckbox.click();
    expect(rangeInputs.style.display).toBe('none');
  });

  it('should only show the delete button for existing readings in edit mode', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [
          { id: 1, date: '2025-01-01', hormone_reading: 'Low', intercourse: false },
          { date: '2025-01-02', hormone_reading: null, intercourse: false }
        ],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
            });
        }
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code
    require('../public/app.js');

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Enter edit mode
    const editButton = document.querySelector('.edit-cycle');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const dayDivs = document.querySelectorAll('.day');
    const day1DeleteButton = dayDivs[0].querySelector('.delete-day');
    const day2DeleteButton = dayDivs[1].querySelector('.delete-day');

    expect(day1DeleteButton).not.toBeNull();
    expect(day2DeleteButton).toBeNull();
  });

});
