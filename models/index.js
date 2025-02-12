const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs')


// Configuracao do log
const logFilePath = path.join(__dirname, '../logs/sequelize.log')

const logDir = path.dirname(logFilePath)
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logToFile = (msg) => {
  const timestamp = new Date().toISOString()
  fs.appendFileSync(logFilePath, `[${timestamp}] ${msg}\n`)
}

// Configuração do Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: logToFile // Registrar logs no arquivo
})


const User = require('./User')(sequelize);
const Section = require('./Section')(sequelize);
const Product = require('./Product')(sequelize);

// Definir relacionamentos
User.hasMany(Section, {
  foreignKey: 'UserId',
  onDelete: 'CASCADE'
});

Section.belongsTo(User, {
  foreignKey: 'UserId'
});

Section.hasMany(Product, {
  foreignKey: 'SectionId',
  onDelete: 'CASCADE'
});

Product.belongsTo(Section, {
  foreignKey: 'SectionId'
});

module.exports = {
  sequelize,
  User,
  Section,
  Product
};