import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([
    {
      title: 'React Basics',
      path: '/path/react.md',
      topic: 'Frontend',
      questions: []
    },
    {
      title: 'Rust Basics',
      path: '/path/rust.md',
      topic: 'Backend',
      questions: []
    }
  ])
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search bar and filters quizzes correctly', async () => {
    render(<App />);

    // Wait for the quizzes to load
    await waitFor(() => {
      expect(screen.getByText('React Basics')).toBeInTheDocument();
      expect(screen.getByText('Rust Basics')).toBeInTheDocument();
    });

    // Find the search input
    const searchInput = screen.getByPlaceholderText('Search quizzes...');
    expect(searchInput).toBeInTheDocument();

    // Type in the search input to filter by title
    fireEvent.change(searchInput, { target: { value: 'React' } });

    // React Basics should be there, Rust Basics should be gone
    expect(screen.getByText('React Basics')).toBeInTheDocument();
    expect(screen.queryByText('Rust Basics')).not.toBeInTheDocument();

    // Type in the search input to filter by topic
    fireEvent.change(searchInput, { target: { value: 'Backend' } });

    // Rust Basics should be there, React Basics should be gone
    expect(screen.queryByText('React Basics')).not.toBeInTheDocument();
    expect(screen.getByText('Rust Basics')).toBeInTheDocument();
  });
});
