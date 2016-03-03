module.exports = {
  normalizeEntityName: function() {},

  afterInstall: function() {
    return this.addBowerPackageToProject('antiscroll', 'Addepar/antiscroll#e0d1538cf4f3fd61c5bedd6168df86d651f125da').then( function() {
      return this.addBowerPackageToProject('jquery-mousewheel', '~3.1.4');
    }).then( function() {
      return this.addBowerPackageToProject('jquery-ui', '~1.11.4');
    });
  }
};
