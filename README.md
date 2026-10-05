# CustomerServicePortal

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Frontend

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Backend setup

Copy `backend/.env.example` to `backend/.env` and replace the Atlas URI placeholders with the connection string from your cluster. URL-encode any special characters in the database user's password, and allow the backend host's outbound IP in Atlas Network Access. Also set `ADMIN_USERNAME`, `ADMIN_PASSWORD` (minimum 8 characters; 12+ recommended), and a random `AUTH_SECRET` (minimum 24 characters; 32+ recommended). Keep `backend/.env` private; it is ignored by Git.

Run the API from the `backend` directory:

```powershell
npm install
npm run dev
```

The frontend uses the Azure App Service API origin configured in `src/app/core/api-base.ts`. During `ng serve`, `proxy.conf.json` remains available for local `/api` development. In production, set the backend `FRONTEND_ORIGIN` environment variable to the deployed Static Web App origin (or a comma-separated list of allowed origins). Because the production frontend and API are hosted on different Azure domains, production session cookies use `SameSite=None; Secure` and CORS is restricted to the configured frontend origins.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
