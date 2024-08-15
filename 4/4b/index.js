const express = require("express");
const path = require("path");
const { Sequelize, QueryTypes } = require("sequelize");
const config = require("./config/config.json");
const sequelize = new Sequelize(config.development);
const bcrypt = require("bcrypt");
const flash = require("express-flash");
const session = require("express-session");

const app = express();

const port = 4002;

let data = [];

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "/assets/views"));

app.use("/assets", express.static(path.join(__dirname, "/assets")));
app.use("/uploads", express.static(path.join(__dirname, "assets/uploads")));

app.use(express.urlencoded({ extended: false }));

// Session
app.use(
  session({
    name: "admin",
    secret: "ngr261027",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.isLogin = req.session.isLogin || false;
  res.locals.user = req.session.user || {};
  next();
});

function auth(req, res, next) {
  console.log("Auth middleware:", req.session.isLogin);
  if (req.session.isLogin) {
    return next();
  }
  req.flash("danger", "You must be logged in to view this page.");
  res.redirect("/login");
}

// Routing

// Home
app.get("/", home);

// Collections
app.get("/collections", auth, collections);
app.get("/add-collections", auth, addCollectionsView);

app.post("/add-collections", auth, addCollections);
app.post("/delete-collections/:id", auth, deleteCollection);

// Collections detail
app.get("/collections-details/:id", auth, collectionDetailsView);
app.get("/collections-details/add-task/:id", auth, addTaskView);

app.post("/collections-details/add-task/:id", auth, addTask);
app.post("/task-delete/:id", deleteTask);
app.post("/update-task/:id", updateTask);

// Login/Register
app.get("/login", loginView);
app.get("/register", registerView);
app.get("/logout", auth, logout);

app.post("/register", register);
app.post("/login", login);

// Home
function home(req, res) {
  res.render("index");
}

// Collections
async function collections(req, res) {
  try {
    const user_id = req.session.user.id;

    const query = `SELECT * FROM "collections" WHERE user_id=${user_id}`;
    const collections = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    const collectionsWithTasks = await Promise.all(
      collections.map(async (collection) => {
        const tasksQuery = `SELECT * FROM "tasks" WHERE collections_id=${collection.id}`;
        const tasks = await sequelize.query(tasksQuery, {
          type: QueryTypes.SELECT,
        });

        const completedTasks = tasks.filter((task) => task.is_done).length;

        return {
          ...collection,
          tasks,
          completedTasks,
        };
      })
    );

    res.render("collections", {
      collections: collectionsWithTasks,
    });
  } catch (err) {
    console.log(err);
  }
}

function addCollectionsView(req, res) {
  res.render("add-collections");
}

async function addCollections(req, res) {
  try {
    const { collectionname } = req.body;
    const user_id = req.session.user.id;

    if (collectionname === "") {
      req.flash("danger", "Please input collection name !!!");
      return res.redirect("add-collections");
    }

    const query = `INSERT INTO "collections" (user_id, collections) VALUES (${user_id}, '${collectionname}')`; //Adding data to database with fetching id of logged in user

    const addcollection = await sequelize.query(query, {
      type: QueryTypes.INSERT,
    });

    console.log(addcollection);

    res.redirect("/collections");
  } catch (err) {
    console.log(err);
  }
}

async function deleteCollection(req, res) {
  try {
    const collectionID = parseInt(req.params.id, 10);

    const deleteQuery = `DELETE FROM "collections" WHERE id=${collectionID}`;
    await sequelize.query(deleteQuery, { type: QueryTypes.DELETE });

    req.flash("success", "Collection deleted successfully.");
    res.redirect("/collections");
  } catch (err) {
    console.log(err);
    req.flash("danger", "Failed to delete the collection.");
    res.redirect("back");
  }
}

//Collections Detail
async function collectionDetailsView(req, res) {
  try {
    const collectionsID = parseInt(req.params.id, 10);

    const query = `SELECT collections.id, collections.collections, users.username
    FROM "collections"
    JOIN users ON collections.user_id=users.id
    WHERE collections.id=${collectionsID}`;

    const query2 = `SELECT * FROM tasks WHERE collections_id=${collectionsID}`;

    const collectionsDetail = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });
    console.log(collectionsDetail);

    if (!collectionsDetail.length) {
      console.log("Collections not found");
      return res.redirect("/collections");
    }

    const tasks = await sequelize.query(query2, { type: QueryTypes.SELECT });

    const completedTasks = tasks.filter((task) => task.is_done).length;

    console.log(tasks);

    res.render("collections-details", {
      collection: collectionsDetail[0],
      tasks,
      completedTasks,
    });
  } catch (err) {
    console.log(err);
  }
}

function addTaskView(req, res) {
  const collectionID = req.params.id;
  console.log("Collection ID = ", collectionID);

  res.render("add-task", { collectionID });
}

async function addTask(req, res) {
  try {
    const { tasksname, collection_id } = req.body;

    if (tasksname === "") {
      req.flash("danger", "Please input task name !!!");
      return res.redirect("back");
    }

    console.log("Collection ID from body: ", collection_id);

    const is_done = false;
    const query = `INSERT INTO "tasks" (collections_id, tasksname, is_done) VALUES (${collection_id}, '${tasksname}', ${is_done})`;

    const addtask = await sequelize.query(query, { type: QueryTypes.INSERT });

    console.log(addtask);

    res.redirect(`/collections-details/${collection_id}`);
  } catch (err) {
    console.log(err);
  }
}

async function deleteTask(req, res) {
  try {
    const taskID = parseInt(req.params.id, 10);

    const getCollectionIDQuery = `SELECT collections_id FROM "tasks" WHERE id=${taskID}`;
    const result = await sequelize.query(getCollectionIDQuery, {
      type: QueryTypes.SELECT,
    });

    if (!result.length) {
      req.flash("danger", "Task not found.");
      return res.redirect("/collections");
    }

    const collectionID = result[0].collections_id;

    const deleteQuery = `DELETE FROM "tasks" WHERE id=${taskID}`;
    await sequelize.query(deleteQuery, { type: QueryTypes.DELETE });

    req.flash("success", "Task deleted successfully.");
    res.redirect(`/collections-details/${collectionID}`);
  } catch (err) {
    console.log(err);
    req.flash("danger", "Failed to delete the task.");
    res.redirect("back");
  }
}

async function updateTask(req, res) {
  try {
    const taskID = parseInt(req.params.id, 10);
    const { is_done } = req.body;

    const query = `SELECT collections_id FROM "tasks" WHERE id=${taskID}`;
    const result = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    if (!result.length) {
      req.flash("danger", "Task not found.");
      return res.redirect("/collections");
    }

    const collectionID = result[0].collections_id;

    const updateQuery = `UPDATE "tasks" SET is_done=${
      is_done === "on"
    } WHERE id=${taskID}`;
    await sequelize.query(updateQuery, { type: QueryTypes.UPDATE });

    req.flash("success", "Task updated successfully.");
    res.redirect(`/collections-details/${collectionID}`);
  } catch (err) {
    console.log(err);
    req.flash("danger", "Failed to update the task.");
    res.redirect("back");
  }
}

// Login/Register

function loginView(req, res) {
  res.render("login");
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const query = `SELECT * FROM "users" WHERE email='${email}'`;
    const obj = await sequelize.query(query, { type: QueryTypes.SELECT });

    if (!obj.length) {
      req.flash("danger", "Login Failed: Email is wrong!");
      return res.redirect("/login");
    }

    bcrypt.compare(password, obj[0].password, (err, result) => {
      if (err) {
        req.flash("danger", "Login Failed: Internal Server Error");
        return res.redirect("/login");
      }

      if (result) {
        req.session.isLogin = true;
        req.session.user = {
          id: obj[0].id,
          username: obj[0].username,
          email: obj[0].email,
        };
        req.session.save(() => {
          req.flash("success", "Login Successful!");
          res.redirect("/");
        });
      } else {
        req.flash("danger", "Login Failed: Password is wrong!");
        res.redirect("/login");
      }
    });
  } catch (err) {
    console.log(err);
  }
}

function registerView(req, res) {
  res.render("register");
}

async function register(req, res) {
  const { username, email, password } = req.body;

  if (username === "") {
    req.flash("danger", "Please input username !!!");
    return res.redirect("/register");
  } else if (email === "") {
    req.flash("danger", "Please input username !!!");
    return res.redirect("/register");
  } else if (password === "") {
    req.flash("danger", "Please input username !!!");
    return res.redirect("/register");
  }

  const query1 = `SELECT * FROM "users" WHERE email='${email}'`;
  const userExists = await sequelize.query(query1, {
    type: QueryTypes.SELECT,
  });

  console.log(userExists);

  if (userExists.length > 0) {
    req.flash("danger", "Sorry, your account already exists");
    return res.redirect("/register");
  }
  const crypt = 10;

  bcrypt.hash(password, crypt, async (err, hash) => {
    if (err) {
      console.error("Error hashing password:", err);
      req.flash("danger", "Register Failed!");
      return res.redirect("/register");
    }

    const query = `INSERT INTO "users" (username, email, password) VALUES ('${username}', '${email}', '${hash}')`;

    try {
      await sequelize.query(query, { type: QueryTypes.INSERT });
      req.flash("success", "Register Successful!");
      res.redirect("/login");
    } catch (error) {
      console.error("Error registering user:", error);
      if (!res.headersSent) {
        req.flash("danger", "Register Failed!");
        res.redirect("/register");
      }
    }
  });
}

async function logout(req, res) {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
        req.flash("danger", "Error logging out.");
        return res.redirect("/");
      }
      res.redirect("/");
    });
  } catch (err) {
    console.log("Error in logout function:", err);
    req.flash("danger", "Error logging out.");
    res.redirect("/");
  }
}

app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});
