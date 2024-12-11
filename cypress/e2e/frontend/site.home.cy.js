describe("Loading the site (Home Page)", () => {
  it("visits the home page", () => {
    cy.visitHost();
    cy.get("h1").contains("DDevelop WordPress sites faster.");
  });
});
