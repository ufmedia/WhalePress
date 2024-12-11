// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Alternatively you can use CommonJS syntax:
// require('./commands')

Cypress.on("uncaught:exception", (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test
  return false;
});

// Intercept all outgoing requests and add a custom header
Cypress.Commands.overwrite("visit", (originalFn, url, options) => {
  options = options || {};
  options.headers = options.headers || {};
  options.headers["x-workflow-e2e"] =
    "o7RgcD66UVivxHdovMaal1MGBIiygyhsYWr7Dt0vjIZz1Vhk5IDjuAi6yOQHEHLa";
  return originalFn(url, options);
});

// Intercept all outgoing requests and add a custom header
Cypress.Commands.add("addCustomHeader", () => {
  cy.intercept({ url: "**", middleware: true }, (req) => {
    req.headers["x-workflow-e2e"] =
      "o7RgcD66UVivxHdovMaal1MGBIiygyhsYWr7Dt0vjIZz1Vhk5IDjuAi6yOQHEHLa";
  });
});

beforeEach(() => {
  cy.addCustomHeader();
});

Cypress.on("window:before:load", (win) => {
  const originalFetch = win.fetch;
  win.fetch = (url, options) => {
    if (/\.(png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|css|js)$/.test(url)) {
      return new Promise((resolve) => resolve({ ok: true, json: () => ({}) }));
    }
    return originalFetch(url, options);
  };
});
