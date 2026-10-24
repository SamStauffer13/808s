// Checks a form when it is sent. The browser's own pop-up is off (the form has `novalidate`) so each message can sit under
// its box (.err). A box with a `pattern` of ".*\S.*" is empty if it holds only spaces. Returns whether the form is fine to
// send, and otherwise puts the cursor in the first box that is not.
export function valid(e: SubmitEvent) {
  e.preventDefault()
  const form = e.currentTarget as HTMLFormElement
  if (form.checkValidity()) return true
  form.querySelector<HTMLInputElement>('input:invalid')?.focus()
  return false
}
