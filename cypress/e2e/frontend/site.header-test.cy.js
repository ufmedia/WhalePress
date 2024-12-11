describe("Header Test", () => {
  it("should include the custom header in requests", () => {
    cy.intercept("GET", "**", (req) => {
      expect(req.headers).to.have.property(
        "x-workflow-e2e",
        "o7RgcD66UVivxHdovMaal1MGBIiygyhsYWr7Dt0vjIZz1Vhk5IDjuAi6yOQHEHLa"
      );
    }).as("checkHeader");

    cy.visitHost();
    cy.wait("@checkHeader");
  });
});
