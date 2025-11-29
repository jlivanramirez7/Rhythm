# Rhythm: A Web-Based Ovulation Cycle Tracker

Rhythm is a secure, private web application designed to help users track their ovulation cycle. It provides a clear, day-by-day visualization of hormonal readings, stores historical data in a secure cloud database, and offers predictive analytics to help users understand their personal patterns.

![Rhythm Application Screenshot](public/logo.png)

## 1. Core Features

-   **Secure Authentication:** User login is handled via Google OAuth 2.0 and restricted to an explicit allow-list of authorized email addresses, ensuring complete privacy.
-   **Daily Reading Input:** Log daily hormonal readings (`Low`, `High`, `Peak`) and intercourse.
-   **Bulk Data Entry:** Use the date-range feature to log the same reading over multiple days.
-   **Cycle Management:** Mark the first day of a new period to automatically conclude the previous cycle and start a new one.
-   **Interactive Cycle Visualization:** Each cycle is rendered as a card with a grid of day-by-day readings. The estimated fertile window is highlighted for quick reference.
-   **Data Management:** Edit or delete individual readings, delete entire cycles, or clear all of your data through an intuitive UI.
-   **Predictive Analytics:** The application calculates and displays:
    -   Average cycle length.
    -   Average number of days to peak fertility.
    -   Average fertile window length.
    -   Estimated start date of the next period.
    -   Estimated start and end dates of the next fertile window.

## 2. Technology Stack

-   **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
-   **Backend:** Node.js with the Express.js framework.
-   **Database:** Cloud SQL for PostgreSQL for production, with support for local PostgreSQL or SQLite for development.
-   **Authentication:** Passport.js with the `passport-google-oauth20` strategy.
-   **Deployment:** Fully automated via Google Cloud Build and deployed to Google Cloud Run.
-   **Secrets Management:** All sensitive configuration is managed by Google Cloud Secret Manager.
-   **Date Handling:** `moment-timezone` is used for all server-side date and time manipulation to ensure timezone consistency. **This is a critical dependency.**

---

## 3. Getting Started

### Prerequisites

-   Node.js (v18 or later)
-   `gcloud` CLI (Google Cloud SDK)
-   Access to a Google Cloud Platform (GCP) project.

### Local Development Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/Rhythm.git
    cd Rhythm
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Fill in the values for your local database and Google OAuth credentials. See the **Configuration** section below for details.

4.  **Run the Application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:8080`.

---

## 4. Configuration

The application uses environment variables for configuration, which are loaded from a `.env` file in development and from Google Cloud Secret Manager in production.

| Variable                 | Description                                                                                             | Example                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------|
| `DB_ADAPTER`             | The database adapter to use (`postgres` or `sqlite`).                                                   | `postgres`                              |
| `DB_HOST`                | (Local Dev) The hostname of your local database server.                                                 | `localhost`                             |
| `DB_PORT`                | (Local Dev) The port your database is running on.                                                       | `5432`                                  |
| `DB_USER`                | The username for the database.                                                                          | `myuser`                                |
| `DB_PASSWORD`            | The password for the database user.                                                                     | `mypassword`                            |
| `DB_NAME`                | The name of the database.                                                                               | `rhythm_db`                             |
| `GOOGLE_CLIENT_ID`       | Your Google OAuth 2.0 Client ID.                                                                        | `your-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`   | Your Google OAuth 2.0 Client Secret.                                                                    | `your-client-secret`                    |
| `SESSION_SECRET`         | A secret key for signing the session ID cookie.                                                         | `a-long-random-string`                  |
| `AUTHORIZED_USERS`       | A comma-separated list of Google email addresses authorized to use the application.                     | `user1@example.com,user2@example.com`   |
| `INSTANCE_CONNECTION_NAME` | (Production Only) The Cloud SQL instance connection name.                                             | `my-project:us-central1:my-instance`    |

---

## 5. Deployment

Deployment is fully automated using Google Cloud Build and Cloud Run. The process is defined in `cloudbuild.yaml`.

### Triggering a Deployment

Pushing to the `main` branch will automatically trigger a new build and deployment on Google Cloud.

### Key Deployment Steps

1.  **Enable APIs:** The build process ensures the Secret Manager and SQL Admin APIs are enabled.
2.  **Build Image:** A Docker container image is built using the project's `Dockerfile`.
3.  **Push Image:** The image is pushed to Google Container Registry (GCR).
4.  **Deploy to Cloud Run:** A new revision is deployed to Cloud Run with the following critical configurations:
    -   Connection to the Cloud SQL instance.
    -   Secure injection of all required secrets from Secret Manager.
    -   `NODE_ENV` set to `production`.

### Required IAM Permissions

The service account used by Cloud Build must have the following IAM roles for the deployment to succeed:
-   **Cloud Build Service Account**
-   **Cloud Run Admin**
-   **Cloud SQL Client**
-   **Secret Manager Secret Accessor**
-   **Service Account User**

---

## 6. Common Debugging Issues

If you encounter unexpected behavior, check these common issues first.

### 1. Build Fails with `Cannot find module 'moment-timezone'`

-   **Symptom**: The application fails to build on Cloud Run, and the logs show `Error: Cannot find module 'moment-timezone'`.
-   **Cause**: The `moment-timezone` library is a critical dependency for server-side date handling. It has been used in the code but is missing from `package.json`.
-   **Fix**: Run `npm install moment-timezone`, then commit and push the updated `package.json` and `package-lock.json` files.

### 2. Data Not Saving After Form Submission

-   **Symptom**: A user adds a new reading, the UI gives no error, but the data does not appear. The reading seems to have vanished.
-   **Cause**: This almost always indicates that a database query is not correctly scoped to the logged-in user. An `UPDATE` or `SELECT` query is missing a `WHERE c.user_id = ?` clause, causing it to fail silently.
-   **Fix**: Inspect the API endpoint responsible for the update (e.g., `POST /api/cycles/days`). Ensure that any query modifying or fetching a specific record is correctly filtered by the `req.user.id`.

### 3. Invalid Date Range Fails Silently

-   **Symptom**: When submitting a date range where the start date is after the end date, the UI does nothing and no error is shown.
-   **Cause**: The backend API endpoint (`POST /api/cycles/days/range`) does not validate that the `start_date` is before the `end_date`. The loop to process the days never runs, and the server returns a success status.
-   **Fix**: Add validation at the beginning of the endpoint to check if `startDate > endDate` and return a `400 Bad Request` if the condition is true.

---

## 7. API Endpoints

All API endpoints are prefixed with `/api` and require authentication.

| Method   | Endpoint                  | Description                               |
|----------|---------------------------|-------------------------------------------|
| `POST`   | `/cycles`                 | Creates a new cycle.                      |
| `GET`    | `/cycles`                 | Retrieves all cycles for the user.        |
| `DELETE` | `/cycles/:id`             | Deletes a specific cycle.                 |
| `POST`   | `/cycles/days`            | Adds or updates a single day's reading.   |
| `POST`   | `/cycles/days/range`      | Adds or updates readings for a date range.|
| `PUT`    | `/cycles/days/:id`        | Updates a specific daily reading.         |
| `DELETE` | `/cycles/days/:id`        | Deletes a specific daily reading.         |
| `GET`    | `/analytics`              | Retrieves calculated analytics.           |
| `DELETE` | `/data`                   | Clears all data for the user.             |
