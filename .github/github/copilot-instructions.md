# Copilot Instructions for Next.js & Tailwind Project

This project is a web application built with Next.js (App Router) for the frontend, utilizing Tailwind CSS for styling, and powered by a Node.js backend. TypeScript is used throughout for type safety.

## Project Context

-   **Frontend Framework:** Next.js (App Router)
-   **Styling Framework:** Tailwind CSS
-   **Backend Language/Runtime:** Node.js
-   **Language:** TypeScript
-   **Package Manager:** pnpm (preferred, use `pnpm` for all package operations)

## Development Standards

### Architecture

-   Use the Next.js App Router for all new pages and components.
-   Favor server components where appropriate for performance and data fetching.
-   Organize routes and components logically by feature or domain.
-   Separate API routes in the `app/api` directory for backend interactions.

### Styling

-   All styling should be done using Tailwind CSS utility classes.
-   Avoid inline styles unless absolutely necessary for dynamic values.
-   Create custom Tailwind classes or components only when existing utilities are insufficient.
-   Ensure responsive design using Tailwind's responsive prefixes (e.g., `sm:`, `md:`, `lg:`).

### Code Quality & Practices

-   **TypeScript First:** All new code must be written in TypeScript, leveraging strict type checking.
-   **Clean Code:** Prioritize readability, maintainability, and reusability.
-   **Descriptive Naming:** Use clear and descriptive names for variables, functions, components, and files.
-   **DRY Principle:** Extract reusable logic into functions, custom hooks, or components.
-   **Modularization:** Break down complex features into smaller, manageable units.
-   **Asynchronous Operations:** Use `async/await` for handling asynchronous code.
-   **Error Handling:** Implement robust error handling for API calls and other operations.

### File Structure Guidelines

-   Place Next.js pages and components within the `app` directory.
-   Organize reusable components in a `components` directory (e.g., `components/ui`).
-   Store utility functions in a `lib` or `utils` directory.
-   Backend logic for API routes should reside in `app/api`.