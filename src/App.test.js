import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/');
  axios.get.mockResolvedValue({ data: { data: [] } });
  axios.post.mockResolvedValue({ data: { data: { id: 1 } } });
});

test('renders raffle records and participant links returned by the API', async () => {
  axios.get.mockResolvedValue({ data: { data: [{
    id: 17,
    raffle_name: 'Sample raffle',
    created_at: '2026-01-01',
    winner_id: null,
    raffle_date: null,
  }] } });
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Sample raffle' }))
    .toHaveAttribute('href', '/raffles/17/participants');
  expect(axios.get).toHaveBeenCalledWith(`${process.env.REACT_APP_API_URL}/api/raffles`);
});

test('submits the raffle name and secret token through the existing API', async () => {
  render(<App />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText(/raffle name/i), { target: { value: 'New raffle' } });
  fireEvent.change(screen.getByLabelText(/sercet token/i), { target: { value: 'fixture-capability' } });
  fireEvent.click(screen.getByRole('button', { name: /create a new raffle/i }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL}/api/raffles`,
    { raffle_name: 'New raffle', secret_token: 'fixture-capability' },
  ));
});

test('navigates from a raffle to its participants and registration form', async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data:
    url.endsWith('/api/raffles')
      ? { data: [{ id: 17, raffle_name: 'Sample raffle', created_at: '2026-01-01' }] }
      : [],
  }));
  render(<App />);
  fireEvent.click(await screen.findByRole('link', { name: 'Sample raffle' }));
  expect(await screen.findByRole('heading', { name: 'Participants: 0 Total' })).toBeVisible();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL}/api/raffles/17/participants`,
  ));
  fireEvent.click(screen.getByRole('link', { name: 'Register' }));
  expect(await screen.findByLabelText('First Name*')).toBeVisible();
  expect(window.location.pathname).toBe('/raffles/17');
});

test('an unsuccessful list request leaves the raffle form usable', async () => {
  const error = new Error('Synthetic network failure');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    axios.get.mockRejectedValue(error);
    render(<App />);
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('catch', error));
    expect(screen.getByRole('button', { name: /create a new raffle/i })).toBeEnabled();
  } finally {
    consoleError.mockRestore();
  }
});
