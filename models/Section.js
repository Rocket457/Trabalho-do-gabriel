const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Section', {
    name: DataTypes.STRING
  });
};