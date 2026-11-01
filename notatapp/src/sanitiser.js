import DOMPurify from 'dompurify'

// Notat-HTML (editor, innlimt innhald, .eml-import) kan komme frå andre prosjektmedlemmar og frå e-postar — ALDRI sett det inn i DOM utan å gå gjennom denne.
// Tillèt formatering, tabellar, bilete (inkl. data:-URL frå skisser/utklipp) og stil-attributt; fjernar script, hendingsattributt, iframe/object/form og <style>.
const KONFIG = {
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base'],
  FORBID_ATTR: ['srcdoc', 'formaction'],
  ADD_ATTR: ['target'],
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer')
})

export function reinHtml(html) {
  return DOMPurify.sanitize(String(html || ''), KONFIG)
}
