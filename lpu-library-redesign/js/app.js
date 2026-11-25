/* IIT Dholakpur Library frontend prototype
   Authentication and reservations use this browser's localStorage.
   A real multi-user college system needs a secure backend and database. */
(function () {
  "use strict";
  const USERS_KEY = "lpu-library-users-v2";
  const SESSION_KEY = "lpu-library-session-v2";
  const RES_KEY = "lpu-library-reservations-v2";
  const HOURS_24 = 24 * 60 * 60 * 1000;
  const $ = (selector) => document.querySelector(selector);
  const state = {
    searchField: "title",
    query: "",
    department: "all",
    authMode: "login",
    pendingBook: null
  };
  const DEMO_EMAIL = "demo@iitdholakpur.ac.in";
  const DEMO_PASSWORD = "demo123";
  const DEMO_NAME = "Demo Student";
  const palette = [
    "#214a62",
    "#6a3f52",
    "#355a43",
    "#73532e",
    "#39476e",
    "#684a75",
    "#245a63",
    "#784a36"
  ];
  let toastTimer;

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function users() {
    return read(USERS_KEY, []);
  }

  function session() {
    return read(SESSION_KEY, null);
  }

  function reservations() {
    const active = read(RES_KEY, []).filter(
      item => item.expiresAt > Date.now()
    );
    write(RES_KEY, active);
    return active;
  }

  function safe(value) {
    return String(value ?? "").replace(
      /[&<>'"]/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;"
        })[c]
    );
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function openModal(id) {
    const el = document.getElementById(id);
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  function currentUser() {
    const s = session();
    return s ? users().find(u => u.email === s.email) || null : null;
  }

  function updateAccountUI() {
    const user = currentUser();
    $("#userGreeting").textContent = user ? "Hi, " + user.name.split(" ")[0] : "";
    $("#loginOpen").classList.toggle("hidden", !!user);
    $("#signupOpen").classList.toggle("hidden", !!user);
    $("#logoutBtn").classList.toggle("hidden", !user);
  }

  function cleanExpired() {
    reservations();
  }

  function renderFilters() {
    const departments = [...new Set(BOOKS.map(book => book.department))].sort();
    const allBooksClass = state.department === "all" ? "active" : "";
    $("#departmentFilters").innerHTML =
      '<button class="filter-chip ' +
      allBooksClass +
      '" data-department="all">All Books</button>' +
      departments
        .map(department => {
          const activeClass =
            state.department === department ? "active" : "";
          return (
            '<button class="filter-chip ' +
            activeClass +
            '" data-department="' +
            safe(department) +
            '">' +
            safe(department) +
            "</button>"
          );
        })
        .join("");
  }

  function getBooks() {
    const query = state.query.trim().toLowerCase();
    const active = reservations();
    return BOOKS.filter(book => {
      const field =
        state.searchField === "title"
          ? book.title
          : state.searchField === "author"
            ? book.author
            : state.searchField === "department"
              ? book.department
              : book.isbn;
      const queryMatch = !query || String(field).toLowerCase().includes(query);
      return (
        queryMatch &&
        (state.department === "all" || book.department === state.department)
      );
    }).map(book => {
      const count = active.filter(r => r.bookId === book.id).length;
      return { ...book, available: Math.max(0, book.copies - count) };
    });
  }

  function renderBooks() {
    const books = getBooks();
    $("#resultCount").textContent = books.length + " books found";
    if (!books.length) {
      $("#bookList").innerHTML =
        '<div class="empty-state">No books found. Try another search.</div>';
      return;
    }

    $("#bookList").innerHTML = books
      .map((book, index) => {
        const available = book.available > 0;
        const color = palette[index % palette.length];
        const title =
          book.title.length > 34 ? book.title.slice(0, 32) + "…" : book.title;
        const animationDelay = Math.min(index, 8) * 45;
        return `<article class="book-card" style="animation-delay:${animationDelay}ms">
          <div class="book-cover" style="background:linear-gradient(145deg,${color},#14243b)">
            <small>IIT DHOLAKPUR</small>
            <strong>${safe(title)}</strong>
            <span>${safe(book.author)}</span>
          </div>
          <h3>${safe(book.title)}</h3>
          <p class="author">${safe(book.author)}</p>
          <span class="status ${available ? "" : "out"}">
            ${available ? "● Available" : "● Currently reserved"}
          </span>
          <button class="reserve-button" data-book-id="${safe(book.id)}" ${available ? "" : "disabled"}>
            ${available ? "♧ Reserve Now" : "Unavailable"}
          </button>
        </article>`;
      })
      .join("");
  }

  function openAuth(mode, bookId) {
    state.authMode = mode || "login";
    state.pendingBook = bookId || state.pendingBook;
    setAuthMode(state.authMode);
    openModal("authModal");
    setTimeout(() => $("#authEmail").focus(), 100);
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const signup = mode === "signup";
    $("#authTitle").textContent = signup ? "Quick sign up" : "Welcome back";
    $("#authSubtitle").textContent =
      "Use the demo details below for instant access.";
    $("#nameLabel").classList.toggle("hidden", !signup);
    $("#authName").required = false;
    $("#authPassword").autocomplete = signup
      ? "new-password"
      : "current-password";
    $("#loginTab").classList.toggle("active", !signup);
    $("#signupTab").classList.toggle("active", signup);
    $("#authSubmit").textContent = "Continue with demo account →";
    $("#authName").value = DEMO_NAME;
    $("#authEmail").value = DEMO_EMAIL;
    $("#authPassword").value = DEMO_PASSWORD;
  }
  function handleAuth(event) {
    event.preventDefault();
    const email = $("#authEmail").value.trim().toLowerCase();
    const password = $("#authPassword").value;
    const list = users();
    if (!email || !password) {
      toast("Please enter an email and password.");
      return;
    }

    const enteredName = $("#authName").value.trim();
    const name = enteredName || email.split("@")[0] || DEMO_NAME;
    const existingIndex = list.findIndex(u => u.email === email);
    if (existingIndex >= 0) {
      list[existingIndex] = { name, email, password };
    } else {
      list.push({ name, email, password });
    }

    write(USERS_KEY, list);
    write(SESSION_KEY, { email });
    updateAccountUI();
    closeModal("authModal");
    $("#authForm").reset();
    toast("You are now logged in.");
    if (state.pendingBook) {
      const id = state.pendingBook;
      state.pendingBook = null;
      reserveBook(id);
    }
  }

  function reserveBook(bookId) {
    const user = currentUser();
    if (!user) {
      openAuth("login", bookId);
      toast("Please log in before reserving a book.");
      return;
    }

    const book = BOOKS.find(b => b.id === bookId);
    if (!book) return;

    const active = reservations();
    const used = active.filter(r => r.bookId === bookId).length;
    if (used >= book.copies) {
      toast("Sorry, no copies are currently available.");
      renderBooks();
      return;
    }

    if (active.some(r => r.bookId === bookId && r.email === user.email)) {
      toast("You already reserved this book.");
      return;
    }

    const now = Date.now();
    active.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(now) + Math.random(),
      bookId,
      title: book.title,
      author: book.author,
      email: user.email,
      reservedAt: now,
      expiresAt: now + HOURS_24
    });
    write(RES_KEY, active);
    renderBooks();
    toast("Book reserved for 24 hours!");
  }

  function timeLeft(expiresAt) {
    const ms = Math.max(0, expiresAt - Date.now());
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return hours + "h " + minutes + "m remaining";
  }

  function renderReservations() {
    const user = currentUser();
    if (!user) {
      openAuth("login");
      return;
    }

    const mine = reservations().filter(r => r.email === user.email);
    $("#reservationList").innerHTML = mine.length
      ? mine
          .map(
            reservation => `<article class="reservation-item">
              <div>
                <strong>${safe(reservation.title)}</strong>
                <p>${safe(reservation.author)}</p>
                <p class="expiry">⌛ ${timeLeft(reservation.expiresAt)}</p>
              </div>
              <button class="cancel-reservation" data-cancel="${safe(reservation.id)}">
                Cancel
              </button>
            </article>`
          )
          .join("")
      : `<div class="empty-reservations">
          <img src="assets/iit-dholakpur-logo.png" alt="IIT Dholakpur logo">
          <br><br>
          You have no active reservations.
          <br>
          Browse the catalogue to reserve a book.
        </div>`;
    openModal("reservationModal");
  }

  function cancelReservation(id) {
    const user = currentUser();
    write(
      RES_KEY,
      reservations().filter(
        reservation =>
          !(reservation.id === id && user && reservation.email === user.email)
      )
    );
    renderBooks();
    renderReservations();
    toast("Reservation cancelled.");
  }

  function init() {
    if (!Array.isArray(BOOKS)) {
      $("#bookList").innerHTML =
        '<div class="empty-state">Book catalogue could not be loaded.</div>';
      return;
    }

    const demoUsers = users();
    if (!demoUsers.some(user => user.email === DEMO_EMAIL)) {
      demoUsers.push({
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      });
      write(USERS_KEY, demoUsers);
    }
    cleanExpired();
    renderFilters();
    renderBooks();
    updateAccountUI();

    $("#searchForm").addEventListener("submit", event => {
      event.preventDefault();
      renderBooks();
    });

    $("#searchInput").addEventListener("input", event => {
      state.query = event.target.value;
      renderBooks();
    });

    document.querySelectorAll(".search-tab").forEach(button => {
      button.addEventListener("click", () => {
        document
          .querySelectorAll(".search-tab")
          .forEach(tab => tab.classList.remove("active"));
        button.classList.add("active");
        state.searchField = button.dataset.search;
        $("#searchInput").placeholder =
          "Search by " +
          (state.searchField === "title" ? "book name" : state.searchField) +
          "...";
        $("#searchInput").value = "";
        state.query = "";
        renderBooks();
      });
    });

    $("#advancedSearch").addEventListener("click", () => {
      state.department = "all";
      renderFilters();
      $("#searchInput").focus();
      toast("Choose a category filter or search by author and ISBN.");
    });

    $("#departmentFilters").addEventListener("click", event => {
      const button = event.target.closest("[data-department]");
      if (!button) return;
      state.department = button.dataset.department;
      renderFilters();
      renderBooks();
    });

    $("#bookList").addEventListener("click", event => {
      const button = event.target.closest("[data-book-id]");
      if (button) reserveBook(button.dataset.bookId);
    });

    $("#loginOpen").addEventListener("click", () => openAuth("login"));
    $("#signupOpen").addEventListener("click", () => openAuth("signup"));
    $("#loginTab").addEventListener("click", () => setAuthMode("login"));
    $("#signupTab").addEventListener("click", () => setAuthMode("signup"));
    $("#authForm").addEventListener("submit", handleAuth);
    $("#logoutBtn").addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      updateAccountUI();
      toast("You have been logged out.");
    });
    $("#myReservationsNav").addEventListener("click", renderReservations);
    $("#myReservationsSide").addEventListener("click", renderReservations);

    $("#reservationList").addEventListener("click", event => {
      const button = event.target.closest("[data-cancel]");
      if (button) cancelReservation(button.dataset.cancel);
    });

    document.querySelectorAll("[data-close]").forEach(button => {
      button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", event => {
        if (event.target === backdrop) closeModal(backdrop.id);
      });
    });

    $("#mobileMenu").addEventListener("click", () => {
      $(".main-nav").classList.toggle("open");
    });

    setInterval(() => {
      const modal = $("#reservationModal");
      if (modal.classList.contains("open")) renderReservations();
      reservations();
      renderBooks();
    }, 60000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();