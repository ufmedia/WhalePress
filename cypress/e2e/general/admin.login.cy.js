describe("WordPress Admin Login", () => {
  it("logs into the admin dashboard", () => {
    cy.visit(`http://localhost:${Cypress.env("PORT")}/wp-admin`); // Navigate to login page
    cy.get("#user_login").type(Cypress.env("WP_USERNAME")); // Replace with your username
    cy.get("#user_pass").type(Cypress.env("WP_PASSWORD")); // Replace with your password
    cy.get("#wp-submit").click(); // Submit the form

    // Check if we are redirected to the dashboard
    cy.url().should("include", "/wp-admin");
    cy.contains("Dashboard").should("be.visible");
  });
});
