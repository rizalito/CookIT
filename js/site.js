(async () => {
  const page = document.body.dataset.page;
  let favoriteIds = [];
  if (page !== "login") {
    try {
      const sessionResponse = await fetch("/api/me", {
        credentials: "same-origin",
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok || !sessionData.user?.id)
        throw new Error("Sign in required.");
      const favoritesResponse = await fetch("/api/favorites", {
        credentials: "same-origin",
      });
      if (!favoritesResponse.ok) throw new Error("Could not load favorites.");
      favoriteIds = (await favoritesResponse.json()).favorites;
    } catch {
      window.location.replace("login.html");
      return;
    }
  }

  const recipes = window.COOKIT_RECIPES || [];
  const themeKey = "cookit-theme";
  const categories = [
    "All recipes",
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snacks",
    "Desserts",
  ];
  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const readFavorites = () => favoriteIds;
  const readTheme = () => {
    try {
      return localStorage.getItem(themeKey) || "light";
    } catch {
      return "light";
    }
  };
  function applyTheme(theme) {
    document.documentElement.dataset.theme =
      theme === "night" ? "night" : "light";
    const button = document.querySelector("[data-theme-toggle]");
    if (button) {
      button.textContent = theme === "night" ? "☀" : "☾";
      button.setAttribute(
        "aria-label",
        theme === "night" ? "Switch to light theme" : "Switch to night theme",
      );
    }
  }
  function card(recipe, favorites) {
    const saved = favorites.includes(recipe.id);
    return `<article class="recipe-card"><div class="recipe-image"><img src="${recipe.image}" alt="${escapeHTML(recipe.name)}" loading="lazy"><button class="favorite-button ${saved ? "saved" : ""}" data-favorite="${recipe.id}" aria-label="${saved ? "Remove from" : "Add to"} favorites" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button></div><div class="recipe-copy"><div class="recipe-meta"><span>${escapeHTML(recipe.category)}</span><span>★ ${recipe.rating.toFixed(1)}</span></div><h2>${escapeHTML(recipe.name)}</h2><p>${escapeHTML(recipe.description)}</p><div class="recipe-foot"><span>${recipe.prep + recipe.cook} min · ${escapeHTML(recipe.difficulty)}</span><a class="text-link" href="recipe.html?id=${encodeURIComponent(recipe.id)}">View recipe →</a></div></div></article>`;
  }
  async function toggleFavorite(button, recipeId, onSaved) {
    button.disabled = true;
    try {
      const response = await fetch("/api/favorites", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          saved: !readFavorites().includes(recipeId),
        }),
      });
      if (!response.ok) throw new Error("Could not save favorite.");
      favoriteIds = (await response.json()).favorites;
      onSaved();
      button.disabled = false;
    } catch {
      button.disabled = false;
      button.setAttribute(
        "aria-label",
        "Could not save favorite. Try again.",
      );
    }
  }
  function homePage() {
    if (document.body.dataset.page !== "home") return;
    const grid = document.querySelector("#featuredRecipes");
    const featured = [...recipes]
      .sort((first, second) => second.rating - first.rating)
      .slice(0, 4);
    const draw = () => {
      grid.innerHTML = featured
        .map((recipe) => card(recipe, readFavorites()))
        .join("");
    };
    draw();
    document.querySelector("#homeSearch").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = document.querySelector("#homeSearchInput").value.trim();
      const search = new URLSearchParams();
      if (query) search.set("q", query);
      const queryString = search.toString();
      window.location.assign(
        `recipes.html${queryString ? `?${queryString}` : ""}`,
      );
    });
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-favorite]");
      if (!button) return;
      toggleFavorite(button, button.dataset.favorite, draw);
    });
  }
  function listPage() {
    const page = document.body.dataset.page;
    if (!["recipes", "favorites"].includes(page)) return;
    const grid = document.querySelector("#recipeGrid");
    const search = document.querySelector("#recipeSearch");
    const sort = document.querySelector("#recipeSort");
    const filterRoot = document.querySelector("#categoryFilters");
    let selected =
      new URLSearchParams(location.search).get("category") || "All recipes";
    if (!categories.includes(selected)) selected = "All recipes";
    if (search)
      search.value = new URLSearchParams(location.search).get("q") || "";
    function drawFilters() {
      if (!filterRoot) return;
      filterRoot.innerHTML = categories
        .map(
          (category) =>
            `<button type="button" class="category-button ${selected === category ? "active" : ""}" data-category="${category}" aria-pressed="${selected === category}">${category}</button>`,
        )
        .join("");
    }
    function draw() {
      const favorites = readFavorites();
      const query = (search?.value || "").trim().toLowerCase();
      let results = recipes.filter((recipe) => {
        const text =
          `${recipe.name} ${recipe.category} ${recipe.cuisine} ${recipe.description} ${recipe.ingredients.map((item) => item[1]).join(" ")} ${recipe.tags.join(" ")}`.toLowerCase();
        return (
          (page !== "favorites" || favorites.includes(recipe.id)) &&
          (selected === "All recipes" || recipe.category === selected) &&
          text.includes(query)
        );
      });
      if (sort?.value === "time")
        results.sort((a, b) => a.prep + a.cook - b.prep - b.cook);
      else if (sort?.value === "difficulty")
        results.sort(
          (a, b) =>
            ["Easy", "Medium", "Hard"].indexOf(a.difficulty) -
            ["Easy", "Medium", "Hard"].indexOf(b.difficulty),
        );
      else results.sort((a, b) => b.rating - a.rating);
      grid.innerHTML = results.length
        ? results.map((recipe) => card(recipe, favorites)).join("")
        : `<div class="empty-state">${page === "favorites" ? "No saved recipes yet. Tap a heart to keep one here." : "No recipes found. Try another search or category."}</div>`;
      const count = document.querySelector("#resultCount");
      if (count)
        count.textContent = `${results.length} ${results.length === 1 ? "recipe" : "recipes"}`;
    }
    drawFilters();
    draw();
    search?.addEventListener("input", draw);
    sort?.addEventListener("change", draw);
    filterRoot?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      selected = button.dataset.category;
      drawFilters();
      draw();
    });
    grid?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-favorite]");
      if (!button) return;
      toggleFavorite(button, button.dataset.favorite, draw);
    });
  }
  function detailPage() {
    if (document.body.dataset.page !== "recipe") return;
    const root = document.querySelector("#recipeDetail");
    const id = new URLSearchParams(location.search).get("id");
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) {
      root.innerHTML =
        '<div class="empty-state">Recipe not found. <a href="recipes.html">Browse the recipes</a>.</div>';
      return;
    }
    let step = 0;
    let servings = recipe.servings;
    root.innerHTML = `<div class="detail-layout"><img class="detail-image" src="${recipe.image}" alt="${escapeHTML(recipe.name)}"><section><p class="kicker">${escapeHTML(recipe.category)} · ${escapeHTML(recipe.cuisine)}</p><h1>${escapeHTML(recipe.name)}</h1><p class="lead">${escapeHTML(recipe.description)}</p><div class="detail-facts"><span class="fact">Prep ${recipe.prep} min</span><span class="fact">Cook ${recipe.cook} min</span><span class="fact">${escapeHTML(recipe.difficulty)}</span><span class="fact">★ ${recipe.rating.toFixed(1)}</span></div><button class="favorite-button ${readFavorites().includes(recipe.id) ? "saved" : ""}" data-favorite="${recipe.id}" aria-label="Toggle favorite">${readFavorites().includes(recipe.id) ? "♥ Saved" : "♡ Save recipe"}</button></section></div><div class="detail-columns"><section><h2>Ingredients</h2><div class="servings"><span>Servings</span><button class="plain-button" data-serving="-1" aria-label="Decrease servings">−</button><strong id="servingCount">${servings}</strong><button class="plain-button" data-serving="1" aria-label="Increase servings">+</button></div><ul class="ingredient-list" id="ingredientList"></ul><h2>Tools</h2><ul>${recipe.tools.map((tool) => `<li>${escapeHTML(tool)}</li>`).join("")}</ul></section><section><h2>Cook along</h2><div class="progress" role="progressbar" aria-label="Cooking progress" aria-valuemin="1" aria-valuemax="${recipe.steps.length}" aria-valuenow="1"><span></span></div><p id="stepCount"></p><p id="stepText"></p><div class="step-actions"><button class="button secondary" data-step="-1">Previous</button><button class="button" data-step="1">Next step</button></div><p class="tip"><strong>Tip:</strong> ${escapeHTML(recipe.tip)}</p></section></div>`;
    const ingredientList = root.querySelector("#ingredientList");
    const drawIngredients = () => {
      ingredientList.innerHTML = recipe.ingredients
        .map(
          ([amount, name], index) =>
            `<li><label><input type="checkbox" data-ingredient="${index}"><span>${escapeHTML(String(Math.round(((amount * servings) / recipe.servings) * 100) / 100))} ${escapeHTML(name)}</span></label></li>`,
        )
        .join("");
    };
    const drawStep = () => {
      root.querySelector("#stepCount").textContent =
        `Step ${step + 1} of ${recipe.steps.length}`;
      root.querySelector("#stepText").textContent = recipe.steps[step];
      root.querySelector(".progress span").style.width =
        `${((step + 1) / recipe.steps.length) * 100}%`;
      root
        .querySelector(".progress")
        .setAttribute("aria-valuenow", String(step + 1));
      root.querySelector('[data-step="-1"]').disabled = step === 0;
      root.querySelector('[data-step="1"]').textContent =
        step === recipe.steps.length - 1 ? "Finish" : "Next step";
    };
    drawIngredients();
    drawStep();
    root.addEventListener("click", async (event) => {
      const serving = event.target.closest("[data-serving]");
      if (serving) {
        servings = Math.max(
          1,
          Math.min(24, servings + Number(serving.dataset.serving)),
        );
        root.querySelector("#servingCount").textContent = servings;
        drawIngredients();
        return;
      }
      const control = event.target.closest("[data-step]");
      if (control) {
        step = Math.max(
          0,
          Math.min(
            recipe.steps.length - 1,
            step + Number(control.dataset.step),
          ),
        );
        drawStep();
        return;
      }
      const favorite = event.target.closest("[data-favorite]");
      if (favorite) {
        await toggleFavorite(favorite, recipe.id, () => {
          const isSaved = readFavorites().includes(recipe.id);
          favorite.classList.toggle("saved", !isSaved);
          favorite.textContent = isSaved ? "♡ Save recipe" : "♥ Saved";
          favorite.setAttribute("aria-pressed", String(!isSaved));
          favorite.setAttribute(
            "aria-label",
            isSaved ? "Remove from favorites" : "Add to favorites",
          );
        });
      }
    });
  }
  function contactForm() {
    const form = document.querySelector("#contactForm");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#contactNotice").textContent =
        "Thanks for your note. This static demo does not send or store messages.";
      form.reset();
    });
  }
  document.addEventListener("click", (event) => {
    const logoutButton = event.target.closest("[data-logout]");
    if (logoutButton) {
      logoutButton.disabled = true;
      logoutButton.textContent = "Logging out…";
      fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) throw new Error("Logout request failed.");
          window.location.replace("login.html");
        })
        .catch(() => {
          logoutButton.disabled = false;
          logoutButton.textContent = "Retry log out";
          logoutButton.setAttribute(
            "aria-label",
            "Log out failed. Activate to retry.",
          );
        });
      return;
    }
    const themeButton = event.target.closest("[data-theme-toggle]");
    if (themeButton) {
      const next = readTheme() === "night" ? "light" : "night";
      try {
        localStorage.setItem(themeKey, next);
      } catch {}
      applyTheme(next);
    }
  });
  applyTheme(readTheme());
  homePage();
  listPage();
  detailPage();
  contactForm();
})();
