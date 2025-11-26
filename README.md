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
*   **Database:** SQLite for local development, Cloud SQL for PostgreSQL in production.
*   **Development:**
    *   **Testing:** Jest, Supertest for API endpoint testing, and Jest with jsdom for UI testing.
    *   **Data Seeding:** `chance.js` for generating realistic dummy data.
*   **Secret Management:** Google Secret Manager

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

The project includes a script to populate the local SQLite database with 10 cycles of realistic dummy data, which is useful for development and testing.

To run the seed script:
```bash
node database/seed.js
```
**Note:** This will clear all existing data in the database before adding the new dummy data.

A separate script is provided to seed the Cloud SQL database. See the "Deployment to Google Cloud" section for more details.

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
│   ├── seed.js
│   └── seed-cloud.js
├── public/
│   ├── welcome.html
│   ├── app.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── server.js
│   ├── database.js
│   └── api.js
├── __tests__/
│   ├── api.test.js
│   ├── intercourse.test.js
│   └── ui.test.js
├── package.json
└── README.md
```

## 9. Deployment to Google Cloud

This section outlines the steps to deploy the application to Google Cloud Run and migrate the database to Cloud SQL.

### a. Create Secrets in Secret Manager

Create the following secrets in Google Secret Manager:

*   `GOOGLE_CLIENT_ID`
*   `GOOGLE_CLIENT_SECRET`
*   `SESSION_SECRET`
*   `AUTHORIZED_USERS`
*   `DB_USER`
*   `DB_PASSWORD`
*   `DB_DATABASE`
*   `DB_PORT`
*   `DB_HOST`

### b. Create a Cloud SQL Instance

A new Cloud SQL for PostgreSQL instance will be created in your Google Cloud project.

**1. Create the Cloud SQL Instance:**

```bash
gcloud sql instances create rhythm-db --database-version=POSTGRES_13 --region=us-central1 --cpu=1 --memory=4GB
```

**2. Create a Database:**

```bash
gcloud sql databases create rhythm --instance=rhythm-db
```

**3. Create a User:**

```bash
gcloud sql users create rhythm-user --instance=rhythm-db --password="password"
```

**4. Get the Connection Name:**

```bash
gcloud sql instances describe rhythm-db --format="value(connectionName)"
```

**5. Enable the Cloud SQL Admin API:**

```bash
gcloud services enable sqladmin.googleapis.com
```

### c. Seed the Cloud SQL Database

To seed the Cloud SQL database, you will need to have the Cloud SQL Auth Proxy running.

**1. Download and Install the Cloud SQL Auth Proxy:**

Follow the instructions for your operating system here: https://cloud.google.com/sql/docs/postgres/sql-proxy

**2. Start the Proxy:**

Open a new terminal and run the following command, replacing `YOUR_CONNECTION_NAME` with the connection name you retrieved earlier:

```bash
./cloud-sql-proxy --address 0.0.0.0 YOUR_CONNECTION_NAME
```

**3. Run the seed script:**

```bash
node database/seed-cloud.js
```

### d. Set up Continuous Deployment

To automatically deploy the application when you push changes to your GitHub repository, you will need to create a Cloud Build trigger.

**1. Go to the Cloud Build Triggers page in the Google Cloud Console.**

**2. Click "Create trigger".**

**3. Select "GitHub" as the source.**

**4. Authenticate with your GitHub account and select the `rhythm` repository.**

**5. Configure the trigger settings:**
    *   **Name:** `rhythm-deploy`
    *   **Event:** Push to a branch
    *   **Branch:** `main`
    *   **Configuration:** `cloudbuild.yaml`

**6. Click "Create".**

Now, whenever you push a change to the `main` branch, Cloud Build will automatically build and deploy the new version of your application to Cloud Run.

## 10. User Authentication

Access to the application is restricted using Google OAuth 2.0. Only authorized users can log in and access the application's features.

When a user first visits the application, they are presented with a welcome page with a "Login with Google" button. After a successful login, they are redirected to the main application page.

<!-- This is another comment to trigger a new build -->
