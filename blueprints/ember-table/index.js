module.exports = {
  normalizeEntityName: function() {},

  afterInstall: function() {
    return this.addBowerPackageToProject('antiscroll').then( function() {
      return this.addBowerPackageToProject('jquery-mousewheel');
    }).then( function() {
      return this.addBowerPackageToProject('jquery-ui');
    });
  }
};
