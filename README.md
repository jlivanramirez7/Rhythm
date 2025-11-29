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
*   **Date Handling:** `moment-timezone` is used for all server-side date and time manipulation to ensure timezone consistency and prevent common off-by-one errors. **This is a critical dependency.**
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

## 6. Database Configuration

The application is configured to work with two database setups: a local PostgreSQL instance for development and a managed Cloud SQL for PostgreSQL instance for production.

### Local Development

For local development, the application connects to a standard PostgreSQL database using the credentials defined in your `.env` file. Ensure the following variables are set correctly:

-   `DB_HOST`: The hostname of your local database server (e.g., `localhost`).
-   `DB_PORT`: The port your database is running on (e.g., `5432`).
-   `DB_USER`: Your PostgreSQL username.
-   `DB_PASSWORD`: Your PostgreSQL password.
-   `DB_NAME`: The name of the database to use.
-   `DB_ADAPTER`: Should be set to `postgres`.

### Production (Cloud Run & Cloud SQL)

In the production environment (`NODE_ENV=production`), the application connects to Cloud SQL via a **Unix socket** for a secure and low-latency connection.

The connection logic in `src/database.js` is hardcoded to use the following socket path:

```javascript
host: '/cloudsql/rhythm-479516:us-central1:rhythm-db'
```

For this to work, the following conditions must be met:

1.  **Cloud SQL Instance**: Your Cloud Run service must be connected to the Cloud SQL instance (`rhythm-479516:us-central1:rhythm-db`). This is configured during deployment.
2.  **Service Account Permissions**: The service account running the Cloud Run instance (and Cloud Build) must have the **"Cloud SQL Client"** IAM role.
3.  **Secrets**: The following secrets must be available in Google Cloud Secret Manager:
    -   `DB_USER`: The username for the Cloud SQL database.
    -   `DB_PASSWORD`: The password for the Cloud SQL user.
    -   `DB_NAME`: The name of the database in your Cloud SQL instance.

**Note:** In production, the `DB_HOST` and `DB_PORT` secrets are ignored in favor of the hardcoded socket path.

## 7. Seeding the Database

The project includes a script to populate the database with 10 cycles of realistic dummy data.

To run the seed script for your local database:
```bash
npm run seed:cloud
```

## 8. Database Schema

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

## 9. API Endpoints

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
