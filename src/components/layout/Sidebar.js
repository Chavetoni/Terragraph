import { useUI } from '../../contexts/UIContext';
import { FolderIcon, LayersIcon, PinIcon, EyeIcon } from '../ui/Icons';

const Sidebar = ({ className = '' }) => {
    const { activePanel, togglePanel } = useUI();

    // Navigation items matching original panel structure
    const navItems = [
        { id: 'sitemap', icon: <FolderIcon />, label: 'Map Uploader' },
        { id: 'layers', icon: <LayersIcon />, label: 'Layer Manager' },
        { id: 'boreholes', icon: <PinIcon />, label: 'Borehole Markers' },
        { id: 'display', icon: <EyeIcon />, label: 'Display Options' },
    ];

    return (
        <aside className={`sidebar-rail ${className}`}>
            <div className="sidebar-logo">
                {/* Logo placeholder or SVG */}
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activePanel === item.id ? 'active' : ''}`}
                        onClick={() => togglePanel(item.id)}
                        title={item.label}
                        aria-label={item.label}
                        aria-pressed={activePanel === item.id}
                    >
                        {activePanel === item.id && <div className="active-indicator" />}
                        <span className="nav-icon">{item.icon}</span>
                    </button>
                ))}
            </nav>

            <style jsx>{`
                .sidebar-rail {
                    width: var(--sidebar-width);
                    background: var(--sidebar-bg);
                    border-right: 1px solid var(--sidebar-border);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 16px 0;
                    height: 100%;
                    z-index: 50;
                }
                
                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    width: 100%;
                    align-items: center;
                    margin-top: 20px;
                }
                
                .nav-item {
                    position: relative;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .nav-item:hover {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.05);
                }
                
                .nav-item.active {
                    color: var(--accent-primary);
                    background: var(--active-item-bg);
                }
                
                .active-indicator {
                    position: absolute;
                    left: -12px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 20px;
                    background: var(--accent-primary);
                    border-radius: 0 4px 4px 0;
                    box-shadow: 0 0 8px var(--accent-glow);
                }
                
            `}</style>
        </aside>
    );
};

export default Sidebar;