# Terragraph

3D geological modeling application for visualizing subsurface borehole data.

## Requirements

**Software:**
- Node.js 16+ (you have v22.17.0 ✓)
- npm 8+ (you have v10.9.2 ✓)

**Browser:**
- Chrome, Firefox, Safari, or Edge (latest version)
- WebGL support required (most modern browsers have this)

**System:**
- 4GB RAM minimum (8GB recommended for large datasets)
- Graphics card with WebGL 2.0 support

## Installation

```bash
# Install dependencies
npm install
```

## Running the App

**Development mode** (with hot reload):
```bash
npm start
```
Opens at http://localhost:3000

**Production build:**
```bash
npm run build
```
Creates optimized build in `build/` folder

**Run tests:**
```bash
npm test
```

## What This Does

This application lets you:
- Import borehole drilling data (soil layers, depths, materials)
- Visualize geological strata in 3D using Three.js
- Apply USCS (Unified Soil Classification System) material textures
- Interpolate surfaces between boreholes using IDW or Kriging
- Export 3D models for BIM software (Revit, IFC)

## Project Structure

```
src/
├── components/     # React UI components
├── contexts/       # State management (12 providers)
├── services/       # Three.js rendering & geological algorithms
├── utils/          # Helpers and utilities
└── validation/     # Data validation
```

## Tech Stack

- React 19
- Three.js 0.174
- Custom webpack config via CRACO
- Jest for testing

## Common Issues

**"WebGL not supported" error:**
- Update your graphics drivers
- Try a different browser
- Enable hardware acceleration in browser settings

**App runs slowly:**
- Reduce grid resolution in modeling settings
- Disable textures in display options
- Close other GPU-intensive applications

**Tests fail on import:**
- Check that `node_modules` is installed: `npm install`
- Clear Jest cache: `npm test -- --clearCache`


