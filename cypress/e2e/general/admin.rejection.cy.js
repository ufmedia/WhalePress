describe("WordPress Admin Login", () => {
  it("logs into the admin dashboard", () => {
    cy.visit(`http://localhost:${Cypress.env("PORT")}/wp-admin`); // Navigate to login page
    cy.get("#user_login").type("anunregistereduser"); // Replace with your username
    cy.get("#user_pass").type("123pass"); // Replace with your password
    cy.get("#wp-submit").click(); // Submit the form

    // Check if our long attempt was rejected
    cy.contains("is not registered on this site").should("be.visible");
  });
});
