import { generate, count } from "random-words";

const userName = generate({ exactly: 3, join: "" });

describe("User management", () => {
  beforeEach(() => {
    // Log in to WordPress before running tests
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/wp-admin`
    );
    cy.get("#user_login").type(Cypress.env("WP_USERNAME"));
    cy.get("#user_pass").type(Cypress.env("WP_PASSWORD"));
    cy.get("#wp-submit").click();
  });

  it("creates a new user", () => {
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/wp-admin/user-new.php`
    ); // Navigate to new page editor
    cy.get("#user_login").type(userName);
    cy.get("#email").type(userName + "@test.com");
    cy.get("#user_login").type(userName);
    cy.get('#send_user_notification').uncheck();
    cy.get("#role").select("Editor");
    cy.get("#createusersub").click();
    cy.contains("New user created").should("be.visible");
  });

});
