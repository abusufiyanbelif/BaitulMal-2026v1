# Developer Guide: DocuExtract Application

Welcome to the developer guide for the DocuExtract application. This document serves as the central hub for understanding, running, and contributing to the project.

## Table of Contents

1.  [**Setup and Installation**](./01-setup-and-installation.md)
    -   Prerequisites
    -   Environment Setup
    -   Running the Application

2.  [**Firebase Configuration**](./02-firebase-configuration.md)
    -   Firebase Project Setup
    -   Admin SDK (Server-side)
    -   Client-Side Configuration
    -   Troubleshooting Connection Issues

3.  [**Database & CLI Commands**](./03-database-and-cli.md)
    -   Seeding the Database (`db:seed`)
    -   Data Migrations
    -   Erasing Data (`db:erase`)

4.  [**Permissions & Authentication**](./04-permissions-and-auth.md)
    -   Actors & Roles (Users, Service Accounts)
    -   Required Google Cloud APIs & IAM Roles
    -   Login Mechanism & Security Rules
    -   Troubleshooting Access Errors

5.  [**Genkit AI Flows**](./05-genkit-ai-flows.md)
    -   Overview of Genkit
    -   Creating a New AI Flow
    -   Input/Output Schemas with Zod
    -   Troubleshooting AI Errors

6.  [**Common Issues & Troubleshooting**](./06-common-issues-and-troubleshooting.md)
    -   Diagnosing Build Failures (Next.js 404 Errors)
    -   Solving Client-Side Exceptions
    -   Debugging Permission Denied Errors

7.  [**Storage & File Management**](./07-storage-and-file-management.md)
    -   Folder Structure Philosophy
    -   Detailed Folder Layout
    -   A Note on Migration

## Project Overview

This application is a Next.js-based platform designed for managing community support initiatives. It leverages Firebase for its backend services, including Authentication, Firestore (database), and Storage. The application is designed with a role-based access control system, distinguishing between regular users and administrators with full system access.

## Core Technologies

-   **Framework**: [Next.js](https://nextjs.org/) (App Router)
-   **UI**: [React](https://react.dev/), [ShadCN/UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
-   **Backend**: [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage)
-   **AI**: [Genkit](https://firebase.google.com/docs/genkit)
-   **Schema Validation**: [Zod](https://zod.dev/)
-   **Deployment**: Firebase App Hosting
