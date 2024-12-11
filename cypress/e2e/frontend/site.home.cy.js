describe("Loading the site (Home Page)", () => {
  it("visits the home page", () => {
    cy.visitHost();
    cy.get("h1").contains("Develop WordPress sites faster.");
  });
});
