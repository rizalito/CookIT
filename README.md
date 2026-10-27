# CookIT

A small recipe website with a shared HTML, CSS, and JavaScript frontend and a local Node.js/SQLite backend. It has a home page, recipe directory, recipe instructions, saved favorites, About, and Contact pages.

## Files

- `index.html`: home page
- `login.html`: sign-in and demo-profile creation screen
- `recipes.html`: searchable, sortable recipe directory
- `recipe.html`: recipe instructions, ingredient checklist, servings adjustment, and step navigation
- `favorites.html`: recipes saved to the signed-in user's local database
- `categories.html`: browse recipes by meal
- `tutorials.html`: beginner cooking notes
- `about.html` and `contact.html`: information and contact demo pages
- `404.html`: simple not-found page
- `css/style.css`: shared styling and responsive layouts
- `js/recipes.js`: structured recipe catalog
- `js/site.js`: shared page behavior, including the home page and recipe browsing
- `js/auth.js`: sign-in and account creation
- `data/cookit.sqlite`: local account, session, and favorites database (created automatically)

## Run

Use Node.js 22.13 or newer, then run `npm start` from this folder and open `http://127.0.0.1:4173`. Do not open the HTML files with `file://`; the API requires the backend server.

The backend creates `data/cookit.sqlite` on first start. Accounts, sessions, and favorites are stored in SQLite. Passwords are hashed on the server with scrypt, and sessions use HTTP-only cookies. The app is intended for local development; deploy behind HTTPS and add production-grade rate limiting and operational controls before exposing it publicly. Recipe photos need an internet connection. The contact form is still a front-end demo and does not send messages.

## Share on GitHub

`CookIT.zip` contains the project source and documentation, but not the local SQLite database or account data. Extract it, then upload the files inside the `CookIT` folder to a GitHub repository. The app creates a fresh `data/cookit.sqlite` database when it starts.

To run it on another PC, open the extracted `CookIT` folder in Visual Studio Code, install Node.js 22.13 or newer if needed, then run `npm start` in the VS Code terminal and open `http://127.0.0.1:4173`. Create a new account on that PC. Recipe photos need an internet connection.