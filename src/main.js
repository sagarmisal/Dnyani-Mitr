// Main Application Entry Point

import StateManager from './core/state.js';
import Router, { ROUTES } from './core/router.js';
import ActivationManager from './core/activation.js';
import { ActivationScreen } from './components/Activation/ActivationScreen.js';
import { VisitorList } from './components/Visitors/VisitorList.js';
import { VisitorForm } from './components/Visitors/VisitorForm.js';
import { VisitorView } from './components/Visitors/VisitorView.js';
import { ReminderDashboard } from './components/Reminders/ReminderDashboard.js';
import { CampaignList } from './components/Campaigns/CampaignList.js';
import { CampaignBuilder } from './components/Campaigns/CampaignBuilder.js';
import { SyncManager } from './components/Sync/SyncManager.js';
import { SettingsPage } from './components/Settings/SettingsPage.js';
import { Toast } from './components/UI/Toast.js';
import NotificationService from './services/NotificationService.js';
import { MyDayDashboard } from './components/Dashboard/MyDayDashboard.js';
import { CalendarView } from './components/Calendar/CalendarView.js';
import { WhatsNew } from './components/UI/WhatsNew.js';
import FileService from './services/FileService.js';
import { InteractionHistory } from './components/Interactions/InteractionHistory.js';
import { APP_NAME, APP_VERSION, ORGANIZATION, ORGANIZATION_URL } from './utils/constants.js';
import logoSrc from './assets/sewa-sankalp-logo.png';

class App {
  constructor() {
    this.appContainer = null;
    this.currentView = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log(`${APP_NAME} v${APP_VERSION} - Initializing...`);

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

    // Reconcile local notifications with saved settings (no-op off-device).
    NotificationService.sync(StateManager.getSettings());

    // U1: first run after an upgrade. Nobody is beside these volunteers to
    // explain that the landing screen moved, so the app explains it once.
    try { WhatsNew.showIfNeeded(); } catch (e) { console.error('WhatsNew failed', e); }

    // F3: a backup tapped in WhatsApp arrives here. Route it to Sync with the
    // content parked, so the existing preview + confirm flow handles it — no
    // separate import path to keep correct.
    FileService.onFileOpened((content, name) => {
      window.__dnyaniMitrIncoming = { content, name };
      Router.navigate(ROUTES.SYNC);
    });
  }

  /**
   * Render main application layout
   */
  renderLayout() {
    const machineInfo = ActivationManager.getMachineInfo();
    this.appContainer.innerHTML = `
      <header class="app-header">
        <div class="container">
          <div class="header-content">
            <div class="header-logo">
              <img src="${logoSrc}" alt="Logo" style="height: 48px;">
              <div>
                <h1 class="header-title">Dnyani Mitr</h1>
                <p class="header-subtitle">Verified Visitor & Reminder System</p>
              </div>
            </div>
            <div class="machine-info text-secondary" style="font-size: 0.875rem;">
              <div><strong>${machineInfo.machineName}</strong></div>
              <div>${machineInfo.machineRole === 'root' ? '📊 Root Machine' : '📱 Satellite Machine'}</div>
            </div>
          </div>
          
          <nav class="app-nav">
            <a href="#${ROUTES.CALENDAR}" class="nav-link">Calendar</a>
            <a href="#${ROUTES.DASHBOARD}" class="nav-link">My Day</a>
            <a href="#${ROUTES.VISITORS}" class="nav-link">Visitors</a>
            <a href="#${ROUTES.REMINDERS}" class="nav-link">Reminders</a>
            <a href="#${ROUTES.CAMPAIGNS}" class="nav-link">Campaigns</a>
            <a href="#${ROUTES.INTERACTIONS}" class="nav-link">History</a>
            <a href="#${ROUTES.SYNC}" class="nav-link">Sync</a>
            <a href="#${ROUTES.SETTINGS}" class="nav-link">Settings</a>
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

    // Calendar route (Iter 11) — the landing screen.
    Router.register(ROUTES.CALENDAR, (params) => {
      const calendar = new CalendarView(params || {});
      this.renderComponent(calendar.render());
    });

    // My Day is NOT deleted. It stays fully working here, reachable from the
    // day pane, and is what the landingScreen kill-switch falls back to (S5).
    Router.register(ROUTES.DASHBOARD, () => {
      const dashboard = new MyDayDashboard();
      this.renderComponent(dashboard.render());
    });

    // Visitors route
    Router.register(ROUTES.VISITORS, () => {
      const visitorList = new VisitorList();
      this.renderComponent(visitorList.render());
    });

    // Legacy root route follows whatever the landing preference says.
    Router.register('/', () => {
      Router.navigate(this.landingRoute());
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

    // Campaigns route (list + suggestions)
    Router.register(ROUTES.CAMPAIGNS, () => {
      const campaigns = new CampaignList();
      this.renderComponent(campaigns.render());
    });

    // Campaign builder (create/send). Optional ?occasionId= preselects an occasion.
    Router.register('/campaigns/new', (params) => {
      const builder = new CampaignBuilder(params.occasionId || null);
      this.renderComponent(builder.render());
    });

    // Interactions route
    Router.register(ROUTES.INTERACTIONS, () => {
      const history = new InteractionHistory();
      this.renderComponent(history.render());
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

    // Settings route
    Router.register(ROUTES.SETTINGS, () => {
      const settings = new SettingsPage();
      this.renderComponent(settings.render());
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
            <p>Version ${APP_VERSION}</p>
            
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

    // Set default route. C5a/S5 — the kill switch: a volunteer who finds the
    // calendar landing confusing can put My Day back from Settings, over the
    // phone, with no rebuild and no new APK.
    Router.setDefaultRoute(this.landingRoute());
  }

  landingRoute() {
    const settings = StateManager.getSettings();
    return settings.landingScreen === 'dashboard' ? ROUTES.DASHBOARD : ROUTES.CALENDAR;
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
