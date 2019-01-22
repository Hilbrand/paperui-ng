import { Vue } from './vue.js';

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

class NavButtons extends HTMLElement {
  constructor() {
    super();
    this.style.display = "block";
    this.prevLink = this.hasAttribute("prevLink") ? this.getAttribute("prevLink") : null;
    this.nextLink = this.hasAttribute("nextLink") ? this.getAttribute("nextLink") : null;

    if (!this.prevLink) {
      var link = document.querySelector('link[rel="prev"]');
      if (link) this.prevLink = link.href;
      else this.prevLink = "";
    }

    if (!this.nextLink) {
      var link = document.querySelector('link[rel="next"]');
      if (link) this.nextLink = link.href;
      else this.nextLink = "";
    }

    this.prevEnabled = this.prevLink != "";
    this.nextEnabled = this.nextLink != "";
  }
  connectedCallback() {
    this.innerHTML = `
    <a data-no-reload="nav" class="btn btn-primary col-2 mx-2 ${this.prevEnabled ? "" : "disabled"}" href="${this.prevLink}">Back</a>
    <a data-no-reload="nav" class="btn btn-primary col-2 mx-2 ${this.nextEnabled ? "" : "disabled"}" href="${this.nextLink}">Next</a>`;
  }
}

customElements.define('nav-buttons', NavButtons);

/**
 * Class to handle a loaded page
 */
class Page {
    constructor(dom) {
        this.dom = dom;
    }

    /**
     * Performs a querySelector in the page content or document
     *
     * @param  {string} selector
     * @param  {DocumentElement} context
     *
     * @return {Node}
     */
    querySelector(selector, context = this.dom) {
        const result = context.querySelector(selector);

        if (!result) {
            throw new Error(`Not found the target "${selector}"`);
        }

        return result;
    }

    /**
     * Performs a querySelector
     *
     * @param  {string} selector
     * @param  {DocumentElement} context
     *
     * @return {Nodelist}
     */
    querySelectorAll(selector, context = this.dom) {
        const result = context.querySelectorAll(selector);

        if (!result.length) {
            throw new Error(`Not found the target "${selector}"`);
        }

        return result;
    }

    /**
     * Removes elements in the document
     *
     * @param  {String} selector
     *
     * @return {this}
     */
    removeContent(selector) {
        this.querySelectorAll(selector, document).forEach(element =>
            element.remove()
        );

        return this;
    }

    /**
     * Replace an element in the document by an element in the page
     * Optionally, it can execute a callback to the new inserted element
     *
     * @param  {String} selector
     * @param  {Function|undefined} callback
     *
     * @return {this}
     */
    replaceContent(selector = 'body', callback = undefined) {
        const content = this.querySelector(selector);

        this.querySelector(selector, document).replaceWith(content);

        if (typeof callback === 'function') {
            callback(content);
        }

        return this;
    }

    /**
     * Appends the content of an element in the page in other element in the document
     * Optionally, it can execute a callback for each new inserted elements
     *
     * @param  {String} selector
     * @param  {Function|undefined} callback
     *
     * @return {this}
     */
    appendContent(target = 'body', callback = undefined) {
        const content = Array.from(this.querySelector(target).childNodes);
        const fragment = document.createDocumentFragment();

        content.forEach(item => fragment.appendChild(item));

        this.querySelector(target, document).append(fragment);

        if (typeof callback === 'function') {
            content
                .filter(item => item.nodeType === Node.ELEMENT_NODE)
                .forEach(callback);
        }

        return this;
    }

    replaceNavReferences(context = 'head') {
        const documentContext = this.querySelector(context, document);
        const pageContext = this.querySelector(context);

        documentContext.querySelectorAll('link[rel="prev"]').forEach(link => link.remove());
        documentContext.querySelectorAll('link[rel="next"]').forEach(link => link.remove());
        documentContext.querySelectorAll('link[rel="parent"]').forEach(link => link.remove());

        var link;
        link = pageContext.querySelector('link[rel="prev"]');
        if (link) documentContext.append(link);
        link = pageContext.querySelector('link[rel="next"]');
        if (link) documentContext.append(link);
        link = pageContext.querySelector('link[rel="parent"]');
        if (link) documentContext.append(link);

        return this;
    }

    /**
     * Change the css of the current page
     *
     * @param {string} context
     *
     * @return Promise
     */
    replaceStyles(context = 'head') {
        const documentContext = this.querySelector(context, document);
        const pageContext = this.querySelector(context);
        const oldLinks = Array.from(
            documentContext.querySelectorAll('link[rel="stylesheet"]')
        );
        const newLinks = Array.from(
            pageContext.querySelectorAll('link[rel="stylesheet"]')
        );

        oldLinks.forEach(link => {
            const index = newLinks.findIndex(
                newLink => newLink.href === link.href
            );

            if (index === -1) {
                link.remove();
            } else {
                newLinks.splice(index, 1);
            }
        });

        documentContext
            .querySelectorAll('style')
            .forEach(style => style.remove());
        pageContext
            .querySelectorAll('style')
            .forEach(style => documentContext.append(style));

        return Promise.all(
            newLinks.map(
                link =>
                    new Promise((resolve, reject) => {
                        link.addEventListener('load', resolve);
                        link.addEventListener('error', reject);
                        documentContext.append(link);
                    })
            )
        ).then(() => Promise.resolve(this));
    }

    /**
     * Change the scripts of the current page
     *
     * @param {string} context
     *
     * @return Promise
     */
    replaceScripts(context = 'head') {
        const documentContext = this.querySelector(context, document);
        const pageContext = this.querySelector(context);
        const oldScripts = Array.from(
            documentContext.querySelectorAll('script')
        );
        const newScripts = Array.from(pageContext.querySelectorAll('script'));

        oldScripts.forEach(script => {
            if (!script.src) {
                script.remove();
                return;
            }

            const index = newScripts.findIndex(
                newScript => newScript.src === script.src
            );

            if (index === -1) {
                script.remove();
            } else {
                newScripts.splice(index, 1);
            }
        });

        return Promise.all(
            newScripts.map(
                script =>
                    new Promise((resolve, reject) => {
                        const scriptElement = document.createElement('script');

                        scriptElement.type = script.type || 'text/javascript';
                        scriptElement.defer = script.defer;
                        scriptElement.async = script.async;

                        if (script.src) {
                            scriptElement.src = script.src;
                            scriptElement.addEventListener('load', resolve);
                            scriptElement.addEventListener('error', reject);
                            documentContext.append(scriptElement);
                            return;
                        }

                        scriptElement.innerText = script.innerText;
                        documentContext.append(script);
                        resolve();
                    })
            )
        ).then(() => Promise.resolve(this));
    }
}

/**
 * Class to load an url and generate a page with the result
 */
class UrlLoader {
    constructor(url) {
        this.url = url;
        this.html = null;
        this.state = {};
    }

    /**
     * Performs a fetch to the url and return a promise
     *
     * @return {Promise}
     */
    fetch() {
        return fetch(this.url);
    }

    /**
     * Go natively to the url. Used as fallback
     */
    fallback() {
        document.location = this.url;
    }

    /**
     * Load the page with the content of the page
     *
     * @return {Promise}
     */
    load(replace = false, state = null) {
        if (this.html) {
            return new Promise(accept => {
                const page = new Page(parseHtml(this.html));
                this.setState(page.dom.title, replace, state);
                accept(page);
            });
        }

        return this.fetch()
            .then(res => {
                if (res.status < 200 || res.status >= 300) {
                    throw new Error(`The request status code is ${res.status}`);
                }

                return res;
            })
            .then(res => res.text())
            .then(html => {
                if (this.html !== false) {
                    this.html = html;
                }

                const page = new Page(parseHtml(html));
                this.setState(page.dom.title, replace, state);
                return page;
            });
    }

    setState(title, replace = false, state = null) {
        document.title = title;

        if (state) {
            this.state = state;
        }

        if (this.url !== document.location.href) {
            if (replace) {
                history.replaceState(this.state, null, this.url);
            } else {
                history.pushState(this.state, null, this.url);
            }
        } else {
            history.replaceState(this.state, null, this.url);
        }
    }
}

/**
 * Class to submit a form and generate a page with the result
 */
class FormLoader extends UrlLoader {
    constructor(form) {
        let url = form.action.split('?', 2).shift();
        const method = (form.method || 'GET').toUpperCase();

        if (method === 'GET') {
            url += '?' + new URLSearchParams(new FormData(form));
        }

        super(url);

        this.html = false;
        this.method = method;
        this.form = form;
    }

    /**
     * Submit natively the form. Used as fallback
     */
    fallback() {
        this.form.submit();
    }

    /**
     * Performs a fetch with the form data and return a promise
     *
     * @return {Promise}
     */
    fetch() {
        const options = { method: this.method };

        if (this.method === 'POST') {
            options.body = new FormData(this.form);
        }

        return fetch(this.url, options);
    }
}

function parseHtml(html) {
    html = html.trim().replace(/^\<!DOCTYPE html\>/i, '');
    const doc = document.implementation.createHTMLDocument();
    doc.documentElement.innerHTML = html;

    return doc;
}

/**
 * Class to handle the navigation history
 */
class Navigator {
    constructor(handler) {
        this.loaders = [];
        this.handler = handler;
        this.filters = [
            (el, url) =>
                url &&
                url.indexOf(
                    `${document.location.protocol}//${document.location.host}`
                ) === 0,
            (el, url) => url !== document.location.href,
            el => !el.target
        ];
    }

    /**
     * Add a filter to discard some urls and forms.
     * It must be a function accepting two arguments: the element clicked and url
     *
     * @param {Function} filter
     *
     * @return {this}
     */
    addFilter(filter) {
        this.filters.push(filter);

        return this;
    }

    /**
     * Init the navigator, attach the events to capture the history changes
     *
     * @return {this}
     */
    init() {
        var handlePopState = (event) => {
            this.go(document.location.href, event);
        };

        delegate('click', 'a', (event, link) => {
            window.removeEventListener('popstate', handlePopState);
            if (this.filters.every(filter => filter(link, link.href))) {
                this.go(link.href, event);
                event.preventDefault();
            }
            setTimeout(()=> window.addEventListener('popstate', handlePopState),0);
        });

        delegate('submit', 'form', (event, form) => {
            const url = resolve(form.action);

            if (this.filters.every(filter => filter(form, url))) {
                this.submit(form, event);
                event.preventDefault();
            }
        });

        window.addEventListener('popstate', handlePopState);

        this.loaders.push(new UrlLoader(document.location.href));

        return this;
    }

    /**
     * Go to other url.
     *
     * @param  {string} url
     * @param  {Event} event
     *
     * @return {Promise|void}
     */
    go(url, event) {
        url = resolve(url);

        let loader = this.loaders.find(loader => loader.url === url);

        if (!loader) {
            loader = new UrlLoader(url);
            this.loaders.push(loader);
        }

        return this.load(loader, event);
    }

    /**
     * Submit a form via ajax
     *
     * @param  {HTMLFormElement} form
     * @param  {Event} event
     *
     * @return {Promise}
     */
    submit(form, event) {
        return this.load(new FormLoader(form), event);
    }

    /**
     * Execute a page loader
     *
     * @param  {UrlLoader|FormLoader} loader
     * @param  {Event} event
     *
     * @return {Promise}
     */
    load(loader, event) {
        try {
            return this.handler(loader, event);
        } catch (err) {
            console.error(err);
            loader.fallback();

            return Promise.resolve();
        }
    }
}

const link = document.createElement('a');

function resolve(url) {
    link.setAttribute('href', url);
    return link.href;
}

function delegate(event, selector, callback) {
    document.addEventListener(
        event,
        function (event) {
            for (
                let target = event.target;
                target && target != this;
                target = target.parentNode
            ) {
                if (target.matches(selector)) {
                    callback.call(target, event, target);
                    break;
                }
            }
        },
        true
    );
}

/**
 * To avoid flickering of the website-shell, an ajax loading mechanism
 * is used. This is a progressive enhancement and the page works without
 * it as well.
 * 
 * The script only replaces part of the page with the downloaded content.
 * That is:
 * - All styles and scripts linked in the body section
 * - <main>, <footer>, <section.header>, <aside>, <nav> is replaced.
 * - "prev"/"next"/"parent" ref links in <head> are replaced.
 * - A "DOMContentLoaded" event is emitted after loading
 * 
 * A not-found message is shown if loading failed.
 * 
 * A replacement does not happen if the link points to the same page or ("#").
 */

class NavAjaxPageLoad extends HTMLElement {
    constructor() {
        super();

        this.nav = new Navigator((loader, event) => {
            event.target.classList.add("disabled");
            loader.load()
                .then(page => page.replaceStyles("body"))
                .then(page => this.checkReload(event.target, "aside") ? page.replaceContent('aside') : page)
                .then(page => this.checkReload(event.target, "nav") ? page.replaceContent('body>nav') : page)
                .then(page => page.replaceNavReferences().replaceContent('footer').replaceContent('section.header'))
                .then(page => page.replaceContent('main'))
                .then(page => page.replaceScripts("body"))
                .then(() => this.prepareLoadedContent(event))
                .catch(e => { // Connection lost? Check login
                    console.log("Failed to load page:", e.message);
                    document.querySelector("main").innerHTML = `
                  <main class='centered m-4'>
                    <section></section><section class='main card p-4'>Page not found. Are you offline?</section><section></section>
                  </main>
                  `;
                    document.dispatchEvent(new Event('FailedLoading'));
                });
        });
        this.nav.addFilter((el, url) => {
            if (!el.dataset.noReload && new URL(url).pathname == window.location.pathname) return false;
            return true;
        });
    }

    prepareLoadedContent(event) {
        if (event.target) event.target.classList.remove("disabled");
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }, 50);
    }
    
    checkReload(target, section) {
        var d = target.dataset.noReload ? target.dataset.noReload.split(",") : [];
        return !d.includes(section);
    }

    connectedCallback() {
        this.nav.init();

        if (localStorage.getItem('skiphome') != "true") return;
        var hasRedirected = sessionStorage.getItem("redirected");
        if (!hasRedirected) {
            sessionStorage.setItem("redirected", "true");
            if (window.location.pathname === "/index.html") {
                this.nav.go("maintenance.html");
                return;
            }
        }
    }
}

customElements.define('nav-ajax-page-load', NavAjaxPageLoad);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => typeof o === 'function' && directives.has(o);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * @module lit-html
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = window.customElements !== undefined &&
    window.customElements.polyfillWrapFlushCallback !== undefined;
/**
 * Removes nodes, starting from `startNode` (inclusive) to `endNode`
 * (exclusive), from `container`.
 */
const removeNodes = (container, startNode, endNode = null) => {
    let node = startNode;
    while (node !== endNode) {
        const n = node.nextSibling;
        container.removeChild(node);
        node = n;
    }
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updateable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        let index = -1;
        let partIndex = 0;
        const nodesToRemove = [];
        const _prepareTemplate = (template) => {
            const content = template.content;
            // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be
            // null
            const walker = document.createTreeWalker(content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
            // Keeps track of the last index associated with a part. We try to delete
            // unnecessary nodes, but we never want to associate two different parts
            // to the same index. They must have a constant node between.
            let lastPartIndex = 0;
            while (walker.nextNode()) {
                index++;
                const node = walker.currentNode;
                if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                    if (node.hasAttributes()) {
                        const attributes = node.attributes;
                        // Per
                        // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                        // attributes are not guaranteed to be returned in document order.
                        // In particular, Edge/IE can return them out of order, so we cannot
                        // assume a correspondance between part index and attribute index.
                        let count = 0;
                        for (let i = 0; i < attributes.length; i++) {
                            if (attributes[i].value.indexOf(marker) >= 0) {
                                count++;
                            }
                        }
                        while (count-- > 0) {
                            // Get the template literal section leading up to the first
                            // expression in this attribute
                            const stringForPart = result.strings[partIndex];
                            // Find the attribute name
                            const name = lastAttributeNameRegex.exec(stringForPart)[2];
                            // Find the corresponding attribute
                            // All bound attributes have had a suffix added in
                            // TemplateResult#getHTML to opt out of special attribute
                            // handling. To look up the attribute value we also need to add
                            // the suffix.
                            const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                            const attributeValue = node.getAttribute(attributeLookupName);
                            const strings = attributeValue.split(markerRegex);
                            this.parts.push({ type: 'attribute', index, name, strings });
                            node.removeAttribute(attributeLookupName);
                            partIndex += strings.length - 1;
                        }
                    }
                    if (node.tagName === 'TEMPLATE') {
                        _prepareTemplate(node);
                    }
                }
                else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                    const data = node.data;
                    if (data.indexOf(marker) >= 0) {
                        const parent = node.parentNode;
                        const strings = data.split(markerRegex);
                        const lastIndex = strings.length - 1;
                        // Generate a new text node for each literal section
                        // These nodes are also used as the markers for node parts
                        for (let i = 0; i < lastIndex; i++) {
                            parent.insertBefore((strings[i] === '') ? createMarker() :
                                document.createTextNode(strings[i]), node);
                            this.parts.push({ type: 'node', index: ++index });
                        }
                        // If there's no text, we must insert a comment to mark our place.
                        // Else, we can trust it will stick around after cloning.
                        if (strings[lastIndex] === '') {
                            parent.insertBefore(createMarker(), node);
                            nodesToRemove.push(node);
                        }
                        else {
                            node.data = strings[lastIndex];
                        }
                        // We have a part for each match found
                        partIndex += lastIndex;
                    }
                }
                else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                    if (node.data === marker) {
                        const parent = node.parentNode;
                        // Add a new marker node to be the startNode of the Part if any of
                        // the following are true:
                        //  * We don't have a previousSibling
                        //  * The previousSibling is already the start of a previous part
                        if (node.previousSibling === null || index === lastPartIndex) {
                            index++;
                            parent.insertBefore(createMarker(), node);
                        }
                        lastPartIndex = index;
                        this.parts.push({ type: 'node', index });
                        // If we don't have a nextSibling, keep this node so we have an end.
                        // Else, we can remove it to save future costs.
                        if (node.nextSibling === null) {
                            node.data = '';
                        }
                        else {
                            nodesToRemove.push(node);
                            index--;
                        }
                        partIndex++;
                    }
                    else {
                        let i = -1;
                        while ((i = node.data.indexOf(marker, i + 1)) !==
                            -1) {
                            // Comment node has a binding marker inside, make an inactive part
                            // The binding won't work, but subsequent bindings will
                            // TODO (justinfagnani): consider whether it's even worth it to
                            // make bindings in comments work
                            this.parts.push({ type: 'node', index: -1 });
                        }
                    }
                }
            }
        };
        _prepareTemplate(element);
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#attributes-0
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-character
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = /([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F \x09\x0a\x0c\x0d"'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this._parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this._parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this._parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // When using the Custom Elements polyfill, clone the node, rather than
        // importing it, to keep the fragment in the template's document. This
        // leaves the fragment inert so custom elements won't upgrade and
        // potentially modify their contents by creating a polyfilled ShadowRoot
        // while we traverse the tree.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const parts = this.template.parts;
        let partIndex = 0;
        let nodeIndex = 0;
        const _prepareInstance = (fragment) => {
            // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be
            // null
            const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
            let node = walker.nextNode();
            // Loop through all the nodes and parts of a template
            while (partIndex < parts.length && node !== null) {
                const part = parts[partIndex];
                // Consecutive Parts may have the same node index, in the case of
                // multiple bound attributes on an element. So each iteration we either
                // increment the nodeIndex, if we aren't on a node with a part, or the
                // partIndex if we are. By not incrementing the nodeIndex when we find a
                // part, we allow for the next part to be associated with the current
                // node if neccessasry.
                if (!isTemplatePartActive(part)) {
                    this._parts.push(undefined);
                    partIndex++;
                }
                else if (nodeIndex === part.index) {
                    if (part.type === 'node') {
                        const part = this.processor.handleTextExpression(this.options);
                        part.insertAfterNode(node.previousSibling);
                        this._parts.push(part);
                    }
                    else {
                        this._parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
                    }
                    partIndex++;
                }
                else {
                    nodeIndex++;
                    if (node.nodeName === 'TEMPLATE') {
                        _prepareInstance(node.content);
                    }
                    node = walker.nextNode();
                }
            }
        };
        _prepareInstance(fragment);
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const endIndex = this.strings.length - 1;
        let html = '';
        for (let i = 0; i < endIndex; i++) {
            const s = this.strings[i];
            // This exec() call does two things:
            // 1) Appends a suffix to the bound attribute name to opt out of special
            // attribute value parsing that IE11 and Edge do, like for style and
            // many SVG attributes. The Template class also appends the same suffix
            // when looking up attributes to create Parts.
            // 2) Adds an unquoted-attribute-safe marker for the first expression in
            // an attribute. Subsequent attribute expressions will use node markers,
            // and this is safe since attributes with multiple expressions are
            // guaranteed to be quoted.
            const match = lastAttributeNameRegex.exec(s);
            if (match) {
                // We're starting a new bound attribute.
                // Add the safe attribute suffix, and use unquoted-attribute-safe
                // marker.
                html += s.substr(0, match.index) + match[1] + match[2] +
                    boundAttributeSuffix + match[3] + marker;
            }
            else {
                // We're either in a bound node, or trailing bound attribute.
                // Either way, nodeMarker is safe to use.
                html += s + nodeMarker;
            }
        }
        return html + this.strings[endIndex];
    }
    getTemplateElement() {
        const template = document.createElement('template');
        template.innerHTML = this.getHTML();
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => (value === null ||
    !(typeof value === 'object' || typeof value === 'function'));
/**
 * Sets attribute values for AttributeParts, so that the value is only set once
 * even if there are multiple parts for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = this.parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (v != null &&
                    (Array.isArray(v) || typeof v !== 'string' && v[Symbol.iterator])) {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
                else {
                    text += typeof v === 'string' ? v : String(v);
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
class AttributePart {
    constructor(comitter) {
        this.value = undefined;
        this.committer = comitter;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive$$1 = this.value;
            this.value = noChange;
            directive$$1(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
class NodePart {
    constructor(options) {
        this.value = undefined;
        this._pendingValue = undefined;
        this.options = options;
    }
    /**
     * Inserts this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part between `ref` and `ref`'s next sibling. Both `ref` and
     * its next sibling must be static, unchanging nodes such as those that appear
     * in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part._insert(this.startNode = createMarker());
        part._insert(this.endNode = createMarker());
    }
    /**
     * Appends this part after `ref`
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref._insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this._pendingValue = value;
    }
    commit() {
        while (isDirective(this._pendingValue)) {
            const directive$$1 = this._pendingValue;
            this._pendingValue = noChange;
            directive$$1(this);
        }
        const value = this._pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this._commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this._commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this._commitNode(value);
        }
        else if (Array.isArray(value) || value[Symbol.iterator]) {
            this._commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this._commitText(value);
        }
    }
    _insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    _commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this._insert(value);
        this.value = value;
    }
    _commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = value;
        }
        else {
            this._commitNode(document.createTextNode(typeof value === 'string' ? value : String(value)));
        }
        this.value = value;
    }
    _commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value && this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this._commitNode(fragment);
            this.value = instance;
        }
    }
    _commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this._pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this._pendingValue = value;
    }
    commit() {
        while (isDirective(this._pendingValue)) {
            const directive$$1 = this._pendingValue;
            this._pendingValue = noChange;
            directive$$1(this);
        }
        if (this._pendingValue === noChange) {
            return;
        }
        const value = !!this._pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
        }
        this.value = value;
        this._pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the thrid
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
try {
    const options = {
        get capture() {
            eventOptionsSupported = true;
            return false;
        }
    };
    window.addEventListener('test', options, options);
    window.removeEventListener('test', options, options);
}
catch (_e) {
}
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this._pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this._boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this._pendingValue = value;
    }
    commit() {
        while (isDirective(this._pendingValue)) {
            const directive$$1 = this._pendingValue;
            this._pendingValue = noChange;
            directive$$1(this);
        }
        if (this._pendingValue === noChange) {
            return;
        }
        const newListener = this._pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this._boundHandleEvent, this._options);
        }
        if (shouldAddListener) {
            this._options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this._boundHandleEvent, this._options);
        }
        this.value = newListener;
        this._pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const comitter = new PropertyCommitter(element, name.slice(1), strings);
            return comitter.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const comitter = new AttributeCommitter(element, name, strings);
        return comitter.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result a TemplateResult created by evaluating a template tag like
 *     `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

/**
 * A UI component with a filter bar and a button group "grid"/"list"/"textual".
 * 
 * This is not a shadow-dom component, but still allows children ("slots"). Those
 * are shown when the selection mode is on.
 * 
 * Attributes:
 * - "placeholder": A placeholder for the filter bar
 * - "value": A value for the filter bar
 * - "mode": The current mode. Must be one of "grid","list","textual"
 * - "grid": The tooltip title of the grid button
 * - "list": The tooltip title of the list button
 * - "textual": The tooltip title of the textual button
 * 
 * Events:
 * - "filter": The user clicked on the filter button or hit enter
 */
class UiFilter extends HTMLElement {
  constructor() {
    super();
    this.classList.add("ui-filterbar");
  }
  connectedCallback() {
    if (this.hasAttribute("suggestions")) {
      this.suggestionsDomID = Math.random().toString(36);
      var suggestionsEl = document.createElement("datalist");
      suggestionsEl.id = this.suggestionsDomID;
      var items = this.getAttribute("suggestions").split(",");
      for (var item of items) {
        var openEL = document.createElement("option");
        openEL.setAttribute("value", item);
        suggestionsEl.appendChild(openEL);
      }
      document.body.appendChild(suggestionsEl);
    }
    this.placeholder = this.getAttribute("placeholder");
    this.value = this.getAttribute("value") || "";
    this.mode = this.getAttribute("mode") || "grid";
    this.grid = this.getAttribute("grid");
    this.list = this.getAttribute("list");
    this.textual = this.getAttribute("textual");
    this.select = this.getAttribute("select") || "Select";
    this.selectmode = this.getAttribute("selectmode") || false;

    // Non-shadow-dom but still slots magic - Part 1
    var slotElements = [];
    for (var node of this.childNodes) {
      slotElements.push(node.cloneNode(true));
    }
    this.innerHTML = "";

    render(html`
        <form @submit="${this.search.bind(this)}" name="filterform" class="ui-filterbar">
          <button type="button" title="${this.select}" @click="${this.selectChanged.bind(this)}" class="btn ${this.selectmode ? "btn-primary" : "btn-secondary"}">
            <i class="fas fa-check-double"></i>
          </button>
          <div style="display:none" class="selectcomponents"></div>
          <div class="input-group ml-3">
            <input class="form-control py-2 filterinput" type="search" name="filter" placeholder="${this.placeholder}"
              value="${this.value}" @input="${this.searchI.bind(this)}">
            <span class="input-group-append">
              <button class="btn btn-outline-secondary" type="submit">
                <i class="fa fa-search"></i>
              </button>
            </span>
          </div>
          <div class="btn-group ml-3 viewmode" role="group" aria-label="Change view mode"></div></form>
          `, this);

    // Non-shadow-dom but still slots magic - Part 2
    var slot = this.querySelector(".selectcomponents");
    for (var el of slotElements) {
      slot.appendChild(el);
    }

    // Don't show the mode button group of no modes allowed
    if (!this.grid && !this.list && !this.textual) {
      this.querySelector(".viewmode").style.display = "none";
    } else
      this.renderViewMode();
  }
  disconnectedCallback() {
    if (this.suggestionsDomID) {
      document.getElementById(this.suggestionsDomID).remove();
      delete this.suggestionsDomID;
    }
  }

  searchI(event) {
    event.preventDefault();
    this.value = event.target.value;
    this.dispatchEvent(new CustomEvent('filter', { detail: { value: this.value, typing: true } }));
  }
  search(event) {
    event.preventDefault();
    var formData = new FormData(event.target);
    this.value = formData.get("filter");
    this.dispatchEvent(new CustomEvent('filter', { detail: { value: this.value } }));
  }
  modeChange(event) {
    event.preventDefault();
    this.mode = event.target.dataset.mode;
    this.renderViewMode();
    this.dispatchEvent(new CustomEvent('mode', { detail: { mode: this.mode } }));
  }

  selectChanged(event) {
    event.preventDefault();
    this.selectmode = !this.selectmode;
    if (this.selectmode) this.querySelector(".selectcomponents").style.display = "block";
    else this.querySelector(".selectcomponents").style.display = "none";
    this.dispatchEvent(new CustomEvent('selectmode', { detail: { selectmode: this.selectmode } }));
  }
  renderViewMode() {
    render(html`${this.grid.length == 0 ? '' : html`<button type="button" title="${this.grid}" data-mode="grid" @click="${this.modeChange.bind(this)}"
              class="btn ${this.mode == "grid" ? "btn-primary" : "btn-secondary"}"><i class="fas fa-th-large"></i></button>`}
          ${this.list.length == 0 ? '' : html`<button type="button" title="${this.list}" data-mode="list" @click="${this.modeChange.bind(this)}"
              class="btn ${this.mode == "list" ? "btn-primary" : "btn-secondary"}"><i class="fas fa-th-list"></i></button>`}
          ${this.textual.length == 0 ? '' : html`<button type="button" title="${this.textual}" data-mode="textual" @click="${this.modeChange.bind(this)}"
              class="btn ${this.mode == "textual" ? "btn-primary" : "btn-secondary"}"><i class="fas fa-align-justify"></i></button>`}
              `, this.querySelector(".viewmode"));
  }
}

customElements.define('ui-filter', UiFilter);

var style = ":host {\n  --padding: 0;\n}\n\nform {\n  background-color: inherit;\n  font-size: 1.25rem;\n  padding: var(--padding);\n  color: inherit;\n  margin: 0;\n  outline: 2px dashed #000;\n  outline-offset: -10px;\n  outline-color: inherit;\n  transition: outline-offset 0.15s ease-in-out, background-color 0.15s linear;\n}\n\n.is-dragover {\n  outline-offset: -20px;\n  outline-color: #c8dadf;\n  background-color: #fff;\n}\n.is-dragover > * {\n  pointer-events: none;\n}\n\n.uploading,\n.success,\n.error {\n  display: none;\n}\n\nform.is-uploading .uploading,\nform.is-success .success,\nform.is-error .error {\n  display: block;\n}\n\n.uploading {\n  font-style: italic;\n}\n\n.success {\n  animation: appear-from-inside 0.25s ease-in-out;\n}\n\n@keyframes appear-from-inside {\n  from {\n    transform: translateY(-50%) scale(0);\n  }\n  75% {\n    transform: translateY(-50%) scale(1.1);\n  }\n  to {\n    transform: translateY(-50%) scale(1);\n  }\n}\ninput[type=file] {\n  width: 0.1px;\n  height: 0.1px;\n  opacity: 0;\n  overflow: hidden;\n  position: absolute;\n  z-index: -1;\n}\n\ninput[type=file] + label {\n  max-width: 80%;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  cursor: pointer;\n  display: inline-block;\n  overflow: hidden;\n}\n\ninput[type=file] + label:hover strong,\ninput[type=file]:focus + label strong,\ninput[type=file].has-focus + label strong {\n  color: #39bfd3;\n}\n\ninput[type=file]:focus + label,\ninput[type=file].has-focus + label {\n  outline: 1px dotted #000;\n  outline: -webkit-focus-ring-color auto 5px;\n}";

class UiDropZone extends HTMLElement {
  constructor() {
    super();
    this.droppedFiles = [];
    this.url = this.hasAttribute("url") ? this.getAttribute("url") : '#';
    this.method = this.hasAttribute("method") ? this.getAttribute("method") : 'post';
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    this.render();
  }
  disconnectedCallback() {
  }

  render() {
    render(html`
        <style>${style}</style>
        <form method="${this.method}" action="${this.url}" enctype="multipart/form-data"
        @submit="${(e) => this.submit(e)}" @reset="${(e) => this.restart(e)}"
        @drag="${unwanted}" @dragstart="${unwanted}"
        @drop="${(e) => this.drop(e)}" @dragover="${drag}" @dragenter="${drag}" @dragleave="${dragover}" @dragend="${dragover}">
          <div @drag="${ignore}" @dragstart="${ignore}">
            <input @change="${(e) => this.fileschange(e)}" @focus="${focus}" @blur="${blur}" type="file" name="files[]" id="file" multiple />
            <label for="file"><slot name="label">Select file...</slot></label>
          </div>
          <div class="uploading"><slot name="uploading">Uploading&hellip;</slot></div>
          <div class="success"><slot name="success">Done!</slot> <input type="reset"></div>
          <div class="error"><slot name="error">Error!</slot> <span></span>. <input type="reset"></div>
        </form>`, this.shadowRoot);
  }

  triggerFormSubmit() {
    const form = this.shadowRoot.querySelector('form');
    form.dispatchEvent(new Event("submit"));
  }

  fileschange(event) {
    this.droppedFiles = event.target.files;
    this.triggerFormSubmit();
  }

  restart(e) {
    this.droppedFiles = [];
    e.preventDefault();
    e.stopPropagation();
    e.target.classList.remove('is-error', 'is-success');
  }

  drop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.target.classList.remove('is-dragover');
    this.droppedFiles = e.dataTransfer.files; // the files that were dropped
    this.triggerFormSubmit();
  }

  submit(event) {
    const form = event.target;
    const input = form.querySelector('input[type="file"]');
    const errorMsg = form.querySelector('.error span');
    
    // preventing the duplicate submissions if the current one is in progress
    if (form.classList.contains('is-uploading')) return false;
  
    form.classList.add('is-uploading');
    form.classList.remove('is-error');
  
    event.preventDefault();
  
    if (!this.droppedFiles.length) return;

    // gathering the form data
    var formdata = new FormData(form);
    console.log(this.droppedFiles);
    if (this.droppedFiles.length) {
      for (var file of this.droppedFiles)
        formdata.append(input.getAttribute('name'), file);
    }
  
    // ajax request
    var ajax = new XMLHttpRequest();
    ajax.open(form.getAttribute('method'), form.getAttribute('action'), true);
  
    ajax.onload = function () {
      form.classList.remove('is-uploading');
      if (ajax.status >= 200 && ajax.status < 400) {
        var data = JSON.parse(ajax.responseText);
        form.classList.add(data.success == true ? 'is-success' : 'is-error');
        if (!data.success)
          errorMsg.textContent = data.error;
      }
      else {
        form.classList.add('is-error');
        errorMsg.textContent = "Server responded with " + ajax.status;
      }
    };
  
    ajax.onerror = function (e) {
      form.classList.remove('is-uploading');
      form.classList.add('is-error');
      errorMsg.textContent = e;
    };
  
    ajax.send(formdata);
  }
}

customElements.define('ui-drop-zone', UiDropZone);

function unwanted(e) {
  e.preventDefault();
  e.stopPropagation();
}

function ignore(e) {
  e.preventDefault();
}

function focus(e) {
  e.target.classList.add('has-focus');
}

function blur(e) {
  e.target.classList.remove('has-focus');
}

function drag(e) {
  e.preventDefault();
  e.stopPropagation();
  e.target.classList.add('is-dragover');
}

function dragover(e) {
  e.preventDefault();
  e.stopPropagation();
  e.target.classList.remove('is-dragover');
}

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

var idcounter = 0;

/**
 * Add this web-component to your page for permanent (but closable) notifications.
 * Create elements of this type via script for dynamic notications.
 * 
 * Notifications with a timeout are removing themselves from the dom again automatically.
 * 
 * Static usage:
 * <ui-notification persistent>My awesome text</ui-notification>
 * 
 * Dynamic usage:
 * var el = document.createElement("ui-notification");
 * el.id = "login";
 * el.setAttribute("closetime", 3000);
 * el.innerHTML = "My dynamic <b>html</b> text";
 * document.body.appendChild(el);
 */
class UiNotification extends HTMLElement {
    constructor() {
        super();

        let tmpl = document.createElement('template');
        tmpl.innerHTML = `<style>:host {
            font-size: 16px;
            color: white;
            background: rgba(0, 0, 0, 0.9);
            line-height: 1.3em;
            padding: 10px 15px;
            margin: 5px 10px;
            position: relative;
            border-radius: 5px;
            transition: opacity 0.5s ease-in;
            display: block;
        }
        :host(.hide) {
            opacity: 0;
        }
        </style><slot></slot>`;
        let shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(tmpl.content.cloneNode(true));
    }
    connectedCallback() {
        this.id = this.hasAttribute("id") ? this.getAttribute("id") : this.id;
        this.target = this.hasAttribute("target") ? this.getAttribute("target") : "alert-area";
        this.hidebutton = this.hasAttribute("hidebutton");
        this.persistent = this.hasAttribute("persistent");
        this.closetime = this.hasAttribute("closetime") ? this.getAttribute("closetime") : 5000;

        if (!this.id) this.id = "notification" + idcounter;
        ++idcounter;

        let target = this.parentNode.ownerDocument.getElementById(this.target);
        if (target != this.parentNode) {
            // Remove existing notification with same id
            let oldmsg = target.querySelector("#" + this.id);
            if (oldmsg && oldmsg != this) oldmsg.remove();
            // Add new one
            target.appendChild(this);
            return;
        }

        const slot = this.shadowRoot.querySelector('slot');
        let nodes = slot.assignedNodes();
        if (!nodes.length) {
            this.innerHTML = "No content!";
            return;
        }

        var closelink = document.createElement("a");
        closelink.href = "#";
        closelink.setAttribute("data-close", "");
        closelink.style.float = "right";
        closelink.innerHTML = "<i class='fas fa-times'></i>";
        if (nodes[0].nodeType == 3) {
            nodes[0].parentNode.insertBefore(document.createElement("div"), nodes[0]);
            nodes[0].previousElementSibling.appendChild(nodes[0]);
        }
        nodes = slot.assignedNodes();
        nodes[0].prepend(closelink);

        for (const node of nodes) {
            var linksThatClose = node.querySelectorAll("a[data-close]");
            linksThatClose.forEach(link => {
                if (this.hidebutton) node.querySelector("a[data-close]").classList.add("d-none");
                else
                    link.addEventListener('click', event => {
                        event.preventDefault();
                        this.hide();
                    });
            });
        }



        if (this.persistent) return;
        this.alertTimeout = setTimeout(() => {
            this.alertTimeout = null;
            this.hide();
        }, this.closetime);
    }
    disconnectedCallback() {
        if (this.alertTimeout) clearTimeout(this.alertTimeout);
        if (this.disperseTimeout) clearTimeout(this.disperseTimeout);
        this.disperseTimeout = null;
    }
    hide() {
        this.classList.add('hide');
        this.disperseTimeout = setTimeout(() => this.remove(), 500);
    }
}

customElements.define('ui-notification', UiNotification);

/**
 * Update the "active" class for child links, depending on the current page url.
 */
class UiNav extends HTMLElement {
    constructor() {
        super();
        this.style.display = "none";
        this.pageChangedBound = () => this.connectedCallback();
        document.addEventListener("DOMContentLoaded", this.pageChangedBound);
    }
    disconnectedCallback() {
        document.removeEventListener("DOMContentLoaded", this.pageChangedBound);
    }
    connectedCallback() {
        var elems = this.parentNode.childNodes;
        const isExact = this.parentNode.classList.contains('exact');
        for (var elem of elems) {
            if (elem == this) continue;
            var link = elem.children[0];
            const classlist = link.classList;
            classlist.remove("active");
            if (link.href && (link.href == "#" || pageMatch(new URL(link.href), isExact)))
                classlist.add("active");
        }
    }
}

/**
 * Return true if the given url matches with the current window url.
 * @param {URL} url The URL
 * @param {boolean} isExact Only match if also the hash matches.
 */
function pageMatch(url, isExact) {
    var b = url.pathname == window.location.pathname;
    if (isExact) {
        b &= url.hash == window.location.hash;
    }
    return b;
}

customElements.define('ui-nav-auto-link', UiNav);

class UiTags extends HTMLElement {
    constructor() {
        super();
        this.tags = [];
    }
    connectedCallback() {
        this.classList.add("ui-tags");
        if (this.hasAttribute("suggestions")) {
            this.suggestionsDomID = Math.random().toString(36);
            var suggestionsEl = document.createElement("datalist");
            suggestionsEl.id = this.suggestionsDomID;
            var items =  this.getAttribute("suggestions").split(",");
            for (var item of items) {
                var openEL = document.createElement("option");
                openEL.setAttribute("value", item);
                suggestionsEl.appendChild(openEL);
            }
            document.body.appendChild(suggestionsEl);
        }
        this.render();
    }
    disconnectedCallback() {
        if (this.suggestionsDomID) {
            document.getElementById(this.suggestionsDomID).remove();
            delete this.suggestionsDomID;
        }
    }
    set value(val) {
        if (!Array.isArray(val)) {
            this.tags = val ? val.split(",") : [];
        } else
            this.tags = val.slice();
        this.render();
    }
    get value() {
        return this.tags;
    }
    addTag(sourceInput) {
        const tagname = sourceInput.value;
        if (!tagname || !tagname.length || this.tags.includes(tagname)) return;
        console.log("addTag", tagname);
        sourceInput.value = '';
        this.tags.push(tagname);
        this.render();
        setTimeout(() => sourceInput.focus(), 50);
        this.dispatchEvent(new Event("input"));
    }
    removeTag(tagname,e) {
        if (e) e.preventDefault();
        this.tags = this.tags.filter(t => t != tagname);
        console.log("remove", tagname, this.tags);
        this.render();
        this.dispatchEvent(new Event("input"));
    }
    inputKey(event) {
        if (event.key == 'Enter') {
            event.preventDefault();
            this.addTag(event.target);
        }
    }
    render() {
        const tagsEl = this.tags.map((tag) =>
            html`<div class="ui-tag-list"><span>${tag}</span>
                <button @click="${(e) => this.removeTag(tag,e)}" class="btn btn-danger-hover p-0"><i class="fas fa-times"></i></button>
            </div>`
        );
        render(html`${tagsEl}<div style="min-width:120px"><div class="ui-tags-add btn btn-success-hover p-0">
                <i class="fas fa-plus" @click=${(event) => this.addTag(event.target.nextElementSibling)}></i>
                <input list="${this.suggestionsDomID}" placeholder="Add" oninput="event.stopPropagation()"
                    @keypress="${(event) => this.inputKey(event)}">
            </div></div>`, this);
    }
}

customElements.define('ui-tags', UiTags);

class UiDropdown extends HTMLElement {
    constructor() {
        super();
        this.options = {};
        this.isShown = false;
    }
    connectedCallback() {
        if (!Object.keys(this.options).length && this.hasAttribute("options")) {
            var items = this.getAttribute("options").split(",");
            for (var item of items) this.options[item] = item;
        }
        this.icons = this.hasAttribute("icons") ? this.getAttribute("icons") : null;
        this.novalue = this.hasAttribute("novalue");
        this.classes = this.hasAttribute("btnclass") ? this.getAttribute("btnclass") : "btn btn-primary-hover btn-sm";
        this.bodyClickBound = () => this.close();
        this.addEventListener("click", e => e.stopPropagation());
        this.classList.add("dropdown");
        this.attributeChangedCallback();
        this.render();
    }
    static get observedAttributes() {
        return ['value'];
    }
    attributeChangedCallback(name, oldValue, newValue) {
        this.value = this.hasAttribute("value") ? this.getAttribute("value") : this.value;
    }
    toggleShow() {
        if (this.isShown) this.close(); else this.open();
    }
    close() {
        this.isShown = false;
        document.body.removeEventListener("click", this.bodyClickBound);
        this.render();
    }
    open() {
        this.isShown = true;
        document.body.addEventListener("click", this.bodyClickBound);
        this.render();
    }
    select(key) {
        this.close();

        if (this.novalue) {
            this.dispatchEvent(new CustomEvent("input", { detail: key }));
            return;
        }
        this.value = key;
        this.dispatchEvent(new Event("input"));
        this.render();
    }
    render() {
        const optionEls = Object.keys(this.options).map(key =>
            html`<a @click=${(event) => this.select(event.target.dataset.key)}
                class="dropdown-item ${this.value == key ? 'active' : ''}" href="#" data-key=${key}>
                <div style="pointer-events: none">
                    ${this.icons ? html`<img style="float:left;width:40px;max-height:40px;margin-right:10px;" src="img/${this.icons}/${key}.png">` : ''}
                    ${key}<br><small>${this.options[key]}</small>
                </div>
            </a>`
        );
        render(html`
        <button class="${this.classes} dropdown-toggle" type="button" data-toggle="dropdown"
            aria-haspopup="true" aria-expanded="false" @click=${this.toggleShow.bind(this)}>
          ${this.value}
        </button>
        <div class="dropdown-menu ${this.isShown ? 'show' : ''}">
          ${optionEls}
        </div>`, this);
    }
}

customElements.define('ui-dropdown', UiDropdown);

/**
 * A tabbing component. 
 * 
 * Usage:
`<ui-tabs>
  <ul class="nav nav-tabs" slot="links">
    <li class="nav-item"><a class="nav-link" href="#">First tab</a></li>
    <li class="nav-item"><a class="nav-link" href="#">Second tab</a></li>
    <li class="nav-item"><a class="nav-link" href="#">Third tab</a></li>
  </ul>
  <div class="tab-content" slot="tabs">
    <div>First</div>
    <div>Second</div>
    <div>Third</div>
  </div>
</ui-tabs>`
 *
 */
class UiTabs extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  activateTab(index, event = null) {
    if (event) {
      event.preventDefault();
      for (var e of this.links) { e.classList.remove("active"); }
      for (var e of this.tabs) { e.style.visibility = "hidden"; }
    }
    this.links[index].classList.add("active");
    this.tabs[index].style.visibility = "visible";
  }
  connectedCallback() {
    this.style.display="block";
    this.shadowRoot.innerHTML = `<slot name="links"></slot><slot name="tabs"></slot>`;

    let linkUl = this.shadowRoot.querySelector('slot[name="links"]').assignedNodes()[0];
    this.links = linkUl.querySelectorAll(".nav-link");
    for (var i = 0; i < this.links.length; ++i) {
      const index = i;
      this.links[index].addEventListener("click", (e) => this.activateTab(index, e));
    }

    var tabSlot = this.shadowRoot.querySelector('slot[name="tabs"]').assignedNodes()[0];
    tabSlot.style.display="grid";
    this.tabs = tabSlot.children;
    for (var e of this.tabs) {
      e.style["grid-row-start"] = 1;
      e.style["grid-column-start"] = 1;
      e.style.visibility = "hidden";
    }

    this.activateTab(0);
  }
  disconnectedCallback() {
  }
}

customElements.define('ui-tabs', UiTabs);

var style$1 = "@charset \"UTF-8\";\n.multiselect {\n  position: relative;\n  box-sizing: border-box;\n  display: inline-block;\n  width: 20em;\n  min-height: 1rem;\n}\n\n.multiselect-field {\n  overflow: hidden;\n  padding: 0.2em 0.2em 0 0.2em;\n  border: 1px solid #adadad;\n  border-radius: 0.2em;\n  cursor: pointer;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.multiselect-field-placeholder {\n  padding: 0.25em 0.5em;\n  margin-bottom: 0.2em;\n  color: #888;\n  line-height: 1;\n}\n\n.multiselect-tag {\n  position: relative;\n  display: inline-block;\n  padding: 0.25em 1.5em 0.25em 0.5em;\n  border: 1px solid #bdbdbd;\n  border-radius: 0.2em;\n  margin: 0 0.2em 0.2em 0;\n  line-height: 1;\n  vertical-align: middle;\n}\n\n.multiselect-tag:last-child {\n  margin-right: 0;\n}\n\n.multiselect-tag:hover {\n  background: #efefef;\n}\n\n.multiselect-tag-text {\n  min-height: 1em;\n}\n\n.multiselect-tag-remove-button {\n  position: absolute;\n  top: 0.25em;\n  right: 0.25em;\n  width: 1em;\n  height: 1em;\n  opacity: 0.3;\n}\n\n.multiselect-tag-remove-button:hover {\n  opacity: 1;\n}\n\n.multiselect-tag-remove-button:before,\n.multiselect-tag-remove-button:after {\n  content: \" \";\n  position: absolute;\n  left: 0.5em;\n  width: 2px;\n  height: 1em;\n  background-color: #333;\n}\n\n.multiselect-tag-remove-button:before {\n  transform: rotate(45deg);\n}\n\n.multiselect-tag-remove-button:after {\n  transform: rotate(-45deg);\n}\n\n.multiselect-popup {\n  position: absolute;\n  z-index: 1000;\n  display: none;\n  overflow-y: auto;\n  width: 100%;\n  max-height: 300px;\n  box-sizing: border-box;\n  border: 1px solid #bdbdbd;\n  border-radius: 0.2em;\n  background: white;\n}\n\n.multiselect-list {\n  padding: 0;\n  margin: 0;\n}\n\n.multiselect-list li {\n  padding: 0.5em 1em;\n  min-height: 1em;\n  list-style: none;\n  cursor: pointer;\n}\n\n.multiselect-list li[selected] {\n  background: #f3f3f3;\n}\n.multiselect-list li[selected]::before {\n  content: \"✔\";\n  padding-right: 10px;\n}\n\n.multiselect-list li:focus {\n  outline: dotted 1px #333;\n  background: #e9e9e9;\n}\n\n.multiselect-list li:hover {\n  background: #e9e9e9;\n}";

class UImultiSelect extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        this._options = {
            placeholder: this.getAttribute("placeholder") || 'Select'
        };
        this.render();
        this._root = this.shadowRoot;
        this._control = this._root.querySelector('.multiselect');
        this._field = this._root.querySelector('.multiselect-field');
        this._popup = this._root.querySelector('.multiselect-popup');
        this._list = this._root.querySelector('.multiselect-list');

        this._field.addEventListener('click', this.fieldClickHandler.bind(this));
        this._control.addEventListener('keydown', this.keyDownHandler.bind(this));
        this._list.addEventListener('click', this.listClickHandler.bind(this));

        if (this.hasAttribute("options")) {
            const items = this.getAttribute("options").split(",");
            for (var item of items) {
                var liEl = document.createElement("li");
                liEl.value = item;
                liEl.textContent = item;
                this._list.appendChild(liEl);
            }
        }

        this.refreshField();
        this.refreshItems();
    }
    disconnectedCallback() {
    }
    fieldClickHandler() {
        this._isOpened ? this.close() : this.open();
    }
    keyDownHandler(event) {
        switch (event.which) {
            case 8:
                this.handleBackspaceKey();
                break;
            case 13:
                this.handleEnterKey();
                break;
            case 27:
                this.handleEscapeKey();
                break;
            case 38:
                event.altKey ? this.handleAltArrowUpKey() : this.handleArrowUpKey();
                break;
            case 40:
                event.altKey ? this.handleAltArrowDownKey() : this.handleArrowDownKey();
                break;
            default:
                return;
        }
        event.preventDefault();
    }

    handleEnterKey() {
        if (this._isOpened) {
            var focusedItem = this.itemElements[this._focusedItemIndex];
            this.selectItem(focusedItem);
        }
    };
    handleArrowDownKey() {
        this._focusedItemIndex = (this._focusedItemIndex < this.itemElements.length - 1)
            ? this._focusedItemIndex + 1
            : 0;
        this.refreshFocusedItem();
    };
    handleArrowUpKey() {
        this._focusedItemIndex = (this._focusedItemIndex > 0)
            ? this._focusedItemIndex - 1
            : this.itemElements.length - 1;
        this.refreshFocusedItem();
    };
    handleAltArrowDownKey() {
        this.open();
    };
    handleAltArrowUpKey() {
        this.close();
    };
    refreshFocusedItem() {
        var el = this.itemElements[this._focusedItemIndex];
        if (el) el.focus();
    };
    handleBackspaceKey() {
        var selectedItemElements = this._root.querySelectorAll("li[selected]");
        if (selectedItemElements.length) {
            this.unselectItem(selectedItemElements[selectedItemElements.length - 1]);
        }
    };
    handleEscapeKey() {
        this.close();
    };
    listClickHandler(event) {
        var item = event.target;
        while (item && item.tagName !== 'LI') {
            item = item.parentNode;
        }
        this.selectItem(item);
    };
    selectItem(item) {
        if (!item.hasAttribute('selected')) {
            item.setAttribute('selected', 'selected');
            item.setAttribute('aria-selected', true);
            this.fireChangeEvent();
            this.refreshField();
        }
        this.close();
    };
    fireChangeEvent() {
        var event = new CustomEvent("change");
        this.dispatchEvent(event);
    };
    togglePopup(show) {
        this._isOpened = show;
        this._popup.style.display = show ? 'block' : 'none';
        this._control.setAttribute("aria-expanded", show);
    };
    refreshField() {
        this._field.innerHTML = '';
        var selectedItems = this._root.querySelectorAll('li[selected]');
        if (!selectedItems.length) {
            this._field.appendChild(this.createPlaceholder());
            return;
        }
        for (var i = 0; i < selectedItems.length; i++) {
            this._field.appendChild(this.createTag(selectedItems[i]));
        }
    };
    refreshItems() {
        var itemElements = this.itemElements;
        for (var i = 0; i < itemElements.length; i++) {
            var itemElement = itemElements[i];
            itemElement.setAttribute("role", "option");
            itemElement.setAttribute("aria-selected", itemElement.hasAttribute("selected"));
            itemElement.setAttribute("tabindex", -1);
        }
        this._focusedItemIndex = 0;
    };
    get itemElements() {
        return this._root.querySelectorAll('li');
    };
    createPlaceholder() {
        var placeholder = document.createElement('div');
        placeholder.className = 'multiselect-field-placeholder';
        placeholder.textContent = this._options.placeholder;
        return placeholder;
    };
    createTag(item) {
        var tag = document.createElement('div');
        tag.className = 'multiselect-tag';
        var content = document.createElement('div');
        content.className = 'multiselect-tag-text';
        content.textContent = item.textContent;
        var removeButton = document.createElement('div');
        removeButton.className = 'multiselect-tag-remove-button';
        removeButton.addEventListener('click', this.removeTag.bind(this, tag, item));
        tag.appendChild(content);
        tag.appendChild(removeButton);
        return tag;
    };
    removeTag(tag, item, event) {
        this.unselectItem(item);
        event.stopPropagation();
    };
    unselectItem(item) {
        item.removeAttribute('selected');
        item.setAttribute('aria-selected', false);
        this.fireChangeEvent();
        this.refreshField();
    };
    attributeChangedCallback(optionName, oldValue, newValue) {
        this._options[optionName] = newValue;
        this.refreshField();
    };
    open() {
        this.togglePopup(true);
        this.refreshFocusedItem();
    };
    close() {
        this.togglePopup(false);
        this._field.focus();
    };
    selectedItems() {
        var result = [];
        var selectedItems = this._root.querySelectorAll('li[selected]');
        for (var i = 0; i < selectedItems.length; i++) {
            var selectedItem = selectedItems[i];
            result.push(selectedItem.hasAttribute('value')
                ? selectedItem.getAttribute('value')
                : selectedItem.textContent);
        }
        return result;
    };
    render() {
        render(html`<style>${style$1}</style>
        <div class="multiselect" role="combobox">
            <div class="multiselect-field" tabindex="0"></div>
            <div class="multiselect-popup">
                <ul class="multiselect-list" role="listbox" aria-multiselectable="true">
                    
                </ul>
            </div>
        </div>
        `, this.shadowRoot);
    }
}

customElements.define('ui-multiselect', UImultiSelect);

// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

// Pattern is a zero-conflict wrapper extending RegExp features
// in order to make YAML parsing regex more expressive.
//
class Pattern {
    static initClass() {
    
        // @property [RegExp] The RegExp instance
        this.prototype.regex =          null;
    
        // @property [String] The raw regex string
        this.prototype.rawRegex =       null;
    
        // @property [String] The cleaned regex string (used to create the RegExp instance)
        this.prototype.cleanedRegex =   null;
    
        // @property [Object] The dictionary mapping names to capturing bracket numbers
        this.prototype.mapping =        null;
    }

    // Constructor
    //
    // @param [String] rawRegex The raw regex string defining the pattern
    //
    constructor(rawRegex, modifiers) {
        if (modifiers == null) { modifiers = ''; }
        let cleanedRegex = '';
        const len = rawRegex.length;
        let mapping = null;

        // Cleanup raw regex and compute mapping
        let capturingBracketNumber = 0;
        let i = 0;
        while (i < len) {
            const _char = rawRegex.charAt(i);
            if (_char === '\\') {
                // Ignore next character
                cleanedRegex += rawRegex.slice(i, +(i+1) + 1 || undefined);
                i++;
            } else if (_char === '(') {
                // Increase bracket number, only if it is capturing
                if (i < (len - 2)) {
                    const part = rawRegex.slice(i, +(i+2) + 1 || undefined);
                    if (part === '(?:') {
                        // Non-capturing bracket
                        i += 2;
                        cleanedRegex += part;
                    } else if (part === '(?<') {
                        // Capturing bracket with possibly a name
                        capturingBracketNumber++;
                        i += 2;
                        let name = '';
                        while ((i + 1) < len) {
                            const subChar = rawRegex.charAt(i + 1);
                            if (subChar === '>') {
                                cleanedRegex += '(';
                                i++;
                                if (name.length > 0) {
                                    // Associate a name with a capturing bracket number
                                    if (mapping == null) { mapping = {}; }
                                    mapping[name] = capturingBracketNumber;
                                }
                                break;
                            } else {
                                name += subChar;
                            }

                            i++;
                        }
                    } else {
                        cleanedRegex += _char;
                        capturingBracketNumber++;
                    }
                } else {
                    cleanedRegex += _char;
                }
            } else {
                cleanedRegex += _char;
            }

            i++;
        }

        this.rawRegex = rawRegex;
        this.cleanedRegex = cleanedRegex;
        this.regex = new RegExp(this.cleanedRegex, `g${modifiers.replace('g', '')}`);
        this.mapping = mapping;
    }


    // Executes the pattern's regex and returns the matching values
    //
    // @param [String] str The string to use to execute the pattern
    //
    // @return [Array] The matching values extracted from capturing brackets or null if nothing matched
    //
    exec(str) {
        this.regex.lastIndex = 0;
        const matches = this.regex.exec(str);

        if ((matches == null)) {
            return null;
        }

        if (this.mapping != null) {
            for (let name in this.mapping) {
                const index = this.mapping[name];
                matches[name] = matches[index];
            }
        }

        return matches;
    }


    // Tests the pattern's regex
    //
    // @param [String] str The string to use to test the pattern
    //
    // @return [Boolean] true if the string matched
    //
    test(str) {
        this.regex.lastIndex = 0;
        return this.regex.test(str);
    }


    // Replaces occurences matching with the pattern's regex with replacement
    //
    // @param [String] str The source string to perform replacements
    // @param [String] replacement The string to use in place of each replaced occurence.
    //
    // @return [String] The replaced string
    //
    replace(str, replacement) {
        this.regex.lastIndex = 0;
        return str.replace(this.regex, replacement);
    }


    // Replaces occurences matching with the pattern's regex with replacement and
    // get both the replaced string and the number of replaced occurences in the string.
    //
    // @param [String] str The source string to perform replacements
    // @param [String] replacement The string to use in place of each replaced occurence.
    // @param [Integer] limit The maximum number of occurences to replace (0 means infinite number of occurences)
    //
    // @return [Array] A destructurable array containing the replaced string and the number of replaced occurences. For instance: ["my replaced string", 2]
    //
    replaceAll(str, replacement, limit) {
        if (limit == null) { limit = 0; }
        this.regex.lastIndex = 0;
        let count = 0;
        while (this.regex.test(str) && ((limit === 0) || (count < limit))) {
            this.regex.lastIndex = 0;
            str = str.replace(this.regex, replacement);
            count++;
        }
        
        return [str, count];
    }
}
Pattern.initClass();

// TODO: This file was created by bulk-decaffeinate.

// A bunch of utility methods
//
class Utils {
    static initClass() {
    
        this.REGEX_LEFT_TRIM_BY_CHAR =   {};
        this.REGEX_RIGHT_TRIM_BY_CHAR =  {};
        this.REGEX_SPACES =              /\s+/g;
        this.REGEX_DIGITS =              /^\d+$/;
        this.REGEX_OCTAL =               /[^0-7]/gi;
        this.REGEX_HEXADECIMAL =         /[^a-f0-9]/gi;
    
        // Precompiled date pattern
        this.PATTERN_DATE =              new Pattern('^'+
                '(?<year>[0-9][0-9][0-9][0-9])'+
                '-(?<month>[0-9][0-9]?)'+
                '-(?<day>[0-9][0-9]?)'+
                '(?:(?:[Tt]|[ \t]+)'+
                '(?<hour>[0-9][0-9]?)'+
                ':(?<minute>[0-9][0-9])'+
                ':(?<second>[0-9][0-9])'+
                '(?:\.(?<fraction>[0-9]*))?'+
                '(?:[ \t]*(?<tz>Z|(?<tz_sign>[-+])(?<tz_hour>[0-9][0-9]?)'+
                '(?::(?<tz_minute>[0-9][0-9]))?))?)?'+
                '$', 'i');
    
        // Local timezone offset in ms
        this.LOCAL_TIMEZONE_OFFSET =     new Date().getTimezoneOffset() * 60 * 1000;
    }

    // Trims the given string on both sides
    //
    // @param [String] str The string to trim
    // @param [String] _char The character to use for trimming (default: '\\s')
    //
    // @return [String] A trimmed string
    //
    static trim(str, _char) {
        if (_char == null) { _char = '\\s'; }
        let regexLeft = this.REGEX_LEFT_TRIM_BY_CHAR[_char];
        if (regexLeft == null) {
            this.REGEX_LEFT_TRIM_BY_CHAR[_char] = (regexLeft = new RegExp(`^${_char}${_char}*`));
        }
        regexLeft.lastIndex = 0;
        let regexRight = this.REGEX_RIGHT_TRIM_BY_CHAR[_char];
        if (regexRight == null) {
            this.REGEX_RIGHT_TRIM_BY_CHAR[_char] = (regexRight = new RegExp(_char+''+_char+'*$'));
        }
        regexRight.lastIndex = 0;
        return str.replace(regexLeft, '').replace(regexRight, '');
    }


    // Trims the given string on the left side
    //
    // @param [String] str The string to trim
    // @param [String] _char The character to use for trimming (default: '\\s')
    //
    // @return [String] A trimmed string
    //
    static ltrim(str, _char) {
        if (_char == null) { _char = '\\s'; }
        let regexLeft = this.REGEX_LEFT_TRIM_BY_CHAR[_char];
        if (regexLeft == null) {
            this.REGEX_LEFT_TRIM_BY_CHAR[_char] = (regexLeft = new RegExp(`^${_char}${_char}*`));
        }
        regexLeft.lastIndex = 0;
        return str.replace(regexLeft, '');
    }


    // Trims the given string on the right side
    //
    // @param [String] str The string to trim
    // @param [String] _char The character to use for trimming (default: '\\s')
    //
    // @return [String] A trimmed string
    //
    static rtrim(str, _char) {
        if (_char == null) { _char = '\\s'; }
        let regexRight = this.REGEX_RIGHT_TRIM_BY_CHAR[_char];
        if (regexRight == null) {
            this.REGEX_RIGHT_TRIM_BY_CHAR[_char] = (regexRight = new RegExp(_char+''+_char+'*$'));
        }
        regexRight.lastIndex = 0;
        return str.replace(regexRight, '');
    }


    // Checks if the given value is empty (null, undefined, empty string, string '0', empty Array, empty Object)
    //
    // @param [Object] value The value to check
    //
    // @return [Boolean] true if the value is empty
    //
    static isEmpty(value) {
        return !(value) || (value === '') || (value === '0') || (value instanceof Array && (value.length === 0)) || this.isEmptyObject(value);
    }

    // Checks if the given value is an empty object
    //
    // @param [Object] value The value to check
    //
    // @return [Boolean] true if the value is empty and is an object
    //
    static isEmptyObject(value) {
        return value instanceof Object && (((() => {
            const result = [];
            for (let k of Object.keys(value || {})) {
                result.push(k);
            }
            return result;
        })()).length === 0);
    }

    // Counts the number of occurences of subString inside string
    //
    // @param [String] string The string where to count occurences
    // @param [String] subString The subString to count
    // @param [Integer] start The start index
    // @param [Integer] length The string length until where to count
    //
    // @return [Integer] The number of occurences
    //
    static subStrCount(string, subString, start, length) {
        let c = 0;

        string = `${string}`;
        subString = `${subString}`;

        if (start != null) {
            string = string.slice(start);
        }
        if (length != null) {
            string = string.slice(0, length);
        }

        const len = string.length;
        const sublen = subString.length;
        for (let j = 0, i = j, end = len, asc = 0 <= end; asc ? j < end : j > end; asc ? j++ : j--, i = j) {
            if (subString === string.slice(i, sublen)) {
                c++;
                i += sublen - 1;
            }
        }

        return c;
    }


    // Returns true if input is only composed of digits
    //
    // @param [Object] input The value to test
    //
    // @return [Boolean] true if input is only composed of digits
    //
    static isDigits(input) {
        this.REGEX_DIGITS.lastIndex = 0;
        return this.REGEX_DIGITS.test(input);
    }


    // Decode octal value
    //
    // @param [String] input The value to decode
    //
    // @return [Integer] The decoded value
    //
    static octDec(input) {
        this.REGEX_OCTAL.lastIndex = 0;
        return parseInt((input+'').replace(this.REGEX_OCTAL, ''), 8);
    }


    // Decode hexadecimal value
    //
    // @param [String] input The value to decode
    //
    // @return [Integer] The decoded value
    //
    static hexDec(input) {
        this.REGEX_HEXADECIMAL.lastIndex = 0;
        input = this.trim(input);
        if ((input+'').slice(0, 2) === '0x') { input = (input+'').slice(2); }
        return parseInt((input+'').replace(this.REGEX_HEXADECIMAL, ''), 16);
    }


    // Get the UTF-8 character for the given code point.
    //
    // @param [Integer] c The unicode code point
    //
    // @return [String] The corresponding UTF-8 character
    //
    static utf8chr(c) {
        const ch = String.fromCharCode;
        if (0x80 > (c %= 0x200000)) {
            return ch(c);
        }
        if (0x800 > c) {
            return ch(0xC0 | (c>>6)) + ch(0x80 | (c & 0x3F));
        }
        if (0x10000 > c) {
            return ch(0xE0 | (c>>12)) + ch(0x80 | ((c>>6) & 0x3F)) + ch(0x80 | (c & 0x3F));
        }

        return ch(0xF0 | (c>>18)) + ch(0x80 | ((c>>12) & 0x3F)) + ch(0x80 | ((c>>6) & 0x3F)) + ch(0x80 | (c & 0x3F));
    }


    // Returns the boolean value equivalent to the given input
    //
    // @param [String|Object]    input       The input value
    // @param [Boolean]          strict      If set to false, accept 'yes' and 'no' as boolean values
    //
    // @return [Boolean]         the boolean value
    //
    static parseBoolean(input, strict) {
        if (strict == null) { strict = true; }
        if (typeof(input) === 'string') {
            const lowerInput = input.toLowerCase();
            if (!strict) {
                if (lowerInput === 'no') { return false; }
            }
            if (lowerInput === '0') { return false; }
            if (lowerInput === 'false') { return false; }
            if (lowerInput === '') { return false; }
            return true;
        }
        return !!input;
    }



    // Returns true if input is numeric
    //
    // @param [Object] input The value to test
    //
    // @return [Boolean] true if input is numeric
    //
    static isNumeric(input) {
        this.REGEX_SPACES.lastIndex = 0;
        return (typeof(input) === 'number') || ((typeof(input) === 'string') && !isNaN(input) && (input.replace(this.REGEX_SPACES, '') !== ''));
    }


    // Returns a parsed date from the given string
    //
    // @param [String] str The date string to parse
    //
    // @return [Date] The parsed date or null if parsing failed
    //
    static stringToDate(str) {
        let date, fraction, tz_offset;
        if (!(str != null ? str.length : undefined)) {
            return null;
        }

        // Perform regular expression pattern
        const info = this.PATTERN_DATE.exec(str);
        if (!info) {
            return null;
        }

        // Extract year, month, day
        const year = parseInt(info.year, 10);
        const month = parseInt(info.month, 10) - 1; // In javascript, january is 0, february 1, etc...
        const day = parseInt(info.day, 10);

        // If no hour is given, return a date with day precision
        if (info.hour == null) {
            date = new Date(Date.UTC(year, month, day));
            return date;
        }

        // Extract hour, minute, second
        const hour = parseInt(info.hour, 10);
        const minute = parseInt(info.minute, 10);
        const second = parseInt(info.second, 10);

        // Extract fraction, if given
        if (info.fraction != null) {
            fraction = info.fraction.slice(0, 3);
            while (fraction.length < 3) {
                fraction += '0';
            }
            fraction = parseInt(fraction, 10);
        } else {
            fraction = 0;
        }

        // Compute timezone offset if given
        if (info.tz != null) {
            let tz_minute;
            const tz_hour = parseInt(info.tz_hour, 10);
            if (info.tz_minute != null) {
                tz_minute = parseInt(info.tz_minute, 10);
            } else {
                tz_minute = 0;
            }

            // Compute timezone delta in ms
            tz_offset = ((tz_hour * 60) + tz_minute) * 60000;
            if ('-' === info.tz_sign) {
                tz_offset *= -1;
            }
        }

        // Compute date
        date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
        if (tz_offset) {
            date.setTime(date.getTime() - tz_offset);
        }

        return date;
    }


    // Repeats the given string a number of times
    //
    // @param [String]   str     The string to repeat
    // @param [Integer]  number  The number of times to repeat the string
    //
    // @return [String]  The repeated string
    //
    static strRepeat(str, number) {
        let res = '';
        let i = 0;
        while (i < number) {
            res += str;
            i++;
        }
        return res;
    }


    // Reads the data from the given file path and returns the result as string
    //
    // @param [String]   path        The path to the file
    // @param [Function] callback    A callback to read file asynchronously (optional)
    //
    // @return [String]  The resulting data as string
    //
    static getStringFromFile(path, callback = null) {
        let xhr = null;
        if (typeof window !== 'undefined' && window !== null) {
            if (window.XMLHttpRequest) {
                xhr = new XMLHttpRequest();
            } else if (window.ActiveXObject) {
                for (let name of ["Msxml2.XMLHTTP.6.0", "Msxml2.XMLHTTP.3.0", "Msxml2.XMLHTTP", "Microsoft.XMLHTTP"]) {
                    try {
                        xhr = new ActiveXObject(name);
                    } catch (error) {}
                }
            }
        }

        if (xhr != null) {
            // Browser
            if (callback != null) {
                // Async
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if ((xhr.status === 200) || (xhr.status === 0)) {
                            return callback(xhr.responseText);
                        } else {
                            return callback(null);
                        }
                    }
                };
                xhr.open('GET', path, true);
                return xhr.send(null);

            } else {
                // Sync
                xhr.open('GET', path, false);
                xhr.send(null);

                if ((xhr.status === 200) || (xhr.status === 0)) {
                    return xhr.responseText;
                }

                return null;
            }
        } else {
            // Node.js-like
            const req = require;
            const fs = req('fs'); // Prevent browserify from trying to load 'fs' module
            if (callback != null) {
                // Async
                return fs.readFile(path, function(err, data) {
                    if (err) {
                        return callback(null);
                    } else {
                        return callback(String(data));
                    }
                });

            } else {
                // Sync
                const data = fs.readFileSync(path);
                if (data != null) {
                    return String(data);
                }
                return null;
            }
        }
    }
}
Utils.initClass();

// TODO: This file was created by bulk-decaffeinate.

// Unescaper encapsulates unescaping rules for single and double-quoted YAML strings.
//
class Unescaper {
    static initClass() {
    
        // Regex fragment that matches an escaped character in
        // a double quoted string.
        this.PATTERN_ESCAPED_CHARACTER =     new Pattern('\\\\([0abt\tnvfre "\\/\\\\N_LP]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})');
        
    }


    // Unescapes a single quoted string.
    //
    // @param [String]       value A single quoted string.
    //
    // @return [String]      The unescaped string.
    //
    static unescapeSingleQuotedString(value) {
        return value.replace(/\'\'/g, '\'');
    }


    // Unescapes a double quoted string.
    //
    // @param [String]       value A double quoted string.
    //
    // @return [String]      The unescaped string.
    //
    static unescapeDoubleQuotedString(value) {
        if (this._unescapeCallback == null) { this._unescapeCallback = str => {
            return this.unescapeCharacter(str);
        }; }

        // Evaluate the string
        return this.PATTERN_ESCAPED_CHARACTER.replace(value, this._unescapeCallback);
    }


    // Unescapes a character that was found in a double-quoted string
    //
    // @param [String]       value An escaped character
    //
    // @return [String]      The unescaped character
    //
    static unescapeCharacter(value) {
        const ch = String.fromCharCode;
        switch (value.charAt(1)) {
            case '0':
                return ch(0);
            case 'a':
                return ch(7);
            case 'b':
                return ch(8);
            case 't':
                return "\t";
            case "\t":
                return "\t";
            case 'n':
                return "\n";
            case 'v':
                return ch(11);
            case 'f':
                return ch(12);
            case 'r':
                return ch(13);
            case 'e':
                return ch(27);
            case ' ':
                return ' ';
            case '"':
                return '"';
            case '/':
                return '/';
            case '\\':
                return '\\';
            case 'N':
                // U+0085 NEXT LINE
                return ch(0x0085);
            case '_':
                // U+00A0 NO-BREAK SPACE
                return ch(0x00A0);
            case 'L':
                // U+2028 LINE SEPARATOR
                return ch(0x2028);
            case 'P':
                // U+2029 PARAGRAPH SEPARATOR
                return ch(0x2029);
            case 'x':
                return Utils.utf8chr(Utils.hexDec(value.substr(2, 2)));
            case 'u':
                return Utils.utf8chr(Utils.hexDec(value.substr(2, 4)));
            case 'U':
                return Utils.utf8chr(Utils.hexDec(value.substr(2, 8)));
            default:
                return '';
        }
    }
}
Unescaper.initClass();

// TODO: This file was created by bulk-decaffeinate.

// Escaper encapsulates escaping rules for single
// and double-quoted YAML strings.
class Escaper {
    static initClass() {
    
        // Mapping arrays for escaping a double quoted string. The backslash is
        // first to ensure proper escaping.
        let ch;
        this.LIST_ESCAPEES =                 ['\\', '\\\\', '\\"', '"',
                                         "\x00",  "\x01",  "\x02",  "\x03",  "\x04",  "\x05",  "\x06",  "\x07",
                                         "\x08",  "\x09",  "\x0a",  "\x0b",  "\x0c",  "\x0d",  "\x0e",  "\x0f",
                                         "\x10",  "\x11",  "\x12",  "\x13",  "\x14",  "\x15",  "\x16",  "\x17",
                                         "\x18",  "\x19",  "\x1a",  "\x1b",  "\x1c",  "\x1d",  "\x1e",  "\x1f",
                                         (ch = String.fromCharCode)(0x0085), ch(0x00A0), ch(0x2028), ch(0x2029)];
        this.LIST_ESCAPED =                  ['\\\\', '\\"', '\\"', '\\"',
                                         "\\0",   "\\x01", "\\x02", "\\x03", "\\x04", "\\x05", "\\x06", "\\a",
                                         "\\b",   "\\t",   "\\n",   "\\v",   "\\f",   "\\r",   "\\x0e", "\\x0f",
                                         "\\x10", "\\x11", "\\x12", "\\x13", "\\x14", "\\x15", "\\x16", "\\x17",
                                         "\\x18", "\\x19", "\\x1a", "\\e",   "\\x1c", "\\x1d", "\\x1e", "\\x1f",
                                         "\\N", "\\_", "\\L", "\\P"];
    
        this.MAPPING_ESCAPEES_TO_ESCAPED =   (() => {
            const mapping = {};
            for (let i = 0, end = this.LIST_ESCAPEES.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                mapping[this.LIST_ESCAPEES[i]] = this.LIST_ESCAPED[i];
            }
            return mapping;
        })();
    
        // Characters that would cause a dumped string to require double quoting.
        this.PATTERN_CHARACTERS_TO_ESCAPE =  new Pattern('[\\x00-\\x1f]|\xc2\x85|\xc2\xa0|\xe2\x80\xa8|\xe2\x80\xa9');
    
        // Other precompiled patterns
        this.PATTERN_MAPPING_ESCAPEES =      new Pattern(this.LIST_ESCAPEES.join('|').split('\\').join('\\\\'));
        this.PATTERN_SINGLE_QUOTING =        new Pattern('[\\s\'":{}[\\],&*#?]|^[-?|<>=!%@`]');
    }



    // Determines if a JavaScript value would require double quoting in YAML.
    //
    // @param [String]   value   A JavaScript value value
    //
    // @return [Boolean] true    if the value would require double quotes.
    //
    static requiresDoubleQuoting(value) {
        return this.PATTERN_CHARACTERS_TO_ESCAPE.test(value);
    }


    // Escapes and surrounds a JavaScript value with double quotes.
    //
    // @param [String]   value   A JavaScript value
    //
    // @return [String]  The quoted, escaped string
    //
    static escapeWithDoubleQuotes(value) {
        const result = this.PATTERN_MAPPING_ESCAPEES.replace(value, str => {
            return this.MAPPING_ESCAPEES_TO_ESCAPED[str];
    });
        return `"${result}"`;
    }


    // Determines if a JavaScript value would require single quoting in YAML.
    //
    // @param [String]   value   A JavaScript value
    //
    // @return [Boolean] true if the value would require single quotes.
    //
    static requiresSingleQuoting(value) {
        return this.PATTERN_SINGLE_QUOTING.test(value);
    }


    // Escapes and surrounds a JavaScript value with single quotes.
    //
    // @param [String]   value   A JavaScript value
    //
    // @return [String]  The quoted, escaped string
    //
    static escapeWithSingleQuotes(value) {
        return `'${value.replace(/'/g, "''")}'`;
    }
}
Escaper.initClass();

// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

class ParseException extends Error {

    constructor(message, parsedLine, snippet) {
        this.message = message;
        this.parsedLine = parsedLine;
        this.snippet = snippet;
    }

    toString() {
        if ((this.parsedLine != null) && (this.snippet != null)) {
            return `<ParseException> ${this.message} (line ${this.parsedLine}: '${this.snippet}')`;
        } else {
            return `<ParseException> ${this.message}`;
        }
    }
}

// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

class ParseMore extends Error {

    constructor(message, parsedLine, snippet) {
        this.message = message;
        this.parsedLine = parsedLine;
        this.snippet = snippet;
    }

    toString() {
        if ((this.parsedLine != null) && (this.snippet != null)) {
            return `<ParseMore> ${this.message} (line ${this.parsedLine}: '${this.snippet}')`;
        } else {
            return `<ParseMore> ${this.message}`;
        }
    }
}

// TODO: This file was created by bulk-decaffeinate.

// TODO: This file was created by bulk-decaffeinate.

// Inline YAML parsing and dumping
class Inline {
    static initClass() {
    
        // Quoted string regular expression
        this.REGEX_QUOTED_STRING =               '(?:"(?:[^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|\'(?:[^\']*(?:\'\'[^\']*)*)\')';
    
        // Pre-compiled patterns
        //
        this.PATTERN_TRAILING_COMMENTS =         new Pattern('^\\s*#.*$');
        this.PATTERN_QUOTED_SCALAR =             new Pattern(`^${this.REGEX_QUOTED_STRING}`);
        this.PATTERN_THOUSAND_NUMERIC_SCALAR =   new Pattern('^(-|\\+)?[0-9,]+(\\.[0-9]+)?$');
        this.PATTERN_SCALAR_BY_DELIMITERS =      {};
    
        // Settings
        this.settings = {};
    }


    // Configure YAML inline.
    //
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    static configure(exceptionOnInvalidType = null, objectDecoder = null) {
        // Update settings
        this.settings.exceptionOnInvalidType = exceptionOnInvalidType;
        this.settings.objectDecoder = objectDecoder;
    }


    // Converts a YAML string to a JavaScript object.
    //
    // @param [String]   value                   A YAML string
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    // @return [Object]  A JavaScript object representing the YAML string
    //
    // @throw [ParseException]
    //
    static parse(value, exceptionOnInvalidType, objectDecoder = null) {
        // Update settings from last call of Inline.parse()
        let result;
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        this.settings.exceptionOnInvalidType = exceptionOnInvalidType;
        this.settings.objectDecoder = objectDecoder;

        if ((value == null)) {
            return '';
        }

        value = Utils.trim(value);

        if (0 === value.length) {
            return '';
        }

        // Keep a context object to pass through static methods
        const context = {exceptionOnInvalidType, objectDecoder, i: 0};

        switch (value.charAt(0)) {
            case '[':
                result = this.parseSequence(value, context);
                ++context.i;
                break;
            case '{':
                result = this.parseMapping(value, context);
                ++context.i;
                break;
            default:
                result = this.parseScalar(value, null, ['"', "'"], context);
        }

        // Some comments are allowed at the end
        if (this.PATTERN_TRAILING_COMMENTS.replace(value.slice(context.i), '') !== '') {
            throw new ParseException(`Unexpected characters near "${value.slice(context.i)}".`);
        }

        return result;
    }


    // Dumps a given JavaScript variable to a YAML string.
    //
    // @param [Object]   value                   The JavaScript variable to convert
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectEncoder           A function to serialize custom objects, null otherwise
    //
    // @return [String]  The YAML string representing the JavaScript object
    //
    // @throw [DumpException]
    //
    static dump(value, exceptionOnInvalidType, objectEncoder = null) {
        let needle;
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        if ((value == null)) {
            return 'null';
        }
        const type = typeof value;
        if (type === 'object') {
            if (value instanceof Date) {
                return value.toISOString();
            } else if (objectEncoder != null) {
                const result = objectEncoder(value);
                if ((typeof result === 'string') || (result != null)) {
                    return result;
                }
            }
            return this.dumpObject(value);
        }
        if (type === 'boolean') {
            return (value ? 'true' : 'false');
        }
        if (Utils.isDigits(value)) {
            return (type === 'string' ? `'${value}'` : String(parseInt(value)));
        }
        if (Utils.isNumeric(value)) {
            return (type === 'string' ? `'${value}'` : String(parseFloat(value)));
        }
        if (type === 'number') {
            return (value === Infinity ? '.Inf' : (value === -Infinity ? '-.Inf' : (isNaN(value) ? '.NaN' : value)));
        }
        if (Escaper.requiresDoubleQuoting(value)) {
            return Escaper.escapeWithDoubleQuotes(value);
        }
        if (Escaper.requiresSingleQuoting(value)) {
            return Escaper.escapeWithSingleQuotes(value);
        }
        if ('' === value) {
            return '""';
        }
        if (Utils.PATTERN_DATE.test(value)) {
            return `'${value}'`;
        }
        if ((needle = value.toLowerCase(), ['null','~','true','false'].includes(needle))) {
            return `'${value}'`;
        }
        // Default
        return value;
    }


    // Dumps a JavaScript object to a YAML string.
    //
    // @param [Object]   value                   The JavaScript object to dump
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectEncoder           A function do serialize custom objects, null otherwise
    //
    // @return string The YAML string representing the JavaScript object
    //
    static dumpObject(value, exceptionOnInvalidType, objectSupport = null) {
        // Array
        let output, val;
        if (value instanceof Array) {
            output = [];
            for (val of Array.from(value)) {
                output.push(this.dump(val));
            }
            return `[${output.join(', ')}]`;

        // Mapping
        } else {
            output = [];
            for (let key in value) {
                val = value[key];
                output.push(this.dump(key)+': '+this.dump(val));
            }
            return `{${output.join(', ')}}`;
        }
    }


    // Parses a scalar to a YAML string.
    //
    // @param [Object]   scalar
    // @param [Array]    delimiters
    // @param [Array]    stringDelimiters
    // @param [Object]   context
    // @param [Boolean]  evaluate
    //
    // @return [String]  A YAML string
    //
    // @throw [ParseException] When malformed inline YAML string is parsed
    //
    static parseScalar(scalar, delimiters = null, stringDelimiters, context = null, evaluate) {
        let needle, output;
        if (stringDelimiters == null) { stringDelimiters = ['"', "'"]; }
        if (evaluate == null) { evaluate = true; }
        if (context == null) {
            context = {exceptionOnInvalidType: this.settings.exceptionOnInvalidType, objectDecoder: this.settings.objectDecoder, i: 0};
        }
        let {i} = context;

        if ((needle = scalar.charAt(i), Array.from(stringDelimiters).includes(needle))) {
            // Quoted scalar
            output = this.parseQuotedScalar(scalar, context);
            ({i} = context);

            if (delimiters != null) {
                let needle1;
                const tmp = Utils.ltrim(scalar.slice(i), ' ');
                if (!((needle1 = tmp.charAt(0), Array.from(delimiters).includes(needle1)))) {
                    throw new ParseException(`Unexpected characters (${scalar.slice(i)}).`);
                }
            }

        } else {
            // "normal" string
            if (!delimiters) {
                output = scalar.slice(i);
                i += output.length;

                // Remove comments
                const strpos = output.indexOf(' #');
                if (strpos !== -1) {
                    output = Utils.rtrim(output.slice(0, strpos));
                }

            } else {
                let match;
                const joinedDelimiters = delimiters.join('|');
                let pattern = this.PATTERN_SCALAR_BY_DELIMITERS[joinedDelimiters];
                if (pattern == null) {
                    pattern = new Pattern(`^(.+?)(${joinedDelimiters})`);
                    this.PATTERN_SCALAR_BY_DELIMITERS[joinedDelimiters] = pattern;
                }
                if (match = pattern.exec(scalar.slice(i))) {
                    output = match[1];
                    i += output.length;
                } else {
                    throw new ParseException(`Malformed inline YAML string (${scalar}).`);
                }
            }


            if (evaluate) {
                output = this.evaluateScalar(output, context);
            }
        }

        context.i = i;
        return output;
    }


    // Parses a quoted scalar to YAML.
    //
    // @param [String]   scalar
    // @param [Object]   context
    //
    // @return [String]  A YAML string
    //
    // @throw [ParseMore] When malformed inline YAML string is parsed
    //
    static parseQuotedScalar(scalar, context) {
        let match;
        let {i} = context;

        if (!(match = this.PATTERN_QUOTED_SCALAR.exec(scalar.slice(i)))) {
            throw new ParseMore(`Malformed inline YAML string (${scalar.slice(i)}).`);
        }

        let output = match[0].substr(1, match[0].length - 2);

        if ('"' === scalar.charAt(i)) {
            output = Unescaper.unescapeDoubleQuotedString(output);
        } else {
            output = Unescaper.unescapeSingleQuotedString(output);
        }

        i += match[0].length;

        context.i = i;
        return output;
    }


    // Parses a sequence to a YAML string.
    //
    // @param [String]   sequence
    // @param [Object]   context
    //
    // @return [String]  A YAML string
    //
    // @throw [ParseMore] When malformed inline YAML string is parsed
    //
    static parseSequence(sequence, context) {
        const output = [];
        const len = sequence.length;
        let {i} = context;
        i += 1;

        // [foo, bar, ...]
        while (i < len) {
            var needle;
            context.i = i;
            switch (sequence.charAt(i)) {
                case '[':
                    // Nested sequence
                    output.push(this.parseSequence(sequence, context));
                    ({i} = context);
                    break;
                case '{':
                    // Nested mapping
                    output.push(this.parseMapping(sequence, context));
                    ({i} = context);
                    break;
                case ']':
                    return output;
                    break;
                case ',': case ' ': case "\n":
                    break;
                    // Do nothing
                default:
                    var isQuoted = ((needle = sequence.charAt(i), ['"', "'"].includes(needle)));
                    var value = this.parseScalar(sequence, [',', ']'], ['"', "'"], context);
                    ({i} = context);

                    if (!(isQuoted) && (typeof(value) === 'string') && ((value.indexOf(': ') !== -1) || (value.indexOf(":\n") !== -1))) {
                        // Embedded mapping?
                        try {
                            value = this.parseMapping(`{${value}}`);
                        } catch (e) {}
                    }
                            // No, it's not


                    output.push(value);

                    --i;
            }

            ++i;
        }

        throw new ParseMore(`Malformed inline YAML string ${sequence}`);
    }


    // Parses a mapping to a YAML string.
    //
    // @param [String]   mapping
    // @param [Object]   context
    //
    // @return [String]  A YAML string
    //
    // @throw [ParseMore] When malformed inline YAML string is parsed
    //
    static parseMapping(mapping, context) {
        const output = {};
        const len = mapping.length;
        let {i} = context;
        i += 1;

        // {foo: bar, bar:foo, ...}
        let shouldContinueWhileLoop = false;
        while (i < len) {
            context.i = i;
            switch (mapping.charAt(i)) {
                case ' ': case ',': case "\n":
                    ++i;
                    context.i = i;
                    shouldContinueWhileLoop = true;
                    break;
                case '}':
                    return output;
                    break;
            }

            if (shouldContinueWhileLoop) {
                shouldContinueWhileLoop = false;
                continue;
            }

            // Key
            const key = this.parseScalar(mapping, [':', ' ', "\n"], ['"', "'"], context, false);
            ({i} = context);

            // Value
            let done = false;

            while (i < len) {
                context.i = i;
                switch (mapping.charAt(i)) {
                    case '[':
                        // Nested sequence
                        var value = this.parseSequence(mapping, context);
                        ({i} = context);
                        // Spec: Keys MUST be unique; first one wins.
                        // Parser cannot abort this mapping earlier, since lines
                        // are processed sequentially.
                        if (output[key] === undefined) {
                            output[key] = value;
                        }
                        done = true;
                        break;
                    case '{':
                        // Nested mapping
                        value = this.parseMapping(mapping, context);
                        ({i} = context);
                        // Spec: Keys MUST be unique; first one wins.
                        // Parser cannot abort this mapping earlier, since lines
                        // are processed sequentially.
                        if (output[key] === undefined) {
                            output[key] = value;
                        }
                        done = true;
                        break;
                    case ':': case ' ': case "\n":
                        break;
                        // Do nothing
                    default:
                        value = this.parseScalar(mapping, [',', '}'], ['"', "'"], context);
                        ({i} = context);
                        // Spec: Keys MUST be unique; first one wins.
                        // Parser cannot abort this mapping earlier, since lines
                        // are processed sequentially.
                        if (output[key] === undefined) {
                            output[key] = value;
                        }
                        done = true;
                        --i;
                }

                ++i;

                if (done) {
                    break;
                }
            }
        }

        throw new ParseMore(`Malformed inline YAML string ${mapping}`);
    }


    // Evaluates scalars and replaces magic values.
    //
    // @param [String]   scalar
    //
    // @return [String]  A YAML string
    //
    static evaluateScalar(scalar, context) {
        let cast, date, firstWord, raw;
        scalar = Utils.trim(scalar);
        const scalarLower = scalar.toLowerCase();

        switch (scalarLower) {
            case 'null': case '': case '~':
                return null;
            case 'true':
                return true;
            case 'false':
                return false;
            case '.inf':
                return Infinity;
            case '.nan':
                return NaN;
            case '-.inf':
                return Infinity;
            default:
                var firstChar = scalarLower.charAt(0);
                switch (firstChar) {
                    case '!':
                        var firstSpace = scalar.indexOf(' ');
                        if (firstSpace === -1) {
                            firstWord = scalarLower;
                        } else {
                            firstWord = scalarLower.slice(0, firstSpace);
                        }
                        switch (firstWord) {
                            case '!':
                                if (firstSpace !== -1) {
                                    return parseInt(this.parseScalar(scalar.slice(2)));
                                }
                                return null;
                            case '!str':
                                return Utils.ltrim(scalar.slice(4));
                            case '!!str':
                                return Utils.ltrim(scalar.slice(5));
                            case '!!int':
                                return parseInt(this.parseScalar(scalar.slice(5)));
                            case '!!bool':
                                return Utils.parseBoolean(this.parseScalar(scalar.slice(6)), false);
                            case '!!float':
                                return parseFloat(this.parseScalar(scalar.slice(7)));
                            case '!!timestamp':
                                return Utils.stringToDate(Utils.ltrim(scalar.slice(11)));
                            default:
                                if (context == null) {
                                    context = {exceptionOnInvalidType: this.settings.exceptionOnInvalidType, objectDecoder: this.settings.objectDecoder, i: 0};
                                }
                                var {objectDecoder, exceptionOnInvalidType} = context;

                                if (objectDecoder) {
                                    // If objectDecoder function is given, we can do custom decoding of custom types
                                    const trimmedScalar = Utils.rtrim(scalar);
                                    firstSpace = trimmedScalar.indexOf(' ');
                                    if (firstSpace === -1) {
                                        return objectDecoder(trimmedScalar, null);
                                    } else {
                                        let subValue = Utils.ltrim(trimmedScalar.slice(firstSpace+1));
                                        if (!(subValue.length > 0)) {
                                            subValue = null;
                                        }
                                        return objectDecoder(trimmedScalar.slice(0, firstSpace), subValue);
                                    }
                                }

                                if (exceptionOnInvalidType) {
                                    throw new ParseException('Custom object support when parsing a YAML file has been disabled.');
                                }

                                return null;
                        }
                    case '0':
                        if ('0x' === scalar.slice(0, 2)) {
                            return Utils.hexDec(scalar);
                        } else if (Utils.isDigits(scalar)) {
                            return Utils.octDec(scalar);
                        } else if (Utils.isNumeric(scalar)) {
                            return parseFloat(scalar);
                        } else {
                            return scalar;
                        }
                    case '+':
                        if (Utils.isDigits(scalar)) {
                            raw = scalar;
                            cast = parseInt(raw);
                            if (raw === String(cast)) {
                                return cast;
                            } else {
                                return raw;
                            }
                        } else if (Utils.isNumeric(scalar)) {
                            return parseFloat(scalar);
                        } else if (this.PATTERN_THOUSAND_NUMERIC_SCALAR.test(scalar)) {
                            return parseFloat(scalar.replace(',', ''));
                        }
                        return scalar;
                    case '-':
                        if (Utils.isDigits(scalar.slice(1))) {
                            if ('0' === scalar.charAt(1)) {
                                return -Utils.octDec(scalar.slice(1));
                            } else {
                                raw = scalar.slice(1);
                                cast = parseInt(raw);
                                if (raw === String(cast)) {
                                    return -cast;
                                } else {
                                    return -raw;
                                }
                            }
                        } else if (Utils.isNumeric(scalar)) {
                            return parseFloat(scalar);
                        } else if (this.PATTERN_THOUSAND_NUMERIC_SCALAR.test(scalar)) {
                            return parseFloat(scalar.replace(',', ''));
                        }
                        return scalar;
                    default:
                        if (date = Utils.stringToDate(scalar)) {
                            return date;
                        } else if (Utils.isNumeric(scalar)) {
                            return parseFloat(scalar);
                        } else if (this.PATTERN_THOUSAND_NUMERIC_SCALAR.test(scalar)) {
                            return parseFloat(scalar.replace(',', ''));
                        }
                        return scalar;
                }
        }
    }
}
Inline.initClass();

// TODO: This file was created by bulk-decaffeinate.

// Parser parses YAML strings to convert them to JavaScript objects.
//
class Parser {
    static initClass() {
    
        // Pre-compiled patterns
        //
        this.prototype.PATTERN_FOLDED_SCALAR_ALL =              new Pattern('^(?:(?<type>![^\\|>]*)\\s+)?(?<separator>\\||>)(?<modifiers>\\+|\\-|\\d+|\\+\\d+|\\-\\d+|\\d+\\+|\\d+\\-)?(?<comments> +#.*)?$');
        this.prototype.PATTERN_FOLDED_SCALAR_END =              new Pattern('(?<separator>\\||>)(?<modifiers>\\+|\\-|\\d+|\\+\\d+|\\-\\d+|\\d+\\+|\\d+\\-)?(?<comments> +#.*)?$');
        this.prototype.PATTERN_SEQUENCE_ITEM =                  new Pattern('^\\-((?<leadspaces>\\s+)(?<value>.+?))?\\s*$');
        this.prototype.PATTERN_ANCHOR_VALUE =                   new Pattern('^&(?<ref>[^ ]+) *(?<value>.*)');
        this.prototype.PATTERN_COMPACT_NOTATION =               new Pattern(`^(?<key>${Inline.REGEX_QUOTED_STRING}|[^ '"\\{\\[].*?) *\\:(\\s+(?<value>.+?))?\\s*$`);
        this.prototype.PATTERN_MAPPING_ITEM =                   new Pattern(`^(?<key>${Inline.REGEX_QUOTED_STRING}|[^ '"\\[\\{].*?) *\\:(\\s+(?<value>.+?))?\\s*$`);
        this.prototype.PATTERN_DECIMAL =                        new Pattern('\\d+');
        this.prototype.PATTERN_INDENT_SPACES =                  new Pattern('^ +');
        this.prototype.PATTERN_TRAILING_LINES =                 new Pattern('(\n*)$');
        this.prototype.PATTERN_YAML_HEADER =                    new Pattern('^\\%YAML[: ][\\d\\.]+.*\n', 'm');
        this.prototype.PATTERN_LEADING_COMMENTS =               new Pattern('^(\\#.*?\n)+', 'm');
        this.prototype.PATTERN_DOCUMENT_MARKER_START =          new Pattern('^\\-\\-\\-.*?\n', 'm');
        this.prototype.PATTERN_DOCUMENT_MARKER_END =            new Pattern('^\\.\\.\\.\\s*$', 'm');
        this.prototype.PATTERN_FOLDED_SCALAR_BY_INDENTATION =   {};
    
        // Context types
        //
        this.prototype.CONTEXT_NONE =       0;
        this.prototype.CONTEXT_SEQUENCE =   1;
        this.prototype.CONTEXT_MAPPING =    2;
    }


    // Constructor
    //
    // @param [Integer]  offset  The offset of YAML document (used for line numbers in error messages)
    //
    constructor(offset) {
        if (offset == null) { offset = 0; }
        this.offset = offset;
        this.lines          = [];
        this.currentLineNb  = -1;
        this.currentLine    = '';
        this.refs           = {};
    }


    // Parses a YAML string to a JavaScript value.
    //
    // @param [String]   value                   A YAML string
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    // @return [Object]  A JavaScript value
    //
    // @throw [ParseException] If the YAML is not valid
    //
    parse(value, exceptionOnInvalidType, objectDecoder = null) {
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        this.currentLineNb = -1;
        this.currentLine = '';
        this.lines = this.cleanup(value).split("\n");

        let data = null;
        let context = this.CONTEXT_NONE;
        let allowOverwrite = false;
        while (this.moveToNextLine()) {
            var c, e, key, matches, mergeNode, parser, values;
            if (this.isCurrentLineEmpty()) {
                continue;
            }

            // Tab?
            if ("\t" === this.currentLine[0]) {
                throw new ParseException('A YAML file cannot contain tabs as indentation.', this.getRealCurrentLineNb() + 1, this.currentLine);
            }

            let isRef = (mergeNode = false);
            if (values = this.PATTERN_SEQUENCE_ITEM.exec(this.currentLine)) {
                if (this.CONTEXT_MAPPING === context) {
                    throw new ParseException('You cannot define a sequence item when in a mapping');
                }
                context = this.CONTEXT_SEQUENCE;
                if (data == null) { data = []; }

                if ((values.value != null) && (matches = this.PATTERN_ANCHOR_VALUE.exec(values.value))) {
                    isRef = matches.ref;
                    values.value = matches.value;
                }

                // Array
                if ((values.value == null) || ('' === Utils.trim(values.value, ' ')) || (Utils.ltrim(values.value, ' ').indexOf('#') === 0)) {
                    if ((this.currentLineNb < (this.lines.length - 1)) && !this.isNextLineUnIndentedCollection()) {
                        c = this.getRealCurrentLineNb() + 1;
                        parser = new Parser(c);
                        parser.refs = this.refs;
                        data.push(parser.parse(this.getNextEmbedBlock(null, true), exceptionOnInvalidType, objectDecoder));
                    } else {
                        data.push(null);
                    }

                } else {
                    if ((values.leadspaces != null ? values.leadspaces.length : undefined) && (matches = this.PATTERN_COMPACT_NOTATION.exec(values.value))) {

                        // This is a compact notation element, add to next block and parse
                        c = this.getRealCurrentLineNb();
                        parser = new Parser(c);
                        parser.refs = this.refs;

                        let block = values.value;
                        const indent = this.getCurrentLineIndentation();
                        if (this.isNextLineIndented(false)) {
                            block += `\n${this.getNextEmbedBlock(indent + values.leadspaces.length + 1, true)}`;
                        }

                        data.push(parser.parse(block, exceptionOnInvalidType, objectDecoder));

                    } else {
                        data.push(this.parseValue(values.value, exceptionOnInvalidType, objectDecoder));
                    }
                }

            } else if ((values = this.PATTERN_MAPPING_ITEM.exec(this.currentLine)) && (values.key.indexOf(' #') === -1)) {
                var val;
                if (this.CONTEXT_SEQUENCE === context) {
                    throw new ParseException('You cannot define a mapping item when in a sequence');
                }
                context = this.CONTEXT_MAPPING;
                if (data == null) { data = {}; }

                // Force correct settings
                Inline.configure(exceptionOnInvalidType, objectDecoder);
                try {
                    key = Inline.parseScalar(values.key);
                } catch (error) {
                    e = error;
                    e.parsedLine = this.getRealCurrentLineNb() + 1;
                    e.snippet = this.currentLine;

                    throw e;
                }

                if ('<<' === key) {
                    var i;
                    mergeNode = true;
                    allowOverwrite = true;
                    if ((values.value != null ? values.value.indexOf('*') : undefined) === 0) {
                        const refName = values.value.slice(1);
                        if (this.refs[refName] == null) {
                            throw new ParseException(`Reference "${refName}" does not exist.`, this.getRealCurrentLineNb() + 1, this.currentLine);
                        }

                        const refValue = this.refs[refName];

                        if (typeof refValue !== 'object') {
                            throw new ParseException('YAML merge keys used with a scalar value instead of an object.', this.getRealCurrentLineNb() + 1, this.currentLine);
                        }

                        if (refValue instanceof Array) {
                            // Merge array with object
                            for (i = 0; i < refValue.length; i++) {
                                var name;
                                value = refValue[i];
                                if (data[name = String(i)] == null) { data[name] = value; }
                            }
                        } else {
                            // Merge objects
                            for (key in refValue) {
                                value = refValue[key];
                                if (data[key] == null) { data[key] = value; }
                            }
                        }

                    } else {
                        if ((values.value != null) && (values.value !== '')) {
                            ({ value } = values);
                        } else {
                            value = this.getNextEmbedBlock();
                        }

                        c = this.getRealCurrentLineNb() + 1;
                        parser = new Parser(c);
                        parser.refs = this.refs;
                        const parsed = parser.parse(value, exceptionOnInvalidType);

                        if (typeof parsed !== 'object') {
                            throw new ParseException('YAML merge keys used with a scalar value instead of an object.', this.getRealCurrentLineNb() + 1, this.currentLine);
                        }

                        if (parsed instanceof Array) {
                            // If the value associated with the merge key is a sequence, then this sequence is expected to contain mapping nodes
                            // and each of these nodes is merged in turn according to its order in the sequence. Keys in mapping nodes earlier
                            // in the sequence override keys specified in later mapping nodes.
                            for (let parsedItem of Array.from(parsed)) {
                                if (typeof parsedItem !== 'object') {
                                    throw new ParseException('Merge items must be objects.', this.getRealCurrentLineNb() + 1, parsedItem);
                                }

                                if (parsedItem instanceof Array) {
                                    // Merge array with object
                                    for (i = 0; i < parsedItem.length; i++) {
                                        value = parsedItem[i];
                                        const k = String(i);
                                        if (!data.hasOwnProperty(k)) {
                                            data[k] = value;
                                        }
                                    }
                                } else {
                                    // Merge objects
                                    for (key in parsedItem) {
                                        value = parsedItem[key];
                                        if (!data.hasOwnProperty(key)) {
                                            data[key] = value;
                                        }
                                    }
                                }
                            }

                        } else {
                            // If the value associated with the key is a single mapping node, each of its key/value pairs is inserted into the
                            // current mapping, unless the key already exists in it.
                            for (key in parsed) {
                                value = parsed[key];
                                if (!data.hasOwnProperty(key)) {
                                    data[key] = value;
                                }
                            }
                        }
                    }

                } else if ((values.value != null) && (matches = this.PATTERN_ANCHOR_VALUE.exec(values.value))) {
                    isRef = matches.ref;
                    values.value = matches.value;
                }


                if (mergeNode) ; else if ((values.value == null) || ('' === Utils.trim(values.value, ' ')) || (Utils.ltrim(values.value, ' ').indexOf('#') === 0)) {
                    // Hash
                    // if next line is less indented or equal, then it means that the current value is null
                    if (!(this.isNextLineIndented()) && !(this.isNextLineUnIndentedCollection())) {
                        // Spec: Keys MUST be unique; first one wins.
                        // But overwriting is allowed when a merge node is used in current block.
                        if (allowOverwrite || (data[key] === undefined)) {
                            data[key] = null;
                        }

                    } else {
                        c = this.getRealCurrentLineNb() + 1;
                        parser = new Parser(c);
                        parser.refs = this.refs;
                        val = parser.parse(this.getNextEmbedBlock(), exceptionOnInvalidType, objectDecoder);

                        // Spec: Keys MUST be unique; first one wins.
                        // But overwriting is allowed when a merge node is used in current block.
                        if (allowOverwrite || (data[key] === undefined)) {
                            data[key] = val;
                        }
                    }

                } else {
                    val = this.parseValue(values.value, exceptionOnInvalidType, objectDecoder);

                    // Spec: Keys MUST be unique; first one wins.
                    // But overwriting is allowed when a merge node is used in current block.
                    if (allowOverwrite || (data[key] === undefined)) {
                        data[key] = val;
                    }
                }

            } else {
                // 1-liner optionally followed by newline
                var needle;
                const lineCount = this.lines.length;
                if ((1 === lineCount) || ((2 === lineCount) && Utils.isEmpty(this.lines[1]))) {
                    try {
                        value = Inline.parse(this.lines[0], exceptionOnInvalidType, objectDecoder);
                    } catch (error1) {
                        e = error1;
                        e.parsedLine = this.getRealCurrentLineNb() + 1;
                        e.snippet = this.currentLine;

                        throw e;
                    }

                    if (typeof value === 'object') {
                        var first;
                        if (value instanceof Array) {
                            first = value[0];
                        } else {
                            for (key in value) {
                                first = value[key];
                                break;
                            }
                        }

                        if ((typeof first === 'string') && (first.indexOf('*') === 0)) {
                            data = [];
                            for (let alias of Array.from(value)) {
                                data.push(this.refs[alias.slice(1)]);
                            }
                            value = data;
                        }
                    }

                    return value;

                } else if ((needle = Utils.ltrim(value).charAt(0), ['[', '{'].includes(needle))) {
                    try {
                        return Inline.parse(value, exceptionOnInvalidType, objectDecoder);
                    } catch (error2) {
                        e = error2;
                        e.parsedLine = this.getRealCurrentLineNb() + 1;
                        e.snippet = this.currentLine;

                        throw e;
                    }
                }

                throw new ParseException('Unable to parse.', this.getRealCurrentLineNb() + 1, this.currentLine);
            }

            if (isRef) {
                if (data instanceof Array) {
                    this.refs[isRef] = data[data.length-1];
                } else {
                    let lastKey = null;
                    for (key in data) {
                        lastKey = key;
                    }
                    this.refs[isRef] = data[lastKey];
                }
            }
        }


        if (Utils.isEmpty(data)) {
            return null;
        } else {
            return data;
        }
    }



    // Returns the current line number (takes the offset into account).
    //
    // @return [Integer]     The current line number
    //
    getRealCurrentLineNb() {
        return this.currentLineNb + this.offset;
    }


    // Returns the current line indentation.
    //
    // @return [Integer]     The current line indentation
    //
    getCurrentLineIndentation() {
        return this.currentLine.length - Utils.ltrim(this.currentLine, ' ').length;
    }


    // Returns the next embed block of YAML.
    //
    // @param [Integer]          indentation The indent level at which the block is to be read, or null for default
    //
    // @return [String]          A YAML string
    //
    // @throw [ParseException]   When indentation problem are detected
    //
    getNextEmbedBlock(indentation = null, includeUnindentedCollection) {
        let isItUnindentedCollection, newIndent;
        if (includeUnindentedCollection == null) { includeUnindentedCollection = false; }
        this.moveToNextLine();

        if ((indentation == null)) {
            newIndent = this.getCurrentLineIndentation();

            const unindentedEmbedBlock = this.isStringUnIndentedCollectionItem(this.currentLine);

            if (!(this.isCurrentLineEmpty()) && (0 === newIndent) && !(unindentedEmbedBlock)) {
                throw new ParseException('Indentation problem.', this.getRealCurrentLineNb() + 1, this.currentLine);
            }

        } else {
            newIndent = indentation;
        }


        const data = [this.currentLine.slice(newIndent)];

        if (!includeUnindentedCollection) {
            isItUnindentedCollection = this.isStringUnIndentedCollectionItem(this.currentLine);
        }

        // Comments must not be removed inside a string block (ie. after a line ending with "|")
        // They must not be removed inside a sub-embedded block as well
        const removeCommentsPattern = this.PATTERN_FOLDED_SCALAR_END;
        let removeComments = !removeCommentsPattern.test(this.currentLine);

        while (this.moveToNextLine()) {
            const indent = this.getCurrentLineIndentation();

            if (indent === newIndent) {
                removeComments = !removeCommentsPattern.test(this.currentLine);
            }

            if (removeComments && this.isCurrentLineComment()) {
                continue;
            }

            if (this.isCurrentLineBlank()) {
                data.push(this.currentLine.slice(newIndent));
                continue;
            }

            if (isItUnindentedCollection && !this.isStringUnIndentedCollectionItem(this.currentLine) && (indent === newIndent)) {
                this.moveToPreviousLine();
                break;
            }

            if (indent >= newIndent) {
                data.push(this.currentLine.slice(newIndent));
            } else if (Utils.ltrim(this.currentLine).charAt(0) === '#') ; else if (0 === indent) {
                this.moveToPreviousLine();
                break;
            } else {
                throw new ParseException('Indentation problem.', this.getRealCurrentLineNb() + 1, this.currentLine);
            }
        }


        return data.join("\n");
    }


    // Moves the parser to the next line.
    //
    // @return [Boolean]
    //
    moveToNextLine() {
        if (this.currentLineNb >= (this.lines.length - 1)) {
            return false;
        }

        this.currentLine = this.lines[++this.currentLineNb];

        return true;
    }


    // Moves the parser to the previous line.
    //
    moveToPreviousLine() {
        this.currentLine = this.lines[--this.currentLineNb];
    }


    // Parses a YAML value.
    //
    // @param [String]   value                   A YAML value
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    // @return [Object] A JavaScript value
    //
    // @throw [ParseException] When reference does not exist
    //
    parseValue(value, exceptionOnInvalidType, objectDecoder) {
        let matches, needle;
        if (0 === value.indexOf('*')) {
            const pos = value.indexOf('#');
            if (pos !== -1) {
                value = value.substr(1, pos-2);
            } else {
                value = value.slice(1);
            }

            if (this.refs[value] === undefined) {
                throw new ParseException(`Reference "${value}" does not exist.`, this.currentLine);
            }

            return this.refs[value];
        }


        if (matches = this.PATTERN_FOLDED_SCALAR_ALL.exec(value)) {
            const modifiers = matches.modifiers != null ? matches.modifiers : '';

            let foldedIndent = Math.abs(parseInt(modifiers));
            if (isNaN(foldedIndent)) { foldedIndent = 0; }
            const val = this.parseFoldedScalar(matches.separator, this.PATTERN_DECIMAL.replace(modifiers, ''), foldedIndent);
            if (matches.type != null) {
                // Force correct settings
                Inline.configure(exceptionOnInvalidType, objectDecoder);
                return Inline.parseScalar(matches.type+' '+val);
            } else {
                return val;
            }
        }

        // Value can be multiline compact sequence or mapping or string
        if ((needle = value.charAt(0), ['[', '{', '"', "'"].includes(needle))) {
            while (true) {
                try {
                    return Inline.parse(value, exceptionOnInvalidType, objectDecoder);
                } catch (e) {
                    if (e instanceof ParseMore && this.moveToNextLine()) {
                        value += `\n${Utils.trim(this.currentLine, ' ')}`;
                    } else {
                        e.parsedLine = this.getRealCurrentLineNb() + 1;
                        e.snippet = this.currentLine;
                        throw e;
                    }
                }
            }
        } else {
            if (this.isNextLineIndented()) {
                value += `\n${this.getNextEmbedBlock()}`;
            }
            return Inline.parse(value, exceptionOnInvalidType, objectDecoder);
        }

    }


    // Parses a folded scalar.
    //
    // @param [String]       separator   The separator that was used to begin this folded scalar (| or >)
    // @param [String]       indicator   The indicator that was used to begin this folded scalar (+ or -)
    // @param [Integer]      indentation The indentation that was used to begin this folded scalar
    //
    // @return [String]      The text value
    //
    parseFoldedScalar(separator, indicator, indentation) {
        let matches;
        if (indicator == null) { indicator = ''; }
        if (indentation == null) { indentation = 0; }
        let notEOF = this.moveToNextLine();
        if (!notEOF) {
            return '';
        }

        let isCurrentLineBlank = this.isCurrentLineBlank();
        let text = '';

        // Leading blank lines are consumed before determining indentation
        while (notEOF && isCurrentLineBlank) {
            // newline only if not EOF
            if (notEOF = this.moveToNextLine()) {
                text += "\n";
                isCurrentLineBlank = this.isCurrentLineBlank();
            }
        }


        // Determine indentation if not specified
        if (0 === indentation) {
            if (matches = this.PATTERN_INDENT_SPACES.exec(this.currentLine)) {
                indentation = matches[0].length;
            }
        }


        if (indentation > 0) {
            let pattern = this.PATTERN_FOLDED_SCALAR_BY_INDENTATION[indentation];
            if (pattern == null) {
                pattern = new Pattern(`^ {${indentation}}(.*)$`);
                Parser.prototype.PATTERN_FOLDED_SCALAR_BY_INDENTATION[indentation] = pattern;
            }

            while (notEOF && (isCurrentLineBlank || (matches = pattern.exec(this.currentLine)))) {
                if (isCurrentLineBlank) {
                    text += this.currentLine.slice(indentation);
                } else {
                    text += matches[1];
                }

                // newline only if not EOF
                if (notEOF = this.moveToNextLine()) {
                    text += "\n";
                    isCurrentLineBlank = this.isCurrentLineBlank();
                }
            }

        } else if (notEOF) {
            text += "\n";
        }


        if (notEOF) {
            this.moveToPreviousLine();
        }


        // Remove line breaks of each lines except the empty and more indented ones
        if ('>' === separator) {
            let newText = '';
            for (let line of Array.from(text.split("\n"))) {
                if ((line.length === 0) || (line.charAt(0) === ' ')) {
                    newText = Utils.rtrim(newText, ' ') + line + "\n";
                } else {
                    newText += line + ' ';
                }
            }
            text = newText;
        }

        if ('+' !== indicator) {
            // Remove any extra space or new line as we are adding them after
            text = Utils.rtrim(text);
        }

        // Deal with trailing newlines as indicated
        if ('' === indicator) {
            text = this.PATTERN_TRAILING_LINES.replace(text, "\n");
        } else if ('-' === indicator) {
            text = this.PATTERN_TRAILING_LINES.replace(text, '');
        }

        return text;
    }


    // Returns true if the next line is indented.
    //
    // @return [Boolean]     Returns true if the next line is indented, false otherwise
    //
    isNextLineIndented(ignoreComments) {
        if (ignoreComments == null) { ignoreComments = true; }
        const currentIndentation = this.getCurrentLineIndentation();
        let EOF = !this.moveToNextLine();

        if (ignoreComments) {
            while (!(EOF) && this.isCurrentLineEmpty()) {
                EOF = !this.moveToNextLine();
            }
        } else {
            while (!(EOF) && this.isCurrentLineBlank()) {
                EOF = !this.moveToNextLine();
            }
        }

        if (EOF) {
            return false;
        }

        let ret = false;
        if (this.getCurrentLineIndentation() > currentIndentation) {
            ret = true;
        }

        this.moveToPreviousLine();

        return ret;
    }


    // Returns true if the current line is blank or if it is a comment line.
    //
    // @return [Boolean]     Returns true if the current line is empty or if it is a comment line, false otherwise
    //
    isCurrentLineEmpty() {
        const trimmedLine = Utils.trim(this.currentLine, ' ');
        return (trimmedLine.length === 0) || (trimmedLine.charAt(0) === '#');
    }


    // Returns true if the current line is blank.
    //
    // @return [Boolean]     Returns true if the current line is blank, false otherwise
    //
    isCurrentLineBlank() {
        return '' === Utils.trim(this.currentLine, ' ');
    }


    // Returns true if the current line is a comment line.
    //
    // @return [Boolean]     Returns true if the current line is a comment line, false otherwise
    //
    isCurrentLineComment() {
        // Checking explicitly the first char of the trim is faster than loops or strpos
        const ltrimmedLine = Utils.ltrim(this.currentLine, ' ');

        return ltrimmedLine.charAt(0) === '#';
    }


    // Cleanups a YAML string to be parsed.
    //
    // @param [String]   value The input YAML string
    //
    // @return [String]  A cleaned up YAML string
    //
    cleanup(value) {
        let line, trimmedValue;
        if (value.indexOf("\r") !== -1) {
            value = value.split("\r\n").join("\n").split("\r").join("\n");
        }

        // Strip YAML header
        let count = 0;
        [value, count] = Array.from(this.PATTERN_YAML_HEADER.replaceAll(value, ''));
        this.offset += count;

        // Remove leading comments
        [trimmedValue, count] = Array.from(this.PATTERN_LEADING_COMMENTS.replaceAll(value, '', 1));
        if (count === 1) {
            // Items have been removed, update the offset
            this.offset += Utils.subStrCount(value, "\n") - Utils.subStrCount(trimmedValue, "\n");
            value = trimmedValue;
        }

        // Remove start of the document marker (---)
        [trimmedValue, count] = Array.from(this.PATTERN_DOCUMENT_MARKER_START.replaceAll(value, '', 1));
        if (count === 1) {
            // Items have been removed, update the offset
            this.offset += Utils.subStrCount(value, "\n") - Utils.subStrCount(trimmedValue, "\n");
            value = trimmedValue;

            // Remove end of the document marker (...)
            value = this.PATTERN_DOCUMENT_MARKER_END.replace(value, '');
        }

        // Ensure the block is not indented
        const lines = value.split("\n");
        let smallestIndent = -1;
        for (line of Array.from(lines)) {
            if (Utils.trim(line, ' ').length === 0) { continue; }
            const indent = line.length - Utils.ltrim(line).length;
            if ((smallestIndent === -1) || (indent < smallestIndent)) {
                smallestIndent = indent;
            }
        }
        if (smallestIndent > 0) {
            for (let i = 0; i < lines.length; i++) {
                line = lines[i];
                lines[i] = line.slice(smallestIndent);
            }
            value = lines.join("\n");
        }

        return value;
    }


    // Returns true if the next line starts unindented collection
    //
    // @return [Boolean]     Returns true if the next line starts unindented collection, false otherwise
    //
    isNextLineUnIndentedCollection(currentIndentation = null) {
        if (currentIndentation == null) { currentIndentation = this.getCurrentLineIndentation(); }
        let notEOF = this.moveToNextLine();

        while (notEOF && this.isCurrentLineEmpty()) {
            notEOF = this.moveToNextLine();
        }

        if (false === notEOF) {
            return false;
        }

        let ret = false;
        if ((this.getCurrentLineIndentation() === currentIndentation) && this.isStringUnIndentedCollectionItem(this.currentLine)) {
            ret = true;
        }

        this.moveToPreviousLine();

        return ret;
    }


    // Returns true if the string is un-indented collection item
    //
    // @return [Boolean]     Returns true if the string is un-indented collection item, false otherwise
    //
    isStringUnIndentedCollectionItem() {
        return (this.currentLine === '-') || (this.currentLine.slice(0, 2) === '- ');
    }
}
Parser.initClass();

// TODO: This file was created by bulk-decaffeinate.

// Dumper dumps JavaScript variables to YAML strings.
//
class Dumper {
    static initClass() {
    
        // The amount of spaces to use for indentation of nested nodes.
        this.indentation =   4;
    }


    // Dumps a JavaScript value to YAML.
    //
    // @param [Object]   input                   The JavaScript value
    // @param [Integer]  inline                  The level where you switch to inline YAML
    // @param [Integer]  indent                  The level of indentation (used internally)
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectEncoder           A function to serialize custom objects, null otherwise
    //
    // @return [String]  The YAML representation of the JavaScript value
    //
    dump(input, inline, indent, exceptionOnInvalidType, objectEncoder = null) {
        if (inline == null) { inline = 0; }
        if (indent == null) { indent = 0; }
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        let output = '';
        
        if (typeof(input) === 'function') {
            return output;
        }
        
        const prefix = (indent ? Utils.strRepeat(' ', indent) : '');

        if ((inline <= 0) || (typeof(input) !== 'object') || input instanceof Date || Utils.isEmpty(input)) {
            output += prefix + Inline.dump(input, exceptionOnInvalidType, objectEncoder);
        
        } else {
            let value, willBeInlined;
            if (input instanceof Array) {
                for (value of Array.from(input)) {
                    willBeInlined = (((inline - 1) <= 0) || (typeof(value) !== 'object') || Utils.isEmpty(value));

                    output +=
                        prefix +
                        '- ' +
                        this.dump(value, inline - 1, (willBeInlined ? 0 : indent + this.indentation), exceptionOnInvalidType, objectEncoder) +
                        (willBeInlined ? "\n" : '');
                }

            } else {
                for (let key in input) {
                    value = input[key];
                    willBeInlined = (((inline - 1) <= 0) || (typeof(value) !== 'object') || Utils.isEmpty(value));

                    output +=
                        prefix +
                        Inline.dump(key, exceptionOnInvalidType, objectEncoder) + ':' +
                        (willBeInlined ? ' ' : "\n") +
                        this.dump(value, inline - 1, (willBeInlined ? 0 : indent + this.indentation), exceptionOnInvalidType, objectEncoder) +
                        (willBeInlined ? "\n" : '');
                }
            }
        }

        return output;
    }
}
Dumper.initClass();

// TODO: This file was created by bulk-decaffeinate.

// Yaml offers convenience methods to load and dump YAML.
//
class Yaml {

    // Parses YAML into a JavaScript object.
    //
    // The parse method, when supplied with a YAML string,
    // will do its best to convert YAML in a file into a JavaScript object.
    //
    //  Usage:
    //     myObject = Yaml.parse('some: yaml');
    //     console.log(myObject);
    //
    // @param [String]   input                   A string containing YAML
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types, false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    // @return [Object]  The YAML converted to a JavaScript object
    //
    // @throw [ParseException] If the YAML is not valid
    //
    static parse(input, exceptionOnInvalidType, objectDecoder = null) {
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        return new Parser().parse(input, exceptionOnInvalidType, objectDecoder);
    }


    // Parses YAML from file path into a JavaScript object.
    //
    // The parseFile method, when supplied with a YAML file,
    // will do its best to convert YAML in a file into a JavaScript object.
    //
    //  Usage:
    //     myObject = Yaml.parseFile('config.yml');
    //     console.log(myObject);
    //
    // @param [String]   path                    A file path pointing to a valid YAML file
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types, false otherwise
    // @param [Function] objectDecoder           A function to deserialize custom objects, null otherwise
    //
    // @return [Object]  The YAML converted to a JavaScript object or null if the file doesn't exist.
    //
    // @throw [ParseException] If the YAML is not valid
    //
    static parseFile(path, callback = null, exceptionOnInvalidType, objectDecoder = null) {
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        if (callback != null) {
            // Async
            return Utils.getStringFromFile(path, input => {
                let result = null;
                if (input != null) {
                    result = this.parse(input, exceptionOnInvalidType, objectDecoder);
                }
                callback(result);
            });
        } else {
            // Sync
            const input = Utils.getStringFromFile(path);
            if (input != null) {
                return this.parse(input, exceptionOnInvalidType, objectDecoder);
            }
            return null;
        }
    }


    // Dumps a JavaScript object to a YAML string.
    //
    // The dump method, when supplied with an object, will do its best
    // to convert the object into friendly YAML.
    //
    // @param [Object]   input                   JavaScript object
    // @param [Integer]  inline                  The level where you switch to inline YAML
    // @param [Integer]  indent                  The amount of spaces to use for indentation of nested nodes.
    // @param [Boolean]  exceptionOnInvalidType  true if an exception must be thrown on invalid types (a JavaScript resource or object), false otherwise
    // @param [Function] objectEncoder           A function to serialize custom objects, null otherwise
    //
    // @return [String]  A YAML string representing the original JavaScript object
    //
    static dump(input, inline, indent, exceptionOnInvalidType, objectEncoder = null) {
        if (inline == null) { inline = 2; }
        if (indent == null) { indent = 4; }
        if (exceptionOnInvalidType == null) { exceptionOnInvalidType = false; }
        const yaml = new Dumper();
        yaml.indentation = indent;

        return yaml.dump(input, inline, 0, exceptionOnInvalidType, objectEncoder);
    }


    // Alias of dump() method for compatibility reasons.
    //
    static stringify(input, inline, indent, exceptionOnInvalidType, objectEncoder) {
        return this.dump(input, inline, indent, exceptionOnInvalidType, objectEncoder);
    }


    // Alias of parseFile() method for compatibility reasons.
    //
    static load(path, callback, exceptionOnInvalidType, objectDecoder) {
        return this.parseFile(path, callback, exceptionOnInvalidType, objectDecoder);
    }
}

const UIFilterbarMixin = {
    props: ['filtercriteria'],
    data: function () {
        return {
            selectedcounter: 0,
            viewmode: "list",
            selectmode: false,
            filter: null
        }
    },
    mounted: function () {
        this.filterbar = document.querySelector("ui-filter");
        if (this.filterbar) {
            this.viewmode = this.filterbar.mode;
            this.selectmode = this.filterbar.selectmode;
            this.updateViewModeBound = (event) => this.updateViewMode(event);
            this.updateSelectModeBound = (event) => this.updateSelectMode(event);
            this.updateFilterBound = (event) => this.updateFilter(event);
            this.filterbar.addEventListener("filter", this.updateFilterBound);
            this.filterbar.addEventListener("mode", this.updateViewModeBound);
            this.filterbar.addEventListener("selectmode", this.updateSelectModeBound);
        }
    },
    beforeDestroy: function () {
        if (this.filterbar) {
            this.filterbar.removeEventListener("filter", this.updateFilterBound);
            this.filterbar.removeEventListener("mode", this.updateViewModeBound);
            this.filterbar.removeEventListener("selectmode", this.updateSelectModeBound);
            delete this.filterbar;
        }
    },
    computed: {
        containerclasses: function () {
            var classes = [this.viewmode];
            if (this.selectmode) classes.push("selectionmode");
            return classes;
        },
        filtered: function () {
            if (!this.filter) return this.items;
            return this.items.filter(item => {
                var value = item[this.filtercriteria];
                if (!value) return false;
                return value.toLowerCase().match(this.filter);
            });
        }
    },
    methods: {
        updateFilter: function (event) {
            // Don't type-and-search if over 100 items in list
            if (this.items.length > 100 && event.detail.typing) return;
            this.filter = event.detail.value.toLowerCase();
        },
        updateSelectMode: function (event) {
            this.selectmode = event.detail.selectmode;
            this.updateSelectCounter();
        },
        updateViewMode: function (event) {
            this.viewmode = event.detail.mode;
        },
        updateSelectCounter: function (event) {
            if (!this.selectmode) return;
            var item = event ? event.target.closest('.listitem') : null;
            if (item) {
                if (item.classList.contains("selected")) {
                    item.classList.remove("selected");
                    this.selectedcounter = this.selectedcounter - 1;
                } else {
                    item.classList.add("selected");
                    this.selectedcounter = this.selectedcounter + 1;
                }
            } else {
                this.selectedcounter = 0;
                var items = document.querySelectorAll("#listcontainer .listitem");
                for (var item of items)
                    if (item.classList.contains("selected"))++this.selectedcounter;
            }
            document.querySelectorAll(".selectcounter").forEach(e => e.textContent = this.selectedcounter);
        }

    }
};

const UIEditorMixin = {
    props: ['modelschema', 'modeluri', 'runtimeKeys'],
    data: function () {
        return {
            editorstate: "original"
        }
    },
    computed: {
        editorclasses: function () {
            return this.editorstate == "original" ? "" : "changed";
        },
    },
    methods: {
        editorstateChanged: function (state) {
            this.editorstate = state;
        },
        toTextual: function () {
            // First get all filtered items
            var items = JSON.parse(JSON.stringify(this.filtered));
            // Then filter out the runtime keys in each item
            if (this.runtimeKeys) {
                for (var item of items) {
                    delete item.changed_; // We annotate UI changed items.
                    for (const runtimeKey of this.runtimeKeys)
                        delete item[runtimeKey];
                }
            }
            return {
                raw: items, value: Yaml.stringify(items, 2, 2).replace(/-   /g, "- "),
                language: 'yaml', modeluri: this.modeluri
            };
        },
    }
};

Vue.config.ignoredElements = [
    /^oh-/, /^ui-/
];

var OHListItemsWithID = {
    methods: {
        copyClipboard: function (event, itemid) {
            var range = document.createRange();
            range.selectNode(event.target);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand("copy");

            var el = document.createElement("ui-notification");
            el.id = "clipboard";
            el.setAttribute("close-time", 3000);
            el.innerHTML = `Copied ${itemid} to clipboard`;
            document.body.appendChild(el);
        }
    }
};

/**
 * A vue rendered list of times component. The template id for items
 * must be given as an argument "template". Several mixins are included
 * by default to allow a filter-bar, a text editor for items etc.
 * 
 * This component renders nothing until start() is called.
 */
class OhViewList extends HTMLElement {
    constructor() {
        super();
    }

    /**
     * Create the vue instance and render the list.
     * 
     * Usage: [ThingsMixin], 'http://openhab.org/schema/things-schema.json', schema, ["link","editable","statusInfo","properties"]
     * 
     * @param {Object[]} mixinList A list of mixin objects
     * @param {String} schema_uri A validation schema uri
     * @param {JSON} schema A json schema
     * @param {String[]} runtimeKeys A list of mixin objects
     */
    start(mixinList, schema_uri = null, schema = null, runtimeKeys = null) {
        const template = this.getAttribute("template");
        if (!template) {
            this.innerText = "No template id given!";
            return;
        }
        var el = document.createElement("div");
        this.appendChild(el);
        this.vue = new Vue({
            mixins: [OHListItemsWithID, UIFilterbarMixin, UIEditorMixin, ...mixinList],
            template: '#' + template,
            data: function () { return { items: [], pending: true, error: false } },
            methods: {
                changed: function (item) {
                    Vue.set( item, "changed_", true );
                },
                save: function (item) {
                    Vue.set( item, "storing_", true );
                }
            }
        }).$mount(this.childNodes[0]);
        this.vue.filtercriteria = this.getAttribute("filtercriteria");
        this.vue.modelschema = schema;
        this.vue.modeluri = schema_uri;
        this.vue.runtimeKeys = runtimeKeys;
    }
    connectedCallback() {
        this.dispatchEvent(new Event("load"));
    }
    set items(val) {
        this.vue.items = val;
        this.vue.pending = false;
    }
    get items() {
        return this.vue.items;
    }
    set modelschema(val) {
        this.vue.modelschema = val;
    }
    set modeluri(val) {
        this.vue.modeluri = val;
    }
    set runtimeKeys(val) {
        this.vue.runtimeKeys = val;
    }
}
customElements.define('oh-vue-list-items', OhViewList);

// Nav

export { UIFilterbarMixin, UIEditorMixin };
