class NavBreadcrumb extends HTMLElement {
  constructor() {
    super();
    this.style.display = "block";
    this.parentLink = this.getAttribute("parentLink");
    this.parent = this.hasAttribute("parent") ? this.getAttribute("parent") : "Home";
    this.title = this.hasAttribute("title") ? this.getAttribute("title") : null;
  }
  connectedCallback() {
    if (!this.parentLink) {
      var link = document.querySelector('link[rel="parent"]');
      if (link) this.parentLink = link.href;
      else this.parentLink = "#";
    }

    if (this.title) {
      var link = document.querySelector('section.header > h4');
      if (link)
        this.title = link.innerText;
      if (!this.title)
        this.title = document.title;
    }

    this.innerHTML = `
      <a class="" href="${this.parentLink}">${this.parent}</a> →
      <a class="disabled" href="#">${this.title}</a>`;
  }
}

customElements.define('nav-breadcrumb', NavBreadcrumb);
