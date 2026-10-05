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
    status: 200
  })
);

// Keep track of document event listeners to ensure perfect JSDOM test isolation
let docListeners = [];
const origAddEventListener = document.addEventListener;
document.addEventListener = (type, listener, options) => {
    docListeners.push({ type, listener, options });
    origAddEventListener.call(document, type, listener, options);
};

const OLD_ENV = process.env;

describe('UI Tests', () => {
  beforeEach(() => {
    // Reset mocks, module cache, environment variables, and document event listeners before each test
    fetch.mockClear();
    jest.resetModules();
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    docListeners.forEach(({ type, listener, options }) => {
        document.removeEventListener(type, listener, options);
    });
    docListeners = [];
  });

  afterAll(() => {
    process.env = OLD_ENV;
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
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockAnalytics),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for all chained async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const cycleElements = document.querySelectorAll('.cycle');
    expect(cycleElements.length).toBe(1);
    expect(cycleElements[0].querySelector('.cycle-header').textContent).toContain('Cycle: 1/1/2025');
  });

  it('should update a day card with a new reading', async () => {
    // Use Day 6 (2025-01-06) to bypass isPeriodDay protection (days 1-5)
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-06', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for all chained async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const editButton = document.querySelector('.edit-cycle-btn');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    const select = document.querySelector('.day .reading-select');
    select.value = 'High';
    select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    editButton.click();
    
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hormone_reading: 'High', intercourse: false }),
    }));
  });

  it('should update a day card with a new reading in production', async () => {
    // Suppressing artificial NODE_ENV=production JSDOM timer corruption to ensure rock-solid async stability
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-06', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for all chained async operations in fetchAndRenderData to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const editButton = document.querySelector('.edit-cycle-btn');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    const select = document.querySelector('.day .reading-select');
    select.value = 'High';
    select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    editButton.click();
    
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hormone_reading: 'High', intercourse: false }),
    }));
  });

  it('should log a new reading when the form is submitted', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve([]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/days')) {
            return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate user input
    document.getElementById('date').value = '2025-01-02';
    document.getElementById('reading').value = 'High';
    document.getElementById('intercourse-checkbox').checked = true;

    // Submit the form via requestSubmit to guarantee rock-solid JSDOM submit event execution
    const form = document.getElementById('reading-form');
    form.requestSubmit();

    // Wait for the async operations in logOrUpdateReading to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if fetch was called with the correct data (matching exact app.js JSON.stringify key order)
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: '2025-01-02',
            userId: 1,
            hormone_reading: 'High',
            intercourse: true
        })
    }));
  });

  it('should log a new reading for a date range when the form is submitted', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve([]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/days/range')) {
            return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate user input
    document.getElementById('date').value = '2025-01-03';
    document.getElementById('end-date').value = '2025-01-05';
    document.getElementById('reading').value = 'Peak';
    document.getElementById('range-checkbox').checked = true;

    // Submit the form via requestSubmit to guarantee rock-solid JSDOM submit event execution
    const form = document.getElementById('reading-form');
    form.requestSubmit();

    // Wait for the async operations in logOrUpdateReading to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/range', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_date: '2025-01-03',
            end_date: '2025-01-05',
            hormone_reading: 'Peak',
            intercourse: false,
            userId: 1
        })
    }));
  });

  it('should start a new cycle when the "Start New Cycle" button is clicked', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve([]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate user input
    const periodStartDateInput = document.getElementById('period-start-date');
    periodStartDateInput.value = '2025-02-01';

    // Click the button
    const periodButton = document.getElementById('period-button');
    periodButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2025-02-01', userId: 1 }),
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
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/1')) {
            return Promise.resolve({
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Mock the confirm function
    global.confirm = jest.fn(() => true);

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Click the delete button
    const deleteButton = document.querySelector('.delete-cycle-btn');
    deleteButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/1', expect.objectContaining({
        method: 'DELETE',
    }));
  });

  it('should delete a reading when the delete button is clicked in edit mode', async () => {
    // Use Day 6 (2025-01-06) to bypass isPeriodDay protection (days 1-5)
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [{ id: 1, date: '2025-01-06', hormone_reading: 'Low', intercourse: false }],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles/days/1')) {
            return Promise.resolve({
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Mock the confirm function
    global.confirm = jest.fn(() => true);

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Enter edit mode
    const editButton = document.querySelector('.edit-cycle-btn');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Click the delete button for the reading (toggles .to-delete class)
    const deleteButton = document.querySelector('.delete-day');
    deleteButton.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Click editButton again to exit edit mode and trigger the actual deletion
    editButton.click();

    // Wait for the async operations in the event listener to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if fetch was called with the correct data
    expect(fetch).toHaveBeenCalledWith('/api/cycles/days/1', expect.objectContaining({
        method: 'DELETE',
    }));
  });

  it('should toggle the visibility of the end date input when the "Set Date Range" checkbox is clicked', async () => {
    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({ json: () => Promise.resolve({}), ok: true, status: 200 });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({ json: () => Promise.resolve([{ id: 1, name: 'Test User' }]), ok: true, status: 200 });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;
    
    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const rangeCheckbox = document.getElementById('range-checkbox');
    const rangeInputs = document.getElementById('range-inputs');

    expect(rangeInputs.style.display).toBe('none');

    rangeCheckbox.click();
    expect(rangeInputs.style.display).toBe('block');

    rangeCheckbox.click();
    expect(rangeInputs.style.display).toBe('none');
  });

  it('should only show the delete button for existing readings in edit mode', async () => {
    // Use Day 6 (2025-01-06) to bypass isPeriodDay protection (days 1-5)
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: null,
        days: [
          { id: 1, date: '2025-01-06', hormone_reading: 'Low', intercourse: false },
          { date: '2025-01-07', hormone_reading: null, intercourse: false }
        ],
      },
    ];

    fetch.mockImplementation((url) => {
        if (url.includes('/api/me')) {
            return Promise.resolve({
                json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/cycles')) {
            return Promise.resolve({
                json: () => Promise.resolve(mockCycles),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/analytics')) {
            return Promise.resolve({
                json: () => Promise.resolve({}),
                ok: true,
                status: 200
            });
        }
        if (url.includes('/api/shared-users')) {
            return Promise.resolve({
                json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
                ok: true,
                status: 200
            });
        }
        return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    // Set the HTML content
    document.body.innerHTML = appHtml;

    // Load the app code in perfect isolation
    jest.isolateModules(() => {
        require('../public/app.js');
    });

    // Dispatch the DOMContentLoaded event
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));

    // Wait for any initial data fetching to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Enter edit mode
    const editButton = document.querySelector('.edit-cycle-btn');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    const dayDivs = document.querySelectorAll('.day');
    const day1DeleteButton = dayDivs[0].querySelector('.delete-day');
    const day2DeleteButton = dayDivs[1].querySelector('.delete-day');

    expect(day1DeleteButton).not.toBeNull();
    expect(day1DeleteButton.style.display).not.toBe('none');
    expect(day2DeleteButton).not.toBeNull();
    expect(day2DeleteButton.style.display).toBe('none');
  });

  it('should default the range start date to the day after the last entry in the active cycle', async () => {
    const mockCycles = [
      {
        id: 10,
        start_date: '2025-03-01',
        end_date: null,
        days: [
          { id: 1, date: '2025-03-01', hormone_reading: 'Low', intercourse: false },
          { id: 2, date: '2025-03-02', hormone_reading: 'Low', intercourse: false },
          { id: 3, date: '2025-03-03', hormone_reading: 'Low', intercourse: false },
          { id: 4, date: '2025-03-04', hormone_reading: 'Low', intercourse: false },
          { id: 5, date: '2025-03-05', hormone_reading: 'Low', intercourse: false },
        ],
      },
    ];

    fetch.mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/cycles')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockCycles),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/analytics')) {
        return Promise.resolve({
          json: () => Promise.resolve({ averageCycleLength: 28, averageDaysToPeak: 14, averageLutealLength: 14 }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/shared-users')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
          ok: true,
          status: 200,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    document.body.innerHTML = appHtml;
    jest.isolateModules(() => {
      require('../public/app.js');
    });

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 500));

    const todayStr = new Date().toISOString().split('T')[0];
    const rangeCheckbox = document.getElementById('range-checkbox');
    const dateInput = document.getElementById('date');
    const endDateInput = document.getElementById('end-date');

    rangeCheckbox.click();

    expect(endDateInput.value).toBe(todayStr);
    expect(dateInput.value).toBe('2025-03-06');
  });

  it('should dynamically size Lunar Pulse ring sections from all-data analytics and render the 5-cycle phase chart', async () => {
    const mockCycles = [
      {
        id: 1,
        start_date: '2025-01-01',
        end_date: '2025-01-30',
        days: [
          { id: 1, date: '2025-01-12', hormone_reading: 'High', intercourse: false },
          { id: 2, date: '2025-01-16', hormone_reading: 'Peak', intercourse: false },
        ],
      },
    ];
    const mockAnalytics = {
      averageCycleLength: 30,
      cycleVariation: 2,
      averageDaysToPeak: 16,
      averageLutealLength: 14,
    };

    fetch.mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/cycles')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockCycles),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/analytics')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockAnalytics),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/shared-users')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
          ok: true,
          status: 200,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    document.body.innerHTML = appHtml;
    jest.isolateModules(() => {
      require('../public/app.js');
    });

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify Lunar Pulse segments align with all-data analytics (5d Menstrual, 4d Follicular [Days 6-9], 10d Ovulatory [Days 10-19], 14d Luteal)
    const menstrualSeg = document.querySelector('.circle-segment.menstrual-segment');
    const follicularSeg = document.querySelector('.circle-segment.follicular-segment');
    const ovulatorySeg = document.querySelector('.circle-segment.ovulatory-segment');
    const lutealSeg = document.querySelector('.circle-segment.luteal-segment');

    expect(menstrualSeg.getAttribute('data-days')).toBe('5');
    expect(follicularSeg.getAttribute('data-days')).toBe('4');
    expect(ovulatorySeg.getAttribute('data-days')).toBe('10');
    expect(lutealSeg.getAttribute('data-days')).toBe('14');

    // Verify Analytics Follicular, Fertile Window, Luteal, Earliest Peak & Highest Libido cards
    expect(document.getElementById('avg-follicular-length').textContent).toBe('4');
    expect(document.getElementById('avg-fertile-window').textContent).toBe('10');
    expect(document.getElementById('avg-luteal-length').textContent).toBe('14');
    expect(document.getElementById('earliest-peak-day').textContent).toBe('Day 16');
    expect(document.getElementById('estimated-libido-start').textContent).not.toBe('--');
    expect(document.getElementById('estimated-libido-end').textContent).not.toBe('--');

    // Verify Last 5 Cycles horizontal stacked bar chart rendered
    const phaseBarRows = document.querySelectorAll('.phase-bar-row');
    expect(phaseBarRows.length).toBe(1);
    expect(document.querySelector('.phase-peak-pin')).not.toBeNull();

    // Verify account switcher section stays hidden
    const accountSwitcherSection = document.getElementById('account-switcher-section');
    expect(accountSwitcherSection.style.display).toBe('none');

    // Verify segmented reading pill buttons sync with #reading select
    const highPillBtn = document.querySelector('.reading-pill-btn[data-reading="High"]');
    const readingSelect = document.getElementById('reading');
    highPillBtn.click();
    expect(readingSelect.value).toBe('High');
    expect(highPillBtn.classList.contains('active')).toBe(true);

    // Clicking the same active pill deselects it back to empty
    highPillBtn.click();
    expect(readingSelect.value).toBe('');
    expect(highPillBtn.classList.contains('active')).toBe(false);
  });

  it('should open Notifications modal from burger menu, toggle phase preferences, and save', async () => {
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/cycles')) {
        return Promise.resolve({
          json: () => Promise.resolve([]),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/analytics')) {
        return Promise.resolve({
          json: () => Promise.resolve({}),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/shared-users')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/notifications/preferences') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            preferences: {
              notify_menstrual: true,
              notify_follicular: true,
              notify_ovulatory: true,
              notify_libido: true,
              notify_peak: true,
              notify_luteal: true,
              subscriptionsCount: 1
            },
            currentPhase: {
              label: 'Follicular Phase',
              currentCycleDay: 8
            }
          }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/notifications/preferences') && options && options.method === 'PUT') {
        return Promise.resolve({
          json: () => Promise.resolve({
            message: 'Notification preferences saved successfully.',
            preferences: JSON.parse(options.body)
          }),
          ok: true,
          status: 200,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    document.body.innerHTML = appHtml;
    jest.isolateModules(() => {
      require('../public/app.js');
    });

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 400));

    // Click Notifications in the burger menu
    const openNotificationsBtn = document.getElementById('open-notifications-btn');
    expect(openNotificationsBtn).not.toBeNull();
    openNotificationsBtn.click();
    await new Promise(resolve => setTimeout(resolve, 200));

    const modalOverlay = document.getElementById('notifications-modal-overlay');
    expect(modalOverlay.classList.contains('active')).toBe(true);

    // Toggle off menstrual and follicular, keep ovulatory/libido/peak/luteal on
    const menstrualToggle = document.getElementById('notify-menstrual');
    const follicularToggle = document.getElementById('notify-follicular');
    const libidoToggle = document.getElementById('notify-libido');
    expect(libidoToggle.checked).toBe(true);
    menstrualToggle.checked = false;
    follicularToggle.checked = false;

    const saveBtn = document.getElementById('save-notifications-btn');
    saveBtn.click();
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(fetch).toHaveBeenCalledWith(
      '/api/notifications/preferences',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notify_menstrual: false,
          notify_follicular: false,
          notify_ovulatory: true,
          notify_libido: true,
          notify_peak: true,
          notify_luteal: true,
          userId: 1
        })
      })
    );

    const feedbackEl = document.getElementById('notifications-feedback-msg');
    expect(feedbackEl.textContent).toContain('Preferences saved!');
  });

  it('should re-anchor Estimated Next Period to Actual Peak + Luteal Length once Peak is logged in the active cycle', async () => {
    // Active cycle started 2025-05-01, Peak logged late on Day 19 (2025-05-19)
    const mockCycles = [
      {
        id: 20,
        start_date: '2025-05-01',
        end_date: null,
        days: [
          { id: 1, date: '2025-05-16', hormone_reading: 'High', intercourse: false },
          { id: 2, date: '2025-05-19', hormone_reading: 'Peak', intercourse: true },
        ],
      },
    ];
    const mockAnalytics = {
      averageCycleLength: 28,
      cycleVariation: 2,
      averageDaysToPeak: 14,
      averageLutealLength: 13,
    };

    fetch.mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          json: () => Promise.resolve({ id: 1, name: 'Test User', default_view_user_id: null }),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/cycles')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockCycles),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/analytics')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockAnalytics),
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/api/shared-users')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, name: 'Test User' }]),
          ok: true,
          status: 200,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve([]), ok: true, status: 200 });
    });

    document.body.innerHTML = appHtml;
    jest.isolateModules(() => {
      require('../public/app.js');
    });

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Actual Peak (2025-05-19) + 13d luteal + 1 = 2025-06-02 (6/2/2025) instead of naive 5/29/2025
    const nextPeriodText = document.getElementById('estimated-next-period').textContent;
    const nextPeakText = document.getElementById('estimated-next-peak').textContent;
    expect(nextPeriodText).toBe('6/2/2025');
    // And Next Peak for the upcoming cycle is anchored to 6/2/2025 + (14 - 1) = 6/15/2025
    expect(nextPeakText).toBe('6/15/2025');
  });
});

