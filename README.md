# Rhythm: Ovulation Cycle Tracker

## 1. Introduction

Rhythm is a web application designed to help users track their ovulation cycle by manually inputting hormonal readings from an external device. The application provides a clear visualization of the user's cycle, stores historical data, and offers basic analytics to help users understand their patterns.

## 2. Features

*   **Hormonal Reading and Intercourse Input:** Users can input daily hormonal readings ("Low", "High", or "Peak") and log intercourse independently.
*   **Bulk Data Entry:** Users can log a reading for a continuous date range, simplifying data entry.
*   **Period Tracking:** Users can mark the first day of their period to signify the start of a new cycle.
*   **Cycle Visualization:** Each cycle is displayed day-by-day, showing the cycle day number, the date in `DD/MM` format, the hormonal reading, and a heart icon for intercourse.
*   **Fertile Window Highlighting:** The estimated fertile window for each cycle is highlighted in light red.
*   **Data Storage:** All cycle data is persistently stored in a local SQLite database.
*   **Data Management:** Users can edit or delete individual readings, delete entire cycles, or clear all application data via an intuitive UI with a burger menu for each cycle.
*   **Advanced Analytics:** The application calculates and displays:
    *   Average cycle length.
    *   Average number of days to the "Peak" hormonal reading.
    *   Average length of the fertile window.
    *   Estimated start date of the next period.
    *   Estimated start and end dates of the next fertile window.

## 3. Technology Stack

*   **Frontend:** HTML, CSS, and vanilla JavaScript.
*   **Backend:** Node.js with the Express.js framework.
*   **Database:** SQLite
*   **Development:**
    *   **Testing:** Jest, Supertest for API endpoint testing, and Jest with jsdom for UI testing.
    *   **Data Seeding:** `chance.js` for generating realistic dummy data.

## 4. Testing

The project includes a comprehensive test suite covering both the API and the UI.

### API Tests

The API tests are located in `__tests__/api.test.js` and `__tests__/intercourse.test.js`. They use Jest and Supertest to make requests to the API endpoints and assert that the responses are correct. The database is mocked with an in-memory version of SQLite to ensure tests are isolated and repeatable.

### UI Tests

The UI tests are located in `__tests__/ui.test.js`. They use Jest and jsdom to simulate a browser environment and test the frontend code. The tests load the `index.html` file, mock the `fetch` API, and then simulate user interactions to assert that the DOM is updated correctly.

To run all tests, use the following command:

```bash
npm test
```

## 5. Setup and Running the Application

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Run the Application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

## 5. Seeding the Database

The project includes a script to populate the database with 10 cycles of realistic dummy data, which is useful for development and testing.

To run the seed script:
```bash
node database/seed.js
```
**Note:** This will clear all existing data in the database before adding the new dummy data.

## 6. Database Schema

The database consists of two main tables:

### `cycles`

| Column      | Type      | Description                                  |
|-------------|-----------|----------------------------------------------|
| `id`        | INTEGER   | Primary Key                                  |
| `start_date`| TEXT      | The start date of the cycle (first day of period). |
| `end_date`  | TEXT      | The end date of the cycle (day before next period). |

### `cycle_days`

| Column          | Type    | Description                                                     |
|-----------------|---------|-----------------------------------------------------------------|
| `id`            | INTEGER | Primary Key                                                     |
| `cycle_id`      | INTEGER | Foreign Key referencing the `cycles` table.                     |
| `date`          | TEXT    | The specific date of the reading.                               |
| `hormone_reading`| TEXT    | The hormonal reading for the day ('Low', 'High', 'Peak').      |
| `intercourse`   | INTEGER | A boolean (0 or 1) indicating if intercourse occurred.          |

## 7. API Endpoints

The backend exposes the following API endpoints, which are consumed by the frontend client:

*   `POST /api/cycles`: Creates a new cycle.
*   `GET /api/cycles`: Retrieves all cycles and their associated daily readings.
*   `DELETE /api/cycles/:id`: Deletes a specific cycle and all its readings.
*   `POST /api/cycles/days`: Adds or updates a single day's reading.
*   `POST /api/cycles/days/range`: Adds or updates readings for a continuous range of dates.
*   `PUT /api/cycles/days/:id`: Updates a specific daily reading.
*   `DELETE /api/cycles/days/:id`: Deletes a specific daily reading.
*   `GET /api/analytics`: Retrieves the calculated analytics.
*   `DELETE /api/data`: Clears all cycle and reading data from the database.

## 8. Project Structure

```
/
├── database/
│   ├── rhythm.db
│   └── seed.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── server.js
│   ├── database.js
│   └── api.js
├── __tests__/
│   ├── api.test.js
│   └── intercourse.test.js
├── package.json
└── README.md
