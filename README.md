# Rhythm: Ovulation Cycle Tracker

## 1. Introduction

Rhythm is a web application designed to help users track their ovulation cycle by manually inputting hormonal readings from an external device. The application provides a clear visualization of the user's cycle, stores historical data, and offers basic analytics to help users understand their patterns.

## 2. Features

*   **Google Authentication:** Secure login using Google OAuth 2.0, restricted to a list of authorized users.
*   **Hormonal Reading and Intercourse Input:** Users can input daily hormonal readings ("Low", "High", or "Peak") and log intercourse independently.
*   **Bulk Data Entry:** Users can log a reading for a continuous date range, simplifying data entry.
*   **Period Tracking:** Users can mark the first day of their period to signify the start of a new cycle.
*   **Cycle Visualization:** Each cycle is displayed day-by-day, showing the cycle day number, the date in `MM/DD` format, the hormonal reading, and a heart icon for intercourse.
*   **Fertile Window Highlighting:** The estimated fertile window for each cycle is highlighted in light red.
*   **Data Storage:** All cycle data is persistently stored in a Cloud SQL for PostgreSQL database.
*   **Data Management:** Users can edit or delete individual readings, delete entire cycles, or clear all application data via an intuitive UI.
*   **Advanced Analytics:** The application calculates and displays:
    *   Average cycle length.
    *   Average number of days to the "Peak" hormonal reading.
    *   Average length of the fertile window.
    *   Estimated start date of the next period.
    *   Estimated start and end dates of the next fertile window.

## 3. Technology Stack

*   **Frontend:** HTML, CSS, and vanilla JavaScript, with a Material Design-inspired aesthetic.
*   **Backend:** Node.js with the Express.js framework.
*   **Database:** Cloud SQL for PostgreSQL.
*   **Authentication:** Passport.js with the Google OAuth 2.0 strategy.
*   **Deployment:** Google Cloud Run with automated builds and deployments via Cloud Build.
*   **Secrets Management:** Google Cloud Secret Manager.
*   **Testing:** Jest, Supertest for API endpoint testing, and Jest with jsdom for UI testing.
*   **Data Seeding:** `chance.js` for generating realistic dummy data.

## 4. Testing

The project includes a comprehensive test suite covering the API, UI, and application configuration.

To run all tests, use the following command:

```bash
npm test
```

## 5. Setup and Running the Application

### Local Development

1.  **Create a `.env` file:** Copy the `.env.example` file to a new file named `.env` and fill in the required values for your local PostgreSQL database and Google OAuth credentials.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run the Application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

### Cloud Deployment

The application is configured for automated deployment to Google Cloud Run using Cloud Build. The `cloudbuild.yaml` file defines the build, test, and deployment steps.

**Note:** The Cloud Build service account must have the **Cloud SQL Client** role to connect to the database.

## 6. Seeding the Database

The project includes a script to populate the database with 10 cycles of realistic dummy data.

To run the seed script for your local database:
```bash
npm run seed:cloud
```

## 7. Database Schema

The database consists of two main tables:

### `cycles`

| Column      | Type      | Description                                  |
|-------------|-----------|----------------------------------------------|
| `id`        | SERIAL   | Primary Key                                  |
| `start_date`| DATE      | The start date of the cycle (first day of period). |
| `end_date`  | DATE      | The end date of the cycle (day before next period). |

### `cycle_days`

| Column          | Type    | Description                                                     |
|-----------------|---------|-----------------------------------------------------------------|
| `id`            | SERIAL | Primary Key                                                     |
| `cycle_id`      | INTEGER | Foreign Key referencing the `cycles` table.                     |
| `date`          | DATE    | The specific date of the reading.                               |
| `hormone_reading`| TEXT    | The hormonal reading for the day ('Low', 'High', 'Peak').      |
| `intercourse`   | BOOLEAN | A boolean indicating if intercourse occurred.          |

## 8. API Endpoints

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
