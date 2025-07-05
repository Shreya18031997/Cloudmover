import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Google Drive File Transfer heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Google Drive File Transfer/i);
  expect(headingElement).toBeInTheDocument();
});
