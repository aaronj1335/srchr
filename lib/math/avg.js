module.exports = function(array) {
  return array.reduce(function(sum, x) {
    return sum + x;
  }, 0) / array.length;
};
