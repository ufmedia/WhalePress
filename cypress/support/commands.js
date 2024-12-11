// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add("visitHost", (path = "") => {
    const host = Cypress.env("HOST");
    const port = Cypress.env("PORT");
  
    const url =
      port && port !== 80 ? `${host}:${port}${path}` : `${host}${path}`;
    cy.visit(url);
  });
  
  Cypress.Commands.add("clickIfExists", (selector) => {
    cy.get("body").then((body) => {
      if (body.find(selector).length > 0) {
        cy.get(selector).click();
      }
    });
  });