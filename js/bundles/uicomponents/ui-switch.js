class UiSwitch extends HTMLElement {
  constructor() {
    super();
    this.storekey = this.hasAttribute("storekey") ? this.getAttribute("storekey") : null;
  }
  setCheck(newState) {
    this.input.checked = newState;
    if (!this.disabled) this.dispatchEvent(new Event("input"));
    if (this.showid) {
      var el = document.getElementById(this.showid);
      if (el) {
        if (this.input.checked) {
          el.classList.add("show");
          el.classList.remove("hidden");
        } else {
          el.classList.remove("show");
          el.classList.add("hidden");
        }
      }
    }
  }
  connectedCallback() {
    const root = document.createElement("div");

    root.classList.add("ui-switch");

    this.input = root.appendChild(document.createElement("input"));
    this.input.type = "checkbox";
    this.input.addEventListener("change", e => {
      e.preventDefault();
      e.stopPropagation();
      this.setCheck(this.input.checked);
      if (this.storekey) localStorage.setItem(this.storekey, this.input.checked);
    });
    this.addEventListener("click", (e) => {
      e.preventDefault();
      this.input.checked = !this.input.checked;
      this.setCheck(this.input.checked);
    });
    root.appendChild(document.createElement("span"));
    var titleEl = root.appendChild(document.createElement("div"));

    this.appendChild(root);

    this.showid = this.hasAttribute("showid") ? this.getAttribute("showid") : null;
    titleEl.title = this.hasAttribute("title") ? this.getAttribute("title") : "";
    titleEl.innerHTML = this.hasAttribute("label") ? this.getAttribute("label") : (this.hasAttribute("title") ? this.getAttribute("title") : "");
    if (this.disabled) this.classList.add("disabled"); else this.classList.remove("disabled");

    this.attributeChangedCallback("showid");
    var cached = this.storekey ? localStorage.getItem(this.storekey) : null;
    this.setCheck(cached !== null ? cached : (this.hasAttribute("checked") ? this.getAttribute("checked") == "true" : false));
  }
  static get observedAttributes() {
    return ['checked'];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.input) return;
    if (name == "checked") {
      this.setCheck(this.getAttribute("checked") == "true");
    } else if (name == "disabled")
      this.disabled = this.hasAttribute("disabled") ? this.getAttribute("disabled") : false;
    else if (name == "showid") {
      this.showid = this.hasAttribute("showid") ? this.getAttribute("showid") : null;
    }
  }
}

customElements.define('ui-switch', UiSwitch);
