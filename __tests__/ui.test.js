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
});
