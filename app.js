const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');

const { sequelize, User, Section, Product } = require('./models');
const SequelizeStore = require('connect-session-sequelize')(session.Store);


const app = express();
const upload = multer({ dest: 'public/uploads/' });

// Relacionamentos
User.hasMany(Section, { foreignKey: 'UserId' });
Section.belongsTo(User, { foreignKey: 'UserId' });
Section.hasMany(Product, { foreignKey: 'SectionId' });
Product.belongsTo(Section, { foreignKey: 'SectionId' });


// Sessão
app.use(session({
  secret: 'secret-key',
  store: new SequelizeStore({ db: sequelize }),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // Token fica valido por 1 dia nesse formato
  }
}));


// Handlebars
app.engine('hbs', exphbs.engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  helpers: {
    chunkArray: function (array, size) {
      if (!Array.isArray(array)) return []
      const results = []
      for (let i = 0; i < array.length; i += size) {
        results.push(array.slice(i, i + size))
      }
      return results
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));



// Middlewares
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));


// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (!req.session.userId && req.path !== '/login') {
    return res.redirect('/login');
  }
  next();
};



// ###Rotas

// rota padrão que se o usuario não estiver logado ele vai para o login senão vai para a home
app.get('/', requireAuth, async (req, res) => {
  try {
    const sections = await Section.findAll({
      include: Product,
      where: { UserId: req.session.userId }
    });

    res.render('home', {
      user: req.session.user,
      sections: sections.map(section => section.toJSON())
    });
  } catch (error) {
    console.error('Erro na rota principal:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.body.username } });
    
    if (user && await bcrypt.compare(req.body.password, user.password)) {
      req.session.userId = user.id;
      req.session.user = user.toJSON();
      return res.redirect('/dashboard');
    }
    
    res.render('login', { error: 'Credenciais inválidas' });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

app.post('/register', async (req, res) => {
  try {
    const { username, password, restaurantName, logo } = req.body;

    // Verifica se o usuário já existe
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.render('createUser', { error: 'Usuário já existe' });
    }

    // Cria o hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o novo usuário
    await User.create({
      username,
      password: hashedPassword
    });

    const user = await User.findOne({ where: { username: req.body.username } });
    
    if (user && await bcrypt.compare(req.body.password, user.password)) {

      req.session.userId = user.id;
      req.session.user = user.toJSON();
      return res.redirect('/dashboard');

    } else {

      res.render('createUser', { error: 'Credenciais inválidas' });

    }
   
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Dashboard para controle para o usuario colocar foto criar seções e produtos

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      include: [Section]
    });

    res.render('dashboard', {
      user: user.toJSON(),
      sections: user.Sections.map(section => section.toJSON())
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).send('Erro interno do servidor');
  }
});


//rota para trocar a logo do restaurante
app.post('/update-restaurant', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    const updateData = {
      restaurantName: req.body.restaurantName
    };

    if (req.file) {
      updateData.logo = `/uploads/${req.file.filename}`;
    }

    await User.update(updateData, {
      where: { id: req.session.userId }
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro ao atualizar restaurante:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Rotas para Seções
app.post('/sections', requireAuth, async (req, res) => {
  try {
    await Section.create({
      name: req.body.name,
      UserId: req.session.userId
    });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro ao criar seção:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Rotas para Produtos
app.post('/products', requireAuth, upload.single('image'), async (req, res) => {
  try {
    await Product.create({
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image: `/uploads/${req.file.filename}`,
      SectionId: req.body.sectionId,
      UserId: req.session.userId
    });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Erro ao fazer logout:', err);
    res.redirect('/login');
  });
});

// Inicialização
sequelize.sync({ force: false }).then(() => {
  app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
    console.log('Acesse: http://localhost:3000');
  });
});