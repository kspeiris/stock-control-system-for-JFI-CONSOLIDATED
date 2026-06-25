# Stock Control System - Architecture & Components Report

This is a comprehensive report on the structure, pages, UI components, print templates, and overall workflows of the **Stock Control System** based on an analysis of the source code.

## 1. High-Level Architecture
*   **Front-End Framework**: React (bootstrapped with Vite).
*   **Styling**: Tailwind CSS for utility-first styling (`index.css`, `App.css`).
*   **Desktop Environment**: Electron (`main.js`, `preload.js`) provides the desktop window and system integrations.
*   **Database**: SQLite. Handled in the Node.js/Electron backend (`database.js`, `database-service.js`).
*   **State & Routing**: The application uses a custom state-based routing approach in `App.jsx` (tracking the `currentModule` state) instead of a library like `react-router`.

## 2. Core Layout & UI Components (`src/components/UI`)
The main layout of the application is governed by `App.jsx`, which wraps the current module in a persistent layout containing:

*   **Header (`Header.js`)**: Top navigation bar containing user profile information, a dark mode toggle (Ctrl/Cmd+D shortcut), company name ("JFI CONSOLIDATED (PVT) LTD"), and potentially global search or quick action buttons.
*   **Sidebar (`Sidebar.js`)**: Side navigation menu used to switch between the different modules (Dashboard, Item Master, GRN, etc.). Highlights the active `currentModule`.
*   **Footer (`Footer.js`)**: A bottom bar for copyright or system status information.
*   **DataGrid (`DataGrid.js`)**: A reusable, generic table/grid component used across the application to display tabular data (items, suppliers, historical records).
*   **StatusBar (`StatusBar.js`)**: Displays the current status of documents (e.g., Pending, Approved, Completed) or system connection status.
*   **Toast (`Toast.js`)**: A popup notification component used to display success, error, and warning messages to the user.

## 3. Pages & Modules (`src/components`)
These are the primary views/pages rendered in the main content area depending on the user's selection in the sidebar.

*   **LoginPage (`LoginPage.js`)**: Handles user authentication. Saves session data to `localStorage` (session timeout is set to 30 minutes of inactivity).
*   **Dashboard (`Dashboard.js`)**: The default landing page after login. Provides a high-level overview of system metrics (stock levels, recent activity).
*   **ItemMaster (`ItemMaster.js`)**: Module for managing the inventory catalog. Users can add, edit, or delete items, specify reorder levels, and categorize stock.
*   **SupplierMaster (`SupplierMaster.js`)**: Module for managing supplier/vendor profiles, contact details, and terms.
*   **PurchaseOrder (`PurchaseOrder.js`)**: Module to create and track Purchase Orders (POs) sent to suppliers.
*   **GRN (`GRN.js`)**: Goods Receipt Note. Used when physical goods arrive from a supplier, usually referencing a Purchase Order, to officially add the items to the system's inventory.
*   **MIN (`MIN.js`)**: Material Issue Note. Used to issue materials/stock out of the inventory for internal use or production, thereby reducing the stock count.
*   **PurchaseReturn (`PurchaseReturn.js`)**: Module to process returns of defective, incorrect, or excess items back to the supplier, adjusting stock levels and financial records.
*   **Reports (`Reports.js`)**: A dedicated module for generating tabular reports (e.g., inventory valuation, fast/slow-moving items, supplier history).
*   **Analytics (`Analytics.js`)**: A visual dashboard with charts and graphs (shortcut: Ctrl/Cmd+A) for deeper insights into stock trends and purchasing patterns.
*   **Settings (`Settings.js`)**: Application configuration page.

## 4. Print Templates (`src/components/PrintTemplates`)
The system includes specialized components designed specifically for generating printer-friendly layouts and PDFs for official documents.

*   **`POPrint.js`**: Print layout for Purchase Orders.
*   **`GRNPrint.js`**: Print layout for Goods Receipt Notes.
*   **`MINPrint.js`**: Print layout for Material Issue Notes.
*   **`PRNPrint.js`**: Print layout for Purchase Return Notes.

## 5. System Workflow

The general operational workflow of the application follows standard inventory management principles:

1.  **System Setup & Initialization**:
    *   User authenticates via `LoginPage.js`.
    *   System data is populated through `SupplierMaster` (vendors) and `ItemMaster` (inventory items).
2.  **Inbound Operations (Procurement)**:
    *   A need is identified, and a `PurchaseOrder` is raised and sent to a supplier.
    *   When goods arrive, a `GRN` (Goods Receipt Note) is processed, which updates the on-hand stock quantities for the received items.
3.  **Outbound Operations (Consumption)**:
    *   When items are needed internally, a `MIN` (Material Issue Note) is generated, deducting the stock from the system.
4.  **Reverse Logistics**:
    *   If items received are faulty, they are processed through `PurchaseReturn` to deduct stock and create a return record.
5.  **Monitoring & Auditing**:
    *   Users continuously monitor stock levels via the `Dashboard` and `Analytics`.
    *   Periodic audits or data extracts are performed using the `Reports` module.
6.  **Physical Documentation**:
    *   At various stages (PO generation, Goods Receipt, Material Issue), the `PrintTemplates` are used to generate physical or digital (PDF) copies of the transactions for signatures and record-keeping.

---
*Note: Dark mode is supported natively throughout the application, controlled via state in `App.jsx` and Tailwind's `dark:` classes.*
