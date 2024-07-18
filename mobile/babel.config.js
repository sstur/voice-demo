/**
 * @param {import('@babel/core').ConfigAPI} api
 * @returns {import('@babel/core').TransformOptions}
 */
module.exports = (api) => {
  api.cache.forever();
  return {
    presets: ['babel-preset-expo'],
  };
};
