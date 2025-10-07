// src/services/SceneOperation.js
import { validationLogger } from '../utils/Logger.js';

export class SceneOperation {
  constructor(type, data = {}) {
    this.type = type;
    this.data = data;
  }

  execute(sceneManager) {
    if (!sceneManager) {
      throw new Error('SceneManager is required to execute operations');
    }

    switch (this.type) {
      case 'CREATE_GROUND_GRID':

        sceneManager.createGroundGrid(this.data.show);
        break;
        
      case 'CREATE_SOIL_LAYERS':
        sceneManager.createSoilLayers(this.data.layers, this.data.options);
        break;
        
      case 'CREATE_BOREHOLE_MARKERS':
        sceneManager.createBoreholeMarkers(this.data.boreholes);
        break;
        
      case 'LOAD_SITE_MAP':
        sceneManager.loadSiteMap(
          this.data.fileContent,
          this.data.onSuccess,
          this.data.onError
        );
        break;
        
      case 'UPDATE_SITE_MAP_PROPS':
        sceneManager.updateSiteMapProps(this.data.props);
        break;
        
      default:
        validationLogger.warn(`Unknown operation type: ${this.type}`);
    }
  }
}

export default SceneOperation;