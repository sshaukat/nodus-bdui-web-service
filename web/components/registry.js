(function initNodusComponents(global) {
  const registry = new Map();

  function register(type, component) {
    registry.set(type, component);
  }

  function get(type) {
    return registry.get(type) || null;
  }

  function has(type) {
    return registry.has(type);
  }

  global.NodusComponents = {
    register,
    get,
    has,
  };
})(window);
