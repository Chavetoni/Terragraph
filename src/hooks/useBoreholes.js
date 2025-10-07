// src/hooks/useBoreholes.js
import { useState, useCallback, useRef, useContext } from 'react';
import { ThreeJsContext } from '../contexts/ThreeJsContext';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';

export const useBoreholes = () => {
  const [boreholes, setBoreholes] = useState([]);
  const [isPlacingBorehole, setIsPlacingBorehole] = useState(false);
  const raycasterRef = useRef(new Raycaster());
  const { sceneManager, camera, scene } = useContext(ThreeJsContext);
  

  const addBorehole = useCallback((x, y, z, name) => {
    const boreholeId = Date.now();
    const newBorehole = {
      id: boreholeId,
      name: name || `BH-${boreholes.length + 1}`,
      x: parseFloat(parseFloat(x).toFixed(2)),
      y: parseFloat(parseFloat(y).toFixed(2)),
      z: parseFloat(parseFloat(z).toFixed(2))
    };

    setBoreholes(prev => [...prev, newBorehole]);
    return newBorehole;
  }, [boreholes.length]);

  const removeBorehole = useCallback((idToRemove) => {
    setBoreholes(prev => prev.filter(bh => bh.id !== idToRemove));
  }, []);

  const handleCanvasClick = useCallback((event, canvasElement) => {
    if (!isPlacingBorehole || !canvasElement || !sceneManager) {
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const mouse = new Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouse, camera);

    let intersects = [];
    const potentialTargets = [];

    // Get the site map object from the scene manager
    const siteMap = sceneManager?.get('siteMap');
    if (siteMap && siteMap.visible) {
      potentialTargets.push(siteMap);
    }

    // Try to find the ground grid in the scene
    if (scene) {
      const groundGrid = scene.children.find(child => child.type === 'GridHelper');
      if (groundGrid && groundGrid.visible) {
        potentialTargets.push(groundGrid);
      }
    }

    if (potentialTargets.length > 0) {
      intersects = raycasterRef.current.intersectObjects(potentialTargets, true);
    }

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      const name = prompt("Enter Borehole Name/ID:", `BH-${boreholes.length + 1}`);
      
      if (name) {
        addBorehole(
          intersectionPoint.x,
          intersectionPoint.y,
          intersectionPoint.z,
          name
        );
      }
    } else {
      // Try Y=0 plane as fallback
      const plane = new Plane(new Vector3(0, 1, 0), 0);
      const intersectionPoint = new Vector3();
      
      if (raycasterRef.current.ray.intersectPlane(plane, intersectionPoint)) {
        const name = prompt("Enter Borehole Name/ID (placed on Y=0 plane):", `BH-${boreholes.length + 1}`);
        
        if (name) {
          addBorehole(intersectionPoint.x, 0, intersectionPoint.z, name);
        }
      }
    }
    
    setIsPlacingBorehole(false);
  }, [isPlacingBorehole, boreholes.length, addBorehole, sceneManager, camera, scene]);

  return {
    boreholes,
    isPlacingBorehole,
    setIsPlacingBorehole,
    addBorehole,
    removeBorehole,
    handleCanvasClick
  };
};

export default useBoreholes;