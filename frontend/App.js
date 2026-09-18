import LiveApp from './LiveApp';
import PrototypeApp from './prototype/App';

// Opt in explicitly; the API-backed application remains the default.
export default process.env.EXPO_PUBLIC_PROTOTYPE_MODE === 'true'
  ? PrototypeApp
  : LiveApp;
