// Activation Screen Component

import ActivationManager from '../../core/activation.js';
import Router, { ROUTES } from '../../core/router.js';
import { MACHINE_ROLES, ORGANIZATION, ORGANIZATION_URL, APP_VERSION } from '../../utils/constants.js';

import logoSrc from '../../assets/sewa-sankalp-logo.png';

export class ActivationScreen {
  constructor() {
    this.container = null;
  }

  /**
   * Render activation screen
   */
  render() {
    const container = document.createElement('div');
    container.className = 'activation-screen';
    container.innerHTML = `
      <div class="container container-narrow">
        <div class="card" style="margin-top: 3rem;">
          <div class="card-body text-center">
            <div class="activation-logo" style="margin-bottom: 2rem;">
              <img src="${logoSrc}" alt="${ORGANIZATION}" style="max-width: 300px; height: auto;" />
            </div>
            
            <h1>NGO Visitor & Reminder Manager</h1>
            <p class="text-secondary">Version ${APP_VERSION}</p>

            <!-- R2.5 (G16): the laptop failure mode is opening the WRONG COPY.
                 Browser storage is keyed to the file's location, so unzipping to
                 a new folder instead of overwriting in place shows this screen
                 and an empty app. Nothing was lost, but it is indistinguishable
                 from total loss — and the natural reaction, re-entering the key
                 and typing visitors in, creates a second divergent database. -->
            <div class="activation-wrongcopy">
              <strong>Already using Dnyani Mitr and seeing this screen?</strong>
              <p>You have opened a different copy of the file. Close this, and open the app
                 from the folder you always use. If you cannot find it, restore your backup —
                 do not enter data here first.</p>
            </div>

            <div style="margin: 2rem 0; padding: 1.5rem; background-color: var(--color-bg); border-radius: var(--radius-md);">
              <h3>Welcome!</h3>
              <p>This application requires activation with a master key provided by ${ORGANIZATION}.</p>
            </div>
            
            <form id="activation-form" style="text-align: left;">
              <div class="form-group">
                <label class="form-label" for="master-key">Master Key *</label>
                <input 
                  type="text" 
                  id="master-key" 
                  class="form-input" 
                  placeholder="SSP-XXXX-XXXX-XXXX"
                  required
                  autocomplete="off"
                  style="text-transform: uppercase; font-family: monospace; font-size: 1.1rem;"
                />
                <p class="form-help">Enter the master key in format: SSP-XXXX-XXXX-XXXX</p>
              </div>
              
              <div id="machine-setup" class="hidden">
                <h3 style="margin-top: 2rem;">Machine Setup</h3>
                
                <div class="form-group">
                  <label class="form-label" for="machine-name">Machine Name *</label>
                  <input 
                    type="text" 
                    id="machine-name" 
                    class="form-input" 
                    placeholder="e.g., Head Office or Field Worker 1"
                    required
                  />
                  <p class="form-help">A friendly name to identify this machine</p>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Machine Role *</label>
                  <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <label class="form-checkbox">
                      <input type="radio" name="machine-role" value="${MACHINE_ROLES.ROOT}" required />
                      <span>
                        <strong>Root Machine</strong> (Data Aggregator)
                        <br/>
                        <small class="text-secondary">Imports and merges data from satellite machines</small>
                      </span>
                    </label>
                    <label class="form-checkbox">
                      <input type="radio" name="machine-role" value="${MACHINE_ROLES.SATELLITE}" required />
                      <span>
                        <strong>Satellite Machine</strong> (Field Data Collection)
                        <br/>
                        <small class="text-secondary">Collects data in the field, exports to root machine</small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div id="activation-error" class="form-error hidden" style="margin-bottom: 1rem;"></div>
              
              <div class="card-footer" style="margin-top: 2rem; border-top: none; padding-top: 0;">
                <button type="button" id="validate-key-btn" class="btn btn-primary btn-lg">
                  Validate Key
                </button>
                <button type="submit" id="activate-btn" class="btn btn-success btn-lg hidden">
                  Activate
                </button>
              </div>
            </form>
            
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--color-border);">
              <p class="text-secondary" style="font-size: 0.875rem;">
                Don't have a master key?<br/>
                Contact: <a href="${ORGANIZATION_URL}" target="_blank">${ORGANIZATION_URL}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();

    return container;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const form = this.container.querySelector('#activation-form');
    const masterKeyInput = this.container.querySelector('#master-key');
    const validateBtn = this.container.querySelector('#validate-key-btn');
    const activateBtn = this.container.querySelector('#activate-btn');
    const machineSetup = this.container.querySelector('#machine-setup');
    const errorDiv = this.container.querySelector('#activation-error');

    // Validate key button
    validateBtn.addEventListener('click', () => {
      const key = masterKeyInput.value.trim().toUpperCase();

      if (!key) {
        this.showError('Please enter a master key');
        return;
      }

      // Simple format validation
      if (!/^SSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
        this.showError('Invalid key format. Expected: SSP-XXXX-XXXX-XXXX');
        return;
      }

      // Show machine setup
      machineSetup.classList.remove('hidden');
      validateBtn.classList.add('hidden');
      activateBtn.classList.remove('hidden');
      masterKeyInput.disabled = true;
      this.hideError();
    });

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleActivation();
    });
  }

  /**
   * Handle activation
   */
  handleActivation() {
    const masterKey = this.container.querySelector('#master-key').value.trim().toUpperCase();
    const machineName = this.container.querySelector('#machine-name').value.trim();
    const machineRole = this.container.querySelector('input[name="machine-role"]:checked')?.value;

    if (!machineName) {
      this.showError('Please enter a machine name');
      return;
    }

    if (!machineRole) {
      this.showError('Please select a machine role');
      return;
    }

    // Attempt activation
    const result = ActivationManager.activate(masterKey, {
      machineName,
      machineRole
    });

    if (result.success) {
      // Success! Reload page to reinitialize app with activated state
      this.showSuccess('Activation successful! Redirecting...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      this.showError(result.error);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = this.container.querySelector('#activation-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorDiv = this.container.querySelector('#activation-error');
    errorDiv.classList.add('hidden');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const errorDiv = this.container.querySelector('#activation-error');
    errorDiv.textContent = message;
    errorDiv.className = 'text-success';
    errorDiv.classList.remove('hidden');
  }

  /**
   * Destroy component
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
