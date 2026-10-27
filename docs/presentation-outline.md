# CookIT Presentation Outline

**Suggested length:** 5–7 minutes  
**Presenter:** [Your name]  
**Class:** [Course or class]

## Slide 1 — CookIT

**On the slide**
- CookIT Recipe Website
- Simple recipes and guided cooking
- [Your name] · [Class] · [Date]

**Speaker notes**  
Introduce CookIT as a recipe website designed to make everyday cooking easier to follow.

## Slide 2 — The Need

**On the slide**
- Finding a recipe can take time.
- New cooks may need clearer instructions.
- Ingredients and saved recipes are easy to lose track of.

**Speaker notes**  
Explain that CookIT brings recipe discovery, instructions, and favorites into one website. These are the project goals, not results of a formal user survey.

## Slide 3 — Project Goals

**On the slide**
- Search by recipe or ingredient.
- Browse by meal category.
- Follow a recipe step by step.
- Save favorites to an account.
- Work on desktop and mobile.

**Speaker notes**  
Connect the goals to the features shown in the demo.

## Slide 4 — Main Pages

**On the slide**
- Home and recipe search
- Recipe directory and categories
- Recipe instructions and ingredient list
- Favorites
- Login and account creation
- Beginner tips, About, and Contact

**Speaker notes**  
Briefly show how a user moves from browsing to opening and cooking a recipe.

## Slide 5 — Recipe Experience

**On the slide**
- Eight sample recipes
- Prep/cook time and difficulty
- Tools and ingredients
- Serving-size adjustment
- Ingredient checklist
- Previous/next cooking steps

**Speaker notes**  
Open a recipe and demonstrate one serving adjustment and one step change. The catalog is currently stored in `js/recipes.js`.

## Slide 6 — How the System Works

**On the slide**

```text
Browser pages (HTML/CSS/JavaScript)
              ↓ HTTP API
         Node.js server
              ↓ SQL
           SQLite
```

- Frontend: pages, layout, forms, and interactions
- Backend: account/session/favorites API
- Database: persistent user-related records

**Speaker notes**  
Explain that the browser does not connect directly to SQLite. It sends requests to the Node.js server, which validates them and reads or writes the database.

## Slide 7 — Database and Login

**On the slide**
- `users`: usernames, emails, and password hashes
- `sessions`: hashed session tokens and expiry times
- `favorites`: saved recipe IDs per user
- Passwords are salted and hashed by the server.
- Sessions use HTTP-only cookies.

**Speaker notes**  
The password itself is not stored in plaintext. Explain that this project is for local development and still needs production security work before public deployment.

## Slide 8 — Technology

**On the slide**
- HTML and CSS
- Browser JavaScript
- Node.js 24
- Built-in SQLite support
- No separate database server required

**Speaker notes**  
Mention that the database file is created automatically at `data/cookit.sqlite` the first time the server starts.

## Slide 9 — Demo and Testing

**On the slide**
- Create account, then sign in
- Search and filter recipes
- Open a recipe and adjust servings
- Save a favorite
- Sign out and verify protected pages

**Speaker notes**  
Walk through the main user journey. The checked flows include registration validation, wrong-password rejection, session handling, favorites, category search, and mobile layout.

## Slide 10 — Limits and Next Steps

**On the slide**
- Recipe catalog is currently a JavaScript data file.
- Contact form is a front-end demonstration.
- No password reset or email verification yet.
- Production deployment needs HTTPS and security hardening.

**Speaker notes**  
Describe realistic improvements: put recipes in SQLite, connect the contact form to a service, add account recovery, and review the server before public hosting.

## Slide 11 — Closing

**On the slide**
- CookIT makes recipe steps easier to follow.
- Thank you
- Questions?

**Speaker notes**  
Summarize the combination of an approachable recipe frontend and a small Node.js/SQLite backend, then invite questions.