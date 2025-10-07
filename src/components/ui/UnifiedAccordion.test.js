import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UnifiedAccordion from './UnifiedAccordion';

describe('UnifiedAccordion', () => {
  const defaultProps = {
    title: 'Test Accordion',
    children: <div data-testid="accordion-content">Test Content</div>,
    isOpen: false,
    onToggle: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders with title and content when open', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      expect(screen.getByText('Test Accordion')).toBeInTheDocument();
      expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
    });

    test('renders with custom className', () => {
      render(<UnifiedAccordion {...defaultProps} className="custom-class" />);
      
      const accordion = screen.getByText('Test Accordion').closest('[class*="custom-class"]');
      expect(accordion).toBeInTheDocument();
    });

    test('renders with icon when provided', () => {
      const TestIcon = () => <span data-testid="test-icon">Icon</span>;
      render(<UnifiedAccordion {...defaultProps} icon={<TestIcon />} />);
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    test('renders with badge when provided', () => {
      render(<UnifiedAccordion {...defaultProps} badge="5" />);
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Open/Closed States', () => {
    test('shows content when isOpen is true', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      const content = screen.getByTestId('accordion-content');
      expect(content).toBeVisible();
    });

    test('hides content when isOpen is false', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={false} />);
      
      const content = screen.getByTestId('accordion-content');
      expect(content).not.toBeVisible();
    });

    test('applies correct ARIA attributes', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('updates ARIA attributes when state changes', () => {
      const { rerender } = render(<UnifiedAccordion {...defaultProps} isOpen={false} />);
      
      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      
      rerender(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Interaction', () => {
    test('calls onToggle when header is clicked', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    test('toggles on Enter key press', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      
      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    test('toggles on Space key press', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });
      
      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    test('ignores other key presses', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Tab' });
      
      expect(onToggleMock).not.toHaveBeenCalled();
    });
  });

  describe('Animation States', () => {
    test('applies opening animation class', async () => {
      const { rerender } = render(<UnifiedAccordion {...defaultProps} isOpen={false} />);
      
      rerender(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      await waitFor(() => {
        const content = screen.getByTestId('accordion-content').parentElement;
        expect(content).toHaveClass('accordion-opening');
      });
    });

    test('applies closing animation class', async () => {
      const { rerender } = render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      rerender(<UnifiedAccordion {...defaultProps} isOpen={false} />);
      
      await waitFor(() => {
        const content = screen.getByTestId('accordion-content').parentElement;
        expect(content).toHaveClass('accordion-closing');
      });
    });

    test('removes animation classes after transition', async () => {
      jest.useFakeTimers();
      
      const { rerender } = render(<UnifiedAccordion {...defaultProps} isOpen={false} />);
      
      rerender(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      // Fast-forward past animation duration
      act(() => {
        jest.advanceTimersByTime(300);
      });
      
      await waitFor(() => {
        const content = screen.getByTestId('accordion-content').parentElement;
        expect(content).not.toHaveClass('accordion-opening');
      });
      
      jest.useRealTimers();
    });
  });

  describe('Disabled State', () => {
    test('applies disabled styling when disabled', () => {
      render(<UnifiedAccordion {...defaultProps} disabled={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('accordion-disabled');
    });

    test('does not call onToggle when disabled', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} disabled={true} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onToggleMock).not.toHaveBeenCalled();
    });
  });

  describe('Styling Variants', () => {
    test('applies default styling', () => {
      render(<UnifiedAccordion {...defaultProps} />);
      
      const accordion = screen.getByText('Test Accordion').closest('.unified-accordion');
      expect(accordion).toHaveClass('accordion-default');
    });

    test('applies compact variant styling', () => {
      render(<UnifiedAccordion {...defaultProps} variant="compact" />);
      
      const accordion = screen.getByText('Test Accordion').closest('.unified-accordion');
      expect(accordion).toHaveClass('accordion-compact');
    });

    test('applies card variant styling', () => {
      render(<UnifiedAccordion {...defaultProps} variant="card" />);
      
      const accordion = screen.getByText('Test Accordion').closest('.unified-accordion');
      expect(accordion).toHaveClass('accordion-card');
    });
  });

  describe('Content Loading', () => {
    test('shows loading state when loading prop is true', () => {
      render(<UnifiedAccordion {...defaultProps} loading={true} isOpen={true} />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
    });

    test('shows content when loading is false', () => {
      render(<UnifiedAccordion {...defaultProps} loading={false} isOpen={true} />);
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('shows error state when error prop is provided', () => {
      const error = 'Something went wrong';
      render(<UnifiedAccordion {...defaultProps} error={error} isOpen={true} />);
      
      expect(screen.getByText(error)).toBeInTheDocument();
      expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
    });

    test('shows error with retry button when onRetry is provided', () => {
      const onRetryMock = jest.fn();
      render(
        <UnifiedAccordion 
          {...defaultProps} 
          error="Error occurred" 
          onRetry={onRetryMock}
          isOpen={true} 
        />
      );
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(onRetryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('has proper role and ARIA attributes', () => {
      render(<UnifiedAccordion {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded');
      expect(button).toHaveAttribute('aria-controls');
    });

    test('associates header with content via ARIA', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      const button = screen.getByRole('button');
      const contentId = button.getAttribute('aria-controls');
      const content = screen.getByTestId('accordion-content').parentElement;
      
      expect(content).toHaveAttribute('id', contentId);
    });

    test('supports keyboard navigation', () => {
      render(<UnifiedAccordion {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    test('announces state changes to screen readers', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true} />);
      
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('does not re-render content unnecessarily', () => {
      let renderCount = 0;
      const CountingContent = () => {
        renderCount++;
        return <div data-testid="counting-content">Render #{renderCount}</div>;
      };

      const { rerender } = render(
        <UnifiedAccordion {...defaultProps} isOpen={false}>
          <CountingContent />
        </UnifiedAccordion>
      );

      // Content should not render when closed
      expect(renderCount).toBe(0);

      rerender(
        <UnifiedAccordion {...defaultProps} isOpen={true}>
          <CountingContent />
        </UnifiedAccordion>
      );

      // Content should render when opened
      expect(renderCount).toBe(1);
    });

    test('handles rapid toggle operations', () => {
      const onToggleMock = jest.fn();
      render(<UnifiedAccordion {...defaultProps} onToggle={onToggleMock} />);
      
      const button = screen.getByRole('button');
      
      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button);
      }
      
      expect(onToggleMock).toHaveBeenCalledTimes(10);
    });
  });

  describe('Edge Cases', () => {
    test('handles null or undefined children gracefully', () => {
      render(<UnifiedAccordion {...defaultProps} isOpen={true}>{null}</UnifiedAccordion>);
      
      expect(screen.getByText('Test Accordion')).toBeInTheDocument();
    });

    test('handles empty string title', () => {
      render(<UnifiedAccordion {...defaultProps} title="" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    test('handles missing onToggle prop', () => {
      const { onToggle, ...propsWithoutToggle } = defaultProps;
      
      expect(() => {
        render(<UnifiedAccordion {...propsWithoutToggle} />);
      }).not.toThrow();
    });
  });
});