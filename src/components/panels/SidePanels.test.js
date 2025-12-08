import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ControlPanel from './ControlPanel';
import InspectorPanel from './InspectorPanel';
import { PanelTab } from '../../types/ui-types';

describe('Side Panels Verification', () => {
    test('ControlPanel renders Project tab correctly', () => {
        const onClose = jest.fn();
        render(<ControlPanel activeTab={PanelTab.PROJECT} onClose={onClose} />);

        expect(screen.getByText('Site Map Controls')).toBeInTheDocument();
        expect(screen.getByText('Site Map (On Ground)')).toBeInTheDocument();
        expect(screen.getByText('Upload Site Map')).toBeInTheDocument();
        expect(screen.getByText('Reference Point')).toBeInTheDocument();
        expect(screen.getByText('Recent Projects')).toBeInTheDocument();
    });

    test('ControlPanel renders Layers tab correctly', () => {
        const onClose = jest.fn();
        render(<ControlPanel activeTab={PanelTab.LAYERS} onClose={onClose} />);

        expect(screen.getByText('Layer Manager')).toBeInTheDocument();
        expect(screen.getByText('Topography')).toBeInTheDocument();
        expect(screen.getByText('Boreholes')).toBeInTheDocument();
    });

    test('InspectorPanel renders correctly and toggles sections', () => {
        const onClose = jest.fn();
        render(<InspectorPanel onClose={onClose} />);

        expect(screen.getByText('Inspector')).toBeInTheDocument();
        expect(screen.getByText('Geological Modeling')).toBeInTheDocument();

        // Check if Modeling section content is visible (it defaults to true)
        expect(screen.getByText('Engine Mode')).toBeInTheDocument();

        // Toggle Legend section (defaults to true)
        const legendHeader = screen.getByText('Legend');
        fireEvent.click(legendHeader);

        // Toggle Export section (defaults to false)
        const exportHeader = screen.getByText('Export Scene');
        fireEvent.click(exportHeader);
        expect(screen.getByText('Export as OBJ')).toBeInTheDocument();
    });
});
