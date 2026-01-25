# NGO Visitor & Reminder Manager v2.0

**Developed by Sewa Sankalp Pratishthan**

An offline-first visitor relationship and reminder management system designed for NGOs worldwide.

## Features

- 📝 Comprehensive visitor management with family contacts
- 🔔 Intelligent reminder system (birthdays, anniversaries, custom events)
- 💾 Multi-machine data synchronization (root/satellite architecture)
- 🔒 Activation key system for controlled distribution
- 📊 Interaction history tracking
- 🌐 Fully offline - no internet required
- 🎨 Modern, accessible UI

## Prerequisites

- **Node.js**: Required for building the application. [Download Node.js](https://nodejs.org/) (LTS recommended).

## Installation

1.  **Extract the Codebase**
    Extract the provided zip file to a folder on your computer.

2.  **Open Terminal**
    Open a terminal or command prompt in the extracted folder (where `package.json` is located).

3.  **Install Dependencies**
    Run the following command to install required libraries:
    ```bash
    npm install
    ```

4.  **Run Development Server (Optional)**
    To run the app locally for testing:
    ```bash
    npm run dev
    ```

5.  **Build for Production**
    To create the standalone application files:
    ```bash
    npm run build
    ```
    This will create a `dist` folder containing the application.

6.  **Deploy**
    Copy the contents of the `dist` folder to any location (USB drive, local folder, web server). Open `index.html` in any modern browser (Chrome, Edge, Firefox) to start the app.

## Activation

On first launch, you will be prompted for a Master Key.

*   **Development Key**: `SSP-DEV1-2026-TEST` (Use this for testing)
*   **Production Keys**: Contact Sewa Sankalp Pratishthan for a unique key.

You will also need to set:
- **Machine Name**: e.g., "Head Office" or "Field Worker 1"
- **Machine Role**:
    - **Root**: The central machine that aggregates data.
    - **Satellite**: Field machines that collect data.

## Multi-Machine Workflow

**Satellite Machines:**
1. Collect visitor data in the field.
2. Go to **Sync** > **Export Data**.
3. Save the `.json` file and transfer it to the Root machine (e.g., via USB).

**Root Machine:**
1. Go to **Sync** > **Import Data**.
2. Select the file from the Satellite machine.
3. **Automatic Merge**: The system uses a "Last-Write-Wins" strategy. If a visitor was modified on both machines, the version with the most recent update time will be kept.

## Technology Stack

- Vite (build tool)
- Vanilla JavaScript (ES6 modules)
- Vanilla CSS
- LocalStorage (data persistence)

## License

© 2026 Sewa Sankalp Pratishthan. All rights reserved.

Developed for NGOs worldwide by Sewa Sankalp Pratishthan.

Website: https://sewasankalp.org/

## Support

For activation keys and support, contact Sewa Sankalp Pratishthan through https://sewasankalp.org/
