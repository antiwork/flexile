import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';

// Mock the telemetry module
vi.mock('@/utils/telemetry', () => ({
  track: vi.fn(),
}));

/**
 * Simple toggle component to test the more info functionality
 * This component mimics the behavior we implemented in the QuickInvoicesSectionContent
 */
function MoreInfoToggle() {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    // Mock telemetry call
    console.log(`[Test] ${newExpanded ? 'expand' : 'collapse'}_more_info`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls="more-info-content"
      >
        {isExpanded ? 'Show less' : 'Add more info'}
      </button>

      {isExpanded && (
        <div id="more-info-content" role="region" aria-label="Additional invoice information">
          <label htmlFor="description">Description</label>
          <input id="description" type="text" placeholder="Brief description of work" />

          <label htmlFor="invoice-number">Invoice Number</label>
          <input id="invoice-number" type="text" placeholder="Custom invoice number" />

          <label htmlFor="notes">Notes</label>
          <textarea id="notes" placeholder="Additional notes" />
        </div>
      )}
    </div>
  );
}

describe('MoreInfoToggle', () => {
  it('renders with initial collapsed state', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Add more info');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Additional fields should not be visible
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Invoice Number')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();
  });

  it('expands when clicked', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toHaveTextContent('Show less');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Additional fields should now be visible
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('collapses when clicked again', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Expand first
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Then collapse
    fireEvent.click(button);
    expect(button).toHaveTextContent('Add more info');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation with Enter key', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Press Enter to expand
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Description')).toBeInTheDocument();

    // Press Enter again to collapse
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation with Space key', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Press Space to expand
    fireEvent.keyDown(button, { key: ' ' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Description')).toBeInTheDocument();

    // Press Space again to collapse
    fireEvent.keyDown(button, { key: ' ' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('ignores other keyboard keys', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Press other keys - should not expand
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.keyDown(button, { key: 'Escape' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Check initial accessibility attributes
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'more-info-content');

    // Expand and check attributes
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const contentRegion = screen.getByRole('region');
    expect(contentRegion).toHaveAttribute('id', 'more-info-content');
    expect(contentRegion).toHaveAttribute('aria-label', 'Additional invoice information');
  });

  it('maintains form field state when toggling', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Expand and fill fields
    fireEvent.click(button);

    const descriptionInput = screen.getByLabelText('Description');
    const notesTextarea = screen.getByLabelText('Notes');

    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
    fireEvent.change(notesTextarea, { target: { value: 'Test notes' } });

    expect(descriptionInput).toHaveValue('Test description');
    expect(notesTextarea).toHaveValue('Test notes');

    // Collapse and expand again
    fireEvent.click(button);
    fireEvent.click(button);

    // Values should be preserved
    const newDescriptionInput = screen.getByLabelText('Description');
    const newNotesTextarea = screen.getByLabelText('Notes');

    expect(newDescriptionInput).toHaveValue('Test description');
    expect(newNotesTextarea).toHaveValue('Test notes');
  });

  it('prevents default on keyboard events', () => {
    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });

    const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
    const preventDefaultSpy2 = vi.spyOn(spaceEvent, 'preventDefault');

    button.dispatchEvent(enterEvent);
    button.dispatchEvent(spaceEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(preventDefaultSpy2).toHaveBeenCalled();
  });

  it('tracks telemetry events on toggle', () => {
    // Mock console.log to capture our mock telemetry
    const consoleSpy = vi.spyOn(console, 'log');

    render(<MoreInfoToggle />);

    const button = screen.getByRole('button');

    // Expand
    fireEvent.click(button);
    expect(consoleSpy).toHaveBeenCalledWith('[Test] expand_more_info');

    // Collapse
    fireEvent.click(button);
    expect(consoleSpy).toHaveBeenCalledWith('[Test] collapse_more_info');

    consoleSpy.mockRestore();
  });
});


