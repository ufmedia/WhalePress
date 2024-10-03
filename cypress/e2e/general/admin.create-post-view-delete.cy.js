import { generate, count } from "random-words";

const pageTitle = generate({ exactly: 3, join: " " });
const pageSlug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");

describe("Create, View and Remove a Page", () => {
  beforeEach(() => {
    // Log in to WordPress before running tests
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/wp-admin`
    );
    cy.wait(2000);
    cy.get("#user_login").type(Cypress.env("WP_USERNAME"));
    cy.get("#user_pass").type(Cypress.env("WP_PASSWORD"));
    cy.get("#wp-submit").click();
  });

  it("creates a new page", () => {
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/wp-admin/post-new.php?post_type=page`
    ); // Navigate to new page editor
    cy.wait(2000);
    cy.get("#title").type(pageTitle);
    cy.get("#publish").click(); // Publish the page
    // Confirm the page was published
    cy.contains("Page published").should("be.visible");
  });

  it("views the created page", () => {
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/${pageSlug}`
    ); // Visit the newly created page by slug
    cy.wait(2000);
    cy.contains(pageTitle).should("be.visible");
  });

  it("deletes the created page", () => {
    cy.visit(
      `http://localhost${
        Cypress.env("PORT") ? `:${Cypress.env("PORT")}` : ""
      }/${pageSlug}`
    ); // Visit the newly created page by slug
    cy.wait(2000);
    cy.get("#wp-admin-bar-edit a").click(); // Click the "Move to Trash" link
    cy.get("#delete-action a").click(); // Click the "Move to Trash" button
    cy.contains("1 page moved to the ").should("be.visible"); // Confirm the page was moved to the trash
  });
});
