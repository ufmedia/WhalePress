describe('Loading the site (Home Page)', () => {
  it('visits the home page', () => {
    cy.visit(`http://localhost:${Cypress.env('PORT')}`); // Update URL as needed
    cy.contains('All content is available under').should('be.visible'); // You can replace 'Home' with a specific element/text on your home page
  });
});