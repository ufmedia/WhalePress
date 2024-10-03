describe('Loading the site (Home Page)', () => {
  it('visits the home page', () => {
    cy.visit(`http://localhost:${Cypress.env('PORT')}`); // Update URL as needed
    cy.wait(2000);
    cy.get('.home').should('be.visible');
  });
});