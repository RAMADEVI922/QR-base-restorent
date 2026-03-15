/**
 * Navigation Controller Demo
 * Demonstrates the navigation controller functionality
 */

import { NavigationController } from './navigationController.js';

// Create a simple demo function
export function demonstrateNavigation() {
  console.log('=== Navigation Controller Demo ===');
  
  const nav = new NavigationController();
  
  // Test 1: Role-based access control
  console.log('\n1. Testing Role-Based Access Control:');
  nav.setUserRole('customer');
  console.log(`Customer can access menu: ${nav.hasAccess('menu')}`); // true
  console.log(`Customer can access dashboard: ${nav.hasAccess('dashboard')}`); // false
  
  nav.setUserRole('manager');
  console.log(`Manager can access menu: ${nav.hasAccess('menu')}`); // true
  console.log(`Manager can access dashboard: ${nav.hasAccess('dashboard')}`); // true
  
  // Test 2: Context management
  console.log('\n2. Testing Context Management:');
  nav.setUserRole('customer');
  nav.setTableContext('table-5');
  const context = nav.getContext();
  console.log(`Current context:`, context);
  
  // Test 3: QR Code navigation
  console.log('\n3. Testing QR Code Navigation:');
  nav.navigateFromQRCode('table-3');
  const newContext = nav.getContext();
  console.log(`After QR scan - Role: ${newContext.role}, Table: ${newContext.tableId}`);
  
  console.log('\n=== Demo Complete ===');
  return true;
}

// Run demo if this file is executed directly
if (typeof window !== 'undefined') {
  window.demonstrateNavigation = demonstrateNavigation;
}