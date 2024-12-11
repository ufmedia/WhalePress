describe("WordPress Admin Login", () => {
  it("logs into the admin dashboard", () => {
    cy.visitHost("/wp-admin");
    cy.wait(2000);
    cy.get("#user_login").type(Cypress.env("WP_USERNAME"));
    cy.get("#user_pass").type(Cypress.env("WP_PASSWORD"));
    cy.get("#wp-submit").click();
    cy.url().should("include", "/wp-admin");
    cy.contains("Dashboard").should("be.visible");
  });
});
