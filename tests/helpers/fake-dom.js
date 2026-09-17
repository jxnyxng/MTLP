// Minimal DOM adapter for editor event tests; it does not replace browser QA.
class TextNode {
  constructor(text) { this.nodeType = 3; this.textContent = text; }
}

export class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
    this.disabled = false;
    this.open = false;
    this.classList = {
      add: (...names) => {
        this.className = [...new Set([...(this.className ?? "").split(" ").filter(Boolean), ...names])].join(" ");
      },
    };
  }
  get children() { return this.childNodes.filter((node) => node instanceof Element); }
  get textContent() { return this.childNodes.map((node) => node.textContent).join(""); }
  set textContent(text) { this.childNodes = [new TextNode(String(text))]; }
  append(...nodes) { this.childNodes.push(...nodes.map((node) => typeof node === "string" ? new TextNode(node) : node)); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, handler, options) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push({ handler, once: options?.once });
    this.listeners.set(name, listeners);
  }
  removeEventListener(name, handler) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((listener) => listener.handler !== handler));
  }
  async emit(name, values = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {}, ...values };
    for (const listener of [...(this.listeners.get(name) ?? [])]) {
      if (listener.once) this.removeEventListener(name, listener.handler);
      await listener.handler(event);
    }
    return event;
  }
  showModal() { this.open = true; }
  close() { this.open = false; void this.emit("close"); }
  focus() {}
  blur() {}
}

export function find(root, selector) {
  if (typeof selector === "function") {
    if (selector(root)) return root;
  } else {
    if (selector.startsWith("#") && root.id === selector.slice(1)) return root;
    if (selector.startsWith(".") && (root.className ?? "").split(" ").includes(selector.slice(1))) return root;
  }
  for (const child of root.children) {
    const match = find(child, selector);
    if (match) return match;
  }
  return null;
}

export function installFakeDom(t) {
  const names = ["document", "window", "HTMLElement", "Node", "requestAnimationFrame"];
  const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const body = new Element("body");
  const confirmations = [];
  globalThis.document = {
    body, activeElement: null, createElement: (tag) => new Element(tag),
    createTextNode: (text) => new TextNode(text),
    querySelector: (selector) => selector.split(" ").reduce((root, part) => root && find(root, part), body),
    queryCommandValue: () => "p", queryCommandState: () => false,
  };
  globalThis.window = { confirm: (message) => { confirmations.push(message); return true; } };
  globalThis.HTMLElement = Element;
  globalThis.Node = { TEXT_NODE: 3 };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { body, confirmations };
}
