This codebase represents a web application named Flexile, designed for managing and paying contractors, particularly focused on remote teams and equity compensation. It's built using Ruby on Rails for the backend API, PostgreSQL for the database, and React/Next.js for the frontend, leveraging tRPC to talk to the back-end. Playwright is employed for end-to-end testing.

Here's a breakdown of the architecture and key components:

**Backend (Ruby on Rails):**

- **Models (`app/models`):** Define the data structure and business logic. Key models include `User`, `Company`, `CompanyWorker` (formerly `CompanyContractor`), `Invoice`, `Payment`, `EquityGrant`, and various related models for managing equity, dividends, bank accounts, and legal documents. Concerns (`app/models/concerns`) provide reusable modules for features like searchability, soft deletion, and external ID generation. Note: some models like `Contract` and `TaxDocument` are marked as legacy and are being replaced by the `Document` model.
- **Controllers (`app/controllers`):** Handle API requests and responses. They are organized into several namespaces, including `admin` for administrative tasks, `api` for external API endpoints, `internal` for API requests from the frontend application, and `webhooks` for handling incoming webhooks from external services like Stripe, QuickBooks, and Wise.
- **Policies (`app/policies`):** Implement authorization logic using Pundit, determining which users can perform specific actions on resources.
- **Presenters (`app/presenters`):** Prepare data for rendering in views or API responses, encapsulating presentation logic.
- **Serializers (`app/serializers`):** Format data for specific API outputs, such as JSON or XML responses for integrations with QuickBooks.
- **Services (`app/services`):** Encapsulate complex business logic and operations, like invoice payment processing, equity grant creation, and integration with external APIs.
- **Sidekiq Workers (`app/sidekiq`):** Handle asynchronous tasks, scheduled jobs, and background processes using Sidekiq.
- **Validators (`app/validators`):** Define custom validation rules for model attributes.
- **Views (`app/views`):** ERB templates for rendering HTML, primarily for email templates and some server-side rendered components. The main application view renders a single container element that is hydrated by the frontend application.
- **Database Migrations (`db/migrate`):** Define database schema changes and data migrations.
- **Seeds (`db/seeds.rb`):** Provides initial seed data for the database. Includes a `SeedDataGeneratorFromTemplate` service for generating more complex test data.

**Frontend (React, Next.js):**

- **Pages (`frontend/app/pages`):** Define the different routes and views of the application, now largely migrated to the `/frontend/app` folder structure for a Next.js app router.
- **Components (`frontend/components`):** Reusable UI components.
- **Database Client (`frontend/db`):** Uses Drizzle ORM to interact with the PostgreSQL database. Includes a schema definition (`frontend/db/schema.ts`) and utility functions.
- **Models (Typescript) (`frontend/models`):** Define TypeScript types for data objects, mirroring some of the backend models.
- **Utilities (`frontend/utils`):** Helper functions for formatting, assertions, OAuth, and other common tasks.
- **tRPC (`frontend/trpc`):** Provides a type-safe API layer between the frontend and backend using tRPC. Routes are defined in `frontend/trpc/routes`. Uses SuperJSON for serialization.

**Integrations:**

- **Stripe:** Handles payment processing.
- **QuickBooks:** Integrates with QuickBooks for accounting.
- **Wise:** Used for international money transfers.
- **Clerk:** Handles user authentication (in progress).

**Testing:**

- **Playwright (`e2e`):** Used for end-to-end testing.
- **RSpec (`spec`):** Older unit and system tests (being migrated to Playwright).

**Other Key Components:**

- **Inngest:** Used for serverless functions and background jobs.
- **Redis:** Used for caching, background jobs, and Action Cable.
- **Memcached:** Potentially used for caching in production (if configured).
- **Flipper:** Feature flag management.

**Key Architectural Concepts:**

- **Separation of Concerns:** The application follows a clear separation of concerns between models, controllers, services, and views, promoting maintainability and testability.
- **API-Driven:** The frontend interacts with the backend primarily through API requests, facilitating development and deployment flexibility.
- **Server-Side Rendering (SSR):** Next.js provides SSR for improved performance and SEO.
- **Type Safety:** TypeScript on the frontend and strict typing in the backend help prevent errors and improve code quality.

This overview should help you navigate the codebase, understand its architecture, and contribute effectively. Remember to consult the `README.md` file for detailed setup and development instructions. Pay particular attention to the comments regarding technical debt and ongoing migrations, especially the shift to Clerk for authentication and the consolidation of contract/document management.
