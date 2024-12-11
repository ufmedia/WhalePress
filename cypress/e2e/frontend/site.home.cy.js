describe("Loading the site (Home Page)", () => {
  it("visits the home page", () => {
    cy.visitHost();
    //Find the text "Develop WordPress projects faster"
    cy.get("h1").contains("Develop WordPress projects faster");
  });
});
