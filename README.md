# Rhythm: A Web-Based Ovulation Cycle Tracker

Rhythm is a secure, private web application designed to help users track their ovulation cycle. It provides a clear, day-by-day visualization of hormonal readings, stores historical data in a secure cloud database, and offers predictive analytics to help users understand their personal patterns.

![Rhythm Application Screenshot](public/logo.png)

## 1. Core Features

-   **User Registration and Approval:** New users can register with their name and email. An administrator must approve all new registrations before the user can log in, ensuring a secure and private user base.
-   **Secure Authentication:** User login is handled via Google OAuth 2.0.
-   **Data Sharing:** Users can securely share their cycle data with a designated partner.
-   **Account Switching:** Users with access to shared data can easily switch between viewing their own data and their partner's data via a simple dropdown menu.
-   **Admin Dashboard:** Administrators have access to a dashboard to view all users, approve pending registrations, and manage user access.
-   **Daily Reading Input:** Log daily hormonal readings (`Low`, `High`, `Peak`) and intercourse.
-   **Cycle Management:** Mark the first day of a new period to automatically conclude the previous cycle and start a new one.
-   **Interactive Cycle Visualization:** Each cycle is rendered as a card with a grid of day-by-day readings.
-   **Data Management:** Edit or delete individual readings, delete entire cycles, or clear all of your data.
-   **Predictive Analytics:** The application calculates and displays key metrics like average cycle length, average days to peak fertility, and estimated future cycle dates.

## 2. Technology Stack

-   **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
-   **Backend:** Node.js with the Express.js framework.
-   **Database:** Cloud SQL for PostgreSQL for production, with support for local SQLite for development.
-   **Authentication:** Passport.js with the `passport-google-oauth20` strategy.
-   **Deployment:** Fully automated via Google Cloud Build and deployed to Google Cloud Run.
-   **Secrets Management:** All sensitive configuration is managed by Google Cloud Secret Manager.
-   **Date Handling:** `moment-timezone` is used for all server-side date and time manipulation. **This is a critical dependency.**

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
    -   Fill in the values for your local database and Google OAuth credentials.

4.  **Run the Application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:8080`.

---

## 4. Deployment

Deployment is fully automated using Google Cloud Build and Cloud Run. Pushing to the `main` branch will automatically trigger a new build and deployment.

### Required IAM Permissions

The service account used by Cloud Build must have the following IAM roles:
-   **Cloud Build Service Account**
-   **Cloud Run Admin**
-   **Cloud SQL Client**
-   **Secret Manager Secret Accessor**
-   **Service Account User**

---

## 5. Common Debugging Issues

### 1. Build Fails with `Cannot find module`

-   **Symptom**: The application fails to build, with an error like `Error: Cannot find module 'module-name'`.
-   **Cause**: A dependency is used in the code but is not listed in `package.json`.
-   **Fix**: Run `npm install module-name` and commit the updated `package.json` and `package-lock.json` files.

### 2. Build Fails with `pg_hba.conf rejects connection`

-   **Symptom**: The Cloud Run build fails with an error `pg_hba.conf rejects connection for host ...`.
-   **Cause**: The application is trying to connect to Cloud SQL over a public IP.
-   **Fix**: Ensure the `host` configuration in `src/database.js` is **hardcoded** to the Cloud SQL socket path for the production environment:
    ```javascript
    host: process.env.NODE_ENV === 'production' ? '/cloudsql/your-instance-connection-name' : secrets.DB_HOST,
    ```

### 3. Database Schema Errors (e.g., `column "approved" does not exist`)

-   **Symptom**: The application crashes with an error indicating a missing database column.
-   **Cause**: The application code was updated to use a new column, but the `ALTER TABLE` command was not run on the existing production database.
-   **Fix**: Connect to the production database via `gcloud sql connect` and manually run the `ALTER TABLE` command to add the missing column (e.g., `ALTER TABLE users ADD COLUMN approved BOOLEAN DEFAULT false;`).

---

## 6. API Endpoints

All endpoints are prefixed with `/api`.

### Public API

| Method   | Endpoint     | Description                               |
|----------|--------------|-------------------------------------------|
| `POST`   | `/register`  | Submits a new user registration request.  |

### Authenticated API

| Method   | Endpoint                  | Description                               |
|----------|---------------------------|-------------------------------------------|
| `GET`    | `/me`                     | Fetches the current user's profile.       |
| `GET`    | `/shared-users`           | Fetches users whose data you can view.    |
| `POST`   | `/partner`                | Links your account to a partner.          |
| `GET`    | `/cycles`                 | Retrieves cycles for a user.              |
| `POST`   | `/cycles`                 | Creates a new cycle.                      |
| `DELETE` | `/cycles/:id`             | Deletes a specific cycle.                 |
| `POST`   | `/cycles/days`            | Adds or updates a single day's reading.   |
| `POST`   | `/cycles/days/range`      | Adds or updates readings for a date range.|
| `PUT`    | `/cycles/days/:id`        | Updates a specific daily reading.         |
| `DELETE` | `/cycles/days/:id`        | Deletes a specific daily reading.         |
| `GET`    | `/analytics`              | Retrieves calculated analytics.           |
| `DELETE` | `/data`                   | Clears all data for the user.             |

### Admin API

| Method   | Endpoint                  | Description                               |
|----------|---------------------------|-------------------------------------------|
| `GET`    | `/admin/users`            | Fetches all users.                        |
| `POST`   | `/admin/users/approve/:id`| Approves a pending user registration.     |
| `DELETE` | `/admin/users/reject/:id` | Rejects and deletes a user registration.|
