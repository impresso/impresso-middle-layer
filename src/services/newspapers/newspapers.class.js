const FusionService = require('../fusion.service').Service;

class Service extends FusionService{

}

module.exports = function(options) {
  return new Service(options);
};
module.exports.Service = Service;
