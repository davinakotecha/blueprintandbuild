/*
 * dom.js (frontend-builder). Tiny helper so pages build elements with createElement and textContent only:
 * data from JSON never goes through innerHTML.
 *   el('a', { class: 'btn', href: 'x.html', text: 'Go' }, [child, 'text'])
 * Attribute values of null, undefined or false are skipped; true sets an empty attribute.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = String(value);
    else if (key === 'class') node.className = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
