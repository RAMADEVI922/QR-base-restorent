/**
 * Property-Based Tests for NavigationController
 * Feature: qr-restaurant-ordering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import { NavigationController } from './navigationController.js';

// Set up jsdom environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Mock DOM elements
const createMockDOM = () => {
  document.body.innerHTML = `
    <nav class="navigation">
      <ul class="nav-links">
        <li><a href="#" data-page="menu" class="nav-link" data-role="customer">Menu</a></li>
        <li><a href="#" data-page="queue" class="nav-link" data-role="kitchen,waiter">Queue</a></li>
        <li><a href="#" data-page="dashboard" class="nav-link" data-role="manager">Dashboard</a></li>
        <li><a href="#" data-page="tables" class="nav-link" data-role="manager">Tables</a></li>
        <li><a href="#" data-page="menu-management" class="nav-link" data-role="manager">Menu Management</a></li>
      </ul>
    </nav>
    <main>
      <section id="menu-page" class="page hidden"></section>
      <section id="queue-page" class="page hidden"></section>
      <section id="dashboard-page" class="page hidden"></section>
      <section id="tables-page" class="page hidden"></section>
      <section id="menu-management-page" class="page hidden"></section>
    </main>
  `;
};

// Arbitraries for property-based testing
const roleArbitrary = fc.constantFrom('customer', 'kitchen', 'waiter', 'manager');
const tableIdArbitrary = fc.string({ minLength: 1, maxLength: 20 }).map(s => `table-${s}`);
const sessionIdArbitrary = fc.uuid();

// Get accessible pages for a role
const getAccessiblePages = (role) => {
  const pageAccess = {
    'customer': ['menu'],
    'kitchen': ['queue'],
    'waiter': ['queue'],
    'manager': ['menu', 'queue', 'dashboard', 'tables', 'menu-management']
  };
  return pageAccess[role] || [];
};

describe('NavigationController - Property-Based Tests', () => {
  beforeEach(() => {
    createMockDOM();
  });

  /**
   * Property 41: User Context Preserved During Navigation
   * **Validates: Requirements 11.4**
   * 
   * For any navigation between pages, the current user context 
   * (role, table association, session state) must be maintained.
   */
  it('Property 41: User context preserved during navigation', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        tableIdArbitrary,
        sessionIdArbitrary,
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 10 }),
        (role, tableId, sessionId, navigationSequence) => {
          // Setup
          const controller = new NavigationController();
          controller.setUserRole(role);
          controller.setTableContext(tableId);
          controller.updateContext({ sessionId });

          // Get initial context
          const initialContext = controller.getContext();
          expect(initialContext.role).toBe(role);
          expect(initialContext.tableId).toBe(tableId);
          expect(initialContext.sessionId).toBe(sessionId);

          // Get accessible pages for this role
          const accessiblePages = getAccessiblePages(role);
          
          if (accessiblePages.length === 0) {
            return true; // Skip if no accessible pages
          }

          // Navigate through multiple pages
          for (const pageIndex of navigationSequence) {
            const page = accessiblePages[pageIndex % accessiblePages.length];
            controller.navigateTo(page);

            // Verify context is preserved after each navigation
            const currentContext = controller.getContext();
            expect(currentContext.role).toBe(role);
            expect(currentContext.tableId).toBe(tableId);
            expect(currentContext.sessionId).toBe(sessionId);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: Role-Based Access Consistency
   * 
   * For any role and page combination, the access control decision
   * must be consistent across multiple checks.
   */
  it('Property: Role-based access control is consistent', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        fc.constantFrom('menu', 'queue', 'dashboard', 'tables', 'menu-management'),
        (role, page) => {
          const controller = new NavigationController();
          controller.setUserRole(role);

          // Check access multiple times
          const firstCheck = controller.hasAccess(page);
          const secondCheck = controller.hasAccess(page);
          const thirdCheck = controller.hasAccess(page);

          // Access decision must be consistent
          expect(firstCheck).toBe(secondCheck);
          expect(secondCheck).toBe(thirdCheck);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: Navigation Idempotence
   * 
   * For any accessible page, navigating to it multiple times
   * should result in the same state.
   */
  it('Property: Navigation to same page is idempotent', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        (role) => {
          const controller = new NavigationController();
          controller.setUserRole(role);

          const accessiblePages = getAccessiblePages(role);
          
          if (accessiblePages.length === 0) {
            return true;
          }

          const page = accessiblePages[0];

          // Navigate to the same page multiple times
          const result1 = controller.navigateTo(page);
          const result2 = controller.navigateTo(page);
          const result3 = controller.navigateTo(page);

          // All navigations should succeed
          expect(result1).toBe(true);
          expect(result2).toBe(true);
          expect(result3).toBe(true);

          // Current page should be the target page
          expect(controller.getCurrentPage()).toBe(page);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: Context Update Preserves Existing Values
   * 
   * For any context update, existing context values that are not
   * being updated must remain unchanged.
   */
  it('Property: Context updates preserve non-updated values', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        tableIdArbitrary,
        sessionIdArbitrary,
        fc.record({
          newSessionId: fc.option(sessionIdArbitrary, { nil: undefined }),
          newTableId: fc.option(tableIdArbitrary, { nil: undefined })
        }),
        (role, tableId, sessionId, updates) => {
          const controller = new NavigationController();
          controller.setUserRole(role);
          controller.setTableContext(tableId);
          controller.updateContext({ sessionId });

          // Apply partial update
          const updateObj = {};
          if (updates.newSessionId !== undefined) {
            updateObj.sessionId = updates.newSessionId;
          }
          if (updates.newTableId !== undefined) {
            updateObj.tableId = updates.newTableId;
          }

          controller.updateContext(updateObj);

          // Verify context
          const context = controller.getContext();
          
          // Role should always be preserved (not in update)
          expect(context.role).toBe(role);

          // Updated values should reflect new values
          if (updates.newSessionId !== undefined) {
            expect(context.sessionId).toBe(updates.newSessionId);
          } else {
            expect(context.sessionId).toBe(sessionId);
          }

          if (updates.newTableId !== undefined) {
            expect(context.tableId).toBe(updates.newTableId);
          } else {
            expect(context.tableId).toBe(tableId);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: QR Code Navigation Sets Correct Context
   * 
   * For any table ID, navigating from QR code must set customer role
   * and the correct table context.
   */
  it('Property: QR code navigation sets correct context', () => {
    fc.assert(
      fc.property(
        tableIdArbitrary,
        (tableId) => {
          const controller = new NavigationController();
          
          // Navigate from QR code
          const result = controller.navigateFromQRCode(tableId);

          // Navigation should succeed
          expect(result).toBe(true);

          // Verify context
          const context = controller.getContext();
          expect(context.role).toBe('customer');
          expect(context.tableId).toBe(tableId);
          expect(controller.getCurrentPage()).toBe('menu');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
