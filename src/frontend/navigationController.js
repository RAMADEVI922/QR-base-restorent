/**
 * Navigation Controller
 * Handles page switching, user context management, and role-based access control
 * Requirements: 11.1, 11.3, 11.4
 */

export class NavigationController {
  constructor() {
    this.currentPage = null;
    this.userContext = {
      role: 'customer', // customer, kitchen, waiter, manager
      tableId: null,
      sessionId: null
    };
    
    // Define role-based page access
    this.pageAccessControl = {
      'menu': ['customer', 'manager'],
      'queue': ['kitchen', 'waiter', 'manager'],
      'dashboard': ['manager'],
      'tables': ['manager'],
      'menu-management': ['manager'],
      'confirmation': ['customer']
    };
  }

  /**
   * Initialize navigation system
   */
  init() {
    this.setupNavigationListeners();
    this.applyRoleBasedAccess();
  }

  /**
   * Set up navigation event listeners
   */
  setupNavigationListeners() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  /**
   * Navigate to a specific page
   * @param {string} pageName - Name of the page to navigate to
   * @param {Object} context - Optional context to pass to the page
   * @returns {boolean} - True if navigation succeeded, false otherwise
   */
  navigateTo(pageName, context = {}) {
    // Check if user has access to this page
    if (!this.hasAccess(pageName)) {
      console.warn(`Access denied to page: ${pageName} for role: ${this.userContext.role}`);
      return false;
    }

    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.add('hidden'));

    // Show selected page
    const pageElement = document.getElementById(`${pageName}-page`);
    if (!pageElement) {
      console.error(`Page not found: ${pageName}`);
      return false;
    }

    pageElement.classList.remove('hidden');
    this.currentPage = pageName;

    // Update active navigation link
    this.updateActiveNavLink(pageName);

    // Merge context while preserving user context
    this.updateContext(context);

    return true;
  }

  /**
   * Check if current user role has access to a page
   * @param {string} pageName - Name of the page
   * @returns {boolean} - True if user has access
   */
  hasAccess(pageName) {
    const allowedRoles = this.pageAccessControl[pageName];
    if (!allowedRoles) {
      return false;
    }
    return allowedRoles.includes(this.userContext.role);
  }

  /**
   * Update user context while preserving existing values
   * @param {Object} newContext - New context values to merge
   */
  updateContext(newContext) {
    this.userContext = {
      ...this.userContext,
      ...newContext
    };
  }

  /**
   * Set user role and apply access control
   * @param {string} role - User role (customer, kitchen, waiter, manager)
   */
  setUserRole(role) {
    const validRoles = ['customer', 'kitchen', 'waiter', 'manager'];
    if (!validRoles.includes(role)) {
      console.error(`Invalid role: ${role}`);
      return;
    }
    
    this.userContext.role = role;
    this.applyRoleBasedAccess();
  }

  /**
   * Set table context (for customers)
   * @param {string} tableId - Table identifier
   */
  setTableContext(tableId) {
    this.userContext.tableId = tableId;
  }

  /**
   * Get current user context
   * @returns {Object} - Current user context
   */
  getContext() {
    return { ...this.userContext };
  }

  /**
   * Apply role-based access control to navigation
   */
  applyRoleBasedAccess() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const page = link.dataset.page;
      const roles = link.dataset.role ? link.dataset.role.split(',') : [];
      
      // Show/hide navigation links based on role
      if (roles.length > 0 && !roles.includes(this.userContext.role)) {
        link.parentElement.style.display = 'none';
      } else {
        link.parentElement.style.display = '';
      }
    });
  }

  /**
   * Update active navigation link styling
   * @param {string} pageName - Name of the active page
   */
  updateActiveNavLink(pageName) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Navigate from QR code scan
   * @param {string} tableId - Table identifier from QR code
   * @returns {boolean} - True if navigation succeeded
   */
  navigateFromQRCode(tableId) {
    // Set customer role and table context
    this.setUserRole('customer');
    this.setTableContext(tableId);
    
    // Navigate to menu page
    return this.navigateTo('menu', { tableId });
  }

  /**
   * Get current page name
   * @returns {string} - Current page name
   */
  getCurrentPage() {
    return this.currentPage;
  }
}
