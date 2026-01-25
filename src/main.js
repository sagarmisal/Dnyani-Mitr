// Main Application Entry Point

import StateManager from './core/state.js';
import Router, { ROUTES } from './core/router.js';
import ActivationManager from './core/activation.js';
import { ActivationScreen } from './components/Activation/ActivationScreen.js';
import { VisitorList } from './components/Visitors/VisitorList.js';
import { VisitorForm } from './components/Visitors/VisitorForm.js';
import { VisitorView } from './components/Visitors/VisitorView.js';
import { ReminderDashboard } from './components/Reminders/ReminderDashboard.js';
import { SyncManager } from './components/Sync/SyncManager.js';
import { Toast } from './components/UI/Toast.js';
import { APP_NAME, ORGANIZATION, ORGANIZATION_URL } from './utils/constants.js';

class App {
  constructor() {
    this.appContainer = null;
    this.currentView = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log(`${APP_NAME} v2.0 - Initializing...`);

    // Initialize state
    await StateManager.init();

    // Get app container
    this.appContainer = document.getElementById('app');

    // Check activation status
    if (!ActivationManager.isActivated()) {
      this.showActivationScreen();
    } else {
      this.initializeMainApp();
    }
  }

  /**
   * Show activation screen
   */
  showActivationScreen() {
    console.log('App not activated - showing activation screen');

    const activationScreen = new ActivationScreen();
    const view = activationScreen.render();

    this.appContainer.innerHTML = '';
    this.appContainer.appendChild(view);
    this.currentView = activationScreen;
  }

  /**
   * Initialize main application
   */
  initializeMainApp() {
    console.log('App activated - initializing main application');

    // Render main layout
    this.renderLayout();

    // Register routes
    this.registerRoutes();

    // Start router
    Router.handleRouteChange();
  }

  /**
   * Render main application layout
   */
  renderLayout() {
    const machineInfo = ActivationManager.getMachineInfo();
    const logoExists = true; // Assuming logo always exists for now, based on original code always showing it.

    this.appContainer.innerHTML = `
      <header class="app-header">
        <div class="container">
          <div class="header-content">
            <div class="header-logo">
              ${logoExists ? '<img src="/sewa-sankalp-logo.png" alt="Logo" style="height: 48px;">' : ''}
              <div>
                <h1 class="header-title">Dnyani Mitra</h1>
                <p class="header-subtitle">Verified Visitor & Reminder System</p>
              </div>
            </div>
            <div class="machine-info text-secondary" style="font-size: 0.875rem;">
              <div><strong>${machineInfo.machineName}</strong></div>
              <div>${machineInfo.machineRole === 'root' ? '📊 Root Machine' : '📱 Satellite Machine'}</div>
            </div>
          </div>
          
          <nav class="app-nav">
            <a href="#${ROUTES.VISITORS}" class="nav-link">Visitors</a>
            <a href="#${ROUTES.REMINDERS}" class="nav-link">Reminders</a>
            <a href="#${ROUTES.SYNC}" class="nav-link">Data / Sync</a>
            <!-- Removed Interactions and Backup (merged) -->
            <a href="#${ROUTES.ABOUT}" class="nav-link">About</a>
          </nav>
        </div>
      </header>

      <main class="app-main">
        <div class="container" id="main-content">
          <!-- Dynamic content will be rendered here -->
        </div>
      </main>

      <footer class="app-footer">
        <div class="container">
          <div class="footer-content">
            <p>&copy; 2026 ${ORGANIZATION}. All rights reserved.</p>
            <p>Developed for NGOs worldwide by ${ORGANIZATION}</p>
            <p><a href="${ORGANIZATION_URL}" target="_blank">${ORGANIZATION_URL}</a></p>
          </div>
        </div>
      </footer>
    `;

    // Update active nav link on route change
    this.updateActiveNavLink();
  }

  /**
   * Register application routes
   */
  registerRoutes() {
    // Activation route
    Router.register(ROUTES.ACTIVATION, () => {
      this.showActivationScreen();
    });

    // Visitors route (default)
    Router.register(ROUTES.VISITORS, () => {
      const visitorList = new VisitorList();
      this.renderComponent(visitorList.render());
    });

    // Visitor view
    Router.register(ROUTES.VISITOR_VIEW, (params) => {
      if (!params.id) {
        Router.navigate(ROUTES.VISITORS);
        return;
      }
      const visitorView = new VisitorView(params.id);
      this.renderComponent(visitorView.render());
    });

    // Visitor add
    Router.register(ROUTES.VISITOR_ADD, () => {
      const visitorForm = new VisitorForm();
      this.renderComponent(visitorForm.render());
    });

    // Visitor edit
    Router.register(ROUTES.VISITOR_EDIT, (params) => {
      const visitorForm = new VisitorForm(params.id);
      this.renderComponent(visitorForm.render());
    });

    // Reminders route
    Router.register(ROUTES.REMINDERS, () => {
      const reminders = new ReminderDashboard();
      this.renderComponent(reminders.render());
    });

    // Interactions route
    Router.register(ROUTES.INTERACTIONS, () => {
      Router.navigate(ROUTES.VISITORS); // Search from visitors
      Toast.show('Search for a visitor to see their interaction history', 'info');
    });

    // Sync route
    Router.register(ROUTES.SYNC, () => {
      const sync = new SyncManager();
      this.renderComponent(sync.render());
    });

    // Backup route (Alias for Sync)
    Router.register(ROUTES.BACKUP, () => {
      Router.navigate(ROUTES.SYNC);
    });

    // About route
    Router.register(ROUTES.ABOUT, () => {
      const machineInfo = ActivationManager.getMachineInfo();
      this.renderView(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">About</h2>
          </div>
          <div class="card-body">
            <h3>${APP_NAME}</h3>
            <p>Version 2.0.0</p>
            
            <h4 style="margin-top: 2rem;">Developed by</h4>
            <p><strong>${ORGANIZATION}</strong></p>
            <p><a href="${ORGANIZATION_URL}" target="_blank">${ORGANIZATION_URL}</a></p>
            
            <h4 style="margin-top: 2rem;">Mission</h4>
            <p>This application was developed by ${ORGANIZATION} to help NGOs worldwide manage visitor relationships and reminders effectively. It is designed to work completely offline and supports multi-machine deployments for field operations.</p>
            
            <h4 style="margin-top: 2rem;">Machine Information</h4>
            <table style="width: 100%; margin-top: 1rem;">
              <tr>
                <td><strong>Machine Name:</strong></td>
                <td>${machineInfo.machineName}</td>
              </tr>
              <tr>
                <td><strong>Machine Role:</strong></td>
                <td>${machineInfo.machineRole === 'root' ? 'Root (Data Aggregator)' : 'Satellite (Field Collection)'}</td>
              </tr>
              <tr>
                <td><strong>Machine ID:</strong></td>
                <td><code>${machineInfo.machineId}</code></td>
              </tr>
              <tr>
                <td><strong>Activated:</strong></td>
                <td>${new Date(machineInfo.activatedAt).toLocaleString()}</td>
              </tr>
            </table>
            
            <h4 style="margin-top: 2rem;">License</h4>
            <p>&copy; 2026 ${ORGANIZATION}. All rights reserved.</p>
          </div>
        </div>
      `);
    });

    // Set default route
    Router.setDefaultRoute(ROUTES.VISITORS);
  }

  /**
   * Render a view in the main content area
   */
  renderView(html) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = html;
      this.updateActiveNavLink();
    }
  }

  /**
   * Render a component in the main content area
   */
  renderComponent(componentElement) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = '';
      mainContent.appendChild(componentElement);
      this.updateActiveNavLink();
    }
  }

  /**
   * Update active navigation link
   */
  updateActiveNavLink() {
    const currentRoute = Router.getCurrentRoute();
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentRoute}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

// Export for potential external use
export default App;
