'use strict';

const form = document.getElementById('survey-form');
const pages = [...form.querySelectorAll('[data-page]')];
const survey = document.getElementById('questionario');
const stepLabel = document.getElementById('step-label');
const progress = document.getElementById('progress');
const next = document.getElementById('next');
const back = document.getElementById('back');
const error = document.getElementById('error');
const comments = document.getElementById('comments');
const thankYou = document.getElementById('thank-you');
const thankYouTitle = document.getElementById('thank-you-title');
const download = document.getElementById('slides-download');
const isTestHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  || (location.hostname === 'dcmrkt.github.io' && location.pathname.startsWith('/webinar-test/'));
const isPreview = isTestHost && new URLSearchParams(location.search).get('preview') === '1';
let currentPage = 0;
let submitting = false;

for (const group of form.querySelectorAll('[data-entry]')) {
  const name = `entry.${group.dataset.entry}`;
  for (let value = 1; value <= 5; value++) {
    const label = document.createElement('label');
    label.className = 'rating-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = String(value);
    input.required = true;
    label.append(input, String(value));
    group.append(label);
  }

  const sentinel = document.createElement('input');
  sentinel.type = 'hidden';
  sentinel.name = `${name}_sentinel`;
  form.append(sentinel);
}

function clearError() {
  error.hidden = true;
  error.textContent = '';
  form.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
}

function renderStep(moveFocus = false) {
  pages.forEach((page, index) => { page.hidden = index !== currentPage; });
  back.hidden = currentPage === 0;
  next.textContent = currentPage === pages.length - 1 ? 'Invia risposte' : 'Avanti →';
  stepLabel.textContent = `Passaggio ${currentPage + 1} di ${pages.length}`;
  progress.value = currentPage + 1;
  if (moveFocus) {
    pages[currentPage].querySelector('legend').focus({ preventScroll: true });
    const top = survey.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.65) survey.scrollIntoView({ block: 'start' });
  }
}

function validateStep(pageIndex) {
  const controls = [...pages[pageIndex].querySelectorAll('input')];
  const invalid = controls.find(input => !input.checkValidity() || (input === comments && !input.value.trim()));
  if (!invalid) return true;

  currentPage = pageIndex;
  renderStep();
  error.textContent = invalid === comments
    ? 'Scrivi una risposta prima di inviare il questionario.'
    : 'Seleziona una valutazione per ogni voce prima di continuare.';
  error.hidden = false;
  invalid.setAttribute('aria-invalid', 'true');
  invalid.focus();
  return false;
}

async function showThanks() {
  form.hidden = true;
  if (isPreview) {
    thankYouTitle.textContent = 'Anteprima completata';
    document.getElementById('thank-you-copy').textContent = 'Le risposte di prova non sono state inviate.';
  }
  thankYou.hidden = false;
  thankYouTitle.focus();

  try {
    const response = await fetch(download.href, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || contentType !== 'application/pdf') throw new Error('PDF unavailable');
    download.hidden = false;
  } catch {
    document.getElementById('slides-unavailable').hidden = false;
  }
}

form.addEventListener('input', clearError);
back.addEventListener('click', () => {
  clearError();
  currentPage--;
  renderStep(true);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !thankYou.hidden) return;
  clearError();

  if (currentPage < pages.length - 1) {
    if (validateStep(currentPage)) {
      currentPage++;
      renderStep(true);
    }
    return;
  }

  if (!pages.every((_, index) => validateStep(index))) return;
  if (isPreview) {
    await showThanks();
    return;
  }

  submitting = true;
  next.disabled = true;
  back.disabled = true;
  next.textContent = 'Invio in corso…';
  form.setAttribute('aria-busy', 'true');
  const body = new URLSearchParams(new FormData(form));

  try {
    // Google Forms returns an opaque response to cross-origin submissions.
    // The browser can detect network errors, but cannot read Google's acknowledgement.
    await fetch(form.action, { method: 'POST', mode: 'no-cors', credentials: 'omit', body });
    await showThanks();
  } catch {
    error.textContent = 'Invio non riuscito. Controlla la connessione e riprova.';
    error.hidden = false;
  } finally {
    submitting = false;
    next.disabled = false;
    back.disabled = false;
    next.textContent = 'Invia risposte';
    form.removeAttribute('aria-busy');
    if (!form.hidden) next.focus();
  }
});

document.getElementById('preview-note').hidden = !isPreview;
renderStep();
form.hidden = false;
