/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load the HTML file
const welcomeHtml = fs.readFileSync(path.resolve(__dirname, '../public/welcome.html'), 'utf8');
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

  it('should render the welcome page', () => {
    document.body.innerHTML = welcomeHtml;
    const title = document.querySelector('h1');
    expect(title.textContent).toBe('Rhythm');
    const loginButton = document.querySelector('a.button');
    expect(loginButton.textContent).toBe('Login with Google');
  });

  it('should fetch and render cycles on app page load when authenticated', async () => {
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

    // Manually trigger the function that runs on DOMContentLoaded
    const app = require('../public/app.js');
    document.body.innerHTML = appHtml;
    app.init();
    await app.fetchAndRenderData();

    // Wait for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 0));

    const cycleElements = document.querySelectorAll('.cycle');
    expect(cycleElements.length).toBe(1);
    expect(cycleElements[0].querySelector('.cycle-header').textContent).toContain('Cycle 1');
  });

  it('should toggle the menu when the menu button is clicked', () => {
    document.body.innerHTML = appHtml;
    const app = require('../public/app.js');
    app.init();

    const menuButton = document.querySelector('.menu-button');
    const menuContent = document.querySelector('.menu-content');

    expect(menuContent.style.display).toBe('');
    menuButton.click();
    expect(menuContent.style.display).toBe('block');
    menuButton.click();
    expect(menuContent.style.display).toBe('none');
  });
});
