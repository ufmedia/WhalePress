describe("WordPress Admin Login", () => {
  it("logs into the admin dashboard", () => {
    cy.visitHost("/wp-admin");
    cy.wait(2000);
    cy.get("#user_login").type("anunregistereduser");
    cy.get("#user_pass").type("123pass");
    cy.get("#wp-submit").click();

    cy.contains("is not registered on this site").should("be.visible");
  });
});
