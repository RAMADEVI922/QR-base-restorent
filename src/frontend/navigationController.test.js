/**
 * Unit tests for NavigationController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
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

describe('NavigationController', () => {
  let controller;

  beforeEach(() => {
    createMockDOM();
    controller = new NavigationController();
  });

  describe('Initialization', () => {
    it('should initialize with default customer role', () => {
      const context = controller.getContext();
      expect(context.role).toBe('customer');
    });

    it('should initialize with null table and session', () => {
      const context = controller.getContext();
      expect(context.tableId).toBeNull();
      expect(context.sessionId).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow customer to access menu page', () => {
      controller.setUserRole('customer');
      expect(controller.hasAccess('menu')).toBe(true);
    });

    it('should deny customer access to dashboard', () => {
      controller.setUserRole('customer');
      expect(controller.hasAccess('dashboard')).toBe(false);
    });

    it('should allow manager to access all pages', () => {
      controller.setUserRole('manager');
      expect(controller.hasAccess('menu')).toBe(true);
      expect(controller.hasAccess('queue')).toBe(true);
      expect(controller.hasAccess('dashboard')).toBe(true);
      expect(controller.hasAccess('tables')).toBe(true);
      expect(controller.hasAccess('menu-management')).toBe(true);
    });

    it('should allow kitchen staff to access queue page', () => {
      controller.setUserRole('kitchen');
      expect(controller.hasAccess('queue')).toBe(true);
    });

    it('should deny kitchen staff access to dashboard', () => {
      controller.setUserRole('kitchen');
      expect(controller.hasAccess('dashboard')).toBe(false);
    });

    it('should allow waiter to access queue page', () => {
      controller.setUserRole('waiter');
      expect(controller.hasAccess('queue')).toBe(true);
    });
  });

  describe('Page Navigation', () => {
    it('should navigate to menu page for customer', () => {
      controller.setUserRole('customer');
      const result = controller.navigateTo('menu');
      
      expect(result).toBe(true);
      expect(controller.getCurrentPage()).toBe('menu');
      expect(document.getElementById('menu-page').classList.contains('hidden')).toBe(false);
    });

    it('should prevent navigation to unauthorized page', () => {
      controller.setUserRole('customer');
      const result = controller.navigateTo('dashboard');
      
      expect(result).toBe(false);
      expect(controller.getCurrentPage()).toBeNull();
    });

    it('should hide all other pages when navigating', () => {
      controller.setUserRole('manager');
      controller.navigateTo('menu');
      controller.navigateTo('dashboard');
      
      expect(document.getElementById('menu-page').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('dashboard-page').classList.contains('hidden')).toBe(false);
    });

    it('should return false for non-existent page', () => {
      controller.setUserRole('manager');
      const result = controller.navigateTo('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('User Context Management', () => {
    it('should preserve user context during navigation', () => {
      controller.setUserRole('customer');
      controller.setTableContext('table-1');
      controller.navigateTo('menu');
      
      const context = controller.getContext();
      expect(context.role).toBe('customer');
      expect(context.tableId).toBe('table-1');
    });

    it('should update context with new values', () => {
      controller.updateContext({ sessionId: 'session-123' });
      
      const context = controller.getContext();
      expect(context.sessionId).toBe('session-123');
    });

    it('should merge context without overwriting existing values', () => {
      controller.setUserRole('customer');
      controller.setTableContext('table-1');
      controller.updateContext({ sessionId: 'session-123' });
      
      const context = controller.getContext();
      expect(context.role).toBe('customer');
      expect(context.tableId).toBe('table-1');
      expect(context.sessionId).toBe('session-123');
    });

    it('should set table context', () => {
      controller.setTableContext('table-5');
      
      const context = controller.getContext();
      expect(context.tableId).toBe('table-5');
    });
  });

  describe('QR Code Navigation', () => {
    it('should navigate to menu page from QR code', () => {
      const result = controller.navigateFromQRCode('table-3');
      
      expect(result).toBe(true);
      expect(controller.getCurrentPage()).toBe('menu');
    });

    it('should set customer role when navigating from QR code', () => {
      controller.navigateFromQRCode('table-3');
      
      const context = controller.getContext();
      expect(context.role).toBe('customer');
    });

    it('should set table context when navigating from QR code', () => {
      controller.navigateFromQRCode('table-3');
      
      const context = controller.getContext();
      expect(context.tableId).toBe('table-3');
    });
  });

  describe('Role Management', () => {
    it('should set valid user role', () => {
      controller.setUserRole('manager');
      
      const context = controller.getContext();
      expect(context.role).toBe('manager');
    });

    it('should reject invalid user role', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      controller.setUserRole('invalid-role');
      
      const context = controller.getContext();
      expect(context.role).toBe('customer'); // Should remain unchanged
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Active Navigation Link', () => {
    it('should add active class to current page link', () => {
      controller.setUserRole('manager');
      controller.navigateTo('dashboard');
      
      const dashboardLink = document.querySelector('[data-page="dashboard"]');
      expect(dashboardLink.classList.contains('active')).toBe(true);
    });

    it('should remove active class from other links', () => {
      controller.setUserRole('manager');
      controller.navigateTo('menu');
      controller.navigateTo('dashboard');
      
      const menuLink = document.querySelector('[data-page="menu"]');
      expect(menuLink.classList.contains('active')).toBe(false);
    });
  });
});
